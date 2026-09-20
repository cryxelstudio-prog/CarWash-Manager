"""Entity schemas for CRUD APIs."""
from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class BranchIn(BaseModel):
    code: str
    name: str
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    email: str | None = None
    timezone: str = "Africa/Johannesburg"
    is_active: bool = True
    is_head_office: bool = False
    notes: str | None = None


class BranchOut(BranchIn):
    model_config = {"from_attributes": True}
    id: int
    created_at: datetime | None = None


class CustomerIn(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: str | None = None
    phone_alt: str | None = None
    company_name: str | None = None
    address: str | None = None
    city: str | None = None
    notes: str | None = None
    tags: str | None = None
    preferred_branch_id: int | None = None
    marketing_opt_in: bool = False
    is_active: bool = True


class CustomerOut(CustomerIn):
    model_config = {"from_attributes": True}
    id: int
    customer_number: str
    full_name: str | None = None
    created_at: datetime | None = None


class VehicleIn(BaseModel):
    customer_id: int
    registration: str
    make: str | None = None
    model: str | None = None
    colour: str | None = None
    year: int | None = None
    size: str = "SEDAN"
    vin: str | None = None
    notes: str | None = None
    is_active: bool = True


class VehicleOut(VehicleIn):
    model_config = {"from_attributes": True}
    id: int
    created_at: datetime | None = None


class ServiceIn(BaseModel):
    code: str
    name: str
    category: str = "WASH"
    description: str | None = None
    base_price: Decimal = Decimal("0")
    duration_minutes: int = 30
    tax_rate: Decimal = Decimal("15.00")
    is_active: bool = True
    is_extra: bool = False
    colour: str | None = None
    sort_order: int = 0


class ServiceOut(ServiceIn):
    model_config = {"from_attributes": True}
    id: int


class PackageIn(BaseModel):
    code: str
    name: str
    description: str | None = None
    price: Decimal = Decimal("0")
    duration_minutes: int = 60
    is_active: bool = True
    colour: str | None = None
    service_ids: list[int] = []
    sort_order: int = 0


class PackageOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    code: str
    name: str
    description: str | None = None
    price: Decimal
    duration_minutes: int
    is_active: bool
    colour: str | None = None
    sort_order: int = 0
    service_ids: list[int] = []


class BookingIn(BaseModel):
    customer_id: int
    vehicle_id: int
    branch_id: int
    service_id: int | None = None
    package_id: int | None = None
    assigned_employee_id: int | None = None
    wash_bay_id: int | None = None
    scheduled_date: date
    scheduled_time: time | None = None
    duration_minutes: int = 30
    source: str = "WALK_IN"
    priority: int = 0
    notes: str | None = None
    internal_notes: str | None = None
    special_instructions: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    discount_amount: Decimal = Decimal("0")
    extras: list[dict[str, Any]] = []


class BookingOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    booking_number: str
    customer_id: int
    vehicle_id: int
    branch_id: int
    service_id: int | None = None
    package_id: int | None = None
    assigned_employee_id: int | None = None
    wash_bay_id: int | None = None
    scheduled_date: date
    scheduled_time: time | None = None
    duration_minutes: int
    status: str
    wash_stage: str
    source: str
    priority: int
    notes: str | None = None
    internal_notes: str | None = None
    special_instructions: str | None = None
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    payment_status: str
    customer_phone: str | None = None
    customer_email: str | None = None
    arrived_at: datetime | None = None
    checked_in_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    collected_at: datetime | None = None
    created_at: datetime | None = None
    # nested display
    customer_name: str | None = None
    vehicle_registration: str | None = None
    vehicle_make_model: str | None = None
    service_name: str | None = None
    package_name: str | None = None
    branch_name: str | None = None
    assignee_name: str | None = None


class StageMoveIn(BaseModel):
    to_stage: str
    notes: str | None = None
    employee_id: int | None = None
    wash_bay_id: int | None = None


class PaymentIn(BaseModel):
    booking_id: int | None = None
    invoice_id: int | None = None
    customer_id: int | None = None
    branch_id: int | None = None
    amount: Decimal = Field(gt=0)
    method: str = "CASH"
    reference: str | None = None
    notes: str | None = None


class PaymentOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    payment_number: str
    booking_id: int | None = None
    invoice_id: int | None = None
    customer_id: int | None = None
    branch_id: int | None = None
    amount: Decimal
    method: str
    status: str
    reference: str | None = None
    notes: str | None = None
    paid_at: datetime | None = None


class EmployeeIn(BaseModel):
    employee_number: str
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    job_title: str | None = None
    department: str | None = None
    branch_id: int | None = None
    hire_date: date | None = None
    is_active: bool = True
    can_operate: bool = True
    hourly_rate: Decimal | None = None
    notes: str | None = None


class EmployeeOut(EmployeeIn):
    model_config = {"from_attributes": True}
    id: int
    full_name: str | None = None


class AttendanceIn(BaseModel):
    employee_id: int
    branch_id: int | None = None
    work_date: date
    clock_in: datetime | None = None
    clock_out: datetime | None = None
    break_minutes: int = 0
    status: str = "PRESENT"
    notes: str | None = None


class AttendanceOut(AttendanceIn):
    model_config = {"from_attributes": True}
    id: int
    employee_name: str | None = None


class ExpenseIn(BaseModel):
    branch_id: int | None = None
    category: str = "GENERAL"
    description: str
    amount: Decimal = Field(gt=0)
    expense_date: date
    payment_method: str = "CASH"
    supplier_id: int | None = None
    receipt_ref: str | None = None
    notes: str | None = None


class ExpenseOut(ExpenseIn):
    model_config = {"from_attributes": True}
    id: int
    expense_number: str


class SupplierIn(BaseModel):
    code: str
    name: str
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool = True


class SupplierOut(SupplierIn):
    model_config = {"from_attributes": True}
    id: int


class InventoryItemIn(BaseModel):
    sku: str
    name: str
    category: str = "CONSUMABLE"
    unit: str = "unit"
    quantity_on_hand: Decimal = Decimal("0")
    reorder_level: Decimal = Decimal("0")
    unit_cost: Decimal = Decimal("0")
    supplier_id: int | None = None
    branch_id: int | None = None
    is_active: bool = True
    notes: str | None = None


class InventoryItemOut(InventoryItemIn):
    model_config = {"from_attributes": True}
    id: int
    is_low_stock: bool = False


class WashBayIn(BaseModel):
    branch_id: int
    name: str = "Bay"
    bay_number: int = 0
    bay_type: str = "STANDARD"
    status: str = "AVAILABLE"
    status_locked: bool = False
    assigned_employee_id: int | None = None
    is_active: bool = True
    notes: str | None = None


class WashBayOut(WashBayIn):
    model_config = {"from_attributes": True}
    id: int


class BayStatusUpdate(BaseModel):
    status: str
    assigned_employee_id: int | None = None
    notes: str | None = None
    lock: bool | None = None


class QuickBookIn(BaseModel):
    branch_id: int
    vehicle_type: str = "SEDAN"
    service_id: int | None = None
    package_id: int | None = None
    scheduled_date: date
    scheduled_time: time | None = None
    customer_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    registration: str | None = None
    wash_bay_id: int | None = None  # None / omit = Any
    notes: str | None = None
    source: str = "WALK_IN"


class CashUpIn(BaseModel):
    branch_id: int
    cash_up_date: date
    opening_float: Decimal = Decimal("0")
    counted_cash: Decimal = Decimal("0")
    notes: str | None = None


class CashUpOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    branch_id: int
    cash_up_date: date
    opening_float: Decimal
    expected_cash: Decimal
    counted_cash: Decimal
    card_total: Decimal
    eft_total: Decimal
    other_total: Decimal
    variance: Decimal
    status: str
    manager_signed_off: bool
    notes: str | None = None


class InspectionIn(BaseModel):
    booking_id: int
    vehicle_id: int
    employee_id: int | None = None
    scratches: str | None = None
    dents: str | None = None
    cracks: str | None = None
    wheels: str | None = None
    interior: str | None = None
    valuables: str | None = None
    other_notes: str | None = None
    customer_acknowledged: bool = False


class NotificationOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    title: str
    body: str
    category: str
    is_read: bool
    link: str | None = None
    created_at: datetime | None = None


class SettingIn(BaseModel):
    key: str
    value: str | None = None
    value_type: str = "string"
    category: str = "general"
    description: str | None = None


class IntegrationOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    code: str
    name: str
    category: str
    status: str
    is_enabled: bool
    last_error: str | None = None
    last_checked_at: datetime | None = None
    description: str | None = None


class DashboardOut(BaseModel):
    today_bookings: int = 0
    waiting: int = 0
    washing: int = 0
    completed: int = 0
    ready_for_collection: int = 0
    cancelled: int = 0
    no_shows: int = 0
    revenue_today: Decimal = Decimal("0")
    revenue_week: Decimal = Decimal("0")
    revenue_month: Decimal = Decimal("0")
    cash_today: Decimal = Decimal("0")
    card_today: Decimal = Decimal("0")
    outstanding: Decimal = Decimal("0")
    vehicles_washed: int = 0
    avg_wash_minutes: float | None = None
    avg_wait_minutes: float | None = None
    customers_total: int = 0
    customers_new_today: int = 0
    returning_customers_today: int = 0
    employees_working: int = 0
    attendance_today: int = 0
    low_stock_count: int = 0
    upcoming_bookings: list[dict] = []
    recent_activity: list[dict] = []
    stage_counts: dict[str, int] = {}
    revenue_by_day: list[dict] = []
    system_health: str = "ok"
    integrations_ok: int = 0
    integrations_total: int = 0
    queue_length: int = 0
    bays: list[dict] = []
