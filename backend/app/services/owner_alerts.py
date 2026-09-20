"""Owner notification engine — in-app first, outbound Outlook optional.

Offline-first: booking/stage always succeeds; outbound failures are logged
on the Notification row (PENDING/FAILED) and shown in Notifications.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.integrations.outlook import get_calendar_service, get_notification_service, outlook_config
from app.models import Notification
from app.services.bootstrap import get_setting
from app.utils.vehicles import vehicle_description

log = logging.getLogger("owner_alerts")

# event_type -> setting key + default title
EVENT_TOGGLES = {
    "car_ready": ("owner.alert.car_ready", "Car ready for collection"),
    "car_completed": ("owner.alert.car_completed", "Car completed / collected"),
    "booking_created": ("owner.alert.booking_created", "New booking created"),
    "cancelled": ("owner.alert.cancelled", "Booking cancelled"),
    "no_show": ("owner.alert.no_show", "Customer no-show"),
}


def _truthy(v: str | None, default: bool = True) -> bool:
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def owner_alert_settings(db: Session) -> dict[str, Any]:
    return {
        "owner_name": (get_setting(db, "owner.name") or "").strip(),
        "owner_email": (get_setting(db, "owner.email") or get_setting(db, "outlook.owner_mailbox") or "").strip(),
        "alert_car_ready": _truthy(get_setting(db, "owner.alert.car_ready"), True),
        "alert_car_completed": _truthy(get_setting(db, "owner.alert.car_completed"), True),
        "alert_booking_created": _truthy(get_setting(db, "owner.alert.booking_created"), False),
        "alert_cancelled": _truthy(get_setting(db, "owner.alert.cancelled"), True),
        "alert_no_show": _truthy(get_setting(db, "owner.alert.no_show"), True),
        "email_when_ready": _truthy(get_setting(db, "owner.alert.email_when_ready"), True),
    }


def _bay_name(booking) -> str:
    bay = getattr(booking, "wash_bay", None)
    if bay is not None:
        return bay.name or f"Bay {bay.bay_number}"
    return ""


def _booking_body(booking) -> str:
    desc = vehicle_description(booking.vehicle) if booking.vehicle else (getattr(booking, "vehicle_description", None) or "—")
    name = booking.customer.full_name if booking.customer else (getattr(booking, "customer_name", None) or "—")
    phone = booking.customer_phone or (booking.customer.phone if booking.customer else "") or "—"
    ticket = booking.ticket_number or booking.booking_number
    bay = _bay_name(booking) or "—"
    when = f"{booking.scheduled_date} {booking.scheduled_time or ''}".strip()
    lines = [
        f"Ticket: {ticket}",
        f"Customer: {name}",
        f"Phone: {phone}",
        f"Vehicle: {desc}",
        f"Bay: {bay}",
        f"Time: {when}",
        f"Stage: {booking.wash_stage}",
    ]
    return "\n".join(lines)


def _toggle_enabled(db: Session, event_type: str) -> bool:
    key, _ = EVENT_TOGGLES[event_type]
    defaults = {
        "car_ready": True,
        "car_completed": True,
        "booking_created": False,
        "cancelled": True,
        "no_show": True,
    }
    return _truthy(get_setting(db, key), defaults.get(event_type, True))


def create_owner_alert(
    db: Session,
    *,
    booking,
    event_type: str,
    user_id: int | None = None,
) -> Notification | None:
    """Create in-app notification and attempt outbound email. Never raises."""
    if event_type not in EVENT_TOGGLES:
        return None
    if not _toggle_enabled(db, event_type):
        return None

    _, default_title = EVENT_TOGGLES[event_type]
    ticket = booking.ticket_number or booking.booking_number
    title = f"{default_title} — {ticket}"
    body = _booking_body(booking)
    settings = owner_alert_settings(db)
    owner_email = settings["owner_email"]

    # Email path only if owner wants email-when-ready style alerts for ready/complete,
    # or always attempt when any outbound channel is configured and toggle is on.
    want_email = True
    if event_type in ("car_ready", "car_completed") and not settings.get("email_when_ready", True):
        want_email = False

    notif = Notification(
        user_id=None,  # broadcast to owners/managers who can view notifications
        title=title,
        body=body,
        category=event_type.upper(),
        is_read=False,
        link=f"/bookings?id={booking.id}",
        event_type=event_type,
        booking_id=booking.id,
        outbound_status="SKIPPED",
        outbound_channel=None,
        outbound_error=None,
        meta={
            "ticket": ticket,
            "customer_name": booking.customer.full_name if booking.customer else None,
            "customer_phone": booking.customer_phone,
            "vehicle_description": vehicle_description(booking.vehicle) if booking.vehicle else None,
            "bay": _bay_name(booking),
            "scheduled": f"{booking.scheduled_date} {booking.scheduled_time or ''}".strip(),
        },
    )
    db.add(notif)
    db.flush()

    if want_email and owner_email:
        notif.outbound_status = "PENDING"
        try:
            svc = get_notification_service(db)
            if not svc.is_configured():
                notif.outbound_status = "SKIPPED"
                notif.outbound_channel = "none"
                notif.outbound_error = "Outlook / email not configured — in-app alert only"
            else:
                result = svc.send("email", owner_email, title, body)
                channel = result.get("channel") or "email"
                notif.outbound_channel = channel
                if result.get("ok"):
                    notif.outbound_status = "SENT"
                    notif.outbound_error = None
                else:
                    notif.outbound_status = "FAILED"
                    notif.outbound_error = str(result.get("reason") or "send failed")[:500]
        except Exception as exc:  # noqa: BLE001
            log.warning("Outbound owner alert failed: %s", exc)
            notif.outbound_status = "FAILED"
            notif.outbound_channel = notif.outbound_channel or "email"
            notif.outbound_error = str(exc)[:500]
    elif want_email and not owner_email:
        notif.outbound_status = "SKIPPED"
        notif.outbound_error = "No owner email set — in-app alert only"

    try:
        db.commit()
        db.refresh(notif)
    except Exception as exc:  # noqa: BLE001
        log.warning("Failed to commit owner alert: %s", exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
        return None
    return notif


def maybe_alert_for_stage(db: Session, booking, to_stage: str, user_id: int | None = None) -> None:
    stage = (to_stage or "").upper()
    mapping = {
        "READY": "car_ready",
        "COLLECTED": "car_completed",
        "CANCELLED": "cancelled",
        "NO_SHOW": "no_show",
    }
    event = mapping.get(stage)
    if event:
        create_owner_alert(db, booking=booking, event_type=event, user_id=user_id)


def maybe_alert_booking_created(db: Session, booking, user_id: int | None = None) -> None:
    create_owner_alert(db, booking=booking, event_type="booking_created", user_id=user_id)
    # Optional best-effort Outlook calendar sync
    try:
        sync_booking_to_outlook(db, booking)
    except Exception as exc:  # noqa: BLE001
        log.warning("Outlook calendar sync skipped: %s", exc)


def sync_booking_to_outlook(db: Session, booking) -> dict[str, Any]:
    """Best-effort Graph calendar event. Local booking always remains source of truth."""
    cfg = outlook_config(db)
    if not cfg.get("sync_calendar"):
        return {"ok": False, "reason": "sync_disabled"}
    cal = get_calendar_service(db)
    if not cal.is_configured():
        return {"ok": False, "reason": "not_configured"}

    ticket = booking.ticket_number or booking.booking_number
    desc = vehicle_description(booking.vehicle) if booking.vehicle else ""
    name = booking.customer.full_name if booking.customer else ""
    subject = f"Wash {ticket} — {desc or name}".strip(" —")
    start_date = booking.scheduled_date
    t = booking.scheduled_time
    duration = booking.duration_minutes or 30
    if t is None:
        start_dt = datetime.combine(start_date, datetime.min.time().replace(hour=9))
    else:
        start_dt = datetime.combine(start_date, t)
    end_dt = start_dt + timedelta(minutes=duration)
    event = {
        "subject": subject,
        "body": {"contentType": "Text", "content": _booking_body(booking)},
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "Africa/Johannesburg"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "Africa/Johannesburg"},
    }
    return cal.sync_booking(booking.id, event)
