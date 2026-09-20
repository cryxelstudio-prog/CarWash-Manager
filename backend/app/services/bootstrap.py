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
        if not db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first():
            db.add(
                ApplicationSetting(
                    key=key, value=value, value_type=vtype, category=category, description=desc
                )
            )

    db.commit()
    log.info("Bootstrap complete")


def setup_required(db: Session) -> bool:
    from app.models import User

    return db.query(User).filter(User.is_deleted.is_(False)).count() == 0


def get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
    return row.value if row else default


def set_setting(db: Session, key: str, value: str, category: str = "general") -> None:
    row = db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(ApplicationSetting(key=key, value=value, category=category))
