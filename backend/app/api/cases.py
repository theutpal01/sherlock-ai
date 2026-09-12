"""Case endpoints (spec section 13).

Spoiler contract: these endpoints serve STATIC case structure (rooms,
entities, dialogue structure, evidence titles). They NEVER expose the
truth block, evidence `reveals`, or dialogue node `text` — words and
facts unlock only through session discovery (dialogue visits, evidence
examination). Hidden facts only enter player knowledge through
legitimate session discovery.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..services.case_loader import (
    CaseValidationError,
    LoadedCase,
    list_cases,
    load_case,
)

router = APIRouter(prefix="/cases", tags=["cases"])


def cases_dir() -> Path:
    # Repo layout: sherlock-ai/cases alongside backend/. Overridable by CWD.
    here = Path(__file__).resolve()
    for candidate in (here.parents[3] / "cases", Path.cwd() / "cases"):
        if candidate.is_dir():
            return candidate
    return here.parents[3] / "cases"


@lru_cache(maxsize=32)
def _load(case_id: str) -> LoadedCase:
    try:
        return load_case(cases_dir() / case_id)
    except (CaseValidationError, FileNotFoundError, NotADirectoryError) as exc:
        raise HTTPException(status_code=404, detail=f"Unknown case: {case_id}") from exc


def _summary(case: LoadedCase) -> dict:
    return {
        "id": case.meta.id,
        "title": case.meta.title,
        "description": case.meta.description,
        "version": case.meta.version,
        "suspects": case.meta.suspects,
        "rooms": len(case.rooms),
        "evidence": len(case.evidence),
        "rules": len(case.rules),
    }


@router.get("")
def get_cases() -> dict:
    return {"cases": [_summary(case) for case in list_cases(cases_dir())]}


@router.get("/{case_id}")
def get_case(case_id: str) -> dict:
    case = _load(case_id)
    return {
        **_summary(case),
        "start_location": case.meta.start_location,
        "rooms": [r.model_dump() for r in case.rooms],
        "npcs": [n.model_dump() for n in case.npcs],
        "objects": [o.model_dump() for o in case.objects],
        "doors": [d.model_dump() for d in case.doors],
        # Evidence WITHOUT reveals; dialogue WITHOUT grants (gated at runtime).
        "evidence": [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "location": e.location,
                "requires": e.requires,
                "discovery": e.discovery.model_dump(),
            }
            for e in case.evidence
        ],
        "dialogues": [
            {
                "id": d.id,
                "speaker": d.speaker,
                "requires": list(d.requires),
                # NOTE: node `text` is deliberately withheld — testimony
                # words unlock via the session dialogue endpoint.
                "responses": [r.model_dump() for r in d.responses],
            }
            for d in case.dialogues
        ],
        "rules": [r.to_dict() for r in case.rules],
        "events": [e.model_dump() for e in case.events],
    }
