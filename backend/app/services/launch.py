"""Launch hub helpers — LAN URLs, Power Apps / SharePoint settings."""
from __future__ import annotations

import socket
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Integration
from app.models.models import IntegrationStatus
from app.services.bootstrap import get_setting, set_setting

POWERAPPS_KEYS = [
    "powerapps.environment_url",
    "powerapps.app_id",
    "powerapps.api_base_url",
    "powerapps.cors_origins",
]

SHAREPOINT_KEYS = [
    "sharepoint.site_url",
    "sharepoint.list_name",
    "sharepoint.library_name",
    "sharepoint.doc_library",
]

OWNER_KEYS = [
    "owner.name",
    "owner.email",
    "owner.alert.car_ready",
    "owner.alert.car_completed",
    "owner.alert.booking_created",
    "owner.alert.cancelled",
    "owner.alert.no_show",
    "owner.alert.email_when_ready",
    "customer.alert.email_when_done",
    "customer.alert.ready_subject",
    "customer.alert.ready_template",
]

OUTLOOK_KEYS = [
    "outlook.mode",
    "outlook.connect_calendar",
    "outlook.sync_calendar",
    "outlook.owner_mailbox",
    "outlook.tenant_id",
    "outlook.client_id",
    "outlook.client_secret",
    "outlook.smtp_host",
    "outlook.smtp_port",
    "outlook.smtp_username",
    "outlook.smtp_password",
    "outlook.smtp_from",
    "outlook.last_status",
    "outlook.last_message",
]

LAUNCH_KEYS = [
    "launch.public_base_url",
    "launch.bind_host",
    "launch.port",
    *POWERAPPS_KEYS,
    *SHAREPOINT_KEYS,
    *OWNER_KEYS,
    *OUTLOOK_KEYS,
]


def _local_ips() -> list[str]:
    ips: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, family=socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127.") and ip not in ips:
            ips.insert(0, ip)
    except OSError:
        pass
    return ips


def detect_access_urls(db: Session | None = None) -> dict[str, Any]:
    settings = get_settings()
    port = settings.port
    hostname = socket.gethostname()
    ips = _local_ips()
    public = None
    if db is not None:
        public = (get_setting(db, "launch.public_base_url") or "").rstrip("/") or None
        port_override = get_setting(db, "launch.port")
        if port_override and str(port_override).isdigit():
            port = int(port_override)

    local_url = f"http://127.0.0.1:{port}"
    localhost_url = f"http://localhost:{port}"
    lan_urls = [f"http://{ip}:{port}" for ip in ips]
    host_url = f"http://{hostname}:{port}"
    if host_url not in lan_urls:
        lan_urls.append(host_url)

    primary = public or (lan_urls[0] if lan_urls else local_url)
    mobile_path = "/m"
    login_path = "/login"

    return {
        "hostname": hostname,
        "port": port,
        "bind_host": "0.0.0.0",
        "local_ips": ips,
        "local_url": local_url,
        "localhost_url": localhost_url,
        "lan_urls": lan_urls,
        "public_base_url": public,
        "primary_url": primary,
        "invite_link": f"{primary}{login_path}",
        "mobile_link": f"{primary}{mobile_path}",
        "qr_target": f"{primary}{mobile_path}",
        "openapi_url": f"{primary}/api/docs",
        "api_base_url": f"{primary}/api/v1",
    }


def _configured(values: dict[str, str | None], required: list[str]) -> bool:
    return all((values.get(k) or "").strip() for k in required)



def _truthy_setting(v: str | None) -> bool:
    return (v or "").strip().lower() in ("1", "true", "yes", "on")


def _owner_alerts_platform(settings_map: dict[str, str]) -> dict:
    email = (settings_map.get("owner.email") or settings_map.get("outlook.owner_mailbox") or "").strip()
    name = (settings_map.get("owner.name") or "").strip()
    fields = {k: settings_map.get(k) or "" for k in OWNER_KEYS}
    ok = bool(email)
    return {
        "status": "CONFIGURED" if ok else "NOT_CONFIGURED",
        "message": f"Alerts go to {name or email}" if ok else "Add owner name + email so staff can notify you",
        "fields": fields,
    }


def _outlook_platform(db: Session, settings_map: dict[str, str]) -> dict:
    from app.integrations.outlook import outlook_config

    cfg = outlook_config(db)
    mode = cfg["mode"]
    connect = cfg["connect_calendar"] or mode != "disabled"
    last = (settings_map.get("outlook.last_status") or "NOT_CONFIGURED").upper()
    last_msg = settings_map.get("outlook.last_message") or ""
    fields = {k: settings_map.get(k) or "" for k in OUTLOOK_KEYS}
    if not fields.get("outlook.owner_mailbox"):
        fields["outlook.owner_mailbox"] = settings_map.get("owner.email") or ""
    if not connect and mode == "disabled":
        status = "NOT_CONFIGURED"
        message = "Optional — local calendar works without Outlook"
    elif last == "CONNECTED":
        status = "CONNECTED"
        message = last_msg or "Connected"
    elif last == "FAILED":
        status = "FAILED"
        message = last_msg or "Last test failed — check details or see docs/OUTLOOK_SETUP.txt"
    elif mode in ("graph", "smtp"):
        status = "CONFIGURED"
        message = last_msg or ("Microsoft 365 ready to test" if mode == "graph" else "Simple email ready to test")
    else:
        status = "NOT_CONFIGURED"
        message = "Turn on Connect Outlook calendar to get started"
    return {
        "status": status,
        "message": message,
        "fields": fields,
        "mode": mode,
        "connect_calendar": connect,
        "sync_calendar": cfg["sync_calendar"],
    }


def launch_status(db: Session) -> dict[str, Any]:
    access = detect_access_urls(db)
    settings_map = {k: get_setting(db, k) or "" for k in LAUNCH_KEYS}
    pa = {k: settings_map[k] for k in POWERAPPS_KEYS}
    sp = {k: settings_map[k] for k in SHAREPOINT_KEYS}

    # Prefer Integration.config_json if present
    for code, bucket in (("power_apps", pa), ("sharepoint", sp)):
        row = db.query(Integration).filter(Integration.code == code).first()
        if row and row.config_json:
            for k, v in row.config_json.items():
                full = f"{'powerapps' if code == 'power_apps' else 'sharepoint'}.{k}"
                if full in bucket and v:
                    bucket[full] = str(v)

    pa_ok = _configured(pa, ["powerapps.environment_url"]) or _configured(pa, ["powerapps.api_base_url"])
    sp_ok = _configured(sp, ["sharepoint.site_url"])
    public_ok = bool((settings_map.get("launch.public_base_url") or "").strip())

    return {
        "access": access,
        "settings": settings_map,
        "platforms": {
            "local": {"status": "CONFIGURED", "message": "Runs on this PC"},
            "lan": {
                "status": "CONFIGURED" if access["lan_urls"] else "NOT_CONFIGURED",
                "message": "Phone access via company Wi‑Fi" if access["lan_urls"] else "No LAN IP detected",
            },
            "power_apps": {
                "status": "CONFIGURED" if pa_ok else "NOT_CONFIGURED",
                "message": "Environment / API base saved" if pa_ok else "Enter Environment URL or API base",
                "fields": pa,
            },
            "sharepoint": {
                "status": "CONFIGURED" if sp_ok else "NOT_CONFIGURED",
                "message": "Site URL saved" if sp_ok else "Optional — not required for core app",
                "fields": sp,
            },
            "custom": {
                "status": "CONFIGURED" if public_ok else "NOT_CONFIGURED",
                "message": "Public base URL set" if public_ok else "Set a public / reverse-proxy URL for QR links",
                "fields": {"launch.public_base_url": settings_map.get("launch.public_base_url") or ""},
            },
            "owner_alerts": _owner_alerts_platform(settings_map),
            "outlook": _outlook_platform(db, settings_map),
            "outlook_calendar": _outlook_platform(db, settings_map),
        },
        "version": get_settings().app_version,
    }


def save_launch_platform(db: Session, platform: str, fields: dict[str, Any]) -> dict[str, Any]:
    platform = platform.lower().replace("-", "_").replace(" ", "_")
    if platform in ("power_apps", "powerapps"):
        mapping = {
            "environment_url": "powerapps.environment_url",
            "app_id": "powerapps.app_id",
            "api_base_url": "powerapps.api_base_url",
            "cors_origins": "powerapps.cors_origins",
            "powerapps.environment_url": "powerapps.environment_url",
            "powerapps.app_id": "powerapps.app_id",
            "powerapps.api_base_url": "powerapps.api_base_url",
            "powerapps.cors_origins": "powerapps.cors_origins",
        }
        cfg: dict[str, str] = {}
        for k, v in fields.items():
            key = mapping.get(k)
            if not key:
                continue
            val = "" if v is None else str(v).strip()
            set_setting(db, key, val, category="powerapps")
            cfg[key.split(".", 1)[1]] = val
        # Mirror into hosting CORS tip
        if cfg.get("cors_origins"):
            set_setting(db, "hosting.cors_origins_extra", cfg["cors_origins"], category="hosting")
        row = db.query(Integration).filter(Integration.code == "power_apps").first()
        if row:
            row.config_json = {**(row.config_json or {}), **cfg}
            row.is_enabled = bool(cfg.get("environment_url") or cfg.get("api_base_url"))
            row.status = IntegrationStatus.CONFIGURED.value if row.is_enabled else IntegrationStatus.NOT_CONFIGURED.value
        db.commit()
        return launch_status(db)

    if platform in ("sharepoint", "share_point"):
        mapping = {
            "site_url": "sharepoint.site_url",
            "list_name": "sharepoint.list_name",
            "library_name": "sharepoint.library_name",
            "doc_library": "sharepoint.doc_library",
            "sharepoint.site_url": "sharepoint.site_url",
            "sharepoint.list_name": "sharepoint.list_name",
            "sharepoint.library_name": "sharepoint.library_name",
            "sharepoint.doc_library": "sharepoint.doc_library",
        }
        cfg = {}
        for k, v in fields.items():
            key = mapping.get(k)
            if not key:
                continue
            val = "" if v is None else str(v).strip()
            set_setting(db, key, val, category="sharepoint")
            cfg[key.split(".", 1)[1]] = val
        row = db.query(Integration).filter(Integration.code == "sharepoint").first()
        if row:
            row.config_json = {**(row.config_json or {}), **cfg}
            row.is_enabled = bool(cfg.get("site_url"))
            row.status = IntegrationStatus.CONFIGURED.value if row.is_enabled else IntegrationStatus.NOT_CONFIGURED.value
        db.commit()
        return launch_status(db)

    if platform in ("custom", "self_hosted", "selfhosted", "public"):
        url = str(fields.get("launch.public_base_url") or fields.get("public_base_url") or "").strip().rstrip("/")
        set_setting(db, "launch.public_base_url", url, category="launch")
        db.commit()
        return launch_status(db)

    if platform in ("local", "lan"):
        if "port" in fields or "launch.port" in fields:
            port = str(fields.get("port") or fields.get("launch.port") or "").strip()
            set_setting(db, "launch.port", port, category="launch")
        if "bind_host" in fields or "launch.bind_host" in fields:
            set_setting(
                db,
                "launch.bind_host",
                str(fields.get("bind_host") or fields.get("launch.bind_host") or "0.0.0.0"),
                category="launch",
            )
        db.commit()
        return launch_status(db)

    if platform in ("owner_alerts", "owner", "alerts"):
        mapping = {
            "owner.name": "owner.name",
            "name": "owner.name",
            "owner.email": "owner.email",
            "email": "owner.email",
            "owner.alert.car_ready": "owner.alert.car_ready",
            "owner.alert.car_completed": "owner.alert.car_completed",
            "owner.alert.booking_created": "owner.alert.booking_created",
            "owner.alert.cancelled": "owner.alert.cancelled",
            "owner.alert.no_show": "owner.alert.no_show",
            "owner.alert.email_when_ready": "owner.alert.email_when_ready",
            "car_ready": "owner.alert.car_ready",
            "car_completed": "owner.alert.car_completed",
            "booking_created": "owner.alert.booking_created",
            "cancelled": "owner.alert.cancelled",
            "no_show": "owner.alert.no_show",
            "email_when_ready": "owner.alert.email_when_ready",
            "customer.alert.email_when_done": "customer.alert.email_when_done",
            "customer.alert.ready_subject": "customer.alert.ready_subject",
            "customer.alert.ready_template": "customer.alert.ready_template",
            "email_car_owner_when_done": "customer.alert.email_when_done",
        }
        for k, v in fields.items():
            key = mapping.get(k)
            if not key:
                continue
            if key.startswith("owner.alert.") or key == "customer.alert.email_when_done":
                val = "true" if str(v).lower() in ("1", "true", "yes", "on") else "false"
            else:
                val = "" if v is None else str(v).strip()
            cat = "customer" if key.startswith("customer.") else "owner"
            set_setting(db, key, val, category=cat)
        # Keep outlook mailbox in sync when owner email set
        email = (get_setting(db, "owner.email") or "").strip()
        if email and not (get_setting(db, "outlook.owner_mailbox") or "").strip():
            set_setting(db, "outlook.owner_mailbox", email, category="outlook")
        db.commit()
        return launch_status(db)

    if platform in ("outlook", "outlook_calendar", "microsoft_365", "m365"):
        bool_keys = {
            "outlook.connect_calendar", "connect_calendar", "connect",
            "outlook.sync_calendar", "sync_calendar", "sync",
            "owner.alert.email_when_ready", "email_when_ready", "email_owner_ready",
        }
        mapping = {
            "outlook.mode": "outlook.mode",
            "mode": "outlook.mode",
            "outlook.connect_calendar": "outlook.connect_calendar",
            "connect_calendar": "outlook.connect_calendar",
            "connect": "outlook.connect_calendar",
            "outlook.sync_calendar": "outlook.sync_calendar",
            "sync_calendar": "outlook.sync_calendar",
            "sync": "outlook.sync_calendar",
            "outlook.owner_mailbox": "outlook.owner_mailbox",
            "owner_mailbox": "outlook.owner_mailbox",
            "owner_email": "outlook.owner_mailbox",
            "outlook.tenant_id": "outlook.tenant_id",
            "tenant_id": "outlook.tenant_id",
            "outlook.client_id": "outlook.client_id",
            "client_id": "outlook.client_id",
            "outlook.client_secret": "outlook.client_secret",
            "client_secret": "outlook.client_secret",
            "outlook.smtp_host": "outlook.smtp_host",
            "smtp_host": "outlook.smtp_host",
            "outlook.smtp_port": "outlook.smtp_port",
            "smtp_port": "outlook.smtp_port",
            "outlook.smtp_username": "outlook.smtp_username",
            "smtp_username": "outlook.smtp_username",
            "outlook.smtp_password": "outlook.smtp_password",
            "smtp_password": "outlook.smtp_password",
            "outlook.smtp_from": "outlook.smtp_from",
            "smtp_from": "outlook.smtp_from",
            "owner.alert.email_when_ready": "owner.alert.email_when_ready",
            "email_when_ready": "owner.alert.email_when_ready",
            "email_owner_ready": "owner.alert.email_when_ready",
            "owner.name": "owner.name",
            "owner_name": "owner.name",
            "owner.email": "owner.email",
        }
        cfg: dict[str, str] = {}
        for k, v in fields.items():
            key = mapping.get(k)
            if not key:
                continue
            if key in (
                "outlook.connect_calendar",
                "outlook.sync_calendar",
                "owner.alert.email_when_ready",
            ) or k in bool_keys:
                val = "true" if str(v).lower() in ("1", "true", "yes", "on") else "false"
            elif key == "outlook.mode":
                raw = ("" if v is None else str(v).strip().lower())
                if raw in ("graph", "microsoft", "m365", "microsoft_365", "microsoft 365 (graph)"):
                    val = "graph"
                elif raw in ("smtp", "email", "simple", "simple email (smtp)"):
                    val = "smtp"
                else:
                    val = "disabled"
            else:
                val = "" if v is None else str(v).strip()
            cat = "owner" if key.startswith("owner.") else "outlook"
            set_setting(db, key, val, category=cat)
            if key.startswith("outlook."):
                cfg[key.split(".", 1)[1]] = val

        # Master toggle: if connect off → mode disabled; if connect on and mode disabled → smtp default? keep mode
        connect = (get_setting(db, "outlook.connect_calendar") or "false").lower() in ("1", "true", "yes", "on")
        mode = (get_setting(db, "outlook.mode") or "disabled").lower()
        if not connect:
            set_setting(db, "outlook.mode", "disabled", category="outlook")
            set_setting(db, "outlook.sync_calendar", "false", category="outlook")
            mode = "disabled"
        elif connect and mode == "disabled":
            # User turned connect on but left mode — default to graph label empty; keep disabled until they pick
            pass

        # Mirror mailbox → owner.email
        mailbox = (get_setting(db, "outlook.owner_mailbox") or "").strip()
        if mailbox:
            set_setting(db, "owner.email", mailbox, category="owner")

        row = db.query(Integration).filter(Integration.code == "outlook_notifications").first()
        if row:
            row.config_json = {**(row.config_json or {}), **cfg, "mode": mode}
            enabled = connect and mode in ("graph", "smtp")
            row.is_enabled = enabled
            row.status = (
                IntegrationStatus.CONFIGURED.value
                if enabled
                else IntegrationStatus.NOT_CONFIGURED.value
            )
            row.last_error = None
        cal_row = db.query(Integration).filter(Integration.code == "m365_calendar").first()
        if cal_row:
            sync = (get_setting(db, "outlook.sync_calendar") or "false").lower() in ("1", "true", "yes", "on")
            cal_row.is_enabled = sync and mode == "graph"
            cal_row.status = (
                IntegrationStatus.CONFIGURED.value
                if cal_row.is_enabled
                else IntegrationStatus.NOT_CONFIGURED.value
            )
            cal_row.config_json = {**(cal_row.config_json or {}), "mode": mode, "sync": sync}
        db.commit()
        return launch_status(db)

    raise ValueError(f"Unknown launch platform: {platform}")
