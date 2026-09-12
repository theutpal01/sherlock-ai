"""API tests for the spoiler-safe case endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_cases_lists_blackwood_manor():
    response = client.get("/cases")
    assert response.status_code == 200
    ids = [c["id"] for c in response.json()["cases"]]
    assert "blackwood_manor" in ids
    assert "holloway_theatre" in ids


def test_case_detail_hides_truth_and_reveals():
    response = client.get("/cases/blackwood_manor")
    assert response.status_code == 200
    body = response.json()
    assert "truth" not in body
    dumped = response.text
    # Culprit name appears in NPC roster (unavoidable) but never as a
    # guilty verdict; reveals predicates stay server-side.
    assert "guilty" not in dumped
    for item in body["evidence"]:
        assert "reveals" not in item
    for node in body["dialogues"]:
        assert "text" not in node  # testimony words unlock by visiting
    assert "saw Mr. Bob near the study" not in dumped
    assert len(body["rooms"]) >= 5
    assert len(body["rules"]) >= 5


def test_unknown_case_is_404_not_200():
    response = client.get("/cases/no_such_case")
    assert response.status_code == 404
