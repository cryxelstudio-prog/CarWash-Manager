"""Customer self-service portal — register, login, profile, quick book."""
from __future__ import annotations

from datetime import date, datetime, time
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.api.v1.helpers import bad_request
from app.core.config import get_settings
from app.core.database import get_db
from app.models import Booking, Branch, Customer, Package, Role, Service, User, Vehicle
from app.models.models import BookingSource
from app.schemas.common import MessageOut
from app.schemas.entities import QuickBookIn
from app.security.deps import OptionalPortal, PortalCSRF
from app.security.passwords import hash_password, verify_password
from app.security.rate_limit import check_rate_limit, client_key
from app.security.sessions import create_portal_session_token, new_csrf_token
from app.services.audit import activity, audit
from app.services.bookings import quick_book, serialize_booking
from app.services.bootstrap import setup_required
from app.utils.numbering import next_number

router = APIRouter(prefix="/portal", tags=["portal"])


class PortalRegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    phone: str = Field(min_length=7, max_length=32)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class PortalLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class PortalBookIn(BaseModel):
    branch_id: int
    service_id: int | None = None
    package_id: int | None = None
    scheduled_date: date
    scheduled_time: time | None = None
    vehicle_type: str = "SEDAN"
    colour: str | None = None
    make: str | None = None
    model: str | None = None
    registration: str | None = None
    vehicle_id: int | None = None
    notes: str | None = None
    payment_method_intent: str = "cash"


def _split_name(name: str) -> tuple[str, str]:
    parts = name.strip().split(None, 1)
    first = parts[0]
    last = parts[1] if len(parts) > 1 else "."
    return first, last


def _customer_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == "customer").first()
    if not role:
        role = Role(name="customer", display_name="Customer", is_system=True, description="Customer portal")
        db.add(role)
        db.flush()
    return role


def _set_portal_cookie(response: Response, user_id: int, csrf: str) -> None:
    settings = get_settings()
    token = create_portal_session_token(user_id, csrf)
    response.set_cookie(
        key=settings.portal_session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_max_age,
        path="/",
    )


def _portal_user_payload(user: User, customer: Customer | None = None) -> dict:
    cust = customer or user.customer
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "customer_id": user.customer_id,
        "role": "customer",
        "customer": {
            "id": cust.id,
            "customer_number": cust.customer_number,
            "first_name": cust.first_name,
            "last_name": cust.last_name,
            "phone": cust.phone,
            "email": cust.email,
        }
        if cust
        else None,
    }


@router.post("/register")
def portal_register(payload: PortalRegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    if setup_required(db):
        raise HTTPException(status_code=400, detail="Setup required — ask the car wash to finish first-run setup")
    if not check_rate_limit(client_key(request, "portal-register"), limit=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many registration attempts — try again shortly")

    email = payload.email.strip().lower()
    phone = payload.phone.strip()
    name = payload.name.strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        bad_request("Enter a valid email address")
    if len(payload.password) < 6:
        bad_request("Password must be at least 6 characters")

    # Email uniqueness among portal users
    existing = (
        db.query(User)
        .filter(User.is_deleted.is_(False), User.username == email)
        .first()
    )
    if existing:
        bad_request("An account with this email already exists — please sign in")

    # Reuse customer by phone if present, else create
    customer = (
        db.query(Customer)
        .filter(Customer.is_deleted.is_(False), Customer.phone == phone)
        .first()
    )
    first, last = _split_name(name)
    if customer:
        # Already linked to a portal user?
        linked = db.query(User).filter(User.customer_id == customer.id, User.is_deleted.is_(False)).first()
        if linked:
            bad_request("This phone already has a portal account — please sign in")
        if not customer.email:
            customer.email = email
        if customer.first_name in (".", "") or customer.last_name in (".", ""):
            customer.first_name = first
            customer.last_name = last
    else:
        customer = Customer(
            customer_number=next_number(db, Customer, "customer_number", "CUS"),
            first_name=first,
            last_name=last,
            phone=phone,
            email=email,
            is_active=True,
        )
        db.add(customer)
        db.flush()

    role = _customer_role(db)
    user = User(
        username=email,
        email=email,
        password_hash=hash_password(payload.password),
        full_name=name,
        phone=phone,
        role_id=role.id,
        customer_id=customer.id,
        is_active=True,
        is_super_admin=False,
        easy_mode=True,
    )
    db.add(user)
    db.flush()
    csrf = new_csrf_token()
    _set_portal_cookie(response, user.id, csrf)
    audit(db, action="PORTAL_REGISTER", user_id=user.id, username=email, details=f"customer_id={customer.id}", ip_address=request.client.host if request.client else None)
    activity(db, action="portal_register", summary=f"Customer {name} signed up via portal", user_id=user.id, actor_name=name)
    db.commit()
    db.refresh(user)
    return {"user": _portal_user_payload(user, customer), "csrf_token": csrf}


@router.post("/login")
def portal_login(payload: PortalLoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    if setup_required(db):
        raise HTTPException(status_code=400, detail="Setup required")
    if not check_rate_limit(client_key(request, "portal-login"), limit=20, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many login attempts — try again shortly")

    email = payload.email.strip().lower()
    user = (
        db.query(User)
        .options(joinedload(User.role), joinedload(User.customer))
        .filter(User.username == email, User.is_deleted.is_(False))
        .first()
    )
    if (
        not user
        or not user.is_active
        or not (user.customer_id or (user.role and user.role.name == "customer"))
        or not verify_password(payload.password, user.password_hash)
    ):
        audit(db, action="PORTAL_LOGIN_FAILED", username=email, details="Invalid credentials", ip_address=request.client.host if request.client else None)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login_at = datetime.utcnow()
    csrf = new_csrf_token()
    _set_portal_cookie(response, user.id, csrf)
    audit(db, action="PORTAL_LOGIN", user_id=user.id, username=user.username, ip_address=request.client.host if request.client else None)
    db.commit()
    return {"user": _portal_user_payload(user), "csrf_token": csrf}


@router.post("/logout", response_model=MessageOut)
def portal_logout(response: Response):
    settings = get_settings()
    response.delete_cookie(settings.portal_session_cookie_name, path="/")
    return MessageOut(message="Logged out")


@router.get("/me")
def portal_me(ctx: OptionalPortal, db: Session = Depends(get_db)):
    if not ctx:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = (
        db.query(User)
        .options(joinedload(User.customer))
        .filter(User.id == ctx.user.id)
        .first()
    )
    customer = user.customer if user else None
    vehicles = []
    bookings = []
    if customer:
        vehicles = (
            db.query(Vehicle)
            .filter(Vehicle.customer_id == customer.id, Vehicle.is_deleted.is_(False), Vehicle.is_active.is_(True))
            .order_by(Vehicle.id.desc())
            .all()
        )
        rows = (
            db.query(Booking)
            .options(
                joinedload(Booking.service),
                joinedload(Booking.package),
                joinedload(Booking.vehicle),
                joinedload(Booking.branch),
                joinedload(Booking.wash_bay),
            )
            .filter(Booking.customer_id == customer.id, Booking.is_deleted.is_(False))
            .order_by(Booking.scheduled_date.desc(), Booking.id.desc())
            .limit(50)
            .all()
        )
        bookings = [serialize_booking(b) for b in rows]
    return {
        "user": _portal_user_payload(user, customer),
        "csrf_token": ctx.csrf,
        "vehicles": [
            {
                "id": v.id,
                "colour": v.colour,
                "make": v.make,
                "model": v.model,
                "size": v.size,
                "registration": v.registration,
                "description": v.description,
            }
            for v in vehicles
        ],
        "bookings": bookings,
    }


@router.get("/catalog")
def portal_catalog(db: Session = Depends(get_db)):
    """Public-ish catalog for booking forms (no staff secrets)."""
    if setup_required(db):
        raise HTTPException(status_code=400, detail="Setup required")
    branches = (
        db.query(Branch)
        .filter(Branch.is_deleted.is_(False), Branch.is_active.is_(True))
        .order_by(Branch.name)
        .all()
    )
    services = (
        db.query(Service)
        .filter(Service.is_deleted.is_(False), Service.is_active.is_(True))
        .order_by(Service.sort_order, Service.name)
        .all()
    )
    packages = (
        db.query(Package)
        .filter(Package.is_deleted.is_(False), Package.is_active.is_(True))
        .order_by(Package.name)
        .all()
    )
    return {
        "branches": [{"id": b.id, "name": b.name, "code": b.code, "city": b.city} for b in branches],
        "services": [
            {
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "base_price": float(s.base_price or 0),
                "duration_minutes": s.duration_minutes,
                "category": s.category,
            }
            for s in services
        ],
        "packages": [
            {
                "id": p.id,
                "name": p.name,
                "code": p.code,
                "price": float(p.price or 0),
                "duration_minutes": getattr(p, "duration_minutes", None),
            }
            for p in packages
        ],
    }


@router.post("/bookings", status_code=201)
def portal_book(payload: PortalBookIn, ctx: PortalCSRF, db: Session = Depends(get_db)):
    user = ctx.user
    if not user.customer_id:
        bad_request("Portal account is not linked to a customer record")
    customer = db.get(Customer, user.customer_id)
    if not customer or customer.is_deleted:
        bad_request("Customer record missing")

    if not payload.service_id and not payload.package_id:
        bad_request("Select a service or package")

    colour = (payload.colour or "").strip() or None
    make = (payload.make or "").strip() or None
    model = (payload.model or "").strip() or None

    vehicle_id = payload.vehicle_id
    if vehicle_id:
        v = db.get(Vehicle, vehicle_id)
        if not v or v.customer_id != customer.id or v.is_deleted:
            bad_request("Vehicle not found")
        colour = colour or v.colour
        make = make or v.make
        model = model or v.model

    if not colour or not make or not model:
        bad_request("Vehicle colour, make and model are required")

    qb = QuickBookIn(
        branch_id=payload.branch_id,
        vehicle_type=payload.vehicle_type or "SEDAN",
        service_id=payload.service_id,
        package_id=payload.package_id,
        scheduled_date=payload.scheduled_date,
        scheduled_time=payload.scheduled_time,
        customer_id=customer.id,
        customer_name=customer.full_name,
        customer_phone=customer.phone,
        customer_email=customer.email or user.email,
        colour=colour,
        make=make,
        model=model,
        registration=payload.registration,
        notes=payload.notes,
        source=BookingSource.PORTAL.value,
        payment_method_intent=payload.payment_method_intent or "cash",
    )
    try:
        b = quick_book(db, qb, user_id=user.id, username=user.username)
    except ValueError as e:
        bad_request(str(e))
    return serialize_booking(b)
