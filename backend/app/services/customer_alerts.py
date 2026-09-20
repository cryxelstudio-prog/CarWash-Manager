"""Customer-facing “Your car is ready” alerts — in-app + optional email.

Offline-first: Done / READY always succeeds locally; outbound failures are
queued on the Notification row (PENDING/FAILED) and never raise to the caller.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.integrations.outlook import get_notification_service
from app.models import Notification
from app.services.bootstrap import get_setting
from app.utils.vehicles import vehicle_description

log = logging.getLogger("customer_alerts")

DEFAULT_TEMPLATE = (
    "Hi {customer_name},\n\n"
    "Good news — your car is ready for collection.\n\n"
    "Ticket: {ticket}\n"
    "Vehicle: {vehicle}\n"
    "Bay: {bay}\n\n"
    "{custom_message}"
    "Thank you for choosing us.\n"
)


def _truthy(v: str | None, default: bool = True) -> bool:
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def customer_alert_settings(db: Session) -> dict[str, Any]:
    return {
        "email_when_done": _truthy(get_setting(db, "customer.alert.email_when_done"), True),
        "ready_template": (get_setting(db, "customer.alert.ready_template") or DEFAULT_TEMPLATE).strip(),
        "ready_subject": (get_setting(db, "customer.alert.ready_subject") or "Your car is ready").strip(),
    }


def _bay_name(booking) -> str:
    bay = getattr(booking, "wash_bay", None)
    if bay is not None:
        return bay.name or f"Bay {bay.bay_number}"
    return ""


def _resolve_email(booking) -> str:
    email = (getattr(booking, "customer_email", None) or "").strip()
    if email:
        return email
    cust = getattr(booking, "customer", None)
    if cust and getattr(cust, "email", None):
        return (cust.email or "").strip()
    return ""


def _render_body(db: Session, booking, custom_message: str | None) -> tuple[str, str]:
    settings = customer_alert_settings(db)
    ticket = booking.ticket_number or booking.booking_number
    desc = vehicle_description(booking.vehicle) if booking.vehicle else (
        getattr(booking, "vehicle_description", None) or "—"
    )
    name = booking.customer.full_name if booking.customer else (
        getattr(booking, "customer_name", None) or "there"
    )
    bay = _bay_name(booking) or "—"
    custom = (custom_message or "").strip()
    custom_block = f"{custom}\n\n" if custom else ""
    template = settings["ready_template"] or DEFAULT_TEMPLATE
    try:
        body = template.format(
            customer_name=name,
            ticket=ticket,
            vehicle=desc,
            bay=bay,
            custom_message=custom_block,
        )
    except (KeyError, ValueError):
        body = (
            f"Hi {name},\n\nYour car is ready for collection.\n\n"
            f"Ticket: {ticket}\nVehicle: {desc}\nBay: {bay}\n\n"
            f"{custom_block}Thank you.\n"
        )
    subject = f"{settings['ready_subject']} — {ticket}"
    return subject, body


def notify_customer_car_ready(
    db: Session,
    *,
    booking,
    custom_message: str | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    """Create in-app notification and optionally email the car owner.

    Returns a small status dict for the API/UI. Never raises.
    """
    result: dict[str, Any] = {
        "in_app": False,
        "email_attempted": False,
        "email_status": "SKIPPED",
        "email_to": None,
        "message": "Saved",
        "notification_id": None,
    }
    try:
        settings = customer_alert_settings(db)
        ticket = booking.ticket_number or booking.booking_number
        subject, body = _render_body(db, booking, custom_message)
        email = _resolve_email(booking)

        notif = Notification(
            user_id=None,
            title=subject,
            body=body,
            category="CUSTOMER_READY",
            is_read=False,
            link=f"/bookings?id={booking.id}",
            event_type="customer_car_ready",
            booking_id=booking.id,
            outbound_status="SKIPPED",
            outbound_channel=None,
            outbound_error=None,
            meta={
                "ticket": ticket,
                "customer_email": email or None,
                "custom_message": (custom_message or "").strip() or None,
                "bay": _bay_name(booking),
                "audience": "customer",
            },
        )
        db.add(notif)
        db.flush()
        result["in_app"] = True
        result["notification_id"] = notif.id

        if not settings["email_when_done"]:
            notif.outbound_status = "SKIPPED"
            notif.outbound_error = "Customer email-on-done is turned off in settings"
            result["message"] = "Saved — customer email alerts are off"
            result["email_status"] = "SKIPPED"
        elif not email:
            notif.outbound_status = "SKIPPED"
            notif.outbound_error = "No customer email on file"
            result["message"] = "Saved — no customer email on file"
            result["email_status"] = "SKIPPED"
        else:
            result["email_attempted"] = True
            result["email_to"] = email
            notif.outbound_status = "PENDING"
            try:
                svc = get_notification_service(db)
                if not svc.is_configured():
                    notif.outbound_status = "FAILED"
                    notif.outbound_channel = "none"
                    notif.outbound_error = "Email not configured — queued for retry when Outlook/SMTP is set up"
                    result["email_status"] = "FAILED"
                    result["message"] = "Saved — email queued (not configured yet)"
                else:
                    send_result = svc.send("email", email, subject, body)
                    channel = send_result.get("channel") or "email"
                    notif.outbound_channel = channel
                    if send_result.get("ok"):
                        notif.outbound_status = "SENT"
                        notif.outbound_error = None
                        result["email_status"] = "SENT"
                        result["message"] = f"Saved — emailed {email}"
                    else:
                        notif.outbound_status = "FAILED"
                        notif.outbound_error = str(send_result.get("reason") or "send failed")[:500]
                        result["email_status"] = "FAILED"
                        result["message"] = "Saved — email failed (will show in Notifications)"
            except Exception as exc:  # noqa: BLE001
                log.warning("Customer ready email failed: %s", exc)
                notif.outbound_status = "FAILED"
                notif.outbound_channel = notif.outbound_channel or "email"
                notif.outbound_error = str(exc)[:500]
                result["email_status"] = "FAILED"
                result["message"] = "Saved — email failed (queued)"

        try:
            db.commit()
            db.refresh(notif)
        except Exception as exc:  # noqa: BLE001
            log.warning("Failed to commit customer alert: %s", exc)
            try:
                db.rollback()
            except Exception:  # noqa: BLE001
                pass
            # Booking already moved; alert is best-effort
            result["in_app"] = result.get("in_app", False)
        return result
    except Exception as exc:  # noqa: BLE001
        log.warning("notify_customer_car_ready error: %s", exc)
        result["message"] = "Saved — notification skipped"
        return result
