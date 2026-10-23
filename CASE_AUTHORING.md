# Case authoring and release checks

SherlockAI cases are data in `cases/<case_id>/`. Keep discovery, testimony,
rules, and world events in the case files so the same reasoning engine can run
every investigation.

## Case files

- `case.json`: case ID, starting room, suspects, and author-only truth.
- `map.json`: rooms, exits, spawn points, and descriptions.
- `entities.json`: NPCs, interactable objects, and doors.
- `evidence.json`: clue prerequisites, discovery source, and revealed facts.
- `dialogues.json`: testimony and response links.
- `facts.json`: background facts known at case start.
- `rules.json`: inference rules. Rules may establish possibilities, never `guilty`.
- `events.json`: deterministic effects driven by discovered evidence or dialogue.

Doors can set `locked: true`, `unlock_evidence` to the evidence ID that opens
them, and an optional `lock_hint` shown when the player reaches the door. The
frontend layout supplies portal geometry and connected room IDs; the Phaser
scene and World Guide both take lock state from the case detail API, so lock
rules should not be duplicated in layout files. The case loader rejects
locked doors without a valid unlock clue.

## Frontend room presentation

Room appearance and gameplay coordinates live separately in
`frontend/src/game/layouts/<case_id>.ts`. Keep layout room IDs and connected
doors in sync with `map.json`; clue/object IDs and their evidence IDs should
match `entities.json` and `evidence.json`. A room's `decor` entries use a
texture key and world `x`/`y`, with optional `scale` and `solid` fields.
Bundled furniture keys must refer to assets registered by the art catalog;
new pixel-art props should be painted and registered in `ensureArt()` in
`frontend/src/game/art.ts` before a layout uses them.

The frontend production build runs `npm run validate:assets` before compiling.
It checks layout texture keys against the art catalog and verifies the
furniture, portrait, and cast-sheet files declared by the frontend catalogs.

Set `solid: true` only for bulky furniture the player should walk around.
Collision uses a foot-level rectangle derived from the scaled sprite (65% of
its width and 35% of its height, shifted down by 18% of its height, with
minimum dimensions). Decorative backdrops and small set dressing should stay
passable. When adding solid props, check their footprint against clues,
doorways, spawn points, and the room's authored NPC stand spots so every
interaction remains reachable.

## Validation

Start the backend and request `/cases/<case_id>/validate`. The response includes
file counts and diagnostics:

- `valid: false` means at least one evidence item or dialogue node has no
  reachable discovery path from the case start.
- Warnings identify rooms disconnected from the starting room and one-way room
  links. These do not make `valid` false, but usually indicate a map mistake.
- Structural errors such as broken IDs, mismatched object-to-evidence links,
  malformed rules, and unsafe conclusions prevent the case from loading.

The progression check follows the same AND prerequisite semantics as the game,
including testimony unlocked by visiting a dialogue node and evidence unlocked
by deterministic world events. It respects locked doors while calculating
which rooms and clues are reachable; a locked door whose key clue cannot be
found is reported as `unreachable_door_key`. It assumes the player can inspect
reachable objects and visit available dialogue nodes; it does not simulate
puzzle difficulty or judge whether a deduction is fair.

## Deterministic walkthroughs

The backend API walkthroughs are the release path for each case. Keep one
playable route per case that discovers clues and dialogue, checks deductions,
and reaches a verdict:

- Blackwood Manor: `backend/tests/api/test_sessions.py`,
  `test_full_case_walkthrough_names_bob_and_theo`.
- Holloway Theatre: `backend/tests/cases/test_holloway_theatre.py`,
  `test_full_walkthrough_accuses_vera`.
- Saltmarsh Lighthouse: `backend/tests/api/test_saltmarsh_walkthrough.py`,
  `test_saltmarsh_non_suspect_and_correct_accusations`.

Run the backend suite from `backend/` with `pytest`. These walkthroughs use
fixed evidence and dialogue order; keep them deterministic and update them when
case IDs, prerequisites, or intended deductions change.
