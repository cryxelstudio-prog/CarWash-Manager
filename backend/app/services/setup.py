"""First-run wizard completion."""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Branch, Role, Service, User, WashBay
from app.schemas.auth import SetupCompleteIn
from app.security.passwords import hash_password
from app.services.audit import activity, audit
from app.services.bootstrap import set_setting
from app.services.demo_data import seed_demo_data


def complete_setup(db: Session, payload: SetupCompleteIn) -> User:
    from app.services.bootstrap import setup_required

    if not setup_required(db):
        raise ValueError("Setup already completed")

    role = db.query(Role).filter(Role.name == "super_admin").first()
    if not role:
        raise RuntimeError("Roles not bootstrapped")

    admin = User(
        username=payload.admin.username.strip().lower(),
        password_hash=hash_password(payload.admin.password),
        full_name=payload.admin.full_name.strip(),
        email=payload.admin.email,
        role_id=role.id,
        is_super_admin=True,
        is_active=True,
    )
    db.add(admin)
    db.flush()

    branch = Branch(
        code=payload.branch.code.strip().upper(),
        name=payload.branch.name.strip(),
        phone=payload.branch.phone,
        address=payload.branch.address,
        city=payload.branch.city,
        is_active=True,
        is_head_office=True,
    )
    db.add(branch)
    db.flush()
    admin.branch_id = branch.id

    for i in range(1, 3):
        db.add(WashBay(branch_id=branch.id, name=f"Bay {i}", bay_number=i, status="AVAILABLE", is_active=True))

    services = payload.services or [
        SetupServiceLike("EXT", "Exterior Wash", 80, 20),
        SetupServiceLike("INT", "Interior Clean", 100, 30),
        SetupServiceLike("FULL", "Full Wash", 160, 45),
        SetupServiceLike("DETAIL", "Full Detail", 450, 120),
        SetupServiceLike("WAX", "Wax & Polish", 200, 40),
    ]
    # handle both schema objects and fallbacks
    from app.schemas.auth import SetupServiceIn

    if payload.services:
        svc_list = payload.services
    else:
        svc_list = [
            SetupServiceIn(code="EXT", name="Exterior Wash", base_price=80, duration_minutes=20),
            SetupServiceIn(code="INT", name="Interior Clean", base_price=100, duration_minutes=30),
            SetupServiceIn(code="FULL", name="Full Wash", base_price=160, duration_minutes=45),
            SetupServiceIn(code="DETAIL", name="Full Detail", base_price=450, duration_minutes=120),
            SetupServiceIn(code="WAX", name="Wax & Polish", base_price=200, duration_minutes=40),
            SetupServiceIn(code="ENGINE", name="Engine Bay Clean", base_price=120, duration_minutes=30, category="EXTRA"),
        ]

    for idx, s in enumerate(svc_list):
        db.add(
            Service(
                code=s.code.strip().upper(),
                name=s.name.strip(),
                category=getattr(s, "category", "WASH") or "WASH",
                base_price=Decimal(str(s.base_price)),
                duration_minutes=s.duration_minutes,
                tax_rate=Decimal(str(payload.company.tax_rate)),
                is_active=True,
                sort_order=idx,
                is_extra=(getattr(s, "category", "") or "").upper() == "EXTRA",
            )
        )

    set_setting(db, "company.name", payload.company.company_name)
    set_setting(db, "company.phone", payload.company.phone or "")
    set_setting(db, "company.email", payload.company.email or "")
    set_setting(db, "company.address", payload.company.address or "")
    set_setting(db, "locale.currency", payload.company.currency)
    set_setting(db, "locale.timezone", payload.company.timezone)
    set_setting(db, "locale.tax_rate", str(payload.company.tax_rate))
    set_setting(db, "setup.completed", "true")

    if payload.load_demo_data:
        seed_demo_data(db, branch_id=branch.id, admin_user_id=admin.id)

    audit(db, action="SETUP_COMPLETE", user_id=admin.id, username=admin.username, details="First-run setup completed")
    activity(db, action="setup", summary=f"Platform set up by {admin.full_name}", user_id=admin.id, actor_name=admin.full_name)
    db.commit()
    db.refresh(admin)
    return admin


class SetupServiceLike:
    def __init__(self, code, name, base_price, duration_minutes, category="WASH"):
        self.code = code
        self.name = name
        self.base_price = base_price
        self.duration_minutes = duration_minutes
        self.category = category
