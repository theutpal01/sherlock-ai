"""Resolution unit tests (spec 8.4): refutation proofs, traces,
termination, and agreement with the primary engines."""

from pathlib import Path

from app.ai.backward_chain import backward_chain
from app.ai.forward_chain import forward_chain
from app.ai.resolution import resolution_prove
from app.ai.rules import Rule
from app.ai.terms import Predicate
from app.services.case_loader import load_case

CASE_DIR = Path(__file__).resolve().parents[3] / "cases" / "blackwood_manor"


def access_rule() -> Rule:
    return Rule(
        id="R_ACCESS_001",
        description="key access",
        conditions=(
            Predicate("has_key", ("?person", "?key")),
            Predicate("opens", ("?key", "?container")),
        ),
        conclusion=Predicate("can_access", ("?person", "?container")),
    )


def test_proves_fact_through_rule():
    result = resolution_prove(
        Predicate("can_access", ("bob", "study_safe")),
        [
            ("F_014", Predicate("has_key", ("bob", "safe_key"))),
            ("F_021", Predicate("opens", ("safe_key", "study_safe"))),
        ],
        [access_rule()],
    )
    assert result.success is True
    assert result.used_clauses[0] == "R_ACCESS_001"
    assert any(s["parent_kind"] == "fact" for s in result.steps)
    assert result.steps[-1]["resolvent"] == []  # empty clause ends the refutation


def test_proves_unit_fact_directly():
    result = resolution_prove(
        Predicate("has_key", ("bob", "safe_key")),
        [("F_014", Predicate("has_key", ("bob", "safe_key")))],
        [access_rule()],
    )
    assert result.success is True
    assert result.used_clauses == ["F_014"]


def test_fails_for_unprovable_goal():
    result = resolution_prove(
        Predicate("guilty", ("bob",)),
        [("F_014", Predicate("has_key", ("bob", "safe_key")))],
        [access_rule()],
    )
    assert result.success is False
    assert result.steps == []


def test_variable_goal_returns_answer_substitution():
    result = resolution_prove(
        Predicate("can_access", ("?who", "study_safe")),
        [
            ("F_014", Predicate("has_key", ("bob", "safe_key"))),
            ("F_021", Predicate("opens", ("safe_key", "study_safe"))),
        ],
        [access_rule()],
    )
    assert result.success is True
    assert result.substitution == {"?who": "bob"}


def test_chained_rules_reuse_with_fresh_variables():
    r1 = Rule(
        id="R1",
        description="a via b",
        conditions=(Predicate("b", ("?x",)),),
        conclusion=Predicate("a", ("?x",)),
    )
    r2 = Rule(
        id="R2",
        description="b via c",
        conditions=(Predicate("c", ("?x",)),),
        conclusion=Predicate("b", ("?x",)),
    )
    result = resolution_prove(Predicate("a", ("z",)), [("F1", Predicate("c", ("z",)))], [r1, r2])
    assert result.success is True
    assert result.used_clauses == ["R1", "R2", "F1"]


def test_cyclic_rules_terminate_with_failure():
    loop = Rule(
        id="R_LOOP",
        description="self loop",
        conditions=(Predicate("p", ("?x",)),),
        conclusion=Predicate("p", ("?x",)),
    )
    result = resolution_prove(Predicate("p", ("a",)), [], [loop], max_steps=500)
    assert result.success is False


def test_agrees_with_backward_chaining_on_blackwood():
    """Cross-validation battery: both engines must agree on every goal."""
    case = load_case(CASE_DIR)
    kb = case.initial_kb()
    for item in case.evidence:
        for revealed in item.reveals:
            kb.add(
                Predicate(name=revealed.name, args=tuple(revealed.args)),
                category="observed",
                source=item.id,
            )
    forward_chain(kb, case.rules)
    base_facts = [(r.fact_id, r.predicate) for r in kb.all_records() if not r.derived]
    goals = [
        Predicate("possible_suspect", ("bob",)),
        Predicate("possible_suspect", ("theo",)),
        Predicate("possible_suspect", ("mara",)),
        Predicate("guilty", ("bob",)),
        Predicate("crime_time", ("21_17",)),
        Predicate("can_access", ("mara", "study_safe")),
        Predicate("has_motive", ("theo",)),
        Predicate("alibi_contradicted", ("bob",)),
    ]
    for goal in goals:
        expected = backward_chain(goal, kb, case.rules).success
        actual = resolution_prove(goal, base_facts, case.rules).success
        assert actual == expected, f"engines disagree on {goal}"
