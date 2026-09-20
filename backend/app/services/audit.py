"""Audit and activity logging."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Activity, AuditLog


def audit(
    db: Session,
    *,
    action: str,
    user_id: int | None = None,
    username: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: str | None = None,
    ip_address: str | None = None,
) -> None:
    db.add(
        AuditLog(
            action=action,
            user_id=user_id,
            username=username,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            details=details,
            ip_address=ip_address,
        )
    )


def activity(
    db: Session,
    *,
    action: str,
    summary: str,
    user_id: int | None = None,
    actor_name: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    meta: dict | None = None,
) -> None:
    db.add(
        Activity(
            action=action,
            summary=summary,
            user_id=user_id,
            actor_name=actor_name,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            meta=meta,
        )
    )
