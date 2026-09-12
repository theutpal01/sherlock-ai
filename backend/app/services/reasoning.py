"""Reasoning service: session state -> knowledge base -> inference.

Owns the player-knowledge boundary: only case background facts plus
legitimately discovered evidence/dialogue ever enter the KB. Truth data
and undiscovered reveals are never consulted.
"""

from __future__ import annotations

from sqlalchemy.orm import Session as DbSession

from ..ai.backward_chain import ProofNode, backward_chain
from ..ai.explanation import render_why
from ..ai.facts import KnowledgeBase
from ..ai.forward_chain import forward_chain
from ..ai.terms import Predicate
from ..models.session import DialogueVisit, Discovery
from .case_loader import LoadedCase


class DomainError(Exception):
    """Failed domain operation: mapped to a non-200 status by the router."""

    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def discovery_ids(db: DbSession, session_id: str) -> list[str]:
    rows = db.query(Discovery).filter_by(session_id=session_id).order_by(Discovery.seq).all()
    return [r.evidence_id for r in rows]


def visited_nodes(db: DbSession, session_id: str) -> list[str]:
    rows = (
        db.query(DialogueVisit).filter_by(session_id=session_id).order_by(DialogueVisit.seq).all()
    )
    return [r.node_id for r in rows]


def build_kb(case: LoadedCase, discovered: list[str]) -> KnowledgeBase:
    """Player-known KB: background + discovered reveals (with sources)."""
    kb = case.initial_kb()
    for evidence_id in discovered:
        item = case.evidence_by_id(evidence_id)
        if item is None:
            continue
        for revealed in item.reveals:
            kb.add(
                Predicate(name=revealed.name, args=tuple(revealed.args)),
                category="observed",
                source=evidence_id,
            )
    return kb


def run_inference(case: LoadedCase, kb: KnowledgeBase):
    """Forward-chain to fixpoint; return derived FactRecords in order."""
    before = set(kb.all_predicates())
    forward_chain(kb, case.rules)
    return [r for r in kb.all_records() if r.predicate not in before]


def query_goal(case: LoadedCase, kb: KnowledgeBase, goal: Predicate) -> ProofNode:
    return backward_chain(goal, kb, case.rules)


def explain(case: LoadedCase, kb: KnowledgeBase, node: ProofNode) -> str:
    return render_why(node, kb)


def compute_world(case: LoadedCase, discovered: list[str], visited: list[str]) -> dict:
    """Deterministic world state: pure function of discovery history.

    Event evaluation order is file order, so replays always converge on
    the same NPC locations. No wall-clock, no randomness (spec section 9).
    """
    found, seen = set(discovered), set(visited)
    locations = {npc.id: npc.location for npc in case.npcs}
    fired: list[str] = []
    unlocked: list[str] = []
    for event in case.events:
        trigger = event.trigger
        hit = (
            (trigger.type == "evidence_discovered" and trigger.evidence in found)
            or (trigger.type == "dialogue_visited" and trigger.node in seen)
            or trigger.type == "case_start"
        )
        if not hit:
            continue
        fired.append(event.id)
        effect = event.effect
        if effect.type == "move_npc" and effect.npc and effect.to:
            locations[effect.npc] = effect.to
        elif effect.type == "unlock_evidence" and effect.evidence:
            unlocked.append(effect.evidence)
    return {"locations": locations, "fired": fired, "unlocked": unlocked}


def _ancestor_evidence(kb: KnowledgeBase, subject: str) -> dict[str, set[str]]:
    """Discovered evidence feeding any derived fact that mentions subject.

    Walks proof provenance (supports links) from every derived conclusion
    about the subject back to observed facts, grouped by evidence source.
    Fully generic: no predicate names are hard-coded.
    """
    derived = [r for r in kb.all_records() if r.derived and subject in r.predicate.args]
    support: dict[str, set[str]] = {}
    seen: set[str] = set()
    stack = [r.fact_id for r in derived]
    while stack:
        fid = stack.pop()
        if fid in seen:
            continue
        seen.add(fid)
        record = kb.get(fid)
        if record is None:
            continue
        if record.category == "observed" and record.source:
            support.setdefault(record.source, set()).add(str(record.predicate))
        stack.extend(record.supports)
    return support


def evaluate_accusation(
    case: LoadedCase, kb: KnowledgeBase, discovered: list[str], suspect: str
) -> dict:
    """Grade an accusation WITHOUT leaking truth into the knowledge base.

    Correctness is checked against the authorial truth block; everything
    the player sees (supporting/contradicting evidence, levels, proof)
    derives from player-known facts only.
    """
    npc_names = {npc.id: npc.name for npc in case.npcs}
    if suspect not in npc_names:
        raise DomainError(404, f"Unknown suspect: {suspect}")
    if suspect not in case.meta.suspects:
        raise DomainError(422, f"{suspect} is not a suspect in this case.")

    node = backward_chain(Predicate("possible_suspect", (suspect,)), kb, case.rules)
    others = [s for s in case.meta.suspects if s != suspect]
    others_provable = [
        s
        for s in others
        if backward_chain(Predicate("possible_suspect", (s,)), kb, case.rules).success
    ]
    own = _ancestor_evidence(kb, suspect)
    rival: dict[str, set[str]] = {}
    for other in others:
        for eid, preds in _ancestor_evidence(kb, other).items():
            rival.setdefault(eid, set()).update(preds)
    contradicting = {eid: preds for eid, preds in rival.items() if eid not in own}

    level = "weak" if not node.success else ("strong" if not others_provable else "partial")
    correct = suspect == case.meta.truth.culprit
    name = npc_names[suspect]

    def citations(mapping: dict[str, set[str]]) -> list[dict]:
        out = []
        for eid in sorted(mapping):
            item = case.evidence_by_id(eid)
            if item is None:
                continue
            out.append({"id": eid, "title": item.title, "via": sorted(mapping[eid])})
        return out

    other_names = [npc_names[s] for s in others_provable]
    if level == "strong":
        support_line = f"The discovered evidence establishes {name} as the only possible suspect."
    elif level == "partial":
        support_line = (
            f"{name} is a possible suspect, but cannot be isolated: "
            f"{', '.join(other_names)} also remain possible."
        )
    else:
        support_line = f"The discovered evidence does not establish {name} as a possible suspect."
    remaining = [e.title for e in case.evidence if e.id not in discovered]
    leads_line = (
        f" {len(remaining)} lead(s) remain unexamined."
        if remaining
        else " All known leads have been examined."
    )
    summary = (
        f"Accusation: {name} — {'CORRECT' if correct else 'INCORRECT'}. {support_line}{leads_line}"
    )
    return {
        "accused": suspect,
        "accused_name": name,
        "correct": correct,
        "support_level": level,
        "summary": summary,
        "supporting": citations(own),
        "contradicting": citations(contradicting),
        "other_suspects_provable": others_provable,
        "leads_remaining": remaining,
        "proof": node.to_dict(),
        "why": render_why(node, kb),
    }
