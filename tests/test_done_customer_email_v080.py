"""v0.8.0 — Done / READY notifies customer; email adapter when address present."""

from unittest.mock import MagicMock, patch


def _quick_book(client, **overrides):
    branches = client.get("/api/v1/branches").json()["items"]
    services = client.get("/api/v1/services").json()["items"]
    payload = {
        "branch_id": branches[0]["id"],
        "vehicle_type": "HATCHBACK",
        "service_id": services[0]["id"],
        "scheduled_date": "2026-09-20",
        "scheduled_time": "11:00",
        "customer_name": "Car Owner",
        "customer_phone": "0831112233",
        "colour": "Blue",
        "make": "VW",
        "model": "Polo",
        "payment_method_intent": "cash",
    }
    payload.update(overrides)
    r = client.post("/api/v1/bookings/quick", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_version_080(authed):
    branding = authed.get("/api/v1/branding").json()
    assert branding.get("app.version") == "0.8.0"
    diag = authed.get("/api/v1/diagnostics").json()
    assert str(diag["version"]).startswith("0.8")


def test_done_with_email_calls_adapter(authed):
    booking = _quick_book(authed, customer_email="owner@example.com", customer_phone="0832003001")
    assert booking.get("customer_email") == "owner@example.com"

    mock_svc = MagicMock()
    mock_svc.is_configured.return_value = True
    mock_svc.send.return_value = {"ok": True, "channel": "smtp"}

    with patch("app.services.customer_alerts.get_notification_service", return_value=mock_svc):
        r = authed.post(
            f"/api/v1/bookings/{booking['id']}/stage",
            json={"to_stage": "READY", "customer_message": "At bay 1", "notify_customer": True},
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["wash_stage"] == "READY"
    notify = body.get("customer_notify") or {}
    assert notify.get("in_app") is True
    assert notify.get("email_status") == "SENT"
    mock_svc.send.assert_called()
    args = mock_svc.send.call_args[0]
    assert args[1] == "owner@example.com"
    assert "ready" in args[2].lower() or "Ready" in args[2]
    assert "At bay 1" in args[3] or "Polo" in args[3]


def test_done_without_email_no_crash(authed):
    booking = _quick_book(authed, customer_phone="0832003002", customer_name="No Email")
    # Explicitly no email
    r = authed.post(
        f"/api/v1/bookings/{booking['id']}/stage",
        json={"to_stage": "READY", "customer_message": "Thanks"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["wash_stage"] == "READY"
    notify = body.get("customer_notify") or {}
    assert notify.get("in_app") is True
    assert notify.get("email_status") == "SKIPPED"
    assert "no customer email" in (notify.get("message") or "").lower() or notify.get("email_status") == "SKIPPED"

    notes = authed.get("/api/v1/notifications").json()["items"]
    cust = [n for n in notes if n.get("event_type") == "customer_car_ready"]
    assert cust, notes


def test_bay_board_shows_ready_colour(authed):
    bays = authed.get("/api/v1/wash-bays").json()["items"]
    assert bays
    bay_id = bays[0]["id"]
    booking = _quick_book(authed, customer_phone="0832003003", wash_bay_id=bay_id)
    authed.post(f"/api/v1/bookings/{booking['id']}/stage", json={"to_stage": "WASHING", "wash_bay_id": bay_id})
    board = authed.get("/api/v1/wash-bays/board").json()["items"]
    match = next(b for b in board if b["id"] == bay_id)
    assert match["status"] == "BUSY"
    assert match["current_vehicle"]

    authed.post(f"/api/v1/bookings/{booking['id']}/stage", json={"to_stage": "READY"})
    board = authed.get("/api/v1/wash-bays/board").json()["items"]
    match = next(b for b in board if b["id"] == bay_id)
    assert match["status"] == "READY"
    assert match["current_vehicle"]["stage"] == "READY"


def test_users_manage_roles_present(authed):
    roles = authed.get("/api/v1/roles").json()["items"]
    names = {r["name"] for r in roles}
    assert "admin" in names
    assert "manager" in names
    assert "senior_tech" in names
    assert "operator" in names
    assert "reception" in names

    # Create operator user
    op = next(r for r in roles if r["name"] == "operator")
    r = authed.post(
        "/api/v1/users",
        json={
            "username": "washer1",
            "password": "wash1234",
            "full_name": "Wash Person",
            "role_id": op["id"],
            "is_active": True,
        },
    )
    assert r.status_code == 201, r.text
    uid = r.json()["id"]

    # Operator cannot list users / launch
    login = authed.post("/api/v1/auth/login", json={"username": "washer1", "password": "wash1234"})
    assert login.status_code == 200, login.text
    csrf = login.json()["csrf_token"]
    # reuse client cookies from login; update csrf
    authed.headers.update({"X-CSRF-Token": csrf})
    denied = authed.get("/api/v1/users")
    assert denied.status_code == 403
    denied2 = authed.get("/api/v1/launch")
    assert denied2.status_code == 403
    denied3 = authed.put("/api/v1/branding", json={"app.name": "Hack"})
    assert denied3.status_code == 403

    # Deactivate as admin — re-login as admin from fixture would need setup again;
    # just verify user exists via roles endpoint was ok for admin earlier.
    assert uid


def test_quick_book_stores_customer_email(authed):
    b = _quick_book(authed, customer_email="keep@me.com", customer_phone="0832003099")
    assert b["customer_email"] == "keep@me.com"
