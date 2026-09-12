"""Deterministic hint engine (assists milestone).

Pure function of session state: same history always yields the same hint.
Hints reference PUBLIC structure (titles, rooms, speakers) plus the
player's own progress — never hidden predicates, never truth. Priority:
prerequisite chains first, then people, then unexplored leads, then
reviewing suspects, finally the accusation nudge.
"""

from __future__ import annotations

from dataclasses import dataclass

from .case_loader import LoadedCase
from .scoring import HINT_COST


@dataclass(frozen=True)
class Hint:
    id: str
    kind: str  # examine | talk | review | accuse
    text: str
    cost: int = HINT_COST


def next_hint(
    *,
    case: LoadedCase,
    discovered: set[str],
    visited: set[str],
    locations: dict[str, str],
    provable: list[str],
    given: set[str],
) -> Hint | None:
    """Return the next ungiven hint, or None when nothing is left."""
    rooms = {room.id: room.name for room in case.rooms}
    npcs = {npc.id: npc.name for npc in case.npcs}

    def room_of(item) -> str:
        return rooms.get(item.location, item.location)

    # 1. Prerequisite chains the player unlocked but hasn't followed.
    for item in case.evidence:
        if item.id in discovered or f"examine:{item.id}" in given:
            continue
        if item.discovery.kind != "interact":
            continue
        if not case.can_discover(item.id, discovered, visited):
            continue
        if item.requires:
            return Hint(
                id=f"examine:{item.id}",
                kind="examine",
                text=f"{item.title} ({room_of(item)}) deserves a closer look.",
            )

    # 2. People willing to talk.
    seen_speakers: set[str] = set()
    for node in case.dialogues:
        if node.id in visited or node.speaker in seen_speakers:
            continue
        seen_speakers.add(node.speaker)
        if not all(r in discovered or r in visited for r in node.requires):
            continue
        if f"talk:{node.speaker}" in given:
            continue
        room = rooms.get(locations.get(node.speaker, ""), "the manor")
        return Hint(
            id=f"talk:{node.speaker}",
            kind="talk",
            text=f"{npcs.get(node.speaker, node.speaker)} ({room}) may be willing to talk.",
        )

    # 3. Plain unexplored leads, in authorial order.
    for item in case.evidence:
        if item.id in discovered or f"examine:{item.id}" in given:
            continue
        if item.discovery.kind != "interact":
            continue
        if not case.can_discover(item.id, discovered, visited):
            continue
        return Hint(
            id=f"examine:{item.id}",
            kind="examine",
            text=f"You have not examined {item.title} ({room_of(item)}).",
        )

    # 4. Review a provable suspect's proof.
    for suspect in provable:
        if f"review:{suspect}" in given:
            continue
        return Hint(
            id=f"review:{suspect}",
            kind="review",
            text=f"The evidence against {npcs.get(suspect, suspect)} is worth reviewing (open WHY?).",
        )

    # 5. Everything examined: nudge the accusation.
    if len(discovered) == len(case.evidence) and "accuse:final" not in given:
        return Hint(
            id="accuse:final",
            kind="accuse",
            text="You have examined every lead. Time to name the culprit.",
        )
    return None
