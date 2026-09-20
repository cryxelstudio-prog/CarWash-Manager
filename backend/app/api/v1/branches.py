"""Branches and wash bays."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Branch, WashBay
from app.schemas.entities import BayStatusUpdate, BranchIn, BranchOut, WashBayIn, WashBayOut
from app.security.deps import AuthContext, require_permission
from app.services.bays import bay_board, ensure_default_bays, set_bay_status

router = APIRouter(tags=["branches"])


@router.get("/branches")
def list_branches(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage", "dashboard.view", "bookings.view"))):
    rows = db.query(Branch).filter(Branch.is_deleted.is_(False)).order_by(Branch.name).all()
    return {"items": [BranchOut.model_validate(b) for b in rows], "total": len(rows)}


@router.post("/branches", status_code=201)
def create_branch(payload: BranchIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage"))):
    b = Branch(**payload.model_dump())
    db.add(b)
    db.flush()
    # Seed Bay 1 + Bay 2 for every new branch
    for i in (1, 2):
        db.add(WashBay(branch_id=b.id, name=f"Bay {i}", bay_number=i, status="AVAILABLE", is_active=True))
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


@router.get("/wash-bays/board")
def wash_bay_board(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("queue.manage", "branches.manage", "dashboard.view", "bookings.view")),
):
    ensure_default_bays(db)
    return bay_board(db, branch_id=branch_id)


@router.get("/wash-bays")
def list_bays(branch_id: int | None = None, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage", "queue.manage", "dashboard.view", "bookings.view"))):
    ensure_default_bays(db)
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


@router.put("/wash-bays/{bay_id}")
def update_bay(bay_id: int, payload: WashBayIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage"))):
    b = db.get(WashBay, bay_id)
    if not b or b.is_deleted:
        not_found()
    for k, v in payload.model_dump().items():
        setattr(b, k, v)
    db.commit()
    return WashBayOut.model_validate(b)


@router.post("/wash-bays/{bay_id}/status")
def update_bay_status(bay_id: int, payload: BayStatusUpdate, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("queue.manage", "branches.manage"))):
    try:
        bay = set_bay_status(
            db,
            bay_id,
            status=payload.status,
            assigned_employee_id=payload.assigned_employee_id,
            notes=payload.notes,
            lock=payload.lock,
        )
    except ValueError as e:
        bad_request(str(e))
    return WashBayOut.model_validate(bay)
