def test_openapi_and_spa(client, authed):
    r = client.get("/api/docs")
    assert r.status_code == 200
    r = client.get("/api/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    assert "/api/v1/bookings" in paths
    r = client.get("/")
    assert r.status_code == 200
    assert "html" in r.text.lower()
