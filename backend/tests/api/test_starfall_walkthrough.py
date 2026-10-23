"""Starfall Observatory API walkthrough and spoiler-safety checks."""


def _new_session(client):
    response = client.post("/sessions", json={"case_id": "starfall_observatory"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_starfall_is_listed_and_truth_stays_private(client):
    cases = client.get("/cases")
    assert cases.status_code == 200, cases.text
    assert "starfall_observatory" in {case["id"] for case in cases.json()["cases"]}

    detail = client.get("/cases/starfall_observatory")
    assert detail.status_code == 200, detail.text
    assert "truth" not in detail.json()
    assert all("reveals" not in clue for clue in detail.json()["evidence"])
    assert all("text" not in node for node in detail.json()["dialogues"])


def test_starfall_validation_reports_a_reachable_case(client):
    response = client.get("/cases/starfall_observatory/validate")
    assert response.status_code == 200, response.text
    assert response.json()["valid"] is True, response.text


def test_starfall_walkthrough_accuses_vane(client):
    session_id = _new_session(client)
    for object_id in (
        "plate_case",
        "dome_lock",
        "star_log",
        "dome_tracks",
        "key_register",
        "publisher_cable",
        "archive_seal",
        "elias_boots",
        "emulsion_gloves",
        "dynamo_ledger",
    ):
        response = client.post(f"/sessions/{session_id}/interactions/{object_id}")
        assert response.status_code == 200, (object_id, response.text)

    for node_id in (
        "ada_archive_01",
        "ada_archive_02",
        "elias_alibi_01",
        "mira_alibi_01",
    ):
        response = client.post(f"/sessions/{session_id}/dialogue", json={"node_id": node_id})
        assert response.status_code == 200, (node_id, response.text)

    response = client.post(f"/sessions/{session_id}/accuse", json={"suspect": "scholar"})
    assert response.status_code == 200, response.text
    assert response.json()["correct"] is True

