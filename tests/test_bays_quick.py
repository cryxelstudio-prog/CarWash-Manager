"""Bay board (2 default bays) and Quick Book."""


def test_default_two_bays_and_board(authed):
    r = authed.get("/api/v1/wash-bays")
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    names = sorted(b["name"] for b in items if b["bay_number"] in (1, 2))
    assert "Bay 1" in names
    assert "Bay 2" in names
    assert sum(1 for b in items if b["bay_number"] in (1, 2) and not b.get("is_deleted")) >= 2

    board = authed.get("/api/v1/wash-bays/board")
    assert board.status_code == 200, board.text
    data = board.json()
    assert data["total"] >= 2
    assert "AVAILABLE" in data["statuses"]
    bay1 = next(b for b in data["items"] if b["bay_number"] == 1)
    assert bay1["status"] in data["statuses"]

    upd = authed.post(f"/api/v1/wash-bays/{bay1['id']}/status", json={"status": "OFFLINE"})
    assert upd.status_code == 200, upd.text
    assert upd.json()["status"] == "OFFLINE"

    upd2 = authed.post(f"/api/v1/wash-bays/{bay1['id']}/status", json={"status": "AVAILABLE"})
    assert upd2.status_code == 200
    assert upd2.json()["status"] == "AVAILABLE"


def test_quick_book_and_bay_busy(authed):
    branches = authed.get("/api/v1/branches").json()["items"]
    services = authed.get("/api/v1/services").json()["items"]
    bays = authed.get("/api/v1/wash-bays").json()["items"]
    assert branches and services and bays
    bay = next(b for b in bays if b["bay_number"] == 1)

    r = authed.post(
        "/api/v1/bookings/quick",
        json={
            "branch_id": branches[0]["id"],
            "vehicle_type": "SEDAN",
            "service_id": services[0]["id"],
            "scheduled_date": "2026-09-20",
            "scheduled_time": "10:00",
            "customer_name": "Sipho Dlamini",
            "customer_phone": "0821112233",
            "colour": "Silver",
            "make": "Toyota",
            "model": "Corolla",
            "registration": "GP12ABGP",
            "wash_bay_id": bay["id"],
            "payment_method_intent": "cash",
        },
    )
    assert r.status_code == 201, r.text
    booking = r.json()
    assert booking["customer_name"]
    assert booking["wash_bay_id"] == bay["id"]

    # Move into washing → bay becomes Busy
    stage = authed.post(
        f"/api/v1/bookings/{booking['id']}/stage",
        json={"to_stage": "WASHING", "wash_bay_id": bay["id"]},
    )
    assert stage.status_code == 200, stage.text

    board = authed.get("/api/v1/wash-bays/board").json()
    bay1 = next(b for b in board["items"] if b["id"] == bay["id"])
    assert bay1["status"] == "BUSY"
    assert bay1["current_vehicle"] is not None
    assert bay1["current_vehicle"]["ticket_number"]
    assert bay1["current_vehicle"]["ticket_number"].startswith("T-")
    assert "Silver" in (bay1["current_vehicle"].get("description") or "")
    # Plate still stored when provided, but not primary
    assert bay1["current_vehicle"]["registration"] == "GP12ABGP"

    # Ready for collection — bay stays visible in blue READY state (v0.8.0)
    done = authed.post(f"/api/v1/bookings/{booking['id']}/stage", json={"to_stage": "READY"})
    assert done.status_code == 200
    board2 = authed.get("/api/v1/wash-bays/board").json()
    bay1b = next(b for b in board2["items"] if b["id"] == bay["id"])
    assert bay1b["status"] == "READY"
    assert bay1b["current_vehicle"] is not None
    assert bay1b["current_vehicle"]["stage"] == "READY"

    # Collected frees the bay
    collected = authed.post(f"/api/v1/bookings/{booking['id']}/stage", json={"to_stage": "COLLECTED"})
    assert collected.status_code == 200
    board3 = authed.get("/api/v1/wash-bays/board").json()
    bay1c = next(b for b in board3["items"] if b["id"] == bay["id"])
    assert bay1c["status"] == "AVAILABLE"
    assert bay1c["current_vehicle"] is None


def test_dashboard_includes_bays(authed):
    r = authed.get("/api/v1/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "bays" in data
    assert "queue_length" in data
    assert isinstance(data["bays"], list)
