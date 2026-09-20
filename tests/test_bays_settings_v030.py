"""v0.3.0 — bay CRUD customisation + launch/branding settings persistence."""


def test_bay_crud_rename_disable_add(authed):
    bays = authed.get("/api/v1/wash-bays").json()["items"]
    assert len(bays) >= 2
    bay1 = next(b for b in bays if b["bay_number"] == 1)
    branch_id = bay1["branch_id"]

    # Rename Bay 1
    upd = authed.put(
        f"/api/v1/wash-bays/{bay1['id']}",
        json={
            "branch_id": branch_id,
            "name": "Express Bay",
            "bay_number": 1,
            "bay_type": "STANDARD",
            "status": "AVAILABLE",
            "is_active": True,
        },
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["name"] == "Express Bay"

    # Add Bay 3
    created = authed.post(
        "/api/v1/wash-bays",
        json={
            "branch_id": branch_id,
            "name": "Detail Bay",
            "bay_number": 3,
            "bay_type": "DETAIL",
            "status": "AVAILABLE",
            "is_active": True,
        },
    )
    assert created.status_code == 201, created.text
    bay3_id = created.json()["id"]

    # Disable Bay 2
    bay2 = next(b for b in bays if b["bay_number"] == 2)
    dis = authed.put(
        f"/api/v1/wash-bays/{bay2['id']}",
        json={
            "branch_id": branch_id,
            "name": bay2["name"],
            "bay_number": 2,
            "bay_type": "STANDARD",
            "status": "CLOSED",
            "is_active": False,
        },
    )
    assert dis.status_code == 200
    assert dis.json()["is_active"] is False

    board = authed.get("/api/v1/wash-bays/board").json()
    active_names = {b["name"] for b in board["items"]}
    assert "Express Bay" in active_names
    assert "Detail Bay" in active_names
    # Disabled bay must not appear on operational board
    assert bay2["name"] not in active_names or all(
        b["id"] != bay2["id"] for b in board["items"]
    )

    active_list = authed.get("/api/v1/wash-bays?active_only=true").json()["items"]
    assert all(b["is_active"] for b in active_list)
    assert any(b["id"] == bay3_id for b in active_list)

    # Soft delete bay 3
    deleted = authed.delete(f"/api/v1/wash-bays/{bay3_id}")
    assert deleted.status_code == 200
    remaining = {b["id"] for b in authed.get("/api/v1/wash-bays").json()["items"]}
    assert bay3_id not in remaining

    # Reorder remaining
    left = authed.get("/api/v1/wash-bays").json()["items"]
    assert len(left) >= 2
    a, b = left[0], left[1]
    re = authed.post(
        "/api/v1/wash-bays/reorder",
        json={"items": [{"id": a["id"], "bay_number": b["bay_number"]}, {"id": b["id"], "bay_number": a["bay_number"]}]},
    )
    assert re.status_code == 200, re.text


def test_ensure_default_does_not_overwrite_custom_names(authed):
    bays = authed.get("/api/v1/wash-bays").json()["items"]
    bay1 = next(b for b in bays if b["bay_number"] == 1)
    authed.put(
        f"/api/v1/wash-bays/{bay1['id']}",
        json={
            "branch_id": bay1["branch_id"],
            "name": "VIP Bay",
            "bay_number": 1,
            "bay_type": "STANDARD",
            "status": "AVAILABLE",
            "is_active": True,
        },
    )
    # Hitting board triggers ensure_default_bays
    board = authed.get("/api/v1/wash-bays/board")
    assert board.status_code == 200
    names = [b["name"] for b in board.json()["items"] if b["id"] == bay1["id"]]
    assert names == ["VIP Bay"]


def test_launch_and_branding_persistence(authed):
    launch = authed.get("/api/v1/launch")
    assert launch.status_code == 200, launch.text
    data = launch.json()
    assert "access" in data and "platforms" in data
    assert data["platforms"]["power_apps"]["status"] == "NOT_CONFIGURED"
    assert data["access"]["port"]
    assert data["access"]["invite_link"]
    assert "/login" in data["access"]["invite_link"] or data["access"]["invite_link"].endswith("login")

    staff = authed.get("/api/v1/staff-access")
    assert staff.status_code == 200
    assert "qr_target" in staff.json()
    assert "/m" in staff.json()["qr_target"]

    saved = authed.put(
        "/api/v1/launch/power_apps",
        json={
            "fields": {
                "powerapps.environment_url": "https://example.crm.dynamics.com",
                "powerapps.api_base_url": "http://127.0.0.1:8787/api/v1",
                "powerapps.cors_origins": "https://apps.powerapps.com",
            }
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["platforms"]["power_apps"]["status"] == "CONFIGURED"

    sp = authed.put(
        "/api/v1/launch/sharepoint",
        json={"fields": {"sharepoint.site_url": "https://contoso.sharepoint.com/sites/Wash"}},
    )
    assert sp.status_code == 200
    assert sp.json()["platforms"]["sharepoint"]["status"] == "CONFIGURED"

    custom = authed.put(
        "/api/v1/launch/custom",
        json={"fields": {"launch.public_base_url": "https://carwash.example.com"}},
    )
    assert custom.status_code == 200
    assert custom.json()["platforms"]["custom"]["status"] == "CONFIGURED"
    assert "carwash.example.com" in custom.json()["access"]["primary_url"]

    # Settings round-trip
    put = authed.put(
        "/api/v1/branding",
        json={
            "app.name": "Sparkle Wash",
            "app.accent_colour": "#7c3aed",
            "company.name": "Sparkle (Pty) Ltd",
        },
    )
    assert put.status_code == 200, put.text
    brand = authed.get("/api/v1/branding").json()
    assert brand["app.name"] == "Sparkle Wash"
    assert brand["app.accent_colour"] == "#7c3aed"

    # Setting key persistence
    s = authed.put(
        "/api/v1/settings/launch.public_base_url",
        json={"key": "launch.public_base_url", "value": "https://wash.local", "category": "launch"},
    )
    assert s.status_code == 200
    all_settings = authed.get("/api/v1/settings").json()["items"]
    row = next(r for r in all_settings if r["key"] == "launch.public_base_url")
    assert row["value"] == "https://wash.local"
