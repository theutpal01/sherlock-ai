"""Resolution endpoint tests: isolated refutation cross-checks."""

from fastapi.testclient import TestClient

# `client` fixture lives in conftest.py (isolated in-memory DB per test).


def _new_session(client: TestClient) -> str:
    response = client.post("/sessions", json={"case_id": "blackwood_manor"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _refute(client: TestClient, sid: str, name: str, args: list) -> dict:
    response = client.post(
        f"/sessions/{sid}/reason/resolution",
        json={"goal": {"name": name, "args": args}},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_refutes_from_base_facts_after_discovery(client: TestClient):
    sid = _new_session(client)
    assert client.post(f"/sessions/{sid}/interactions/grandfather_clock").status_code == 200
    body = _refute(client, sid, "crime_time", ["21_17"])
    assert body["success"] is True
    assert "R_TIME_001" in body["used_clauses"]
    assert body["steps"][-1]["resolvent"] == []


def test_fails_before_discovery(client: TestClient):
    sid = _new_session(client)
    body = _refute(client, sid, "crime_time", ["21_17"])
    assert body["success"] is False


def test_agrees_with_query_endpoint_on_suspect(client: TestClient):
    sid = _new_session(client)
    for obj in (
        "grandfather_clock",
        "study_safe",
        "safe_lock",
        "bobs_coat",
        "torn_letter",
        "muddy_prints",
        "garden_boots",
    ):
        client.post(f"/sessions/{sid}/interactions/{obj}")
    for node in ("mara_clock_01", "mara_clock_02", "theo_alibi_01", "bob_greet_01"):
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": node})
    for suspect, expected in (("bob", True), ("theo", True), ("mara", False)):
        query = client.post(
            f"/sessions/{sid}/reason/query",
            json={"goal": {"name": "possible_suspect", "args": [suspect]}},
        ).json()
        refutation = _refute(client, sid, "possible_suspect", [suspect])
        assert refutation["success"] == query["success"] == expected


def test_resolution_unknown_session_is_404(client: TestClient):
    response = client.post(
        "/sessions/deadbeef/reason/resolution",
        json={"goal": {"name": "crime_time", "args": ["21_17"]}},
    )
    assert response.status_code == 404
