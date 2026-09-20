"""Bookings + wash queue API."""
from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Booking
from app.models.models import BookingStatus, WashStage
from app.schemas.entities import BookingIn, BookingOut, InspectionIn, StageMoveIn
from app.models import VehicleInspection
from app.security.deps import AuthContext, CSRFUser, require_permission
from app.services.bookings import create_booking, get_booking, move_stage, serialize_booking

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("")
def list_bookings(
    scheduled_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    branch_id: int | None = None,
    status: str | None = None,
    wash_stage: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("bookings.view", "bookings.manage", "queue.manage")),
):
    query = (
        db.query(Booking)
        .options(
            joinedload(Booking.customer),
            joinedload(Booking.vehicle),
            joinedload(Booking.service),
            joinedload(Booking.package),
            joinedload(Booking.branch),
            joinedload(Booking.assigned_employee),
        )
        .filter(Booking.is_deleted.is_(False))
    )
    if scheduled_date:
        query = query.filter(Booking.scheduled_date == scheduled_date)
    if date_from:
        query = query.filter(Booking.scheduled_date >= date_from)
    if date_to:
        query = query.filter(Booking.scheduled_date <= date_to)
    if branch_id:
        query = query.filter(Booking.branch_id == branch_id)
    if status:
        query = query.filter(Booking.status == status)
    if wash_stage:
        query = query.filter(Booking.wash_stage == wash_stage)
    if q:
        like = f"%{q}%"
        query = query.filter((Booking.booking_number.ilike(like)) | (Booking.customer_phone.ilike(like)) | (Booking.notes.ilike(like)))
    total = query.count()
    rows = query.order_by(Booking.scheduled_date.desc(), Booking.scheduled_time).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [serialize_booking(b) for b in rows], "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=201)
def create(payload: BookingIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("bookings.manage"))):
    try:
        b = create_booking(db, payload, user_id=ctx.user.id, username=ctx.user.username)
    except ValueError as e:
        bad_request(str(e))
    return serialize_booking(b)


@router.get("/queue")
def wash_queue(
    branch_id: int | None = None,
    scheduled_date: date | None = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("queue.manage", "bookings.view")),
):
    d = scheduled_date or date.today()
    query = (
        db.query(Booking)
        .options(
            joinedload(Booking.customer),
            joinedload(Booking.vehicle),
            joinedload(Booking.service),
            joinedload(Booking.package),
            joinedload(Booking.assigned_employee),
            joinedload(Booking.branch),
        )
        .filter(
            Booking.is_deleted.is_(False),
            Booking.scheduled_date == d,
            Booking.wash_stage.notin_([WashStage.CANCELLED.value, WashStage.NO_SHOW.value]),
        )
    )
    if branch_id:
        query = query.filter(Booking.branch_id == branch_id)
    rows = query.order_by(Booking.priority.desc(), Booking.scheduled_time).all()
    by_stage: dict[str, list] = {}
    for b in rows:
        by_stage.setdefault(b.wash_stage, []).append(serialize_booking(b))
    return {"date": d.isoformat(), "stages": by_stage, "items": [serialize_booking(b) for b in rows]}


@router.get("/{booking_id}")
def get_one(booking_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("bookings.view", "bookings.manage"))):
    b = get_booking(db, booking_id)
    if not b:
        not_found()
    return serialize_booking(b)


@router.put("/{booking_id}")
def update(booking_id: int, payload: BookingIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("bookings.manage"))):
    b = get_booking(db, booking_id)
    if not b:
        not_found()
    for field in (
        "customer_id", "vehicle_id", "branch_id", "service_id", "package_id",
        "assigned_employee_id", "wash_bay_id", "scheduled_date", "scheduled_time",
        "duration_minutes", "source", "priority", "notes", "internal_notes",
        "special_instructions", "customer_phone", "customer_email",
    ):
        setattr(b, field, getattr(payload, field))
    b.discount_amount = payload.discount_amount
    db.commit()
    return serialize_booking(get_booking(db, booking_id))


@router.post("/{booking_id}/stage")
def change_stage(booking_id: int, payload: StageMoveIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("queue.manage", "bookings.manage"))):
    try:
        b = move_stage(db, booking_id, payload, user_id=ctx.user.id, username=ctx.user.username)
    except ValueError as e:
        bad_request(str(e))
    return serialize_booking(b)


@router.post("/{booking_id}/check-in")
def check_in(booking_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("queue.manage", "bookings.manage"))):
    return change_stage(booking_id, StageMoveIn(to_stage=WashStage.CHECK_IN.value), db, ctx)


@router.post("/{booking_id}/cancel")
def cancel(booking_id: int, reason: str | None = None, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("bookings.manage"))):
    return change_stage(booking_id, StageMoveIn(to_stage=WashStage.CANCELLED.value, notes=reason), db, ctx)


@router.post("/{booking_id}/duplicate", status_code=201)
def duplicate(booking_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("bookings.manage"))):
    b = get_booking(db, booking_id)
    if not b:
        not_found()
    payload = BookingIn(
        customer_id=b.customer_id,
        vehicle_id=b.vehicle_id,
        branch_id=b.branch_id,
        service_id=b.service_id,
        package_id=b.package_id,
        scheduled_date=date.today(),
        scheduled_time=b.scheduled_time,
        duration_minutes=b.duration_minutes,
        source="STAFF",
        notes=b.notes,
        special_instructions=b.special_instructions,
        customer_phone=b.customer_phone,
        customer_email=b.customer_email,
    )
    nb = create_booking(db, payload, user_id=ctx.user.id, username=ctx.user.username)
    return serialize_booking(nb)


@router.post("/{booking_id}/inspection", status_code=201)
def add_inspection(booking_id: int, payload: InspectionIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("bookings.manage", "queue.manage"))):
    b = get_booking(db, booking_id)
    if not b:
        not_found()
    insp = VehicleInspection(
        booking_id=booking_id,
        vehicle_id=payload.vehicle_id,
        employee_id=payload.employee_id,
        scratches=payload.scratches,
        dents=payload.dents,
        cracks=payload.cracks,
        wheels=payload.wheels,
        interior=payload.interior,
        valuables=payload.valuables,
        other_notes=payload.other_notes,
        customer_acknowledged=payload.customer_acknowledged,
        acknowledged_at=datetime.utcnow() if payload.customer_acknowledged else None,
    )
    db.add(insp)
    db.commit()
    db.refresh(insp)
    return {"id": insp.id, "booking_id": booking_id, "message": "Inspection recorded"}


@router.delete("/{booking_id}")
def delete_booking(booking_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("bookings.manage"))):
    b = db.get(Booking, booking_id)
    if not b or b.is_deleted:
        not_found()
    b.is_deleted = True
    b.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Booking archived"}
