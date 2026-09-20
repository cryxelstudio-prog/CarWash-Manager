"""Optional demo data seeder."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    Attendance,
    Booking,
    BookingItem,
    Customer,
    Employee,
    Expense,
    InventoryItem,
    Package,
    PackageService,
    Payment,
    Service,
    Supplier,
    Vehicle,
)
from app.models.models import BookingStatus, PaymentMethod, PaymentStatus, WashStage
from app.utils.numbering import next_number, next_ticket_number


def seed_demo_data(db: Session, *, branch_id: int, admin_user_id: int) -> None:
    services = db.query(Service).filter(Service.is_deleted.is_(False)).all()
    if not services:
        return

    # Employees
    employees = []
    for i, (fn, ln, title) in enumerate(
        [("Thabo", "Molefe", "Operator"), ("Aisha", "Naidoo", "Detailer"), ("Johan", "van Wyk", "Supervisor")],
        start=1,
    ):
        emp = Employee(
            employee_number=f"EMP-{i:03d}",
            first_name=fn,
            last_name=ln,
            job_title=title,
            branch_id=branch_id,
            phone=f"082000000{i}",
            is_active=True,
            can_operate=True,
            hire_date=date.today() - timedelta(days=180),
        )
        db.add(emp)
        employees.append(emp)
    db.flush()

    for emp in employees:
        db.add(
            Attendance(
                employee_id=emp.id,
                branch_id=branch_id,
                work_date=date.today(),
                clock_in=datetime.combine(date.today(), time(7, 30)),
                status="PRESENT",
            )
        )

    # Package
    pkg = Package(code="PREMIUM", name="Premium Package", price=Decimal("280"), duration_minutes=75, is_active=True)
    db.add(pkg)
    db.flush()
    for s in services[:2]:
        db.add(PackageService(package_id=pkg.id, service_id=s.id))

    # Supplier + inventory
    supplier = Supplier(code="SUP-001", name="CleanChem SA", phone="0115550100", is_active=True)
    db.add(supplier)
    db.flush()
    for sku, name, qty, reorder in [
        ("SOAP-01", "Car Wash Soap 5L", 20, 5),
        ("WAX-01", "Liquid Wax 1L", 8, 3),
        ("TOWEL-01", "Microfibre Towels", 40, 10),
        ("SHAMPOO-01", "Interior Shampoo", 2, 5),
    ]:
        db.add(
            InventoryItem(
                sku=sku,
                name=name,
                quantity_on_hand=Decimal(str(qty)),
                reorder_level=Decimal(str(reorder)),
                unit_cost=Decimal("45"),
                supplier_id=supplier.id,
                branch_id=branch_id,
            )
        )

    # Customers + vehicles + bookings
    # name, phone, optional reg, make, model, size, colour
    demo_customers = [
        ("Sipho", "Dlamini", "0821112233", "CA 123-456", "Toyota", "Corolla", "SEDAN", "Silver"),
        ("Emma", "Botha", "0832223344", None, "VW", "Polo", "HATCHBACK", "White"),
        ("Ravi", "Patel", "0843334455", "ND 445566", "Ford", "Ranger", "BAKKIE", "Blue"),
        ("Lerato", "Khumalo", "0814445566", None, "BMW", "X3", "SUV", "Black"),
        ("Chris", "Adams", "0725556677", None, "Mercedes", "C-Class", "SEDAN", "Grey"),
    ]
    today = date.today()
    stages = [
        WashStage.BOOKED,
        WashStage.WAITING,
        WashStage.WASHING,
        WashStage.READY,
        WashStage.COLLECTED,
    ]
    for idx, (fn, ln, phone, reg, make, model, size, colour) in enumerate(demo_customers):
        cust = Customer(
            customer_number=next_number(db, Customer, "customer_number", "CUS"),
            first_name=fn,
            last_name=ln,
            phone=phone,
            email=f"{fn.lower()}@example.com",
            preferred_branch_id=branch_id,
            is_active=True,
        )
        db.add(cust)
        db.flush()
        veh = Vehicle(
            customer_id=cust.id,
            registration=reg,
            make=make,
            model=model,
            size=size,
            colour=colour,
            is_active=True,
        )
        db.add(veh)
        db.flush()

        svc = services[idx % len(services)]
        stage = stages[idx % len(stages)]
        status = BookingStatus.COMPLETED.value if stage == WashStage.COLLECTED else (
            BookingStatus.IN_PROGRESS.value if stage in (WashStage.WASHING, WashStage.WAITING, WashStage.READY) else BookingStatus.CONFIRMED.value
        )
        price = Decimal(str(svc.base_price))
        tax = (price * Decimal("0.15")).quantize(Decimal("0.01"))
        booking = Booking(
            booking_number=next_number(db, Booking, "booking_number", "BKG"),
            ticket_number=next_ticket_number(db, Booking),
            customer_id=cust.id,
            vehicle_id=veh.id,
            branch_id=branch_id,
            service_id=svc.id,
            assigned_employee_id=employees[idx % len(employees)].id,
            scheduled_date=today if idx < 4 else today + timedelta(days=1),
            scheduled_time=time(8 + idx, 0),
            duration_minutes=svc.duration_minutes,
            status=status,
            wash_stage=stage.value,
            source="WALK_IN",
            customer_phone=phone,
            subtotal=price,
            tax_amount=tax,
            total_amount=price + tax,
            payment_status=PaymentStatus.PAID.value if stage == WashStage.COLLECTED else PaymentStatus.PENDING.value,
            created_by_id=admin_user_id,
            arrived_at=datetime.utcnow() - timedelta(hours=2) if stage != WashStage.BOOKED else None,
            checked_in_at=datetime.utcnow() - timedelta(hours=1, minutes=45) if stage not in (WashStage.BOOKED,) else None,
            started_at=datetime.utcnow() - timedelta(hours=1) if stage in (WashStage.WASHING, WashStage.READY, WashStage.COLLECTED) else None,
            completed_at=datetime.utcnow() - timedelta(minutes=20) if stage in (WashStage.READY, WashStage.COLLECTED) else None,
            collected_at=datetime.utcnow() - timedelta(minutes=5) if stage == WashStage.COLLECTED else None,
        )
        db.add(booking)
        db.flush()
        db.add(
            BookingItem(
                booking_id=booking.id,
                service_id=svc.id,
                description=svc.name,
                quantity=1,
                unit_price=price,
                tax_rate=Decimal("15"),
                line_total=price + tax,
            )
        )
        if stage == WashStage.COLLECTED:
            db.add(
                Payment(
                    payment_number=next_number(db, Payment, "payment_number", "PAY"),
                    booking_id=booking.id,
                    customer_id=cust.id,
                    branch_id=branch_id,
                    amount=booking.total_amount,
                    method=PaymentMethod.CASH.value,
                    status=PaymentStatus.PAID.value,
                    received_by_id=admin_user_id,
                )
            )

    db.add(
        Expense(
            expense_number=next_number(db, Expense, "expense_number", "EXP"),
            branch_id=branch_id,
            category="SUPPLIES",
            description="Soap and towels restock",
            amount=Decimal("850.00"),
            expense_date=today,
            payment_method="EFT",
            supplier_id=supplier.id,
            created_by_id=admin_user_id,
        )
    )
    db.flush()
