"""Pydantic contracts for the session/investigation API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    case_id: str = Field(min_length=1)
    difficulty: Literal["standard", "classic"] = "standard"


class SessionResponse(BaseModel):
    id: str
    case_id: str
    status: str
    current_room: str | None
    event_counter: int
    discovered_evidence: list[str]
    visited_dialogue: list[str]
    accused: str | None = None
    correct: bool | None = None
    difficulty: str = "standard"
    hints_used: int = 0
    score: int | None = None


class MoveEventRequest(BaseModel):
    room: str = Field(min_length=1)


class EvidenceDetail(BaseModel):
    id: str
    title: str
    description: str
    location: str
    category: Literal["key"] | None = None


class FactDetail(BaseModel):
    name: str
    args: list[str]
    source: str | None = None


class DerivedDetail(BaseModel):
    fact: FactDetail
    fact_id: str
    rule_id: str | None
    supports: list[str]


class InteractResponse(BaseModel):
    evidence: EvidenceDetail
    already_discovered: bool
    new_facts: list[FactDetail]
    derived: list[DerivedDetail]
    event_counter: int


class DialogueVisitRequest(BaseModel):
    node_id: str = Field(min_length=1)
    eavesdrop: bool = False


class DialogueNodeDetail(BaseModel):
    id: str
    speaker: str
    text: str
    responses: list[dict]


class DialogueVisitResponse(BaseModel):
    node: DialogueNodeDetail
    already_visited: bool
    unlocked_evidence: list[EvidenceDetail]
    event_counter: int
    overheard: bool = False


class KnowledgeResponse(BaseModel):
    known: list[FactDetail]
    derived: list[DerivedDetail]


class EvidenceListResponse(BaseModel):
    evidence: list[EvidenceDetail]


class GoalModel(BaseModel):
    name: str = Field(min_length=1)
    args: list[str] = Field(default_factory=list)


class ReasonQueryRequest(BaseModel):
    goal: GoalModel


class ReasonQueryResponse(BaseModel):
    success: bool
    proof: dict
    why: str


class WorldNpc(BaseModel):
    id: str
    name: str
    role: str
    location: str


class WorldEventDetail(BaseModel):
    id: str
    description: str


class WorldResponse(BaseModel):
    npcs: list[WorldNpc]
    events_fired: list[str]
    events: list[WorldEventDetail] = Field(default_factory=list)
    unlocked_evidence: list[str]
    event_counter: int


class DialogueListEntry(BaseModel):
    id: str
    speaker: str
    requires: list[str]
    available: bool
    visited: bool


class DialogueListResponse(BaseModel):
    nodes: list[DialogueListEntry]


class AccuseRequest(BaseModel):
    suspect: str = Field(min_length=1)


class ScoreBreakdown(BaseModel):
    base: int
    hints: int
    hint_cost: int
    actions: int
    action_cost: int
    multiplier: int
    floor_applied: bool
    total: int


class EvidenceCitation(BaseModel):
    id: str
    title: str
    via: list[str] = Field(default_factory=list)


class AccuseResponse(BaseModel):
    accused: str
    accused_name: str
    correct: bool
    support_level: str  # strong | partial | weak
    summary: str
    supporting: list[EvidenceCitation] = Field(default_factory=list)
    contradicting: list[EvidenceCitation] = Field(default_factory=list)
    other_suspects_provable: list[str] = Field(default_factory=list)
    leads_remaining: list[str] = Field(default_factory=list)
    leads_remaining_ids: list[str] = Field(default_factory=list)
    solution_timeline: list[str] = Field(default_factory=list)
    proof: dict
    why: str
    score: int = 0
    breakdown: ScoreBreakdown | None = None


class HintDetail(BaseModel):
    id: str
    kind: str
    text: str
    cost: int


class HintResponse(BaseModel):
    hint: HintDetail
    hints_used: int
    event_counter: int


class GraphFactLegend(BaseModel):
    label: str
    derived: bool
    rule_id: str | None = None
    source: str | None = None
    category: str


class GraphResponse(BaseModel):
    directed: bool
    multigraph: bool
    nodes: list[dict]
    links: list[dict]
    facts: dict[str, GraphFactLegend]


class ResolutionResponse(BaseModel):
    success: bool
    steps: list[dict] = Field(default_factory=list)
    substitution: dict[str, str] = Field(default_factory=dict)
    used_clauses: list[str] = Field(default_factory=list)


class WhatIfFact(BaseModel):
    name: str = Field(min_length=1)
    args: list[str] = Field(default_factory=list)


class WhatIfRequest(BaseModel):
    exclude_evidence: list[str] = Field(default_factory=list)
    extra_facts: list[WhatIfFact] = Field(default_factory=list)


class WhatIfResponse(BaseModel):
    base_suspects: list[str] = Field(default_factory=list)
    hypo_suspects: list[str] = Field(default_factory=list)
    added_suspects: list[str] = Field(default_factory=list)
    removed_suspects: list[str] = Field(default_factory=list)
    derived: list[DerivedDetail] = Field(default_factory=list)
    new_derived_count: int = 0


class ContradictionItem(BaseModel):
    person: str
    claimed_room: str = ""
    actual_room: str = ""
    time: str = ""
    kind: str
    rule_id: str = ""
    evidence_ids: list[str] = Field(default_factory=list)


class ContradictionsResponse(BaseModel):
    items: list[ContradictionItem] = Field(default_factory=list)


class CompareRequest(BaseModel):
    suspects: list[str] = Field(min_length=1)


class SuspectComparison(BaseModel):
    suspect: str
    provable: bool
    support_level: str
    supporting: list[EvidenceCitation] = Field(default_factory=list)
    contradicting: list[EvidenceCitation] = Field(default_factory=list)
    why: str = ""


class CompareResponse(BaseModel):
    compared: list[SuspectComparison] = Field(default_factory=list)


class PrologExportResponse(BaseModel):
    case_id: str
    prolog: str


class LinkRequest(BaseModel):
    a: str = Field(min_length=1)
    b: str = Field(min_length=1)


class EvidenceLink(BaseModel):
    conclusion: str
    via_rules: list[str] = Field(default_factory=list)


class LinkResponse(BaseModel):
    a: str
    b: str
    linked: bool
    links: list[EvidenceLink] = Field(default_factory=list)
