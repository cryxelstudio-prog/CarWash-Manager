"""Branches and wash bays."""
from __future__ import annotations


from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Branch, WashBay
from app.schemas.entities import BayStatusUpdate, BranchIn, BranchOut, WashBayIn, WashBayOut
from app.security.deps import AuthContext, require_permission
from app.services.bays import bay_board, ensure_default_bays, next_bay_number, reorder_bays, set_bay_status, soft_delete_bay

router = APIRouter(tags=["branches"])


class BayReorderIn(BaseModel):
    items: list[dict] = Field(default_factory=list)  # [{id, bay_number}]


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
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("queue.manage", "branches.manage", "dashboard.view", "bookings.view")),
):
    ensure_default_bays(db)
    return bay_board(db, branch_id=branch_id, active_only=not include_inactive)


@router.get("/wash-bays")
def list_bays(
    branch_id: int | None = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("branches.manage", "queue.manage", "dashboard.view", "bookings.view")),
):
    ensure_default_bays(db)
    q = db.query(WashBay).filter(WashBay.is_deleted.is_(False))
    if branch_id:
        q = q.filter(WashBay.branch_id == branch_id)
    if active_only:
        q = q.filter(WashBay.is_active.is_(True))
    rows = q.order_by(WashBay.bay_number, WashBay.id).all()
    return {"items": [WashBayOut.model_validate(b) for b in rows], "total": len(rows)}


@router.post("/wash-bays", status_code=201)
def create_bay(payload: WashBayIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage"))):
    data = payload.model_dump()
    if not data.get("bay_number"):
        data["bay_number"] = next_bay_number(db, data["branch_id"])
    if not data.get("name"):
        data["name"] = f"Bay {data['bay_number']}"
    b = WashBay(**data)
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


@router.delete("/wash-bays/{bay_id}")
def delete_bay(bay_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage"))):
    try:
        soft_delete_bay(db, bay_id)
    except ValueError as e:
        not_found(str(e))
    return {"message": "Bay removed", "id": bay_id}


@router.post("/wash-bays/reorder")
def reorder_bay_list(payload: BayReorderIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("branches.manage"))):
    rows = reorder_bays(db, payload.items)
    return {"items": [WashBayOut.model_validate(b) for b in rows], "total": len(rows)}


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
