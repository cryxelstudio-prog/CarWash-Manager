"""Auth + first-run setup endpoints."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.database import get_db
from app.models import Role, RolePermission, User
from app.schemas.auth import LoginIn, MeUpdateIn, SessionOut, SetupCompleteIn, UserOut
from app.schemas.common import MessageOut
from app.security.deps import CSRFUser, OptionalUser, get_current_user_optional
from app.security.passwords import verify_password
from app.security.sessions import create_session_token, new_csrf_token
from app.services.audit import activity, audit
from app.services.bootstrap import setup_required
from app.services.setup import complete_setup

router = APIRouter(prefix="/auth", tags=["auth"])


def _role_key(user: User) -> str:
    return (user.role.name if user.role else "").lower()



def _resolve_easy_mode(user: User) -> bool | None:
    """Return stored preference (may be None = unset)."""
    return user.easy_mode


def _user_out(user: User) -> UserOut:
    perms: list[str] = []
    if user.is_super_admin:
        perms = ["*"]
    elif user.role:
        perms = [rp.permission.code for rp in user.role.permissions if rp.permission]
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role_id=user.role_id,
        role_name=user.role.display_name if user.role else None,
        branch_id=user.branch_id,
        is_super_admin=user.is_super_admin,
        theme=user.theme,
        easy_mode=_resolve_easy_mode(user),
        permissions=perms,
    )


def _apply_easy_mode_on_login(user: User, requested: bool | None) -> None:
    """Persist easy_mode from login checkbox, or seed staff defaults once."""
    if requested is not None:
        user.easy_mode = bool(requested)
        return
    if user.easy_mode is None:
        role = _role_key(user)
        # Only auto-seed Easy for frontline roles. Managers/owners stay None
        # until they explicitly choose — never lock them into Full Mode.
        if role in ("reception", "operator", "washer", "staff"):
            user.easy_mode = True


@router.get("/status")
def auth_status(db: Session = Depends(get_db), ctx=Depends(get_current_user_optional)):
    return {
        "setup_required": setup_required(db),
        "authenticated": ctx is not None,
        "user": _user_out(ctx.user) if ctx else None,
        "csrf_token": ctx.csrf if ctx else None,
    }


@router.post("/setup", response_model=SessionOut)
def setup(payload: SetupCompleteIn, response: Response, db: Session = Depends(get_db)):
    try:
        admin = complete_setup(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    # reload with role
    user = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions).joinedload(RolePermission.permission))
        .filter(User.id == admin.id)
        .first()
    )
    csrf = new_csrf_token()
    token = create_session_token(user.id, csrf)
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_max_age,
        path="/",
    )
    return SessionOut(user=_user_out(user), csrf_token=csrf, setup_required=False)


@router.post("/login", response_model=SessionOut)
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    if setup_required(db):
        raise HTTPException(status_code=400, detail="Setup required")
    user = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions).joinedload(RolePermission.permission))
        .filter(User.username == payload.username.strip().lower(), User.is_deleted.is_(False))
        .first()
    )
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        audit(db, action="LOGIN_FAILED", username=payload.username, details="Invalid credentials", ip_address=request.client.host if request.client else None)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid username or password")
    user.last_login_at = datetime.utcnow()
    _apply_easy_mode_on_login(user, payload.easy_mode)
    csrf = new_csrf_token()
    token = create_session_token(user.id, csrf)
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_max_age,
        path="/",
    )
    audit(db, action="LOGIN", user_id=user.id, username=user.username, ip_address=request.client.host if request.client else None)
    activity(db, action="login", summary=f"{user.full_name} signed in", user_id=user.id, actor_name=user.full_name)
    db.commit()
    return SessionOut(user=_user_out(user), csrf_token=csrf, setup_required=False)


@router.post("/logout", response_model=MessageOut)
def logout(response: Response, ctx: OptionalUser = None):
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    return MessageOut(message="Logged out")


@router.get("/me", response_model=SessionOut)
def me(ctx: CSRFUser):
    return SessionOut(user=_user_out(ctx.user), csrf_token=ctx.csrf)


@router.patch("/me", response_model=SessionOut)
def update_me(payload: MeUpdateIn, ctx: CSRFUser, db: Session = Depends(get_db)):
    """Update per-user preferences (easy_mode, theme). Available to every role."""
    user = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions).joinedload(RolePermission.permission))
        .filter(User.id == ctx.user.id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.easy_mode is not None:
        user.easy_mode = bool(payload.easy_mode)
    if payload.theme is not None:
        theme = payload.theme.strip().lower()
        if theme not in ("light", "dark", "system"):
            raise HTTPException(status_code=400, detail="theme must be light, dark, or system")
        user.theme = theme
    db.commit()
    db.refresh(user)
    return SessionOut(user=_user_out(user), csrf_token=ctx.csrf)
