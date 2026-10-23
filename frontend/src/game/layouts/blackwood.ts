import type { CaseLayout } from './types';

const ROOM_W = 640;
const ROOM_H = 420;

const rooms: CaseLayout['rooms'] = [
  { id: 'entrance', name: 'Entrance', x: 40, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'stone', wallStyle: 'wood', decor: [{ tex: 'furn-rug', x: 360, y: 320, scale: 1.5 }, { tex: 'spr-umbrella-stand', x: 100, y: 130, scale: 2, solid: true }, { tex: 'furn-mirror', x: 540, y: 125, scale: 2 }] },
  { id: 'corridor', name: 'Corridor', x: 800, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'carpet', wallStyle: 'wood', decor: [{ tex: 'furn-rug', x: 1120, y: 250, scale: 1.5 }, { tex: 'furn-plant', x: 860, y: 130, scale: 2 }, { tex: 'spr-manor-painting', x: 1120, y: 90, scale: 2 }] },
  { id: 'library', name: 'Library', x: 1560, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'furn-shelf', x: 1860, y: 110, scale: 2, solid: true }, { tex: 'spr-library-ladder', x: 2070, y: 200, scale: 2, solid: true }, { tex: 'furn-plant', x: 1620, y: 340, scale: 2 }, { tex: 'furn-duck', x: 1750, y: 140, scale: 1.5 }] },
  { id: 'hall', name: 'Great Hall', x: 800, y: 560, w: ROOM_W, h: ROOM_H, floorStyle: 'carpet', wallStyle: 'wood', decor: [{ tex: 'spr-chandelier', x: 1120, y: 630, scale: 2 }, { tex: 'spr-manor-fireplace', x: 1250, y: 650, scale: 1.5 }, { tex: 'furn-rug', x: 1120, y: 760, scale: 1.5 }, { tex: 'furn-plant', x: 860, y: 660, scale: 2 }] },
  { id: 'study', name: 'Study', x: 1560, y: 560, w: ROOM_W, h: ROOM_H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'furn-desk', x: 1650, y: 650, scale: 2, solid: true }, { tex: 'furn-books', x: 1650, y: 645, scale: 1.5 }, { tex: 'furn-lamp', x: 1600, y: 760, scale: 1.5 }, { tex: 'furn-rug', x: 1880, y: 820, scale: 1.5 }] },
  { id: 'garden', name: 'Garden', x: 800, y: 1080, w: ROOM_W, h: ROOM_H, floorStyle: 'grass', wallStyle: 'hedge', decor: [{ tex: 'spr-garden-shrub', x: 950, y: 1150, scale: 1.5, solid: true }, { tex: 'spr-garden-shrub', x: 850, y: 1300, scale: 1.5 }, { tex: 'spr-garden-shrub', x: 1250, y: 1250, scale: 1.5 }, { tex: 'furn-birdbath', x: 1360, y: 1380, scale: 2, solid: true }, { tex: 'spr-garden-bench', x: 1380, y: 1170, scale: 1.25 }] },
  { id: 'cellar', name: 'Wine Cellar', x: 40, y: 560, w: ROOM_W, h: ROOM_H, floorStyle: 'stone', wallStyle: 'stone', decor: [{ tex: 'furn-shelf', x: 400, y: 700, scale: 2, solid: true }, { tex: 'spr-wine-casks', x: 500, y: 620, scale: 1.5, solid: true }, { tex: 'spr-wine-bottle-crate', x: 560, y: 830, scale: 2, solid: true }] },
];

export const blackwoodLayout: CaseLayout = {
  caseId: 'blackwood_manor',
  rooms,
  spawns: Object.fromEntries(
    rooms.map((r) => [r.id, { x: r.x + ROOM_W / 2, y: r.y + ROOM_H / 2 }]),
  ),
  doors: [
    { id: 'D_ENT_CORR', roomId: 'entrance', label: '→ Corridor', x: 632, y: 214, w: 48, h: 72, targetRoomId: 'corridor' },
    { id: 'D_CORR_ENT', roomId: 'corridor', label: '→ Entrance', x: 784, y: 214, w: 48, h: 72, targetRoomId: 'entrance' },
    { id: 'D_CORR_LIB', roomId: 'corridor', label: '→ Library', x: 1408, y: 214, w: 48, h: 72, targetRoomId: 'library' },
    { id: 'D_CORR_HALL', roomId: 'corridor', label: '→ Great Hall', x: 1024, y: 412, w: 72, h: 48, targetRoomId: 'hall' },
    { id: 'D_CORR_GAR', roomId: 'corridor', label: '→ Garden', x: 1208, y: 412, w: 72, h: 48, targetRoomId: 'garden' },
    { id: 'D_LIB_CORR', roomId: 'library', label: '→ Corridor', x: 1544, y: 214, w: 48, h: 72, targetRoomId: 'corridor' },
    { id: 'D_HALL_CORR', roomId: 'hall', label: '→ Corridor', x: 1024, y: 560, w: 72, h: 48, targetRoomId: 'corridor' },
    { id: 'D_HALL_STU', roomId: 'hall', label: '→ Study', x: 1408, y: 734, w: 48, h: 72, targetRoomId: 'study' },
    { id: 'D_STU_HALL', roomId: 'study', label: '→ Great Hall', x: 1544, y: 734, w: 48, h: 72, targetRoomId: 'hall' },
    { id: 'D_GAR_CORR', roomId: 'garden', label: '→ Corridor', x: 1084, y: 1080, w: 72, h: 48, targetRoomId: 'corridor' },
    { id: 'D_HALL_CEL', roomId: 'hall', label: '→ Cellar', x: 784, y: 734, w: 48, h: 72, targetRoomId: 'cellar' },
    { id: 'D_CEL_HALL', roomId: 'cellar', label: '→ Great Hall', x: 616, y: 734, w: 48, h: 72, targetRoomId: 'hall' },
  ],
  objects: [
    { id: 'bobs_coat', roomId: 'entrance', label: "Bob's coat", x: 200, y: 300, radius: 64, sprite: { kind: 'texture', key: 'spr-coat' }, scale: 2, evidence: 'E_COAT' },
    { id: 'torn_letter', roomId: 'library', label: 'Torn letter', x: 1700, y: 200, radius: 64, sprite: { kind: 'texture', key: 'spr-torn-letter' }, scale: 2, evidence: 'E_LETTER' },
    { id: 'grandfather_clock', roomId: 'hall', label: 'Grandfather clock', x: 950, y: 650, radius: 70, sprite: { kind: 'texture', key: 'spr-clock' }, scale: 2.5, evidence: 'E_CLOCK' },
    { id: 'study_safe', roomId: 'study', label: 'Open wall safe', x: 1800, y: 650, radius: 70, sprite: { kind: 'texture', key: 'spr-open-safe' }, scale: 2.5, evidence: 'E_SAFE' },
    { id: 'safe_lock', roomId: 'study', label: 'Safe lock (look closer)', x: 1870, y: 710, radius: 60, sprite: { kind: 'texture', key: 'spr-safe-keyway' }, scale: 2, evidence: 'E_LOCK' },
    { id: 'muddy_prints', roomId: 'study', label: 'Muddy footprints', x: 1700, y: 850, radius: 64, sprite: { kind: 'texture', key: 'spr-mud-prints' }, scale: 2.5, evidence: 'E_MUD' },
    { id: 'garden_boots', roomId: 'garden', label: 'Field boots', x: 950, y: 1300, radius: 64, sprite: { kind: 'texture', key: 'spr-field-boots' }, scale: 2.5, evidence: 'E_BOOTS' },
    { id: 'butlers_candle', roomId: 'cellar', label: 'Burnt candle stub', x: 200, y: 850, radius: 64, sprite: { kind: 'texture', key: 'spr-candle' }, scale: 2.5, evidence: 'E_CANDLE' },
  ],
  npcSpots: {
    entrance: [
      { x: 480, y: 140 },
      { x: 220, y: 140 },
    ],
    corridor: [
      { x: 900, y: 140 },
      { x: 1240, y: 140 },
    ],
    library: [
      { x: 1700, y: 330 },
      { x: 1900, y: 150 },
    ],
    hall: [
      { x: 900, y: 800 },
      { x: 1240, y: 830 },
    ],
    study: [
      { x: 2140, y: 650 },
      { x: 2140, y: 900 },
    ],
    garden: [
      { x: 1250, y: 1200 },
      { x: 1100, y: 1350 },
    ],
    cellar: [
      { x: 300, y: 700 },
      { x: 500, y: 850 },
    ],
  },
  worldW: 2240,
  worldH: 1540,
  startRoom: 'entrance',
};
