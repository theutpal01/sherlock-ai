"""Data and inference checks for The Glasshouse Orchid."""

from pathlib import Path

from app.ai.forward_chain import forward_chain
from app.ai.terms import Predicate
from app.services.case_loader import load_case

CASE_DIR = Path(__file__).resolve().parents[3] / "cases" / "glasshouse_orchid"


def _load():
    return load_case(CASE_DIR)


def test_case_loads_and_meets_investigation_minimums():
    case = _load()
    assert case.meta.id == "glasshouse_orchid"
    assert case.meta.truth.culprit == "celia"
    assert len(case.rooms) == 5
    assert len(case.npcs) == 3
    assert len(case.evidence) >= 10
    assert 8 <= len(case.rules) <= 12


def test_key_gate_and_discovery_prerequisites():
    case = _load()
    assert not case.can_discover("E_GLOVES", set(), set())
    assert not case.can_discover("E_ORCHID", {"E_TRACKS"}, set())
    assert case.can_discover("E_GLOVES", {"E_KEY"}, set())
    assert case.can_discover("E_ORCHID", {"E_TRACKS", "E_GLOVES"}, set())
    assert not case.can_discover("E_THEO_SIGHTING", set(), set())
    assert case.can_discover("E_THEO_SIGHTING", set(), {"theo_corridor_01"})


def test_full_evidence_makes_celia_a_possible_suspect_without_proving_guilt():
    case = _load()
    kb = case.initial_kb()
    for item in case.evidence:
        for revealed in item.reveals:
            kb.add(
                Predicate(name=revealed.name, args=tuple(revealed.args)),
                category="observed",
                source=item.id,
            )

    forward_chain(kb, case.rules)
    assert kb.contains(Predicate("possible_suspect", ("celia",)))
    assert not kb.contains(Predicate("possible_suspect", ("rowan",)))
    assert kb.contains(Predicate("alibi_contradicted", ("celia",)))
    assert kb.contains(Predicate("had_means", ("celia", "orchid_case")))
    assert kb.contains(Predicate("handled", ("celia", "moon_orchid")))
    assert all(not kb.contains(Predicate("guilty", (suspect,))) for suspect in ("celia", "rowan"))
