"""Session/investigation endpoints (spec section 13, Phase 4 slice).

Route handlers stay thin: domain logic lives in services/reasoning.py.
Failed domain operations return non-200 statuses with structured detail.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession

from ..ai.facts import FactRecord
from ..ai.terms import Predicate
from ..db.database import get_db
from ..models.session import DialogueVisit, Discovery, Session, SessionHint
from ..schemas.session import (
    AccuseRequest,
    AccuseResponse,
    CompareRequest,
    CompareResponse,
    ContradictionItem,
    ContradictionsResponse,
    CreateSessionRequest,
    DerivedDetail,
    DialogueListEntry,
    DialogueListResponse,
    DialogueNodeDetail,
    DialogueVisitRequest,
    DialogueVisitResponse,
    EvidenceDetail,
    EvidenceListResponse,
    FactDetail,
    GraphFactLegend,
    GraphResponse,
    HintDetail,
    HintResponse,
    InteractResponse,
    KnowledgeResponse,
    LinkRequest,
    LinkResponse,
    MoveEventRequest,
    PrologExportResponse,
    ReasonQueryRequest,
    ReasonQueryResponse,
    ResolutionResponse,
    SessionResponse,
    SuspectComparison,
    WhatIfRequest,
    WhatIfResponse,
    WorldEventDetail,
    WorldNpc,
    WorldResponse,
)
from ..services import hints as hint_service
from ..services import reasoning, scoring
from ..services.case_loader import LoadedCase
from ..services.reasoning import DomainError
from .cases import _load as load_case_api

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _record_to_derived(record: FactRecord) -> DerivedDetail:
    return DerivedDetail(
        fact=FactDetail(
            name=record.predicate.name,
            args=list(record.predicate.args),
            source=record.source,
        ),
        fact_id=record.fact_id,
        rule_id=record.rule_id,
        supports=list(record.supports),
    )


def _session_response(db: DbSession, session: Session) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        case_id=session.case_id,
        status=session.status,
        current_room=session.current_room,
        event_counter=session.event_counter,
        discovered_evidence=reasoning.discovery_ids(db, session.id),
        visited_dialogue=reasoning.visited_nodes(db, session.id),
        accused=session.accused,
        correct=session.correct,
        difficulty=session.difficulty or "standard",
        hints_used=session.hints_used or 0,
        score=session.score,
    )


def _get_session(db: DbSession, session_id: str) -> Session:
    session = db.query(Session).filter_by(id=session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail=f"Unknown session: {session_id}")
    return session


def _get_case(case_id: str) -> LoadedCase:
    try:
        return load_case_api(case_id)
    except HTTPException as exc:
        raise DomainError(exc.status_code, str(exc.detail)) from exc


def _evidence_detail(case: LoadedCase, evidence_id: str) -> EvidenceDetail:
    item = case.evidence_by_id(evidence_id)
    assert item is not None
    return EvidenceDetail(
        id=item.id,
        title=item.title,
        description=item.description,
        location=item.location,
        category=item.category,
    )


@router.post("", response_model=SessionResponse)
def create_session(body: CreateSessionRequest, db: DbSession = Depends(get_db)):
    try:
        case = _get_case(body.case_id)
    except DomainError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc
    session = Session(
        id=uuid.uuid4().hex,
        case_id=case.meta.id,
        current_room=None,
        difficulty=body.difficulty,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_response(db, session)


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: DbSession = Depends(get_db)):
    return _session_response(db, _get_session(db, session_id))


@router.post("/{session_id}/move-event", response_model=SessionResponse)
def move_event(session_id: str, body: MoveEventRequest, db: DbSession = Depends(get_db)):
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    if body.room not in {r.id for r in case.rooms}:
        raise HTTPException(status_code=404, detail=f"Unknown room: {body.room}")
    # Movement is local traversal, not investigation time: no counter tick.
    session.current_room = body.room
    db.commit()
    return _session_response(db, session)


@router.post("/{session_id}/interactions/{object_id}", response_model=InteractResponse)
def interact(session_id: str, object_id: str, db: DbSession = Depends(get_db)):
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    obj = next((o for o in case.objects if o.id == object_id), None)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"Unknown object: {object_id}")
    if obj.evidence is None:
        raise HTTPException(status_code=409, detail=f"Object {object_id} hides nothing.")
    discovered = reasoning.discovery_ids(db, session.id)
    visited = reasoning.visited_nodes(db, session.id)

    if obj.evidence in discovered:
        kb = reasoning.build_kb(case, discovered)
        derived = reasoning.run_inference(case, kb)
        item = case.evidence_by_id(obj.evidence)
        assert item is not None
        return InteractResponse(
            evidence=_evidence_detail(case, item.id),
            already_discovered=True,
            new_facts=[],
            derived=[_record_to_derived(r) for r in derived],
            event_counter=session.event_counter,
        )
    if not case.can_discover(obj.evidence, set(discovered), set(visited)):
        world = reasoning.compute_world(case, discovered, visited)
        if obj.evidence not in world["unlocked"]:
            raise HTTPException(
                status_code=409,
                detail=f"Evidence {obj.evidence} is not yet available (a prerequisite is missing).",
            )
    kb_before = reasoning.build_kb(case, discovered)
    derived_before = {r.predicate for r in reasoning.run_inference(case, kb_before)}
    session.event_counter += 1
    db.add(Discovery(session_id=session.id, evidence_id=obj.evidence, seq=session.event_counter))
    db.commit()
    discovered = reasoning.discovery_ids(db, session.id)
    kb = reasoning.build_kb(case, discovered)
    new_derived = [
        r for r in reasoning.run_inference(case, kb) if r.predicate not in derived_before
    ]
    item = case.evidence_by_id(obj.evidence)
    assert item is not None
    return InteractResponse(
        evidence=_evidence_detail(case, item.id),
        already_discovered=False,
        new_facts=[
            FactDetail(name=r.name, args=list(r.args), source=item.id) for r in item.reveals
        ],
        derived=[_record_to_derived(r) for r in new_derived],
        event_counter=session.event_counter,
    )


@router.post("/{session_id}/dialogue", response_model=DialogueVisitResponse)
def visit_dialogue(session_id: str, body: DialogueVisitRequest, db: DbSession = Depends(get_db)):
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    node = next((d for d in case.dialogues if d.id == body.node_id), None)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Unknown dialogue: {body.node_id}")
    discovered = reasoning.discovery_ids(db, session.id)
    visited = reasoning.visited_nodes(db, session.id)
    if not all(r in discovered or r in visited for r in node.requires):
        raise HTTPException(
            status_code=409,
            detail=f"Dialogue {node.id} is not yet available.",
        )
    overheard = False
    if body.eavesdrop:
        # Overhearing grants the same node as talking, but only from the
        # speaker's current room — position is the price of admission.
        world = reasoning.compute_world(case, discovered, visited)
        npc_room = world["locations"].get(node.speaker)
        if session.current_room is None or session.current_room != npc_room:
            raise HTTPException(
                status_code=409,
                detail=f"You must share a room with {node.speaker} to overhear.",
            )
        overheard = True
    already = body.node_id in visited
    if not already:
        session.event_counter += 1
        db.add(DialogueVisit(session_id=session.id, node_id=node.id, seq=session.event_counter))
        db.commit()
        visited = reasoning.visited_nodes(db, session.id)
    # Testimony evidence bound to this node unlocks automatically.
    unlocked: list[EvidenceDetail] = []
    for item in case.evidence:
        disc = item.discovery
        if disc.kind != "dialogue" or disc.node_id != node.id:
            continue
        if item.id in discovered:
            continue
        if case.can_discover(item.id, set(discovered), set(visited)):
            session.event_counter += 1
            db.add(
                Discovery(
                    session_id=session.id,
                    evidence_id=item.id,
                    seq=session.event_counter,
                )
            )
            db.commit()
            discovered.append(item.id)
            unlocked.append(_evidence_detail(case, item.id))
    return DialogueVisitResponse(
        node=DialogueNodeDetail(
            id=node.id,
            speaker=node.speaker,
            text=node.text,
            responses=[r.model_dump() for r in node.responses],
        ),
        already_visited=already,
        unlocked_evidence=unlocked,
        event_counter=session.event_counter,
        overheard=overheard,
    )


@router.get("/{session_id}/evidence", response_model=EvidenceListResponse)
def list_evidence(session_id: str, db: DbSession = Depends(get_db)):
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    discovered = reasoning.discovery_ids(db, session.id)
    return EvidenceListResponse(evidence=[_evidence_detail(case, eid) for eid in discovered])


@router.get("/{session_id}/knowledge", response_model=KnowledgeResponse)
def get_knowledge(session_id: str, db: DbSession = Depends(get_db)):
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    known = [
        FactDetail(name=r.predicate.name, args=list(r.predicate.args), source=r.source)
        for r in kb.all_records()
    ]
    derived = [_record_to_derived(r) for r in reasoning.run_inference(case, kb)]
    return KnowledgeResponse(known=known, derived=derived)


@router.post("/{session_id}/reason/forward")
def reason_forward(session_id: str, db: DbSession = Depends(get_db)):
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    derived = reasoning.run_inference(case, kb)
    return {"derived": [_record_to_derived(r).model_dump() for r in derived]}


@router.post("/{session_id}/reason/query", response_model=ReasonQueryResponse)
def reason_query(session_id: str, body: ReasonQueryRequest, db: DbSession = Depends(get_db)):
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    goal = Predicate(name=body.goal.name, args=tuple(body.goal.args))
    node = reasoning.query_goal(case, kb, goal)
    proof = node.to_dict()

    def add_fact_origin(branch: dict) -> None:
        fact_id = branch.get("fact_id")
        record = kb.get(fact_id) if isinstance(fact_id, str) else None
        if record is not None:
            branch["category"] = record.category
            branch["source"] = record.source
        for child in branch.get("children", []):
            add_fact_origin(child)

    add_fact_origin(proof)
    return ReasonQueryResponse(
        success=node.success,
        proof=proof,
        why=reasoning.explain(case, kb, node),
    )


@router.get("/{session_id}/world", response_model=WorldResponse)
def get_world(session_id: str, db: DbSession = Depends(get_db)):
    """Deterministic world state: NPC locations + fired events + clock."""
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    world = reasoning.compute_world(
        case,
        reasoning.discovery_ids(db, session.id),
        reasoning.visited_nodes(db, session.id),
    )
    npcs = [
        WorldNpc(
            id=npc.id,
            name=npc.name,
            role=npc.role,
            location=world["locations"][npc.id],
        )
        for npc in case.npcs
    ]
    descriptions = {e.id: e.description for e in case.events}
    return WorldResponse(
        npcs=npcs,
        events_fired=world["fired"],
        events=[
            WorldEventDetail(id=eid, description=descriptions.get(eid, ""))
            for eid in world["fired"]
        ],
        unlocked_evidence=world["unlocked"],
        event_counter=session.event_counter,
    )


@router.get("/{session_id}/dialogue", response_model=DialogueListResponse)
def list_dialogue(session_id: str, db: DbSession = Depends(get_db)):
    """Dialogue catalogue WITHOUT node text: words unlock by visiting."""
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    discovered = set(reasoning.discovery_ids(db, session.id))
    visited = set(reasoning.visited_nodes(db, session.id))
    return DialogueListResponse(
        nodes=[
            DialogueListEntry(
                id=node.id,
                speaker=node.speaker,
                requires=list(node.requires),
                available=all(r in discovered or r in visited for r in node.requires),
                visited=node.id in visited,
            )
            for node in case.dialogues
        ]
    )


@router.post("/{session_id}/accuse", response_model=AccuseResponse)
def accuse(session_id: str, body: AccuseRequest, db: DbSession = Depends(get_db)):
    """Final accusation: graded against case truth, reported from evidence.

    Terminal per session: a second accusation returns 409.
    """
    session = _get_session(db, session_id)
    if session.status == "complete":
        raise HTTPException(status_code=409, detail="This case has already been adjudicated.")
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    reasoning.run_inference(case, kb)
    try:
        report = reasoning.evaluate_accusation(
            case, kb, reasoning.discovery_ids(db, session.id), body.suspect
        )
    except DomainError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc
    breakdown = scoring.compute_score(
        correct=report["correct"],
        hints_used=session.hints_used or 0,
        actions=session.event_counter,
        difficulty=session.difficulty or "standard",
    )
    session.status = "complete"
    session.accused = report["accused"]
    session.correct = report["correct"]
    session.score = breakdown["total"]
    session.completed_at = datetime.now(UTC)
    db.commit()
    return AccuseResponse(
        **report,
        solution_timeline=case.meta.truth.timeline,
        score=breakdown["total"],
        breakdown=breakdown,
    )


@router.get("/{session_id}/graph", response_model=GraphResponse)
def get_graph(session_id: str, db: DbSession = Depends(get_db)):
    """Semantic-network view over player-known facts ONLY.

    Built from the session KB (background + discovered reveals + derived
    conclusions). Undiscovered evidence and case truth never enter the
    graph — inspect freely, no spoilers.
    """
    from ..ai.semantic_network import to_node_link

    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    reasoning.run_inference(case, kb)
    data = to_node_link(kb)
    legend = {
        record.fact_id: GraphFactLegend(
            label=str(record.predicate),
            derived=record.derived,
            rule_id=record.rule_id,
            source=record.source,
            category=record.category,
        )
        for record in kb.all_records()
    }
    return GraphResponse(
        directed=bool(data.get("directed", True)),
        multigraph=bool(data.get("multigraph", True)),
        nodes=list(data.get("nodes", [])),
        links=list(data.get("links", data.get("edges", []))),
        facts=legend,
    )


@router.post("/{session_id}/hints", response_model=HintResponse)
def take_hint(session_id: str, db: DbSession = Depends(get_db)):
    """Next hint (−50 pts, no clock tick). Never repeats, never spoils.

    409 on closed sessions and in classic difficulty; 404 when no new
    eligible hint is available for the player's current progress.
    """
    session = _get_session(db, session_id)
    if session.status == "complete":
        raise HTTPException(status_code=409, detail="This case is already closed.")
    if (session.difficulty or "standard") == "classic":
        raise HTTPException(status_code=409, detail="Hints are disabled in classic difficulty.")
    case = _get_case(session.case_id)
    discovered = reasoning.discovery_ids(db, session.id)
    visited = reasoning.visited_nodes(db, session.id)
    kb = reasoning.build_kb(case, discovered)
    reasoning.run_inference(case, kb)
    provable = [
        suspect
        for suspect in case.meta.suspects
        if reasoning.query_goal(case, kb, Predicate("possible_suspect", (suspect,))).success
    ]
    world = reasoning.compute_world(case, discovered, visited)
    given = {row.hint_id for row in db.query(SessionHint).filter_by(session_id=session.id).all()}
    hint = hint_service.next_hint(
        case=case,
        discovered=set(discovered),
        visited=set(visited),
        locations=world["locations"],
        provable=provable,
        given=given,
    )
    if hint is None:
        raise HTTPException(
            status_code=404,
            detail="No new hint is available right now. Investigate further, then ask again.",
        )
    db.add(SessionHint(session_id=session.id, hint_id=hint.id))
    session.hints_used = (session.hints_used or 0) + 1
    db.commit()
    return HintResponse(
        hint=HintDetail(id=hint.id, kind=hint.kind, text=hint.text, cost=hint.cost),
        hints_used=session.hints_used,
        event_counter=session.event_counter,
    )


@router.post("/{session_id}/reason/resolution", response_model=ResolutionResponse)
def reason_resolution(session_id: str, body: ReasonQueryRequest, db: DbSession = Depends(get_db)):
    """Independent refutation cross-check (spec 8.4, Phase 8).

    Read-only verification path: proves the goal from BASE facts only
    (background + discovered, never derived shortcuts), so agreement with
    the primary engines is meaningful. Isolated — never used by gameplay.
    """
    from ..ai.resolution import resolution_prove

    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    base_facts = [
        (record.fact_id, record.predicate) for record in kb.all_records() if not record.derived
    ]
    goal = Predicate(name=body.goal.name, args=tuple(body.goal.args))
    result = resolution_prove(goal, base_facts, case.rules)
    return ResolutionResponse(**result.to_dict())


@router.post("/{session_id}/reason/whatif", response_model=WhatIfResponse)
def reason_whatif(session_id: str, body: WhatIfRequest, db: DbSession = Depends(get_db)):
    """Read-only sandbox: base KB minus excluded evidence plus hypotheticals.

    Never writes to the session, never touches the truth block, never
    concludes guilty(). 422 on unknown predicates/non-ground facts.
    """
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    discovered = reasoning.discovery_ids(db, session.id)
    try:
        result = reasoning.whatif_analysis(
            case,
            discovered,
            list(body.exclude_evidence),
            [Predicate(name=f.name, args=tuple(f.args)) for f in body.extra_facts],
        )
    except DomainError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc
    hypo_kb = result["derived"]
    return WhatIfResponse(
        base_suspects=result["base_suspects"],
        hypo_suspects=result["hypo_suspects"],
        added_suspects=result["added_suspects"],
        removed_suspects=result["removed_suspects"],
        derived=[_record_to_derived(r) for r in hypo_kb.all_records() if r.derived],
        new_derived_count=result["new_derived_count"],
    )


@router.get("/{session_id}/contradictions", response_model=ContradictionsResponse)
def get_contradictions(session_id: str, db: DbSession = Depends(get_db)):
    """Claim-vs-fact mismatches from player-known facts only (no spoilers)."""
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    reasoning.run_inference(case, kb)
    items = reasoning.contradiction_report(case, kb)
    return ContradictionsResponse(items=[ContradictionItem(**i) for i in items])


@router.post("/{session_id}/reason/compare", response_model=CompareResponse)
def reason_compare(session_id: str, body: CompareRequest, db: DbSession = Depends(get_db)):
    """Side-by-side provability WITHOUT revealing the culprit (no correct flag)."""
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    reasoning.run_inference(case, kb)
    try:
        rows = reasoning.compare_suspects(
            case, kb, reasoning.discovery_ids(db, session.id), list(body.suspects)
        )
    except DomainError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc
    return CompareResponse(compared=[SuspectComparison(**r) for r in rows])


@router.get("/{session_id}/knowledge/export", response_model=PrologExportResponse)
def export_knowledge(session_id: str, db: DbSession = Depends(get_db)):
    """Prolog-style dump of the player-known KB (base + derived, no truth)."""
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    reasoning.run_inference(case, kb)
    return PrologExportResponse(case_id=case.meta.id, prolog=reasoning.export_prolog(case, kb))


@router.post("/{session_id}/reason/link", response_model=LinkResponse)
def reason_link(session_id: str, body: LinkRequest, db: DbSession = Depends(get_db)):
    """Test whether two discovered evidence items jointly feed a conclusion."""
    session = _get_session(db, session_id)
    case = _get_case(session.case_id)
    discovered = set(reasoning.discovery_ids(db, session.id))
    kb = reasoning.build_kb(case, reasoning.discovery_ids(db, session.id))
    reasoning.run_inference(case, kb)
    try:
        result = reasoning.link_evidence(case, kb, discovered, body.a, body.b)
    except DomainError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc
    return LinkResponse(**result)
