"""v0.4.0 Easy Mode preference persistence."""


def test_me_patch_easy_mode(authed):
    r = authed.get("/api/v1/auth/me")
    assert r.status_code == 200
    user = r.json()["user"]
    assert "easy_mode" in user

    r = authed.patch("/api/v1/auth/me", json={"easy_mode": True})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["easy_mode"] is True

    r = authed.get("/api/v1/auth/status")
    assert r.json()["user"]["easy_mode"] is True

    r = authed.patch("/api/v1/auth/me", json={"easy_mode": False})
    assert r.status_code == 200
    assert r.json()["user"]["easy_mode"] is False


def test_login_persists_easy_mode_checkbox(authed):
    # logout then login with easy_mode true
    authed.post("/api/v1/auth/logout")
    r = authed.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin1234", "easy_mode": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["user"]["easy_mode"] is True
    csrf = r.json()["csrf_token"]
    authed.headers.update({"X-CSRF-Token": csrf})

    r = authed.patch("/api/v1/auth/me", json={"easy_mode": False})
    assert r.status_code == 200
    assert r.json()["user"]["easy_mode"] is False

    authed.post("/api/v1/auth/logout")
    r = authed.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin1234", "easy_mode": False},
    )
    assert r.status_code == 200
    assert r.json()["user"]["easy_mode"] is False


def test_easy_mode_available_to_admin_role(authed):
    """Managers/admins can enable Easy Mode — not locked to Full Mode."""
    r = authed.patch("/api/v1/auth/me", json={"easy_mode": True})
    assert r.status_code == 200
    body = r.json()["user"]
    assert body["easy_mode"] is True
    assert body["is_super_admin"] is True or body["role_name"]
