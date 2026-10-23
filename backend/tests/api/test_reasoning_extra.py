"""Phase 9 tests: what-if sandbox, contradictions, compare, prolog export.

All endpoints are read-only and spoiler-safe: no truth leak, no guilty()
hypotheses, no session mutation.
"""

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
    for obj in OBJECTS:
        assert client.post(f"/sessions/{sid}/interactions/{obj}").status_code == 200
    for node in NODES:
        assert client.post(f"/sessions/{sid}/dialogue", json={"node_id": node}).status_code == 200


def test_whatif_empty_matches_base(client: TestClient):
    sid = _new_session(client)
    body = client.post(f"/sessions/{sid}/reason/whatif", json={}).json()
    assert body["base_suspects"] == []
    assert body["hypo_suspects"] == []
    assert body["added_suspects"] == []
    assert body["removed_suspects"] == []


def test_whatif_is_readonly(client: TestClient):
    sid = _new_session(client)
    before = client.get(f"/sessions/{sid}").json()
    client.post(
        f"/sessions/{sid}/reason/whatif",
        json={"extra_facts": [{"name": "was_at", "args": ["theo", "study", "21_17"]}]},
    )
    after = client.get(f"/sessions/{sid}").json()
    assert after["event_counter"] == before["event_counter"]
    assert after["discovered_evidence"] == before["discovered_evidence"]


def test_whatif_excluding_everything_clears_suspects(client: TestClient):
    sid = _new_session(client)
    _play_full(client, sid)
    discovered = client.get(f"/sessions/{sid}").json()["discovered_evidence"]
    assert discovered
    body = client.post(
        f"/sessions/{sid}/reason/whatif", json={"exclude_evidence": discovered}
    ).json()
    assert body["base_suspects"] != []
    assert body["hypo_suspects"] == []
    assert set(body["removed_suspects"]) == set(body["base_suspects"])


def test_whatif_rejects_guilty_unknown_and_nonground(client: TestClient):
    sid = _new_session(client)
    assert (
        client.post(
            f"/sessions/{sid}/reason/whatif",
            json={"extra_facts": [{"name": "guilty", "args": ["bob"]}]},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/sessions/{sid}/reason/whatif",
            json={"extra_facts": [{"name": "nope_not_a_predicate", "args": ["bob"]}]},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/sessions/{sid}/reason/whatif",
            json={"extra_facts": [{"name": "was_at", "args": ["?person", "study", "21_17"]}]},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/sessions/{sid}/reason/whatif", json={"exclude_evidence": ["E_NOPE"]}
        ).status_code
        == 404
    )


def test_contradictions_initially_empty_and_spoiler_safe(client: TestClient):
    sid = _new_session(client)
    body = client.get(f"/sessions/{sid}/contradictions").json()
    assert body["items"] == []
    _play_full(client, sid)
    body = client.get(f"/sessions/{sid}/contradictions").json()
    assert isinstance(body["items"], list)
    assert "guilty" not in str(body)
    assert "lennox" not in str(body).lower()


def test_compare_never_reveals_correctness(client: TestClient):
    sid = _new_session(client)
    _play_full(client, sid)
    body = client.post(f"/sessions/{sid}/reason/compare", json={"suspects": ["bob", "theo"]}).json()
    assert "correct" not in str(body)
    by_id = {row["suspect"]: row for row in body["compared"]}
    assert by_id["bob"]["provable"] is True
    assert by_id["theo"]["provable"] is True
    assert by_id["bob"]["support_level"] in ("weak", "partial", "strong")
    assert by_id["bob"]["supporting"]
    assert by_id["bob"]["why"]


def test_compare_rejects_non_suspects(client: TestClient):
    sid = _new_session(client)
    assert (
        client.post(f"/sessions/{sid}/reason/compare", json={"suspects": ["grey"]}).status_code
        == 422
    )


def test_prolog_export_has_no_truth_leak(client: TestClient):
    sid = _new_session(client)
    body = client.get(f"/sessions/{sid}/knowledge/export").json()
    assert body["case_id"] == "blackwood_manor"
    assert "player-known facts only" in body["prolog"]
    assert "guilty(" not in body["prolog"]
