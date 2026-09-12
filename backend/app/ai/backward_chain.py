"""Backward chaining: prove a goal, returning a proof tree.

Process (spec 8.3):
1. goal matches a known fact -> success leaf
2. else find rules whose conclusion unifies with the goal
3. rule conditions become sub-goals under that substitution
4. recursively prove each sub-goal (cycle-protected)
5. return success/failure plus a proof tree the UI can render
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .facts import KnowledgeBase
from .rules import Rule
from .terms import Predicate
from .unify import Substitution, substitute, unify


@dataclass
class ProofNode:
    goal: Predicate
    success: bool
    fact_id: str | None = None
    rule_id: str | None = None
    substitution: Substitution = field(default_factory=dict)
    children: list[ProofNode] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "goal": {"name": self.goal.name, "args": list(self.goal.args)},
            "success": self.success,
            "fact_id": self.fact_id,
            "rule_id": self.rule_id,
            "substitution": dict(self.substitution),
            "children": [c.to_dict() for c in self.children],
        }


def _expand_provenance(
    record, kb: KnowledgeBase, stack: tuple[Predicate, ...], depth: int
) -> ProofNode:
    """Build a proof subtree from a stored derived-fact record."""
    from .facts import FactRecord  # local import avoids a cycle

    assert isinstance(record, FactRecord)
    if record.derived and record.rule_id and record.predicate not in stack:
        children: list[ProofNode] = []
        for support_id in record.supports:
            support = kb.get(support_id)
            if support is None:
                continue
            children.append(_expand_provenance(support, kb, stack, depth + 1))
        return ProofNode(
            goal=record.predicate,
            success=True,
            fact_id=record.fact_id,
            rule_id=record.rule_id,
            children=children,
        )
    return ProofNode(goal=record.predicate, success=True, fact_id=record.fact_id)


def backward_chain(
    goal: Predicate,
    kb: KnowledgeBase,
    rules: list[Rule],
    _stack: tuple[Predicate, ...] = (),
    _depth: int = 0,
    _max_depth: int = 50,
) -> ProofNode:
    """Attempt to prove ``goal``; always returns a ProofNode (success flag)."""
    if _depth > _max_depth:
        return ProofNode(goal=goal, success=False)

    # 1. Direct match against a known fact (handles ground + variable goals).
    # When the matched fact is itself derived, expand its stored provenance
    # so WHY? shows the rule + supports instead of a bare leaf. This keeps
    # explanations truthful (they come from recorded provenance) while
    # still terminating via the _stack cycle guard.
    for record in kb.all_records():
        subst = unify(goal, record.predicate)
        if subst is not None:
            if record.derived and record.rule_id and record.predicate not in _stack:
                children: list[ProofNode] = []
                for support_id in record.supports:
                    support = kb.get(support_id)
                    if support is None:
                        continue
                    children.append(
                        _expand_provenance(support, kb, (*_stack, record.predicate), _depth + 1)
                    )
                return ProofNode(
                    goal=goal,
                    success=True,
                    fact_id=record.fact_id,
                    rule_id=record.rule_id,
                    substitution=subst,
                    children=children,
                )
            return ProofNode(
                goal=goal,
                success=True,
                fact_id=record.fact_id,
                substitution=subst,
            )

    # Cycle protection: do not re-enter a goal already on the stack.
    if goal in _stack:
        return ProofNode(goal=goal, success=False)

    # 2-4. Try rules whose conclusion can unify with the goal.
    for rule in rules:
        subst = unify(rule.conclusion, goal)
        if subst is None:
            continue
        sub_goals = [substitute(c, subst) for c in rule.conditions]
        children: list[ProofNode] = []
        ok = True
        for sub in sub_goals:
            child = backward_chain(sub, kb, rules, _stack=(*_stack, goal), _depth=_depth + 1)
            children.append(child)
            if not child.success:
                ok = False
                break
        if ok:
            return ProofNode(
                goal=goal,
                success=True,
                rule_id=rule.id,
                substitution=subst,
                children=children,
            )

    return ProofNode(goal=goal, success=False)
