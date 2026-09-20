"""Wash bay board, status sync, and default bay seeding."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session, joinedload

from app.models import Booking, Branch, Employee, WashBay
from app.models.models import BayStatus, BookingStatus, WashStage
from app.utils.vehicles import vehicle_description

BUSY_STAGES = {
    WashStage.PRE_WASH.value,
    WashStage.WASHING.value,
    WashStage.INTERIOR.value,
    WashStage.DETAILING.value,
    WashStage.QUALITY_CHECK.value,
    WashStage.WAITING.value,
    WashStage.CHECK_IN.value,
}

TERMINAL_STAGES = {
    WashStage.READY.value,
    WashStage.COLLECTED.value,
    WashStage.CANCELLED.value,
    WashStage.NO_SHOW.value,
}


def ensure_default_bays(db: Session) -> None:
    """Seed Bay 1 + Bay 2 only when a branch has no wash bays yet.

    Never renames, reactivates, or restores existing / soft-deleted bays so
    operators can customise N bays freely after first install.
    """
    branches = db.query(Branch).filter(Branch.is_deleted.is_(False)).all()
    for branch in branches:
        count = (
            db.query(WashBay)
            .filter(WashBay.branch_id == branch.id, WashBay.is_deleted.is_(False))
            .count()
        )
        if count > 0:
            continue
        for num in (1, 2):
            db.add(
                WashBay(
                    branch_id=branch.id,
                    name=f"Bay {num}",
                    bay_number=num,
                    bay_type="STANDARD",
                    status=BayStatus.AVAILABLE.value,
                    is_active=True,
                )
            )
    db.commit()


def next_bay_number(db: Session, branch_id: int) -> int:
    row = (
        db.query(WashBay)
        .filter(WashBay.branch_id == branch_id, WashBay.is_deleted.is_(False))
        .order_by(WashBay.bay_number.desc())
        .first()
    )
    return (row.bay_number + 1) if row else 1


def soft_delete_bay(db: Session, bay_id: int) -> WashBay:
    bay = db.get(WashBay, bay_id)
    if not bay or bay.is_deleted:
        raise ValueError("Wash bay not found")
    bay.is_deleted = True
    bay.deleted_at = datetime.utcnow()
    bay.is_active = False
    db.commit()
    db.refresh(bay)
    return bay


def reorder_bays(db: Session, items: list[dict]) -> list[WashBay]:
    """items: [{id, bay_number}] — updates sort order via bay_number."""
    updated: list[WashBay] = []
    for item in items:
        bay = db.get(WashBay, int(item["id"]))
        if not bay or bay.is_deleted:
            continue
        bay.bay_number = int(item["bay_number"])
        updated.append(bay)
    db.commit()
    for b in updated:
        db.refresh(b)
    return updated


def sync_bay_occupancy(db: Session, wash_bay_id: int | None = None) -> None:
    """Auto-set Busy/Available from active bookings unless status is locked."""
    q = db.query(WashBay).filter(WashBay.is_deleted.is_(False), WashBay.is_active.is_(True))
    if wash_bay_id:
        q = q.filter(WashBay.id == wash_bay_id)
    for bay in q.all():
        if bay.status_locked and bay.status in (BayStatus.OFFLINE.value, BayStatus.CLOSED.value):
            continue
        active = (
            db.query(Booking)
            .filter(
                Booking.is_deleted.is_(False),
                Booking.wash_bay_id == bay.id,
                Booking.wash_stage.in_(list(BUSY_STAGES)),
                Booking.status != BookingStatus.CANCELLED.value,
            )
            .order_by(Booking.started_at.desc(), Booking.id.desc())
            .first()
        )
        if active:
            bay.status = BayStatus.BUSY.value
            if active.assigned_employee_id:
                bay.assigned_employee_id = active.assigned_employee_id
        else:
            if not bay.status_locked:
                if bay.status in (BayStatus.BUSY.value, BayStatus.OPEN.value, BayStatus.AVAILABLE.value) or not bay.status:
                    bay.status = BayStatus.AVAILABLE.value
    db.commit()


def set_bay_status(
    db: Session,
    bay_id: int,
    status: str,
    assigned_employee_id: int | None = None,
    notes: str | None = None,
    lock: bool | None = None,
) -> WashBay:
    bay = db.get(WashBay, bay_id)
    if not bay or bay.is_deleted:
        raise ValueError("Wash bay not found")
    try:
        BayStatus(status)
    except ValueError as e:
        raise ValueError(f"Invalid bay status: {status}") from e
    bay.status = status
    if assigned_employee_id is not None:
        bay.assigned_employee_id = assigned_employee_id or None
    if notes is not None:
        bay.notes = notes
    if lock is None:
        bay.status_locked = status in (BayStatus.OFFLINE.value, BayStatus.CLOSED.value)
    else:
        bay.status_locked = lock
    if status == BayStatus.AVAILABLE.value:
        bay.status_locked = False
    db.commit()
    db.refresh(bay)
    return bay


def _eta_for(booking: Booking) -> str | None:
    if not booking:
        return None
    mins = booking.duration_minutes or 30
    if booking.started_at:
        end = booking.started_at + timedelta(minutes=mins)
        remaining = int((end - datetime.utcnow()).total_seconds() / 60)
        if remaining <= 0:
            return "Due now"
        return f"~{remaining} min"
    if booking.scheduled_time:
        return f"Slot {booking.scheduled_time.strftime('%H:%M')}"
    return f"~{mins} min"


def bay_board(db: Session, branch_id: int | None = None, active_only: bool = True) -> dict:
    sync_bay_occupancy(db)
    q = (
        db.query(WashBay)
        .options(joinedload(WashBay.branch), joinedload(WashBay.assigned_employee))
        .filter(WashBay.is_deleted.is_(False))
    )
    if active_only:
        q = q.filter(WashBay.is_active.is_(True))
    if branch_id:
        q = q.filter(WashBay.branch_id == branch_id)
    bays = q.order_by(WashBay.branch_id, WashBay.bay_number, WashBay.id).all()
    items = []
    today = date.today()
    for bay in bays:
        current = (
            db.query(Booking)
            .options(
                joinedload(Booking.customer),
                joinedload(Booking.vehicle),
                joinedload(Booking.service),
                joinedload(Booking.package),
                joinedload(Booking.assigned_employee),
            )
            .filter(
                Booking.is_deleted.is_(False),
                Booking.wash_bay_id == bay.id,
                Booking.wash_stage.notin_(list(TERMINAL_STAGES)),
                Booking.scheduled_date == today,
            )
            .order_by(Booking.started_at.desc(), Booking.priority.desc(), Booking.id.desc())
            .first()
        )
        if not current:
            current = (
                db.query(Booking)
                .options(
                    joinedload(Booking.customer),
                    joinedload(Booking.vehicle),
                    joinedload(Booking.service),
                    joinedload(Booking.package),
                    joinedload(Booking.assigned_employee),
                )
                .filter(
                    Booking.is_deleted.is_(False),
                    Booking.wash_bay_id == bay.id,
                    Booking.wash_stage.in_(list(BUSY_STAGES)),
                )
                .order_by(Booking.started_at.desc(), Booking.id.desc())
                .first()
            )
        display_status = bay.status or BayStatus.AVAILABLE.value
        if current and current.wash_stage in BUSY_STAGES and not bay.status_locked:
            display_status = BayStatus.BUSY.value
        staff = None
        if bay.assigned_employee:
            staff = bay.assigned_employee.full_name
        elif current and current.assigned_employee:
            staff = current.assigned_employee.full_name
        vehicle = None
        if current:
            veh = current.vehicle
            vehicle = {
                "booking_id": current.id,
                "booking_number": current.booking_number,
                "ticket_number": current.ticket_number,
                "registration": veh.registration if veh else None,
                "description": vehicle_description(veh),
                "colour": veh.colour if veh else None,
                "make": veh.make if veh else None,
                "model": veh.model if veh else None,
                "customer": current.customer.full_name if current.customer else None,
                "customer_phone": current.customer_phone or (current.customer.phone if current.customer else None),
                "service": (current.service.name if current.service else None)
                or (current.package.name if current.package else None),
                "stage": current.wash_stage,
                "eta": _eta_for(current),
                "staff": current.assigned_employee.full_name if current.assigned_employee else staff,
            }
        items.append(
            {
                "id": bay.id,
                "branch_id": bay.branch_id,
                "branch_name": bay.branch.name if bay.branch else None,
                "name": bay.name,
                "bay_number": bay.bay_number,
                "bay_type": bay.bay_type,
                "status": display_status,
                "status_locked": bool(bay.status_locked),
                "is_active": bay.is_active,
                "assigned_employee_id": bay.assigned_employee_id,
                "assigned_staff": staff,
                "notes": bay.notes,
                "current_vehicle": vehicle,
            }
        )
    return {"items": items, "total": len(items), "statuses": [s.value for s in BayStatus]}
