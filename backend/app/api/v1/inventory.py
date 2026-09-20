"""Inventory, suppliers, expenses."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Expense, InventoryItem, InventoryMovement, Supplier
from app.schemas.entities import ExpenseIn, ExpenseOut, InventoryItemIn, InventoryItemOut, SupplierIn, SupplierOut
from app.security.deps import AuthContext, CSRFUser, require_permission
from app.utils.numbering import next_number

router = APIRouter(tags=["inventory"])


@router.get("/inventory")
def list_inventory(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("inventory.view", "inventory.manage"))):
    rows = db.query(InventoryItem).filter(InventoryItem.is_deleted.is_(False)).order_by(InventoryItem.name).all()
    items = []
    for r in rows:
        d = InventoryItemIn.model_validate(r).model_dump()
        items.append(InventoryItemOut(id=r.id, is_low_stock=r.quantity_on_hand <= r.reorder_level, **d))
    return {"items": items, "total": len(items)}


@router.post("/inventory", status_code=201)
def create_item(payload: InventoryItemIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("inventory.manage"))):
    if payload.quantity_on_hand < 0 or payload.unit_cost < 0:
        bad_request("Stock and cost cannot be negative")
    item = InventoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return InventoryItemOut(id=item.id, is_low_stock=item.quantity_on_hand <= item.reorder_level, **payload.model_dump())


@router.put("/inventory/{item_id}")
def update_item(item_id: int, payload: InventoryItemIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("inventory.manage"))):
    item = db.get(InventoryItem, item_id)
    if not item or item.is_deleted:
        not_found()
    for k, v in payload.model_dump().items():
        setattr(item, k, v)
    db.commit()
    return InventoryItemOut(id=item.id, is_low_stock=item.quantity_on_hand <= item.reorder_level, **payload.model_dump())


@router.post("/inventory/{item_id}/adjust")
def adjust_stock(item_id: int, quantity: Decimal, movement_type: str = "ADJUST", notes: str | None = None, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("inventory.manage"))):
    item = db.get(InventoryItem, item_id)
    if not item or item.is_deleted:
        not_found()
    item.quantity_on_hand = Decimal(str(item.quantity_on_hand)) + Decimal(str(quantity))
    if item.quantity_on_hand < 0:
        bad_request("Stock cannot go negative")
    db.add(InventoryMovement(inventory_item_id=item.id, movement_type=movement_type, quantity=quantity, notes=notes, created_by_id=ctx.user.id))
    db.commit()
    return {"quantity_on_hand": item.quantity_on_hand}


@router.get("/suppliers")
def list_suppliers(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("suppliers.manage", "inventory.view"))):
    rows = db.query(Supplier).filter(Supplier.is_deleted.is_(False)).order_by(Supplier.name).all()
    return {"items": [SupplierOut.model_validate(s) for s in rows], "total": len(rows)}


@router.post("/suppliers", status_code=201)
def create_supplier(payload: SupplierIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("suppliers.manage"))):
    s = Supplier(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return SupplierOut.model_validate(s)


@router.put("/suppliers/{supplier_id}")
def update_supplier(supplier_id: int, payload: SupplierIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("suppliers.manage"))):
    s = db.get(Supplier, supplier_id)
    if not s or s.is_deleted:
        not_found()
    for k, v in payload.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return SupplierOut.model_validate(s)


@router.get("/expenses")
def list_expenses(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("expenses.manage"))):
    rows = db.query(Expense).filter(Expense.is_deleted.is_(False)).order_by(Expense.expense_date.desc()).limit(200).all()
    return {"items": [ExpenseOut.model_validate(e) for e in rows], "total": len(rows)}


@router.post("/expenses", status_code=201)
def create_expense(payload: ExpenseIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("expenses.manage"))):
    if payload.amount <= 0:
        bad_request("Amount must be positive")
    e = Expense(expense_number=next_number(db, Expense, "expense_number", "EXP"), created_by_id=ctx.user.id, **payload.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return ExpenseOut.model_validate(e)


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("expenses.manage"))):
    e = db.get(Expense, expense_id)
    if not e or e.is_deleted:
        not_found()
    e.is_deleted = True
    e.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Expense archived"}
