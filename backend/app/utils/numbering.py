"""Document number generators."""
from __future__ import annotations

from datetime import datetime
import re

from sqlalchemy import func
from sqlalchemy.orm import Session


def next_number(db: Session, model, field_name: str, prefix: str) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    like = f"{prefix}-{today}-%"
    col = getattr(model, field_name)
    count = db.query(func.count()).select_from(model).filter(col.like(like)).scalar() or 0
    return f"{prefix}-{today}-{count + 1:04d}"


def next_ticket_number(db: Session, model, field_name: str = "ticket_number") -> str:
    """Wash ticket / claim number: T-0001, T-0002, … (primary staff identifier)."""
    col = getattr(model, field_name)
    rows = db.query(col).filter(col.isnot(None), col.like("T-%")).all()
    max_n = 0
    for (val,) in rows:
        if not val:
            continue
        m = re.match(r"^T-(\d+)$", str(val).strip(), re.IGNORECASE)
        if m:
            max_n = max(max_n, int(m.group(1)))
    return f"T-{max_n + 1:04d}"
