import { useEffect, useRef, useState } from 'react';
import type { WorldNpc } from '../../api/client';
import { gameEvents } from '../../game/events/bridge';
import { barkFor } from '../../game/barks';

const ENTER_DELAY_MS = 3000;
const IDLE_MS = 45000;

/**
 * Ambient barks: when the detective shares a room with an NPC, that NPC
 * occasionally mutters flavor into the Investigation Log. Cooldown per NPC
 * per room so the log never floods.
 */
export function useBarks(roomId: string, npcs: WorldNpc[], enabled: boolean) {
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const cooldown = useRef<Set<string>>(new Set());
  const lastBarks = useRef<Map<string, string>>(new Map());
  const usedBarks = useRef<Map<string, Set<string>>>(new Map());
  const npcsRef = useRef(npcs);
  npcsRef.current = npcs;
  const presentNpcIds = JSON.stringify(
    npcs.filter((npc) => npc.location === roomId).map((npc) => npc.id).sort(),
  );

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (!enabled || !pageVisible || !roomId) return;
    if (presentNpcIds === '[]') return;

    const say = () => {
      const present = npcsRef.current.filter((npc) => npc.location === roomId);
      if (present.length === 0) return;
      const fresh = present.filter((n) => !cooldown.current.has(`${roomId}:${n.id}`));
      const pool = fresh.length > 0 ? fresh : present;
      const npc = pool[Math.floor(Math.random() * pool.length)];
      // Everyone has spoken: reset the room's cooldown for the next round.
      if (fresh.length === 0) {
        present.forEach((n) => cooldown.current.delete(`${roomId}:${n.id}`));
      }
      const key = `${roomId}:${npc.id}`;
      let used = usedBarks.current.get(key);
      if (!used) {
        used = new Set<string>();
        usedBarks.current.set(key, used);
      }
      const text = barkFor(npc.id, roomId, used, lastBarks.current.get(key));
      cooldown.current.add(key);
      lastBarks.current.set(key, text);
      gameEvents.emit({
        type: 'NPC_BARK',
        payload: { speaker: npc.name, text },
      });
    };

    const enterTimer = window.setTimeout(say, ENTER_DELAY_MS);
    const idleTimer = window.setInterval(say, IDLE_MS);
    return () => {
      window.clearTimeout(enterTimer);
      window.clearInterval(idleTimer);
    };
  }, [enabled, pageVisible, roomId, presentNpcIds]);
}
