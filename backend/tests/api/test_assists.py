"""Detective-assist tests: hints, difficulty, scoring, and DB healing."""

import sqlite3

from fastapi.testclient import TestClient

from app.db.database import ensure_session_columns
from app.services.scoring import compute_score


def _new_session(client: TestClient, case="blackwood_manor", difficulty="standard"):
    payload = {"case_id": case}
    if difficulty != "standard":
        payload["difficulty"] = difficulty
    response = client.post("/sessions", json=payload)
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _hint(client: TestClient, sid: str):
    response = client.post(f"/sessions/{sid}/hints")
    assert response.status_code == 200, response.text
    return response.json()


def test_first_hints_meet_cast_then_clock(client: TestClient):
    # Deterministic priority: people first, then unexplored leads.
    sid = _new_session(client)
    ids = [_hint(client, sid)["hint"]["id"] for _ in range(4)]
    assert ids == ["talk:theo", "talk:bob", "talk:grey", "examine:E_CLOCK"]
    assert client.get(f"/sessions/{sid}").json()["event_counter"] == 0  # hints don't tick the clock


def test_gated_hint_jumps_queue_after_safe(client: TestClient):
    sid = _new_session(client)
    _hint(client, sid)  # talk:theo (given, undiscovered)
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    client.post(f"/sessions/{sid}/interactions/study_safe")
    hint = _hint(client, sid)
    assert hint["hint"]["id"] == "examine:E_LOCK"


def test_talk_hint_after_clock(client: TestClient):
    sid = _new_session(client)
    _hint(client, sid)
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    hint = _hint(client, sid)
    assert hint["hint"]["id"] == "talk:mara"


def test_review_hint_once_suspect_provable(client: TestClient):
    sid = _new_session(client)
    for obj in (
        "grandfather_clock",
        "study_safe",
        "safe_lock",
        "bobs_coat",
        "torn_letter",
        "muddy_prints",
        "garden_boots",
        "butlers_candle",
    ):
        client.post(f"/sessions/{sid}/interactions/{obj}")
    for node in (
        "mara_clock_01",
        "mara_clock_02",
        "theo_alibi_01",
        "bob_greet_01",
        "grey_cellar_01",
        "grey_cellar_02",
    ):
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": node})
    seen = set()
    for _ in range(30):
        response = client.post(f"/sessions/{sid}/hints")
        if response.status_code == 404:
            break
        seen.add(response.json()["hint"]["id"])
    assert "review:bob" in seen
    assert "review:theo" in seen
    assert "accuse:final" in seen
    # Exhausted: further requests stay 404 without charging.
    assert client.post(f"/sessions/{sid}/hints").status_code == 404


def test_hints_never_repeat_and_never_spoil(client: TestClient):
    sid = _new_session(client)
    hints = [_hint(client, sid)["hint"] for _ in range(3)]
    ids = [hint["id"] for hint in hints]
    assert len(set(ids)) == 3
    assert "lennox" not in str(hints).lower()


def test_classic_disables_hints(client: TestClient):
    sid = _new_session(client, difficulty="classic")
    assert client.get(f"/sessions/{sid}").json()["difficulty"] == "classic"
    assert client.post(f"/sessions/{sid}/hints").status_code == 409


def test_invalid_difficulty_rejected(client: TestClient):
    assert (
        client.post(
            "/sessions", json={"case_id": "blackwood_manor", "difficulty": "easy"}
        ).status_code
        == 422
    )


def test_perfect_standard_run_scores_860(client: TestClient):
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
    body = client.post(f"/sessions/{sid}/accuse", json={"suspect": "bob"}).json()
    assert body["score"] == 860  # 1000 - 10*14 actions, no hints
    assert body["breakdown"]["multiplier"] == 1
    assert client.get(f"/sessions/{sid}").json()["score"] == 860


def test_hint_costs_and_classic_doubles(client: TestClient):
    sid = _new_session(client)
    _hint(client, sid)
    for obj in ("grandfather_clock",):
        client.post(f"/sessions/{sid}/interactions/{obj}")
    # Wrong accusation scores nothing but records the attempt.
    body = client.post(f"/sessions/{sid}/accuse", json={"suspect": "mara"}).json()
    assert body["score"] == 0

    sid2 = _new_session(client, difficulty="classic")
    for obj in (
        "grandfather_clock",
        "study_safe",
        "safe_lock",
        "bobs_coat",
        "torn_letter",
        "muddy_prints",
        "garden_boots",
    ):
        client.post(f"/sessions/{sid2}/interactions/{obj}")
    for node in ("mara_clock_01", "mara_clock_02", "theo_alibi_01", "bob_greet_01"):
        client.post(f"/sessions/{sid2}/dialogue", json={"node_id": node})
    body2 = client.post(f"/sessions/{sid2}/accuse", json={"suspect": "bob"}).json()
    assert body2["score"] == 1720  # (1000 - 140) * 2


def test_hints_closed_after_accusation(client: TestClient):
    sid = _new_session(client)
    client.post(f"/sessions/{sid}/accuse", json={"suspect": "mara"})
    assert client.post(f"/sessions/{sid}/hints").status_code == 409


def test_scoring_math_unit():
    assert (
        compute_score(correct=True, hints_used=0, actions=0, difficulty="standard")["total"] == 1000
    )
    assert (
        compute_score(correct=True, hints_used=2, actions=10, difficulty="standard")["total"] == 800
    )
    assert (
        compute_score(correct=True, hints_used=0, actions=0, difficulty="classic")["total"] == 2000
    )
    assert (
        compute_score(correct=True, hints_used=99, actions=99, difficulty="standard")["total"]
        == 100
    )
    assert (
        compute_score(correct=False, hints_used=0, actions=0, difficulty="standard")["total"] == 0
    )


def test_legacy_database_heals_itself(tmp_path):
    """A pre-assists sessions table gains the new columns on init."""
    path = tmp_path / "legacy.db"
    con = sqlite3.connect(path)
    con.execute(
        "CREATE TABLE sessions (id VARCHAR PRIMARY KEY, case_id VARCHAR, "
        "status VARCHAR, current_room VARCHAR, event_counter INTEGER, created_at DATETIME)"
    )
    con.execute(
        "CREATE TABLE discoveries (id INTEGER PRIMARY KEY, session_id VARCHAR, evidence_id VARCHAR, seq INTEGER)"
    )
    con.execute(
        "CREATE TABLE dialogue_visits (id INTEGER PRIMARY KEY, session_id VARCHAR, node_id VARCHAR, seq INTEGER)"
    )
    con.execute(
        "CREATE TABLE session_hints (id INTEGER PRIMARY KEY, session_id VARCHAR, hint_id VARCHAR)"
    )
    con.commit()
    con.close()
    from sqlalchemy import create_engine

    engine = create_engine(f"sqlite:///{path}")
    ensure_session_columns(engine)
    cols = {row[1] for row in sqlite3.connect(path).execute("PRAGMA table_info(sessions)")}
    assert {"difficulty", "hints_used", "score", "accused"} <= cols
    # Idempotent: second run changes nothing.
    ensure_session_columns(engine)
