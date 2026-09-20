"""Dashboard KPI aggregation."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models import (
    Activity,
    Attendance,
    Booking,
    Customer,
    Integration,
    InventoryItem,
    Payment,
)
from app.models.models import BookingStatus, PaymentMethod, PaymentStatus, WashStage
from app.services.bays import bay_board


def get_dashboard(db: Session, branch_id: int | None = None) -> dict:
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def bq():
        q = db.query(Booking).filter(Booking.is_deleted.is_(False))
        if branch_id:
            q = q.filter(Booking.branch_id == branch_id)
        return q

    today_bookings = bq().filter(Booking.scheduled_date == today).count()
    stage_rows = (
        bq()
        .filter(Booking.scheduled_date == today)
        .with_entities(Booking.wash_stage, func.count())
        .group_by(Booking.wash_stage)
        .all()
    )
    stage_counts = {s: c for s, c in stage_rows}

    washing_stages = {
        WashStage.PRE_WASH.value,
        WashStage.WASHING.value,
        WashStage.INTERIOR.value,
        WashStage.DETAILING.value,
        WashStage.QUALITY_CHECK.value,
    }

    def pay_sum(start: date, end: date | None = None, method: str | None = None) -> Decimal:
        # Count PAID (use paid_at) and PENDING_SALARY (use created_at) so Done totals show
        from sqlalchemy import or_
        q = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.is_deleted.is_(False),
            Payment.status.in_([PaymentStatus.PAID.value, PaymentStatus.PENDING_SALARY.value]),
        )
        # Date filter: paid_at for PAID, created_at for pending salary
        date_clause = or_(
            and_(Payment.status == PaymentStatus.PAID.value, func.date(Payment.paid_at) >= start),
            and_(Payment.status == PaymentStatus.PENDING_SALARY.value, func.date(Payment.created_at) >= start),
        )
        q = q.filter(date_clause)
        if end:
            q = q.filter(
                or_(
                    and_(Payment.status == PaymentStatus.PAID.value, func.date(Payment.paid_at) <= end),
                    and_(Payment.status == PaymentStatus.PENDING_SALARY.value, func.date(Payment.created_at) <= end),
                )
            )
        if method:
            q = q.filter(Payment.method == method)
        if branch_id:
            q = q.filter(Payment.branch_id == branch_id)
        return Decimal(str(q.scalar() or 0))

    outstanding = (
        bq()
        .filter(
            Booking.scheduled_date >= month_start,
            Booking.payment_status.in_([PaymentStatus.PENDING.value, PaymentStatus.PARTIAL.value]),
            Booking.status != BookingStatus.CANCELLED.value,
        )
        .with_entities(func.coalesce(func.sum(Booking.total_amount), 0))
        .scalar()
    )

    completed = bq().filter(Booking.scheduled_date == today, Booking.wash_stage.in_([WashStage.READY.value, WashStage.COLLECTED.value])).count()
    washed = bq().filter(Booking.scheduled_date == today, Booking.wash_stage == WashStage.COLLECTED.value).count()

    # avg wash time
    done = (
        bq()
        .filter(Booking.started_at.isnot(None), Booking.completed_at.isnot(None), Booking.scheduled_date == today)
        .all()
    )
    avg_wash = None
    if done:
        mins = [(b.completed_at - b.started_at).total_seconds() / 60 for b in done]
        avg_wash = round(sum(mins) / len(mins), 1)

    waited = (
        bq()
        .filter(Booking.arrived_at.isnot(None), Booking.started_at.isnot(None), Booking.scheduled_date == today)
        .all()
    )
    avg_wait = None
    if waited:
        mins = [(b.started_at - b.arrived_at).total_seconds() / 60 for b in waited]
        avg_wait = round(sum(mins) / len(mins), 1)

    customers_total = db.query(Customer).filter(Customer.is_deleted.is_(False)).count()
    customers_new = db.query(Customer).filter(Customer.is_deleted.is_(False), func.date(Customer.created_at) == today).count()

    attendance_today = db.query(Attendance).filter(Attendance.work_date == today, Attendance.clock_out.is_(None)).count()
    low_stock = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.is_deleted.is_(False),
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_level,
        )
        .count()
    )

    upcoming = (
        bq()
        .filter(Booking.scheduled_date >= today, Booking.status.in_([BookingStatus.CONFIRMED.value, BookingStatus.PENDING.value]))
        .order_by(Booking.scheduled_date, Booking.scheduled_time)
        .limit(8)
        .all()
    )
    upcoming_list = [
        {
            "id": b.id,
            "booking_number": b.booking_number,
            "customer": b.customer.full_name if b.customer else "",
            "time": b.scheduled_time.strftime("%H:%M") if b.scheduled_time else "",
            "date": b.scheduled_date.isoformat(),
            "stage": b.wash_stage,
        }
        for b in upcoming
    ]

    recent = db.query(Activity).order_by(Activity.created_at.desc()).limit(10).all()
    recent_list = [
        {"id": a.id, "summary": a.summary, "action": a.action, "created_at": a.created_at.isoformat() if a.created_at else None}
        for a in recent
    ]


    sales_completed_today = (
        bq()
        .filter(
            Booking.completed_at.isnot(None),
            func.date(Booking.completed_at) == today,
            Booking.status != BookingStatus.CANCELLED.value,
        )
        .with_entities(func.coalesce(func.sum(Booking.total_amount), 0))
        .scalar()
    )
    sales_completed_today = Decimal(str(sales_completed_today or 0))

    # revenue last 7 days
    revenue_by_day = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        revenue_by_day.append({"date": d.isoformat(), "amount": float(pay_sum(d, d))})

    integrations = db.query(Integration).all()
    integ_ok = sum(1 for i in integrations if i.status in ("CONNECTED", "CONFIGURED"))

    return {
        "today_bookings": today_bookings,
        "waiting": stage_counts.get(WashStage.WAITING.value, 0) + stage_counts.get(WashStage.ARRIVED.value, 0) + stage_counts.get(WashStage.CHECK_IN.value, 0),
        "washing": sum(stage_counts.get(s, 0) for s in washing_stages),
        "completed": completed,
        "ready_for_collection": stage_counts.get(WashStage.READY.value, 0),
        "cancelled": stage_counts.get(WashStage.CANCELLED.value, 0),
        "no_shows": stage_counts.get(WashStage.NO_SHOW.value, 0),
        "revenue_today": pay_sum(today, today),
        "sales_completed_today": float(sales_completed_today),
        "revenue_week": pay_sum(week_start, today),
        "revenue_month": pay_sum(month_start, today),
        "cash_today": pay_sum(today, today, PaymentMethod.CASH.value),
        "card_today": pay_sum(today, today, PaymentMethod.CARD.value),
        "outstanding": Decimal(str(outstanding or 0)),
        "vehicles_washed": washed,
        "avg_wash_minutes": avg_wash,
        "avg_wait_minutes": avg_wait,
        "customers_total": customers_total,
        "customers_new_today": customers_new,
        "returning_customers_today": max(today_bookings - customers_new, 0),
        "employees_working": attendance_today,
        "attendance_today": attendance_today,
        "low_stock_count": low_stock,
        "upcoming_bookings": upcoming_list,
        "recent_activity": recent_list,
        "stage_counts": stage_counts,
        "revenue_by_day": revenue_by_day,
        "system_health": "ok",
        "integrations_ok": integ_ok,
        "integrations_total": len(integrations),
        "queue_length": (
            stage_counts.get(WashStage.WAITING.value, 0)
            + stage_counts.get(WashStage.ARRIVED.value, 0)
            + stage_counts.get(WashStage.CHECK_IN.value, 0)
            + stage_counts.get(WashStage.BOOKED.value, 0)
        ),
        "bays": bay_board(db, branch_id=branch_id).get("items", []),
    }
