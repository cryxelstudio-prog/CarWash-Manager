"""Employees and attendance."""
from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.helpers import not_found
from app.core.database import get_db
from app.models import Attendance, Employee
from app.schemas.entities import AttendanceIn, AttendanceOut, EmployeeIn, EmployeeOut
from app.security.deps import AuthContext, CSRFUser, require_permission

router = APIRouter(tags=["employees"])


@router.get("/employees")
def list_employees(db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("employees.view", "employees.manage"))):
    rows = db.query(Employee).filter(Employee.is_deleted.is_(False)).order_by(Employee.last_name).all()
    return {"items": [EmployeeOut(id=e.id, full_name=e.full_name, **EmployeeIn.model_validate(e).model_dump()) for e in rows], "total": len(rows)}


@router.post("/employees", status_code=201)
def create_employee(payload: EmployeeIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("employees.manage"))):
    e = Employee(**payload.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return EmployeeOut(id=e.id, full_name=e.full_name, **payload.model_dump())


@router.put("/employees/{employee_id}")
def update_employee(employee_id: int, payload: EmployeeIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("employees.manage"))):
    e = db.get(Employee, employee_id)
    if not e or e.is_deleted:
        not_found()
    for k, v in payload.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return EmployeeOut(id=e.id, full_name=e.full_name, **payload.model_dump())


@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("employees.manage"))):
    e = db.get(Employee, employee_id)
    if not e or e.is_deleted:
        not_found()
    e.is_deleted = True
    e.deleted_at = datetime.utcnow()
    e.is_active = False
    db.commit()
    return {"message": "Employee archived"}


@router.get("/attendance")
def list_attendance(work_date: date | None = None, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("attendance.manage", "employees.view"))):
    q = db.query(Attendance)
    if work_date:
        q = q.filter(Attendance.work_date == work_date)
    else:
        q = q.filter(Attendance.work_date == date.today())
    rows = q.order_by(Attendance.clock_in.desc()).all()
    items = []
    for a in rows:
        emp = db.get(Employee, a.employee_id)
        items.append(
            AttendanceOut(
                id=a.id,
                employee_id=a.employee_id,
                branch_id=a.branch_id,
                work_date=a.work_date,
                clock_in=a.clock_in,
                clock_out=a.clock_out,
                break_minutes=a.break_minutes,
                status=a.status,
                notes=a.notes,
                employee_name=emp.full_name if emp else None,
            )
        )
    return {"items": items, "total": len(items)}


@router.post("/attendance", status_code=201)
def create_attendance(payload: AttendanceIn, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("attendance.manage"))):
    a = Attendance(**payload.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    emp = db.get(Employee, a.employee_id)
    return AttendanceOut(id=a.id, employee_name=emp.full_name if emp else None, **payload.model_dump())


@router.post("/attendance/{attendance_id}/clock-out")
def clock_out(attendance_id: int, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("attendance.manage"))):
    a = db.get(Attendance, attendance_id)
    if not a:
        not_found()
    a.clock_out = datetime.utcnow()
    db.commit()
    return {"message": "Clocked out", "clock_out": a.clock_out}
