"""Payments, invoices, cash-up."""
from __future__ import annotations

from datetime import date
import csv
import io

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Invoice, Payment
from app.schemas.entities import CashUpIn, CashUpOut, PaymentIn, PaymentOut
from app.security.deps import AuthContext, CSRFUser, require_permission
from app.services.payments import (
    create_cash_up,
    ensure_invoice_for_booking,
    mark_salary_exported,
    mark_salary_payments_paid,
    payroll_export_rows,
    record_payment,
)
from app.services.pdfs import build_invoice_pdf, build_receipt_pdf
from app.services.payment_intent import outstanding_salary_for_customer, outstanding_salary_for_employee
from app.models import Booking

router = APIRouter(tags=["payments"])


@router.get("/payments")
def list_payments(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("payments.view", "payments.manage"))):
    rows = db.query(Payment).filter(Payment.is_deleted.is_(False)).order_by(Payment.paid_at.desc()).limit(200).all()
    return {"items": [PaymentOut.model_validate(p) for p in rows], "total": len(rows)}


@router.post("/payments", status_code=201)
def create_payment(payload: PaymentIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("payments.manage"))):
    try:
        p = record_payment(db, payload, user_id=ctx.user.id, username=ctx.user.username)
    except ValueError as e:
        bad_request(str(e))
    return PaymentOut.model_validate(p)


class SalaryMarkIn(BaseModel):
    payment_ids: list[int] | None = None
    date_from: date | None = None
    date_to: date | None = None
    employee_number: str | None = None


class SalaryExportMarkIn(BaseModel):
    payment_ids: list[int]


@router.get("/payments/payroll-export.csv")
def payroll_export_csv(
    date_from: date | None = None,
    date_to: date | None = None,
    include_exported: bool = False,
    mark_exported: bool = False,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("payments.view", "payments.manage", "reports.view")),
):
    """Monthly payroll CSV — salary_deduction pending rows (default current month)."""
    today = date.today()
    if not date_from:
        date_from = today.replace(day=1)
    if not date_to:
        date_to = today
    rows = payroll_export_rows(db, date_from=date_from, date_to=date_to, include_exported=include_exported)
    # Aggregate by employee for total column while keeping ticket detail rows
    by_emp: dict[str, float] = {}
    for r in rows:
        key = r["employee_number"] or ""
        by_emp[key] = by_emp.get(key, 0.0) + float(r["amount"])

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "employee_number",
        "employee_customer_name",
        "phone",
        "ticket_numbers",
        "booking_dates",
        "amounts",
        "total",
        "payment_numbers",
    ])
    # Group detail into one row per employee for payroll friendliness
    grouped: dict[str, dict] = {}
    for r in rows:
        key = r["employee_number"] or ""
        g = grouped.setdefault(
            key,
            {
                "employee_number": key,
                "employee_customer_name": r["employee_customer_name"],
                "phone": r["phone"],
                "tickets": [],
                "dates": [],
                "amounts": [],
                "payments": [],
                "ids": [],
            },
        )
        if r["ticket_number"]:
            g["tickets"].append(r["ticket_number"])
        if r["booking_date"]:
            g["dates"].append(r["booking_date"])
        g["amounts"].append(f"{r['amount']:.2f}")
        g["payments"].append(r["payment_number"])
        g["ids"].append(r["payment_id"])
        if not g["employee_customer_name"] and r["employee_customer_name"]:
            g["employee_customer_name"] = r["employee_customer_name"]
        if not g["phone"] and r["phone"]:
            g["phone"] = r["phone"]
    for g in grouped.values():
        total = sum(float(a) for a in g["amounts"]) if g["amounts"] else 0.0
        writer.writerow([
            g["employee_number"],
            g["employee_customer_name"],
            g["phone"],
            ";".join(g["tickets"]),
            ";".join(g["dates"]),
            ";".join(g["amounts"]),
            f"{total:.2f}",
            ";".join(g["payments"]),
        ])
    if mark_exported:
        ids = [r["payment_id"] for r in rows]
        mark_salary_exported(db, ids)
    content = buf.getvalue()
    filename = f"payroll-{date_from.isoformat()}-{date_to.isoformat()}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/payments/salary-ledger")
def salary_ledger(
    employee_number: str | None = None,
    customer_id: int | None = None,
    pending_only: bool = True,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("payments.view", "payments.manage")),
):
    from app.models.models import PaymentMethod, PaymentStatus

    q = db.query(Payment).filter(
        Payment.is_deleted.is_(False),
        Payment.method == PaymentMethod.SALARY_DEDUCTION.value,
    )
    if pending_only:
        q = q.filter(Payment.status == PaymentStatus.PENDING_SALARY.value)
    if employee_number:
        q = q.filter(Payment.employee_number == employee_number.strip())
    if customer_id:
        q = q.filter(Payment.customer_id == customer_id)
    rows = q.order_by(Payment.paid_at.desc()).limit(500).all()
    outstanding = 0.0
    if employee_number:
        outstanding = float(outstanding_salary_for_employee(db, employee_number))
    elif customer_id:
        outstanding = float(outstanding_salary_for_customer(db, customer_id))
    return {
        "items": [PaymentOut.model_validate(p) for p in rows],
        "total": len(rows),
        "outstanding": outstanding,
    }


@router.post("/payments/salary/mark-paid")
def salary_mark_paid(
    payload: SalaryMarkIn,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("payments.manage")),
):
    result = mark_salary_payments_paid(
        db,
        payment_ids=payload.payment_ids,
        date_from=payload.date_from,
        date_to=payload.date_to,
        employee_number=payload.employee_number,
        user_id=ctx.user.id,
        username=ctx.user.username,
    )
    return result


@router.post("/payments/salary/mark-exported")
def salary_mark_exported(
    payload: SalaryExportMarkIn,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("payments.manage")),
):
    n = mark_salary_exported(db, payload.payment_ids)
    return {"exported": n}


@router.get("/payments/{payment_id}/receipt.pdf")
def receipt_pdf(payment_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("payments.view", "payments.manage", "invoices.manage"))):
    try:
        pdf = build_receipt_pdf(db, payment_id)
    except ValueError:
        not_found()
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=receipt-{payment_id}.pdf"})


@router.post("/bookings/{booking_id}/invoice", status_code=201)
def create_invoice(booking_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("invoices.manage"))):
    b = db.get(Booking, booking_id)
    if not b or b.is_deleted:
        not_found()
    inv = ensure_invoice_for_booking(db, b)
    db.commit()
    return {"id": inv.id, "invoice_number": inv.invoice_number, "total_amount": inv.total_amount, "status": inv.status}


@router.get("/invoices")
def list_invoices(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("invoices.manage", "payments.view"))):
    rows = db.query(Invoice).filter(Invoice.is_deleted.is_(False)).order_by(Invoice.invoice_date.desc()).limit(200).all()
    return {
        "items": [
            {
                "id": i.id,
                "invoice_number": i.invoice_number,
                "customer_id": i.customer_id,
                "booking_id": i.booking_id,
                "invoice_date": i.invoice_date,
                "total_amount": i.total_amount,
                "amount_paid": i.amount_paid,
                "status": i.status,
            }
            for i in rows
        ],
        "total": len(rows),
    }


@router.get("/invoices/{invoice_id}/pdf")
def invoice_pdf(invoice_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("invoices.manage", "payments.view"))):
    try:
        pdf = build_invoice_pdf(db, invoice_id)
    except ValueError:
        not_found()
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=invoice-{invoice_id}.pdf"})


@router.post("/cash-ups", status_code=201)
def cash_up(payload: CashUpIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("cashup.manage"))):
    cu = create_cash_up(db, payload, user_id=ctx.user.id)
    return CashUpOut.model_validate(cu)


@router.get("/cash-ups")
def list_cash_ups(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("cashup.manage"))):
    from app.models import CashUp
    rows = db.query(CashUp).order_by(CashUp.cash_up_date.desc()).limit(50).all()
    return {"items": [CashUpOut.model_validate(r) for r in rows], "total": len(rows)}

