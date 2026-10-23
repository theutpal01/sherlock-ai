"""Eavesdrop tests (Phase 11): overhearing grants the same dialogue node as
talking, but only from the speaker's current room. Position is the price."""

from fastapi.testclient import TestClient


def _new_session(client: TestClient) -> str:
    response = client.post("/sessions", json={"case_id": "blackwood_manor"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _move(client: TestClient, sid: str, room: str) -> None:
    response = client.post(f"/sessions/{sid}/move-event", json={"room": room})
    assert response.status_code == 200, response.text


def _dialogue(client: TestClient, sid: str, node_id: str, eavesdrop: bool = False):
    return client.post(
        f"/sessions/{sid}/dialogue", json={"node_id": node_id, "eavesdrop": eavesdrop}
    )


def test_eavesdrop_from_speaker_room_succeeds(client: TestClient):
    sid = _new_session(client)
    _move(client, sid, "library")  # bob starts in the library
    response = _dialogue(client, sid, "bob_greet_01", eavesdrop=True)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overheard"] is True
    assert body["already_visited"] is False


def test_eavesdrop_from_wrong_room_fails(client: TestClient):
    sid = _new_session(client)
    # No movement yet: current_room is None, bob is in the library.
    response = _dialogue(client, sid, "bob_greet_01", eavesdrop=True)
    assert response.status_code == 409, response.text
    _move(client, sid, "garden")  # theo's garden, not bob's library
    response = _dialogue(client, sid, "bob_greet_01", eavesdrop=True)
    assert response.status_code == 409, response.text


def test_eavesdrop_chain_unlocks_testimony(client: TestClient):
    sid = _new_session(client)
    assert client.post(f"/sessions/{sid}/interactions/grandfather_clock").status_code == 200
    # E_CLOCK relocates mara to the library: overhear her there.
    _move(client, sid, "library")
    first = _dialogue(client, sid, "mara_clock_01", eavesdrop=True)
    assert first.status_code == 200, first.text
    second = _dialogue(client, sid, "mara_clock_02", eavesdrop=True)
    assert second.status_code == 200, second.text
    unlocked = [e["id"] for e in second.json()["unlocked_evidence"]]
    assert "E_WITNESS_MARA" in unlocked


def test_plain_talk_is_not_overheard(client: TestClient):
    sid = _new_session(client)
    _move(client, sid, "library")
    response = _dialogue(client, sid, "bob_greet_01")
    assert response.status_code == 200, response.text
    assert response.json()["overheard"] is False
