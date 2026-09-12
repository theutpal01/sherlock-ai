import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  api,
  type AccuseResult,
  type CaseInfo,
  type DialogueVisitResult,
  type InteractResult,
  type Knowledge,
  type EvidenceDetail,
  type World,
} from '../../api/client';
import { gameEvents } from '../../game/events/bridge';

const STORAGE_KEY = 'sherlock-sessions';
const LEGACY_STORAGE_KEY = 'sherlock-session-id';

export function readSessionMap(): Record<string, string> {  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function writeSessionMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* private mode etc. — session simply won't persist */
  }
}

export interface ActiveDialogue {
  npcId: string;
  npcName: string;
}

export interface ClosedCase {
  accused: string;
  correct: boolean;
}

export interface SessionMeta {
  difficulty: string;
  hints_used: number;
  score: number | null;
}

/**
 * Investigation session: creates/resumes the backend session, forwards
 * Phaser events to the discovery/dialogue endpoints, and keeps notebook,
 * deductions, and world panels in sync. React never reasons locally and
 * never computes NPC positions — both come from the backend.
 *
 * Bootstrapping waits for `enabled` so the title menu can mount without
 * opening sessions the player never starts.
 */
export function useSession(caseId: string, difficulty: string, enabled = true) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<Knowledge>({ known: [], derived: [] });
  const [notebook, setNotebook] = useState<EvidenceDetail[]>([]);
  const [world, setWorld] = useState<World | null>(null);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [lastResult, setLastResult] = useState<InteractResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeDialogue, setActiveDialogue] = useState<ActiveDialogue | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [closed, setClosed] = useState<ClosedCase | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;
  const firedRef = useRef<string[]>([]);
  const lastSyncRef = useRef<{ npcs: { id: string; label: string; roomId: string }[] } | null>(null);

  const syncWorld = useCallback((next: World) => {
    const fresh = next.events_fired.filter((id) => !firedRef.current.includes(id));
    firedRef.current = next.events_fired;
    if (fresh.length > 0) {
      const byId = new Map(next.events.map((e) => [e.id, e.description]));
      for (const id of fresh) {
        gameEvents.emit({
          type: 'WORLD_STATE_UPDATED',
          payload: { eventId: id, text: byId.get(id) ?? id },
        });
      }
    }
    setWorld(next);
    const sync = {
      npcs: next.npcs.map((npc) => ({
        id: npc.id,
        label: npc.name,
        roomId: npc.location,
        role: npc.role,
      })),
    };
    lastSyncRef.current = sync;
    gameEvents.emit({ type: 'WORLD_SYNC', payload: sync });
  }, []);

  const refresh = useCallback(
    async (sid: string) => {
      const [kn, ev, wd, st] = await Promise.all([
        api.knowledge(sid),
        api.evidence(sid),
        api.world(sid),
        api.getSession(sid),
      ]);
      setKnowledge(kn);
      setNotebook(ev.evidence);
      setMeta({ difficulty: st.difficulty, hints_used: st.hints_used, score: st.score });
      syncWorld(wd);
      gameEvents.emit({
        type: 'EVIDENCE_SYNC',
        payload: { evidenceIds: ev.evidence.map((e) => e.id) },
      });
    },
    [syncWorld],
  );

  const restoreClosed = (accused: string | null, correct: boolean | null) => {
    if (accused !== null && correct !== null) setClosed({ accused, correct });
  };

  const loadCaseInfo = useCallback(async (id: string) => {
    try {
      setCaseInfo(await api.caseDetail(id));
    } catch {
      /* panels show loading fallbacks; game stays playable */
    }
  }, []);

  const resetCaseState = () => {
    setKnowledge({ known: [], derived: [] });
    setNotebook([]);
    setWorld(null);
    setMeta(null);
    setLastResult(null);
    setLastError(null);
    setSessionError(null);
    setClosed(null);
    setActiveDialogue(null);
    setSessionId(null);
    firedRef.current = [];
    lastSyncRef.current = null;
  };

  const [restartNonce, setRestartNonce] = useState(0);

  const newInvestigation = useCallback(() => {
    const map = readSessionMap();
    delete map[`${caseId}:${difficulty}`];
    writeSessionMap(map);
    setRestartNonce((n) => n + 1);
  }, [caseId, difficulty]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    resetCaseState();
    void loadCaseInfo(caseId);
    const mapKey = `${caseId}:${difficulty}`;
    (async () => {
      try {
        const map = readSessionMap();
        // One-time migration from the single-session storage key.
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy && !map['blackwood_manor:standard']) {
          map['blackwood_manor:standard'] = legacy;
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          writeSessionMap(map);
        }
        const stored = map[mapKey];
        if (stored) {
          try {
            const existing = await api.getSession(stored);
            if (cancelled) return;
            setSessionId(stored);
            setSessionError(null);
            restoreClosed(existing.accused, existing.correct);
            await refresh(stored);
            return;
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              const next = { ...readSessionMap() };
              delete next[mapKey];
              writeSessionMap(next);
            } else {
              throw err;
            }
          }
        }
        const created = await api.createSession(caseId, difficulty);
        if (cancelled) return;
        writeSessionMap({ ...readSessionMap(), [mapKey]: created.id });
        setSessionId(created.id);
        setSessionError(null);
        await refresh(created.id);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setSessionError(
            `backend error ${err.status} — check the backend terminal for the traceback, then refresh`,
          );
        } else {
          setSessionError('backend not reachable (is it running on :8000?)');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, difficulty, enabled, refresh, loadCaseInfo, restartNonce]);

  const interact = useCallback(
    async (objectId: string) => {
      const sid = sessionIdRef.current;
      if (!sid || busy) return;
      setBusy(true);
      setLastError(null);
      try {
        const result = await api.interact(sid, objectId);
        setLastResult(result);
        await refresh(sid);
        if (!result.already_discovered) {
          gameEvents.emit({
            type: 'EVIDENCE_DISCOVERED',
            payload: { evidenceId: result.evidence.id, title: result.evidence.title },
          });
        }
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'Interaction failed');
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh],
  );

  const visitDialogue = useCallback(
    async (nodeId: string): Promise<DialogueVisitResult> => {
      const sid = sessionIdRef.current;
      if (!sid) throw new Error('No session');
      const result = await api.visitDialogue(sid, nodeId);
      await refresh(sid);
      for (const item of result.unlocked_evidence) {
        gameEvents.emit({
          type: 'EVIDENCE_DISCOVERED',
          payload: { evidenceId: item.id, title: item.title },
        });
      }
      return result;
    },
    [refresh],
  );

  const move = useCallback((roomId: string) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    api.move(sid, roomId).catch(() => {
      /* movement stays local even if the backend is down */
    });
  }, []);

  const accuse = useCallback(async (suspect: string): Promise<AccuseResult> => {
    const sid = sessionIdRef.current;
    if (!sid) throw new Error('No session');
    const result = await api.accuse(sid, suspect);
    setClosed({ accused: result.accused, correct: result.correct });
    gameEvents.emit({
      type: 'CASE_COMPLETED',
      payload: {
        name: result.accused_name,
        verdict: result.correct ? 'CORRECT' : 'INCORRECT',
      },
    });
    return result;
  }, []);

  useEffect(() => {
    const off = gameEvents.subscribe((event) => {
      if (event.type === 'INTERACTION_STARTED') {
        const payload = event.payload as { objectId: string };
        void interact(payload.objectId);
      } else if (event.type === 'NPC_DIALOGUE_STARTED') {
        const payload = event.payload as { npcId: string; label: string };
        setActiveDialogue({ npcId: payload.npcId, npcName: payload.label });
      } else if (event.type === 'PLAYER_ENTERED_ROOM') {
        const payload = event.payload as { roomId: string };
        move(payload.roomId);
      } else if (event.type === 'SCENE_READY') {
        // Scene (re)booted after earlier syncs: replay the latest world
        // state so NPC markers render. No-op until a session exists.
        if (lastSyncRef.current) {
          gameEvents.emit({ type: 'WORLD_SYNC', payload: lastSyncRef.current });
        }
      }
    });
    return off;
  }, [interact, move]);

  return {
    sessionId,
    sessionError,
    knowledge,
    notebook,
    world,
    meta,
    caseInfo,
    closed,
    accuse,
    newInvestigation,
    lastResult,
    lastError,
    busy,
    activeDialogue,
    closeDialogue: () => setActiveDialogue(null),
    visitDialogue,
  };
}
