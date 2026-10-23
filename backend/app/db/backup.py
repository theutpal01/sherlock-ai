"""Back up or restore SherlockAI's SQLite save database.

Use SQLite's online backup API for a consistent snapshot while the app runs.
Restore only after stopping the backend so no process holds the database open.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

from sqlalchemy.engine import make_url

from .database import database_url


def _database_path() -> Path:
    url = make_url(database_url())
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        raise ValueError("Database backup supports file-based SQLite databases only.")
    return Path(url.database).expanduser()


def _check_integrity(path: Path) -> None:
    with closing(sqlite3.connect(path)) as connection:
        result = connection.execute("PRAGMA integrity_check").fetchone()
    if result is None or result[0] != "ok":
        raise ValueError(f"SQLite integrity check failed for {path}.")


def backup(destination: Path) -> Path:
    """Write an integrity-checked, consistent snapshot to ``destination``."""
    source = _database_path()
    if not source.is_file():
        raise FileNotFoundError(f"Database does not exist: {source}")
    destination = destination.expanduser().resolve()
    if destination == source.resolve():
        raise ValueError("Backup destination must differ from the live database.")
    destination.parent.mkdir(parents=True, exist_ok=True)

    temporary_path: Path | None = None
    try:
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{destination.name}.", suffix=".backup", dir=destination.parent
        )
        os.close(descriptor)
        temporary_path = Path(temporary_name)
        with closing(sqlite3.connect(source)) as live, closing(
            sqlite3.connect(temporary_path)
        ) as snapshot:
            live.backup(snapshot)
        _check_integrity(temporary_path)
        os.replace(temporary_path, destination)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return destination


def restore(source: Path) -> Path:
    """Atomically replace the configured SQLite database from a backup."""
    target = _database_path()
    source = source.expanduser().resolve()
    if not source.is_file():
        raise FileNotFoundError(f"Backup does not exist: {source}")
    if source == target.resolve():
        raise ValueError("Restore source must differ from the live database.")
    _check_integrity(source)
    target.parent.mkdir(parents=True, exist_ok=True)

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{target.name}.", suffix=".restore", dir=target.parent, delete=False
        ) as temporary:
            temp_path = Path(temporary.name)
            with source.open("rb") as backup_file:
                shutil.copyfileobj(backup_file, temporary)
            temporary.flush()
            os.fsync(temporary.fileno())
        _check_integrity(temp_path)
        os.replace(temp_path, target)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    backup_parser = commands.add_parser("backup", help="create a consistent database snapshot")
    backup_parser.add_argument("destination", type=Path)
    restore_parser = commands.add_parser("restore", help="restore a checked snapshot")
    restore_parser.add_argument("source", type=Path)
    args = parser.parse_args()

    try:
        path = backup(args.destination) if args.command == "backup" else restore(args.source)
    except (OSError, sqlite3.Error, ValueError) as exc:
        parser.error(str(exc))
    action = "Backup written" if args.command == "backup" else "Database restored"
    print(f"{action}: {path}")


if __name__ == "__main__":
    main()
