"""Payments, invoices, cash-up."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Invoice, Payment
from app.schemas.entities import CashUpIn, CashUpOut, PaymentIn, PaymentOut
from app.security.deps import AuthContext, CSRFUser, require_permission
from app.services.payments import create_cash_up, ensure_invoice_for_booking, record_payment
from app.services.pdfs import build_invoice_pdf, build_receipt_pdf
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
