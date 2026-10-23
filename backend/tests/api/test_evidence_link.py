"""Evidence-link tests (Phase 11): pairs of discovered evidence that jointly
feed a derived conclusion report the link with its proof path; unrelated
pairs report no link. Undiscovered ids 404, self-pairs 422."""

from fastapi.testclient import TestClient


def _new_session(client: TestClient) -> str:
    response = client.post("/sessions", json={"case_id": "blackwood_manor"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _discover(client: TestClient, sid: str, *object_ids: str) -> None:
    for object_id in object_ids:
        response = client.post(f"/sessions/{sid}/interactions/{object_id}")
        assert response.status_code == 200, (object_id, response.text)


def _link(client: TestClient, sid: str, a: str, b: str):
    return client.post(f"/sessions/{sid}/reason/link", json={"a": a, "b": b})


def test_prints_and_boots_link_through_the_print_rule(client: TestClient):
    sid = _new_session(client)
    _discover(client, sid, "grandfather_clock", "muddy_prints", "garden_boots")
    response = _link(client, sid, "E_MUD", "E_BOOTS")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["linked"] is True
    conclusions = [link["conclusion"] for link in body["links"]]
    assert "was_at(theo, study, 21_17)" in conclusions
    assert any("R_PRINT_001" in link["via_rules"] for link in body["links"])


def test_unrelated_pair_reports_no_link(client: TestClient):
    sid = _new_session(client)
    _discover(client, sid, "bobs_coat", "butlers_candle")
    response = _link(client, sid, "E_COAT", "E_CANDLE")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["linked"] is False
    assert body["links"] == []


def test_undiscovered_evidence_404s(client: TestClient):
    sid = _new_session(client)
    _discover(client, sid, "grandfather_clock")
    response = _link(client, sid, "E_CLOCK", "E_MUD")
    assert response.status_code == 404, response.text


def test_self_pair_422s(client: TestClient):
    sid = _new_session(client)
    _discover(client, sid, "grandfather_clock")
    response = _link(client, sid, "E_CLOCK", "E_CLOCK")
    assert response.status_code == 422, response.text
