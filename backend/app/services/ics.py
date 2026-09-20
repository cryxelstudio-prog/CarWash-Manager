"""ICS (.ics) calendar export — always available without Outlook config."""
from __future__ import annotations

from datetime import datetime, timedelta


def _fmt(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%S")


def booking_to_ics(booking, *, prod_id: str = "-//Cryxel Studio//Car Wash Manager//EN") -> str:
    ticket = booking.ticket_number or booking.booking_number or f"B{booking.id}"
    veh = ""
    if booking.vehicle:
        parts = [booking.vehicle.colour, booking.vehicle.make, booking.vehicle.model]
        veh = " ".join(p for p in parts if p).strip()
    name = booking.customer.full_name if booking.customer else ""
    summary = f"Wash {ticket}" + (f" — {veh}" if veh else "")
    desc_lines = [
        f"Ticket: {ticket}",
        f"Customer: {name}",
        f"Phone: {booking.customer_phone or ''}",
        f"Vehicle: {veh}",
        f"Stage: {booking.wash_stage}",
        f"Service: {(booking.service.name if booking.service else '') or (booking.package.name if booking.package else '')}",
    ]
    description = "\\n".join(desc_lines)
    start_date = booking.scheduled_date
    t = booking.scheduled_time
    duration = booking.duration_minutes or 30
    if t is None:
        start_dt = datetime.combine(start_date, datetime.min.time().replace(hour=9, minute=0))
    else:
        start_dt = datetime.combine(start_date, t)
    end_dt = start_dt + timedelta(minutes=duration)
    uid = f"carwash-booking-{booking.id}@local"
    stamp = _fmt(datetime.utcnow())
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{prod_id}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{stamp}Z",
        f"DTSTART:{_fmt(start_dt)}",
        f"DTEND:{_fmt(end_dt)}",
        f"SUMMARY:{_escape(summary)}",
        f"DESCRIPTION:{_escape(description)}",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ]
    return "\r\n".join(lines)


def _escape(text: str) -> str:
    return (
        (text or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )
