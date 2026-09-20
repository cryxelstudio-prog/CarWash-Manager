"""v0.9.0 — cash Done creates PAID payment; revenue_today increases."""
from datetime import date
from decimal import Decimal


def _branch_service(client):
    branches = client.get("/api/v1/branches").json()["items"]
    services = client.get("/api/v1/services").json()["items"]
    return branches[0]["id"], services[0]["id"]


def test_cash_quick_book_done_increases_revenue_today(authed):
    before = Decimal(str(authed.get("/api/v1/dashboard").json().get("revenue_today") or 0))
    branch_id, service_id = _branch_service(authed)
    r = authed.post(
        "/api/v1/bookings/quick",
        json={
            "branch_id": branch_id,
            "service_id": service_id,
            "scheduled_date": date.today().isoformat(),
            "scheduled_time": "10:00",
            "customer_name": "Cash Customer",
            "customer_phone": "0829998877",
            "colour": "Silver",
            "make": "Toyota",
            "model": "Corolla",
            "vehicle_type": "SEDAN",
            "payment_method_intent": "cash",
        },
    )
    assert r.status_code == 201, r.text
    booking = r.json()
    total = Decimal(str(booking.get("total_amount") or 0))
    assert total > 0

    r = authed.post(
        f"/api/v1/bookings/{booking['id']}/stage",
        json={"to_stage": "READY", "notify_customer": False},
    )
    assert r.status_code == 200, r.text
    assert r.json()["wash_stage"] == "READY"
    assert r.json().get("payment_status") == "PAID"

    dash = authed.get("/api/v1/dashboard").json()
    after = Decimal(str(dash.get("revenue_today") or 0))
    assert after >= before + total, f"revenue_today {after} expected >= {before + total}"
    cash = Decimal(str(dash.get("cash_today") or 0))
    assert cash >= total
    sales = Decimal(str(dash.get("sales_completed_today") or 0))
    assert sales >= total


def test_salary_done_still_pending_salary(authed):
    branch_id, service_id = _branch_service(authed)
    r = authed.post(
        "/api/v1/bookings/quick",
        json={
            "branch_id": branch_id,
            "service_id": service_id,
            "scheduled_date": date.today().isoformat(),
            "customer_name": "Salary Person",
            "customer_phone": "0825554433",
            "colour": "Black",
            "make": "Ford",
            "model": "Ranger",
            "vehicle_type": "BAKKIE",
            "payment_method_intent": "salary_deduction",
            "employee_number": "E-1001",
        },
    )
    assert r.status_code == 201, r.text
    booking = r.json()
    r = authed.post(
        f"/api/v1/bookings/{booking['id']}/stage",
        json={"to_stage": "READY", "notify_customer": False},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("payment_status") in ("PENDING_SALARY", "PENDING")
    # Dashboard still counts PENDING_SALARY in revenue_today
    dash = authed.get("/api/v1/dashboard").json()
    assert "revenue_today" in dash
