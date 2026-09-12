"""Data-driven case loader (spec Phase 2).

Loads the eight JSON case-definition files, validates shape (Pydantic)
plus cross-file reference integrity, and rejects:
- duplicate or missing stable IDs
- requires/discovery references pointing nowhere
- malformed rules, unbound conclusion variables, or any rule concluding
  guilty(X) — possibility is not proof (spec req 10)

The loader NEVER puts the authorial truth block into the player knowledge
base: world truth vs. player knowledge stay separated (spec section 7).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import ValidationError

from ..ai.facts import KnowledgeBase
from ..ai.rules import Rule
from ..ai.terms import Predicate, is_variable
from ..schemas.case import (
    CaseMetaModel,
    DialogueNodeModel,
    DoorModel,
    EventModel,
    EvidenceModel,
    NpcModel,
    ObjectModel,
    PredicateModel,
    RoomModel,
    RuleModel,
)

CASE_FILES = {
    "case": "case.json",
    "map": "map.json",
    "entities": "entities.json",
    "evidence": "evidence.json",
    "dialogues": "dialogues.json",
    "facts": "facts.json",
    "rules": "rules.json",
    "events": "events.json",
}


class CaseValidationError(ValueError):
    """Raised when a case directory fails validation."""


def _read_json(case_dir: Path, filename: str) -> dict:
    path = case_dir / filename
    if not path.is_file():
        raise CaseValidationError(f"Missing required case file: {filename}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise CaseValidationError(f"Invalid JSON in {filename}: {exc}") from exc
    if not isinstance(data, dict):
        raise CaseValidationError(f"Top level of {filename} must be an object")
    return data


def _unique(ids: list[str], kind: str) -> None:
    seen: set[str] = set()
    for item in ids:
        if item in seen:
            raise CaseValidationError(f"Duplicate {kind} id: {item}")
        seen.add(item)


def _to_predicate(model: PredicateModel, where: str) -> Predicate:
    if not model.name.strip():
        raise CaseValidationError(f"Empty predicate name in {where}")
    if any(not isinstance(a, str) or not a for a in model.args):
        raise CaseValidationError(f"Malformed predicate args in {where}")
    return Predicate(name=model.name, args=tuple(model.args))


def _check_rule_safety(rule: Rule) -> None:
    """Enforce variable safety + the never-guilty invariant."""
    if rule.conclusion.name == "guilty":
        raise CaseValidationError(f"Rule {rule.id} concludes guilty(): possibility is not proof.")
    bound: set[str] = set()
    for condition in rule.conditions:
        bound.update(a for a in condition.args if is_variable(a))
    for arg in rule.conclusion.args:
        if is_variable(arg) and arg not in bound:
            raise CaseValidationError(
                f"Rule {rule.id}: conclusion variable {arg} never appears in any condition."
            )


@dataclass
class LoadedCase:
    """A fully validated case, ready for session services (Phase 4+)."""

    meta: CaseMetaModel
    rooms: list[RoomModel] = field(default_factory=list)
    npcs: list[NpcModel] = field(default_factory=list)
    objects: list[ObjectModel] = field(default_factory=list)
    doors: list[DoorModel] = field(default_factory=list)
    evidence: list[EvidenceModel] = field(default_factory=list)
    dialogues: list[DialogueNodeModel] = field(default_factory=list)
    case_facts: list[Predicate] = field(default_factory=list)
    rules: list[Rule] = field(default_factory=list)
    events: list[EventModel] = field(default_factory=list)

    def evidence_by_id(self, evidence_id: str) -> EvidenceModel | None:
        return next((e for e in self.evidence if e.id == evidence_id), None)

    def initial_kb(self) -> KnowledgeBase:
        """Player knowledge at case start: background facts ONLY.

        Observed facts enter the KB exclusively through legitimate
        discovery (evidence/dialogue), and the truth block never does.
        """
        kb = KnowledgeBase()
        for predicate in self.case_facts:
            kb.add(predicate, category="case")
        return kb

    def can_discover(
        self,
        evidence_id: str,
        discovered_evidence: set[str],
        visited_dialogue: set[str],
    ) -> bool:
        """Prerequisite gate: every requirement must already be satisfied."""
        item = self.evidence_by_id(evidence_id)
        if item is None:
            return False
        return all(req in discovered_evidence or req in visited_dialogue for req in item.requires)


def load_case(case_dir: str | Path) -> LoadedCase:
    """Load and validate one case directory; raise CaseValidationError."""
    directory = Path(case_dir)
    try:
        raw = {key: _read_json(directory, name) for key, name in CASE_FILES.items()}
        meta = CaseMetaModel.model_validate(raw["case"])
        rooms = [RoomModel.model_validate(r) for r in raw["map"].get("rooms", [])]
        npcs = [NpcModel.model_validate(n) for n in raw["entities"].get("npcs", [])]
        objects = [ObjectModel.model_validate(o) for o in raw["entities"].get("objects", [])]
        doors = [DoorModel.model_validate(d) for d in raw["entities"].get("doors", [])]
        evidence = [EvidenceModel.model_validate(e) for e in raw["evidence"].get("evidence", [])]
        dialogues = [DialogueNodeModel.model_validate(d) for d in raw["dialogues"].get("nodes", [])]
        case_facts = [
            _to_predicate(PredicateModel.model_validate(f), "facts.json")
            for f in raw["facts"].get("case_facts", [])
        ]
        rule_models = [RuleModel.model_validate(r) for r in raw["rules"].get("rules", [])]
        events = [EventModel.model_validate(e) for e in raw["events"].get("events", [])]
    except ValidationError as exc:
        raise CaseValidationError(f"Schema validation failed: {exc}") from exc

    if meta.id != directory.name:
        raise CaseValidationError(
            f"Case id {meta.id!r} does not match directory {directory.name!r}."
        )

    room_ids = {r.id for r in rooms}
    npc_ids = {n.id for n in npcs}
    object_ids = {o.id for o in objects}
    evidence_ids = {e.id for e in evidence}
    dialogue_ids = {d.id for d in dialogues}
    _unique([r.id for r in rooms], "room")
    _unique([n.id for n in npcs], "npc")
    _unique([o.id for o in objects], "object")
    _unique([e.id for e in evidence], "evidence")
    _unique([d.id for d in dialogues], "dialogue node")

    if meta.start_location not in room_ids:
        raise CaseValidationError(f"start_location {meta.start_location!r} is not a known room.")
    for suspect in meta.suspects:
        if suspect not in npc_ids:
            raise CaseValidationError(f"Suspect {suspect!r} is not a known NPC.")
    if meta.truth.culprit not in npc_ids:
        raise CaseValidationError("Truth culprit is not a known NPC.")
    for room in rooms:
        for neighbour in room.adjacent:
            if neighbour not in room_ids:
                raise CaseValidationError(f"Room {room.id} links to unknown room {neighbour!r}.")
    for npc in npcs:
        if npc.location not in room_ids:
            raise CaseValidationError(f"NPC {npc.id} starts in unknown room {npc.location!r}.")
    for obj in objects:
        if obj.room not in room_ids:
            raise CaseValidationError(f"Object {obj.id} is in unknown room {obj.room!r}.")
        if obj.evidence is not None and obj.evidence not in evidence_ids:
            raise CaseValidationError(
                f"Object {obj.id} links to unknown evidence {obj.evidence!r}."
            )
    for door in doors:
        for side in door.between:
            if side not in room_ids:
                raise CaseValidationError(f"Door {door.id} links unknown room {side!r}.")
    for item in evidence:
        if item.location not in room_ids:
            raise CaseValidationError(f"Evidence {item.id} is in unknown room {item.location!r}.")
        for req in item.requires:
            if req not in evidence_ids and req not in dialogue_ids:
                raise CaseValidationError(f"Evidence {item.id} requires unknown {req!r}.")
        for revealed in item.reveals:
            _to_predicate(revealed, f"evidence {item.id}")
        disc = item.discovery
        if disc.kind == "interact" and disc.object_id not in object_ids:
            raise CaseValidationError(
                f"Evidence {item.id} binds to unknown object {disc.object_id!r}."
            )
        if disc.kind == "dialogue" and disc.node_id not in dialogue_ids:
            raise CaseValidationError(
                f"Evidence {item.id} binds to unknown dialogue {disc.node_id!r}."
            )
    for node in dialogues:
        if node.speaker not in npc_ids:
            raise CaseValidationError(f"Dialogue {node.id} has unknown speaker {node.speaker!r}.")
        for req in node.requires:
            if req not in evidence_ids and req not in dialogue_ids:
                raise CaseValidationError(f"Dialogue {node.id} requires unknown {req!r}.")
        for response in node.responses:
            if response.next not in dialogue_ids:
                raise CaseValidationError(
                    f"Dialogue {node.id} leads to unknown node {response.next!r}."
                )
    rules: list[Rule] = []
    seen_rules: set[str] = set()
    for model in rule_models:
        if model.id in seen_rules:
            raise CaseValidationError(f"Duplicate rule id: {model.id}")
        seen_rules.add(model.id)
        try:
            rule = Rule.from_dict(model.model_dump())
        except ValueError as exc:
            raise CaseValidationError(str(exc)) from exc
        _check_rule_safety(rule)
        rules.append(rule)
    for event in events:
        trigger, effect = event.trigger, event.effect
        if trigger.type == "evidence_discovered" and trigger.evidence not in evidence_ids:
            raise CaseValidationError(f"Event {event.id} triggers on unknown evidence.")
        if trigger.type == "dialogue_visited" and trigger.node not in dialogue_ids:
            raise CaseValidationError(f"Event {event.id} triggers on unknown node.")
        if effect.type == "move_npc" and (effect.npc not in npc_ids or effect.to not in room_ids):
            raise CaseValidationError(f"Event {event.id} moves NPC nowhere valid.")
        if effect.type == "unlock_evidence" and effect.evidence not in evidence_ids:
            raise CaseValidationError(f"Event {event.id} unlocks unknown evidence.")

    return LoadedCase(
        meta=meta,
        rooms=rooms,
        npcs=npcs,
        objects=objects,
        doors=doors,
        evidence=evidence,
        dialogues=dialogues,
        case_facts=case_facts,
        rules=rules,
        events=events,
    )


def list_cases(cases_dir: str | Path) -> list[LoadedCase]:
    """Load every valid case directory; skip unreadable ones explicitly."""
    root = Path(cases_dir)
    loaded: list[LoadedCase] = []
    if not root.is_dir():
        return loaded
    for child in sorted(root.iterdir()):
        if child.is_dir() and (child / "case.json").is_file():
            loaded.append(load_case(child))
    return loaded
