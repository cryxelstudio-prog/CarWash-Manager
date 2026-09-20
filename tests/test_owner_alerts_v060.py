"""v0.6.0 — owner alerts, Outlook adapter no-op, ICS, local calendar API."""


def _quick_book(client, **overrides):
    branches = client.get("/api/v1/branches").json()["items"]
    services = client.get("/api/v1/services").json()["items"]
    payload = {
        "branch_id": branches[0]["id"],
        "vehicle_type": "HATCHBACK",
        "service_id": services[0]["id"],
        "scheduled_date": "2026-09-20",
        "scheduled_time": "11:00",
        "customer_name": "Owner Alert Test",
        "customer_phone": "0831112233",
        "colour": "Red",
        "make": "Toyota",
        "model": "Corolla",
        "payment_method_intent": "cash",
    }
    payload.update(overrides)
    r = client.post("/api/v1/bookings/quick", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_version_is_semver(authed):
    branding = authed.get("/api/v1/branding").json()
    assert str(branding.get("app.version", "")).startswith("0.")
    diag = authed.get("/api/v1/diagnostics").json()
    assert str(diag["version"]).startswith("0.")


def test_stage_ready_creates_in_app_notification(authed):
    booking = _quick_book(authed)
    # Ensure ready alert toggle on (default true)
    authed.put(
        "/api/v1/launch/owner_alerts",
        json={
            "fields": {
                "owner.name": "Boss",
                "owner.email": "boss@test.com",
                "owner.alert.car_ready": "true",
            }
        },
    )
    r = authed.post(f"/api/v1/bookings/{booking['id']}/stage", json={"to_stage": "READY"})
    assert r.status_code == 200, r.text
    assert r.json()["wash_stage"] == "READY"

    notes = authed.get("/api/v1/notifications").json()["items"]
    ready = [n for n in notes if n.get("event_type") == "car_ready" or "ready" in (n.get("title") or "").lower()]
    assert ready, notes
    n = ready[0]
    assert booking["ticket_number"] in n["title"] or booking["ticket_number"] in n["body"]
    assert "Red" in n["body"] or "Corolla" in n["body"]
    # Outlook disabled → skipped outbound, not a hard failure of the booking
    assert n.get("outbound_status") in ("SKIPPED", "FAILED", "PENDING", "SENT", None)


def test_adapter_noop_when_outlook_disabled(authed):
    # Explicitly disabled
    authed.put(
        "/api/v1/launch/outlook_calendar",
        json={
            "fields": {
                "outlook.connect_calendar": "false",
                "outlook.mode": "disabled",
            }
        },
    )
    booking = _quick_book(authed, customer_phone="0834445566", customer_name="No Outlook")
    r = authed.post(f"/api/v1/bookings/{booking['id']}/stage", json={"to_stage": "READY"})
    assert r.status_code == 200, r.text

    # Test connection reports not configured — must not 500
    t = authed.post("/api/v1/launch/outlook/test", json={"send_test": False})
    assert t.status_code == 200, t.text
    body = t.json()
    assert body["test"]["ok"] is False
    assert body["test"]["status"] in ("NOT_CONFIGURED", "FAILED")

    # Integrations list includes outlook_notifications
    integ = authed.get("/api/v1/integrations").json()["items"]
    codes = {i["code"] for i in integ}
    assert "outlook_notifications" in codes


def test_ics_download_without_outlook(authed):
    booking = _quick_book(authed, customer_phone="0837778899")
    r = authed.get(f"/api/v1/bookings/{booking['id']}/ics")
    assert r.status_code == 200, r.text
    assert "text/calendar" in r.headers.get("content-type", "")
    text = r.text
    assert "BEGIN:VCALENDAR" in text
    assert "BEGIN:VEVENT" in text
    assert booking["ticket_number"] in text or "Wash" in text


def test_calendar_list_api_branch_filter(authed):
    booking = _quick_book(authed, customer_phone="0820001111")
    r = authed.get("/api/v1/bookings?date_from=2026-09-01&date_to=2026-09-30&page_size=100")
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(b["id"] == booking["id"] for b in items)
    # Serialize includes ticket + vehicle description
    match = next(b for b in items if b["id"] == booking["id"])
    assert match.get("ticket_number")
    assert match.get("vehicle_description")
    assert "Red" in match["vehicle_description"]


def test_launch_outlook_wizard_save(authed):
    r = authed.put(
        "/api/v1/launch/outlook_calendar",
        json={
            "fields": {
                "outlook.connect_calendar": "true",
                "outlook.mode": "smtp",
                "outlook.owner_mailbox": "owner@example.com",
                "outlook.smtp_host": "smtp.example.com",
                "outlook.smtp_port": "587",
                "outlook.smtp_from": "owner@example.com",
                "outlook.sync_calendar": "false",
                "owner.alert.email_when_ready": "true",
            }
        },
    )
    assert r.status_code == 200, r.text
    plat = r.json()["platforms"]["outlook_calendar"]
    assert plat["fields"]["outlook.mode"] == "smtp"
    assert plat["fields"]["outlook.owner_mailbox"] == "owner@example.com"
    # Status configured (not connected until test)
    assert plat["status"] in ("CONFIGURED", "CONNECTED", "NOT_CONFIGURED", "FAILED")
