"""Customers API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Customer
from app.schemas.entities import CustomerIn, CustomerOut
from app.security.deps import AuthContext, CSRFUser, require_permission
from app.api.v1.helpers import bad_request, not_found
from app.utils.numbering import next_number
from app.services.audit import activity

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
def list_customers(
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("customers.view", "customers.manage")),
):
    query = db.query(Customer).filter(Customer.is_deleted.is_(False))
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Customer.first_name.ilike(like))
            | (Customer.last_name.ilike(like))
            | (Customer.phone.ilike(like))
            | (Customer.email.ilike(like))
            | (Customer.customer_number.ilike(like))
            | (Customer.company_name.ilike(like))
        )
    total = query.count()
    rows = query.order_by(Customer.last_name, Customer.first_name).offset((page - 1) * page_size).limit(page_size).all()
    items = [
        CustomerOut(
            id=c.id,
            customer_number=c.customer_number,
            first_name=c.first_name,
            last_name=c.last_name,
            phone=c.phone,
            email=c.email,
            phone_alt=c.phone_alt,
            company_name=c.company_name,
            address=c.address,
            city=c.city,
            notes=c.notes,
            tags=c.tags,
            employee_number=c.employee_number,
            preferred_branch_id=c.preferred_branch_id,
            marketing_opt_in=c.marketing_opt_in,
            is_active=c.is_active,
            full_name=c.full_name,
            created_at=c.created_at,
        )
        for c in rows
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=201)
def create_customer(payload: CustomerIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("customers.manage"))):
    c = Customer(
        customer_number=next_number(db, Customer, "customer_number", "CUS"),
        **payload.model_dump(),
    )
    db.add(c)
    activity(db, action="customer_create", summary=f"Customer {c.first_name} {c.last_name} created", user_id=ctx.user.id, actor_name=ctx.user.full_name)
    db.commit()
    db.refresh(c)
    return CustomerOut(id=c.id, customer_number=c.customer_number, full_name=c.full_name, created_at=c.created_at, **payload.model_dump())


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("customers.view", "customers.manage"))):
    c = db.get(Customer, customer_id)
    if not c or c.is_deleted:
        not_found("Customer not found")
    return CustomerOut(
        id=c.id,
        customer_number=c.customer_number,
        full_name=c.full_name,
        created_at=c.created_at,
        **CustomerIn.model_validate(c, from_attributes=True).model_dump(),
    )


@router.put("/{customer_id}")
def update_customer(customer_id: int, payload: CustomerIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("customers.manage"))):
    c = db.get(Customer, customer_id)
    if not c or c.is_deleted:
        not_found("Customer not found")
    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return CustomerOut(id=c.id, customer_number=c.customer_number, full_name=c.full_name, created_at=c.created_at, **payload.model_dump())


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("customers.manage"))):
    from datetime import datetime
    c = db.get(Customer, customer_id)
    if not c or c.is_deleted:
        not_found("Customer not found")
    c.is_deleted = True
    c.deleted_at = datetime.utcnow()
    c.is_active = False
    db.commit()
    return {"message": "Customer archived"}


@router.get("/{customer_id}/salary-balance")
def customer_salary_balance(
    customer_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permission("customers.view", "customers.manage", "payments.view")),
):
    """Outstanding salary-deduction amounts for this customer (walk-ins included)."""
    from app.services.payment_intent import outstanding_salary_for_customer, outstanding_salary_for_employee

    cust = db.get(Customer, customer_id)
    if not cust or cust.is_deleted:
        from app.api.v1.helpers import not_found
        not_found()
    by_customer = float(outstanding_salary_for_customer(db, customer_id))
    by_emp = 0.0
    if cust.employee_number:
        by_emp = float(outstanding_salary_for_employee(db, cust.employee_number))
    return {
        "customer_id": customer_id,
        "employee_number": cust.employee_number,
        "outstanding_by_customer": by_customer,
        "outstanding_by_employee_number": by_emp,
        "outstanding": max(by_customer, by_emp) if cust.employee_number else by_customer,
    }
