"""Blackwood Manor vertical-slice tests (spec sections 12 + 18/Phase 2).

Exit condition: one case loads with zero validation errors. Inference
checks then prove gating: case-facts-only KB yields no suspect, while the
fully-discovered KB yields exactly bob + theo (never mara, never guilty).
"""

from pathlib import Path

from app.ai.backward_chain import backward_chain
from app.ai.forward_chain import forward_chain
from app.ai.terms import Predicate
from app.services.case_loader import load_case

CASE_DIR = Path(__file__).resolve().parents[3] / "cases" / "blackwood_manor"


def _load():
    case = load_case(CASE_DIR)
    return case


def test_case_loads_with_zero_validation_errors():
    case = _load()
    assert case.meta.id == "blackwood_manor"
    assert case.meta.truth.culprit == "bob"


def test_case_meets_vertical_slice_minimums():
    case = _load()
    room_ids = {r.id for r in case.rooms}
    assert {"entrance", "corridor", "library", "hall", "study", "garden", "cellar"} <= room_ids
    assert len(case.npcs) == 4
    assert len(case.evidence) >= 5
    assert 8 <= len(case.case_facts) + sum(len(e.reveals) for e in case.evidence) <= 20
    # The cellar wing added one rule past the original 5-10 guideline.
    assert 5 <= len(case.rules) <= 12


def test_initial_kb_holds_no_suspect_and_no_truth():
    case = _load()
    kb = case.initial_kb()
    assert len(kb) == len(case.case_facts)
    # Truth block predicates (culprit identity) must not leak into the KB.
    assert not kb.contains(Predicate("guilty", ("bob",)))
    derived = forward_chain(kb, case.rules)
    assert not kb.contains(Predicate("possible_suspect", ("bob",)))
    assert not kb.contains(Predicate("possible_suspect", ("theo",)))
    assert not kb.contains(Predicate("possible_suspect", ("mara",)))
    # Background alone may derive access facts, but never a suspect.
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


def test_full_discovery_yields_two_plausible_suspects():
    case = _load()
    kb = _fully_discovered_kb(case)
    forward_chain(kb, case.rules)
    assert kb.contains(Predicate("possible_suspect", ("bob",)))
    assert kb.contains(Predicate("possible_suspect", ("theo",)))
    # Mara has access but no opportunity: correctly excluded.
    assert not kb.contains(Predicate("possible_suspect", ("mara",)))
    # Grey's candle places him in the cellar: exonerated, never a suspect.
    assert kb.contains(Predicate("was_at", ("grey", "cellar", "21_17")))
    assert not kb.contains(Predicate("possible_suspect", ("grey",)))
    # Possibility is never proof.
    for person in ("bob", "theo", "mara"):
        assert not kb.contains(Predicate("guilty", (person,)))


def test_backward_chain_proves_bob_but_not_mara():
    case = _load()
    kb = _fully_discovered_kb(case)
    assert backward_chain(Predicate("possible_suspect", ("bob",)), kb, case.rules).success
    assert not backward_chain(Predicate("possible_suspect", ("mara",)), kb, case.rules).success


def test_prerequisite_gating():
    case = _load()
    assert not case.can_discover("E_LOCK", set(), set())
    assert case.can_discover("E_LOCK", {"E_SAFE"}, set())
    # Dialogue-gated testimony needs the dialogue node visited.
    assert not case.can_discover("E_WITNESS_MARA", {"E_CLOCK"}, set())
    assert case.can_discover("E_WITNESS_MARA", {"E_CLOCK"}, {"mara_clock_02"})
    assert not case.can_discover("E_NOPE", set(), set())


def test_dialogue_trees_are_complete_chains():
    case = _load()
    assert len(case.dialogues) == 9
    by_id = {node.id: node for node in case.dialogues}
    # Follow-ups chain off their openers and every response resolves.
    for opener, follow in (
        ("mara_clock_01", "mara_clock_02"),
        ("mara_clock_02", "mara_hall_02"),
        ("theo_alibi_01", "theo_alley_02"),
        ("bob_greet_01", "bob_greet_02"),
        ("grey_cellar_01", "grey_cellar_02"),
    ):
        assert follow in by_id
        assert opener in by_id[follow].requires
        assert any(r.next == follow for r in by_id[opener].responses)
    # Flavor follow-ups grant no facts: inference surface is unchanged.
    assert {e.id for e in case.evidence} == {
        "E_CLOCK",
        "E_SAFE",
        "E_LOCK",
        "E_COAT",
        "E_LETTER",
        "E_MUD",
        "E_BOOTS",
        "E_WITNESS_MARA",
        "E_CLAIM_THEO",
        "E_CLAIM_BOB",
        "E_CANDLE",
        "E_CLAIM_GREY",
    }
