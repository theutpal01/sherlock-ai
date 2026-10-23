import type { CaseLayout } from './types';

const ROOM_W = 640;
const ROOM_H = 420;

const rooms: CaseLayout['rooms'] = [
  {
    id: 'entry_hall',
    name: 'Entry Hall',
    x: 40,
    y: 40,
    w: ROOM_W,
    h: ROOM_H,
    floorStyle: 'wood',
    wallStyle: 'copper',
    decor: [
      { tex: 'prop-armillary', x: 100, y: 120, scale: 0.5 },
      { tex: 'prop-star-map-chart', x: 520, y: 110, scale: 0.45 },
    ],
  },
  {
    id: 'telescope_dome',
    name: 'Telescope Dome',
    x: 800,
    y: 40,
    w: ROOM_W,
    h: ROOM_H,
    floorStyle: 'star-map',
    wallStyle: 'copper',
    decor: [
      { tex: 'prop-observatory-telescope', x: 990, y: 110, scale: 0.7 },
      { tex: 'prop-armillary', x: 1320, y: 340, scale: 0.5 },
    ],
  },
  {
    id: 'darkroom',
    name: 'Darkroom',
    x: 1560,
    y: 40,
    w: ROOM_W,
    h: ROOM_H,
    floorStyle: 'stone',
    wallStyle: 'velvet',
    decor: [
      { tex: 'prop-darkroom-tongs', x: 1850, y: 110, scale: 0.45 },
      { tex: 'furn-shelf', x: 2100, y: 100, scale: 0.9, solid: true },
    ],
  },
  {
    id: 'chart_archive',
    name: 'Chart Archive',
    x: 40,
    y: 560,
    w: ROOM_W,
    h: ROOM_H,
    floorStyle: 'star-map',
    wallStyle: 'copper',
    decor: [
      { tex: 'furn-books', x: 100, y: 650, scale: 0.8 },
      { tex: 'prop-star-map-chart', x: 500, y: 620, scale: 0.45 },
      { tex: 'furn-desk', x: 500, y: 870, scale: 0.9, solid: true },
    ],
  },
  {
    id: 'generator_room',
    name: 'Generator Room',
    x: 800,
    y: 560,
    w: ROOM_W,
    h: ROOM_H,
    floorStyle: 'stone',
    wallStyle: 'copper',
    decor: [
      { tex: 'prop-observatory-dynamo', x: 1260, y: 660, scale: 0.55 },
      { tex: 'furn-lamp', x: 900, y: 660, scale: 0.8 },
    ],
  },
];

export const starfallObservatoryLayout: CaseLayout = {
  caseId: 'starfall_observatory',
  rooms,
  spawns: Object.fromEntries(
    rooms.map((room) => [room.id, { x: room.x + ROOM_W / 2, y: room.y + ROOM_H / 2 }]),
  ),
  doors: [
    { id: 'entry_dome_a', roomId: 'entry_hall', label: 'To Telescope Dome', x: 632, y: 214, w: 48, h: 72, targetRoomId: 'telescope_dome' },
    { id: 'entry_dome_b', roomId: 'telescope_dome', label: 'To Entry Hall', x: 784, y: 214, w: 48, h: 72, targetRoomId: 'entry_hall' },
    { id: 'entry_archive_a', roomId: 'entry_hall', label: 'To Chart Archive', x: 324, y: 412, w: 72, h: 48, targetRoomId: 'chart_archive' },
    { id: 'entry_archive_b', roomId: 'chart_archive', label: 'To Entry Hall', x: 324, y: 560, w: 72, h: 48, targetRoomId: 'entry_hall' },
    { id: 'dome_darkroom_a', roomId: 'telescope_dome', label: 'To Darkroom', x: 1392, y: 214, w: 48, h: 72, targetRoomId: 'darkroom' },
    { id: 'dome_darkroom_b', roomId: 'darkroom', label: 'To Telescope Dome', x: 1544, y: 214, w: 48, h: 72, targetRoomId: 'telescope_dome' },
    { id: 'dome_generator_a', roomId: 'telescope_dome', label: 'To Generator Room', x: 1084, y: 412, w: 72, h: 48, targetRoomId: 'generator_room' },
    { id: 'dome_generator_b', roomId: 'generator_room', label: 'To Telescope Dome', x: 1084, y: 560, w: 72, h: 48, targetRoomId: 'telescope_dome' },
    { id: 'archive_generator_a', roomId: 'chart_archive', label: 'To Generator Room', x: 632, y: 734, w: 48, h: 72, targetRoomId: 'generator_room' },
    { id: 'archive_generator_b', roomId: 'generator_room', label: 'To Chart Archive', x: 784, y: 734, w: 48, h: 72, targetRoomId: 'chart_archive' },
  ],
  objects: [
    { id: 'plate_case', roomId: 'telescope_dome', label: 'Padded plate case', x: 1280, y: 190, radius: 64, sprite: { kind: 'image', key: 'prop-negative-case' }, scale: 0.55, evidence: 'E_PLATE' },
    { id: 'dome_lock', roomId: 'telescope_dome', label: 'Plate-case lock', x: 1340, y: 340, radius: 56, sprite: { kind: 'texture', key: 'spr-brass-lock' }, scale: 2, evidence: 'E_LOCK' },
    { id: 'star_log', roomId: 'telescope_dome', label: 'Telescope log', x: 900, y: 340, radius: 56, sprite: { kind: 'image', key: 'prop-star-map-chart' }, scale: 0.45, evidence: 'E_LOG' },
    { id: 'dome_tracks', roomId: 'telescope_dome', label: 'Frosted dome tracks', x: 1050, y: 370, radius: 56, sprite: { kind: 'image', key: 'prop-blue-silica-tracks' }, scale: 0.45, evidence: 'E_TRACK' },
    { id: 'key_register', roomId: 'chart_archive', label: 'Duplicate-key register', x: 380, y: 840, radius: 56, sprite: { kind: 'image', key: 'prop-key-register' }, scale: 0.45, evidence: 'E_DARKROOM_KEY' },
    { id: 'publisher_cable', roomId: 'chart_archive', label: "Publisher's cable", x: 170, y: 870, radius: 56, sprite: { kind: 'image', key: 'prop-accession-letter' }, scale: 0.45, evidence: 'E_DEBT' },
    { id: 'archive_seal', roomId: 'chart_archive', label: 'Night accession ledger', x: 540, y: 710, radius: 56, sprite: { kind: 'image', key: 'prop-open-field-notes' }, scale: 0.45, evidence: 'E_ARCHIVE_SEAL' },
    { id: 'elias_boots', roomId: 'darkroom', label: "Director's observing boots", x: 1690, y: 340, radius: 56, sprite: { kind: 'image', key: 'prop-observing-boots' }, scale: 0.45, evidence: 'E_BOOTS' },
    { id: 'emulsion_gloves', roomId: 'darkroom', label: 'Drying-room gloves', x: 2020, y: 350, radius: 56, sprite: { kind: 'image', key: 'prop-darkroom-gloves' }, scale: 0.45, evidence: 'E_GLOVES' },
    { id: 'dynamo_ledger', roomId: 'generator_room', label: 'Dynamo gauge and log', x: 960, y: 850, radius: 56, sprite: { kind: 'image', key: 'prop-observatory-dynamo' }, scale: 0.45, evidence: 'E_DYNAMO' },
  ],
  npcSpots: {
    entry_hall: [{ x: 160, y: 150 }, { x: 520, y: 150 }],
    telescope_dome: [{ x: 900, y: 320 }, { x: 1330, y: 150 }],
    darkroom: [{ x: 1700, y: 150 }, { x: 2100, y: 150 }],
    chart_archive: [{ x: 120, y: 760 }, { x: 500, y: 760 }],
    generator_room: [{ x: 900, y: 760 }, { x: 1320, y: 760 }],
  },
  worldW: 2240,
  worldH: 1080,
  startRoom: 'entry_hall',
};
