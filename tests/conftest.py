import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TEST_DATA = ROOT / "data" / "pytest-run"
TEST_DATA.mkdir(parents=True, exist_ok=True)

# Must set before importing app (settings are cached)
os.environ["CARWASH_DATA_DIR"] = str(TEST_DATA)
os.environ["CARWASH_SECRET_KEY"] = "test-secret-key-not-for-production"

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine, init_db
from app.main import app
from app.services.bootstrap import ensure_bootstrap

get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_db():
    get_settings.cache_clear()
    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    try:
        ensure_bootstrap(db)
    finally:
        db.close()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def authed(client):
    payload = {
        "admin": {
            "username": "admin",
            "password": "admin1234",
            "full_name": "Admin User",
            "email": "a@test.com",
        },
        "company": {
            "company_name": "Test Wash",
            "currency": "ZAR",
            "timezone": "Africa/Johannesburg",
            "tax_rate": 15,
        },
        "branch": {"name": "Main", "code": "MAIN", "city": "JHB"},
        "services": [
            {
                "code": "EXT",
                "name": "Exterior",
                "base_price": 80,
                "duration_minutes": 20,
            }
        ],
        "load_demo_data": False,
    }
    r = client.post("/api/v1/auth/setup", json=payload)
    assert r.status_code == 200, r.text
    csrf = r.json()["csrf_token"]
    client.headers.update({"X-CSRF-Token": csrf})
    return client
