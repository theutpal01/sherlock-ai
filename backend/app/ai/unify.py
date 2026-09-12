"""Unification for predicates with ``?variable`` terms.

Required behavior (spec 8.1):
- constant == same constant -> success
- variable == constant     -> bind variable
- variable == variable     -> compatible binding
- different constants      -> fail
- bindings stay consistent across all conditions
"""

from __future__ import annotations

from .terms import Predicate, is_variable

Substitution = dict[str, str]


def _resolve(term: str, subst: Substitution) -> str:
    """Follow variable-to-variable chains to the current representative."""
    seen: set[str] = set()
    while is_variable(term) and term in subst and term not in seen:
        seen.add(term)
        term = subst[term]
    return term


def _bind(var: str, value: str, subst: Substitution) -> Substitution | None:
    """Bind variable ``var`` to ``value``; return None on conflict."""
    current = subst.get(var)
    if current is not None:
        # var already bound: value must unify with the existing binding.
        return unify_terms(current, value, subst)
    if is_variable(value):
        resolved = _resolve(value, subst)
        if resolved == var:
            return subst
        # Union the two variables: keep the existing binding if any.
        existing = subst.get(resolved)
        if existing is not None:
            return unify_terms(var, existing, subst)
        subst[var] = resolved
        return subst
    subst[var] = value
    return subst


def unify_terms(a: str, b: str, subst: Substitution) -> Substitution | None:
    """Unify two single terms under ``subst`` (mutates and returns it)."""
    a = _resolve(a, subst)
    b = _resolve(b, subst)
    if a == b:
        return subst
    if is_variable(a):
        return _bind(a, b, subst)
    if is_variable(b):
        return _bind(b, a, subst)
    return None  # two different constants


def unify(
    pattern: Predicate, fact: Predicate, subst: Substitution | None = None
) -> Substitution | None:
    """Unify ``pattern`` with ``fact``.

    Returns a new substitution dict on success, None on failure.
    Predicate names must match; arity must match.
    """
    if pattern.name != fact.name or len(pattern.args) != len(fact.args):
        return None
    working: Substitution = dict(subst) if subst else {}
    for p_arg, f_arg in zip(pattern.args, fact.args):
        if unify_terms(p_arg, f_arg, working) is None:
            return None
    return working


def substitute(predicate: Predicate, subst: Substitution) -> Predicate:
    """Apply a substitution to a predicate's arguments."""
    return Predicate(
        name=predicate.name,
        args=tuple(_resolve(a, subst) for a in predicate.args),
    )
