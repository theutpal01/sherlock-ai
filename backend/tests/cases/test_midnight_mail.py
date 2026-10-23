"""Data, progression, and inference checks for The Midnight Mail."""

from pathlib import Path

from app.ai.forward_chain import forward_chain
from app.ai.terms import Predicate
from app.services.case_loader import diagnose_case, load_case

CASE_DIR = Path(__file__).resolve().parents[3] / "cases" / "midnight_mail"


def _load():
    return load_case(CASE_DIR)


def test_case_loads_with_reachable_full_investigation():
    case = _load()
    assert case.meta.id == "midnight_mail"
    assert len(case.rooms) == 6
    assert len(case.npcs) == 3
    assert len(case.objects) == 12
    assert len(case.evidence) == 15
    assert len(case.rules) == 10
    assert diagnose_case(case) == []


def test_locked_van_key_and_hidden_dispatch_prerequisites():
    case = _load()
    assert not case.can_discover("E_GLOVES", set(), set())
    assert not case.can_discover("E_TRUNK", {"E_POUCH"}, set())
    assert case.can_discover("E_GLOVES", {"E_KEY"}, set())
    assert case.can_discover("E_TRUNK", {"E_POUCH", "E_STOP"}, set())
    assert "E_KEY" == next(d.unlock_evidence for d in case.doors if d.id == "postal_guard")


def test_complete_evidence_supports_ada_but_never_proves_guilt():
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
    assert kb.contains(Predicate("possible_suspect", ("ada",)))
    assert not kb.contains(Predicate("possible_suspect", ("finn",)))
    assert kb.contains(Predicate("method_consistent_with", ("clerk_punch", "dispatch_pouch")))
    assert all(not kb.contains(Predicate("guilty", (suspect,))) for suspect in ("ada", "finn"))
