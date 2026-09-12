"""Dynamic-world tests (spec Phase 5): deterministic NPC relocation,
dialogue gating/text-hiding, and the testimony chain order."""

from fastapi.testclient import TestClient

# `client` fixture lives in conftest.py (isolated in-memory DB per test).


def _new_session(client: TestClient) -> str:
    response = client.post("/sessions", json={"case_id": "blackwood_manor"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _world(client: TestClient, sid: str) -> dict:
    response = client.get(f"/sessions/{sid}/world")
    assert response.status_code == 200, response.text
    return response.json()


def _locations(world: dict) -> dict:
    return {npc["id"]: npc["location"] for npc in world["npcs"]}


def test_initial_world_matches_case_data(client: TestClient):
    world = _world(client, _new_session(client))
    assert _locations(world) == {"bob": "library", "mara": "hall", "theo": "garden"}
    assert world["events_fired"] == []
    assert world["event_counter"] == 0


def test_clock_discovery_relocates_mara(client: TestClient):
    sid = _new_session(client)
    assert client.post(f"/sessions/{sid}/interactions/grandfather_clock").status_code == 200
    world = _world(client, sid)
    assert world["events_fired"] == ["EVT_MARA_RELOCATE"]
    assert _locations(world)["mara"] == "library"
    assert _locations(world)["theo"] == "garden"  # untouched
    assert world["event_counter"] == 1  # the case clock ticked once


def test_mud_discovery_brings_theo_inside(client: TestClient):
    sid = _new_session(client)
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    assert client.post(f"/sessions/{sid}/interactions/muddy_prints").status_code == 200
    world = _world(client, sid)
    assert world["events_fired"] == ["EVT_MARA_RELOCATE", "EVT_THEO_CONFRONT"]
    assert _locations(world) == {"bob": "library", "mara": "library", "theo": "hall"}


def test_world_is_deterministic_across_sessions(client: TestClient):
    def play() -> dict:
        sid = _new_session(client)
        client.post(f"/sessions/{sid}/interactions/muddy_prints")
        client.post(f"/sessions/{sid}/interactions/grandfather_clock")
        return _world(client, sid)

    first, second = play(), play()
    assert _locations(first) == _locations(second)
    assert first["events_fired"] == second["events_fired"]


def test_dialogue_list_hides_text_until_visited(client: TestClient):
    sid = _new_session(client)
    catalogue = client.get(f"/sessions/{sid}/dialogue").json()["nodes"]
    assert catalogue
    dumped = str(catalogue)
    assert "Forgive me" not in dumped  # testimony words stay locked
    assert "swear it" not in dumped
    by_id = {n["id"]: n for n in catalogue}
    assert by_id["mara_clock_01"]["available"] is False  # needs E_CLOCK first
    assert by_id["theo_alibi_01"]["available"] is True


def test_testimony_chain_requires_order(client: TestClient):
    sid = _new_session(client)
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    # Jumping straight to the follow-up is rejected.
    assert (
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": "mara_clock_02"}).status_code
        == 409
    )
    assert (
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": "mara_clock_01"}).status_code
        == 200
    )
    assert (
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": "mara_clock_02"}).status_code
        == 200
    )
    # Revisits are idempotent: no extra clock tick.
    counter = client.get(f"/sessions/{sid}").json()["event_counter"]
    assert (
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": "mara_clock_02"}).status_code
        == 200
    )
    assert client.get(f"/sessions/{sid}").json()["event_counter"] == counter


def test_world_unknown_session_is_404(client: TestClient):
    assert client.get("/sessions/deadbeef/world").status_code == 404
    assert client.get("/sessions/deadbeef/dialogue").status_code == 404


def test_flavor_followup_grants_nothing_but_ticks_once(client: TestClient):
    sid = _new_session(client)
    # Theo's follow-up needs its opener first.
    assert (
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": "theo_alley_02"}).status_code
        == 409
    )
    assert (
        client.post(f"/sessions/{sid}/dialogue", json={"node_id": "theo_alibi_01"}).status_code
        == 200
    )
    before = client.get(f"/sessions/{sid}").json()["event_counter"]
    body = client.post(f"/sessions/{sid}/dialogue", json={"node_id": "theo_alley_02"}).json()
    assert "greenhouse" in body["node"]["text"]
    assert body["unlocked_evidence"] == []
    assert client.get(f"/sessions/{sid}").json()["event_counter"] == before + 1
    knowledge = client.get(f"/sessions/{sid}/knowledge").json()
    assert all(f["name"] != "greenhouse" for f in knowledge["known"])
