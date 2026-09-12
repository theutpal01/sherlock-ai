import Phaser from 'phaser';

export type FloorStyle = 'stone' | 'wood' | 'grass' | 'carpet';
export type WallStyle = 'wood' | 'hedge';

/** Honor reduced-motion: ambient loops and squash effects switch off. */
export const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Verified frame map for the CC0 Kenney "Tiny Dungeon" packed sheet
 * (assets/dungeon/tilemap_packed.png, 16px grid, no spacing — every
 * index below was confirmed against upscaled crops of the real sheet).
 */
export const SHEET_KEY = 'dungeon';
const SHEET_COLS = 12;

export const FRAMES = {
  door: 46,
  safe: 90,
  lock: 89,
  table: 72,
  bell: 73,
  scroll: 130,
  note: 129,
} as const;

/** Character sheets (Svetlana Kushnariova, CC-BY 3.0): 24x32 grid. */
export const CHAR_IDS = ['player', 'bob', 'mara', 'theo', 'vera', 'otto', 'nell'] as const;

/** Walk frames per direction on a 24x32 sheet (verified against renders:
 *  row 0 = back/up, row 1 = left profile, row 2 = right profile,
 *  row 3 = front/down). */
export const WALK_FRAMES = {
  left: [18, 19, 18, 20],
  right: [6, 7, 6, 8],
  down: [12, 13, 12, 14],
  up: [0, 1, 0, 2],
} as const;

/** Standing frames per direction (first frame of each walk triple). */
export const IDLE_FRAMES = { down: 12, left: 18, right: 6, up: 0 } as const;

export type Facing = keyof typeof IDLE_FRAMES;

/** Furniture PNGs (Pixelandbeans, CC-BY 4.0) preloaded as images. */
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
] as const;

const TILE = 48;

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

/** Compose a 48px tiling texture from one sheet frame. */
function frameTile(
  scene: Phaser.Scene,
  key: string,
  sheetKey: string,
  frame: number,
  sheetCols: number,
): void {
  if (scene.textures.exists(key)) return;
  const src = scene.textures.get(sheetKey).getSourceImage() as HTMLImageElement;
  const canvasTex = scene.textures.createCanvas(key, TILE, TILE);
  if (!canvasTex) return;
  const ctx = canvasTex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, TILE, TILE);
  // Opaque base: source sheets may carry transparency in unused cells.
  ctx.fillStyle = '#141210';
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.drawImage(
    src,
    (frame % sheetCols) * 16,
    Math.floor(frame / sheetCols) * 16,
    16,
    16,
    0,
    0,
    TILE,
    TILE,
  );
  canvasTex.refresh();
}

function paintCarpet(gfx: Phaser.GameObjects.Graphics): void {
  gfx.fillStyle(0x4c1d1d, 1).fillRect(0, 0, TILE, TILE);
  gfx.fillStyle(0x6b2626, 1).fillCircle(12, 12, 3).fillCircle(36, 36, 3);
  gfx.lineStyle(1, 0x7a3030, 1).strokeRect(4, 4, TILE - 8, TILE - 8);
}

function paintWoodWall(gfx: Phaser.GameObjects.Graphics): void {
  // Dark wood paneling for manor/theatre interiors.
  gfx.fillStyle(0x3a2a18, 1).fillRect(0, 0, TILE, TILE);
  gfx.lineStyle(2, 0x241a0e, 1);
  for (const xx of [12, 24, 36]) gfx.lineBetween(xx, 0, xx, TILE);
  gfx.fillStyle(0x54401f, 1).fillRect(0, 0, TILE, 5);
}

function paintHedge(gfx: Phaser.GameObjects.Graphics): void {
  gfx.fillStyle(0x1d3a22, 1).fillRect(0, 0, TILE, TILE);
  gfx.fillStyle(0x2d5a35, 1).fillCircle(10, 10, 4).fillCircle(30, 26, 5).fillCircle(20, 38, 3);
  gfx.fillStyle(0x3a7046, 1).fillCircle(14, 14, 2).fillCircle(34, 30, 2);
}

function paintPrints(gfx: Phaser.GameObjects.Graphics): void {
  gfx.fillStyle(0x1c1410, 1);
  gfx.fillCircle(4, 8, 2).fillCircle(9, 5, 2).fillCircle(11, 10, 2);
}

function paintClock(gfx: Phaser.GameObjects.Graphics): void {
  // Longcase clock: dark case, pale face, hands near 9:17.
  gfx.fillStyle(0x3a2415, 1).fillRect(3, 0, 10, 16);
  gfx.fillStyle(0xe7e5e4, 1).fillCircle(8, 5, 3);
  gfx.lineStyle(1, 0x1c1917, 1).lineBetween(8, 5, 6, 5).lineBetween(8, 5, 9, 7);
}

function paintBoots(gfx: Phaser.GameObjects.Graphics): void {
  gfx.fillStyle(0x5a3a1e, 1).fillRect(1, 4, 5, 8).fillRect(8, 4, 5, 8);
  gfx.fillStyle(0x2e2013, 1).fillRect(1, 10, 5, 2).fillRect(8, 10, 5, 2);
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
  // Verified floors.png cells (6-col grid): wood (0,0), stone (2,3), grass (3,0).
  frameTile(scene, floorTileKey('stone'), 'floors', 14, 6);
  frameTile(scene, floorTileKey('wood'), 'floors', 0, 6);
  frameTile(scene, floorTileKey('grass'), 'floors', 3, 6);

  const tex = scene.textures;
  const bake = (key: string, w: number, h: number, paint: (gfx: Phaser.GameObjects.Graphics) => void) => {
    if (tex.exists(key)) return;
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    paint(gfx);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  };
  bake('tile-floor-carpet', TILE, TILE, paintCarpet);
  bake('tile-wall-wood', TILE, TILE, paintWoodWall);
  bake('tile-wall-hedge', TILE, TILE, paintHedge);
  bake('spr-prints', 14, 12, paintPrints);
  bake('spr-clock', 16, 16, paintClock);
  bake('spr-boots', 14, 12, paintBoots);
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

/** DOM portrait path for an NPC id (assets verified into public/). */
export function portrait(npcId: string): string {
  return `/assets/faces/npc-${npcId}.png`;
}
