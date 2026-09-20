"""Services and packages API."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.helpers import bad_request, not_found
from app.core.database import get_db
from app.models import Package, PackageService, Service
from app.schemas.entities import PackageIn, PackageOut, ServiceIn, ServiceOut
from app.security.deps import AuthContext, CSRFUser, require_permission

router = APIRouter(tags=["services"])


@router.get("/services")
def list_services(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("services.view", "services.manage"))):
    rows = db.query(Service).filter(Service.is_deleted.is_(False)).order_by(Service.sort_order, Service.name).all()
    return {"items": [ServiceOut.model_validate(s) for s in rows], "total": len(rows)}


@router.post("/services", status_code=201)
def create_service(payload: ServiceIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("services.manage"))):
    if payload.base_price < 0:
        bad_request("Price cannot be negative")
    s = Service(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return ServiceOut.model_validate(s)


@router.put("/services/{service_id}")
def update_service(service_id: int, payload: ServiceIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("services.manage"))):
    s = db.get(Service, service_id)
    if not s or s.is_deleted:
        not_found()
    if payload.base_price < 0:
        bad_request("Price cannot be negative")
    for k, v in payload.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return ServiceOut.model_validate(s)


@router.delete("/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("services.manage"))):
    s = db.get(Service, service_id)
    if not s or s.is_deleted:
        not_found()
    s.is_deleted = True
    s.deleted_at = datetime.utcnow()
    s.is_active = False
    db.commit()
    return {"message": "Service archived"}


@router.get("/packages")
def list_packages(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("services.view", "services.manage"))):
    rows = db.query(Package).filter(Package.is_deleted.is_(False)).order_by(Package.sort_order, Package.name).all()
    items = []
    for p in rows:
        items.append(
            PackageOut(
                id=p.id,
                code=p.code,
                name=p.name,
                description=p.description,
                price=p.price,
                duration_minutes=p.duration_minutes,
                is_active=p.is_active,
                colour=p.colour,
                sort_order=p.sort_order,
                service_ids=[ps.service_id for ps in p.package_services],
            )
        )
    return {"items": items, "total": len(items)}


@router.post("/packages", status_code=201)
def create_package(payload: PackageIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("services.manage"))):
    if payload.price < 0:
        bad_request("Price cannot be negative")
    data = payload.model_dump()
    service_ids = data.pop("service_ids", [])
    p = Package(**data)
    db.add(p)
    db.flush()
    for sid in service_ids:
        db.add(PackageService(package_id=p.id, service_id=sid))
    db.commit()
    db.refresh(p)
    return PackageOut(
        id=p.id, code=p.code, name=p.name, description=p.description, price=p.price,
        duration_minutes=p.duration_minutes, is_active=p.is_active, colour=p.colour,
        sort_order=p.sort_order, service_ids=service_ids,
    )


@router.put("/packages/{package_id}")
def update_package(package_id: int, payload: PackageIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("services.manage"))):
    p = db.get(Package, package_id)
    if not p or p.is_deleted:
        not_found()
    data = payload.model_dump()
    service_ids = data.pop("service_ids", [])
    for k, v in data.items():
        setattr(p, k, v)
    db.query(PackageService).filter(PackageService.package_id == p.id).delete()
    for sid in service_ids:
        db.add(PackageService(package_id=p.id, service_id=sid))
    db.commit()
    return PackageOut(
        id=p.id, code=p.code, name=p.name, description=p.description, price=p.price,
        duration_minutes=p.duration_minutes, is_active=p.is_active, colour=p.colour,
        sort_order=p.sort_order, service_ids=service_ids,
    )
