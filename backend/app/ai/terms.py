"""Predicate / term model for the symbolic AI engine.

A predicate is a structured statement such as ``has_key(bob, safe_key)``.
Variables begin with ``?`` (e.g. ``?person``). Everything else is a constant.

This module is deliberately independent from FastAPI/SQLAlchemy so the
inference engine can be unit-tested without any game UI.
"""

from __future__ import annotations

from dataclasses import dataclass


def is_variable(term: str) -> bool:
    """Return True when a term is a logic variable (starts with '?')."""
    return term.startswith("?") and len(term) > 1


@dataclass(frozen=True)
class Predicate:
    """Immutable structured statement: name + ordered argument tuple."""

    name: str
    args: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("Predicate name must be non-empty")
        # Normalise list input to tuple while keeping frozen semantics.
        if isinstance(self.args, list):  # type: ignore[unreachable]
            object.__setattr__(self, "args", tuple(self.args))

    def __str__(self) -> str:
        return f"{self.name}({', '.join(self.args)})"

    def is_ground(self) -> bool:
        """True when the predicate contains no variables."""
        return all(not is_variable(a) for a in self.args)


def parse_predicate(text: str) -> Predicate:
    """Parse ``name(arg1, arg2)`` into a Predicate (test/convenience helper)."""
    text = text.strip()
    if "(" not in text or not text.endswith(")"):
        raise ValueError(f"Invalid predicate string: {text!r}")
    name, rest = text.split("(", 1)
    name = name.strip()
    inner = rest[:-1].strip()
    args = tuple(a.strip() for a in inner.split(",")) if inner else ()
    if not name:
        raise ValueError(f"Invalid predicate string: {text!r}")
    return Predicate(name=name, args=args)
