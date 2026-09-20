"""Signed session cookies + CSRF tokens."""
from __future__ import annotations

import secrets
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core.config import get_settings


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.secret_key, salt="carwash-session")


def create_session_token(user_id: int, csrf_token: str) -> str:
    return _serializer().dumps({"uid": user_id, "csrf": csrf_token})


def decode_session_token(token: str, max_age: int | None = None) -> dict | None:
    settings = get_settings()
    try:
        return _serializer().loads(token, max_age=max_age or settings.session_max_age)
    except (BadSignature, SignatureExpired):
        return None


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _portal_serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.secret_key, salt="carwash-portal-session")


def create_portal_session_token(user_id: int, csrf_token: str) -> str:
    return _portal_serializer().dumps({"uid": user_id, "csrf": csrf_token, "kind": "portal"})


def decode_portal_session_token(token: str, max_age: int | None = None) -> dict | None:
    settings = get_settings()
    try:
        data = _portal_serializer().loads(token, max_age=max_age or settings.session_max_age)
        if data.get("kind") != "portal":
            return None
        return data
    except (BadSignature, SignatureExpired):
        return None
