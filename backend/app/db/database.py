"""SQLite persistence (spec section 16).

Stores sessions, discovered evidence, dialogue visits, and world flags.
Player-known facts and derived conclusions are RECOMPUTED from these via
the reasoning service — never duplicated into the database.
"""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def database_url() -> str:
    if url := os.environ.get("SHERLOCK_DATABASE_URL"):
        return url
    data_dir = Path(__file__).resolve().parents[2] / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{data_dir / 'app.db'}"


_engine = None


def get_engine():
    global _engine
    if _engine is None:
        url = database_url()
        kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
        _engine = create_engine(url, **kwargs)
    return _engine


def init_db() -> None:
    from ..models import session as _session_models  # noqa: F401 (register tables)

    engine = get_engine()
    Base.metadata.create_all(engine)
    ensure_session_columns(engine)


# Additive-only columns the sessions table must have. create_all() covers
# fresh databases; this heals dev databases created by older code so a
# schema change never again means wiping progress (the :8000 outage).
_SESSION_COLUMNS = {
    "accused": "VARCHAR",
    "correct": "BOOLEAN",
    "completed_at": "DATETIME",
    "difficulty": "VARCHAR DEFAULT 'standard'",
    "hints_used": "INTEGER DEFAULT 0",
    "score": "INTEGER",
}


def ensure_session_columns(engine) -> None:  # type: ignore[no-untyped-def]
    """Add any missing sessions columns (additive, idempotent, testable)."""
    from sqlalchemy import inspect, text
    from sqlalchemy.exc import NoSuchTableError

    with engine.begin() as conn:
        try:
            existing = {col["name"] for col in inspect(engine).get_columns("sessions")}
        except NoSuchTableError:
            return  # table genuinely absent; create_all owns that case
        for name, ddl in _SESSION_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE sessions ADD COLUMN {name} {ddl}"))


def get_session_factory():
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db():
    factory = get_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()
