"""Controlled staff invite links — no open public staff signup."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Role, StaffInvite, User
from app.security.deps import AuthContext, require_permission
from app.security.passwords import hash_password
from app.security.rate_limit import check_rate_limit, client_key
from app.services.audit import activity, audit
from app.services.bootstrap import setup_required

router = APIRouter(tags=["invites"])

# Roles that may never be granted via invite (except by super admin for super_admin itself — still blocked)
INVITE_BLOCKED_ROLES = {"customer", "custom"}
SUPER_ONLY_ROLES = {"super_admin"}


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _invite_row(inv: StaffInvite, *, include_url_base: str | None = None, raw_token: str | None = None) -> dict:
    status = inv.status
    out = {
        "id": inv.id,
        "role_id": inv.role_id,
        "role_name": inv.role.display_name if inv.role else None,
        "role_code": inv.role.name if inv.role else None,
        "branch_id": inv.branch_id,
        "branch_name": inv.branch.name if inv.branch else None,
        "created_by_id": inv.created_by_id,
        "created_by_name": inv.created_by.full_name if inv.created_by else None,
        "expires_at": inv.expires_at.isoformat() + "Z" if inv.expires_at else None,
        "used_at": inv.used_at.isoformat() + "Z" if inv.used_at else None,
        "used_by_user_id": inv.used_by_user_id,
        "revoked_at": inv.revoked_at.isoformat() + "Z" if inv.revoked_at else None,
        "note": inv.note,
        "status": status,
        "created_at": inv.created_at.isoformat() + "Z" if inv.created_at else None,
    }
    if raw_token and include_url_base:
        out["token"] = raw_token
        out["invite_url"] = f"{include_url_base.rstrip('/')}/invite/{raw_token}"
    return out


class InviteCreateIn(BaseModel):
    role_id: int
    branch_id: int | None = None
    expires_days: int = Field(default=7, ge=1, le=90)
    note: str | None = Field(default=None, max_length=255)


class InviteAcceptIn(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    email: str | None = None
    phone: str | None = None


@router.get("/invites")
def list_invites(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("users.manage", "admin.manage"))):
    rows = (
        db.query(StaffInvite)
        .options(
            joinedload(StaffInvite.role),
            joinedload(StaffInvite.branch),
            joinedload(StaffInvite.created_by),
        )
        .order_by(StaffInvite.created_at.desc())
        .limit(200)
        .all()
    )
    return {"items": [_invite_row(r) for r in rows]}


@router.post("/invites", status_code=201)
def create_invite(
    payload: InviteCreateIn,
    request: Request,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("users.manage", "admin.manage")),
):
    role = db.get(Role, payload.role_id)
    if not role:
        bad_request("Role not found")
    if role.name in INVITE_BLOCKED_ROLES:
        bad_request("Cannot invite that role")
    if role.name in SUPER_ONLY_ROLES and not (
        ctx.user.is_super_admin or (ctx.user.role and ctx.user.role.name in ("super_admin", "owner"))
    ):
        bad_request("Only Super Admin / Owner can invite Super Admin")

    raw = secrets.token_urlsafe(32)
    inv = StaffInvite(
        token_hash=_hash_token(raw),
        role_id=role.id,
        branch_id=payload.branch_id,
        created_by_id=ctx.user.id,
        expires_at=datetime.utcnow() + timedelta(days=int(payload.expires_days or 7)),
        note=(payload.note or "").strip() or None,
    )
    db.add(inv)
    db.flush()
    audit(
        db,
        action="STAFF_INVITE_CREATE",
        user_id=ctx.user.id,
        username=ctx.user.username,
        entity_type="staff_invite",
        entity_id=inv.id,
        details=f"role={role.name}",
    )
    db.commit()
    inv = (
        db.query(StaffInvite)
        .options(joinedload(StaffInvite.role), joinedload(StaffInvite.branch), joinedload(StaffInvite.created_by))
        .filter(StaffInvite.id == inv.id)
        .first()
    )
    try:
        base = str(request.base_url).rstrip("/")
    except Exception:  # noqa: BLE001
        base = ""
    return _invite_row(inv, include_url_base=base or None, raw_token=raw)


@router.post("/invites/{invite_id}/revoke")
def revoke_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("users.manage", "admin.manage")),
):
    inv = db.get(StaffInvite, invite_id)
    if not inv:
        not_found()
    if inv.used_at:
        bad_request("Invite already used")
    if inv.revoked_at:
        return {"message": "Already revoked", "id": inv.id, "status": "revoked"}
    inv.revoked_at = datetime.utcnow()
    audit(
        db,
        action="STAFF_INVITE_REVOKE",
        user_id=ctx.user.id,
        username=ctx.user.username,
        entity_type="staff_invite",
        entity_id=inv.id,
    )
    db.commit()
    return {"message": "Invite revoked", "id": inv.id, "status": "revoked"}


@router.get("/invites/token/{token}")
def peek_invite(token: str, db: Session = Depends(get_db)):
    """Public — show invite validity without consuming it."""
    if setup_required(db):
        bad_request("Setup required")
    th = _hash_token(token.strip())
    inv = (
        db.query(StaffInvite)
        .options(joinedload(StaffInvite.role), joinedload(StaffInvite.branch))
        .filter(StaffInvite.token_hash == th)
        .first()
    )
    if not inv:
        not_found("Invite not found")
    status = inv.status
    return {
        "valid": status == "pending",
        "status": status,
        "role_name": inv.role.display_name if inv.role else None,
        "role_code": inv.role.name if inv.role else None,
        "branch_name": inv.branch.name if inv.branch else None,
        "expires_at": inv.expires_at.isoformat() + "Z" if inv.expires_at else None,
    }


@router.post("/invites/accept", status_code=201)
def accept_invite(payload: InviteAcceptIn, request: Request, db: Session = Depends(get_db)):
    """Public — create staff account from a valid one-time invite."""
    if setup_required(db):
        bad_request("Setup required")
    if not check_rate_limit(client_key(request, "invite-accept"), limit=10, window_seconds=60):
        bad_request("Too many attempts — try again shortly")

    # Explicitly reject any attempt at open staff register without token
    token = (payload.token or "").strip()
    if not token:
        bad_request("Invite token required — staff cannot self-register without an invite")

    th = _hash_token(token)
    inv = (
        db.query(StaffInvite)
        .options(joinedload(StaffInvite.role))
        .filter(StaffInvite.token_hash == th)
        .first()
    )
    if not inv:
        not_found("Invite not found or invalid")
    if inv.status != "pending":
        bad_request(f"Invite is {inv.status}")

    role = inv.role or db.get(Role, inv.role_id)
    if not role or role.name in INVITE_BLOCKED_ROLES:
        bad_request("Invite role is invalid")

    username = payload.username.strip().lower()
    if len(username) < 2:
        bad_request("Username is required")
    if db.query(User).filter(User.username == username, User.is_deleted.is_(False)).first():
        bad_request("Username already exists")

    # Never create customer via staff invite path
    if role.name == "customer":
        bad_request("Invalid invite role")

    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        email=(payload.email or "").strip() or None,
        phone=(payload.phone or "").strip() or None,
        role_id=role.id,
        branch_id=inv.branch_id,
        is_active=True,
        is_super_admin=role.name == "super_admin",
        customer_id=None,
    )
    db.add(user)
    db.flush()
    inv.used_at = datetime.utcnow()
    inv.used_by_user_id = user.id
    audit(
        db,
        action="STAFF_INVITE_ACCEPT",
        user_id=user.id,
        username=username,
        entity_type="staff_invite",
        entity_id=inv.id,
        details=f"role={role.name}",
        ip_address=request.client.host if request.client else None,
    )
    activity(db, action="staff_invite_accept", summary=f"{user.full_name} joined via invite ({role.display_name})", user_id=user.id, actor_name=user.full_name)
    db.commit()
    return {
        "message": "Account created — you can sign in at /login",
        "username": username,
        "role_name": role.display_name,
        "user_id": user.id,
    }


@router.post("/staff/register")
def reject_open_staff_register():
    """Hard reject — no open public staff signup."""
    bad_request("Staff cannot self-register without an invite. Ask a manager for an invite link.")
