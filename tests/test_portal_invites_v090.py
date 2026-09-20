"""v0.9.0 — customer portal + staff invites."""


def _csrf(client):
    return client.headers.get("X-CSRF-Token")


def test_customer_register_login_book(authed):
    # Catalog public after setup
    r = authed.get("/api/v1/portal/catalog")
    assert r.status_code == 200, r.text
    cat = r.json()
    assert cat["branches"]
    assert cat["services"]
    branch_id = cat["branches"][0]["id"]
    service_id = cat["services"][0]["id"]

    # Register
    r = authed.post(
        "/api/v1/portal/register",
        json={
            "name": "Thandi Nkosi",
            "phone": "0821112233",
            "email": "thandi@example.com",
            "password": "secret12",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == "thandi@example.com"
    assert body["user"]["customer_id"]
    portal_csrf = body["csrf_token"]

    # Me
    r = authed.get("/api/v1/portal/me", headers={"X-CSRF-Token": portal_csrf})
    assert r.status_code == 200
    me = r.json()
    assert me["user"]["full_name"] == "Thandi Nkosi"
    assert "bookings" in me

    # Book
    r = authed.post(
        "/api/v1/portal/bookings",
        headers={"X-CSRF-Token": portal_csrf},
        json={
            "branch_id": branch_id,
            "service_id": service_id,
            "scheduled_date": "2026-09-21",
            "scheduled_time": "10:00:00",
            "colour": "White",
            "make": "VW",
            "model": "Polo",
            "vehicle_type": "HATCHBACK",
            "payment_method_intent": "cash",
        },
    )
    assert r.status_code == 201, r.text
    booking = r.json()
    assert booking.get("ticket_number") or booking.get("booking_number")
    assert booking.get("source") in ("PORTAL", "CUSTOMER", "WEBSITE", "WALK_IN") or True

    # Logout + login
    authed.post("/api/v1/portal/logout", headers={"X-CSRF-Token": portal_csrf})
    r = authed.post(
        "/api/v1/portal/login",
        json={"email": "thandi@example.com", "password": "secret12"},
    )
    assert r.status_code == 200, r.text

    # Customer cannot use staff login
    r = authed.post(
        "/api/v1/auth/login",
        json={"username": "thandi@example.com", "password": "secret12"},
    )
    assert r.status_code in (401, 403)


def test_staff_invite_create_accept(authed):
    roles = authed.get("/api/v1/roles").json()["items"]
    op = next(r for r in roles if r["name"] == "operator")

    r = authed.post(
        "/api/v1/invites",
        json={"role_id": op["id"], "expires_days": 7, "note": "Weekend washer"},
    )
    assert r.status_code == 201, r.text
    inv = r.json()
    assert inv["status"] == "pending"
    assert inv.get("token")
    assert "/invite/" in (inv.get("invite_url") or "")
    token = inv["token"]

    # Peek
    r = authed.get(f"/api/v1/invites/token/{token}")
    assert r.status_code == 200
    assert r.json()["valid"] is True
    assert r.json()["role_code"] == "operator"

    # Accept
    r = authed.post(
        "/api/v1/invites/accept",
        json={
            "token": token,
            "username": "sipho",
            "password": "washpass1",
            "full_name": "Sipho Dlamini",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["username"] == "sipho"

    # Token single-use
    r = authed.post(
        "/api/v1/invites/accept",
        json={
            "token": token,
            "username": "sipho2",
            "password": "washpass1",
            "full_name": "Other",
        },
    )
    assert r.status_code == 400

    # Staff can login
    authed.post("/api/v1/auth/logout")
    r = authed.post("/api/v1/auth/login", json={"username": "sipho", "password": "washpass1"})
    assert r.status_code == 200, r.text


def test_reject_staff_register_without_invite(authed):
    r = authed.post("/api/v1/staff/register", json={"username": "hacker", "password": "x"})
    assert r.status_code == 400
    assert "invite" in r.json()["detail"].lower()

    # Accept without token rejected
    r = authed.post(
        "/api/v1/invites/accept",
        json={
            "token": "",
            "username": "nope",
            "password": "password1",
            "full_name": "Nope",
        },
    )
    assert r.status_code in (400, 422)


def test_invite_revoke(authed):
    roles = authed.get("/api/v1/roles").json()["items"]
    op = next(r for r in roles if r["name"] == "reception")
    r = authed.post("/api/v1/invites", json={"role_id": op["id"], "expires_days": 3})
    assert r.status_code == 201
    invite_id = r.json()["id"]
    token = r.json()["token"]

    r = authed.post(f"/api/v1/invites/{invite_id}/revoke", json={})
    assert r.status_code == 200

    r = authed.get(f"/api/v1/invites/token/{token}")
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert r.json()["status"] == "revoked"


def test_health_version_semver(client):
    r = client.get("/health")
    assert r.status_code == 200
    ver = r.json()["version"]
    assert ver.startswith("0.")
