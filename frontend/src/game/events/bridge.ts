/** Typed event bridge between Phaser and React (spec section 14). */
export type GameEventType =
  | 'PLAYER_ENTERED_ROOM'
  | 'INTERACTION_AVAILABLE'
  | 'INTERACTION_STARTED'
  | 'EVIDENCE_DISCOVERED'
  | 'NPC_DIALOGUE_STARTED'
  | 'WORLD_STATE_UPDATED'
  | 'WORLD_SYNC'
  | 'SCENE_READY'
  | 'PAUSE_GAME'
  | 'RESUME_GAME'
  | 'INTERACT_PRESSED'
  | 'EVIDENCE_SYNC'
  | 'CASE_COMPLETED';

export interface GameEvent {
  type: GameEventType;
  payload?: unknown;
}

type Listener = (event: GameEvent) => void;

export class GameEventBridge {
  private listeners = new Set<Listener>();

  emit(event: GameEvent): void {
    // Snapshot + isolate: one throwing subscriber must never break the
    // publisher, sibling listeners, or the caller's own error handling.
    // (A Phaser scene bug once rode a WORLD_SYNC throw all the way up
    // into the UI's API-error banner via a shared emit call stack.)
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[bridge] listener failed for ${event.type}:`, err);
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const gameEvents = new GameEventBridge();
