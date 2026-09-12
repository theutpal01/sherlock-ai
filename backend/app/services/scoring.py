"""Deterministic scoring (assists milestone).

Correct accusation: 1000 base, minus hint and action costs, floored at
100, doubled in classic difficulty. Wrong accusation: 0 — the case is
either solved or it isn't.
"""

from __future__ import annotations

BASE_SCORE = 1000
HINT_COST = 50
ACTION_COST = 10
FLOOR_SCORE = 100
CLASSIC_MULTIPLIER = 2


def compute_score(*, correct: bool, hints_used: int, actions: int, difficulty: str) -> dict:
    """Return a full breakdown plus the total (pure function, tested)."""
    hint_cost = HINT_COST * hints_used
    action_cost = ACTION_COST * actions
    multiplier = CLASSIC_MULTIPLIER if difficulty == "classic" else 1
    if not correct:
        return {
            "base": BASE_SCORE,
            "hints": hints_used,
            "hint_cost": hint_cost,
            "actions": actions,
            "action_cost": action_cost,
            "multiplier": multiplier,
            "floor_applied": False,
            "total": 0,
        }
    subtotal = max(FLOOR_SCORE, BASE_SCORE - hint_cost - action_cost)
    return {
        "base": BASE_SCORE,
        "hints": hints_used,
        "hint_cost": hint_cost,
        "actions": actions,
        "action_cost": action_cost,
        "multiplier": multiplier,
        "floor_applied": subtotal == FLOOR_SCORE,
        "total": subtotal * multiplier,
    }
