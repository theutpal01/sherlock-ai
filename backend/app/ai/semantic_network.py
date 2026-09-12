"""Semantic-network view over known facts (representation layer only).

Uses NetworkX as the backend. This must NOT replace formal inference:
it is a visualization/inspection aid built from already-known facts.
"""

from __future__ import annotations

import networkx as nx

from .facts import KnowledgeBase


def build_semantic_network(kb: KnowledgeBase) -> nx.MultiDiGraph:
    """Build a directed multigraph: subject --predicate--> object.

    Binary predicates become edges; other arities become hyper-edge style
    nodes so no information is silently dropped.
    """
    graph = nx.MultiDiGraph()
    for record in kb.all_records():
        pred = record.predicate
        if len(pred.args) == 2:
            subject, obj = pred.args
            graph.add_node(subject)
            graph.add_node(obj)
            graph.add_edge(subject, obj, label=pred.name, fact_id=record.fact_id)
        else:
            fact_node = f"{record.fact_id}:{pred.name}"
            graph.add_node(fact_node, predicate=pred.name)
            for arg in pred.args:
                graph.add_node(arg)
                graph.add_edge(fact_node, arg, label="arg", fact_id=record.fact_id)
    return graph


def to_node_link(kb: KnowledgeBase) -> dict:
    """JSON-serialisable node-link representation for the frontend graph view."""
    graph = build_semantic_network(kb)
    return nx.node_link_data(graph, edges="links")  # type: ignore[no-untyped-call]
