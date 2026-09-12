"""Accusation tests (spec Phase 6): graded verdicts, support/contradict
reports, terminal sessions, and determinism."""

from fastapi.testclient import TestClient

# `client` fixture lives in conftest.py (isolated in-memory DB per test).


OBJECTS = (
    "grandfather_clock",
    "study_safe",
    "safe_lock",
    "bobs_coat",
    "torn_letter",
    "muddy_prints",
    "garden_boots",
)
NODES = ("mara_clock_01", "mara_clock_02", "theo_alibi_01", "bob_greet_01")


def _new_session(client: TestClient) -> str:
    response = client.post("/sessions", json={"case_id": "blackwood_manor"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _play_full(client: TestClient, sid: str) -> None:
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    for obj in OBJECTS:
        assert client.post(f"/sessions/{sid}/interactions/{obj}").status_code == 200
    for node in NODES:
        assert client.post(f"/sessions/{sid}/dialogue", json={"node_id": node}).status_code == 200


def test_correct_accusation_with_full_evidence(client: TestClient):
    sid = _new_session(client)
    _play_full(client, sid)
    body = client.post(f"/sessions/{sid}/accuse", json={"suspect": "bob"}).json()
    assert body["correct"] is True
    assert body["accused"] == "bob"
    assert body["support_level"] == "partial"  # Theo remains possible: honest tension
    supporting = {e["id"] for e in body["supporting"]}
    assert {"E_COAT", "E_WITNESS_MARA", "E_CLOCK", "E_LETTER"} <= supporting
    contradicting = {e["id"] for e in body["contradicting"]}
    assert {"E_MUD", "E_BOOTS", "E_CLAIM_THEO"} <= contradicting
    assert "theo" in body["other_suspects_provable"]
    assert "mara" not in body["other_suspects_provable"]
    assert "R_SUSPECT_003" in body["why"]
    assert body["leads_remaining"] == []
    # Persisted on the session.
    session = client.get(f"/sessions/{sid}").json()
    assert session["status"] == "complete"
    assert session["accused"] == "bob"
    assert session["correct"] is True


def test_wrong_accusation_is_graded_not_censored(client: TestClient):
    sid = _new_session(client)
    _play_full(client, sid)
    body = client.post(f"/sessions/{sid}/accuse", json={"suspect": "theo"}).json()
    assert body["correct"] is False
    assert body["support_level"] == "partial"  # Theo is genuinely plausible
    supporting = {e["id"] for e in body["supporting"]}
    assert "E_MUD" in supporting
    contradicting = {e["id"] for e in body["contradicting"]}
    assert "E_LETTER" in contradicting  # Bob's motive points elsewhere


def test_baseless_accusation_is_weak(client: TestClient):
    sid = _new_session(client)
    body = client.post(f"/sessions/{sid}/accuse", json={"suspect": "mara"}).json()
    assert body["correct"] is False
    assert body["support_level"] == "weak"
    assert body["supporting"] == []
    assert len(body["leads_remaining"]) == 10  # everything still unexamined


def test_lock_evidence_implicates_key_holders(client: TestClient):
    # R_MEANS_001: the undamaged lock points at everyone holding a key —
    # evidence for Mara too, yet never enough to make her a suspect.
    sid = _new_session(client)
    for obj in ("study_safe", "safe_lock", "bobs_coat"):
        assert client.post(f"/sessions/{sid}/interactions/{obj}").status_code == 200
    body = client.post(f"/sessions/{sid}/accuse", json={"suspect": "mara"}).json()
    assert body["correct"] is False
    assert body["support_level"] == "weak"
    assert {e["id"] for e in body["supporting"]} == {"E_LOCK"}
    assert body["other_suspects_provable"] == []


def test_right_answer_for_wrong_reasons_is_weak_but_correct(client: TestClient):
    sid = _new_session(client)
    body = client.post(f"/sessions/{sid}/accuse", json={"suspect": "bob"}).json()
    assert body["correct"] is True
    assert body["support_level"] == "weak"


def test_accusation_is_terminal(client: TestClient):
    sid = _new_session(client)
    assert client.post(f"/sessions/{sid}/accuse", json={"suspect": "mara"}).status_code == 200
    second = client.post(f"/sessions/{sid}/accuse", json={"suspect": "bob"})
    assert second.status_code == 409


def test_unknown_suspect_is_404(client: TestClient):
    sid = _new_session(client)
    assert client.post(f"/sessions/{sid}/accuse", json={"suspect": "moriarty"}).status_code == 404
    assert client.post("/sessions/deadbeef/accuse", json={"suspect": "bob"}).status_code == 404


def test_verdict_is_deterministic(client: TestClient):
    def verdict() -> dict:
        sid = _new_session(client)
        _play_full(client, sid)
        return client.post(f"/sessions/{sid}/accuse", json={"suspect": "bob"}).json()

    assert verdict() == verdict()
