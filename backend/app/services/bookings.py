"""Booking and wash-stage domain logic."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models import Booking, BookingItem, Customer, Package, Service, Vehicle, WashStageHistory
from app.models.models import BookingStatus, PaymentStatus, WASH_STAGE_ORDER, WashStage
from app.schemas.entities import BookingIn, StageMoveIn
from app.services.audit import activity, audit
from app.utils.numbering import next_number


def _price_for(db: Session, data: BookingIn) -> tuple[Decimal, Decimal, Decimal, int]:
    subtotal = Decimal("0")
    duration = data.duration_minutes
    tax_rate = Decimal("15")
    if data.package_id:
        pkg = db.get(Package, data.package_id)
        if pkg:
            subtotal = Decimal(str(pkg.price))
            duration = pkg.duration_minutes
    elif data.service_id:
        svc = db.get(Service, data.service_id)
        if svc:
            subtotal = Decimal(str(svc.base_price))
            duration = svc.duration_minutes
            tax_rate = Decimal(str(svc.tax_rate))
            # size pricing
            veh = db.get(Vehicle, data.vehicle_id)
            if veh and svc.size_prices:
                for sp in svc.size_prices:
                    if sp.size == veh.size:
                        subtotal = Decimal(str(sp.price))
                        if sp.duration_minutes:
                            duration = sp.duration_minutes
                        break
    for extra in data.extras or []:
        subtotal += Decimal(str(extra.get("unit_price", 0))) * int(extra.get("quantity", 1))
    discount = Decimal(str(data.discount_amount or 0))
    if discount < 0:
        raise ValueError("Discount cannot be negative")
    taxable = max(subtotal - discount, Decimal("0"))
    tax = (taxable * tax_rate / Decimal("100")).quantize(Decimal("0.01"))
    total = taxable + tax
    return subtotal, tax, total, duration


def serialize_booking(b: Booking) -> dict:
    return {
        "id": b.id,
        "booking_number": b.booking_number,
        "customer_id": b.customer_id,
        "vehicle_id": b.vehicle_id,
        "branch_id": b.branch_id,
        "service_id": b.service_id,
        "package_id": b.package_id,
        "assigned_employee_id": b.assigned_employee_id,
        "wash_bay_id": b.wash_bay_id,
        "scheduled_date": b.scheduled_date,
        "scheduled_time": b.scheduled_time,
        "duration_minutes": b.duration_minutes,
        "status": b.status,
        "wash_stage": b.wash_stage,
        "source": b.source,
        "priority": b.priority,
        "notes": b.notes,
        "internal_notes": b.internal_notes,
        "special_instructions": b.special_instructions,
        "subtotal": b.subtotal,
        "tax_amount": b.tax_amount,
        "discount_amount": b.discount_amount,
        "total_amount": b.total_amount,
        "payment_status": b.payment_status,
        "customer_phone": b.customer_phone,
        "customer_email": b.customer_email,
        "arrived_at": b.arrived_at,
        "checked_in_at": b.checked_in_at,
        "started_at": b.started_at,
        "completed_at": b.completed_at,
        "collected_at": b.collected_at,
        "created_at": b.created_at,
        "customer_name": b.customer.full_name if b.customer else None,
        "vehicle_registration": b.vehicle.registration if b.vehicle else None,
        "vehicle_make_model": f"{b.vehicle.make or ''} {b.vehicle.model or ''}".strip() if b.vehicle else None,
        "service_name": b.service.name if b.service else None,
        "package_name": b.package.name if b.package else None,
        "branch_name": b.branch.name if b.branch else None,
        "assignee_name": b.assigned_employee.full_name if b.assigned_employee else None,
    }


def create_booking(db: Session, data: BookingIn, user_id: int | None = None, username: str | None = None) -> Booking:
    cust = db.get(Customer, data.customer_id)
    veh = db.get(Vehicle, data.vehicle_id)
    if not cust or cust.is_deleted:
        raise ValueError("Customer not found")
    if not veh or veh.is_deleted or veh.customer_id != cust.id:
        raise ValueError("Vehicle not found for customer")
    subtotal, tax, total, duration = _price_for(db, data)
    booking = Booking(
        booking_number=next_number(db, Booking, "booking_number", "BKG"),
        customer_id=data.customer_id,
        vehicle_id=data.vehicle_id,
        branch_id=data.branch_id,
        service_id=data.service_id,
        package_id=data.package_id,
        assigned_employee_id=data.assigned_employee_id,
        wash_bay_id=data.wash_bay_id,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        duration_minutes=duration,
        status=BookingStatus.CONFIRMED.value,
        wash_stage=WashStage.BOOKED.value,
        source=data.source,
        priority=data.priority,
        notes=data.notes,
        internal_notes=data.internal_notes,
        special_instructions=data.special_instructions,
        customer_phone=data.customer_phone or cust.phone,
        customer_email=data.customer_email or cust.email,
        subtotal=subtotal,
        tax_amount=tax,
        discount_amount=Decimal(str(data.discount_amount or 0)),
        total_amount=total,
        payment_status=PaymentStatus.PENDING.value,
        created_by_id=user_id,
    )
    db.add(booking)
    db.flush()
    if data.service_id:
        svc = db.get(Service, data.service_id)
        if svc:
            db.add(
                BookingItem(
                    booking_id=booking.id,
                    service_id=svc.id,
                    description=svc.name,
                    quantity=1,
                    unit_price=subtotal,
                    tax_rate=svc.tax_rate,
                    line_total=total,
                )
            )
    for extra in data.extras or []:
        db.add(
            BookingItem(
                booking_id=booking.id,
                service_id=extra.get("service_id"),
                description=extra.get("description", "Extra"),
                quantity=int(extra.get("quantity", 1)),
                unit_price=Decimal(str(extra.get("unit_price", 0))),
                line_total=Decimal(str(extra.get("unit_price", 0))) * int(extra.get("quantity", 1)),
            )
        )
    db.add(
        WashStageHistory(
            booking_id=booking.id,
            from_stage=None,
            to_stage=WashStage.BOOKED.value,
            changed_by_id=user_id,
            notes="Booking created",
        )
    )
    audit(db, action="BOOKING_CREATE", user_id=user_id, username=username, entity_type="booking", entity_id=booking.id)
    activity(
        db,
        action="booking_created",
        summary=f"Booking {booking.booking_number} created for {cust.full_name}",
        user_id=user_id,
        actor_name=username,
        entity_type="booking",
        entity_id=booking.id,
    )
    db.commit()
    return get_booking(db, booking.id)


def get_booking(db: Session, booking_id: int) -> Booking | None:
    return (
        db.query(Booking)
        .options(
            joinedload(Booking.customer),
            joinedload(Booking.vehicle),
            joinedload(Booking.service),
            joinedload(Booking.package),
            joinedload(Booking.branch),
            joinedload(Booking.assigned_employee),
        )
        .filter(Booking.id == booking_id, Booking.is_deleted.is_(False))
        .first()
    )


def move_stage(db: Session, booking_id: int, data: StageMoveIn, user_id: int | None = None, username: str | None = None) -> Booking:
    booking = get_booking(db, booking_id)
    if not booking:
        raise ValueError("Booking not found")
    try:
        to_stage = WashStage(data.to_stage)
    except ValueError as e:
        raise ValueError(f"Invalid stage: {data.to_stage}") from e

    if to_stage in (WashStage.CANCELLED, WashStage.NO_SHOW):
        booking.status = BookingStatus.CANCELLED.value if to_stage == WashStage.CANCELLED else BookingStatus.NO_SHOW.value
        booking.cancelled_at = datetime.utcnow()
        booking.cancel_reason = data.notes
    else:
        # allow free movement for operational flexibility, but stamp timestamps
        now = datetime.utcnow()
        if to_stage == WashStage.ARRIVED and not booking.arrived_at:
            booking.arrived_at = now
        if to_stage == WashStage.CHECK_IN and not booking.checked_in_at:
            booking.checked_in_at = now
            booking.arrived_at = booking.arrived_at or now
        if to_stage in (WashStage.PRE_WASH, WashStage.WASHING) and not booking.started_at:
            booking.started_at = now
            booking.status = BookingStatus.IN_PROGRESS.value
        if to_stage == WashStage.READY and not booking.completed_at:
            booking.completed_at = now
            booking.status = BookingStatus.COMPLETED.value
        if to_stage == WashStage.COLLECTED:
            booking.collected_at = now
            booking.completed_at = booking.completed_at or now
            booking.status = BookingStatus.COMPLETED.value

    from_stage = booking.wash_stage
    booking.wash_stage = to_stage.value
    if data.employee_id:
        booking.assigned_employee_id = data.employee_id
    db.add(
        WashStageHistory(
            booking_id=booking.id,
            from_stage=from_stage,
            to_stage=to_stage.value,
            changed_by_id=user_id,
            employee_id=data.employee_id,
            notes=data.notes,
        )
    )
    audit(db, action="STAGE_MOVE", user_id=user_id, username=username, entity_type="booking", entity_id=booking.id, details=f"{from_stage} -> {to_stage.value}")
    activity(
        db,
        action="stage_move",
        summary=f"{booking.booking_number}: {from_stage} → {to_stage.value}",
        user_id=user_id,
        actor_name=username,
        entity_type="booking",
        entity_id=booking.id,
    )
    db.commit()
    return get_booking(db, booking.id)
