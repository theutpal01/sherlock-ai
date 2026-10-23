"""Saltmarsh Lighthouse API walkthrough (Phase 10).

Full session slice: discover all 8 objects, walk the 3 dialogue chains,
then accuse finn (correct) and prove odda cannot be accused (422).
Also covers the new /cases/daily and /cases/{id}/validate endpoints.
"""

from fastapi.testclient import TestClient


def _new_session(client: TestClient) -> str:
    response = client.post("/sessions", json={"case_id": "saltmarsh_lighthouse"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_cases_list_includes_saltmarsh(client: TestClient):
    response = client.get("/cases")
    assert response.status_code == 200, response.text
    ids = {c["id"] for c in response.json()["cases"]}
    assert {"blackwood_manor", "holloway_theatre", "saltmarsh_lighthouse"} <= ids


def test_daily_case_is_deterministic_and_spoiler_safe(client: TestClient):
    first = client.get("/cases/daily")
    second = client.get("/cases/daily")
    assert first.status_code == 200, first.text
    assert first.json() == second.json()
    body = first.json()
    assert {"date", "seed", "id", "title", "suspects"} <= set(body)
    assert "truth" not in body


def test_validate_case_reports_counts(client: TestClient):
    response = client.get("/cases/saltmarsh_lighthouse/validate")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["valid"] is True
    assert body["counts"] == {
        "rooms": 4,
        "npcs": 3,
        "objects": 8,
        "doors": 2,
        "evidence": 11,
        "dialogues": 5,
        "facts": 5,
        "rules": 10,
        "events": 2,
        "suspects": 2,
    }


def test_validate_unknown_case_404s(client: TestClient):
    assert client.get("/cases/no_such_case/validate").status_code == 404


def test_saltmarsh_walkthrough_accuses_finn(client: TestClient):
    sid = _new_session(client)
    for object_id in (
        "beacon_lamp",
        "oil_can",
        "store_lock",
        "finns_coat",
        "debt_ledger",
        "oily_prints",
        "finns_seaboots",
        "flour_apron",
    ):
        response = client.post(f"/sessions/{sid}/interactions/{object_id}")
        assert response.status_code == 200, (object_id, response.text)
    for node_id in (
        "corwin_lamp_01",
        "corwin_lamp_02",
        "finn_bunk_01",
        "finn_bunk_02",
        "odda_galley_01",
    ):
        response = client.post(f"/sessions/{sid}/dialogue", json={"node_id": node_id})
        assert response.status_code == 200, (node_id, response.text)
    # Odda is exonerated but listed: accusing her records an INCORRECT verdict.
    wrong = client.post(f"/sessions/{sid}/accuse", json={"suspect": "odda"})
    assert wrong.status_code == 200, wrong.text
    assert wrong.json()["correct"] is False


def test_saltmarsh_non_suspect_and_correct_accusations(client: TestClient):
    sid = _new_session(client)
    for object_id in (
        "beacon_lamp",
        "oil_can",
        "store_lock",
        "finns_coat",
        "debt_ledger",
        "oily_prints",
        "finns_seaboots",
        "flour_apron",
    ):
        assert client.post(f"/sessions/{sid}/interactions/{object_id}").status_code == 200
    for node_id in (
        "corwin_lamp_01",
        "corwin_lamp_02",
        "finn_bunk_01",
        "finn_bunk_02",
        "odda_galley_01",
    ):
        assert (
            client.post(f"/sessions/{sid}/dialogue", json={"node_id": node_id}).status_code == 200
        )
    # Corwin is a witness, not a suspect: the accusation is refused outright.
    refused = client.post(f"/sessions/{sid}/accuse", json={"suspect": "corwin"})
    assert refused.status_code == 422, refused.text
    verdict = client.post(f"/sessions/{sid}/accuse", json={"suspect": "finn"})
    assert verdict.status_code == 200, verdict.text
    assert verdict.json()["correct"] is True
