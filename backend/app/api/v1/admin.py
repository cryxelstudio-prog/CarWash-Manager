"""Admin, settings, integrations, audit, backup, search, notifications."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.helpers import bad_request, not_found
from app.core.config import get_settings
from app.core.database import get_db
from app.integrations import base as integrations
from app.models import Activity, ApplicationSetting, AuditLog, Booking, Customer, Integration, Notification, User, Vehicle
from app.schemas.entities import IntegrationOut, NotificationOut, SettingIn
from app.security.deps import AuthContext, CSRFUser, require_permission
from app.services.backup import create_backup, list_backups, restore_backup
from app.services.bootstrap import get_setting, set_setting
from app.services.launch import detect_access_urls, launch_status, save_launch_platform

router = APIRouter(tags=["admin"])


@router.get("/settings")
def get_settings_all(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("settings.manage", "admin.manage", "dashboard.view"))):
    rows = db.query(ApplicationSetting).order_by(ApplicationSetting.category, ApplicationSetting.key).all()
    return {
        "items": [
            {"key": r.key, "value": r.value, "value_type": r.value_type, "category": r.category, "description": r.description}
            for r in rows
        ]
    }


@router.put("/settings/{key:path}")
def update_setting(key: str, payload: SettingIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("settings.manage", "admin.manage"))):
    set_setting(db, key, payload.value or "", category=payload.category)
    db.commit()
    return {"key": key, "value": payload.value}


@router.get("/branding")
def branding(db: Session = Depends(get_db)):
    keys = [
        "app.name", "company.name", "company.phone", "company.email", "company.address",
        "app.accent_colour", "app.logo_url", "app.favicon_url", "app.receipt_footer",
        "app.login_background_url", "app.theme_default",
        "locale.currency", "locale.currency_symbol", "locale.timezone", "locale.date_format", "locale.tax_rate",
        "hosting.cors_origins_extra", "app.version",
    ]
    return {k: get_setting(db, k) for k in keys}


@router.get("/integrations")
def list_integrations(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("integrations.view", "admin.manage"))):
    rows = db.query(Integration).order_by(Integration.category, Integration.name).all()
    # enrich with live adapter status
    adapter_map = {
        "m365_auth": integrations.microsoft_auth.status(),
        "m365_calendar": integrations.microsoft_calendar.status(),
        "sharepoint": integrations.sharepoint.status(),
        "power_apps": integrations.power_platform.status(),
        "email": integrations.notifications.status(),
        "sms": integrations.notifications.status(),
        "whatsapp": integrations.notifications.status(),
        "teams": integrations.notifications.status(),
        "payment_card": integrations.payment_provider.status(),
    }
    items = []
    for r in rows:
        live = adapter_map.get(r.code, {})
        items.append(
            {
                **IntegrationOut.model_validate(r).model_dump(),
                "adapter_status": live.get("status", r.status),
                "adapter_message": live.get("message"),
            }
        )
    return {"items": items, "total": len(items)}


@router.get("/audit-log")
def audit_log(limit: int = 100, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("audit.view", "admin.manage"))):
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return {
        "items": [
            {
                "id": r.id,
                "created_at": r.created_at,
                "username": r.username,
                "action": r.action,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "details": r.details,
            }
            for r in rows
        ]
    }


@router.get("/activity")
def activity_timeline(limit: int = 50, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("dashboard.view", "audit.view"))):
    rows = db.query(Activity).order_by(Activity.created_at.desc()).limit(limit).all()
    return {
        "items": [
            {"id": r.id, "created_at": r.created_at, "actor_name": r.actor_name, "action": r.action, "summary": r.summary, "entity_type": r.entity_type}
            for r in rows
        ]
    }


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("notifications.view", "dashboard.view"))):
    q = db.query(Notification).filter((Notification.user_id == ctx.user.id) | (Notification.user_id.is_(None))).order_by(Notification.created_at.desc()).limit(50)
    rows = q.all()
    return {"items": [NotificationOut.model_validate(n) for n in rows], "total": len(rows)}


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("notifications.view"))):
    n = db.get(Notification, notification_id)
    if not n:
        not_found()
    n.is_read = True
    db.commit()
    return {"message": "ok"}


@router.get("/search")
def global_search(q: str, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("dashboard.view", "customers.view", "bookings.view"))):
    if not q or len(q.strip()) < 2:
        return {"customers": [], "vehicles": [], "bookings": []}
    like = f"%{q.strip()}%"
    customers = (
        db.query(Customer)
        .filter(Customer.is_deleted.is_(False), (Customer.first_name.ilike(like)) | (Customer.last_name.ilike(like)) | (Customer.phone.ilike(like)) | (Customer.customer_number.ilike(like)))
        .limit(10)
        .all()
    )
    vehicles = db.query(Vehicle).filter(Vehicle.is_deleted.is_(False), Vehicle.registration.ilike(like)).limit(10).all()
    bookings = db.query(Booking).filter(Booking.is_deleted.is_(False), Booking.booking_number.ilike(like)).limit(10).all()
    return {
        "customers": [{"id": c.id, "label": f"{c.full_name} ({c.phone})", "number": c.customer_number} for c in customers],
        "vehicles": [{"id": v.id, "label": f"{v.registration} — {v.make or ''} {v.model or ''}", "customer_id": v.customer_id} for v in vehicles],
        "bookings": [{"id": b.id, "label": b.booking_number, "stage": b.wash_stage} for b in bookings],
    }


@router.get("/backups")
def backups(ctx: AuthContext = Depends(require_permission("backup.manage", "admin.manage"))):
    return {"items": list_backups()}


@router.post("/backups")
def do_backup(label: str | None = None, ctx: AuthContext = Depends(require_permission("backup.manage", "admin.manage"))):
    path = create_backup(label)
    return {"message": "Backup created", "name": path.name, "path": str(path)}


@router.post("/backups/restore")
async def do_restore(name: str | None = None, file: UploadFile | None = File(None), ctx: AuthContext = Depends(require_permission("backup.manage", "admin.manage"))):
    settings = get_settings()
    if file is not None:
        dest = settings.backups_dir / f"upload-{file.filename}"
        content = await file.read()
        dest.write_bytes(content)
        restore_backup(dest)
        return {"message": "Restored from upload", "name": dest.name}
    if not name:
        bad_request("Provide backup name or file")
    path = settings.backups_dir / name
    if not path.exists():
        not_found("Backup not found")
    restore_backup(path)
    return {"message": "Restored", "name": name}


@router.get("/diagnostics")
def diagnostics(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("admin.manage", "backup.manage"))):
    settings = get_settings()
    from sqlalchemy import text
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {
        "version": settings.app_version,
        "database_ok": db_ok,
        "database_url_host": "sqlite",
        "data_dir": str(settings.data_dir),
        "uploads_dir": str(settings.uploads_dir),
        "backups_dir": str(settings.backups_dir),
        "logs_dir": str(settings.logs_dir),
        "frontend_dist_exists": settings.frontend_dist.exists(),
        "user_count": db.query(User).filter(User.is_deleted.is_(False)).count(),
        "integrations": integrations.microsoft_auth.status(),
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("admin.manage"))):
    rows = db.query(User).filter(User.is_deleted.is_(False)).all()
    return {
        "items": [
            {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "email": u.email,
                "role_id": u.role_id,
                "is_active": u.is_active,
                "is_super_admin": u.is_super_admin,
                "last_login_at": u.last_login_at,
            }
            for u in rows
        ]
    }


# ── Launch hub / staff access / branding upload ────────────────────


class LaunchPlatformIn(BaseModel):
    fields: dict = Field(default_factory=dict)


@router.get("/launch")
def get_launch(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("settings.manage", "admin.manage", "dashboard.view")),
):
    return launch_status(db)


@router.get("/staff-access")
def staff_access(
    request: Request,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("settings.manage", "admin.manage", "dashboard.view", "queue.manage")),
):
    """LAN + invite helpers for phone QR / link login."""
    access = detect_access_urls(db)
    # Prefer request host when available (matches what the admin browser used)
    try:
        base = str(request.base_url).rstrip("/")
        if base and "127.0.0.1" not in base and "localhost" not in base:
            access["browser_url"] = base
            access["invite_link"] = f"{base}/login"
            access["mobile_link"] = f"{base}/m"
            access["qr_target"] = f"{base}/m"
        else:
            access["browser_url"] = base
    except Exception:  # noqa: BLE001
        access["browser_url"] = access["local_url"]
    return access


@router.put("/launch/{platform}")
def put_launch_platform(
    platform: str,
    payload: LaunchPlatformIn,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("settings.manage", "admin.manage")),
):
    try:
        return save_launch_platform(db, platform, payload.fields or {})
    except ValueError as e:
        bad_request(str(e))


ALLOWED_LOGO = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}


@router.post("/branding/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("settings.manage", "admin.manage")),
):
    settings = get_settings()
    suffix = Path(file.filename or "logo.png").suffix.lower() or ".png"
    if suffix not in ALLOWED_LOGO:
        bad_request(f"Unsupported logo type {suffix}. Use PNG, JPG, WEBP, SVG or GIF.")
    dest_dir = settings.uploads_dir / "branding"
    dest_dir.mkdir(parents=True, exist_ok=True)
    # Clear previous logo variants
    for old in dest_dir.glob("logo.*"):
        try:
            old.unlink()
        except OSError:
            pass
    dest = dest_dir / f"logo{suffix}"
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        bad_request("Logo must be under 5 MB")
    dest.write_bytes(content)
    url = f"/uploads/branding/logo{suffix}"
    set_setting(db, "app.logo_url", url, category="branding")
    db.commit()
    return {"message": "Logo uploaded", "url": url, "path": str(dest)}


@router.put("/branding")
def update_branding(
    payload: dict,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("settings.manage", "admin.manage")),
):
    allowed = {
        "app.name",
        "company.name",
        "company.phone",
        "company.email",
        "company.address",
        "app.accent_colour",
        "app.logo_url",
        "app.favicon_url",
        "app.receipt_footer",
        "app.login_background_url",
        "app.theme_default",
        "locale.currency",
        "locale.currency_symbol",
        "locale.timezone",
        "locale.date_format",
        "locale.tax_rate",
        "hosting.cors_origins_extra",
    }
    for key, value in (payload or {}).items():
        if key in allowed:
            set_setting(db, key, "" if value is None else str(value), category=key.split(".")[0])
    db.commit()
    keys = list(allowed) + ["app.version"]
    return {k: get_setting(db, k) for k in keys}
