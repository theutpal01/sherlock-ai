import type { CaseLayout } from './types';

const ROOM_W = 640;
const ROOM_H = 420;

const rooms: CaseLayout['rooms'] = [
  { id: 'foyer', name: 'Foyer', x: 40, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'stone', wallStyle: 'wood', decor: [{ tex: 'furn-rug', x: 360, y: 300, scale: 1.5 }, { tex: 'furn-plant', x: 550, y: 130, scale: 2 }] },
  { id: 'auditorium', name: 'Auditorium', x: 800, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'carpet', wallStyle: 'wood', decor: [{ tex: 'furn-rug', x: 1120, y: 250, scale: 1.5 }, { tex: 'furn-plant', x: 860, y: 150, scale: 2 }] },
  { id: 'stage', name: 'Stage', x: 800, y: 560, w: ROOM_W, h: ROOM_H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'furn-lamp', x: 1000, y: 700, scale: 1.5 }, { tex: 'furn-plant', x: 1350, y: 650, scale: 2 }] },
  { id: 'dressing', name: 'Dressing Room', x: 1560, y: 560, w: ROOM_W, h: ROOM_H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'furn-mirror', x: 1700, y: 600, scale: 2 }, { tex: 'furn-wardrobe', x: 1900, y: 180, scale: 2 }, { tex: 'furn-rug', x: 1800, y: 300, scale: 1.5 }, { tex: 'furn-lamp', x: 1650, y: 620, scale: 1.5 }] },
  { id: 'alley', name: 'Stage Alley', x: 1560, y: 40, w: ROOM_W, h: ROOM_H, floorStyle: 'stone', wallStyle: 'hedge', decor: [{ tex: 'furn-plant', x: 1650, y: 150, scale: 2 }] },
  { id: 'workshop', name: 'Workshop', x: 40, y: 560, w: ROOM_W, h: ROOM_H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'furn-stool', x: 400, y: 700, scale: 1.5 }, { tex: 'furn-shelf', x: 500, y: 700, scale: 2 }] },
];

export const hollowayLayout: CaseLayout = {
  caseId: 'holloway_theatre',
  rooms,
  spawns: Object.fromEntries(
    rooms.map((r) => [r.id, { x: r.x + ROOM_W / 2, y: r.y + ROOM_H / 2 }]),
  ),
  doors: [
    { id: 'D_FOY_AUD', roomId: 'foyer', label: '→ Auditorium', x: 632, y: 150, w: 48, h: 72, targetRoomId: 'auditorium' },
    { id: 'D_FOY_ALL', roomId: 'foyer', label: '→ Alley', x: 632, y: 320, w: 48, h: 72, targetRoomId: 'alley' },
    { id: 'D_AUD_FOY', roomId: 'auditorium', label: '→ Foyer', x: 784, y: 150, w: 48, h: 72, targetRoomId: 'foyer' },
    { id: 'D_AUD_STA', roomId: 'auditorium', label: '→ Stage', x: 1060, y: 412, w: 72, h: 48, targetRoomId: 'stage' },
    { id: 'D_STA_AUD', roomId: 'stage', label: '→ Auditorium', x: 1060, y: 560, w: 72, h: 48, targetRoomId: 'auditorium' },
    { id: 'D_STA_DRE', roomId: 'stage', label: '→ Dressing', x: 1408, y: 734, w: 48, h: 72, targetRoomId: 'dressing' },
    { id: 'D_STA_ALL', roomId: 'stage', label: '→ Alley', x: 1208, y: 560, w: 72, h: 48, targetRoomId: 'alley' },
    { id: 'D_DRE_STA', roomId: 'dressing', label: '→ Stage', x: 1544, y: 734, w: 48, h: 72, targetRoomId: 'stage' },
    { id: 'D_ALL_STA', roomId: 'alley', label: '→ Stage', x: 1700, y: 412, w: 72, h: 48, targetRoomId: 'stage' },
    { id: 'D_ALL_FOY', roomId: 'alley', label: '→ Foyer', x: 1544, y: 150, w: 48, h: 72, targetRoomId: 'foyer' },
    { id: 'D_STA_WOR', roomId: 'stage', label: '→ Workshop', x: 784, y: 734, w: 48, h: 72, targetRoomId: 'workshop' },
    { id: 'D_WOR_STA', roomId: 'workshop', label: '→ Stage', x: 616, y: 734, w: 48, h: 72, targetRoomId: 'stage' },
  ],
  objects: [
    { id: 'call_bell', roomId: 'stage', label: 'Call bell', x: 950, y: 650, radius: 70, sprite: { kind: 'frame', frame: 73 }, scale: 2.5, evidence: 'E_BELL' },
    { id: 'violin_case', roomId: 'dressing', label: 'Open safe', x: 1800, y: 650, radius: 70, sprite: { kind: 'frame', frame: 90 }, scale: 2.5, evidence: 'E_SAFE' },
    { id: 'veras_programme', roomId: 'foyer', label: "Vera's programme", x: 200, y: 300, radius: 64, sprite: { kind: 'frame', frame: 129 }, scale: 2, evidence: 'E_PROGRAMME' },
    { id: 'gambling_iou', roomId: 'dressing', label: 'Torn IOU', x: 1700, y: 850, radius: 64, sprite: { kind: 'frame', frame: 130 }, scale: 2, evidence: 'E_DEBTS' },
    { id: 'rosin_dust', roomId: 'stage', label: 'Rosin trail', x: 1000, y: 850, radius: 64, sprite: { kind: 'texture', key: 'spr-prints' }, scale: 2.5, evidence: 'E_ROSIN' },
    { id: 'work_boots', roomId: 'alley', label: 'Work boots', x: 1700, y: 200, radius: 64, sprite: { kind: 'texture', key: 'spr-boots' }, scale: 2.5, evidence: 'E_BOOTS' },
    { id: 'mended_curtain', roomId: 'workshop', label: 'Mended curtain panel', x: 200, y: 850, radius: 64, sprite: { kind: 'texture', key: 'spr-curtain' }, scale: 2.5, evidence: 'E_CURTAIN' },
  ],
  npcSpots: {
    foyer: [
      { x: 480, y: 140 },
      { x: 220, y: 300 },
    ],
    auditorium: [
      { x: 900, y: 140 },
      { x: 1250, y: 300 },
    ],
    stage: [
      { x: 900, y: 660 },
      { x: 1250, y: 750 },
    ],
    dressing: [
      { x: 1700, y: 700 },
      { x: 1900, y: 300 },
    ],
    alley: [
      { x: 1700, y: 330 },
      { x: 1850, y: 150 },
    ],
    workshop: [
      { x: 300, y: 700 },
      { x: 500, y: 850 },
    ],
  },
  worldW: 2240,
  worldH: 1540,
  startRoom: 'foyer',
};
