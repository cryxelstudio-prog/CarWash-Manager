"""Document number generators."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session


def next_number(db: Session, model, field_name: str, prefix: str) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    like = f"{prefix}-{today}-%"
    col = getattr(model, field_name)
    count = db.query(func.count()).select_from(model).filter(col.like(like)).scalar() or 0
    return f"{prefix}-{today}-{count + 1:04d}"
