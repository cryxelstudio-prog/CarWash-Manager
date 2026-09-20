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
    method = (data.method or "CASH").upper().replace(" ", "_")
    if method == "SALARY":
        method = PaymentMethod.SALARY_DEDUCTION.value
    status = (data.status or PaymentStatus.PAID.value).upper()
    if method == PaymentMethod.SALARY_DEDUCTION.value and not data.status:
        status = PaymentStatus.PENDING_SALARY.value
    emp_no = getattr(data, "employee_number", None)
    if emp_no:
        emp_no = str(emp_no).strip() or None
    if method == PaymentMethod.SALARY_DEDUCTION.value and not emp_no:
        if booking and booking.employee_number:
            emp_no = booking.employee_number
        if not emp_no:
            raise ValueError(
                "Employee number is required for salary deduction "
                "(anyone can use it — enter the payroll employee number)."
            )
    payment = Payment(
        payment_number=next_number(db, Payment, "payment_number", "PAY"),
        booking_id=data.booking_id,
        invoice_id=data.invoice_id,
        customer_id=data.customer_id or (booking.customer_id if booking else None),
        branch_id=data.branch_id or (booking.branch_id if booking else None),
        amount=data.amount,
        method=method,
        status=status,
        reference=data.reference or emp_no,
        notes=data.notes,
        received_by_id=user_id,
        employee_number=emp_no,
    )
    db.add(payment)
    db.flush()

    if booking:
        if emp_no and not booking.employee_number:
            booking.employee_number = emp_no
        if method == PaymentMethod.SALARY_DEDUCTION.value and not booking.payment_method_intent:
            booking.payment_method_intent = "salary_deduction"
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
        elif status == PaymentStatus.PENDING_SALARY.value:
            booking.payment_status = PaymentStatus.PENDING_SALARY.value
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





# ── v0.7.0 salary deduction ledger ─────────────────────────────────

def ensure_salary_pending_for_booking(
    db: Session,
    booking: Booking,
    user_id: int | None = None,
    username: str | None = None,
) -> Payment | None:
    """When wash completes + salary_deduction intent, create PENDING_SALARY payment."""
    intent = (booking.payment_method_intent or "").strip().lower()
    if intent != "salary_deduction":
        return None
    existing = (
        db.query(Payment)
        .filter(
            Payment.booking_id == booking.id,
            Payment.is_deleted.is_(False),
            Payment.method == PaymentMethod.SALARY_DEDUCTION.value,
        )
        .first()
    )
    if existing:
        return existing
    emp_no = (booking.employee_number or "").strip() or None
    if not emp_no and booking.customer and getattr(booking.customer, "employee_number", None):
        emp_no = booking.customer.employee_number
    if not emp_no:
        # Should not happen if validation ran; skip rather than create invalid ledger row
        return None
    payment = Payment(
        payment_number=next_number(db, Payment, "payment_number", "PAY"),
        booking_id=booking.id,
        customer_id=booking.customer_id,
        branch_id=booking.branch_id,
        amount=booking.total_amount,
        method=PaymentMethod.SALARY_DEDUCTION.value,
        status=PaymentStatus.PENDING_SALARY.value,
        reference=emp_no,
        employee_number=emp_no,
        notes="Salary deduction – billed at month end",
        received_by_id=user_id,
    )
    db.add(payment)
    # Keep booking payment_status pending until payroll marks paid
    if booking.payment_status == PaymentStatus.PENDING.value:
        booking.payment_status = PaymentStatus.PENDING_SALARY.value
    inv = ensure_invoice_for_booking(db, booking)
    payment.invoice_id = inv.id
    if inv.status not in ("PAID",):
        inv.status = "UNPAID"
        inv.notes = (inv.notes or "")
        if "salary_deduction" not in (inv.notes or ""):
            inv.notes = ((inv.notes or "") + "\nMethod: salary_deduction").strip()
    audit(
        db,
        action="SALARY_PENDING",
        user_id=user_id,
        username=username,
        entity_type="payment",
        entity_id=None,
        details=f"Pending salary for booking {booking.booking_number} emp {emp_no}",
    )
    activity(
        db,
        action="salary_pending",
        summary=f"Salary deduction pending {payment.payment_number} for {emp_no}",
        user_id=user_id,
        actor_name=username,
        entity_type="payment",
        entity_id=None,
    )
    db.commit()
    db.refresh(payment)
    return payment



def ensure_cash_paid_for_booking(
    db: Session,
    booking: Booking,
    user_id: int | None = None,
    username: str | None = None,
) -> Payment | None:
    """When wash completes with cash/card/eft intent, record a PAID payment so revenue totals."""
    intent = (booking.payment_method_intent or "cash").strip().lower()
    if intent in ("salary_deduction", "salary", "account"):
        return None
    # Already fully paid?
    existing_paid = (
        db.query(Payment)
        .filter(
            Payment.booking_id == booking.id,
            Payment.is_deleted.is_(False),
            Payment.status == PaymentStatus.PAID.value,
        )
        .first()
    )
    if existing_paid:
        return existing_paid
    method_map = {
        "cash": PaymentMethod.CASH.value,
        "card": PaymentMethod.CARD.value,
        "eft": PaymentMethod.EFT.value,
        "voucher": PaymentMethod.VOUCHER.value,
        "other": PaymentMethod.OTHER.value,
    }
    method = method_map.get(intent, PaymentMethod.CASH.value)
    from datetime import datetime
    payment = Payment(
        payment_number=next_number(db, Payment, "payment_number", "PAY"),
        booking_id=booking.id,
        customer_id=booking.customer_id,
        branch_id=booking.branch_id,
        amount=booking.total_amount or Decimal("0"),
        method=method,
        status=PaymentStatus.PAID.value,
        notes=f"Auto-recorded on wash Done ({intent or 'cash'})",
        received_by_id=user_id,
        paid_at=datetime.utcnow(),
    )
    if payment.amount <= 0:
        return None
    db.add(payment)
    booking.payment_status = PaymentStatus.PAID.value
    inv = ensure_invoice_for_booking(db, booking)
    payment.invoice_id = inv.id
    inv.amount_paid = payment.amount
    inv.status = "PAID"
    audit(
        db,
        action="PAYMENT_AUTO_DONE",
        user_id=user_id,
        username=username,
        entity_type="payment",
        entity_id=None,
        details=f"Auto PAID on Done for {booking.booking_number}",
    )
    activity(
        db,
        action="payment",
        summary=f"Payment recorded on Done for {booking.booking_number}: {payment.amount}",
        user_id=user_id,
        actor_name=username,
        entity_type="booking",
        entity_id=booking.id,
    )
    db.commit()
    db.refresh(payment)
    return payment


def ensure_payment_on_wash_done(
    db: Session,
    booking: Booking,
    user_id: int | None = None,
    username: str | None = None,
) -> Payment | None:
    """Create the right payment row when a wash is marked READY/Done."""
    intent = (booking.payment_method_intent or "cash").strip().lower()
    if intent in ("salary_deduction", "salary"):
        return ensure_salary_pending_for_booking(db, booking, user_id=user_id, username=username)
    return ensure_cash_paid_for_booking(db, booking, user_id=user_id, username=username)


def mark_salary_payments_paid(
    db: Session,
    payment_ids: list[int] | None = None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    employee_number: str | None = None,
    user_id: int | None = None,
    username: str | None = None,
) -> dict:
    """Manager action: mark pending salary rows as deducted / paid."""
    q = db.query(Payment).filter(
        Payment.is_deleted.is_(False),
        Payment.method == PaymentMethod.SALARY_DEDUCTION.value,
        Payment.status == PaymentStatus.PENDING_SALARY.value,
    )
    if payment_ids:
        q = q.filter(Payment.id.in_(payment_ids))
    else:
        if date_from:
            q = q.filter(func.date(Payment.paid_at) >= date_from)
        if date_to:
            q = q.filter(func.date(Payment.paid_at) <= date_to)
        if employee_number:
            q = q.filter(Payment.employee_number == employee_number.strip())
    rows = q.all()
    from datetime import datetime as _dt

    now = _dt.utcnow()
    updated = 0
    for p in rows:
        p.status = PaymentStatus.PAID.value
        p.paid_at = now
        if p.booking_id:
            booking = db.get(Booking, p.booking_id)
            if booking:
                booking.payment_status = PaymentStatus.PAID.value
                inv = ensure_invoice_for_booking(db, booking)
                p.invoice_id = inv.id
                inv.amount_paid = (inv.amount_paid or Decimal("0")) + Decimal(str(p.amount))
                if inv.amount_paid >= inv.total_amount:
                    inv.status = "PAID"
        updated += 1
    audit(
        db,
        action="SALARY_MARK_PAID",
        user_id=user_id,
        username=username,
        entity_type="payment",
        entity_id=None,
        details=f"Marked {updated} salary payments paid",
    )
    db.commit()
    return {"updated": updated, "ids": [p.id for p in rows]}


def mark_salary_exported(db: Session, payment_ids: list[int]) -> int:
    from datetime import datetime as _dt

    now = _dt.utcnow()
    count = 0
    for pid in payment_ids:
        p = db.get(Payment, pid)
        if p and not p.is_deleted and p.method == PaymentMethod.SALARY_DEDUCTION.value:
            p.exported_at = now
            count += 1
    db.commit()
    return count


def payroll_export_rows(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    include_exported: bool = False,
) -> list[dict]:
    """Pending salary_deduction payments in date range for CSV export."""
    q = (
        db.query(Payment)
        .filter(
            Payment.is_deleted.is_(False),
            Payment.method == PaymentMethod.SALARY_DEDUCTION.value,
            Payment.status == PaymentStatus.PENDING_SALARY.value,
            func.date(Payment.paid_at) >= date_from,
            func.date(Payment.paid_at) <= date_to,
        )
        .order_by(Payment.employee_number, Payment.id)
    )
    if not include_exported:
        q = q.filter(Payment.exported_at.is_(None))
    rows = q.all()
    out: list[dict] = []
    for p in rows:
        booking = db.get(Booking, p.booking_id) if p.booking_id else None
        cust = None
        if p.customer_id:
            from app.models import Customer

            cust = db.get(Customer, p.customer_id)
        name = ""
        phone = ""
        if cust:
            name = cust.full_name
            phone = cust.phone or ""
        elif booking and booking.customer:
            name = booking.customer.full_name
            phone = booking.customer_phone or booking.customer.phone or ""
        out.append(
            {
                "payment_id": p.id,
                "employee_number": p.employee_number or "",
                "employee_customer_name": name,
                "phone": phone,
                "ticket_number": (booking.ticket_number if booking else "") or "",
                "booking_number": (booking.booking_number if booking else "") or "",
                "booking_date": booking.scheduled_date.isoformat() if booking and booking.scheduled_date else "",
                "amount": float(p.amount),
                "payment_number": p.payment_number,
                "exported_at": p.exported_at.isoformat() if p.exported_at else "",
            }
        )
    return out
