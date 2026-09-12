"""Session tables: sessions, discoveries, dialogue visits."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..db.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    case_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active")
    current_room: Mapped[str | None] = mapped_column(String, nullable=True)
    event_counter: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    accused: Mapped[str | None] = mapped_column(String, nullable=True)
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    difficulty: Mapped[str] = mapped_column(String, default="standard")
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Discovery(Base):
    __tablename__ = "discoveries"
    __table_args__ = (UniqueConstraint("session_id", "evidence_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("sessions.id"), nullable=False)
    evidence_id: Mapped[str] = mapped_column(String, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)


class DialogueVisit(Base):
    __tablename__ = "dialogue_visits"
    __table_args__ = (UniqueConstraint("session_id", "node_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("sessions.id"), nullable=False)
    node_id: Mapped[str] = mapped_column(String, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)


class SessionHint(Base):
    """Hints already given: the engine never repeats or re-charges one."""

    __tablename__ = "session_hints"
    __table_args__ = (UniqueConstraint("session_id", "hint_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("sessions.id"), nullable=False)
    hint_id: Mapped[str] = mapped_column(String, nullable=False)
