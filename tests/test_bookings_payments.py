from datetime import date


def test_customer_vehicle_booking_payment_flow(authed):
    c = authed.post("/api/v1/customers", json={
        "first_name": "A", "last_name": "B", "phone": "0821112233", "is_active": True
    }).json()
    v = authed.post("/api/v1/vehicles", json={
        "customer_id": c["id"], "registration": "AA 111 GP",
        "colour": "Silver", "make": "Toyota", "model": "Corolla",
        "size": "SEDAN", "is_active": True
    }).json()
    services = authed.get("/api/v1/services").json()["items"]
    branches = authed.get("/api/v1/branches").json()["items"]
    b = authed.post("/api/v1/bookings", json={
        "customer_id": c["id"],
        "vehicle_id": v["id"],
        "branch_id": branches[0]["id"],
        "service_id": services[0]["id"],
        "scheduled_date": date.today().isoformat(),
        "source": "WALK_IN",
    })
    assert b.status_code == 201, b.text
    booking = b.json()
    assert booking["wash_stage"] == "BOOKED"
    assert booking.get("ticket_number", "").startswith("T-")

    r = authed.post(f"/api/v1/bookings/{booking['id']}/check-in")
    assert r.status_code == 200
    assert r.json()["wash_stage"] == "CHECK_IN"

    r = authed.post(f"/api/v1/bookings/{booking['id']}/stage", json={"to_stage": "WASHING"})
    assert r.status_code == 200

    r = authed.post(f"/api/v1/bookings/{booking['id']}/stage", json={"to_stage": "READY"})
    assert r.status_code == 200

    pay = authed.post("/api/v1/payments", json={
        "booking_id": booking["id"],
        "amount": float(booking["total_amount"]),
        "method": "CASH",
    })
    assert pay.status_code == 201, pay.text

    dash = authed.get("/api/v1/dashboard").json()
    assert dash["today_bookings"] >= 1
    assert float(dash["revenue_today"]) >= float(booking["total_amount"])
