"""Vehicles API."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.helpers import not_found
from app.core.database import get_db
from app.models import Customer, Vehicle
from app.schemas.entities import VehicleIn, VehicleOut
from app.security.deps import AuthContext, CSRFUser, require_permission

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("")
def list_vehicles(customer_id: int | None = None, q: str | None = None, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.view", "vehicles.manage"))):
    query = db.query(Vehicle).filter(Vehicle.is_deleted.is_(False))
    if customer_id:
        query = query.filter(Vehicle.customer_id == customer_id)
    if q:
        like = f"%{q}%"
        query = query.filter((Vehicle.registration.ilike(like)) | (Vehicle.make.ilike(like)) | (Vehicle.model.ilike(like)))
    rows = query.order_by(Vehicle.registration).limit(200).all()
    return {"items": [VehicleOut.model_validate(v) for v in rows], "total": len(rows)}


@router.post("", status_code=201)
def create_vehicle(payload: VehicleIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.manage"))):
    cust = db.get(Customer, payload.customer_id)
    if not cust or cust.is_deleted:
        not_found("Customer not found")
    v = Vehicle(**payload.model_dump())
    v.registration = v.registration.strip().upper()
    db.add(v)
    db.commit()
    db.refresh(v)
    return VehicleOut.model_validate(v)


@router.get("/{vehicle_id}")
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.view", "vehicles.manage"))):
    v = db.get(Vehicle, vehicle_id)
    if not v or v.is_deleted:
        not_found()
    return VehicleOut.model_validate(v)


@router.put("/{vehicle_id}")
def update_vehicle(vehicle_id: int, payload: VehicleIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.manage"))):
    v = db.get(Vehicle, vehicle_id)
    if not v or v.is_deleted:
        not_found()
    for k, val in payload.model_dump().items():
        setattr(v, k, val)
    v.registration = v.registration.strip().upper()
    db.commit()
    db.refresh(v)
    return VehicleOut.model_validate(v)


@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.manage"))):
    v = db.get(Vehicle, vehicle_id)
    if not v or v.is_deleted:
        not_found()
    v.is_deleted = True
    v.deleted_at = datetime.utcnow()
    v.is_active = False
    db.commit()
    return {"message": "Vehicle archived"}
