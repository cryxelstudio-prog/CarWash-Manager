"""Payment and cash-up services."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Booking, CashUp, Invoice, InvoiceItem, Payment
from app.models.models import PaymentMethod, PaymentStatus
from app.schemas.entities import CashUpIn, PaymentIn
from app.services.audit import activity, audit
from app.utils.numbering import next_number


def record_payment(db: Session, data: PaymentIn, user_id: int | None = None, username: str | None = None) -> Payment:
    if data.amount <= 0:
        raise ValueError("Amount must be positive")
    booking = db.get(Booking, data.booking_id) if data.booking_id else None
    payment = Payment(
        payment_number=next_number(db, Payment, "payment_number", "PAY"),
        booking_id=data.booking_id,
        invoice_id=data.invoice_id,
        customer_id=data.customer_id or (booking.customer_id if booking else None),
        branch_id=data.branch_id or (booking.branch_id if booking else None),
        amount=data.amount,
        method=data.method,
        status=PaymentStatus.PAID.value,
        reference=data.reference,
        notes=data.notes,
        received_by_id=user_id,
    )
    db.add(payment)
    db.flush()

    if booking:
        paid = (
            db.query(func.coalesce(func.sum(Payment.amount), 0))
            .filter(Payment.booking_id == booking.id, Payment.is_deleted.is_(False), Payment.status == PaymentStatus.PAID.value)
            .scalar()
        )
        paid = Decimal(str(paid))
        if paid >= booking.total_amount:
            booking.payment_status = PaymentStatus.PAID.value
        elif paid > 0:
            booking.payment_status = PaymentStatus.PARTIAL.value
        else:
            booking.payment_status = PaymentStatus.PENDING.value

        # auto invoice if paid
        if booking.payment_status == PaymentStatus.PAID.value:
            inv = ensure_invoice_for_booking(db, booking)
            payment.invoice_id = inv.id
            inv.amount_paid = paid
            inv.status = "PAID"

    audit(db, action="PAYMENT_RECORD", user_id=user_id, username=username, entity_type="payment", entity_id=payment.id)
    activity(
        db,
        action="payment",
        summary=f"Payment {payment.payment_number} of {payment.amount} via {payment.method}",
        user_id=user_id,
        actor_name=username,
        entity_type="payment",
        entity_id=payment.id,
    )
    db.commit()
    db.refresh(payment)
    return payment


def ensure_invoice_for_booking(db: Session, booking: Booking) -> Invoice:
    existing = db.query(Invoice).filter(Invoice.booking_id == booking.id, Invoice.is_deleted.is_(False)).first()
    if existing:
        return existing
    inv = Invoice(
        invoice_number=next_number(db, Invoice, "invoice_number", "INV"),
        booking_id=booking.id,
        customer_id=booking.customer_id,
        branch_id=booking.branch_id,
        invoice_date=date.today(),
        subtotal=booking.subtotal,
        tax_amount=booking.tax_amount,
        discount_amount=booking.discount_amount,
        total_amount=booking.total_amount,
        amount_paid=Decimal("0"),
        status="ISSUED",
    )
    db.add(inv)
    db.flush()
    for item in booking.items:
        db.add(
            InvoiceItem(
                invoice_id=inv.id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                tax_rate=item.tax_rate,
                line_total=item.line_total,
            )
        )
    if not booking.items:
        db.add(
            InvoiceItem(
                invoice_id=inv.id,
                description=booking.service.name if booking.service else "Wash service",
                quantity=1,
                unit_price=booking.subtotal,
                tax_rate=Decimal("15"),
                line_total=booking.total_amount,
            )
        )
    return inv


def create_cash_up(db: Session, data: CashUpIn, user_id: int | None = None) -> CashUp:
    # tally payments for the day
    rows = (
        db.query(Payment.method, func.coalesce(func.sum(Payment.amount), 0))
        .filter(
            Payment.branch_id == data.branch_id,
            Payment.is_deleted.is_(False),
            Payment.status == PaymentStatus.PAID.value,
            func.date(Payment.paid_at) == data.cash_up_date,
        )
        .group_by(Payment.method)
        .all()
    )
    totals = {m: Decimal(str(v)) for m, v in rows}
    cash = totals.get(PaymentMethod.CASH.value, Decimal("0"))
    card = totals.get(PaymentMethod.CARD.value, Decimal("0"))
    eft = totals.get(PaymentMethod.EFT.value, Decimal("0"))
    other = sum((v for k, v in totals.items() if k not in (PaymentMethod.CASH.value, PaymentMethod.CARD.value, PaymentMethod.EFT.value)), Decimal("0"))
    expected = cash
    variance = Decimal(str(data.counted_cash)) - expected
    cu = CashUp(
        branch_id=data.branch_id,
        cash_up_date=data.cash_up_date,
        opened_by_id=user_id,
        closed_by_id=user_id,
        opening_float=data.opening_float,
        expected_cash=expected,
        counted_cash=data.counted_cash,
        card_total=card,
        eft_total=eft,
        other_total=other,
        variance=variance,
        status="CLOSED",
        notes=data.notes,
    )
    db.add(cu)
    db.commit()
    db.refresh(cu)
    return cu
