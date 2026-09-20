def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["setup_required"] is True


def test_setup_and_login(client):
    payload = {
        "admin": {"username": "boss", "password": "password12", "full_name": "Boss"},
        "company": {"company_name": "Wash Co"},
        "branch": {"name": "HQ", "code": "HQ"},
        "services": [],
        "load_demo_data": False,
    }
    r = client.post("/api/v1/auth/setup", json=payload)
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "boss"
    csrf = r.json()["csrf_token"]

    r = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 200

    r = client.post("/api/v1/auth/login", json={"username": "boss", "password": "password12"})
    assert r.status_code == 200
    assert r.json()["csrf_token"]


def test_login_rejects_bad_password(authed):
    # after setup, logout then bad login
    authed.post("/api/v1/auth/logout")
    r = authed.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401
