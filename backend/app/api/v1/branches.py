"""Branches and wash bays."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.helpers import not_found
from app.core.database import get_db
from app.models import Branch, WashBay
from app.schemas.entities import BranchIn, BranchOut, WashBayIn, WashBayOut
from app.security.deps import AuthContext, CSRFUser, require_permission

router = APIRouter(tags=["branches"])


@router.get("/branches")
def list_branches(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage", "dashboard.view", "bookings.view"))):
    rows = db.query(Branch).filter(Branch.is_deleted.is_(False)).order_by(Branch.name).all()
    return {"items": [BranchOut.model_validate(b) for b in rows], "total": len(rows)}


@router.post("/branches", status_code=201)
def create_branch(payload: BranchIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage"))):
    b = Branch(**payload.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return BranchOut.model_validate(b)


@router.put("/branches/{branch_id}")
def update_branch(branch_id: int, payload: BranchIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage"))):
    b = db.get(Branch, branch_id)
    if not b or b.is_deleted:
        not_found()
    for k, v in payload.model_dump().items():
        setattr(b, k, v)
    db.commit()
    return BranchOut.model_validate(b)


@router.get("/wash-bays")
def list_bays(branch_id: int | None = None, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage", "queue.manage"))):
    q = db.query(WashBay).filter(WashBay.is_deleted.is_(False))
    if branch_id:
        q = q.filter(WashBay.branch_id == branch_id)
    rows = q.order_by(WashBay.bay_number).all()
    return {"items": [WashBayOut.model_validate(b) for b in rows], "total": len(rows)}


@router.post("/wash-bays", status_code=201)
def create_bay(payload: WashBayIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage"))):
    b = WashBay(**payload.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return WashBayOut.model_validate(b)
