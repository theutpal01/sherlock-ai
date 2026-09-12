"""Holloway Theatre vertical-slice tests: proves the engine and API are
data-driven — a second case loads, reasons, and adjudicates with zero
code changes outside the cases/ directory."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.ai.backward_chain import backward_chain
from app.ai.forward_chain import forward_chain
from app.ai.terms import Predicate
from app.services.case_loader import load_case

CASE_DIR = Path(__file__).resolve().parents[3] / "cases" / "holloway_theatre"

OBJECTS = (
    "call_bell",
    "violin_case",
    "veras_programme",
    "gambling_iou",
    "rosin_dust",
    "work_boots",
    "mended_curtain",
)
NODES = (
    "nell_bell_01",
    "nell_bell_02",
    "otto_alley_01",
    "vera_greet_01",
    "kit_work_01",
    "kit_work_02",
)


def test_case_loads_with_zero_validation_errors():
    case = load_case(CASE_DIR)
    assert case.meta.id == "holloway_theatre"
    assert case.meta.truth.culprit == "vera"


def test_case_meets_vertical_slice_minimums():
    case = load_case(CASE_DIR)
    assert len(case.rooms) >= 5
    assert len(case.npcs) == 4
    assert len(case.evidence) >= 5
    assert 8 <= len(case.case_facts) + sum(len(e.reveals) for e in case.evidence) <= 20
    # Second case runs slightly larger (dual opportunity rules + means rule);
    # the 5-10 guideline constrained the first vertical slice.
    assert 5 <= len(case.rules) <= 12


def test_dialogue_trees_are_complete_chains():
    case = load_case(CASE_DIR)
    assert len(case.dialogues) == 9
    by_id = {node.id: node for node in case.dialogues}
    for opener, follow in (
        ("nell_bell_01", "nell_bell_02"),
        ("nell_bell_02", "nell_foyer_02"),
        ("otto_alley_01", "otto_alley_02"),
        ("vera_greet_01", "vera_greet_02"),
        ("kit_work_01", "kit_work_02"),
    ):
        assert follow in by_id
        assert opener in by_id[follow].requires
        assert any(r.next == follow for r in by_id[opener].responses)


def _fully_discovered_kb(case):
    kb = case.initial_kb()
    for item in case.evidence:
        for revealed in item.reveals:
            kb.add(
                Predicate(name=revealed.name, args=tuple(revealed.args)),
                category="observed",
                source=item.id,
            )
    return kb


def test_full_discovery_names_vera_and_otto():
    case = load_case(CASE_DIR)
    kb = case.initial_kb()
    forward_chain(kb, case.rules)
    assert not kb.contains(Predicate("possible_suspect", ("vera",)))
    kb = _fully_discovered_kb(case)
    forward_chain(kb, case.rules)
    assert kb.contains(Predicate("possible_suspect", ("vera",)))
    assert kb.contains(Predicate("possible_suspect", ("otto",)))
    assert not kb.contains(Predicate("possible_suspect", ("nell",)))
    # Kit's mending places him in the workshop: exonerated, never a suspect.
    assert kb.contains(Predicate("was_at", ("kit", "workshop", "20_40")))
    assert not kb.contains(Predicate("possible_suspect", ("kit",)))
    assert not kb.contains(Predicate("guilty", ("vera",)))


def test_backward_chain_proves_vera_but_not_nell():
    case = load_case(CASE_DIR)
    kb = _fully_discovered_kb(case)
    assert backward_chain(Predicate("possible_suspect", ("vera",)), kb, case.rules).success
    assert not backward_chain(Predicate("possible_suspect", ("nell",)), kb, case.rules).success


def test_full_walkthrough_accuses_vera(client: TestClient):
    response = client.post("/sessions", json={"case_id": "holloway_theatre"})
    assert response.status_code == 200, response.text
    sid = response.json()["id"]
    for obj in OBJECTS:
        assert client.post(f"/sessions/{sid}/interactions/{obj}").status_code == 200
    for node in NODES:
        assert client.post(f"/sessions/{sid}/dialogue", json={"node_id": node}).status_code == 200
    body = client.post(f"/sessions/{sid}/accuse", json={"suspect": "vera"}).json()
    assert body["correct"] is True
    assert body["support_level"] == "partial"
    supporting = {e["id"] for e in body["supporting"]}
    assert {"E_PROGRAMME", "E_WITNESS_NELL", "E_BELL", "E_DEBTS"} <= supporting
    world = client.get(f"/sessions/{sid}/world").json()
    locations = {npc["id"]: npc["location"] for npc in world["npcs"]}
    assert locations == {"vera": "auditorium", "nell": "foyer", "otto": "stage", "kit": "foyer"}
