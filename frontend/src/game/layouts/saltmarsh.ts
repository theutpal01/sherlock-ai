import type { CaseLayout } from './types';

const ROOM_W = 640;
const ROOM_H = 420;

const rooms: CaseLayout['rooms'] = [
  { id: 'causeway', name: 'Causeway', x: 40, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'marsh', wallStyle: 'reeds', decor: [{ tex: 'spr-marsh-reeds', x: 360, y: 130, scale: 2 }, { tex: 'spr-marsh-tide-marker', x: 100, y: 160, scale: 2 }, { tex: 'spr-storm-lantern', x: 150, y: 345, scale: 2 }, { tex: 'spr-rope-coil', x: 530, y: 345, scale: 2 }] },
  { id: 'galley', name: 'Galley', x: 800, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'furn-shelf', x: 1120, y: 110, scale: 0.9, solid: true }, { tex: 'furn-lamp', x: 860, y: 300, scale: 0.8 }, { tex: 'spr-galley-stove', x: 1300, y: 300, scale: 1.5, solid: true }, { tex: 'spr-galley-porthole', x: 1320, y: 110, scale: 2 }] },
  { id: 'bunkroom', name: 'Bunkroom', x: 1560, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'furn-wardrobe', x: 1860, y: 110, scale: 1, solid: true }, { tex: 'spr-storm-lantern', x: 2120, y: 110, scale: 1.5 }, { tex: 'spr-bunk-bed', x: 2040, y: 270, scale: 1.5, solid: true }, { tex: 'furn-rug', x: 2040, y: 340, scale: 0.9 }] },
  { id: 'lamp_room', name: 'Lamp Room', x: 800, y: 560, w: ROOM_W, h: ROOM_H, floorStyle: 'stone', wallStyle: 'stone', decor: [{ tex: 'furn-barometer', x: 1250, y: 650, scale: 0.85 }, { tex: 'furn-lamp', x: 900, y: 650, scale: 0.8 }, { tex: 'furn-tide-chart', x: 1360, y: 610, scale: 0.85 }, { tex: 'spr-lamp-wick-rack', x: 1400, y: 810, scale: 1.5 }] },
];

export const saltmarshLayout: CaseLayout = {
  caseId: 'saltmarsh_lighthouse',
  rooms,
  spawns: Object.fromEntries(
    rooms.map((r) => [r.id, { x: r.x + ROOM_W / 2, y: r.y + ROOM_H / 2 }]),
  ),
  doors: [
    { id: 'D_CAU_GAL', roomId: 'causeway', label: '→ Galley', x: 632, y: 214, w: 48, h: 72, targetRoomId: 'galley' },
    { id: 'D_GAL_CAU', roomId: 'galley', label: '→ Causeway', x: 784, y: 214, w: 48, h: 72, targetRoomId: 'causeway' },
    { id: 'D_CAU_BUN', roomId: 'causeway', label: '→ Bunkroom', x: 400, y: 412, w: 72, h: 48, targetRoomId: 'bunkroom' },
    { id: 'D_BUN_CAU', roomId: 'bunkroom', label: '→ Causeway', x: 1750, y: 412, w: 72, h: 48, targetRoomId: 'causeway' },
    { id: 'D_GAL_LAM', roomId: 'galley', label: '→ Lamp Room', x: 1024, y: 412, w: 72, h: 48, targetRoomId: 'lamp_room' },
    { id: 'D_LAM_GAL', roomId: 'lamp_room', label: '→ Galley', x: 1024, y: 560, w: 72, h: 48, targetRoomId: 'galley' },
  ],
  objects: [
    { id: 'beacon_lamp', roomId: 'lamp_room', label: 'Great lamp', x: 1100, y: 650, radius: 70, sprite: { kind: 'texture', key: 'spr-beacon-lamp' }, scale: 2.5, evidence: 'E_LAMP' },
    { id: 'oil_can', roomId: 'lamp_room', label: 'Empty oil can', x: 950, y: 850, radius: 64, sprite: { kind: 'texture', key: 'spr-oil-can' }, scale: 2, evidence: 'E_OIL' },
    { id: 'store_lock', roomId: 'lamp_room', label: 'Oil-store lock (look closer)', x: 1250, y: 850, radius: 60, sprite: { kind: 'texture', key: 'spr-brass-lock' }, scale: 2, evidence: 'E_LOCK' },
    { id: 'oily_prints', roomId: 'lamp_room', label: 'Oily footprint', x: 950, y: 720, radius: 64, sprite: { kind: 'texture', key: 'spr-oily-prints' }, scale: 1.5, evidence: 'E_PRINTS' },
    { id: 'finns_coat', roomId: 'bunkroom', label: "Finn's coat", x: 1640, y: 280, radius: 64, sprite: { kind: 'texture', key: 'spr-oilskin-coat' }, scale: 2, evidence: 'E_COAT' },
    { id: 'debt_ledger', roomId: 'bunkroom', label: 'Harbor debt ledger', x: 1900, y: 200, radius: 64, sprite: { kind: 'texture', key: 'spr-open-ledger' }, scale: 2, evidence: 'E_LEDGER' },
    { id: 'finns_seaboots', roomId: 'bunkroom', label: 'Sea boots', x: 1700, y: 420, radius: 64, sprite: { kind: 'texture', key: 'spr-sea-boots' }, scale: 2.5, evidence: 'E_BOOTS' },
    { id: 'flour_apron', roomId: 'galley', label: 'Floured apron', x: 1100, y: 300, radius: 64, sprite: { kind: 'texture', key: 'spr-apron' }, scale: 2.5, evidence: 'E_APRON' },
  ],
  npcSpots: {
    causeway: [
      { x: 480, y: 140 },
      { x: 220, y: 140 },
    ],
    galley: [
      { x: 900, y: 140 },
      { x: 1240, y: 140 },
    ],
    bunkroom: [
      { x: 1900, y: 350 },
      { x: 2100, y: 150 },
    ],
    lamp_room: [
      { x: 840, y: 630 },
      { x: 1360, y: 700 },
    ],
  },
  worldW: 2240,
  worldH: 1080,
  startRoom: 'causeway',
};
