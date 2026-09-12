"""Explanation traces generated FROM stored proof provenance.

Never fabricate explanations: every derived conclusion renders the rule
and supporting facts recorded at inference time (fact/rule IDs included
so the UI can link back to evidence).
"""

from __future__ import annotations

from .backward_chain import ProofNode
from .facts import KnowledgeBase
from .terms import Predicate


def _short(predicate: Predicate) -> str:
    return str(predicate)


def render_proof_tree(node: ProofNode, kb: KnowledgeBase, indent: int = 0) -> str:
    pad = "  " * indent
    status = "PROVED" if node.success else "UNPROVEN"
    if node.fact_id is not None:
        record = kb.get(node.fact_id)
        origin = (
            f"observed ({record.source})"
            if record and record.source
            else (record.category if record else "known")
        )
        return f"{pad}- {_short(node.goal)} [{status}] via known fact {node.fact_id} ({origin})"
    if node.rule_id is not None:
        lines = [f"{pad}- {_short(node.goal)} [{status}] via rule {node.rule_id}"]
        for child in node.children:
            lines.append(render_proof_tree(child, kb, indent + 1))
        return "\n".join(lines)
    return f"{pad}- {_short(node.goal)} [{status}] (no supporting fact or rule)"


def render_why(node: ProofNode, kb: KnowledgeBase) -> str:
    """Human-readable WHY? text for a successful proof tree root."""
    if not node.success:
        return f"{_short(node.goal)} cannot be established from discovered evidence."
    lines = [f"{_short(node.goal)} holds because:"]
    for number, child in enumerate(node.children, start=1):
        if child.fact_id is not None:
            record = kb.get(child.fact_id)
            evidence = f" (evidence {record.source})" if record and record.source else ""
            lines.append(f"{number}. {_short(child.goal)} is established{evidence}.")
        elif child.rule_id is not None:
            lines.append(
                f"{number}. {_short(child.goal)} follows from rule {child.rule_id} "
                f"(see detail below)."
            )
            lines.append(render_proof_tree(child, kb, indent=1))
    if node.rule_id:
        lines.append(f"Rule {node.rule_id} therefore yields {_short(node.goal)}.")
    return "\n".join(lines)


def why_response(conclusion: Predicate, node: ProofNode) -> dict:
    """Machine-readable WHY? payload matching the spec section 15 shape."""
    return {
        "conclusion": str(conclusion),
        "proof": node.to_dict(),
    }
