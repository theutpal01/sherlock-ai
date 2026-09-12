"""Semantic-network tests (spec Phase 7): the graph exposes discovered
and derived relations — and nothing else."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import app
from app.models import session as _session_models  # noqa: F401 (register tables)


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _new_session(client: TestClient) -> str:
    response = client.post("/sessions", json={"case_id": "blackwood_manor"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _graph(client: TestClient, sid: str) -> dict:
    response = client.get(f"/sessions/{sid}/graph")
    assert response.status_code == 200, response.text
    return response.json()


def test_graph_starts_with_background_only(client: TestClient):
    body = _graph(client, _new_session(client))
    assert body["directed"] is True
    dumped = str(body)
    assert "diamond" in dumped  # background: safe held the diamond
    assert "lennox" not in dumped  # E_LETTER hidden
    assert "field_mud" not in dumped  # E_MUD hidden
    # Key *compatibilities* are background; key *possession* by Bob is hidden.
    key_holders = {link["source"] for link in body["links"] if link["label"] == "has_key"}
    assert key_holders == {"mara"}
    labels = [link["label"] for link in body["links"]]
    assert "owes_money" not in labels
    assert "boot_matches" not in labels
    assert "possible_suspect" not in labels  # nothing derived yet


def test_graph_grows_with_discovery_and_derivation(client: TestClient):
    sid = _new_session(client)
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    body = _graph(client, sid)
    labels = [link["label"] for link in body["links"]]
    assert "clock_stopped_at" in labels
    derived_labels = [fact["label"] for fact in body["facts"].values() if fact["derived"]]
    assert "crime_time(21_17)" in derived_labels
    derived = {fid: fact for fid, fact in body["facts"].items() if fact["derived"]}
    time_facts = [f for f in derived.values() if f["label"] == "crime_time(21_17)"]
    assert len(time_facts) == 1
    assert time_facts[0]["rule_id"] == "R_TIME_001"
    # Hidden case content still absent.
    assert "lennox" not in str(body)


def test_graph_legend_marks_provenance(client: TestClient):
    sid = _new_session(client)
    client.post(f"/sessions/{sid}/interactions/grandfather_clock")
    body = _graph(client, sid)
    by_label = {fact["label"]: fact for fact in body["facts"].values()}
    assert by_label["clock_stopped_at(hall_clock, 21_17)"]["source"] == "E_CLOCK"
    assert by_label["clock_stopped_at(hall_clock, 21_17)"]["derived"] is False
    assert by_label["contains(study_safe, diamond)"]["category"] == "case"


def test_graph_is_deterministic(client: TestClient):
    def snapshot() -> dict:
        sid = _new_session(client)
        client.post(f"/sessions/{sid}/interactions/grandfather_clock")
        client.post(f"/sessions/{sid}/interactions/bobs_coat")
        return _graph(client, sid)

    first, second = snapshot(), snapshot()
    assert first["nodes"] == second["nodes"]
    assert first["links"] == second["links"]
    assert first["facts"] == second["facts"]


def test_graph_unknown_session_is_404(client: TestClient):
    assert client.get("/sessions/deadbeef/graph").status_code == 404
