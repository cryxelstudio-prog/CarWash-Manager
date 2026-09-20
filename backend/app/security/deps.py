"""FastAPI dependencies for auth and RBAC."""
from __future__ import annotations

from typing import Annotated, Callable

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.database import get_db
from app.models import Role, RolePermission, User
from app.security.sessions import decode_session_token


class AuthContext:
    def __init__(self, user: User, csrf: str):
        self.user = user
        self.csrf = csrf
        self._perm_codes: set[str] | None = None

    @property
    def permissions(self) -> set[str]:
        if self._perm_codes is None:
            codes: set[str] = set()
            if self.user.is_super_admin:
                codes.add("*")
            elif self.user.role:
                for rp in self.user.role.permissions:
                    if rp.permission:
                        codes.add(rp.permission.code)
            self._perm_codes = codes
        return self._perm_codes

    def has(self, code: str) -> bool:
        if "*" in self.permissions:
            return True
        return code in self.permissions


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> AuthContext | None:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    data = decode_session_token(token)
    if not data:
        return None
    user = (
        db.query(User)
        .options(
            joinedload(User.role)
            .joinedload(Role.permissions)
            .joinedload(RolePermission.permission)
        )
        .filter(User.id == data["uid"], User.is_active.is_(True), User.is_deleted.is_(False))
        .first()
    )
    if not user:
        return None
    return AuthContext(user=user, csrf=data.get("csrf", ""))


def get_current_user(ctx: AuthContext | None = Depends(get_current_user_optional)) -> AuthContext:
    if not ctx:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return ctx


def require_csrf(
    request: Request,
    ctx: AuthContext = Depends(get_current_user),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> AuthContext:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return ctx
    token = x_csrf_token or request.headers.get("X-CSRF-Token")
    if not token or token != ctx.csrf:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")
    return ctx


def require_permission(*codes: str) -> Callable:
    def _dep(ctx: AuthContext = Depends(require_csrf)) -> AuthContext:
        if "*" in ctx.permissions:
            return ctx
        if not any(ctx.has(c) for c in codes):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        return ctx

    return _dep


CurrentUser = Annotated[AuthContext, Depends(get_current_user)]
OptionalUser = Annotated[AuthContext | None, Depends(get_current_user_optional)]
CSRFUser = Annotated[AuthContext, Depends(require_csrf)]
