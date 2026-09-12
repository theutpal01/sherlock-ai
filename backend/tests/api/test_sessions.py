"""Investigation-integration tests (spec section 17, API slice).

Proves the Phase 4 exit condition: examining an object produces a backend
fact plus an explainable derived conclusion — and that gating,
idempotency, and the no-leak rule hold.
"""

from fastapi.testclient import TestClient

# `client` fixture lives in conftest.py (isolated in-memory DB per test).


def _new_session(client: TestClient) -> str:
    response = client.post("/sessions", json={"case_id": "blackwood_manor"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_rejects_unknown_case(client: TestClient):
    response = client.post("/sessions", json={"case_id": "no_such_case"})
    assert response.status_code == 404


def test_rejects_unknown_session(client: TestClient):
    assert client.get("/sessions/deadbeef").status_code == 404
    assert client.get("/sessions/deadbeef/knowledge").status_code == 404


def test_exit_condition_clock_yields_crime_time(client: TestClient):
    """Walk to the clock, examine it: fact + explained deduction."""
    sid = _new_session(client)
    response = client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["evidence"]["id"] == "E_CLOCK"
    assert body["already_discovered"] is False
    assert {
        "name": "clock_stopped_at",
        "args": ["hall_clock", "21_17"],
        "source": "E_CLOCK",
    } in body["new_facts"]
    derived_names = [(d["fact"]["name"], tuple(d["fact"]["args"])) for d in body["derived"]]
    assert ("crime_time", ("21_17",)) in derived_names
    time_rule = next(d for d in body["derived"] if d["fact"]["name"] == "crime_time")
    assert time_rule["rule_id"] == "R_TIME_001"
    assert time_rule["supports"]

    knowledge = client.get(f"/sessions/{sid}/knowledge").json()
    known = {(f["name"], tuple(f["args"])) for f in knowledge["known"]}
    assert ("clock_stopped_at", ("hall_clock", "21_17")) in known
    # WHY? text comes from stored provenance, not narration.
    query = client.post(
        f"/sessions/{sid}/reason/query",
        json={"goal": {"name": "crime_time", "args": ["21_17"]}},
    ).json()
    assert query["success"] is True
    assert "R_TIME_001" in query["why"]


def test_gated_evidence_rejected_before_prerequisite(client: TestClient):
    sid = _new_session(client)
    response = client.post(f"/sessions/{sid}/interactions/safe_lock")
    assert response.status_code == 409
    assert client.post(f"/sessions/{sid}/interactions/study_safe").status_code == 200
    assert client.post(f"/sessions/{sid}/interactions/safe_lock").status_code == 200


def test_duplicate_discovery_is_idempotent(client: TestClient):
    sid = _new_session(client)
    first = client.post(f"/sessions/{sid}/interactions/grandfather_clock").json()
    second = client.post(f"/sessions/{sid}/interactions/grandfather_clock").json()
    assert second["already_discovered"] is True
    assert second["new_facts"] == []
    assert second["event_counter"] == first["event_counter"]


def test_undiscovered_evidence_never_leaks(client: TestClient):
    sid = _new_session(client)
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    knowledge = client.get(f"/sessions/{sid}/knowledge").json()
    dumped = str(knowledge)
    assert "opened_with_key" not in dumped  # E_LOCK still hidden
    assert "owes_money" not in dumped  # E_LETTER still hidden
    assert "possible_suspect" not in dumped
    query = client.post(
        f"/sessions/{sid}/reason/query",
        json={"goal": {"name": "possible_suspect", "args": ["bob"]}},
    ).json()
    assert query["success"] is False


def test_dialogue_gating_and_testimony_grant(client: TestClient):
    sid = _new_session(client)
    # Mara won't talk about the clock before it is found.
    assert (
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": "mara_clock_01"}).status_code
        == 409
    )
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    first = client.post(f"/sessions/{sid}/dialogue", json={"node_id": "mara_clock_01"})
    assert first.status_code == 200
    second = client.post(f"/sessions/{sid}/dialogue", json={"node_id": "mara_clock_02"})
    granted = [e["id"] for e in second.json()["unlocked_evidence"]]
    assert "E_WITNESS_MARA" in granted
    knowledge = client.get(f"/sessions/{sid}/knowledge").json()
    known = {(f["name"], tuple(f["args"])) for f in knowledge["known"]}
    assert ("was_at", ("bob", "study", "21_17")) in known


def test_full_case_walkthrough_names_bob_and_theo(client: TestClient):
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
        response = client.post(f"/sessions/{sid}/interactions/{obj}")
        assert response.status_code == 200, (obj, response.text)
    for node in ("mara_clock_01", "mara_clock_02", "theo_alibi_01", "bob_greet_01"):
        response = client.post(f"/sessions/{sid}/dialogue", json={"node_id": node})
        assert response.status_code == 200, (node, response.text)
    knowledge = client.get(f"/sessions/{sid}/knowledge").json()
    derived = {(d["fact"]["name"], tuple(d["fact"]["args"])) for d in knowledge["derived"]}
    assert ("possible_suspect", ("bob",)) in derived
    assert ("possible_suspect", ("theo",)) in derived
    assert ("possible_suspect", ("mara",)) not in derived
    assert not any(name == "guilty" for name, _ in derived)
    why = client.post(
        f"/sessions/{sid}/reason/query",
        json={"goal": {"name": "possible_suspect", "args": ["bob"]}},
    ).json()
    assert why["success"] is True
    assert "R_SUSPECT_003" in why["why"]


def test_move_event_tracks_room_without_ticking_clock(client: TestClient):
    sid = _new_session(client)
    before = client.get(f"/sessions/{sid}").json()["event_counter"]
    assert client.post(f"/sessions/{sid}/move-event", json={"room": "nope"}).status_code == 404
    response = client.post(f"/sessions/{sid}/move-event", json={"room": "hall"})
    assert response.status_code == 200
    body = response.json()
    assert body["current_room"] == "hall"
    assert body["event_counter"] == before
