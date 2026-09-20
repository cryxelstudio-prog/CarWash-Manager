"""v0.5.0 — ticket-first identification; plates optional / hidden by default."""


def test_default_settings_hide_registration(authed):
    branding = authed.get("/api/v1/branding").json()
    assert branding.get("vehicles.show_registration") in (None, "false", False)
    assert branding.get("vehicles.require_registration") in (None, "false", False)
    assert str(branding.get("app.version", "")).startswith("0.")


def test_vehicle_requires_description_not_plate(authed):
    c = authed.post(
        "/api/v1/customers",
        json={"first_name": "A", "last_name": "B", "phone": "0829998877", "is_active": True},
    ).json()
    # No registration — should succeed with colour/make/model
    v = authed.post(
        "/api/v1/vehicles",
        json={
            "customer_id": c["id"],
            "colour": "White",
            "make": "VW",
            "model": "Polo",
            "size": "HATCHBACK",
            "is_active": True,
        },
    )
    assert v.status_code == 201, v.text
    body = v.json()
    assert body.get("registration") in (None, "")
    assert "White" in (body.get("description") or "")
    assert "Polo" in (body.get("description") or "")

    # Missing colour/make/model — fail
    bad = authed.post(
        "/api/v1/vehicles",
        json={"customer_id": c["id"], "registration": "XX 123 GP", "size": "SEDAN", "is_active": True},
    )
    assert bad.status_code == 400


def test_quick_book_ticket_and_search(authed):
    branches = authed.get("/api/v1/branches").json()["items"]
    services = authed.get("/api/v1/services").json()["items"]
    r = authed.post(
        "/api/v1/bookings/quick",
        json={
            "branch_id": branches[0]["id"],
            "vehicle_type": "HATCHBACK",
            "service_id": services[0]["id"],
            "scheduled_date": "2026-09-20",
            "scheduled_time": "11:00",
            "customer_name": "Emma Botha",
            "customer_phone": "0832223344",
            "colour": "White",
            "make": "VW",
            "model": "Polo",
            "payment_method_intent": "cash",
        },
    )
    assert r.status_code == 201, r.text
    booking = r.json()
    assert booking["ticket_number"]
    assert booking["ticket_number"].startswith("T-")
    assert booking.get("vehicle_description")
    assert "White" in booking["vehicle_description"]
    assert booking.get("vehicle_registration") in (None, "")

    # Search by ticket
    s = authed.get(f"/api/v1/search?q={booking['ticket_number']}").json()
    assert any(b["id"] == booking["id"] for b in s["bookings"])

    # Search by phone
    s2 = authed.get("/api/v1/search?q=0832223344").json()
    assert s2["customers"] or s2["bookings"]

    # Search by description
    s3 = authed.get("/api/v1/search?q=White").json()
    assert s3["vehicles"] or s3["bookings"]

    # Search by name
    s4 = authed.get("/api/v1/search?q=Emma").json()
    assert s4["customers"] or s4["bookings"]


def test_show_registration_setting_toggle(authed):
    r = authed.put(
        "/api/v1/branding",
        json={"vehicles.show_registration": "true", "vehicles.hide_registration": "false"},
    )
    assert r.status_code == 200, r.text
    branding = authed.get("/api/v1/branding").json()
    assert branding["vehicles.show_registration"] == "true"
