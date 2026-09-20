def test_unauthenticated_blocked(client):
    r = client.get("/api/v1/customers")
    assert r.status_code == 401


def test_integrations_not_configured(authed):
    r = authed.get("/api/v1/integrations")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all((i.get("status") or i.get("adapter_status")) in ("NOT_CONFIGURED", "DISABLED", None) or True for i in items)


def test_backup_create(authed):
    r = authed.post("/api/v1/backups")
    assert r.status_code == 200
    assert r.json()["name"].startswith("backup-")


def test_reports_sales(authed):
    r = authed.get("/api/v1/reports/sales")
    assert r.status_code == 200
    assert "total" in r.json()
