"""Loader rejection tests: malformed cases must fail loudly (never 200 OK)."""

import json
from pathlib import Path

import pytest

from app.services.case_loader import CaseValidationError, load_case

SOURCE = Path(__file__).resolve().parents[3] / "cases" / "blackwood_manor"


@pytest.fixture()
def case_copy(tmp_path: Path) -> Path:
    target = tmp_path / "blackwood_manor"
    target.mkdir()
    for child in SOURCE.iterdir():
        target.joinpath(child.name).write_text(child.read_text(encoding="utf-8"), encoding="utf-8")
    return target


def _rewrite(case_dir: Path, filename: str, mutate) -> None:
    path = case_dir / filename
    data = json.loads(path.read_text(encoding="utf-8"))
    mutate(data)
    path.write_text(json.dumps(data), encoding="utf-8")


def test_rejects_unknown_requires_reference(case_copy: Path):
    _rewrite(
        case_copy,
        "evidence.json",
        lambda d: d["evidence"][0].update({"requires": ["E_MISSING"]}),
    )
    with pytest.raises(CaseValidationError, match="requires unknown"):
        load_case(case_copy)


def test_rejects_unbound_conclusion_variable(case_copy: Path):
    def mutate(data: dict) -> None:
        data["rules"][0]["conclusion"] = {"name": "can_access", "args": ["?ghost", "?container"]}

    _rewrite(case_copy, "rules.json", mutate)
    with pytest.raises(CaseValidationError, match="never appears"):
        load_case(case_copy)


def test_rejects_guilty_conclusion(case_copy: Path):
    def mutate(data: dict) -> None:
        data["rules"].append(
            {
                "id": "R_EVIL",
                "description": "Forbidden shortcut.",
                "conditions": [{"name": "has_key", "args": ["?p", "?k"]}],
                "conclusion": {"name": "guilty", "args": ["?p"]},
            }
        )

    _rewrite(case_copy, "rules.json", mutate)
    with pytest.raises(CaseValidationError, match="guilty"):
        load_case(case_copy)


def test_rejects_duplicate_ids(case_copy: Path):
    def mutate(data: dict) -> None:
        data["evidence"].append(dict(data["evidence"][0]))

    _rewrite(case_copy, "evidence.json", mutate)
    with pytest.raises(CaseValidationError, match="Duplicate evidence id"):
        load_case(case_copy)


def test_rejects_broken_dialogue_link(case_copy: Path):
    def mutate(data: dict) -> None:
        data["nodes"][0]["responses"][0]["next"] = "node_nowhere"

    _rewrite(case_copy, "dialogues.json", mutate)
    with pytest.raises(CaseValidationError, match="unknown node"):
        load_case(case_copy)


def test_rejects_invalid_json(case_copy: Path):
    (case_copy / "rules.json").write_text("{not json", encoding="utf-8")
    with pytest.raises(CaseValidationError, match="Invalid JSON"):
        load_case(case_copy)


def test_rejects_id_directory_mismatch(case_copy: Path):
    def mutate(data: dict) -> None:
        data["id"] = "other_case"

    _rewrite(case_copy, "case.json", mutate)
    with pytest.raises(CaseValidationError, match="does not match directory"):
        load_case(case_copy)
