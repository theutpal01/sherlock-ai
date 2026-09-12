"""Forward chaining with proof provenance.

Process (spec 8.2):
1. inspect rules
2. unify rule conditions with known facts
3. derive a conclusion when ALL conditions hold under ONE consistent
   substitution
4. record proof provenance (rule_id + supporting fact IDs)
5. add only genuinely new facts
6. repeat until fixpoint (no new facts)

Terminates for finite fact/rule sets because every iteration must add at
least one new predicate and the Herbrand universe here is finite (no
function symbols generate new constants).
"""

from __future__ import annotations

from .facts import KnowledgeBase
from .rules import Rule
from .terms import Predicate
from .unify import Substitution, substitute, unify


def _find_substitutions(
    conditions: tuple[Predicate, ...],
    facts: list[Predicate],
    fact_ids: dict[Predicate, str],
) -> list[tuple[Substitution, list[str]]]:
    """Find all consistent substitutions satisfying every condition.

    Returns (substitution, supporting_fact_ids) pairs. Each condition is
    matched against all known facts; substitutions are threaded through
    so bindings stay consistent across conditions.
    """
    partials: list[tuple[Substitution, list[str]]] = [({}, [])]
    for condition in conditions:
        extended: list[tuple[Substitution, list[str]]] = []
        for subst, used_ids in partials:
            for fact in facts:
                match = unify(condition, fact, subst)
                if match is not None:
                    fid = fact_ids[fact]
                    # Avoid reusing the exact same ground fact for two
                    # different conditions unless the rule genuinely needs
                    # it twice; allow reuse but keep provenance accurate.
                    extended.append((match, [*used_ids, fid]))
        partials = extended
        if not partials:
            break
    return partials


def forward_chain(
    kb: KnowledgeBase, rules: list[Rule], max_iterations: int = 1000
) -> list[Predicate]:
    """Run forward chaining to fixpoint; mutate ``kb``; return new predicates."""
    derived: list[Predicate] = []
    for _ in range(max_iterations):
        facts = kb.all_predicates()
        fact_ids = {r.predicate: r.fact_id for r in kb.all_records()}
        newly_derived: list[tuple[Predicate, Rule, list[str]]] = []
        for rule in rules:
            for subst, supports in _find_substitutions(rule.conditions, facts, fact_ids):
                conclusion = substitute(rule.conclusion, subst)
                if not kb.contains(conclusion) and all(
                    c != conclusion for c, _, _ in newly_derived
                ):
                    newly_derived.append((conclusion, rule, supports))
        if not newly_derived:
            return derived
        for conclusion, rule, supports in newly_derived:
            kb.add(
                conclusion,
                category="derived",
                rule_id=rule.id,
                supports=supports,
            )
            derived.append(conclusion)
            facts.append(conclusion)
    raise RuntimeError("forward_chain did not reach fixpoint (possible rule loop)")
