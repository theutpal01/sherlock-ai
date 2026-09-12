import { useEffect, useState } from 'react';
import { gameEvents, type GameEvent } from '../../game/events/bridge';

export interface RoomState {
  roomId: string;
  roomName: string;
}

/** Subscribes to the Phaser↔React bridge; unsubscribes on unmount. */
export function useGameEvents() {
  const [room, setRoom] = useState<RoomState>({ roomId: 'entrance', roomName: 'Entrance' });
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const push = (line: string) =>
      setLog((prev) => [...prev.slice(-7), line]);
    const off = gameEvents.subscribe((event: GameEvent) => {
      if (event.type === 'PLAYER_ENTERED_ROOM') {
        const payload = event.payload as RoomState;
        setRoom(payload);
        push(`Entered ${payload.roomName}`);
      } else if (event.type === 'EVIDENCE_DISCOVERED') {
        const payload = event.payload as { title: string };
        push(`Evidence: ${payload.title}`);
      } else if (event.type === 'INTERACTION_STARTED') {
        const payload = event.payload as { label: string };
        push(`Examine: ${payload.label}…`);
      } else if (event.type === 'WORLD_STATE_UPDATED') {
        const payload = event.payload as { text: string };
        push(`World: ${payload.text}`);
      } else if (event.type === 'CASE_COMPLETED') {
        const payload = event.payload as { name: string; verdict: string };
        push(`Case closed: ${payload.name} — ${payload.verdict}`);
      }
    });
    return off;
  }, []);

  return { room, log };
}
