"""Pydantic schemas for the JSON case-definition files (spec section 5).

These validate SHAPE at the API boundary. Cross-file reference integrity
(stable IDs, requires chains, rule safety) is enforced by the case loader
in app/services/case_loader.py.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PredicateModel(BaseModel):
    name: str = Field(min_length=1)
    args: list[str] = Field(default_factory=list)


class RuleModel(BaseModel):
    id: str = Field(min_length=1)
    description: str = ""
    conditions: list[PredicateModel] = Field(min_length=1)
    conclusion: PredicateModel


class DiscoveryModel(BaseModel):
    kind: Literal["interact", "dialogue"]
    object_id: str | None = None
    node_id: str | None = None


class EvidenceModel(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = ""
    location: str = Field(min_length=1)
    category: Literal["key"] | None = None
    requires: list[str] = Field(default_factory=list)
    reveals: list[PredicateModel] = Field(min_length=1)
    discovery: DiscoveryModel


class DialogueResponseModel(BaseModel):
    text: str = Field(min_length=1)
    next: str = Field(min_length=1)


class DialogueNodeModel(BaseModel):
    id: str = Field(min_length=1)
    speaker: str = Field(min_length=1)
    requires: list[str] = Field(default_factory=list)
    text: str = Field(min_length=1)
    responses: list[DialogueResponseModel] = Field(default_factory=list)


class RoomModel(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = ""
    adjacent: list[str] = Field(default_factory=list)
    spawn: list[float] = Field(default_factory=list)


class NpcModel(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    role: str = ""
    location: str = Field(min_length=1)
    description: str = ""


class ObjectModel(BaseModel):
    id: str = Field(min_length=1)
    room: str = Field(min_length=1)
    label: str = Field(min_length=1)
    evidence: str | None = None


class DoorModel(BaseModel):
    id: str = Field(min_length=1)
    between: list[str] = Field(min_length=2, max_length=2)
    locked: bool = False
    unlock_evidence: str | None = None
    lock_hint: str = ""
    note: str = ""


class EventTriggerModel(BaseModel):
    type: Literal["evidence_discovered", "dialogue_visited", "case_start"]
    evidence: str | None = None
    node: str | None = None


class EventEffectModel(BaseModel):
    type: Literal["move_npc", "unlock_evidence"]
    npc: str | None = None
    to: str | None = None
    evidence: str | None = None


class EventModel(BaseModel):
    id: str = Field(min_length=1)
    description: str = ""
    trigger: EventTriggerModel
    effect: EventEffectModel


class TruthModel(BaseModel):
    culprit: str = Field(min_length=1)
    summary: str = ""
    timeline: list[str] = Field(default_factory=list)


class CaseMetaModel(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = ""
    version: str = "0.1.0"
    start_location: str = Field(min_length=1)
    suspects: list[str] = Field(min_length=1)
    truth: TruthModel
