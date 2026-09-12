"""Rule model: conditions (conjunction) => conclusion."""

from __future__ import annotations

from dataclasses import dataclass

from .terms import Predicate


@dataclass(frozen=True)
class Rule:
    id: str
    description: str
    conditions: tuple[Predicate, ...]
    conclusion: Predicate

    def __post_init__(self) -> None:
        if not self.id:
            raise ValueError("Rule id must be non-empty")
        if not self.conditions:
            raise ValueError(f"Rule {self.id} must have at least one condition")
        if isinstance(self.conditions, list):  # type: ignore[unreachable]
            object.__setattr__(self, "conditions", tuple(self.conditions))

    @classmethod
    def from_dict(cls, data: dict) -> Rule:
        """Validate the JSON case-definition shape from the spec."""
        try:
            rule_id = data["id"]
            conditions = tuple(
                Predicate(name=c["name"], args=tuple(c["args"])) for c in data["conditions"]
            )
            conclusion = Predicate(
                name=data["conclusion"]["name"],
                args=tuple(data["conclusion"]["args"]),
            )
        except (KeyError, TypeError) as exc:
            raise ValueError(f"Malformed rule definition: {data!r}") from exc
        return cls(
            id=rule_id,
            description=data.get("description", ""),
            conditions=conditions,
            conclusion=conclusion,
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "description": self.description,
            "conditions": [{"name": c.name, "args": list(c.args)} for c in self.conditions],
            "conclusion": {
                "name": self.conclusion.name,
                "args": list(self.conclusion.args),
            },
        }
