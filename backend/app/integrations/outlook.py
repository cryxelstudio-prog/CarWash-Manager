"""Outlook / Microsoft 365 notification + calendar adapters (optional).

Local calendar remains authoritative. Outlook is best-effort only.
Never raises into booking/stage flows — callers treat failures as logged.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.integrations.base import (
    IMicrosoftCalendarService,
    INotificationService,
    NullMicrosoftCalendar,
    NullNotification,
)
from app.services.bootstrap import get_setting

log = logging.getLogger("outlook")

GRAPH_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_SEND_MAIL = "https://graph.microsoft.com/v1.0/users/{mailbox}/sendMail"
GRAPH_EVENTS = "https://graph.microsoft.com/v1.0/users/{mailbox}/events"


def _truthy(v: str | None) -> bool:
    return (v or "").strip().lower() in ("1", "true", "yes", "on")


def outlook_mode(db: Session) -> str:
    """disabled | graph | smtp"""
    raw = (get_setting(db, "outlook.mode") or "disabled").strip().lower()
    if raw in ("graph", "microsoft", "m365", "microsoft_365"):
        return "graph"
    if raw in ("smtp", "email", "simple"):
        return "smtp"
    return "disabled"


def outlook_config(db: Session) -> dict[str, Any]:
    mode = outlook_mode(db)
    sync = _truthy(get_setting(db, "outlook.sync_calendar"))
    connect = _truthy(get_setting(db, "outlook.connect_calendar"))
    return {
        "mode": mode,
        "connect_calendar": connect,
        "sync_calendar": sync and connect,
        "owner_mailbox": (get_setting(db, "outlook.owner_mailbox") or get_setting(db, "owner.email") or "").strip(),
        "tenant_id": (get_setting(db, "outlook.tenant_id") or "").strip(),
        "client_id": (get_setting(db, "outlook.client_id") or "").strip(),
        "client_secret": (get_setting(db, "outlook.client_secret") or "").strip(),
        "smtp_host": (get_setting(db, "outlook.smtp_host") or "").strip(),
        "smtp_port": (get_setting(db, "outlook.smtp_port") or "587").strip(),
        "smtp_username": (get_setting(db, "outlook.smtp_username") or "").strip(),
        "smtp_password": (get_setting(db, "outlook.smtp_password") or "").strip(),
        "smtp_from": (get_setting(db, "outlook.smtp_from") or "").strip(),
        "last_status": (get_setting(db, "outlook.last_status") or "NOT_CONFIGURED").strip(),
        "last_message": (get_setting(db, "outlook.last_message") or "").strip(),
    }


def _graph_ready(cfg: dict[str, Any]) -> bool:
    return bool(cfg["tenant_id"] and cfg["client_id"] and cfg["client_secret"] and cfg["owner_mailbox"])


def _smtp_ready(cfg: dict[str, Any]) -> bool:
    return bool(cfg["smtp_host"] and cfg["smtp_from"] and cfg["owner_mailbox"])


class GraphNotificationService(INotificationService):
    def __init__(self, cfg: dict[str, Any]):
        self.cfg = cfg

    def is_configured(self) -> bool:
        return _graph_ready(self.cfg)

    def status(self) -> dict:
        if not self.is_configured():
            return {
                "status": "NOT_CONFIGURED",
                "message": "Microsoft 365 email needs tenant, client ID, secret, and owner mailbox",
            }
        return {
            "status": self.cfg.get("last_status") or "CONFIGURED",
            "message": self.cfg.get("last_message") or "Microsoft Graph email ready",
        }

    def _token(self) -> str:
        url = GRAPH_TOKEN_URL.format(tenant=self.cfg["tenant_id"])
        data = {
            "client_id": self.cfg["client_id"],
            "client_secret": self.cfg["client_secret"],
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
        with httpx.Client(timeout=20.0) as client:
            r = client.post(url, data=data)
            r.raise_for_status()
            return r.json()["access_token"]

    def send(self, channel: str, to: str, subject: str, body: str) -> dict:
        if not self.is_configured():
            return {"ok": False, "reason": "not_configured", "channel": channel}
        try:
            token = self._token()
            mailbox = self.cfg["owner_mailbox"]
            payload = {
                "message": {
                    "subject": subject,
                    "body": {"contentType": "Text", "content": body},
                    "toRecipients": [{"emailAddress": {"address": to}}],
                },
                "saveToSentItems": True,
            }
            url = GRAPH_SEND_MAIL.format(mailbox=mailbox)
            with httpx.Client(timeout=20.0) as client:
                r = client.post(
                    url,
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json=payload,
                )
                r.raise_for_status()
            return {"ok": True, "channel": "graph", "to": to}
        except Exception as exc:  # noqa: BLE001
            log.warning("Graph sendMail failed: %s", exc)
            return {"ok": False, "reason": str(exc), "channel": "graph"}


class SmtpNotificationService(INotificationService):
    def __init__(self, cfg: dict[str, Any]):
        self.cfg = cfg

    def is_configured(self) -> bool:
        return _smtp_ready(self.cfg)

    def status(self) -> dict:
        if not self.is_configured():
            return {
                "status": "NOT_CONFIGURED",
                "message": "Simple email needs SMTP host, from address, and owner email",
            }
        return {
            "status": self.cfg.get("last_status") or "CONFIGURED",
            "message": self.cfg.get("last_message") or "SMTP email ready",
        }

    def send(self, channel: str, to: str, subject: str, body: str) -> dict:
        if not self.is_configured():
            return {"ok": False, "reason": "not_configured", "channel": channel}
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = self.cfg["smtp_from"]
            msg["To"] = to
            msg.set_content(body)
            port = int(self.cfg.get("smtp_port") or 587)
            host = self.cfg["smtp_host"]
            with smtplib.SMTP(host, port, timeout=20) as smtp:
                smtp.ehlo()
                try:
                    smtp.starttls()
                    smtp.ehlo()
                except smtplib.SMTPException:
                    pass
                user = self.cfg.get("smtp_username") or ""
                password = self.cfg.get("smtp_password") or ""
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
            return {"ok": True, "channel": "smtp", "to": to}
        except Exception as exc:  # noqa: BLE001
            log.warning("SMTP send failed: %s", exc)
            return {"ok": False, "reason": str(exc), "channel": "smtp"}


class GraphCalendarService(IMicrosoftCalendarService):
    def __init__(self, cfg: dict[str, Any]):
        self.cfg = cfg

    def is_configured(self) -> bool:
        return _graph_ready(self.cfg) and bool(self.cfg.get("sync_calendar") or self.cfg.get("connect_calendar"))

    def status(self) -> dict:
        if not _graph_ready(self.cfg):
            return {"status": "NOT_CONFIGURED", "message": "Outlook calendar sync needs Microsoft 365 (Graph) credentials"}
        if not (self.cfg.get("sync_calendar") or self.cfg.get("connect_calendar")):
            return {"status": "DISABLED", "message": "Outlook calendar sync is turned off"}
        return {
            "status": self.cfg.get("last_status") or "CONFIGURED",
            "message": self.cfg.get("last_message") or "Outlook calendar sync ready (best-effort)",
        }

    def _token(self) -> str:
        url = GRAPH_TOKEN_URL.format(tenant=self.cfg["tenant_id"])
        data = {
            "client_id": self.cfg["client_id"],
            "client_secret": self.cfg["client_secret"],
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
        with httpx.Client(timeout=20.0) as client:
            r = client.post(url, data=data)
            r.raise_for_status()
            return r.json()["access_token"]

    def sync_booking(self, booking_id: int, event: dict[str, Any] | None = None) -> dict:
        if not self.is_configured():
            return {"ok": False, "reason": "not_configured"}
        if not event:
            return {"ok": False, "reason": "no_event_payload"}
        try:
            token = self._token()
            mailbox = self.cfg["owner_mailbox"]
            url = GRAPH_EVENTS.format(mailbox=mailbox)
            with httpx.Client(timeout=20.0) as client:
                r = client.post(
                    url,
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json=event,
                )
                r.raise_for_status()
                data = r.json()
            return {"ok": True, "event_id": data.get("id"), "channel": "graph_calendar"}
        except Exception as exc:  # noqa: BLE001
            log.warning("Graph calendar sync failed for booking %s: %s", booking_id, exc)
            return {"ok": False, "reason": str(exc)}


def get_notification_service(db: Session) -> INotificationService:
    cfg = outlook_config(db)
    mode = cfg["mode"]
    if mode == "graph" and _graph_ready(cfg):
        return GraphNotificationService(cfg)
    if mode == "smtp" and _smtp_ready(cfg):
        return SmtpNotificationService(cfg)
    return NullNotification()


def get_calendar_service(db: Session) -> IMicrosoftCalendarService:
    cfg = outlook_config(db)
    if cfg["mode"] == "graph" and (_truthy(str(cfg.get("sync_calendar"))) or _truthy(str(cfg.get("connect_calendar")))):
        if _graph_ready(cfg):
            return GraphCalendarService(cfg)
    return NullMicrosoftCalendar()


def test_outlook_connection(db: Session, send_test: bool = False) -> dict[str, Any]:
    """Safe connection check — never crashes the API."""
    from app.services.bootstrap import set_setting

    cfg = outlook_config(db)
    mode = cfg["mode"]
    if mode == "disabled":
        msg = "Outlook is turned off. Turn on Connect Outlook calendar or pick a connection mode."
        set_setting(db, "outlook.last_status", "NOT_CONFIGURED", category="outlook")
        set_setting(db, "outlook.last_message", msg, category="outlook")
        db.commit()
        return {"ok": False, "status": "NOT_CONFIGURED", "message": msg}

    if mode == "graph":
        if not _graph_ready(cfg):
            msg = "Fill in Tenant ID, Client ID, Client Secret, and Owner Outlook email."
            set_setting(db, "outlook.last_status", "NOT_CONFIGURED", category="outlook")
            set_setting(db, "outlook.last_message", msg, category="outlook")
            db.commit()
            return {"ok": False, "status": "NOT_CONFIGURED", "message": msg}
        try:
            svc = GraphNotificationService(cfg)
            token = svc._token()
            if not token:
                raise RuntimeError("Empty token")
            if send_test:
                to = cfg["owner_mailbox"]
                result = svc.send("email", to, "Car Wash Manager — test alert", "This is a test owner alert from Car Wash Manager. Local calendar still works without Outlook.")
                if not result.get("ok"):
                    raise RuntimeError(result.get("reason") or "send failed")
                msg = f"Connected — test email sent to {to}."
            else:
                msg = "Connected to Microsoft 365. Token OK."
            set_setting(db, "outlook.last_status", "CONNECTED", category="outlook")
            set_setting(db, "outlook.last_message", msg, category="outlook")
            db.commit()
            return {"ok": True, "status": "CONNECTED", "message": msg}
        except Exception as exc:  # noqa: BLE001
            msg = f"Could not connect to Microsoft 365: {exc}"
            set_setting(db, "outlook.last_status", "FAILED", category="outlook")
            set_setting(db, "outlook.last_message", msg, category="outlook")
            db.commit()
            return {"ok": False, "status": "FAILED", "message": msg}

    # smtp
    if not _smtp_ready(cfg):
        msg = "Fill in SMTP host, From address, and Owner Outlook email."
        set_setting(db, "outlook.last_status", "NOT_CONFIGURED", category="outlook")
        set_setting(db, "outlook.last_message", msg, category="outlook")
        db.commit()
        return {"ok": False, "status": "NOT_CONFIGURED", "message": msg}
    try:
        port = int(cfg.get("smtp_port") or 587)
        with smtplib.SMTP(cfg["smtp_host"], port, timeout=15) as smtp:
            smtp.ehlo()
            try:
                smtp.starttls()
                smtp.ehlo()
            except smtplib.SMTPException:
                pass
            user = cfg.get("smtp_username") or ""
            if user:
                smtp.login(user, cfg.get("smtp_password") or "")
        if send_test:
            svc = SmtpNotificationService(cfg)
            result = svc.send(
                "email",
                cfg["owner_mailbox"],
                "Car Wash Manager — test alert",
                "This is a test owner alert from Car Wash Manager.",
            )
            if not result.get("ok"):
                raise RuntimeError(result.get("reason") or "send failed")
            msg = f"Connected — test email sent to {cfg['owner_mailbox']}."
        else:
            msg = f"Connected to SMTP host {cfg['smtp_host']}."
        set_setting(db, "outlook.last_status", "CONNECTED", category="outlook")
        set_setting(db, "outlook.last_message", msg, category="outlook")
        db.commit()
        return {"ok": True, "status": "CONNECTED", "message": msg}
    except Exception as exc:  # noqa: BLE001
        msg = f"Could not connect via simple email: {exc}"
        set_setting(db, "outlook.last_status", "FAILED", category="outlook")
        set_setting(db, "outlook.last_message", msg, category="outlook")
        db.commit()
        return {"ok": False, "status": "FAILED", "message": msg}
