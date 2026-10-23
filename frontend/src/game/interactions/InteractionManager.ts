import Phaser from 'phaser';
import { gameEvents } from '../events/bridge';
import type { Player } from '../entities/Player';

export interface InteractableEntry {
  kind: 'object' | 'npc';
  /** Object id or NPC id, depending on kind. */
  id: string;
  roomId: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  /** Read moving interactables at their current world position. */
  getPosition?: () => { x: number; y: number };
}

export interface ActiveInteraction extends InteractableEntry {}

/**
 * Interaction zones: tracks the nearest interactable in range, shows an
 * `E` prompt only while one is available (spec section 9), and emits
 * typed bridge events. Objects start evidence discovery; NPCs open the
 * dialogue panel. Entries are re-synced when the world changes (Phase 5).
 */
export class InteractionManager {
  private prompt: Phaser.GameObjects.Text;
  private current: ActiveInteraction | null = null;
  private entries: InteractableEntry[] = [];
  private player: Player | null = null;

  constructor(private scene: Phaser.Scene) {
    this.prompt = scene.add
      .text(0, 0, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#fde68a',
        backgroundColor: '#000000dd',
        padding: { x: 10, y: 8 },
      })
      .setOrigin(0.5, 1)
      .setDepth(20)
      .setVisible(false);
  }

  bind(entries: InteractableEntry[], player: Player): void {
    this.entries = entries;
    this.player = player;
    const current = this.current;
    if (!current) return;
    const rebound = entries.find(
      (entry) => entry.kind === current.kind && entry.id === current.id,
    );
    this.current = rebound ? this.resolvePosition(rebound) : null;
    if (!rebound) {
      gameEvents.emit({
        type: 'INTERACTION_AVAILABLE',
        payload: { kind: null, id: null },
      });
    }
  }

  update(roomId: string): void {
    if (!this.player) return;
    let best: ActiveInteraction | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const entry of this.entries) {
      if (entry.roomId !== roomId) continue;
      const positioned = this.resolvePosition(entry);
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, positioned.x, positioned.y);
      if (dist <= entry.radius && dist < bestDist) {
        bestDist = dist;
        best = positioned;
      }
    }
    const changed =
      best?.kind !== this.current?.kind || best?.id !== this.current?.id;
    this.current = best;
    if (best && this.player) {
      const verb = best.kind === 'npc' ? 'TALK TO' : 'EXAMINE';
      const hasController = Boolean(this.scene.input.gamepad?.pad1?.connected);
      const hasTouch = this.scene.sys.game.device.input.touch;
      const inputHint = hasTouch && hasController
        ? '[TAP/E/A/X]'
        : hasTouch
          ? '[TAP/E]'
          : hasController
            ? '[E/A/X]'
            : '[E]';
      this.prompt.setText(`${inputHint} ${verb} ${best.label.toUpperCase()}`);
      const view = this.scene.cameras.main.worldView;
      const margin = 8;
      const halfWidth = this.prompt.width / 2;
      const x = view.width >= this.prompt.width + margin * 2
        ? Phaser.Math.Clamp(this.player.x, view.left + halfWidth + margin, view.right - halfWidth - margin)
        : view.centerX;
      const minY = view.top + this.prompt.height + margin;
      const maxY = view.bottom - margin;
      const y = minY <= maxY
        ? Phaser.Math.Clamp(this.player.y - 34, minY, maxY)
        : view.centerY;
      this.prompt.setPosition(x, y);
      this.prompt.setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }
    if (changed) {
      gameEvents.emit({
        type: 'INTERACTION_AVAILABLE',
        payload: best
          ? { kind: best.kind, id: best.id, label: best.label }
          : { kind: null, id: null },
      });
    }
  }

  /** Called on `E` key press; returns the started interaction, if any. */
  tryInteract(): ActiveInteraction | null {
    if (!this.current) return null;
    this.interactWith(this.current);
    return this.current;
  }

  /** Start an interaction with an explicit entry (tap-to-examine path). */
  interactWith(entry: InteractableEntry): void {
    const positioned = this.resolvePosition(entry);
    this.player?.faceToward(positioned.x, positioned.y);
    if (entry.kind === 'npc') {
      gameEvents.emit({
        type: 'NPC_DIALOGUE_STARTED',
        payload: { npcId: entry.id, label: entry.label },
      });
    } else {
      gameEvents.emit({
        type: 'INTERACTION_STARTED',
        payload: { objectId: entry.id, roomId: entry.roomId, label: entry.label },
      });
    }
  }

  private resolvePosition(entry: InteractableEntry): ActiveInteraction {
    return { ...entry, ...(entry.getPosition?.() ?? {}) };
  }
}
