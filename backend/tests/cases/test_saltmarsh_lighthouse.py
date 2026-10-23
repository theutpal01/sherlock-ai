"""Saltmarsh Lighthouse vertical-slice tests (Phase 10, case 3 bottle episode).

Exit condition: the third case loads with zero validation errors. Inference
checks then prove gating: case-facts-only KB yields no suspect, while the
fully-discovered KB yields exactly finn (never odda, never corwin, never
guilty). Odda is exonerated by the flour-apron rule placing her in the
galley at the crime time.
"""

from pathlib import Path

from app.ai.backward_chain import backward_chain
from app.ai.forward_chain import forward_chain
from app.ai.terms import Predicate
from app.services.case_loader import load_case

CASE_DIR = Path(__file__).resolve().parents[3] / "cases" / "saltmarsh_lighthouse"


def _load():
    return load_case(CASE_DIR)


def test_case_loads_with_zero_validation_errors():
    case = _load()
    assert case.meta.id == "saltmarsh_lighthouse"
    assert case.meta.truth.culprit == "finn"


def test_case_meets_bottle_episode_minimums():
    case = _load()
    room_ids = {r.id for r in case.rooms}
    assert {"causeway", "galley", "bunkroom", "lamp_room"} <= room_ids
    assert len(case.npcs) == 3
    assert len(case.evidence) >= 5
    assert 8 <= len(case.case_facts) + sum(len(e.reveals) for e in case.evidence) <= 20
    assert 5 <= len(case.rules) <= 12


def test_initial_kb_holds_no_suspect_and_no_truth():
    case = _load()
    kb = case.initial_kb()
    assert len(kb) == len(case.case_facts)
    assert not kb.contains(Predicate("guilty", ("finn",)))
    derived = forward_chain(kb, case.rules)
    assert not kb.contains(Predicate("possible_suspect", ("finn",)))
    assert not kb.contains(Predicate("possible_suspect", ("odda",)))
    assert all(d.name != "possible_suspect" for d in derived)


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


def test_full_discovery_yields_exactly_finn():
    case = _load()
    kb = _fully_discovered_kb(case)
    forward_chain(kb, case.rules)
    assert kb.contains(Predicate("possible_suspect", ("finn",)))
    # Odda's apron places her in the galley: exonerated, never a suspect.
    assert kb.contains(Predicate("was_at", ("odda", "galley", "23_40")))
    assert not kb.contains(Predicate("possible_suspect", ("odda",)))
    # Corwin holds the master key but has no motive or opportunity.
    assert not kb.contains(Predicate("possible_suspect", ("corwin",)))
    # Possibility is never proof.
    for person in ("finn", "odda", "corwin"):
        assert not kb.contains(Predicate("guilty", (person,)))


def test_backward_chain_proves_finn_but_not_odda():
    case = _load()
    kb = _fully_discovered_kb(case)
    assert backward_chain(Predicate("possible_suspect", ("finn",)), kb, case.rules).success
    assert not backward_chain(Predicate("possible_suspect", ("odda",)), kb, case.rules).success


def test_prerequisite_gating():
    case = _load()
    assert not case.can_discover("E_LOCK", set(), set())
    assert case.can_discover("E_LOCK", {"E_OIL"}, set())
    assert not case.can_discover("E_WITNESS_CORWIN", {"E_LAMP"}, set())
    assert case.can_discover("E_WITNESS_CORWIN", {"E_LAMP"}, {"corwin_lamp_02"})
    assert not case.can_discover("E_NOPE", set(), set())


def test_dialogue_trees_are_complete_chains():
    case = _load()
    assert len(case.dialogues) == 5
    by_id = {node.id: node for node in case.dialogues}
    for opener, follow in (
        ("corwin_lamp_01", "corwin_lamp_02"),
        ("finn_bunk_01", "finn_bunk_02"),
    ):
        assert follow in by_id
        assert opener in by_id[follow].requires
        assert any(r.next == follow for r in by_id[opener].responses)
    assert {e.id for e in case.evidence} == {
        "E_LAMP",
        "E_OIL",
        "E_LOCK",
        "E_COAT",
        "E_LEDGER",
        "E_PRINTS",
        "E_BOOTS",
        "E_APRON",
        "E_WITNESS_CORWIN",
        "E_CLAIM_FINN",
        "E_CLAIM_ODDA",
    }
