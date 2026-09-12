# SherlockAI

Immersive 2D detective game with a symbolic-AI reasoning engine
(forward/backward chaining over structured facts/rules — no LLM inference).

## Layout

- `frontend/` — React + TypeScript + Phaser 3 + Tailwind + Vite
- `backend/` — Python 3.12+, FastAPI, Pydantic, SQLAlchemy, NetworkX
- `cases/blackwood_manor/` — JSON case definition (populated in Phase 2)

## Run — backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"  # or: pip install fastapi uvicorn pydantic sqlalchemy networkx pytest
pytest
uvicorn app.main:app --reload --port 8000
# health: GET http://localhost:8000/health
```

## Run — frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 (proxies /api -> :8000)
npm run build
```

## Status

- Phase 0: repo skeleton, /health, React+Phaser boot scene — DONE
- Phase 1: symbolic AI core (terms/facts/rules/unify/forward/backward/explanation) + tests — DONE
- Phase 2: case loader (Pydantic schemas + validated Blackwood Manor) + spoiler-safe `/cases` API — DONE
- Phase 3: playable traversal (ManorScene, player, collision, camera, interaction zones + bridge) — DONE
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
- Optional follow-up: platform hardening

## Play (Phases 3–7)

```bash
cd backend && .venv/bin/uvicorn app.main:app --port 8000  # terminal 1 (no --reload while playing)
cd frontend && npm run dev                                # terminal 2 → http://localhost:5173
```

> Stability note: run the backend WITHOUT `--reload` while playing.
> With `--reload`, every backend file save restarts the server and
> in-flight requests fail. Use `--reload` only when developing the
> backend, and restart it manually after schema changes
> (`rm data/app.db` if an old dev database predates new columns).
> If you see `[Errno 98] Address already in use`, a previous server is
> still holding :8000 — stop it before starting a new one.

Move with WASD / arrow keys · walk into a gold doorway to change rooms ·
press E near an object to examine it or a character to talk · Esc pauses.
Start from the title menu (progress per case, Standard/Classic mode),
follow How to Play, and accuse from Suspects & Accusation — the verdict
reports supporting vs. contradicting evidence, score, and is final.

Art: Kenney "Tiny Dungeon" (CC0) + Press Start 2P/VT323 (OFL) — see
`frontend/public/assets/CREDITS.md`. Backend dev checks:
`pytest` (92 tests), `ruff check` + `ruff format --check`.
