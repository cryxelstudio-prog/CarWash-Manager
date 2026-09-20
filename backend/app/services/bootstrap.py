"""First-run bootstrap: roles, permissions, integrations, settings."""
from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    ApplicationSetting,
    Integration,
    Permission,
    Role,
    RolePermission,
)
from app.services.bays import ensure_default_bays
from app.models.models import IntegrationStatus

log = logging.getLogger("startup")

PERMISSIONS = [
    ("dashboard.view", "View Dashboard", "dashboard"),
    ("bookings.view", "View Bookings", "bookings"),
    ("bookings.manage", "Manage Bookings", "bookings"),
    ("queue.manage", "Manage Wash Queue", "queue"),
    ("customers.view", "View Customers", "customers"),
    ("customers.manage", "Manage Customers", "customers"),
    ("vehicles.view", "View Vehicles", "vehicles"),
    ("vehicles.manage", "Manage Vehicles", "vehicles"),
    ("services.view", "View Services", "services"),
    ("services.manage", "Manage Services", "services"),
    ("employees.view", "View Employees", "employees"),
    ("employees.manage", "Manage Employees", "employees"),
    ("attendance.manage", "Manage Attendance", "attendance"),
    ("payments.view", "View Payments", "payments"),
    ("payments.manage", "Manage Payments", "payments"),
    ("invoices.manage", "Manage Invoices", "invoices"),
    ("cashup.manage", "Manage Cash-up", "cashup"),
    ("expenses.manage", "Manage Expenses", "expenses"),
    ("inventory.view", "View Inventory", "inventory"),
    ("inventory.manage", "Manage Inventory", "inventory"),
    ("suppliers.manage", "Manage Suppliers", "suppliers"),
    ("reports.view", "View Reports", "reports"),
    ("reports.export", "Export Reports", "reports"),
    ("branches.manage", "Manage Branches", "branches"),
    ("notifications.view", "View Notifications", "notifications"),
    ("settings.manage", "Manage Settings", "settings"),
    ("integrations.view", "View Integrations", "integrations"),
    ("admin.manage", "Admin Access", "admin"),
    ("audit.view", "View Audit Log", "admin"),
    ("backup.manage", "Backup & Restore", "admin"),
]

ROLE_DEFS = [
    ("super_admin", "Super Admin", True, ["*"]),
    ("owner", "Owner", True, ["*"]),
    ("manager", "Manager", True, [
        "dashboard.view", "bookings.view", "bookings.manage", "queue.manage",
        "customers.view", "customers.manage", "vehicles.view", "vehicles.manage",
        "services.view", "services.manage", "employees.view", "employees.manage",
        "attendance.manage", "payments.view", "payments.manage", "invoices.manage",
        "cashup.manage", "expenses.manage", "inventory.view", "inventory.manage",
        "suppliers.manage", "reports.view", "reports.export", "branches.manage",
        "notifications.view", "settings.manage", "integrations.view", "audit.view",
    ]),
    ("supervisor", "Supervisor", True, [
        "dashboard.view", "bookings.view", "bookings.manage", "queue.manage",
        "customers.view", "customers.manage", "vehicles.view", "vehicles.manage",
        "services.view", "employees.view", "attendance.manage", "payments.view",
        "payments.manage", "inventory.view", "reports.view", "notifications.view",
    ]),
    ("reception", "Reception", True, [
        "dashboard.view", "bookings.view", "bookings.manage", "queue.manage",
        "customers.view", "customers.manage", "vehicles.view", "vehicles.manage",
        "services.view", "payments.view", "notifications.view",
    ]),
    ("cashier", "Cashier", True, [
        "dashboard.view", "bookings.view", "payments.view", "payments.manage",
        "invoices.manage", "cashup.manage", "customers.view", "notifications.view",
    ]),
    ("operator", "Operator", True, [
        "dashboard.view", "queue.manage", "bookings.view", "notifications.view",
    ]),
    ("detailer", "Detailer", True, [
        "dashboard.view", "queue.manage", "bookings.view", "notifications.view",
    ]),
    ("finance", "Finance", True, [
        "dashboard.view", "payments.view", "payments.manage", "invoices.manage",
        "expenses.manage", "reports.view", "reports.export", "cashup.manage",
    ]),
    ("reports_only", "Reports Only", True, [
        "dashboard.view", "reports.view", "reports.export",
    ]),
    ("custom", "Custom", True, []),
]

INTEGRATIONS = [
    ("m365_auth", "Microsoft 365 Authentication", "microsoft", "Optional Entra ID / Microsoft login"),
    ("m365_calendar", "Microsoft Calendar", "microsoft", "Sync bookings to Outlook calendar"),
    ("outlook_notifications", "Outlook / Microsoft 365 Alerts", "microsoft", "Owner email alerts via Graph or SMTP"),
    ("sharepoint", "SharePoint", "microsoft", "Document library sync"),
    ("power_apps", "Power Apps", "microsoft", "Power Platform connector"),
    ("email", "Email Notifications", "notifications", "SMTP / Graph email"),
    ("sms", "SMS Notifications", "notifications", "SMS gateway"),
    ("whatsapp", "WhatsApp Notifications", "notifications", "WhatsApp Business API"),
    ("teams", "Microsoft Teams", "notifications", "Teams webhook notifications"),
    ("payment_card", "Card Payment Provider", "payments", "External card processing"),
]

DEFAULT_SETTINGS = [
    ("company.name", "My Car Wash", "string", "branding", "Company display name"),
    ("company.phone", "", "string", "branding", "Company phone"),
    ("company.email", "", "string", "branding", "Company email"),
    ("company.address", "", "string", "branding", "Company address"),
    ("app.name", "Car Wash Manager", "string", "branding", "Application name"),
    ("app.accent_colour", "#0ea5e9", "string", "branding", "Accent colour"),
    ("app.logo_url", "", "string", "branding", "Logo path"),
    ("app.favicon_url", "", "string", "branding", "Favicon path"),
    ("app.receipt_footer", "Thank you for your business!", "string", "branding", "Receipt footer"),
    ("locale.currency", "ZAR", "string", "locale", "Currency code"),
    ("locale.currency_symbol", "R", "string", "locale", "Currency symbol"),
    ("locale.timezone", "Africa/Johannesburg", "string", "locale", "Timezone"),
    ("locale.date_format", "DD/MM/YYYY", "string", "locale", "Date format"),
    ("locale.tax_rate", "15", "number", "locale", "Default VAT %"),
    ("booking.default_duration", "30", "number", "booking", "Default duration minutes"),
    ("booking.allow_overlap", "false", "boolean", "booking", "Allow overlapping bookings"),
    ("setup.completed", "false", "boolean", "system", "First-run completed"),
    ("loyalty.points_per_rand", "1", "number", "loyalty", "Points earned per R1"),
    ("hosting.cors_origins_extra", "", "string", "hosting", "Extra CORS origins (comma-separated) for Power Apps / LAN"),
    ("app.version", "0.7.0", "string", "system", "Displayed app version"),
    ("app.login_background_url", "", "string", "branding", "Optional login background image URL"),
    ("app.theme_default", "system", "string", "branding", "Default theme: light/dark/system"),
    ("launch.public_base_url", "", "string", "launch", "Public / reverse-proxy base URL for QR and invites"),
    ("launch.bind_host", "0.0.0.0", "string", "launch", "Suggested bind host"),
    ("launch.port", "8787", "string", "launch", "Suggested listen port"),
    ("powerapps.environment_url", "", "string", "powerapps", "Power Apps environment URL"),
    ("powerapps.app_id", "", "string", "powerapps", "Optional Power Apps app ID"),
    ("powerapps.api_base_url", "", "string", "powerapps", "API base URL exposed to connector"),
    ("powerapps.cors_origins", "", "string", "powerapps", "CORS origins for Power Apps"),
    ("sharepoint.site_url", "", "string", "sharepoint", "SharePoint site URL"),
    ("sharepoint.list_name", "", "string", "sharepoint", "Optional list name"),
    ("sharepoint.library_name", "", "string", "sharepoint", "Optional library name"),
    ("sharepoint.doc_library", "", "string", "sharepoint", "Document library for invoices/photos"),
    ("vehicles.show_registration", "false", "boolean", "vehicles", "Show registration plates in staff UI (default OFF)"),
    ("vehicles.hide_registration", "true", "boolean", "vehicles", "Hide registration by default (inverse of show)"),
    ("vehicles.require_registration", "false", "boolean", "vehicles", "Require registration on vehicles / check-in"),
    ("owner.name", "", "string", "owner", "Owner display name for alerts"),
    ("owner.email", "", "string", "owner", "Owner email for alerts (required for email path)"),
    ("owner.alert.car_ready", "true", "boolean", "owner", "Notify when car is ready for collection"),
    ("owner.alert.car_completed", "true", "boolean", "owner", "Notify when car is collected / completed"),
    ("owner.alert.booking_created", "false", "boolean", "owner", "Notify when a booking is created"),
    ("owner.alert.cancelled", "true", "boolean", "owner", "Notify when a booking is cancelled"),
    ("owner.alert.no_show", "true", "boolean", "owner", "Notify on customer no-show"),
    ("owner.alert.email_when_ready", "true", "boolean", "owner", "Email owner when car ready/complete (if Outlook configured)"),
    ("outlook.mode", "disabled", "string", "outlook", "disabled | graph | smtp"),
    ("outlook.connect_calendar", "false", "boolean", "outlook", "Connect Outlook calendar (master toggle)"),
    ("outlook.sync_calendar", "false", "boolean", "outlook", "Best-effort sync bookings to Outlook calendar"),
    ("outlook.owner_mailbox", "", "string", "outlook", "Owner Outlook / mailbox address"),
    ("outlook.tenant_id", "", "string", "outlook", "Microsoft Entra tenant ID"),
    ("outlook.client_id", "", "string", "outlook", "App registration client ID"),
    ("outlook.client_secret", "", "string", "outlook", "App registration client secret"),
    ("outlook.smtp_host", "", "string", "outlook", "SMTP host for simple email"),
    ("outlook.smtp_port", "587", "string", "outlook", "SMTP port"),
    ("outlook.smtp_username", "", "string", "outlook", "SMTP username"),
    ("outlook.smtp_password", "", "string", "outlook", "SMTP password / app password"),
    ("outlook.smtp_from", "", "string", "outlook", "From address for SMTP"),
    ("outlook.last_status", "NOT_CONFIGURED", "string", "outlook", "Last connection status"),
    ("outlook.last_message", "", "string", "outlook", "Friendly last connection message"),
    ("payments.allow_salary_deduction", "true", "boolean", "payments", "Allow salary deduction bookings (anyone with employee number)"),
    ("payments.salary_monthly_cap", "", "number", "payments", "Soft monthly outstanding warning per employee number (empty = off)"),
]


def ensure_bootstrap(db: Session) -> None:
    """Idempotent seed of roles, permissions, integrations, settings."""
    perm_map: dict[str, Permission] = {}
    for code, name, module in PERMISSIONS:
        p = db.query(Permission).filter(Permission.code == code).first()
        if not p:
            p = Permission(code=code, name=name, module=module)
            db.add(p)
            db.flush()
        perm_map[code] = p

    for name, display, is_system, codes in ROLE_DEFS:
        role = db.query(Role).filter(Role.name == name).first()
        if not role:
            role = Role(name=name, display_name=display, is_system=is_system, description=display)
            db.add(role)
            db.flush()
        if codes == ["*"]:
            # grant all
            existing = {rp.permission_id for rp in role.permissions}
            for p in perm_map.values():
                if p.id not in existing:
                    db.add(RolePermission(role_id=role.id, permission_id=p.id))
        else:
            existing = {rp.permission_id for rp in role.permissions}
            for c in codes:
                p = perm_map.get(c)
                if p and p.id not in existing:
                    db.add(RolePermission(role_id=role.id, permission_id=p.id))

    for code, name, category, desc in INTEGRATIONS:
        if not db.query(Integration).filter(Integration.code == code).first():
            db.add(
                Integration(
                    code=code,
                    name=name,
                    category=category,
                    status=IntegrationStatus.NOT_CONFIGURED.value,
                    is_enabled=False,
                    description=desc,
                )
            )

    for key, value, vtype, category, desc in DEFAULT_SETTINGS:
        row = db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
        if not row:
            db.add(
                ApplicationSetting(
                    key=key, value=value, value_type=vtype, category=category, description=desc
                )
            )
        elif key == "app.version" and row.value != value:
            # Keep displayed version current on upgrades
            row.value = value

    db.commit()
    try:
        ensure_default_bays(db)
    except Exception as exc:  # noqa: BLE001
        log.warning("ensure_default_bays: %s", exc)
    log.info("Bootstrap complete")


def setup_required(db: Session) -> bool:
    from app.models import User

    return db.query(User).filter(User.is_deleted.is_(False)).count() == 0


def get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
    return row.value if row else default


def set_setting(db: Session, key: str, value: str, category: str = "general") -> None:
    db.flush()
    row = db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
    if row:
        row.value = value
        if category and not row.category:
            row.category = category
    else:
        db.add(ApplicationSetting(key=key, value=value, category=category))
