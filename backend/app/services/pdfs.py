"""PDF receipt / invoice generation with reportlab."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from app.models import Invoice, Payment
from app.services.bootstrap import get_setting
from app.services.payments import ensure_invoice_for_booking
from app.models import Booking


def build_receipt_pdf(db: Session, payment_id: int) -> bytes:
    payment = db.get(Payment, payment_id)
    if not payment:
        raise ValueError("Payment not found")
    company = get_setting(db, "company.name", "Car Wash") or "Car Wash"
    footer = get_setting(db, "app.receipt_footer", "Thank you!") or "Thank you!"
    symbol = get_setting(db, "locale.currency_symbol", "R") or "R"

    booking = db.get(Booking, payment.booking_id) if payment.booking_id else None
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(f"<b>{company}</b>", styles["Title"]))
    story.append(Paragraph("RECEIPT", styles["Heading2"]))
    story.append(Spacer(1, 8))
    meta = [
        ["Receipt No:", payment.payment_number],
        ["Date:", payment.paid_at.strftime("%d/%m/%Y %H:%M") if payment.paid_at else ""],
        ["Method:", payment.method],
        ["Reference:", payment.reference or "-"],
    ]
    if booking:
        meta.extend(
            [
                ["Booking:", booking.booking_number],
                ["Customer:", booking.customer.full_name if booking.customer else ""],
                ["Vehicle:", booking.vehicle.registration if booking.vehicle else ""],
                ["Service:", booking.service.name if booking.service else (booking.package.name if booking.package else "")],
            ]
        )
    t = Table(meta, colWidths=[40 * mm, 120 * mm])
    t.setStyle(TableStyle([("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 10)]))
    story.append(t)
    story.append(Spacer(1, 12))
    amounts = [
        ["Subtotal", f"{symbol} {booking.subtotal if booking else payment.amount}"],
        ["Tax", f"{symbol} {booking.tax_amount if booking else 0}"],
        ["Total Paid", f"{symbol} {payment.amount}"],
    ]
    at = Table(amounts, colWidths=[100 * mm, 60 * mm])
    at.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, -1), (-1, -1), colors.Color(0.9, 0.95, 1)),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
            ]
        )
    )
    story.append(at)
    story.append(Spacer(1, 20))
    story.append(Paragraph(footer, styles["Normal"]))
    doc.build(story)
    return buffer.getvalue()


def build_invoice_pdf(db: Session, invoice_id: int) -> bytes:
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise ValueError("Invoice not found")
    company = get_setting(db, "company.name", "Car Wash") or "Car Wash"
    symbol = get_setting(db, "locale.currency_symbol", "R") or "R"
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"<b>{company}</b>", styles["Title"]),
        Paragraph(f"INVOICE {inv.invoice_number}", styles["Heading2"]),
        Spacer(1, 8),
        Paragraph(f"Customer ID: {inv.customer_id}", styles["Normal"]),
        Paragraph(f"Date: {inv.invoice_date.strftime('%d/%m/%Y')}", styles["Normal"]),
        Spacer(1, 12),
    ]
    rows = [["Description", "Qty", "Unit", "Total"]]
    for item in inv.items:
        rows.append([item.description, str(item.quantity), f"{symbol} {item.unit_price}", f"{symbol} {item.line_total}"])
    rows.append(["", "", "Subtotal", f"{symbol} {inv.subtotal}"])
    rows.append(["", "", "Tax", f"{symbol} {inv.tax_amount}"])
    rows.append(["", "", "Total", f"{symbol} {inv.total_amount}"])
    table = Table(rows, colWidths=[90 * mm, 20 * mm, 35 * mm, 35 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.15, 0.35, 0.55)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return buffer.getvalue()
