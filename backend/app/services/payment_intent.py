"""v0.7.0 — booking payment intent validation (cash / salary deduction / more).

Anyone (including walk-ins) may choose salary_deduction if they enter an
employee number. No staff-role gate.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    INTENT_TO_PAYMENT_METHOD,
    PAYMENT_METHOD_INTENTS,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from app.services.bootstrap import get_setting


def normalize_intent(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = str(raw).strip().lower().replace(" ", "_").replace("-", "_")
    if not value:
        return None
    aliases = {
        "salary": "salary_deduction",
        "payroll": "salary_deduction",
        "deduction": "salary_deduction",
        "pay_at_wash": "cash",
        "pay_at_bay": "cash",
    }
    value = aliases.get(value, value)
    if value not in PAYMENT_METHOD_INTENTS:
        raise ValueError(
            f"Invalid payment method. Choose one of: {', '.join(PAYMENT_METHOD_INTENTS)}"
        )
    return value


def validate_payment_intent(
    db: Session,
    *,
    payment_method_intent: str | None,
    employee_number: str | None = None,
    employee_department: str | None = None,
    require_intent: bool = False,
) -> tuple[str | None, str | None, str | None]:
    """Validate and normalize intent + employee fields.

    Rules:
    - salary_deduction requires a non-empty employee_number (anyone / walk-ins OK)
    - cash does not require employee_number
    - optional soft monthly-cap warning is returned separately by callers
    """
    intent = normalize_intent(payment_method_intent)
    emp_no = (employee_number or "").strip() or None
    dept = (employee_department or "").strip() or None

    allow = (get_setting(db, "payments.allow_salary_deduction", "true") or "true").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )

    if require_intent and not intent:
        raise ValueError("How will you pay? Choose Cash or Salary deduction.")

    if intent == "salary_deduction":
        if not allow:
            raise ValueError("Salary deduction bookings are disabled in Settings.")
        if not emp_no:
            raise ValueError(
                "Employee number is required for salary deduction "
                "(anyone can use it — enter the payroll employee number)."
            )

    return intent, emp_no, dept


def intent_to_method(intent: str | None) -> str | None:
    if not intent:
        return None
    return INTENT_TO_PAYMENT_METHOD.get(intent)


def outstanding_salary_for_employee(db: Session, employee_number: str) -> Decimal:
    emp = (employee_number or "").strip()
    if not emp:
        return Decimal("0")
    total = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(
            Payment.is_deleted.is_(False),
            Payment.method == PaymentMethod.SALARY_DEDUCTION.value,
            Payment.status == PaymentStatus.PENDING_SALARY.value,
            Payment.employee_number == emp,
        )
        .scalar()
    )
    return Decimal(str(total or 0))


def outstanding_salary_for_customer(db: Session, customer_id: int) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(
            Payment.is_deleted.is_(False),
            Payment.method == PaymentMethod.SALARY_DEDUCTION.value,
            Payment.status == PaymentStatus.PENDING_SALARY.value,
            Payment.customer_id == customer_id,
        )
        .scalar()
    )
    return Decimal(str(total or 0))


def salary_cap_warning(db: Session, employee_number: str | None, extra: Decimal = Decimal("0")) -> str | None:
    """Soft warning if outstanding (+ optional new amount) exceeds monthly cap."""
    if not employee_number:
        return None
    raw = get_setting(db, "payments.salary_monthly_cap", "") or ""
    raw = str(raw).strip()
    if not raw:
        return None
    try:
        cap = Decimal(raw)
    except Exception:  # noqa: BLE001
        return None
    if cap <= 0:
        return None
    outstanding = outstanding_salary_for_employee(db, employee_number) + extra
    if outstanding > cap:
        return (
            f"Salary deduction outstanding R{outstanding:.2f} exceeds monthly cap "
            f"R{cap:.2f} for employee {employee_number}."
        )
    return None


def payment_intent_label(intent: str | None) -> str:
    if intent == "salary_deduction":
        return "Salary deduction – billed at month end"
    if intent == "cash":
        return "Cash – pay at bay"
    if intent == "card":
        return "Card"
    if intent == "eft":
        return "EFT"
    if intent == "account":
        return "Account"
    if intent == "other":
        return "Other"
    return intent or ""


def pay_badge(intent: str | None) -> str | None:
    if intent == "salary_deduction":
        return "SALARY"
    if intent == "cash":
        return "CASH"
    if intent == "card":
        return "CARD"
    if intent == "eft":
        return "EFT"
    if intent == "account":
        return "ACCOUNT"
    return None
