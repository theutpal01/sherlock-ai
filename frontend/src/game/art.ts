import Phaser from 'phaser';
export { CHAR_IDS, characterAssetId, portrait } from './portraits';

export type FloorStyle = 'stone' | 'wood' | 'grass' | 'carpet' | 'marsh' | 'star-map' | 'glasshouse';
export type WallStyle = 'wood' | 'hedge' | 'stone' | 'velvet' | 'reeds' | 'copper' | 'iron-glass';
/** Image-backed floor textures loaded directly by the scene. */
export const STATIC_FLOOR_STYLES = ['wood', 'stone', 'grass', 'carpet', 'marsh', 'star-map', 'glasshouse'] as const;
/** Image-backed wall textures loaded directly by the scene. */
export const STATIC_WALL_STYLES = ['wood', 'hedge', 'stone', 'velvet', 'reeds', 'copper', 'iron-glass'] as const;

/** Read the live preference so OS accessibility changes apply mid-session. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Walk frames per direction on a 24x32 sheet:
 *  row 0 = back/up, row 1 = right profile, row 2 = front/down,
 *  row 3 = left profile. */
export const WALK_FRAMES = {
  left: [18, 19, 18, 20],
  right: [6, 7, 6, 8],
  down: [12, 13, 12, 14],
  up: [0, 1, 0, 2],
} as const;

/** Standing frames per direction (first frame of each walk triple). */
export const IDLE_FRAMES = { down: 12, left: 18, right: 6, up: 0 } as const;

export type Facing = keyof typeof IDLE_FRAMES;

/** Furniture images preloaded as world decor textures. */
export const FURNITURE = [
  'rug',
  'mirror',
  'lamp',
  'desk',
  'wardrobe',
  'shelf',
  'books',
  'stool',
  'plant',
  'duck',
  'theatre-masks',
  'birdbath',
  'barometer',
  'tide-chart',
] as const;

export const STARFALL_PROPS = [
  'armillary', 'star-map-chart', 'observatory-telescope', 'darkroom-tongs',
  'observatory-dynamo', 'glass-negative', 'blue-silica-tracks', 'key-register',
  'observing-boots', 'darkroom-gloves', 'open-field-notes', 'negative-case',
  'accession-letter', 'comet-pin', 'observatory-seal',
] as const;

export const GREENHOUSE_PROPS = [
  'orchid-cloche', 'pruning-shears', 'greenhouse-bootprint', 'seed-packet',
  'greenhouse-key', 'botanists-ledger', 'cracked-thermometer', 'blue-fertilizer',
  'gardening-gloves', 'broken-pot', 'watering-can', 'sealed-telegram',
  'greenhouse-lock', 'emerald-ribbon', 'midnight-watch', 'orchid-pollen',
] as const;

export const MIDNIGHT_MAIL_PROPS = [
  'rail-00', 'rail-01', 'rail-02', 'rail-03',
  'rail-04', 'rail-05', 'rail-06', 'rail-07',
  'rail-08', 'rail-09', 'rail-10', 'rail-11',
  'rail-12', 'rail-13', 'rail-14', 'rail-15',
] as const;

/** Deterministic string hash (stable decor placement across loads). */
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic scatter points inside a rect (seeded by room + index). */
export function decorSpots(
  roomId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
): Array<{ x: number; y: number; s: number }> {
  const spots: Array<{ x: number; y: number; s: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const h1 = hashString(`${roomId}:${i}:x`);
    const h2 = hashString(`${roomId}:${i}:y`);
    spots.push({
      x: x + 28 + (h1 % Math.max(1, w - 56)),
      y: y + 28 + (h2 % Math.max(1, h - 56)),
      s: 1 + (h1 % 3),
    });
  }
  return spots;
}

function paintChandelier(gfx: Phaser.GameObjects.Graphics): void {
  // Brass hanging fixture with three warm candle flames for the manor hall.
  gfx.fillStyle(0x3b3022, 1).fillRect(15, 0, 2, 8);
  gfx.fillStyle(0xb28a43, 1)
    .fillRect(13, 7, 6, 2)
    .fillRect(14, 9, 4, 2);
  gfx.lineStyle(2, 0x947039, 1)
    .lineBetween(5, 13, 27, 13)
    .lineBetween(7, 13, 5, 18)
    .lineBetween(16, 13, 16, 18)
    .lineBetween(25, 13, 27, 18);
  gfx.fillStyle(0x574221, 1)
    .fillRect(3, 17, 5, 2)
    .fillRect(14, 17, 5, 2)
    .fillRect(24, 17, 5, 2);
  gfx.fillStyle(0xe2c16b, 1)
    .fillRect(5, 10, 2, 7)
    .fillRect(15, 10, 2, 7)
    .fillRect(25, 10, 2, 7);
  gfx.fillStyle(0xf5c85b, 1)
    .fillRect(5, 6, 2, 3)
    .fillRect(15, 6, 2, 3)
    .fillRect(25, 6, 2, 3);
  gfx.fillStyle(0xffefad, 1)
    .fillRect(5, 5, 1, 1)
    .fillRect(15, 5, 1, 1)
    .fillRect(25, 5, 1, 1);
  gfx.fillStyle(0x947039, 1)
    .fillRect(4, 19, 3, 2)
    .fillRect(15, 19, 3, 2)
    .fillRect(25, 19, 3, 2);
}

function paintBootPrint(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  highlight: number,
  flipY = false,
): void {
  const printRect = (px: number, py: number, width: number, height: number) =>
    gfx.fillRect(x + px, y + (flipY ? 12 - py - height : py), width, height);
  gfx.fillStyle(color, 0.95);
  printRect(2, 0, 6, 3);
  printRect(1, 3, 8, 3);
  printRect(2, 6, 6, 3);
  printRect(3, 9, 4, 3);
  gfx.fillStyle(highlight, 0.8);
  printRect(3, 1, 3, 1);
  printRect(2, 4, 2, 1);
  printRect(5, 4, 2, 1);
  printRect(2, 8, 2, 1);
  printRect(5, 8, 2, 1);
  printRect(4, 11, 2, 1);
}

function paintMudPrintTrail(
  gfx: Phaser.GameObjects.Graphics,
): void {
  const color = 0x35271d;
  const highlight = 0x786042;
  // Two staggered tracks suggest prints crossing the rug in both directions.
  paintBootPrint(gfx, 1, 0, color, highlight);
  paintBootPrint(gfx, 9, 12, color, highlight, true);
  paintBootPrint(gfx, 17, 0, color, highlight);
  paintBootPrint(gfx, 25, 12, color, highlight, true);
}

function paintOilyFootprint(gfx: Phaser.GameObjects.Graphics): void {
  // One fresh print points down the stair, with a few slick oil drops beyond it.
  paintBootPrint(gfx, 6, 3, 0x343324, 0x9b8a4c, true);
  gfx.fillStyle(0x9b8a4c, 0.8)
    .fillRect(10, 16, 2, 1)
    .fillRect(13, 18, 1, 2)
    .fillRect(9, 20, 2, 1);
}

function paintRosinDust(gfx: Phaser.GameObjects.Graphics): void {
  // Dusty boot impressions cross the wings, with loose rosin grains between them.
  gfx.fillStyle(0x89734c, 1)
    .fillRect(8, 12, 2, 1)
    .fillRect(10, 10, 2, 2)
    .fillRect(12, 9, 2, 2)
    .fillRect(14, 8, 2, 1)
    .fillRect(17, 7, 2, 1)
    .fillRect(19, 6, 2, 1);
  gfx.fillStyle(0xd9c28a, 1)
    .fillRect(9, 12, 1, 1)
    .fillRect(13, 9, 1, 1)
    .fillRect(18, 7, 1, 1);
  paintBootPrint(gfx, 1, 0, 0x6a593e, 0xd9c28a);
  paintBootPrint(gfx, 15, 4, 0x6a593e, 0xd9c28a);
}

function paintManorFireplace(gfx: Phaser.GameObjects.Graphics): void {
  // Carved limestone surround with a live, low ember fire in the great hall.
  gfx.fillStyle(0x211a16, 1).fillRect(2, 4, 36, 27);
  gfx.fillStyle(0x766b5e, 1).fillRect(4, 6, 32, 22);
  gfx.fillStyle(0xaaa08e, 1).fillRect(4, 6, 32, 3);
  gfx.fillStyle(0x4d463e, 1).fillRect(6, 10, 8, 15).fillRect(26, 10, 8, 15);
  gfx.fillStyle(0xc4b79e, 1)
    .fillRect(7, 11, 2, 12)
    .fillRect(11, 11, 2, 12)
    .fillRect(27, 11, 2, 12)
    .fillRect(31, 11, 2, 12);
  gfx.fillStyle(0x251b17, 1).fillRect(14, 10, 12, 15);
  gfx.fillStyle(0x6d3020, 1).fillRect(16, 16, 8, 8);
  gfx.fillStyle(0xd45a25, 1).fillRect(16, 17, 3, 6).fillRect(21, 15, 3, 8);
  gfx.fillStyle(0xf1a33a, 1).fillRect(18, 18, 4, 5).fillRect(20, 13, 2, 4);
  gfx.fillStyle(0x573b29, 1).fillRect(15, 23, 10, 2);
  gfx.fillStyle(0x3c342d, 1).fillRect(2, 28, 36, 3);
  gfx.fillStyle(0xd0c2a7, 1).fillRect(1, 4, 38, 2).fillRect(5, 8, 30, 2);
  gfx.fillStyle(0x847969, 1).fillRect(9, 6, 2, 2).fillRect(29, 6, 2, 2);
}

function paintClock(gfx: Phaser.GameObjects.Graphics): void {
  // Longcase clock: hands fixed at 9:17, with the still pendulum visible below.
  gfx.fillStyle(0x3a2415, 1).fillRect(3, 0, 10, 16);
  gfx.fillStyle(0x704625, 1).fillRect(3, 1, 1, 14).fillRect(12, 1, 1, 14);
  gfx.fillStyle(0xe7e5e4, 1).fillCircle(8, 5, 3);
  gfx.lineStyle(1, 0x1c1917, 1).lineBetween(8, 5, 5, 5).lineBetween(8, 5, 11, 6);
  gfx.fillStyle(0x1d1713, 1).fillRect(5, 9, 6, 5);
  gfx.fillStyle(0xb08a4d, 1).fillRect(5, 9, 6, 1).fillRect(5, 9, 1, 5).fillRect(10, 9, 1, 5).fillRect(5, 13, 6, 1);
  gfx.lineStyle(1, 0xe2c786, 1).lineBetween(8, 10, 8, 12);
  gfx.fillStyle(0xe2c786, 1).fillCircle(8, 13, 1);
}

function paintWineCasks(gfx: Phaser.GameObjects.Graphics): void {
  // Two stacked coopered casks, drawn in the same low-resolution palette as case clues.
  gfx.fillStyle(0x20150f, 1).fillRect(3, 4, 13, 25);
  gfx.fillStyle(0x70462b, 1).fillRect(4, 4, 11, 24);
  gfx.fillStyle(0x9a6840, 1).fillRect(6, 5, 2, 21).fillRect(11, 5, 2, 21);
  gfx.fillStyle(0x443025, 1).fillRect(4, 8, 11, 2).fillRect(4, 21, 11, 2);
  gfx.fillStyle(0xb28254, 1).fillRect(6, 3, 7, 2);

  gfx.fillStyle(0x20150f, 1).fillRect(17, 8, 13, 21);
  gfx.fillStyle(0x583923, 1).fillRect(18, 8, 11, 20);
  gfx.fillStyle(0x805437, 1).fillRect(20, 9, 2, 17).fillRect(25, 9, 2, 17);
  gfx.fillStyle(0x3d2b20, 1).fillRect(18, 12, 11, 2).fillRect(18, 23, 11, 2);
  gfx.fillStyle(0x916442, 1).fillRect(20, 7, 7, 2);
}

function paintWineBottleCrate(gfx: Phaser.GameObjects.Graphics): void {
  // Three cellar bottles stored upright in a scuffed, slatted wooden crate.
  gfx.fillStyle(0x17130f, 1)
    .fillRect(5, 3, 6, 14)
    .fillRect(13, 1, 6, 16)
    .fillRect(21, 4, 6, 13);
  gfx.fillStyle(0x284b35, 1).fillRect(6, 6, 4, 10);
  gfx.fillStyle(0x5b3026, 1).fillRect(14, 4, 4, 12);
  gfx.fillStyle(0x31504e, 1).fillRect(22, 7, 4, 9);
  gfx.fillStyle(0xc5a66a, 1)
    .fillRect(6, 10, 4, 3)
    .fillRect(14, 8, 4, 3)
    .fillRect(22, 11, 4, 2);
  gfx.fillStyle(0x9a7142, 1)
    .fillRect(6, 3, 4, 2)
    .fillRect(14, 1, 4, 2)
    .fillRect(22, 4, 4, 2);

  gfx.fillStyle(0x21170f, 1).fillRect(2, 15, 28, 9);
  gfx.fillStyle(0x754b2c, 1).fillRect(3, 16, 26, 7);
  gfx.fillStyle(0xa77a49, 1).fillRect(4, 16, 24, 1).fillRect(4, 22, 24, 1);
  gfx.fillStyle(0x493120, 1).fillRect(8, 16, 2, 7).fillRect(21, 16, 2, 7);
}

function paintLibraryLadder(gfx: Phaser.GameObjects.Graphics): void {
  // A folded walnut step ladder with brass rungs, stored beside the library shelves.
  gfx.fillStyle(0x1b1511, 1)
    .fillRect(5, 4, 4, 31)
    .fillRect(22, 4, 4, 31)
    .fillRect(7, 32, 17, 4);
  gfx.fillStyle(0x68452a, 1)
    .fillRect(6, 5, 2, 27)
    .fillRect(23, 5, 2, 27)
    .fillRect(8, 31, 15, 2);
  gfx.fillStyle(0x987047, 1)
    .fillRect(9, 8, 13, 2)
    .fillRect(9, 14, 13, 2)
    .fillRect(9, 20, 13, 2)
    .fillRect(9, 26, 13, 2);
  gfx.fillStyle(0xc3a05d, 1)
    .fillRect(10, 8, 11, 1)
    .fillRect(10, 14, 11, 1)
    .fillRect(10, 20, 11, 1)
    .fillRect(10, 26, 11, 1);
  gfx.fillStyle(0x38251a, 1).fillRect(3, 3, 25, 3);
  gfx.fillStyle(0xb4874d, 1).fillRect(5, 3, 21, 1);
}

function paintStageCrates(gfx: Phaser.GameObjects.Graphics): void {
  // Scuffed prop crates stacked in the theatre alley, marked for backstage use.
  gfx.fillStyle(0x21170f, 1).fillRect(2, 4, 17, 16);
  gfx.fillStyle(0x68472e, 1).fillRect(3, 5, 15, 14);
  gfx.fillStyle(0x8a6542, 1).fillRect(4, 6, 13, 2).fillRect(4, 16, 13, 2);
  gfx.fillStyle(0x3d2a1d, 1).fillRect(7, 5, 2, 14).fillRect(13, 5, 2, 14);
  gfx.fillStyle(0xc9a66b, 1).fillRect(8, 10, 4, 1).fillRect(9, 9, 2, 3);

  gfx.fillStyle(0x21170f, 1).fillRect(13, 11, 17, 17);
  gfx.fillStyle(0x765034, 1).fillRect(14, 12, 15, 15);
  gfx.fillStyle(0xa27a4c, 1).fillRect(15, 13, 13, 2).fillRect(15, 24, 13, 2);
  gfx.fillStyle(0x493120, 1).fillRect(18, 12, 2, 15).fillRect(24, 12, 2, 15);
  gfx.fillStyle(0xd2b178, 1)
    .fillRect(19, 18, 4, 1)
    .fillRect(20, 17, 2, 3)
    .fillRect(21, 16, 1, 5);
}

function paintTheatreSeats(gfx: Phaser.GameObjects.Graphics): void {
  // Three red velvet seats with brass arm rests, viewed from above.
  for (const x of [1, 17, 33]) {
    gfx.fillStyle(0x241714, 1).fillRect(x, 4, 13, 21);
    gfx.fillStyle(0x784039, 1).fillRect(x + 1, 5, 11, 8);
    gfx.fillStyle(0xa95443, 1).fillRect(x + 2, 6, 9, 2).fillRect(x + 3, 9, 7, 2);
    gfx.fillStyle(0x4a2924, 1).fillRect(x + 2, 14, 9, 7);
    gfx.fillStyle(0x8c4438, 1).fillRect(x + 3, 15, 7, 4);
    gfx.fillStyle(0xc09a59, 1)
      .fillRect(x, 5, 1, 17)
      .fillRect(x + 12, 5, 1, 17)
      .fillRect(x + 2, 22, 2, 2)
      .fillRect(x + 9, 22, 2, 2);
    gfx.fillStyle(0x5e422c, 1).fillRect(x + 2, 24, 2, 2).fillRect(x + 9, 24, 2, 2);
  }
}

function paintStageCurtains(gfx: Phaser.GameObjects.Graphics): void {
  // Open red velvet drapes frame the dark backstage opening and brass rail.
  gfx.fillStyle(0x21170f, 1).fillRect(2, 3, 60, 19);
  gfx.fillStyle(0x76532e, 1).fillRect(3, 3, 58, 3);
  gfx.fillStyle(0xd0ad67, 1).fillRect(4, 4, 56, 1);
  gfx.fillStyle(0x192027, 1).fillRect(17, 7, 30, 14);
  gfx.fillStyle(0x30343a, 1).fillRect(20, 8, 24, 1);

  gfx.fillStyle(0x54231f, 1).fillRect(4, 6, 12, 15).fillRect(48, 6, 12, 15);
  gfx.fillStyle(0x8d3932, 1)
    .fillRect(5, 7, 3, 12)
    .fillRect(10, 7, 3, 13)
    .fillRect(49, 7, 3, 13)
    .fillRect(55, 7, 3, 12);
  gfx.fillStyle(0xb14d40, 1)
    .fillRect(8, 7, 2, 11)
    .fillRect(13, 7, 2, 12)
    .fillRect(52, 7, 2, 12);
  gfx.fillStyle(0x3a1d1b, 1)
    .fillRect(4, 19, 12, 2)
    .fillRect(48, 19, 12, 2);
  gfx.fillStyle(0xc29a58, 1)
    .fillRect(8, 5, 2, 2)
    .fillRect(14, 5, 2, 2)
    .fillRect(48, 5, 2, 2)
    .fillRect(54, 5, 2, 2);
}

function paintStageFootlights(gfx: Phaser.GameObjects.Graphics): void {
  // A low brass rail with six warm bulbs to mark the front edge of the stage.
  gfx.fillStyle(0x21170f, 1).fillRect(1, 8, 62, 9);
  gfx.fillStyle(0x805934, 1).fillRect(2, 8, 60, 2).fillRect(3, 15, 58, 2);
  gfx.fillStyle(0x39251b, 1).fillRect(4, 10, 56, 4);
  for (const x of [8, 18, 28, 38, 48, 58]) {
    gfx.fillStyle(0xb17d48, 1).fillRect(x - 3, 9, 6, 6);
    gfx.fillStyle(0xf2c86e, 1).fillRect(x - 2, 10, 4, 4);
    gfx.fillStyle(0xffedb2, 1).fillRect(x - 1, 10, 2, 2);
  }
}

function paintTicketBooth(gfx: Phaser.GameObjects.Graphics): void {
  // A small mahogany ticket window with a lit brass frame and a ticket slot.
  gfx.fillStyle(0x21170f, 1).fillRect(3, 3, 26, 27);
  gfx.fillStyle(0x523020, 1).fillRect(5, 5, 22, 23);
  gfx.fillStyle(0x8a5832, 1).fillRect(6, 6, 20, 2).fillRect(6, 7, 2, 19).fillRect(24, 7, 2, 19);
  gfx.fillStyle(0x263a40, 1).fillRect(9, 9, 14, 11);
  gfx.fillStyle(0x537078, 1).fillRect(10, 10, 12, 1).fillRect(10, 11, 2, 7);
  gfx.fillStyle(0xa83e35, 1).fillRect(12, 12, 8, 6);
  gfx.fillStyle(0xf0d38a, 1).fillRect(13, 13, 6, 1).fillRect(14, 15, 4, 1);
  gfx.fillStyle(0x171512, 1).fillRect(10, 22, 12, 2);
  gfx.fillStyle(0xd0ad67, 1).fillRect(13, 22, 6, 1);
  gfx.fillStyle(0x352117, 1).fillRect(6, 27, 20, 3);
}

function paintMarshReeds(gfx: Phaser.GameObjects.Graphics): void {
  // A clump of coastal reeds with seed heads, without the pot from indoor plant art.
  gfx.fillStyle(0x29341e, 1).fillRect(3, 24, 26, 3);
  gfx.fillStyle(0x4c6936, 1)
    .fillRect(7, 12, 2, 13)
    .fillRect(12, 7, 2, 18)
    .fillRect(18, 10, 2, 15)
    .fillRect(23, 15, 2, 10);
  gfx.fillStyle(0x76904a, 1)
    .fillRect(8, 13, 1, 9)
    .fillRect(13, 8, 1, 13)
    .fillRect(19, 11, 1, 10)
    .fillRect(24, 16, 1, 6);
  gfx.lineStyle(2, 0x58703b, 1)
    .lineBetween(12, 16, 5, 11)
    .lineBetween(13, 19, 8, 17)
    .lineBetween(19, 15, 25, 11)
    .lineBetween(20, 20, 26, 17);
  gfx.fillStyle(0x75472b, 1).fillEllipse(13, 4, 5, 8).fillEllipse(19, 7, 4, 7);
  gfx.fillStyle(0xb07b43, 1).fillRect(12, 2, 2, 4).fillRect(18, 5, 2, 4);
}

function paintMarshTideMarker(gfx: Phaser.GameObjects.Graphics): void {
  // A weathered waterline post with pale measurement notches for the causeway.
  gfx.fillStyle(0x1d2823, 1).fillEllipse(12, 36, 23, 6);
  gfx.fillStyle(0x38281b, 1).fillRect(7, 7, 11, 29);
  gfx.fillStyle(0x795333, 1).fillRect(8, 5, 9, 29);
  gfx.fillStyle(0xa77b45, 1).fillRect(9, 6, 2, 26).fillRect(15, 7, 1, 24);
  gfx.fillStyle(0xd0ad70, 1).fillRect(7, 3, 11, 3).fillRect(9, 1, 7, 2);
  gfx.fillStyle(0xd8d0b0, 1)
    .fillRect(10, 13, 6, 2)
    .fillRect(12, 18, 4, 2)
    .fillRect(10, 23, 6, 2)
    .fillRect(12, 28, 4, 2);
  gfx.fillStyle(0x567078, 1).fillRect(3, 32, 17, 2);
}

function paintStormLantern(gfx: Phaser.GameObjects.Graphics): void {
  // Hooded brass lantern built for a wet, windy shoreline.
  gfx.fillStyle(0x26302c, 1).fillRect(7, 1, 10, 2).fillRect(5, 3, 14, 2);
  gfx.fillStyle(0x9a7133, 1).fillRect(6, 5, 12, 2).fillRect(4, 7, 16, 13);
  gfx.fillStyle(0xe1c06c, 1).fillRect(6, 7, 12, 2).fillRect(6, 17, 12, 2);
  gfx.fillStyle(0x41311e, 1).fillRect(8, 9, 8, 7);
  gfx.fillStyle(0xf4c75e, 0.9).fillRect(10, 10, 4, 5);
  gfx.fillStyle(0xffed9a, 1).fillRect(11, 10, 2, 3);
  gfx.fillStyle(0x342719, 1).fillRect(3, 20, 18, 3).fillRect(8, 23, 8, 2);
  gfx.lineStyle(2, 0x9a7133, 1).strokeCircle(12, 4, 5);
}

function paintGalleyPorthole(gfx: Phaser.GameObjects.Graphics): void {
  // A weathered brass porthole with a blue-gray glimpse of the storm outside.
  gfx.fillStyle(0x211a14, 1).fillEllipse(16, 14, 31, 27);
  gfx.fillStyle(0x76512c, 1).fillEllipse(16, 13, 27, 23);
  gfx.fillStyle(0xc29a55, 1).fillEllipse(16, 13, 23, 19);
  gfx.fillStyle(0x3b2b1b, 1).fillEllipse(16, 13, 18, 14);
  gfx.fillStyle(0x293b42, 1).fillEllipse(16, 13, 15, 11);
  gfx.fillStyle(0x5a747a, 1).fillEllipse(15, 10, 11, 4);
  gfx.fillStyle(0x233038, 1).fillRect(15, 7, 2, 13).fillRect(9, 12, 14, 2);
  gfx.fillStyle(0xc8aa65, 1)
    .fillRect(15, 6, 2, 1)
    .fillRect(15, 20, 2, 1)
    .fillRect(8, 12, 1, 2)
    .fillRect(23, 12, 1, 2);
  gfx.fillStyle(0xe2c77e, 1)
    .fillCircle(16, 3, 1)
    .fillCircle(26, 13, 1)
    .fillCircle(16, 24, 1)
    .fillCircle(5, 13, 1);
  gfx.fillStyle(0xd6e1d5, 0.9).fillRect(10, 8, 2, 1).fillRect(9, 9, 1, 3);
}

function paintRopeCoil(gfx: Phaser.GameObjects.Graphics): void {
  // Coiled hemp line with a loose end, in weathered dockside colors.
  gfx.fillStyle(0x35291c, 1).fillEllipse(13, 15, 24, 13);
  gfx.fillStyle(0x9a7540, 1).fillEllipse(13, 13, 21, 12);
  gfx.fillStyle(0xc09a5b, 1).fillEllipse(13, 12, 15, 8);
  gfx.fillStyle(0x53402a, 1).fillEllipse(13, 12, 8, 4);
  gfx.lineStyle(2, 0xd0ad70, 1).strokeEllipse(13, 13, 18, 10);
  gfx.lineStyle(2, 0x765833, 1).strokeEllipse(13, 13, 12, 6);
  gfx.fillStyle(0x9a7540, 1).fillRect(2, 18, 3, 5).fillRect(0, 21, 5, 2);
}

function paintGardenShrub(gfx: Phaser.GameObjects.Graphics): void {
  // A low hedge plant for the manor garden, with soil and no indoor pot.
  gfx.fillStyle(0x27321f, 1).fillEllipse(16, 21, 29, 6);
  gfx.fillStyle(0x27432d, 1)
    .fillRect(4, 14, 24, 8)
    .fillRect(7, 10, 19, 12)
    .fillRect(11, 7, 12, 15);
  gfx.fillStyle(0x3d6540, 1)
    .fillRect(5, 13, 6, 6)
    .fillRect(9, 9, 7, 7)
    .fillRect(15, 8, 6, 8)
    .fillRect(21, 11, 6, 7)
    .fillRect(12, 15, 8, 5);
  gfx.fillStyle(0x729254, 1)
    .fillRect(8, 10, 3, 2)
    .fillRect(14, 9, 3, 2)
    .fillRect(21, 12, 3, 2)
    .fillRect(11, 16, 3, 2);
  gfx.fillStyle(0x8b6742, 1).fillRect(7, 21, 19, 2);
}

function paintGardenBench(gfx: Phaser.GameObjects.Graphics): void {
  // Weathered manor bench with iron supports, warm slats, and brass fixings.
  gfx.fillStyle(0x23302a, 1).fillEllipse(24, 24, 42, 6);

  // Backrest and its iron uprights.
  gfx.fillStyle(0x211912, 1).fillRect(5, 2, 38, 8);
  gfx.fillStyle(0x3e493d, 1).fillRect(7, 3, 34, 5);
  gfx.fillStyle(0x704a2d, 1).fillRect(8, 4, 32, 3);
  gfx.fillStyle(0xa07849, 1).fillRect(9, 4, 30, 1).fillRect(9, 7, 30, 1);
  gfx.fillStyle(0x202921, 1).fillRect(6, 3, 2, 14).fillRect(40, 3, 2, 14);

  // Seat slats, edges rubbed smooth by years in the garden.
  gfx.fillStyle(0x211912, 1).fillRect(5, 10, 38, 10);
  gfx.fillStyle(0x795331, 1).fillRect(7, 11, 34, 2).fillRect(7, 15, 34, 2).fillRect(7, 19, 34, 1);
  gfx.fillStyle(0xa07849, 1).fillRect(9, 11, 30, 1).fillRect(9, 15, 30, 1);
  gfx.fillStyle(0x4e3825, 1).fillRect(7, 13, 34, 1).fillRect(7, 17, 34, 1);

  // Legs and small brass bolts, with a little moss on the lower rail.
  gfx.fillStyle(0x202921, 1).fillRect(8, 18, 3, 6).fillRect(37, 18, 3, 6);
  gfx.fillStyle(0x3e493d, 1).fillRect(11, 21, 26, 2);
  gfx.fillStyle(0x729254, 1).fillRect(15, 21, 3, 1).fillRect(29, 22, 2, 1);
  gfx.fillStyle(0xc6a85d, 1).fillRect(8, 12, 1, 1).fillRect(39, 12, 1, 1).fillRect(8, 16, 1, 1).fillRect(39, 16, 1, 1);
}

function paintBunkBed(gfx: Phaser.GameObjects.Graphics): void {
  // Compact wooden bunk frame with two navy berths and a brass ladder.
  gfx.fillStyle(0x21170f, 1).fillRect(3, 2, 42, 28);
  gfx.fillStyle(0x704a2c, 1).fillRect(4, 3, 40, 26);
  gfx.fillStyle(0xa57945, 1).fillRect(5, 4, 2, 24).fillRect(41, 4, 2, 24);

  gfx.fillStyle(0x31251d, 1).fillRect(8, 4, 33, 10).fillRect(8, 17, 33, 10);
  gfx.fillStyle(0xd8cdb7, 1).fillRect(9, 5, 31, 8).fillRect(9, 18, 31, 8);
  gfx.fillStyle(0xf0e7d5, 1).fillRect(10, 6, 10, 5).fillRect(10, 19, 10, 5);
  gfx.fillStyle(0x294556, 1).fillRect(21, 5, 18, 8).fillRect(21, 18, 18, 8);
  gfx.fillStyle(0x496c7c, 1).fillRect(22, 6, 15, 2).fillRect(22, 19, 15, 2);
  gfx.fillStyle(0xb89359, 1).fillRect(22, 12, 16, 1).fillRect(22, 25, 16, 1);

  gfx.fillStyle(0x21170f, 1).fillRect(2, 9, 4, 15);
  gfx.fillStyle(0xc09a59, 1)
    .fillRect(3, 10, 2, 2)
    .fillRect(3, 14, 2, 2)
    .fillRect(3, 18, 2, 2)
    .fillRect(3, 22, 2, 2);
}

function paintGalleyStove(gfx: Phaser.GameObjects.Graphics): void {
  // A compact iron range with four hot plates and a brass-fronted ash drawer.
  gfx.fillStyle(0x201913, 1).fillRect(3, 2, 26, 28);
  gfx.fillStyle(0x384044, 1).fillRect(5, 4, 22, 20);
  gfx.fillStyle(0x596166, 1).fillRect(6, 5, 20, 1).fillRect(5, 6, 1, 16);
  gfx.lineStyle(1, 0x202629, 1);
  for (const [x, y] of [[11, 10], [21, 10], [11, 19], [21, 19]]) {
    gfx.strokeCircle(x, y, 3);
    gfx.fillStyle(0x252b2e, 1).fillCircle(x, y, 1);
  }
  gfx.fillStyle(0x252a2d, 1).fillRect(5, 24, 22, 4);
  gfx.fillStyle(0x947342, 1).fillRect(9, 25, 13, 2);
  gfx.fillStyle(0xd0ad67, 1).fillRect(23, 25, 2, 2);
  gfx.fillStyle(0x171512, 1).fillRect(6, 29, 4, 2).fillRect(22, 29, 4, 2);
}

function paintUmbrellaStand(gfx: Phaser.GameObjects.Graphics): void {
  // Folded umbrellas gathered in a brass-edged stand by the manor entrance.
  gfx.fillStyle(0x29201a, 1).fillRect(3, 18, 15, 9);
  gfx.fillStyle(0x624831, 1).fillRect(4, 19, 13, 7);
  gfx.fillStyle(0xb18a4f, 1).fillRect(3, 18, 15, 1).fillRect(2, 26, 17, 2);
  gfx.fillStyle(0x8c3430, 1)
    .fillRect(4, 5, 4, 2).fillRect(3, 7, 6, 2).fillRect(4, 9, 4, 2);
  gfx.lineStyle(1, 0x4b2522, 1).lineBetween(6, 10, 6, 21);
  gfx.fillStyle(0x34546a, 1)
    .fillRect(9, 2, 4, 2).fillRect(8, 4, 6, 2).fillRect(9, 6, 4, 2);
  gfx.lineStyle(1, 0x1f3949, 1).lineBetween(11, 7, 11, 22);
  gfx.fillStyle(0x8a7140, 1)
    .fillRect(14, 7, 3, 2).fillRect(13, 9, 5, 2).fillRect(14, 11, 3, 2);
  gfx.lineStyle(1, 0x514226, 1).lineBetween(15, 12, 15, 21);
  gfx.fillStyle(0xdbc68d, 1).fillRect(5, 20, 2, 2).fillRect(10, 21, 2, 2).fillRect(14, 20, 1, 2);
}

function paintWorkBoots(gfx: Phaser.GameObjects.Graphics): void {
  // Scuffed ankle boots dusted with the same pale rosin as the stage trail.
  gfx.fillStyle(0x29231d, 1)
    .fillRect(2, 3, 5, 8)
    .fillRect(9, 3, 5, 8)
    .fillRect(1, 9, 7, 6)
    .fillRect(8, 9, 7, 6);
  gfx.fillStyle(0x594332, 1)
    .fillRect(3, 4, 3, 6)
    .fillRect(10, 4, 3, 6)
    .fillRect(2, 10, 5, 3)
    .fillRect(9, 10, 5, 3);
  gfx.fillStyle(0x806044, 1)
    .fillRect(3, 4, 1, 4)
    .fillRect(10, 4, 1, 4)
    .fillRect(4, 11, 2, 1);
  gfx.fillStyle(0xc09a62, 1)
    .fillRect(5, 5, 1, 1)
    .fillRect(5, 7, 1, 1)
    .fillRect(12, 5, 1, 1)
    .fillRect(12, 7, 1, 1)
    .fillRect(2, 10, 2, 1);
  gfx.fillStyle(0x171614, 1).fillRect(1, 14, 7, 1).fillRect(8, 14, 7, 1);
  gfx.fillStyle(0x806044, 1)
    .fillRect(2, 14, 2, 1)
    .fillRect(5, 14, 2, 1)
    .fillRect(9, 14, 2, 1)
    .fillRect(12, 14, 2, 1);
  gfx.fillStyle(0x3d3025, 1).fillRect(10, 9, 2, 1).fillRect(13, 11, 1, 1);
  gfx.fillStyle(0x89734c, 1)
    .fillRect(2, 12, 2, 1)
    .fillRect(5, 10, 1, 1)
    .fillRect(9, 12, 2, 1)
    .fillRect(12, 10, 1, 1);
  gfx.fillStyle(0xd9c28a, 1)
    .fillRect(3, 11, 1, 1)
    .fillRect(10, 11, 1, 1)
    .fillRect(6, 9, 1, 1);
}

function paintFieldBoots(gfx: Phaser.GameObjects.Graphics): void {
  // Tall worn riding boots with brass lace hooks and muddy soles.
  gfx.fillStyle(0x2e2118, 1)
    .fillRect(2, 1, 5, 11)
    .fillRect(9, 1, 5, 11)
    .fillRect(1, 10, 7, 5)
    .fillRect(8, 10, 7, 5);
  gfx.fillStyle(0x704525, 1)
    .fillRect(3, 2, 3, 8)
    .fillRect(10, 2, 3, 8)
    .fillRect(2, 11, 5, 2)
    .fillRect(9, 11, 5, 2);
  gfx.fillStyle(0xa56d39, 1)
    .fillRect(3, 2, 1, 6)
    .fillRect(10, 2, 1, 6)
    .fillRect(4, 10, 2, 1)
    .fillRect(11, 10, 2, 1);
  gfx.fillStyle(0xc49a57, 1)
    .fillRect(6, 4, 1, 1)
    .fillRect(6, 7, 1, 1)
    .fillRect(13, 4, 1, 1)
    .fillRect(13, 7, 1, 1);
  gfx.fillStyle(0x4b4930, 1).fillRect(1, 13, 6, 2).fillRect(9, 13, 6, 2);
  gfx.fillStyle(0xa56d39, 1)
    .fillRect(2, 14, 2, 1)
    .fillRect(5, 14, 2, 1)
    .fillRect(9, 14, 2, 1)
    .fillRect(12, 14, 2, 1);
  // Field mud cakes the lower leather and joins the matching rug prints.
  gfx.fillStyle(0x35271d, 1)
    .fillRect(2, 12, 2, 1)
    .fillRect(5, 11, 2, 1)
    .fillRect(9, 12, 2, 1)
    .fillRect(12, 11, 2, 1);
  gfx.fillStyle(0x786042, 1)
    .fillRect(3, 11, 1, 1)
    .fillRect(10, 10, 1, 1)
    .fillRect(1, 13, 1, 1)
    .fillRect(14, 13, 1, 1);
}

function paintSeaBoots(gfx: Phaser.GameObjects.Graphics): void {
  // Tall oilskin boots with turned cuffs, reinforced soles and an oil sheen.
  gfx.fillStyle(0x172523, 1)
    .fillRect(2, 1, 5, 3)
    .fillRect(9, 1, 5, 3)
    .fillRect(3, 4, 4, 8)
    .fillRect(10, 4, 4, 8)
    .fillRect(1, 12, 7, 3)
    .fillRect(8, 12, 7, 3);
  gfx.fillStyle(0x42635c, 1)
    .fillRect(2, 2, 5, 1)
    .fillRect(9, 2, 5, 1)
    .fillRect(4, 5, 2, 6)
    .fillRect(11, 5, 2, 6);
  gfx.fillStyle(0x9b8a4c, 1).fillRect(4, 9, 2, 1).fillRect(11, 9, 2, 1);
  gfx.fillStyle(0xb89b5b, 1).fillRect(3, 4, 4, 1).fillRect(10, 4, 4, 1);
  gfx.fillStyle(0x263a35, 1).fillRect(2, 13, 5, 1).fillRect(9, 13, 5, 1);
  gfx.fillStyle(0x9b8a4c, 1)
    .fillRect(2, 14, 2, 1)
    .fillRect(5, 14, 2, 1)
    .fillRect(9, 14, 2, 1)
    .fillRect(12, 14, 2, 1);
}

function paintBrassLock(gfx: Phaser.GameObjects.Graphics): void {
  // A riveted brass plate with a closed shackle and visible keyway.
  gfx.fillStyle(0x241b10, 1).fillRect(5, 1, 6, 8);
  gfx.fillStyle(0x97713a, 1).fillRect(6, 2, 4, 6);
  gfx.fillStyle(0xd0ae63, 1).fillRect(7, 2, 2, 5);
  gfx.fillStyle(0x302316, 1).fillRect(2, 7, 12, 8);
  gfx.fillStyle(0x9b783f, 1).fillRect(3, 8, 10, 6);
  gfx.fillStyle(0xd5b66d, 1).fillRect(4, 8, 8, 2).fillRect(4, 12, 8, 1);
  gfx.fillStyle(0x302316, 1).fillCircle(8, 10, 1).fillRect(7, 10, 2, 3);
  gfx.fillStyle(0xead28f, 1).fillRect(3, 9, 1, 1).fillRect(12, 9, 1, 1);
}

function paintSafeKeyway(gfx: Phaser.GameObjects.Graphics): void {
  // An intact mounted safe-lock plate with no pry marks or scratches.
  gfx.fillStyle(0x202522, 1).fillRect(1, 2, 14, 12);
  gfx.fillStyle(0x68726a, 1).fillRect(2, 3, 12, 10);
  gfx.fillStyle(0x9b783f, 1).fillRect(4, 4, 8, 8);
  gfx.fillStyle(0xd5b66d, 1).fillRect(5, 4, 6, 1).fillRect(5, 11, 6, 1);
  gfx.fillStyle(0x302316, 1).fillCircle(8, 7, 2).fillRect(7, 7, 2, 4);
  gfx.fillStyle(0xe4cf93, 1).fillRect(3, 5, 1, 1).fillRect(12, 5, 1, 1);
}

function paintWallSafe(gfx: Phaser.GameObjects.Graphics): void {
  // Compact iron safe with a recessed door, brass dial and visible hinges.
  gfx.fillStyle(0x202522, 1).fillRect(2, 1, 12, 14);
  gfx.fillStyle(0x59645d, 1).fillRect(3, 2, 10, 12);
  gfx.fillStyle(0x899084, 1).fillRect(4, 3, 1, 10).fillRect(5, 3, 7, 1);
  gfx.fillStyle(0x29312e, 1).fillRect(5, 5, 7, 8);
  gfx.fillStyle(0x9a783f, 1).fillRect(6, 6, 5, 6);
  gfx.fillStyle(0x3b382d, 1).fillRect(7, 7, 3, 4);
  gfx.fillStyle(0xe0c174, 1).fillCircle(8, 9, 2);
  gfx.fillStyle(0x352b1c, 1).fillCircle(8, 9, 1).fillRect(8, 8, 3, 1);
  gfx.fillStyle(0x252b28, 1).fillRect(3, 5, 2, 2).fillRect(3, 10, 2, 2);
  gfx.fillStyle(0xb59b62, 1).fillRect(6, 13, 5, 1);
}

function paintOpenSafe(gfx: Phaser.GameObjects.Graphics): void {
  // The open, empty safe retains a clean, intact keyway on its swung door.
  gfx.fillStyle(0x202522, 1).fillRect(6, 1, 9, 14);
  gfx.fillStyle(0x68726a, 1).fillRect(7, 2, 7, 12);
  gfx.fillStyle(0x171c1a, 1).fillRect(9, 4, 5, 8);
  gfx.fillStyle(0xa7894d, 1).fillRect(9, 10, 5, 1);
  gfx.fillStyle(0x252b28, 1).fillRect(1, 3, 7, 11);
  gfx.fillStyle(0x727b70, 1).fillRect(2, 4, 5, 9);
  gfx.fillStyle(0x9a783f, 1).fillRect(7, 5, 1, 2).fillRect(7, 10, 1, 2);
  gfx.fillStyle(0x9a783f, 1).fillRect(3, 7, 3, 5);
  gfx.fillStyle(0xd0ae63, 1).fillRect(3, 7, 3, 1).fillRect(3, 11, 3, 1);
  gfx.fillStyle(0x30352d, 1).fillCircle(4.5, 8, 1).fillRect(4, 8, 1, 3);
}

function paintBurntCandle(gfx: Phaser.GameObjects.Graphics): void {
  // Nearly spent stub, with a charred wick and pooled wax instead of a flame.
  gfx.fillStyle(0x5b4933, 1).fillRect(3, 13, 10, 2);
  gfx.fillStyle(0xb6a47e, 1).fillRect(4, 12, 8, 2);
  gfx.fillStyle(0xe8dcc0, 1).fillRect(5, 7, 6, 6).fillRect(6, 6, 4, 1);
  gfx.fillStyle(0x786344, 1).fillRect(5, 11, 1, 2).fillRect(10, 10, 1, 3);
  // A small carved G is the identifying mark called out in the clue.
  gfx.fillStyle(0x786344, 1)
    .fillRect(6, 8, 3, 1)
    .fillRect(6, 9, 1, 1)
    .fillRect(8, 9, 1, 1)
    .fillRect(6, 10, 3, 1)
    .fillRect(8, 11, 1, 1);
  gfx.fillStyle(0x30271f, 1).fillRect(7, 4, 2, 3);
  gfx.fillStyle(0x584532, 1).fillRect(6, 3, 4, 1);
}

function paintPixelTime(
  gfx: Phaser.GameObjects.Graphics,
  time: string,
  x: number,
  y: number,
  color: number,
): void {
  const digitRows: Record<string, number[]> = {
    '0': [0b11, 0b01, 0b01, 0b01, 0b11],
    '2': [0b11, 0b01, 0b11, 0b10, 0b11],
    '3': [0b11, 0b01, 0b11, 0b01, 0b11],
    '4': [0b10, 0b11, 0b11, 0b01, 0b01],
  };
  gfx.fillStyle(color, 1);
  [...time].forEach((character, index) => {
    const charX = x + index * 3;
    if (character === ':') {
      gfx.fillRect(charX, y + 1, 1, 1).fillRect(charX, y + 3, 1, 1);
      return;
    }
    digitRows[character]?.forEach((row, rowIndex) => {
      for (let bit = 0; bit < 2; bit += 1) {
        if (row & (1 << (1 - bit))) gfx.fillRect(charX + bit, y + rowIndex, 1, 1);
      }
    });
  });
}

function paintCallBell(gfx: Phaser.GameObjects.Graphics): void {
  // Bell beside its parchment record, with the clue's single 20:40 entry.
  gfx.fillStyle(0x3e2e20, 1).fillRect(0, 6, 24, 14);
  gfx.fillStyle(0xe4d5b3, 1).fillRect(7, 6, 16, 13);
  gfx.fillStyle(0xc6b48e, 1).fillRect(8, 7, 14, 1);
  gfx.fillStyle(0x948366, 1)
    .fillRect(9, 8, 12, 1)
    .fillRect(9, 15, 12, 1)
    .fillRect(9, 18, 12, 1);
  paintPixelTime(gfx, '20:40', 9, 9, 0x493c34);
  gfx.fillStyle(0xb24b38, 1).fillRect(8, 16, 2, 1);

  gfx.fillStyle(0x392a18, 1).fillRect(3, 1, 2, 2).fillRect(2, 3, 4, 2);
  gfx.fillStyle(0x9a7133, 1).fillRect(1, 4, 6, 1).fillRect(0, 5, 8, 4);
  gfx.fillStyle(0xe1c06c, 1).fillRect(3, 2, 2, 1).fillRect(2, 5, 2, 3);
  gfx.fillStyle(0x392a18, 1).fillRect(0, 9, 9, 1);
  gfx.fillStyle(0xe1c06c, 1).fillRect(1, 9, 7, 1);
  gfx.fillStyle(0x6d4d24, 1).fillRect(3, 10, 2, 1);
}

function paintCoat(
  gfx: Phaser.GameObjects.Graphics,
  palette: { outline: number; body: number; highlight: number; buttons: number },
): void {
  // A heavy coat on a dark hanger, with the spare key peeking from its pocket.
  gfx.fillStyle(0x201812, 1).fillRect(7, 0, 2, 3).fillRect(4, 2, 8, 2);
  gfx.fillStyle(palette.outline, 1).fillRect(3, 4, 10, 10).fillRect(1, 6, 3, 7).fillRect(12, 6, 3, 7);
  gfx.fillStyle(palette.body, 1).fillRect(4, 4, 8, 9).fillRect(2, 7, 2, 5).fillRect(12, 7, 2, 5);
  gfx.fillStyle(palette.highlight, 1).fillRect(5, 5, 2, 6).fillRect(9, 5, 2, 6);
  gfx.fillStyle(palette.buttons, 1).fillRect(7, 7, 1, 1).fillRect(7, 10, 1, 1);
  gfx.fillStyle(palette.outline, 1).fillRect(4, 13, 4, 2).fillRect(8, 13, 4, 2);
  gfx.fillStyle(palette.outline, 1).fillRect(9, 9, 3, 4);
  gfx.fillStyle(palette.body, 1).fillRect(10, 10, 1, 2);
  gfx.fillStyle(palette.highlight, 1).fillRect(9, 9, 3, 1);
  gfx.fillStyle(palette.buttons, 1).fillCircle(10, 10, 1).fillRect(10, 11, 1, 3).fillRect(11, 13, 1, 1);
  gfx.fillStyle(palette.outline, 1).fillRect(10, 10, 1, 1);
}

function paintOilCan(gfx: Phaser.GameObjects.Graphics): void {
  // Squat steel can with a loop handle and an uncapped, empty pouring spout.
  gfx.fillStyle(0x26302e, 1).fillRect(3, 5, 11, 9).fillRect(4, 3, 2, 3).fillRect(5, 2, 5, 2).fillRect(9, 3, 2, 3);
  gfx.fillStyle(0x66736b, 1).fillRect(4, 6, 9, 7).fillRect(10, 3, 3, 2).fillRect(12, 2, 3, 2);
  gfx.fillStyle(0x141a18, 1).fillRect(13, 2, 2, 1);
  gfx.fillStyle(0x9aa58f, 1).fillRect(5, 7, 2, 4).fillRect(7, 5, 2, 1);
  gfx.fillStyle(0xc6a85d, 1).fillRect(4, 5, 3, 1).fillRect(11, 12, 2, 1);
  gfx.fillStyle(0x26302e, 1).fillRect(5, 14, 8, 1);
}

function paintLampWickRack(gfx: Phaser.GameObjects.Graphics): void {
  // A keeper's wall rack with replacement wicks, a brass hook, and trimming shears.
  gfx.fillStyle(0x211912, 1).fillRect(2, 4, 28, 18);
  gfx.fillStyle(0x644523, 1).fillRect(3, 3, 26, 16);
  gfx.fillStyle(0x9a713e, 1).fillRect(4, 4, 24, 2).fillRect(4, 16, 24, 2);
  gfx.fillStyle(0x39291a, 1).fillRect(5, 7, 22, 8);

  // Wrapped spare wick rolls, tied with dark thread.
  gfx.fillStyle(0xc2b89a, 1).fillRect(7, 8, 5, 6);
  gfx.fillStyle(0xe0d6b8, 1).fillRect(8, 8, 2, 1).fillRect(8, 10, 3, 2);
  gfx.fillStyle(0x596460, 1).fillRect(14, 8, 5, 6);
  gfx.fillStyle(0x829089, 1).fillRect(15, 8, 2, 1).fillRect(15, 10, 3, 2);
  gfx.fillStyle(0x4a3b28, 1).fillRect(12, 9, 1, 4).fillRect(19, 9, 1, 4);

  // Brass pegs and a small pair of wick shears on the right.
  gfx.fillStyle(0xc19a50, 1).fillRect(6, 6, 3, 1).fillRect(13, 6, 3, 1).fillRect(20, 6, 3, 1);
  gfx.fillStyle(0xb98a3d, 1).fillRect(22, 8, 1, 5).fillRect(23, 10, 4, 1);
  gfx.fillStyle(0xddd0a2, 1).fillRect(24, 9, 3, 1).fillRect(24, 11, 2, 1);
  gfx.fillStyle(0x44301d, 1).fillRect(22, 13, 4, 2);
  gfx.fillStyle(0xc19a50, 1).fillRect(23, 13, 1, 1);
}

function paintApron(gfx: Phaser.GameObjects.Graphics): void {
  // Flour-caked apron with damp sweat-darkened patches from a long kneading shift.
  gfx.fillStyle(0x293033, 1).fillRect(6, 0, 4, 2).fillRect(5, 1, 1, 3).fillRect(10, 1, 1, 3);
  gfx.fillStyle(0x293033, 1).fillRect(4, 3, 8, 5).fillRect(2, 7, 12, 8);
  gfx.fillStyle(0xb9c0b3, 1).fillRect(5, 3, 6, 4).fillRect(3, 8, 10, 6);
  gfx.fillStyle(0x778478, 1)
    .fillRect(3, 6, 2, 3)
    .fillRect(11, 6, 2, 3)
    .fillRect(6, 12, 3, 2)
    .fillRect(11, 13, 2, 1);
  gfx.fillStyle(0xd9d8c9, 1)
    .fillRect(5, 3, 3, 2)
    .fillRect(9, 4, 2, 2)
    .fillRect(4, 7, 3, 2)
    .fillRect(8, 8, 4, 2)
    .fillRect(4, 11, 3, 2)
    .fillRect(9, 12, 2, 1);
  gfx.fillStyle(0xeeeadd, 1)
    .fillRect(6, 4, 2, 1)
    .fillRect(10, 5, 1, 1)
    .fillRect(5, 8, 2, 1)
    .fillRect(9, 9, 2, 1)
    .fillRect(4, 12, 2, 1)
    .fillRect(10, 12, 1, 1);
}

function paintBeaconLamp(gfx: Phaser.GameObjects.Graphics): void {
  // Cold brass-framed beacon above the keeper's slate, marked 23:40.
  gfx.fillStyle(0x242b2b, 1).fillRect(3, 14, 18, 14);
  gfx.fillStyle(0x69716b, 1).fillRect(4, 15, 16, 12);
  gfx.fillStyle(0xb6b39d, 1).fillRect(5, 16, 14, 1);
  paintPixelTime(gfx, '23:40', 5, 18, 0x303c3c);
  gfx.fillStyle(0xb6b39d, 1).fillRect(5, 25, 14, 1);
  gfx.fillStyle(0x29221a, 1).fillRect(9, 0, 6, 2).fillRect(7, 2, 10, 2).fillRect(6, 4, 2, 8).fillRect(16, 4, 2, 8);
  gfx.fillStyle(0x9b6b2f, 1).fillRect(8, 4, 8, 8).fillRect(7, 12, 10, 2);
  gfx.fillStyle(0x293941, 1).fillRect(9, 5, 6, 6);
  gfx.fillStyle(0x526b72, 1).fillRect(10, 6, 2, 4);
  gfx.fillStyle(0x83969a, 1).fillRect(13, 7, 1, 2);
  gfx.fillStyle(0x69451f, 1).fillRect(9, 14, 6, 2);
}

function paintOpenLedger(gfx: Phaser.GameObjects.Graphics): void {
  // Open, worn ledger with two ruled pages and a visible stitched spine.
  gfx.fillStyle(0x241a13, 1).fillRect(0, 2, 16, 12);
  gfx.fillStyle(0x75452b, 1).fillRect(1, 1, 14, 13);
  gfx.fillStyle(0xdbcba4, 1).fillRect(2, 2, 5, 10).fillRect(9, 2, 5, 10);
  gfx.fillStyle(0xf0e3bd, 1).fillRect(3, 3, 3, 1).fillRect(10, 3, 3, 1);
  gfx.fillStyle(0x9f8a61, 1).fillRect(7, 2, 2, 11);
  gfx.fillStyle(0x73664c, 1)
    .fillRect(3, 5, 3, 1).fillRect(3, 7, 3, 1).fillRect(3, 9, 2, 1)
    .fillRect(10, 5, 3, 1).fillRect(10, 7, 3, 1).fillRect(10, 9, 2, 1);
  gfx.fillStyle(0x45615d, 1)
    .fillRect(11, 5, 2, 1)
    .fillRect(11, 6, 1, 2)
    .fillRect(9, 7, 5, 1)
    .fillRect(9, 8, 1, 1)
    .fillRect(13, 8, 1, 1);
  gfx.fillStyle(0xb99552, 1).fillRect(1, 12, 2, 2).fillRect(13, 12, 2, 2);
}

function paintTornDocument(
  gfx: Phaser.GameObjects.Graphics,
  kind: 'letter' | 'iou',
): void {
  // Stepped paper silhouette makes each tiny document read as a loose sheet.
  const outlineRows = [[5, 6], [3, 10], [2, 12], [2, 12], [2, 12], [2, 12], [2, 12], [2, 12], [2, 12], [3, 10], [4, 8]];
  const paperRows = [[5, 6], [4, 8], [3, 10], [3, 10], [3, 10], [3, 10], [3, 10], [3, 10], [3, 10], [4, 8], [5, 6]];
  gfx.fillStyle(0x35271d, 1);
  outlineRows.forEach(([x, width], row) => gfx.fillRect(x, row + 2, width, 1));
  gfx.fillStyle(kind === 'letter' ? 0xe4d4ad : 0xd9c79f, 1);
  paperRows.forEach(([x, width], row) => gfx.fillRect(x, row + 2, width, 1));
  gfx.fillStyle(0xf2e6c5, 1).fillRect(5, 3, 5, 1).fillRect(4, 5, 2, 1);
  gfx.fillStyle(kind === 'letter' ? 0x493c34 : 0x6a342d, 1)
    .fillRect(4, 6, 7, 1)
    .fillRect(4, 8, 6, 1);
  if (kind === 'letter') {
    gfx.fillStyle(0x493c34, 1).fillRect(4, 10, 7, 1);
    // Irregular dark gaps split the letter into the four quarters in its clue.
    gfx.fillStyle(0x594637, 1)
      .fillRect(8, 3, 1, 2)
      .fillRect(7, 5, 1, 2)
      .fillRect(8, 7, 1, 2)
      .fillRect(7, 9, 1, 2)
      .fillRect(4, 8, 3, 1)
      .fillRect(8, 8, 4, 1);
    gfx.fillStyle(0x7e302d, 1).fillRect(10, 11, 3, 3);
    gfx.fillStyle(0xc35a48, 1).fillRect(11, 11, 1, 1);
  } else {
    // A jagged split at the page edge reads as torn; Vera's V marks her hand.
    gfx.fillStyle(0x594637, 1)
      .fillRect(11, 4, 1, 2)
      .fillRect(10, 6, 1, 2)
      .fillRect(11, 8, 1, 1);
    gfx.fillStyle(0x6a342d, 1).fillRect(4, 10, 3, 1);
    gfx.fillStyle(0x374151, 1)
      .fillRect(8, 10, 1, 1)
      .fillRect(10, 10, 1, 1)
      .fillRect(9, 11, 1, 1);
  }
}

function paintTheatreProgramme(gfx: Phaser.GameObjects.Graphics): void {
  // Burgundy playbill opened to reveal the spare brass key tucked inside.
  gfx.fillStyle(0x271714, 1).fillRect(2, 1, 12, 14);
  gfx.fillStyle(0x7a292b, 1).fillRect(3, 2, 10, 12);
  gfx.fillStyle(0xc49b50, 1).fillRect(4, 3, 8, 1).fillRect(4, 12, 8, 1);
  gfx.fillStyle(0x4b2022, 1).fillRect(4, 5, 2, 5).fillRect(10, 5, 2, 5);
  gfx.fillStyle(0xe7c875, 1)
    .fillRect(7, 5, 2, 1)
    .fillRect(6, 6, 4, 1)
    .fillRect(7, 7, 2, 2)
    .fillRect(6, 9, 4, 1);
  gfx.fillStyle(0xe8d9b1, 1).fillRect(6, 11, 4, 1);
  gfx.fillStyle(0xdbcba4, 1).fillRect(10, 4, 3, 7);
  gfx.fillStyle(0xb99552, 1).fillCircle(11, 6, 1).fillRect(11, 7, 1, 4).fillRect(12, 9, 1, 1);
  gfx.fillStyle(0x513b24, 1).fillRect(11, 6, 1, 1);
}

function paintBackstageNoticeboard(gfx: Phaser.GameObjects.Graphics): void {
  // Weathered backstage board with a pinned call sheet and crew notices.
  gfx.fillStyle(0x211a16, 1)
    .fillRect(3, 2, 26, 22)
    .fillRect(7, 24, 3, 3)
    .fillRect(22, 24, 3, 3);
  gfx.fillStyle(0x765236, 1).fillRect(4, 3, 24, 20);
  gfx.fillStyle(0xa27b48, 1)
    .fillRect(5, 4, 22, 18)
    .fillRect(8, 24, 1, 2)
    .fillRect(23, 24, 1, 2);
  gfx.fillStyle(0x37271e, 1).fillRect(6, 5, 20, 16);
  gfx.fillStyle(0xd7c49a, 1).fillRect(7, 6, 18, 14);

  // Burgundy call-time header and two pinned notices.
  gfx.fillStyle(0x642629, 1).fillRect(8, 7, 16, 3);
  gfx.fillStyle(0xd7b767, 1).fillRect(10, 8, 12, 1);
  gfx.fillStyle(0x40352a, 1)
    .fillRect(8, 12, 8, 1)
    .fillRect(8, 15, 7, 1)
    .fillRect(8, 18, 5, 1);
  gfx.fillStyle(0xeee0bd, 1).fillRect(17, 12, 7, 7);
  gfx.fillStyle(0x8c3434, 1)
    .fillRect(18, 13, 5, 1)
    .fillRect(19, 15, 3, 1)
    .fillRect(18, 17, 4, 1);
  gfx.fillStyle(0xb99552, 1)
    .fillRect(8, 6, 1, 1)
    .fillRect(23, 6, 1, 1)
    .fillRect(8, 19, 1, 1)
    .fillRect(23, 19, 1, 1);
}

function paintStagePulley(gfx: Phaser.GameObjects.Graphics): void {
  // Iron sheave and hemp line from the theatre's backstage flying rig.
  gfx.fillStyle(0x211a16, 1).fillRect(5, 2, 22, 4);
  gfx.fillStyle(0x987444, 1).fillRect(7, 3, 18, 1).fillRect(7, 5, 18, 1);
  gfx.fillStyle(0x211a16, 1).fillRect(13, 6, 6, 3);

  // Grooved wheel with a brass hub, fixed to the wall plate.
  gfx.fillStyle(0x1d211f, 1).fillRect(9, 8, 14, 14).fillRect(7, 11, 18, 8);
  gfx.fillStyle(0x3f4841, 1).fillRect(10, 9, 12, 12).fillRect(8, 12, 16, 6);
  gfx.fillStyle(0x252a26, 1).fillRect(12, 11, 8, 8);
  gfx.fillStyle(0xb99552, 1).fillRect(14, 13, 4, 4);
  gfx.fillStyle(0xe0c57e, 1).fillRect(15, 14, 2, 2);

  // Rope descends to a compact counterweight, useful backstage scenery.
  gfx.fillStyle(0x684d2d, 1).fillRect(15, 20, 2, 7);
  gfx.fillStyle(0xa07a42, 1).fillRect(16, 20, 1, 6);
  gfx.fillStyle(0x211a16, 1).fillRect(10, 26, 12, 8);
  gfx.fillStyle(0x765236, 1).fillRect(11, 27, 10, 6);
  gfx.fillStyle(0xa27b48, 1).fillRect(12, 28, 8, 1).fillRect(12, 32, 8, 1);
  gfx.fillStyle(0x473628, 1).fillRect(13, 29, 6, 2);
  gfx.fillStyle(0xc19a50, 1).fillRect(14, 29, 4, 1);
}

function paintCurtain(gfx: Phaser.GameObjects.Graphics): void {
  // Burgundy curtain with a neat repair seam and the tailor's card pinned to the hem.
  gfx.fillStyle(0x4b191b, 1).fillRect(1, 0, 12, 12);
  gfx.fillStyle(0x7a1f1f, 1).fillRect(2, 0, 10, 10);
  gfx.fillStyle(0x933030, 1).fillRect(4, 0, 2, 10).fillRect(9, 0, 2, 10);
  gfx.fillStyle(0x572023, 1).fillRect(7, 3, 2, 6);
  gfx.fillStyle(0xd9bc79, 1)
    .fillRect(6, 3, 1, 1)
    .fillRect(9, 3, 1, 1)
    .fillRect(6, 5, 1, 1)
    .fillRect(9, 5, 1, 1)
    .fillRect(6, 7, 1, 1)
    .fillRect(9, 7, 1, 1)
    .fillRect(6, 9, 1, 1)
    .fillRect(9, 9, 1, 1);
  gfx.fillStyle(0xc9a227, 1).fillRect(1, 10, 12, 2);
  gfx.fillStyle(0xeee0bb, 1).fillRect(10, 8, 3, 3);
  gfx.fillStyle(0xa7834c, 1).fillRect(10, 9, 2, 1);
  gfx.fillStyle(0xf1d276, 1).fillRect(12, 7, 1, 2);
}

function paintSewingKit(gfx: Phaser.GameObjects.Graphics): void {
  // Open wooden case with thread spools and a pair of shears for curtain repairs.
  gfx.fillStyle(0x271b16, 1).fillRect(2, 10, 28, 13);
  gfx.fillStyle(0x79502f, 1).fillRect(4, 11, 24, 9);
  gfx.fillStyle(0x9d6b3e, 1).fillRect(5, 12, 22, 6);
  gfx.fillStyle(0x4a3022, 1).fillRect(3, 19, 26, 3);
  gfx.fillStyle(0xb17d48, 1).fillRect(13, 20, 6, 1);
  // Folded velvet cloth in the lid.
  gfx.fillStyle(0x38231f, 1).fillRect(5, 3, 22, 7);
  gfx.fillStyle(0x742b32, 1).fillRect(7, 4, 18, 4);
  gfx.fillStyle(0xb35450, 1).fillRect(9, 4, 3, 4).fillRect(18, 4, 2, 4);
  // Spools of contrasting thread.
  gfx.fillStyle(0xe0c58f, 1).fillRect(7, 12, 3, 5).fillRect(14, 12, 3, 5).fillRect(21, 12, 3, 5);
  gfx.fillStyle(0x47715f, 1).fillRect(7, 13, 3, 3);
  gfx.fillStyle(0x9b3934, 1).fillRect(14, 13, 3, 3);
  gfx.fillStyle(0x304d69, 1).fillRect(21, 13, 3, 3);
  gfx.fillStyle(0xe8dcc1, 1).fillRect(8, 11, 1, 1).fillRect(15, 11, 1, 1).fillRect(22, 11, 1, 1);
  // Small brass-handled shears tucked along the case edge.
  gfx.fillStyle(0xd0b26b, 1).fillCircle(26, 13, 2).fillCircle(26, 17, 2);
  gfx.fillStyle(0x302720, 1).fillCircle(26, 13, 1).fillCircle(26, 17, 1);
  gfx.fillStyle(0xc7c5b8, 1).fillRect(24, 14, 1, 2).fillRect(22, 14, 3, 1).fillRect(22, 15, 2, 1);
}

function paintCostumeMannequin(gfx: Phaser.GameObjects.Graphics): void {
  // Headless dress form wearing a burgundy stage gown on a brass stand.
  gfx.fillStyle(0x31251e, 1).fillRect(9, 37, 14, 2).fillRect(14, 29, 4, 8);
  gfx.fillStyle(0x9b7843, 1).fillRect(10, 36, 12, 1).fillRect(15, 30, 2, 6);

  // Dark silhouette keeps the narrow pixel shapes readable at game scale.
  gfx.fillStyle(0x291b19, 1)
    .fillRect(14, 2, 4, 5)
    .fillRect(11, 6, 10, 3)
    .fillRect(8, 8, 16, 9)
    .fillRect(10, 16, 12, 8)
    .fillRect(8, 22, 16, 9)
    .fillRect(6, 28, 20, 4);

  // Tailored burgundy velvet bodice and skirt.
  gfx.fillStyle(0x67252b, 1)
    .fillRect(12, 7, 8, 2)
    .fillRect(9, 9, 14, 7)
    .fillRect(11, 16, 10, 6)
    .fillRect(9, 23, 14, 5)
    .fillRect(7, 28, 18, 3);
  gfx.fillStyle(0x8d3539, 1)
    .fillRect(10, 9, 4, 6)
    .fillRect(15, 10, 5, 5)
    .fillRect(12, 17, 2, 4)
    .fillRect(10, 24, 2, 3)
    .fillRect(16, 23, 2, 4)
    .fillRect(21, 24, 1, 3);
  gfx.fillStyle(0x4c2022, 1).fillRect(14, 17, 2, 4).fillRect(13, 24, 2, 4).fillRect(18, 28, 2, 2);

  // Ivory collar, brass pins, and a stitched hem make the tailoring legible.
  gfx.fillStyle(0xe2d1ae, 1).fillRect(13, 8, 6, 2).fillRect(14, 10, 4, 1);
  gfx.fillStyle(0xc7a75f, 1)
    .fillRect(15, 12, 2, 2)
    .fillRect(12, 18, 1, 1)
    .fillRect(19, 18, 1, 1)
    .fillRect(8, 30, 2, 1)
    .fillRect(13, 30, 2, 1)
    .fillRect(18, 30, 2, 1)
    .fillRect(23, 30, 2, 1);
}

function paintCostumeRack(gfx: Phaser.GameObjects.Graphics): void {
  // Backstage rail with three contrasting period costumes on hangers.
  gfx.fillStyle(0x211a16, 1)
    .fillRect(3, 3, 42, 3)
    .fillRect(5, 5, 3, 31)
    .fillRect(40, 5, 3, 31)
    .fillRect(1, 35, 10, 3)
    .fillRect(37, 35, 10, 3);
  gfx.fillStyle(0xb18a4d, 1)
    .fillRect(4, 3, 40, 1)
    .fillRect(6, 6, 1, 28)
    .fillRect(41, 6, 1, 28)
    .fillRect(2, 35, 8, 1)
    .fillRect(38, 35, 8, 1);

  // Hangers and hooks.
  gfx.lineStyle(1, 0xc5a66a, 1)
    .lineBetween(15, 6, 15, 10)
    .lineBetween(26, 6, 26, 10)
    .lineBetween(37, 6, 37, 10);
  gfx.fillStyle(0x211a16, 1)
    .fillRect(10, 10, 10, 2)
    .fillRect(21, 10, 10, 2)
    .fillRect(32, 10, 10, 2);
  gfx.fillStyle(0xc5a66a, 1)
    .fillRect(11, 10, 8, 1)
    .fillRect(22, 10, 8, 1)
    .fillRect(33, 10, 8, 1);

  // Burgundy dress, teal coat, and ivory blouse; dark seams preserve shape at scale.
  gfx.fillStyle(0x291b19, 1).fillRect(9, 12, 12, 22);
  gfx.fillStyle(0x67252b, 1)
    .fillRect(11, 12, 8, 5)
    .fillRect(12, 17, 6, 8)
    .fillRect(10, 25, 10, 7);
  gfx.fillStyle(0x8d3539, 1).fillRect(11, 26, 2, 5).fillRect(17, 26, 2, 5);

  gfx.fillStyle(0x172321, 1).fillRect(21, 12, 11, 20);
  gfx.fillStyle(0x31504e, 1)
    .fillRect(23, 12, 7, 5)
    .fillRect(22, 17, 9, 13);
  gfx.fillStyle(0x47715f, 1).fillRect(25, 18, 2, 10);
  gfx.fillStyle(0xe2d1ae, 1).fillRect(25, 13, 2, 3);

  gfx.fillStyle(0x393127, 1).fillRect(32, 12, 11, 18);
  gfx.fillStyle(0xd7c6a2, 1)
    .fillRect(34, 12, 7, 4)
    .fillRect(33, 16, 9, 11)
    .fillRect(34, 27, 7, 2);
  gfx.fillStyle(0xa89471, 1).fillRect(37, 17, 1, 9).fillRect(35, 14, 2, 1).fillRect(39, 14, 2, 1);
}

function paintManorPainting(gfx: Phaser.GameObjects.Graphics): void {
  // A moonlit Blackwood estate framed in worn walnut and brass.
  gfx.fillStyle(0x241a14, 1).fillRect(1, 1, 34, 24);
  gfx.fillStyle(0x73502e, 1).fillRect(2, 2, 32, 22);
  gfx.fillStyle(0xd2ad63, 1).fillRect(4, 4, 28, 18);
  gfx.fillStyle(0x24313c, 1).fillRect(5, 5, 26, 16);
  gfx.fillStyle(0x354b58, 1).fillRect(5, 5, 26, 5);
  gfx.fillStyle(0xdccfa9, 1).fillCircle(25, 8, 2);
  gfx.fillStyle(0x607782, 1).fillRect(8, 7, 6, 1).fillRect(7, 8, 3, 1);
  // Distant ridge and the estate's steep roofline.
  gfx.fillStyle(0x40574b, 1)
    .fillRect(5, 14, 5, 1)
    .fillRect(8, 13, 5, 2)
    .fillRect(12, 12, 7, 3)
    .fillRect(19, 14, 12, 1);
  gfx.fillStyle(0x252c2a, 1)
    .fillRect(12, 10, 6, 7)
    .fillRect(11, 12, 8, 1)
    .fillRect(13, 9, 4, 1)
    .fillRect(14, 8, 2, 1);
  gfx.fillStyle(0xe0bb69, 1).fillRect(13, 12, 1, 2).fillRect(16, 12, 1, 2);
  // Foreground lawn and a narrow path toward the manor.
  gfx.fillStyle(0x293a32, 1).fillRect(5, 16, 26, 5);
  gfx.fillStyle(0x8a7958, 1).fillRect(16, 16, 2, 5).fillRect(15, 20, 4, 1);
  gfx.fillStyle(0x647048, 1).fillRect(7, 17, 3, 1).fillRect(25, 18, 4, 1);
}

/** Single source of truth for composed tile keys (scene must use these). */
export function floorTileKey(style: FloorStyle): string {
  return `tile-floor-${style}`;
}

export function wallTileKey(style: WallStyle): string {
  return `tile-wall-${style}`;
}

/** Generate every shared texture once per scene (idempotent). */
export function ensureArt(scene: Phaser.Scene): void {
  const tex = scene.textures;
  const bake = (key: string, w: number, h: number, paint: (gfx: Phaser.GameObjects.Graphics) => void) => {
    if (tex.exists(key)) return;
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    paint(gfx);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  };
  bake('spr-chandelier', 32, 24, paintChandelier);
  bake('spr-mud-prints', 36, 24, paintMudPrintTrail);
  bake('spr-oily-prints', 24, 24, paintOilyFootprint);
  bake('spr-rosin-dust', 24, 16, paintRosinDust);
  bake('spr-clock', 16, 16, paintClock);
  bake('spr-manor-fireplace', 40, 32, paintManorFireplace);
  bake('spr-wine-casks', 32, 32, paintWineCasks);
  bake('spr-wine-bottle-crate', 32, 24, paintWineBottleCrate);
  bake('spr-library-ladder', 32, 40, paintLibraryLadder);
  bake('spr-stage-crates', 32, 30, paintStageCrates);
  bake('spr-stage-pulley', 32, 36, paintStagePulley);
  bake('spr-theatre-seats', 48, 28, paintTheatreSeats);
  bake('spr-stage-curtains', 64, 24, paintStageCurtains);
  bake('spr-stage-footlights', 64, 18, paintStageFootlights);
  bake('spr-theatre-ticket-booth', 32, 32, paintTicketBooth);
  bake('spr-marsh-reeds', 32, 28, paintMarshReeds);
  bake('spr-marsh-tide-marker', 24, 40, paintMarshTideMarker);
  bake('spr-sewing-kit', 32, 24, paintSewingKit);
  bake('spr-manor-painting', 36, 26, paintManorPainting);
  bake('spr-storm-lantern', 24, 26, paintStormLantern);
  bake('spr-rope-coil', 26, 26, paintRopeCoil);
  bake('spr-garden-shrub', 32, 24, paintGardenShrub);
  bake('spr-garden-bench', 48, 28, paintGardenBench);
  bake('spr-bunk-bed', 48, 32, paintBunkBed);
  bake('spr-galley-stove', 32, 32, paintGalleyStove);
  bake('spr-galley-porthole', 32, 28, paintGalleyPorthole);
  bake('spr-umbrella-stand', 20, 30, paintUmbrellaStand);
  bake('spr-work-boots', 16, 16, paintWorkBoots);
  bake('spr-field-boots', 16, 16, paintFieldBoots);
  bake('spr-sea-boots', 16, 16, paintSeaBoots);
  bake('spr-brass-lock', 16, 16, paintBrassLock);
  bake('spr-safe-keyway', 16, 16, paintSafeKeyway);
  bake('spr-wall-safe', 16, 16, paintWallSafe);
  bake('spr-open-safe', 16, 16, paintOpenSafe);
  bake('spr-candle', 16, 16, paintBurntCandle);
  bake('spr-call-bell', 24, 20, paintCallBell);
  bake('spr-coat', 16, 16, (gfx) => paintCoat(gfx, {
    outline: 0x382418,
    body: 0x69432b,
    highlight: 0x8a5a35,
    buttons: 0xc9a66b,
  }));
  bake('spr-oilskin-coat', 16, 16, (gfx) => paintCoat(gfx, {
    outline: 0x1b302f,
    body: 0x34504e,
    highlight: 0x5a7a76,
    buttons: 0xb99552,
  }));
  bake('spr-oil-can', 16, 16, paintOilCan);
  bake('spr-lamp-wick-rack', 32, 24, paintLampWickRack);
  bake('spr-apron', 16, 16, paintApron);
  bake('spr-beacon-lamp', 24, 28, paintBeaconLamp);
  bake('spr-open-ledger', 16, 16, paintOpenLedger);
  bake('spr-torn-letter', 16, 16, (gfx) => paintTornDocument(gfx, 'letter'));
  bake('spr-torn-iou', 16, 16, (gfx) => paintTornDocument(gfx, 'iou'));
  bake('spr-theatre-programme', 16, 16, paintTheatreProgramme);
  bake('spr-backstage-noticeboard', 32, 28, paintBackstageNoticeboard);
  bake('spr-curtain', 14, 12, paintCurtain);
  bake('spr-costume-mannequin', 32, 40, paintCostumeMannequin);
  bake('spr-costume-rack', 48, 40, paintCostumeRack);
  if (!tex.exists('fx-dot')) {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(0xfde68a, 1).fillCircle(4, 4, 4);
    gfx.generateTexture('fx-dot', 8, 8);
    gfx.destroy();
  }
}

/** Create 4-direction walk animations for a character sheet (idempotent). */
export function ensureCharAnims(scene: Phaser.Scene, id: string): void {
  const key = `char-${id}`;
  (Object.keys(WALK_FRAMES) as Facing[]).forEach((dir) => {
    const animKey = `${key}-walk-${dir}`;
    if (scene.anims.exists(animKey)) return;
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(key, { frames: [...WALK_FRAMES[dir]] }),
      frameRate: 8,
      repeat: -1,
    });
  });
}
