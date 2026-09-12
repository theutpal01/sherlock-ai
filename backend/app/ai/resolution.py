"""Resolution refutation for definite (Horn) clauses (spec 8.4, Phase 8).

ISOLATION CONTRACT: this is a verification engine only. The gameplay
inference path (forward/backward chaining) never imports it; it is
exposed read-only so verdicts from the two engines can be cross-checked.
Bugs here cannot destabilize the working rule engine.

Method: SLD-style refutation. Facts are unit clauses, rules are definite
clauses, the goal is negated into a goal clause; each step resolves the
selected literal against a program clause, threading an answer
substitution. Success = empty resolvent (refutation complete).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .rules import Rule
from .terms import Predicate, is_variable
from .unify import Substitution, substitute, unify


@dataclass(frozen=True)
class Clause:
    """A definite clause: head :- body. Goal clauses have head=None."""

    id: str
    head: Predicate | None
    body: tuple[Predicate, ...] = ()


@dataclass
class RefutationResult:
    success: bool
    steps: list[dict] = field(default_factory=list)
    substitution: Substitution = field(default_factory=dict)
    used_clauses: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "steps": self.steps,
            "substitution": dict(self.substitution),
            "used_clauses": list(self.used_clauses),
        }


def _apply_term(term: str, subst: Substitution) -> str:
    seen: set[str] = set()
    while is_variable(term) and term in subst and term not in seen:
        seen.add(term)
        term = subst[term]
    return term


def _compose(sigma: Substitution, theta: Substitution) -> Substitution:
    """Compose substitutions: (sigma o theta)(x) = sigma(theta(x))."""
    out = {var: _apply_term(term, sigma) for var, term in theta.items()}
    for var, term in sigma.items():
        out.setdefault(var, term)
    return out


def _standardize(rule: Rule, counter: int) -> Clause:
    """Rename rule variables apart so repeated uses never clash."""

    def fresh(term: str) -> str:
        return f"{term}#{counter}" if is_variable(term) else term

    return Clause(
        id=rule.id,
        head=Predicate(
            name=rule.conclusion.name,
            args=tuple(fresh(a) for a in rule.conclusion.args),
        ),
        body=tuple(
            Predicate(name=c.name, args=tuple(fresh(a) for a in c.args)) for c in rule.conditions
        ),
    )


def _state_key(resolvent: list[Predicate], theta: Substitution) -> tuple[str, ...]:
    return tuple(sorted(str(substitute(lit, theta)) for lit in resolvent))


def resolution_prove(
    goal: Predicate,
    facts: list[tuple[str, Predicate]],
    rules: list[Rule],
    max_steps: int = 2000,
    max_depth: int = 50,
) -> RefutationResult:
    """Attempt refutation of NEG(goal); success proves goal entailed."""
    units = [Clause(id=fid, head=pred) for fid, pred in facts]
    steps: list[dict] = []
    used: list[str] = []
    state = {"count": 0, "std": 0}

    def dfs(
        resolvent: list[Predicate],
        theta: Substitution,
        depth: int,
        visited: frozenset[tuple[str, ...]],
    ) -> Substitution | None:
        state["count"] += 1
        if state["count"] > max_steps or depth > max_depth:
            return None
        if not resolvent:
            return theta
        key = _state_key(resolvent, theta)
        if key in visited:
            return None
        visited = visited | {key}
        selected, rest = resolvent[0], resolvent[1:]
        lit = substitute(selected, theta)

        # Unit clauses (facts) first: cheapest resolvents.
        for unit in units:
            assert unit.head is not None
            sigma = unify(lit, unit.head)
            if sigma is None:
                continue
            steps.append(
                {
                    "selected": str(lit),
                    "parent": unit.id,
                    "parent_kind": "fact",
                    "mgu": dict(sigma),
                    "resolvent": [str(substitute(r, _compose(sigma, theta))) for r in rest],
                }
            )
            used.append(unit.id)
            answer = dfs(rest, _compose(sigma, theta), depth + 1, visited)
            if answer is not None:
                return answer
            steps.pop()
            used.pop()

        # Definite clauses (rules), standardized apart per use.
        for rule in rules:
            std = _standardize(rule, state["std"])
            state["std"] += 1
            assert std.head is not None
            sigma = unify(lit, std.head)
            if sigma is None:
                continue
            theta2 = _compose(sigma, theta)
            extended = [*rest, *std.body]
            steps.append(
                {
                    "selected": str(lit),
                    "parent": std.id,
                    "parent_kind": "rule",
                    "mgu": {k: v for k, v in sigma.items() if "#" not in k},
                    "resolvent": [str(substitute(r, theta2)) for r in extended],
                }
            )
            used.append(std.id)
            answer = dfs(extended, theta2, depth + 1, visited)
            if answer is not None:
                return answer
            steps.pop()
            used.pop()
        return None

    answer = dfs([goal], {}, 0, frozenset())
    if answer is None:
        return RefutationResult(success=False)
    return RefutationResult(
        success=True,
        steps=steps,
        substitution={var: _apply_term(var, answer) for var in goal.args if is_variable(var)},
        used_clauses=used,
    )
