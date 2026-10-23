"""Case endpoints (spec section 13).

Spoiler contract: these endpoints serve STATIC case structure (rooms,
entities, dialogue structure, evidence titles). They NEVER expose the
truth block, evidence `reveals`, or dialogue node `text` — words and
facts unlock only through session discovery (dialogue visits, evidence
examination). Hidden facts only enter player knowledge through
legitimate session discovery.
"""

from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..services.case_loader import (
    CaseValidationError,
    LoadedCase,
    diagnose_case,
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


@router.get("/daily")
def get_daily_case() -> dict:
    """Deterministic case-of-the-day (spoiler-safe summary + seed).

    Index is derived from the calendar date over the sorted case list, so
    every client agrees without coordination. The seed drives a repeatable
    daily NPC stand-spot arrangement in the client; it changes no case truth.
    """
    cases = list_cases(cases_dir())
    if not cases:
        raise HTTPException(status_code=404, detail="No cases available")
    today = datetime.now(UTC).date()
    seed = today.toordinal()
    case = cases[seed % len(cases)]
    return {"date": today.isoformat(), "seed": seed, **_summary(case)}


@router.get("/{case_id}/validate")
def validate_case(case_id: str) -> dict:
    """Report structural validation and case progression diagnostics.

    Structural violations prevent loading. Progression issues are returned
    as diagnostics so case authors can repair dead ends before release.
    """
    directory = cases_dir() / case_id
    if not directory.is_dir():
        raise HTTPException(status_code=404, detail=f"Unknown case: {case_id}")
    try:
        # Bypass the session cache so edits made during authoring are checked
        # by the next validation request.
        case = load_case(directory)
    except CaseValidationError as exc:
        return {
            "id": case_id,
            "valid": False,
            "diagnostics": [
                {
                    "severity": "error",
                    "code": "structural_error",
                    "id": case_id,
                    "message": str(exc),
                }
            ],
            "counts": {},
        }
    diagnostics = diagnose_case(case)
    return {
        "id": case.meta.id,
        "valid": not any(item["severity"] == "error" for item in diagnostics),
        "diagnostics": diagnostics,
        "counts": {
            "rooms": len(case.rooms),
            "npcs": len(case.npcs),
            "objects": len(case.objects),
            "doors": len(case.doors),
            "evidence": len(case.evidence),
            "dialogues": len(case.dialogues),
            "facts": len(case.case_facts),
            "rules": len(case.rules),
            "events": len(case.events),
            "suspects": len(case.meta.suspects),
        },
    }


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
