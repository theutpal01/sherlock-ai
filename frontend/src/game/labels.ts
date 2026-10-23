import Phaser from 'phaser';

/**
 * Canvas nameplates: one consistent text system for every environment
 * element (areas, gates, evidence, suspects). Pixel font for titles,
 * VT323 for subtitles, dark pill background with an accent border per
 * kind. Containers are non-interactive so they never block tap-to-examine.
 */

export type PlateKind = 'room' | 'gate' | 'evidence' | 'npc';

const ACCENTS: Record<PlateKind, number> = {
  room: 0x78716c,
  gate: 0xb45309,
  evidence: 0x38bdf8,
  npc: 0xf59e0b,
};

const KIND_WORD: Record<PlateKind, string> = {
  room: 'AREA',
  gate: 'GATE',
  evidence: 'EVIDENCE',
  npc: '',
};

export interface PlateOptions {
  title: string;
  /** Overrides the default kind word (e.g. an NPC role, "✓ FOUND"). */
  subtitle?: string;
  kind: PlateKind;
  depth?: number;
}

export class Plate {
  readonly container: Phaser.GameObjects.Container;
  readonly w: number;
  readonly h: number;
  private title: Phaser.GameObjects.Text;
  private found = false;
  private dimmed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: PlateOptions) {
    const title = scene.add
      .text(0, 0, opts.title.toUpperCase(), {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#f5f5f4',
      })
      .setOrigin(0.5, 0);
    const subText = opts.subtitle ?? KIND_WORD[opts.kind];
    let sub: Phaser.GameObjects.Text | null = null;
    if (subText) {
      sub = scene.add
        .text(0, 0, subText.toUpperCase(), {
          fontFamily: '"VT323", monospace',
          fontSize: '15px',
          color: '#d6d3d1',
        })
        .setOrigin(0.5, 0);
    }
    const w = Math.ceil(Math.max(title.width, sub?.width ?? 0)) + 18;
    const h = Math.ceil(title.height + (sub ? sub.height + 3 : 0)) + 12;
    this.w = w;
    this.h = h;
    const bg = scene.add.graphics();
    const accent = ACCENTS[opts.kind];
    bg.fillStyle(0x0c0a09, 0.88);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    bg.lineStyle(2, accent, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
    title.setY(-h / 2 + 6);
    if (sub) sub.setY(-h / 2 + 6 + title.height + 3);
    const children: Phaser.GameObjects.GameObject[] = sub ? [bg, title, sub] : [bg, title];
    this.container = scene.add.container(x, y, children);
    this.container.setDepth(opts.depth ?? 4);
    this.title = title;
  }

  /** Dim a found-evidence plate without resizing it. */
  setFound(found: boolean): void {
    this.found = found;
    this.applyAlpha();
  }

  /** Soften a plate behind the player — stays legible, yields the front. */
  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    this.applyAlpha();
  }

  private applyAlpha(): void {
    // Ghosted plates stay readable (never below 0.35); the interaction
    // prompt is exempt from ghosting so it never fades under the player.
    this.container.setAlpha(this.dimmed ? 0.35 : this.found ? 0.55 : 1);
  }

  setTitle(title: string): void {
    this.title.setText(title.toUpperCase());
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
