"""v0.7.0 — cash vs salary_deduction booking validation + payroll CSV."""
from datetime import date


def _branch_service(authed):
    services = authed.get("/api/v1/services").json()["items"]
    branches = authed.get("/api/v1/branches").json()["items"]
    return branches[0]["id"], services[0]["id"]


def test_version_070(authed):
    branding = authed.get("/api/v1/branding").json()
    assert str(branding.get("app.version", "")).startswith("0.8")


def test_quick_book_requires_payment_intent(authed):
    branch_id, service_id = _branch_service(authed)
    r = authed.post(
        "/api/v1/bookings/quick",
        json={
            "branch_id": branch_id,
            "service_id": service_id,
            "scheduled_date": date.today().isoformat(),
            "customer_name": "Walk In",
            "customer_phone": "0821110001",
            "colour": "White",
            "make": "VW",
            "model": "Polo",
            "vehicle_type": "HATCHBACK",
        },
    )
    assert r.status_code == 400, r.text
    detail = r.json()["detail"].lower()
    assert "pay" in detail


def test_quick_book_cash_ok_without_employee_number(authed):
    branch_id, service_id = _branch_service(authed)
    r = authed.post(
        "/api/v1/bookings/quick",
        json={
            "branch_id": branch_id,
            "service_id": service_id,
            "scheduled_date": date.today().isoformat(),
            "customer_name": "Cash Customer",
            "customer_phone": "0821110002",
            "colour": "Black",
            "make": "Toyota",
            "model": "Corolla",
            "vehicle_type": "SEDAN",
            "payment_method_intent": "cash",
        },
    )
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["payment_method_intent"] == "cash"
    assert b.get("pay_badge") == "CASH"
    assert not b.get("employee_number")


def test_salary_deduction_requires_employee_number_walkin_ok(authed):
    """Anyone (walk-in) may use salary deduction IF employee_number is provided."""
    branch_id, service_id = _branch_service(authed)
    missing = authed.post(
        "/api/v1/bookings/quick",
        json={
            "branch_id": branch_id,
            "service_id": service_id,
            "scheduled_date": date.today().isoformat(),
            "customer_name": "Walk In Salary",
            "customer_phone": "0821110003",
            "colour": "Red",
            "make": "Ford",
            "model": "Fiesta",
            "vehicle_type": "HATCHBACK",
            "payment_method_intent": "salary_deduction",
        },
    )
    assert missing.status_code == 400, missing.text
    assert "employee number" in missing.json()["detail"].lower()

    ok = authed.post(
        "/api/v1/bookings/quick",
        json={
            "branch_id": branch_id,
            "service_id": service_id,
            "scheduled_date": date.today().isoformat(),
            "customer_name": "Walk In Salary",
            "customer_phone": "0821110003",
            "colour": "Red",
            "make": "Ford",
            "model": "Fiesta",
            "vehicle_type": "HATCHBACK",
            "payment_method_intent": "salary_deduction",
            "employee_number": "EMP-WALK-9",
            "employee_department": "Ops",
        },
    )
    assert ok.status_code == 201, ok.text
    b = ok.json()
    assert b["payment_method_intent"] == "salary_deduction"
    assert b["employee_number"] == "EMP-WALK-9"
    assert b.get("pay_badge") == "SALARY"

    cust = authed.get(f"/api/v1/customers/{b['customer_id']}").json()
    assert cust.get("employee_number") == "EMP-WALK-9"

    stage = authed.post(f"/api/v1/bookings/{b['id']}/stage", json={"to_stage": "READY"})
    assert stage.status_code == 200, stage.text
    ledger = authed.get("/api/v1/payments/salary-ledger?pending_only=true").json()
    assert ledger["total"] >= 1
    assert any(p.get("employee_number") == "EMP-WALK-9" for p in ledger["items"])

    csv_r = authed.get(
        f"/api/v1/payments/payroll-export.csv?date_from={date.today().replace(day=1).isoformat()}"
        f"&date_to={date.today().isoformat()}"
    )
    assert csv_r.status_code == 200, csv_r.text
    assert "employee_number" in csv_r.text
    assert "EMP-WALK-9" in csv_r.text
    assert "text/csv" in csv_r.headers.get("content-type", "")

    bal = authed.get(f"/api/v1/customers/{b['customer_id']}/salary-balance").json()
    assert bal["outstanding"] > 0

    pid = next(p["id"] for p in ledger["items"] if p.get("employee_number") == "EMP-WALK-9")
    marked = authed.post("/api/v1/payments/salary/mark-paid", json={"payment_ids": [pid]})
    assert marked.status_code == 200, marked.text
    assert marked.json()["updated"] == 1


def test_advanced_booking_cash_intent_optional(authed):
    c = authed.post(
        "/api/v1/customers",
        json={"first_name": "A", "last_name": "B", "phone": "0829991111", "is_active": True},
    ).json()
    v = authed.post(
        "/api/v1/vehicles",
        json={
            "customer_id": c["id"],
            "colour": "Blue",
            "make": "Nissan",
            "model": "Micra",
            "size": "SMALL",
            "is_active": True,
        },
    ).json()
    branch_id, service_id = _branch_service(authed)
    r = authed.post(
        "/api/v1/bookings",
        json={
            "customer_id": c["id"],
            "vehicle_id": v["id"],
            "branch_id": branch_id,
            "service_id": service_id,
            "scheduled_date": date.today().isoformat(),
            "source": "WALK_IN",
            "payment_method_intent": "cash",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["payment_method_intent"] == "cash"
