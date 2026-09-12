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
    this.current = null;
  }

  update(): void {
    if (!this.player) return;
    let best: ActiveInteraction | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const entry of this.entries) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.x, entry.y);
      if (dist <= entry.radius && dist < bestDist) {
        bestDist = dist;
        best = { ...entry };
      }
    }
    const changed = (best?.id ?? null) !== (this.current?.id ?? null);
    this.current = best;
    if (best && this.player) {
      const verb = best.kind === 'npc' ? 'TALK TO' : 'EXAMINE';
      this.prompt.setPosition(this.player.x, this.player.y - 34);
      this.prompt.setText(`[E] ${verb} ${best.label.toUpperCase()}`);
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
}
