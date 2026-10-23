# SherlockAI

Immersive 2D detective game with a symbolic-AI reasoning engine
(forward/backward chaining over structured facts/rules — no LLM inference).

Investigate six mysteries: Blackwood Manor, Holloway Theatre, Saltmarsh
Lighthouse, Starfall Observatory, The Glasshouse Orchid, and The Midnight
Mail. Explore connected rooms, question witnesses, collect evidence, and inspect
how facts and rules support or contradict a theory. Casework tools include
notes and photos, a World Guide, comparison and hypothesis workbenches, a
session knowledge graph, and an optional Forensics memory exercise. Play with
keyboard, controller, or touch controls; sound volume and reduced-motion
preferences are supported.

## Layout

- `frontend/` — React + TypeScript + Phaser 3 + Tailwind + Vite
- `backend/` — Python 3.12+, FastAPI, Pydantic, SQLAlchemy, NetworkX
- `cases/` — six JSON case definitions, each with its own cast, evidence, dialogue, and resolution
- `CASE_AUTHORING.md` — case file format, validator diagnostics, and walkthrough references

## Quick start with Docker

Docker Compose builds and starts the backend and frontend. Use `--build` after
updating the project so the case archive and generated art are included in the
containers. The game is at
<http://localhost:5173>; the API is at <http://localhost:8000>.

```bash
docker compose up --build
```

Stop the services with `Ctrl+C` or `docker compose down`. Both keep the Compose
data volume and its investigation saves. Use `docker compose down -v`
only when you intend to permanently remove those saves.

## Run — backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"  # or: pip install fastapi uvicorn pydantic sqlalchemy networkx pytest
python -m pytest
uvicorn app.main:app --reload --port 8000
# liveness: GET http://localhost:8000/health
# readiness (includes database): GET http://localhost:8000/ready
```

## Run — frontend

```bash
cd frontend
npm ci
npm run dev      # http://localhost:5173 (proxies /api -> :8000)
npm run build
```

## Status

- Phase 0: repo skeleton, /health, React+Phaser boot scene — DONE
- Phase 1: symbolic AI core (terms/facts/rules/unify/forward/backward/explanation) + tests — DONE
- Phase 2: case loader (Pydantic schemas + validated Blackwood Manor) + spoiler-safe `/cases` API — DONE
- Phase 3: playable traversal (Scene, player, collision, camera, interaction zones + bridge) — DONE
- Phase 4: investigation integration (SQLite sessions, discovery → facts, inference, notebook + deductions/WHY? UI) — DONE
- Phase 5: NPCs / dynamic world (dialogue tree UI, deterministic relocation events, case clock) — DONE
- Phase 6: hypothesis and accusation (suspect queries, terminal accuse endpoint, support/contradict report) — DONE
- Phase 7: semantic network (NetworkX session-graph endpoint + SVG visualization) — DONE
- Phase 8: advanced logic (isolated resolution refutation + cross-checks, lifespan handler) — DONE
- Enhancement 1: second case — Holloway Theatre (data-driven engine proven, case select, per-case layouts/sessions) — DONE
- Enhancement 5: case wings — cellar + Grey (Blackwood), workshop + Kit (Holloway), exoneration arcs, stone walls — DONE
- Enhancement 2: detective assists — deterministic hints (−50), standard/classic difficulty (×2), efficiency scoring, self-healing DB — DONE
- Enhancement 3: presentation polish — generated tile art, lively sprites, synthesized sound, motion with reduced-motion respect — DONE
- Enhancement 4: real game shell — title menu with progress, pause, case-closed screen, pixel-art UI (Kenney CC0 sprites, Press Start 2P/VT323) — DONE
- Enhancement 5: themed art + animation — manor interiors (CC0/CC-BY sets), 4-direction walk-cycle cast, furnished rooms, touch controls, responsive HUD — DONE
- Enhancement 6: third data-driven case — Saltmarsh Lighthouse — DONE
- Operational foundation: Docker Compose quick start, database-aware `/ready`, CI checks (Ruff, pytest, TypeScript, asset validation, and container builds), and SQLite save backup/restore tooling and guidance — DONE
- Production release readiness — IN PROGRESS: the repository does not yet define a production deployment target or its operating configuration.

## Saves and database

The backend stores sessions and discoveries in SQLite. Schema changes are
applied additively at startup; deleting the database is not needed for an
upgrade. The `/ready` endpoint checks that the backend can reach its database.

To create a consistent backup while the local backend is running:

```bash
cd backend
python -m app.db.backup backup ./data/sherlock-backup.db
```

For a Compose deployment, create a snapshot in the backend container and copy
it to the current host directory:

```bash
docker compose exec -T backend python -m app.db.backup backup /tmp/sherlock-backup.db
docker compose cp backend:/tmp/sherlock-backup.db ./sherlock-backup.db
```

To restore, stop the application first. For a local development database,
run the restore command from `backend/`:

```bash
python -m app.db.backup restore ./data/sherlock-backup.db
```

For Compose, run the restore operation against the persistent volume, then
start the application again:

```bash
docker compose down
docker compose run --rm --no-deps -v "$PWD":/backup:ro backend \
  python -m app.db.backup restore /backup/sherlock-backup.db
docker compose up -d
```

To reset all Compose saves, stop the application and run
`docker compose down -v`. This removes the persistent volume and all saves in
it. For local development, stop the backend and remove `backend/data/app.db`
(and any `app.db-wal` or `app.db-shm` files) to start with an empty database.

## Play (Phases 3–7)

```bash
cd backend && .venv/bin/uvicorn app.main:app --port 8000  # terminal 1 (no --reload while playing)
cd frontend && npm run dev                                # terminal 2 → http://localhost:5173
```

> Stability note: run the backend WITHOUT `--reload` while playing.
> With `--reload`, every backend file save restarts the server and
> in-flight requests fail. Use `--reload` only when developing the
> backend. Schema changes are applied additively at startup; keep existing
> save data when upgrading.
> If you see `[Errno 98] Address already in use`, a previous server is
> still holding :8000 — stop it before starting a new one.

Move with the arrow keys or WASD; on touch screens use the D-pad, and with a
controller use the left stick or D-pad. Walk into a gold doorway to change
rooms. Press E, use the nearby Examine/Talk button, or tap an object or
character to interact. On a controller, use the bottom face button (A on
Xbox, X on PlayStation). Press Esc to pause; leaving the tab pauses gameplay
automatically.
Start from the title menu (progress per case, Standard/Classic mode),
follow How to Play, and accuse from Suspects & Accusation — the verdict
reports supporting vs. contradicting evidence, score, and is final.

Art: generated case illustrations, props, furniture, floor and wall textures,
plus licensed and generated character art. Fonts are Press Start 2P/VT323
(OFL) — see `frontend/public/assets/CREDITS.md`. CI runs the backend test suite and Ruff
checks, then type-checks and builds the frontend. To run backend checks locally,
use `python -m pytest`, `ruff check .`, and `ruff format --check .` from `backend/`.
