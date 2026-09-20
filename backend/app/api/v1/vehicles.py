"""Vehicles API."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Customer, Vehicle
from app.schemas.entities import VehicleIn, VehicleOut
from app.security.deps import AuthContext, require_permission
from app.services.bootstrap import get_setting
from app.utils.vehicles import normalize_registration, vehicle_description

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _serialize(v: Vehicle) -> VehicleOut:
    data = VehicleOut.model_validate(v)
    data.description = vehicle_description(v)
    return data


@router.get("")
def list_vehicles(customer_id: int | None = None, q: str | None = None, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.view", "vehicles.manage"))):
    query = db.query(Vehicle).filter(Vehicle.is_deleted.is_(False))
    if customer_id:
        query = query.filter(Vehicle.customer_id == customer_id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Vehicle.registration.ilike(like))
            | (Vehicle.make.ilike(like))
            | (Vehicle.model.ilike(like))
            | (Vehicle.colour.ilike(like))
        )
    rows = query.order_by(Vehicle.make, Vehicle.model, Vehicle.id).limit(200).all()
    return {"items": [_serialize(v) for v in rows], "total": len(rows)}


@router.post("", status_code=201)
def create_vehicle(payload: VehicleIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.manage"))):
    cust = db.get(Customer, payload.customer_id)
    if not cust or cust.is_deleted:
        not_found("Customer not found")
    require_reg = (get_setting(db, "vehicles.require_registration", "false") or "false").lower() in ("1", "true", "yes")
    data = payload.model_dump()
    data["registration"] = normalize_registration(data.get("registration"))
    if require_reg and not data["registration"]:
        bad_request("Registration is required by workplace settings")
    if not (data.get("colour") and data.get("make") and data.get("model")):
        bad_request("Colour, make and model are required")
    v = Vehicle(**data)
    db.add(v)
    db.commit()
    db.refresh(v)
    return _serialize(v)


@router.get("/{vehicle_id}")
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.view", "vehicles.manage"))):
    v = db.get(Vehicle, vehicle_id)
    if not v or v.is_deleted:
        not_found()
    return _serialize(v)


@router.put("/{vehicle_id}")
def update_vehicle(vehicle_id: int, payload: VehicleIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("vehicles.manage"))):
    v = db.get(Vehicle, vehicle_id)
    if not v or v.is_deleted:
        not_found()
    require_reg = (get_setting(db, "vehicles.require_registration", "false") or "false").lower() in ("1", "true", "yes")
    data = payload.model_dump()
    data["registration"] = normalize_registration(data.get("registration"))
    if require_reg and not data["registration"]:
        bad_request("Registration is required by workplace settings")
    if not (data.get("colour") and data.get("make") and data.get("model")):
        bad_request("Colour, make and model are required")
    for k, val in data.items():
        setattr(v, k, val)
    db.commit()
    db.refresh(v)
    return _serialize(v)


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
