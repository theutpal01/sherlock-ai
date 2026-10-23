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
    remaining_evidence = [e for e in case.evidence if e.id not in discovered]
    remaining = [e.title for e in remaining_evidence]
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
        "leads_remaining_ids": [e.id for e in remaining_evidence],
        "proof": node.to_dict(),
        "why": render_why(node, kb),
    }


def supporting_evidence(kb: KnowledgeBase, subject: str) -> dict[str, set[str]]:
    """Public wrapper over proof-provenance walk (no truth involved)."""
    return _ancestor_evidence(kb, subject)


def case_vocabulary(case: LoadedCase) -> set[str]:
    """Predicate names the player could legitimately hypothesize about.

    Built from background facts, evidence reveals, and rule
    conditions/conclusions — never from the truth block.
    """
    names: set[str] = set()
    for fact in case.case_facts:
        names.add(fact.name)
    for item in case.evidence:
        for revealed in item.reveals:
            names.add(revealed.name)
    for rule in case.rules:
        names.add(rule.conclusion.name)
        for condition in rule.conditions:
            names.add(condition.name)
    return names


def whatif_analysis(
    case: LoadedCase,
    discovered: list[str],
    exclude_evidence: list[str],
    extra_facts: list[Predicate],
) -> dict:
    """Read-only what-if: base KB minus excluded evidence plus hypotheticals.

    Raises DomainError on unknown evidence IDs, unknown predicate names,
    non-ground facts, or any attempt to hypothesize guilty().
    """
    known_ids = {e.id for e in case.evidence}
    for eid in exclude_evidence:
        if eid not in known_ids:
            raise DomainError(404, f"Unknown evidence: {eid}")
    vocab = case_vocabulary(case)
    for pred in extra_facts:
        if pred.name == "guilty":
            raise DomainError(
                422, "Hypothesizing guilty() is not allowed: possibility is not proof."
            )
        if pred.name not in vocab:
            raise DomainError(422, f"Unknown predicate: {pred.name}")
        if not pred.is_ground():
            raise DomainError(422, f"Hypothetical fact must be ground: {pred}")
    base_kb = build_kb(case, discovered)
    run_inference(case, base_kb)
    base_suspects = [
        s
        for s in case.meta.suspects
        if backward_chain(Predicate("possible_suspect", (s,)), base_kb, case.rules).success
    ]
    kept = [eid for eid in discovered if eid not in set(exclude_evidence)]
    hypo_kb = build_kb(case, kept)
    for pred in extra_facts:
        hypo_kb.add(pred, category="observed", source="whatif")
    derived = run_inference(case, hypo_kb)
    hypo_suspects = [
        s
        for s in case.meta.suspects
        if backward_chain(Predicate("possible_suspect", (s,)), hypo_kb, case.rules).success
    ]
    return {
        "base_suspects": sorted(base_suspects),
        "hypo_suspects": sorted(hypo_suspects),
        "added_suspects": sorted(set(hypo_suspects) - set(base_suspects)),
        "removed_suspects": sorted(set(base_suspects) - set(hypo_suspects)),
        "derived": hypo_kb,
        "new_derived_count": len(derived),
    }


def contradiction_report(case: LoadedCase, kb: KnowledgeBase) -> list[dict]:
    """Claim-vs-fact mismatches from player-known facts only.

    Matches claims_at(person, claimed_room, time) against
    was_at(person, actual_room, time) with claimed != actual, plus any
    derived alibi_contradicted(person) facts for rule context.
    """
    claims = {}
    facts = {}
    for record in kb.all_records():
        pred = record.predicate
        if pred.name == "claims_at" and len(pred.args) == 3:
            claims[(pred.args[0], pred.args[2])] = record
        elif pred.name == "was_at" and len(pred.args) == 3:
            facts[(pred.args[0], pred.args[2])] = record

    def evidence_sources(record, visited: set[str] | None = None) -> list[str]:
        visited = visited or set()
        if record.fact_id in visited:
            return []
        visited.add(record.fact_id)
        if record.source:
            return [record.source]
        sources: list[str] = []
        for support_id in record.supports:
            support = kb.get(support_id)
            if support is not None:
                sources.extend(evidence_sources(support, visited))
        return sources

    items: list[dict] = []
    for (person, moment), claim in sorted(claims.items()):
        actual = facts.get((person, moment))
        if actual is not None and actual.predicate.args[1] != claim.predicate.args[1]:
            items.append(
                {
                    "person": person,
                    "claimed_room": claim.predicate.args[1],
                    "actual_room": actual.predicate.args[1],
                    "time": moment,
                    "kind": "claim_vs_fact",
                    "evidence_ids": list(
                        dict.fromkeys(evidence_sources(claim) + evidence_sources(actual))
                    ),
                }
            )
    for record in kb.all_records():
        pred = record.predicate
        if pred.name == "alibi_contradicted" and pred.args:
            person = pred.args[0]
            if not any(i["person"] == person and i["kind"] == "alibi_rule" for i in items):
                items.append(
                    {
                        "person": person,
                        "claimed_room": "",
                        "actual_room": "",
                        "time": "",
                        "kind": "alibi_rule",
                        "rule_id": record.rule_id or "",
                        "evidence_ids": list(dict.fromkeys(evidence_sources(record))),
                    }
                )
    return items


def compare_suspects(
    case: LoadedCase, kb: KnowledgeBase, discovered: list[str], suspects: list[str]
) -> list[dict]:
    """Side-by-side provability WITHOUT revealing the culprit.

    Unlike evaluate_accusation (which reports correct/incorrect), this is
    spoiler-safe: support level + citations only.
    """
    unknown = [s for s in suspects if s not in case.meta.suspects]
    if unknown:
        raise DomainError(422, f"Not suspects in this case: {', '.join(unknown)}")
    own_maps = {s: _ancestor_evidence(kb, s) for s in suspects}
    out: list[dict] = []
    for suspect in suspects:
        node = backward_chain(Predicate("possible_suspect", (suspect,)), kb, case.rules)
        others = [s for s in suspects if s != suspect]
        others_provable = [
            s
            for s in others
            if backward_chain(Predicate("possible_suspect", (s,)), kb, case.rules).success
        ]
        level = "weak" if not node.success else ("strong" if not others_provable else "partial")
        own = own_maps[suspect]
        rival: dict[str, set[str]] = {}
        for other in others:
            for eid, preds in own_maps[other].items():
                rival.setdefault(eid, set()).update(preds)
        contradicting = {eid: preds for eid, preds in rival.items() if eid not in own}
        item = case.evidence_by_id
        out.append(
            {
                "suspect": suspect,
                "provable": node.success,
                "support_level": level,
                "supporting": [
                    {
                        "id": eid,
                        "title": (item(eid).title if item(eid) else eid),
                        "via": sorted(preds),
                    }
                    for eid, preds in sorted(own.items())
                ],
                "contradicting": [
                    {
                        "id": eid,
                        "title": (item(eid).title if item(eid) else eid),
                        "via": sorted(preds),
                    }
                    for eid, preds in sorted(contradicting.items())
                ],
                "why": render_why(node, kb),
            }
        )
    return out


def export_prolog(case: LoadedCase, kb: KnowledgeBase) -> str:
    """Prolog-style dump of the player-known KB (base + derived)."""
    lines = [f"% case: {case.meta.id} — player-known facts only, no truth block"]
    for record in kb.all_records():
        if not record.derived:
            lines.append(f"{record.predicate.name}({', '.join(record.predicate.args)}).")
    for record in kb.all_records():
        if record.derived:
            lines.append(
                f"% derived by {record.rule_id or '?'} from {', '.join(record.supports) or '?'}"
            )
            lines.append(f"{record.predicate.name}({', '.join(record.predicate.args)}).")
    return "\n".join(lines) + "\n"


def link_evidence(
    case: LoadedCase, kb: KnowledgeBase, discovered: set[str], a: str, b: str
) -> dict:
    """Test whether two discovered evidence items jointly feed a conclusion.

    Walks each derived conclusion's proof provenance; when BOTH items appear
    among its ancestor sources, the pair is linked via that conclusion and
    the rules on its proof path. Only discovered evidence is linkable, so an
    undiscovered id is a 404 and a self-pair is a 422. Fully generic: no
    predicate or evidence names are hard-coded.
    """
    if a == b:
        raise DomainError(422, "Cannot link evidence to itself.")
    for eid in (a, b):
        if case.evidence_by_id(eid) is None or eid not in discovered:
            raise DomainError(404, f"Evidence not discovered: {eid}")
    links: list[dict] = []
    for record in kb.all_records():
        if not record.derived:
            continue
        sources: set[str] = set()
        rules: set[str] = set()
        seen: set[str] = set()
        stack = [record.fact_id]
        while stack:
            fid = stack.pop()
            if fid in seen:
                continue
            seen.add(fid)
            node = kb.get(fid)
            if node is None:
                continue
            if node.derived and node.rule_id:
                rules.add(node.rule_id)
            if node.category == "observed" and node.source:
                sources.add(node.source)
            stack.extend(node.supports)
        if {a, b} <= sources:
            links.append({"conclusion": str(record.predicate), "via_rules": sorted(rules)})
    links.sort(key=lambda link: link["conclusion"])
    return {"a": a, "b": b, "linked": bool(links), "links": links}
