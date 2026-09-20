"""Reports and exports."""
from __future__ import annotations

import csv
import io
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Response
from openpyxl import Workbook
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Booking, Expense, Payment, Service
from app.models.models import PaymentStatus, WashStage
from app.security.deps import AuthContext, CSRFUser, require_permission

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/sales")
def sales_report(
    date_from: date | None = None,
    date_to: date | None = None,
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("reports.view")),
):
    date_from = date_from or (date.today() - timedelta(days=30))
    date_to = date_to or date.today()
    q = db.query(Payment).filter(
        Payment.is_deleted.is_(False),
        Payment.status == PaymentStatus.PAID.value,
        func.date(Payment.paid_at) >= date_from,
        func.date(Payment.paid_at) <= date_to,
    )
    if branch_id:
        q = q.filter(Payment.branch_id == branch_id)
    payments = q.all()
    by_method: dict[str, Decimal] = {}
    total = Decimal("0")
    for p in payments:
        by_method[p.method] = by_method.get(p.method, Decimal("0")) + Decimal(str(p.amount))
        total += Decimal(str(p.amount))
    return {
        "date_from": date_from,
        "date_to": date_to,
        "total": total,
        "count": len(payments),
        "by_method": {k: float(v) for k, v in by_method.items()},
        "rows": [
            {
                "payment_number": p.payment_number,
                "amount": float(p.amount),
                "method": p.method,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "booking_id": p.booking_id,
            }
            for p in payments
        ],
    }


@router.get("/operations")
def operations_report(
    date_from: date | None = None,
    date_to: date | None = None,
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("reports.view")),
):
    date_from = date_from or date.today()
    date_to = date_to or date.today()
    q = db.query(Booking).filter(Booking.is_deleted.is_(False), Booking.scheduled_date >= date_from, Booking.scheduled_date <= date_to)
    if branch_id:
        q = q.filter(Booking.branch_id == branch_id)
    bookings = q.all()
    stages: dict[str, int] = {}
    for b in bookings:
        stages[b.wash_stage] = stages.get(b.wash_stage, 0) + 1
    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_bookings": len(bookings),
        "completed": sum(1 for b in bookings if b.wash_stage in (WashStage.READY.value, WashStage.COLLECTED.value)),
        "cancelled": sum(1 for b in bookings if b.wash_stage == WashStage.CANCELLED.value),
        "by_stage": stages,
        "revenue_booked": float(sum((b.total_amount for b in bookings), Decimal("0"))),
    }


@router.get("/expenses")
def expenses_report(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("reports.view", "expenses.manage")),
):
    date_from = date_from or (date.today() - timedelta(days=30))
    date_to = date_to or date.today()
    rows = (
        db.query(Expense)
        .filter(Expense.is_deleted.is_(False), Expense.expense_date >= date_from, Expense.expense_date <= date_to)
        .order_by(Expense.expense_date.desc())
        .all()
    )
    total = sum((Decimal(str(e.amount)) for e in rows), Decimal("0"))
    by_cat: dict[str, Decimal] = {}
    for e in rows:
        by_cat[e.category] = by_cat.get(e.category, Decimal("0")) + Decimal(str(e.amount))
    return {
        "total": float(total),
        "by_category": {k: float(v) for k, v in by_cat.items()},
        "rows": [
            {"expense_number": e.expense_number, "description": e.description, "category": e.category, "amount": float(e.amount), "date": e.expense_date.isoformat()}
            for e in rows
        ],
    }


@router.get("/export.csv")
def export_csv(
    report: str = "sales",
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("reports.export")),
):
    if report == "sales":
        data = sales_report(date_from, date_to, None, db, ctx)
        rows = data["rows"]
        fieldnames = ["payment_number", "amount", "method", "paid_at", "booking_id"]
    elif report == "expenses":
        data = expenses_report(date_from, date_to, db, ctx)
        rows = data["rows"]
        fieldnames = ["expense_number", "description", "category", "amount", "date"]
    else:
        data = operations_report(date_from, date_to, None, db, ctx)
        rows = [{"stage": k, "count": v} for k, v in data["by_stage"].items()]
        fieldnames = ["stage", "count"]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    return Response(content=buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={report}.csv"})


@router.get("/export.xlsx")
def export_xlsx(
    report: str = "sales",
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("reports.export")),
):
    if report == "sales":
        data = sales_report(date_from, date_to, None, db, ctx)
        rows = data["rows"]
    elif report == "expenses":
        data = expenses_report(date_from, date_to, db, ctx)
        rows = data["rows"]
    else:
        data = operations_report(date_from, date_to, None, db, ctx)
        rows = [{"stage": k, "count": v} for k, v in data["by_stage"].items()]
    wb = Workbook()
    ws = wb.active
    ws.title = report
    if rows:
        headers = list(rows[0].keys())
        ws.append(headers)
        for r in rows:
            ws.append([r.get(h) for h in headers])
    out = io.BytesIO()
    wb.save(out)
    return Response(
        content=out.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={report}.xlsx"},
    )
