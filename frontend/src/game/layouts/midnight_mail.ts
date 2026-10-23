import type { CaseLayout } from './types';

const W = 640;
const H = 420;
const rooms: CaseLayout['rooms'] = [
  { id: 'victoria_platform', name: 'Victoria Platform', x: 800, y: 40, w: W, h: H, floorStyle: 'stone', wallStyle: 'stone', decor: [{ tex: 'prop-rail-08', x: 900, y: 120 }, { tex: 'prop-rail-02', x: 1360, y: 130 }] },
  { id: 'postal_carriage', name: 'Postal Carriage', x: 40, y: 40, w: W, h: H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'prop-rail-04', x: 150, y: 130 }, { tex: 'prop-rail-07', x: 580, y: 350 }] },
  { id: 'guard_van', name: "Guard's Van", x: 40, y: 560, w: W, h: H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'prop-rail-13', x: 150, y: 650 }, { tex: 'prop-rail-06', x: 580, y: 870 }] },
  { id: 'dining_car', name: 'Dining Car', x: 1560, y: 40, w: W, h: H, floorStyle: 'carpet', wallStyle: 'wood', decor: [{ tex: 'prop-rail-03', x: 1660, y: 120 }, { tex: 'prop-rail-11', x: 2120, y: 360 }] },
  { id: 'conductor_cabin', name: "Conductor's Cabin", x: 800, y: 560, w: W, h: H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'prop-rail-05', x: 900, y: 650 }, { tex: 'prop-rail-09', x: 1360, y: 860 }] },
  { id: 'luggage_car', name: 'Luggage Car', x: 40, y: 1080, w: W, h: H, floorStyle: 'wood', wallStyle: 'wood', decor: [{ tex: 'prop-rail-10', x: 150, y: 1170 }, { tex: 'prop-rail-15', x: 580, y: 1380 }] },
];

export const midnightMailLayout: CaseLayout = {
  caseId: 'midnight_mail', rooms,
  spawns: Object.fromEntries(rooms.map((room) => [room.id, { x: room.x + W / 2, y: room.y + H / 2 }])),
  doors: [
    { id: 'platform_postal_a', roomId: 'victoria_platform', label: 'To Postal Carriage', x: 784, y: 214, w: 48, h: 72, targetRoomId: 'postal_carriage' },
    { id: 'platform_postal_b', roomId: 'postal_carriage', label: 'To Platform', x: 680, y: 214, w: 48, h: 72, targetRoomId: 'victoria_platform' },
    { id: 'platform_dining_a', roomId: 'victoria_platform', label: 'To Dining Car', x: 1440, y: 214, w: 48, h: 72, targetRoomId: 'dining_car' },
    { id: 'platform_dining_b', roomId: 'dining_car', label: 'To Platform', x: 1504, y: 214, w: 48, h: 72, targetRoomId: 'victoria_platform' },
    { id: 'platform_cabin_a', roomId: 'victoria_platform', label: 'To Conductor Cabin', x: 1084, y: 412, w: 72, h: 48, targetRoomId: 'conductor_cabin' },
    { id: 'platform_cabin_b', roomId: 'conductor_cabin', label: 'To Platform', x: 1084, y: 560, w: 72, h: 48, targetRoomId: 'victoria_platform' },
    { id: 'postal_guard_a', roomId: 'postal_carriage', label: "To Guard's Van", x: 340, y: 412, w: 72, h: 48, targetRoomId: 'guard_van' },
    { id: 'postal_guard_b', roomId: 'guard_van', label: 'To Postal Carriage', x: 340, y: 560, w: 72, h: 48, targetRoomId: 'postal_carriage' },
    { id: 'guard_luggage_a', roomId: 'guard_van', label: 'To Luggage Car', x: 340, y: 980, w: 72, h: 48, targetRoomId: 'luggage_car' },
    { id: 'guard_luggage_b', roomId: 'luggage_car', label: "To Guard's Van", x: 340, y: 1080, w: 72, h: 48, targetRoomId: 'guard_van' },
  ],
  objects: [
    { id: 'empty_pouch', roomId: 'postal_carriage', label: 'Empty dispatch pouch', x: 140, y: 180, radius: 54, sprite: { kind: 'image', key: 'prop-rail-04' }, evidence: 'E_POUCH' },
    { id: 'wax_seal', roomId: 'postal_carriage', label: 'Remade wax seal', x: 340, y: 360, radius: 50, sprite: { kind: 'image', key: 'prop-rail-00' }, evidence: 'E_SEAL' },
    { id: 'ticket_punch', roomId: 'postal_carriage', label: 'Brass ticket punch', x: 580, y: 170, radius: 50, sprite: { kind: 'image', key: 'prop-rail-01' }, evidence: 'E_PUNCH' },
    { id: 'sorting_list', roomId: 'postal_carriage', label: 'Sorting list', x: 580, y: 360, radius: 50, sprite: { kind: 'image', key: 'prop-rail-07' }, evidence: 'E_SORT' },
    { id: 'guard_ledger', roomId: 'guard_van', label: 'Seal ledger', x: 140, y: 660, radius: 50, sprite: { kind: 'image', key: 'prop-rail-09' }, evidence: 'E_LEDGER' },
    { id: 'van_key', roomId: 'conductor_cabin', label: 'Van key register', x: 900, y: 660, radius: 50, sprite: { kind: 'image', key: 'prop-rail-05' }, evidence: 'E_KEY' },
    { id: 'signal_notice', roomId: 'conductor_cabin', label: 'Redbridge signal notice', x: 1360, y: 660, radius: 50, sprite: { kind: 'image', key: 'prop-rail-15' }, evidence: 'E_STOP' },
    { id: 'debt_letter', roomId: 'dining_car', label: 'Letter beneath the saucer', x: 1660, y: 360, radius: 50, sprite: { kind: 'image', key: 'prop-rail-03' }, evidence: 'E_MOTIVE' },
    { id: 'finn_punch', roomId: 'victoria_platform', label: "Porter's ticket punch", x: 900, y: 360, radius: 50, sprite: { kind: 'image', key: 'prop-rail-01' }, evidence: 'E_FINN_PUNCH' },
    { id: 'station_clock', roomId: 'victoria_platform', label: 'Station clock record', x: 1360, y: 160, radius: 50, sprite: { kind: 'image', key: 'prop-rail-02' }, evidence: 'E_CLOCK' },
    { id: 'scratched_trunk', roomId: 'luggage_car', label: 'Scratched railway trunk', x: 340, y: 1280, radius: 56, sprite: { kind: 'image', key: 'prop-rail-04' }, evidence: 'E_TRUNK' },
    { id: 'coal_gloves', roomId: 'guard_van', label: 'Coal-stained gloves', x: 580, y: 860, radius: 50, sprite: { kind: 'image', key: 'prop-rail-06' }, evidence: 'E_GLOVES' },
  ],
  npcSpots: {
    victoria_platform: [{ x: 920, y: 340 }, { x: 1320, y: 340 }],
    postal_carriage: [{ x: 240, y: 340 }, { x: 560, y: 340 }],
    guard_van: [{ x: 220, y: 850 }, { x: 560, y: 850 }],
  },
  worldW: 2240, worldH: 1600, startRoom: 'victoria_platform',
};
