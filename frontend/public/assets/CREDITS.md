# Asset credits

All third-party art is used under its published license, verified at
download time. Original filler (marked below) is drawn in matching
pixel style for gaps no pack covered.

## Original cast sheets — Svetlana Kushnariova + diamonddmgirl (CC-BY 3.0)
- Files: remaining legacy cast sheets with 4-direction walk cycles and the
  original cast portraits (see generated portraits below).
- Source: https://opengameart.org/content/24x32-characters-with-faces-big-pack
  (extended pack: https://opengameart.org/content/edited-and-extended-24x32-character-pack)
- License: CC-BY 3.0 — credited here as required.
- Used as fallback cast artwork; the active cast in the six cases and the
  player detective now use the generated sheets below.

## Case-specific walk cycles — generated for this project
- Files: case-specific sheets for the active witnesses and the player:
  `cast/blackwood-*.png`, `cast/holloway-*.png`, `cast/saltmarsh-*.png`,
  `cast/starfall-*.png`, `cast/glasshouse-*.png`, and `cast/midnight-*.png`.
- Source: generated with OpenAI image generation; full atlases are retained
  in `src/assets/originals/blackwood-walk-atlas-original.png`,
  `holloway-walk-atlas-original.png`, `saltmarsh-walk-atlas-original.png`,
  `starfall-walk-atlas-original.png`, `glasshouse-walk-atlas-original.png`,
  `midnight-mail-walk-atlas-original.png`, and
  `remaining-cast-walk-atlas-original.png`.
- Direction rows are reordered to the game's walk-cycle frame layout.

## Case-specific portraits — generated for this project
- Files: `faces/npc-odda.png`, `npc-corwin.png`, `npc-scholar.png`,
  `npc-iris.png`, `npc-mara.png`, `npc-celia.png`, `npc-rowan.png`,
  `npc-theo.png`, `npc-ada.png`, `npc-arthur.png`, and
  `npc-finn-mercer.png`, plus equivalent case-specific `npc-*` portrait IDs
  used to keep overlapping NPC names separate.
- Source: generated with OpenAI image generation; new case portraits are crops
  from `src/assets/originals/new-case-character-atlas-original.png`.
- Used for: Saltmarsh Lighthouse, Starfall Observatory, The Glasshouse Orchid,
  and The Midnight Mail dialogue and suspect portraits.

## Shared furniture — generated for this project
- Files: `furniture/*.png` (rug, mirror, lamp, desk, wardrobe, shelf,
  books, stool, plant, duck, theatre masks, birdbath, barometer, tide chart)
- Source: generated with OpenAI image generation; crops from
  `src/assets/originals/shared-furniture-atlas-original.png`.
- Used for: room dressing across all cases.

## Floor textures — generated for this project
- Files: `floors/wood.png`, `floors/stone.png`, `floors/grass.png`,
  `floors/carpet.png`, `floors/marsh.png`, `floors/star-map.png`, and
  `floors/glasshouse.png`.
- Source: generated with OpenAI image generation; full-size originals are in
  `src/assets/originals/`. Carpet, marsh, star-map, and glasshouse crops come
  from `src/assets/originals/special-floor-atlas-original.png`.

## Wall textures — generated for this project
- Files: `walls/wood.png`, `walls/stone.png`, `walls/hedge.png`,
  `walls/velvet.png`, `walls/reeds.png`, `walls/copper.png`, and
  `walls/iron-glass.png`.
- Source: crops from `src/assets/originals/context-wall-atlas-original.png`.

## Fonts (OFL 1.1, via Fontsource CDN)
- `fonts/press-start-2p-latin-400-normal.woff2` — "Press Start 2P" by CodeMan38
- `fonts/vt323-latin-400-normal.woff2` — "VT323" by Peter Hull
- Source: https://www.npmjs.com/package/@fontsource/press-start-2p and
  https://www.npmjs.com/package/@fontsource/vt323
- License: SIL Open Font License 1.1 (see https://openfontlicense.org).

## Code-drawn pixel art (this project)
- `../favicon.svg` — original 32×32 pixel magnifying-glass mark used for the browser tab.
- All listed textures are original artwork drawn in `src/game/art.ts` to fit
  the game's 16px pixel style: `spr-chandelier`, `spr-manor-fireplace`,
  `spr-mud-prints`, `spr-oily-prints`,
  `spr-rosin-dust`, `spr-clock`, `spr-wine-casks`,
  `spr-wine-bottle-crate`, `spr-library-ladder`, `spr-stage-crates`, `spr-stage-pulley`,
  `spr-theatre-seats`, `spr-stage-curtains`, `spr-stage-footlights`,
  `spr-theatre-ticket-booth`,
  `spr-marsh-reeds`, `spr-marsh-tide-marker`, `spr-sewing-kit`, `spr-manor-painting`,
  `spr-storm-lantern`, `spr-rope-coil`, `spr-garden-shrub`, `spr-garden-bench`, `spr-bunk-bed`,
  `spr-galley-stove`, `spr-galley-porthole`, `spr-umbrella-stand`, `spr-work-boots`,
  `spr-field-boots`, `spr-sea-boots`, `spr-brass-lock`, `spr-safe-keyway`,
  `spr-wall-safe`, `spr-open-safe`, `spr-candle`, `spr-call-bell`,
  `spr-coat`, `spr-oilskin-coat`, `spr-oil-can`, `spr-lamp-wick-rack`, `spr-apron`,
  `spr-beacon-lamp`, `spr-open-ledger`, `spr-torn-letter`, `spr-torn-iou`,
  `spr-theatre-programme`, `spr-backstage-noticeboard`, `spr-curtain`,
  `spr-costume-mannequin`, and `spr-costume-rack`.
- `fx-lantern-glow`, `fx-rain-streak`, and `fx-marsh-fog` are generated at
  runtime in `src/game/scenes/Scene.ts`. The warm glow lights placed lamps and
  stoves across the cases; rain streaks and a low drifting fog add atmosphere
  to the Saltmarsh causeway. Fog drift stops when reduced motion is requested.

## Generated case artwork
- `cases/case-triptych.webp` — optimized WebP artwork generated for SherlockAI;
  three panels show Blackwood Manor, Holloway Theatre, and Saltmarsh Lighthouse.
  The full-size PNG original is retained as
  `src/assets/originals/case-triptych-original.png` (source only; not shipped).
- `cases/blackwood-manor.webp` — dedicated generated cover art showing the
  rain-soaked manor and study window; source retained at
  `src/assets/originals/blackwood-manor-cover-original.png`.
- `cases/holloway-theatre.webp` — dedicated generated cover art showing the
  empty violin case backstage at Holloway; source retained at
  `src/assets/originals/holloway-theatre-cover-original.png`.
- `cases/saltmarsh-lighthouse.webp` — dedicated generated cover art showing
  the dark beacon above a storm-tossed reef; source retained at
  `src/assets/originals/saltmarsh-lighthouse-cover-original.png`.
- `furniture/*.png` — generated shared furniture crops from the atlas above.
- `floors/*.png` — generated manor wood, limestone, and garden grass textures;
  source originals retained in `src/assets/originals/`.
- `cases/starfall-observatory.webp` — generated cover art for the Starfall
  Observatory case; source retained at
  `src/assets/originals/starfall-observatory-cover-original.png`.
- `props/*.png` — crops from the generated Starfall Observatory prop atlas;
  source retained at `src/assets/originals/starfall-observatory-props-original.png`.
- `cases/glasshouse-orchid.webp` — generated cover art for The Glasshouse
  Orchid; source retained at `src/assets/originals/glasshouse-orchid-cover-original.png`.
- `props/orchid-cloche.png`, `props/pruning-shears.png`,
  `props/greenhouse-bootprint.png`, `props/seed-packet.png`,
  `props/greenhouse-key.png`, `props/botanists-ledger.png`,
  `props/cracked-thermometer.png`, `props/blue-fertilizer.png`,
  `props/gardening-gloves.png`, `props/broken-pot.png`,
  `props/watering-can.png`, `props/sealed-telegram.png`,
  `props/greenhouse-lock.png`, `props/emerald-ribbon.png`,
  `props/midnight-watch.png`, and `props/orchid-pollen.png` — crops from the
  generated Glasshouse Orchid prop atlas; source retained at
  `src/assets/originals/glasshouse-orchid-props-original.png`.
- `cases/midnight-mail.webp` — generated cover art for The Midnight Mail;
  source retained at `src/assets/originals/midnight-mail-cover-original.png`.
- `props/rail-00.png` through `props/rail-15.png` — crops from the generated
  Midnight Mail railway prop atlas; source retained at
  `src/assets/originals/midnight-mail-props-original.png`.
