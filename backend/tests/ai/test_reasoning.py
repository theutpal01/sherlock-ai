"""Mandatory AI-core unit tests (spec section 17).

Covers: predicate equality/hashing, variable detection, unification
success/failure/conflicts, multi-condition binding, forward chaining
derivation + dedupe, backward chaining success/failure, cycles, provenance.
"""

from app.ai.backward_chain import backward_chain
from app.ai.explanation import render_why
from app.ai.facts import KnowledgeBase
from app.ai.forward_chain import forward_chain
from app.ai.rules import Rule
from app.ai.terms import Predicate, is_variable, parse_predicate
from app.ai.unify import substitute, unify


def make_kb() -> KnowledgeBase:
    kb = KnowledgeBase()
    kb.add(Predicate("has_key", ("bob", "safe_key")), category="case", fact_id="F_014")
    kb.add(Predicate("opens", ("safe_key", "study_safe")), category="case", fact_id="F_021")
    kb.add(Predicate("was_at", ("bob", "study", "21_17")), category="observed", fact_id="F_030")
    return kb


def access_rule() -> Rule:
    return Rule(
        id="R_ACCESS_001",
        description="A person possessing the matching key can access the safe.",
        conditions=(
            Predicate("has_key", ("?person", "?key")),
            Predicate("opens", ("?key", "?container")),
        ),
        conclusion=Predicate("can_access", ("?person", "?container")),
    )


def suspect_rule() -> Rule:
    return Rule(
        id="R_SUSPECT_003",
        description="Access plus presence marks a possible suspect (never guilt).",
        conditions=(
            Predicate("can_access", ("?person", "?container")),
            Predicate("was_at", ("?person", "?place", "?time")),
        ),
        conclusion=Predicate("possible_suspect", ("?person",)),
    )


def test_predicate_equality_and_hashing():
    assert Predicate("has_key", ("bob", "safe_key")) == Predicate("has_key", ("bob", "safe_key"))
    assert hash(Predicate("has_key", ("bob", "safe_key"))) == hash(
        Predicate("has_key", ("bob", "safe_key"))
    )
    assert Predicate("has_key", ("bob", "safe_key")) != Predicate("has_key", ("alice", "safe_key"))
    assert Predicate("a", ("x",)) != Predicate("b", ("x",))


def test_variable_detection():
    assert is_variable("?person")
    assert is_variable("?x")
    assert not is_variable("bob")
    assert not is_variable("?")
    assert not Predicate("has_key", ("bob", "?key")).is_ground()
    assert Predicate("has_key", ("bob", "safe_key")).is_ground()


def test_parse_predicate():
    assert parse_predicate("has_key(bob, safe_key)") == Predicate("has_key", ("bob", "safe_key"))


def test_unify_success():
    subst = unify(
        Predicate("has_key", ("?person", "safe_key")),
        Predicate("has_key", ("bob", "safe_key")),
    )
    assert subst == {"?person": "bob"}


def test_unify_failure_different_constants():
    assert (
        unify(
            Predicate("has_key", ("alice", "safe_key")),
            Predicate("has_key", ("bob", "safe_key")),
        )
        is None
    )


def test_unify_failure_name_or_arity():
    assert unify(Predicate("a", ("x",)), Predicate("b", ("x",))) is None
    assert unify(Predicate("a", ("x",)), Predicate("a", ("x", "y"))) is None


def test_unify_conflicting_bindings():
    # ?person cannot be both bob and alice across two conditions.
    s1 = unify(Predicate("p", ("?person",)), Predicate("p", ("bob",)), {})
    assert s1 is not None
    assert unify(Predicate("q", ("?person",)), Predicate("q", ("alice",)), s1) is None


def test_unify_variable_to_variable():
    subst = unify(Predicate("p", ("?x",)), Predicate("p", ("?y",)))
    assert subst is not None
    # Compatible binding: either ?x -> ?y or ?y -> ?x.
    assert subst in ({"?x": "?y"}, {"?y": "?x"})


def test_substitute():
    pred = substitute(
        Predicate("can_access", ("?person", "?container")),
        {"?person": "bob", "?container": "study_safe"},
    )
    assert pred == Predicate("can_access", ("bob", "study_safe"))


def test_forward_chain_derives_expected_fact():
    kb = make_kb()
    new = forward_chain(kb, [access_rule()])
    assert Predicate("can_access", ("bob", "study_safe")) in new
    assert kb.contains(Predicate("can_access", ("bob", "study_safe")))


def test_forward_chain_multi_condition_binding():
    kb = make_kb()
    forward_chain(kb, [access_rule(), suspect_rule()])
    assert kb.contains(Predicate("possible_suspect", ("bob",)))


def test_forward_chain_does_not_duplicate():
    kb = make_kb()
    first = forward_chain(kb, [access_rule()])
    assert len(first) == 1
    second = forward_chain(kb, [access_rule()])
    assert second == []
    assert len(kb) == 4  # 3 initial + 1 derived


def test_forward_chain_proof_provenance():
    kb = make_kb()
    forward_chain(kb, [access_rule()])
    record = kb.get_by_predicate(Predicate("can_access", ("bob", "study_safe")))
    assert record is not None
    assert record.derived is True
    assert record.rule_id == "R_ACCESS_001"
    assert set(record.supports) == {"F_014", "F_021"}


def test_backward_chain_success_provable_goal():
    kb = make_kb()
    forward_chain(kb, [access_rule()])
    node = backward_chain(Predicate("can_access", ("bob", "study_safe")), kb, [access_rule()])
    assert node.success is True


def test_backward_chain_proves_through_rules():
    kb = make_kb()
    node = backward_chain(
        Predicate("possible_suspect", ("bob",)),
        kb,
        [access_rule(), suspect_rule()],
    )
    assert node.success is True
    assert node.rule_id == "R_SUSPECT_003"
    assert len(node.children) == 2


def test_backward_chain_failure_unsupported_goal():
    kb = make_kb()
    node = backward_chain(
        Predicate("possible_suspect", ("alice",)),
        kb,
        [access_rule(), suspect_rule()],
    )
    assert node.success is False


def test_backward_chain_cycle_protection():
    kb = KnowledgeBase()
    kb.add(Predicate("p", ("a",)), category="case", fact_id="F_001")
    cyclic = Rule(
        id="R_CYCLE",
        description="p(a) proves p(a) -- must not hang.",
        conditions=(Predicate("p", ("a",)),),
        conclusion=Predicate("p", ("a",)),
    )
    node = backward_chain(Predicate("p", ("a",)), KnowledgeBase(), [cyclic])
    # Empty KB + self-referential rule: must terminate with failure, not hang.
    assert node.success is False


def test_guilt_never_derived_from_access_alone():
    """possible_suspect must never be confused with guilty (spec req 10)."""
    kb = make_kb()
    forward_chain(kb, [access_rule(), suspect_rule()])
    assert not kb.contains(Predicate("guilty", ("bob",)))


def test_why_rendering_uses_provenance():
    kb = make_kb()
    forward_chain(kb, [access_rule(), suspect_rule()])
    node = backward_chain(
        Predicate("possible_suspect", ("bob",)),
        kb,
        [access_rule(), suspect_rule()],
    )
    text = render_why(node, kb)
    assert "R_SUSPECT_003" in text
    assert "possible_suspect(bob)" in text
