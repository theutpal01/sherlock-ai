import type { CaseLayout } from './types';

const ROOM_W = 640;
const ROOM_H = 420;

const rooms: CaseLayout['rooms'] = [
  {
    id: 'fern_corridor', name: 'Fern Corridor', x: 800, y: 40, w: ROOM_W, h: ROOM_H,
    floorStyle: 'glasshouse', wallStyle: 'iron-glass',
    decor: [
      { tex: 'prop-seed-packet', x: 900, y: 120, scale: 0.45 },
      { tex: 'furn-plant', x: 1350, y: 120, scale: 0.9 },
    ],
  },
  {
    id: 'orchid_gallery', name: 'Orchid Gallery', x: 40, y: 40, w: ROOM_W, h: ROOM_H,
    floorStyle: 'glasshouse', wallStyle: 'iron-glass',
    decor: [
      { tex: 'prop-orchid-cloche', x: 100, y: 120, scale: 0.5 },
      { tex: 'prop-orchid-pollen', x: 540, y: 120, scale: 0.45 },
      { tex: 'furn-birdbath', x: 560, y: 370, scale: 0.85 },
    ],
  },
  {
    id: 'curator_office', name: "Curator's Office", x: 800, y: 560, w: ROOM_W, h: ROOM_H,
    floorStyle: 'wood', wallStyle: 'wood',
    decor: [
      { tex: 'prop-botanists-ledger', x: 880, y: 660, scale: 0.45 },
      { tex: 'furn-books', x: 1380, y: 650, scale: 0.8 },
      { tex: 'furn-desk', x: 1320, y: 890, scale: 0.9, solid: true },
    ],
  },
  {
    id: 'potting_shed', name: 'Potting Shed', x: 1560, y: 560, w: ROOM_W, h: ROOM_H,
    floorStyle: 'grass', wallStyle: 'hedge',
    decor: [
      { tex: 'prop-pruning-shears', x: 1660, y: 650, scale: 0.45 },
      { tex: 'prop-broken-pot', x: 2100, y: 680, scale: 0.45 },
      { tex: 'furn-shelf', x: 2140, y: 850, scale: 0.9, solid: true },
    ],
  },
  {
    id: 'boiler_room', name: 'Boiler Room', x: 1560, y: 40, w: ROOM_W, h: ROOM_H,
    floorStyle: 'stone', wallStyle: 'stone',
    decor: [
      { tex: 'prop-cracked-thermometer', x: 1650, y: 130, scale: 0.45 },
      { tex: 'prop-blue-fertilizer', x: 2110, y: 140, scale: 0.45 },
      { tex: 'furn-lamp', x: 2160, y: 330, scale: 0.8 },
    ],
  },
];

export const glasshouseOrchidLayout: CaseLayout = {
  caseId: 'glasshouse_orchid',
  rooms,
  spawns: Object.fromEntries(rooms.map((room) => [room.id, { x: room.x + ROOM_W / 2, y: room.y + ROOM_H / 2 }])),
  doors: [
    { id: 'corridor_gallery_a', roomId: 'fern_corridor', label: 'To Orchid Gallery', x: 784, y: 214, w: 48, h: 72, targetRoomId: 'orchid_gallery' },
    { id: 'corridor_gallery_b', roomId: 'orchid_gallery', label: 'To Fern Corridor', x: 680, y: 214, w: 48, h: 72, targetRoomId: 'fern_corridor' },
    { id: 'corridor_office_a', roomId: 'fern_corridor', label: "To Curator's Office", x: 1084, y: 412, w: 72, h: 48, targetRoomId: 'curator_office' },
    { id: 'corridor_office_b', roomId: 'curator_office', label: 'To Fern Corridor', x: 1084, y: 560, w: 72, h: 48, targetRoomId: 'fern_corridor' },
    { id: 'office_shed_a', roomId: 'curator_office', label: 'To Potting Shed', x: 1440, y: 734, w: 48, h: 72, targetRoomId: 'potting_shed' },
    { id: 'office_shed_b', roomId: 'potting_shed', label: "To Curator's Office", x: 1544, y: 734, w: 48, h: 72, targetRoomId: 'curator_office' },
    { id: 'shed_boiler_a', roomId: 'potting_shed', label: 'To Boiler Room', x: 1844, y: 560, w: 72, h: 48, targetRoomId: 'boiler_room' },
    { id: 'shed_boiler_b', roomId: 'boiler_room', label: 'To Potting Shed', x: 1844, y: 412, w: 72, h: 48, targetRoomId: 'potting_shed' },
  ],
  objects: [
    { id: 'orchid_case', roomId: 'orchid_gallery', label: 'Empty orchid case', x: 500, y: 180, radius: 58, sprite: { kind: 'image', key: 'prop-orchid-cloche' }, scale: 0.5, evidence: 'E_EMPTY' },
    { id: 'gallery_lock', roomId: 'orchid_gallery', label: 'Case lock and latch', x: 600, y: 370, radius: 52, sprite: { kind: 'image', key: 'prop-greenhouse-lock' }, scale: 0.45, evidence: 'E_LOCK' },
    { id: 'gallery_thermometer', roomId: 'orchid_gallery', label: 'Cracked thermometer', x: 140, y: 360, radius: 52, sprite: { kind: 'image', key: 'prop-cracked-thermometer' }, scale: 0.45, evidence: 'E_TIME' },
    { id: 'muddy_tracks', roomId: 'orchid_gallery', label: 'Mossy boot impressions', x: 340, y: 380, radius: 52, sprite: { kind: 'image', key: 'prop-greenhouse-bootprint' }, scale: 0.45, evidence: 'E_TRACKS' },
    { id: 'visitor_book', roomId: 'fern_corridor', label: 'Night visitor book', x: 1300, y: 370, radius: 52, sprite: { kind: 'image', key: 'prop-midnight-watch' }, scale: 0.45, evidence: 'E_VISITOR' },
    { id: 'seed_telegram', roomId: 'curator_office', label: 'Telegram from the seed company', x: 940, y: 880, radius: 52, sprite: { kind: 'image', key: 'prop-sealed-telegram' }, scale: 0.45, evidence: 'E_DEBT' },
    { id: 'key_ledger', roomId: 'curator_office', label: 'Greenhouse key ledger', x: 1300, y: 700, radius: 52, sprite: { kind: 'image', key: 'prop-botanists-ledger' }, scale: 0.45, evidence: 'E_KEY' },
    { id: 'curator_gloves', roomId: 'potting_shed', label: "Celia's gardening gloves", x: 1700, y: 880, radius: 52, sprite: { kind: 'image', key: 'prop-gardening-gloves' }, scale: 0.45, evidence: 'E_GLOVES' },
    { id: 'celia_boots', roomId: 'potting_shed', label: "Celia's garden boots", x: 1950, y: 870, radius: 52, sprite: { kind: 'image', key: 'prop-greenhouse-bootprint' }, scale: 0.45, evidence: 'E_BOOTS' },
    { id: 'rowan_log', roomId: 'boiler_room', label: 'Boiler pressure log', x: 1730, y: 360, radius: 52, sprite: { kind: 'image', key: 'prop-cracked-thermometer' }, scale: 0.45, evidence: 'E_BOILER' },
    { id: 'silver_can', roomId: 'potting_shed', label: 'Silver watering can', x: 2100, y: 650, radius: 58, sprite: { kind: 'image', key: 'prop-watering-can' }, scale: 0.55, evidence: 'E_ORCHID' },
  ],
  npcSpots: {
    fern_corridor: [{ x: 900, y: 180 }, { x: 1300, y: 180 }],
    orchid_gallery: [{ x: 160, y: 180 }, { x: 600, y: 180 }],
    curator_office: [{ x: 900, y: 700 }, { x: 1350, y: 700 }],
    potting_shed: [{ x: 1650, y: 700 }, { x: 2110, y: 700 }],
    boiler_room: [{ x: 1650, y: 180 }, { x: 2110, y: 180 }],
  },
  worldW: 2240,
  worldH: 1080,
  startRoom: 'fern_corridor',
};
