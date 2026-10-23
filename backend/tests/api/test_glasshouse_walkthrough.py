"""Spoiler-safe API route and complete Glasshouse Orchid walkthrough."""


def _new_session(client):
    response = client.post("/sessions", json={"case_id": "glasshouse_orchid"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_glasshouse_case_is_listed_and_spoiler_safe(client):
    response = client.get("/cases")
    assert response.status_code == 200, response.text
    assert "glasshouse_orchid" in {case["id"] for case in response.json()["cases"]}

    detail = client.get("/cases/glasshouse_orchid")
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert "truth" not in body
    assert all("reveals" not in item for item in body["evidence"])
    assert all("text" not in node for node in body["dialogues"])


def test_glasshouse_progression_validation_is_clear(client):
    response = client.get("/cases/glasshouse_orchid/validate")
    assert response.status_code == 200, response.text
    assert response.json()["valid"] is True, response.text


def test_glasshouse_walkthrough_accuses_celia(client):
    session_id = _new_session(client)
    for object_id in (
        "orchid_case",
        "gallery_lock",
        "gallery_thermometer",
        "muddy_tracks",
        "visitor_book",
        "seed_telegram",
        "key_ledger",
        "curator_gloves",
        "celia_boots",
        "rowan_log",
        "silver_can",
    ):
        response = client.post(f"/sessions/{session_id}/interactions/{object_id}")
        assert response.status_code == 200, (object_id, response.text)

    for node_id in ("celia_office_01", "rowan_boiler_01", "theo_corridor_01"):
        response = client.post(f"/sessions/{session_id}/dialogue", json={"node_id": node_id})
        assert response.status_code == 200, (node_id, response.text)

    verdict = client.post(f"/sessions/{session_id}/accuse", json={"suspect": "celia"})
    assert verdict.status_code == 200, verdict.text
    assert verdict.json()["correct"] is True
