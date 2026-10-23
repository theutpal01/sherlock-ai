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
const EMPTY_KNOWLEDGE: Knowledge = { known: [], derived: [] };
const EMPTY_NOTEBOOK: EvidenceDetail[] = [];

function sessionStorageKey(caseId: string, difficulty: string, dailyDate: string | null): string {
  return dailyDate ? `daily:${dailyDate}:${caseId}:${difficulty}` : `${caseId}:${difficulty}`;
}

function isValidStoredSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

export function readSessionMapWithStatus(): {
  map: Record<string, string>;
  storageAvailable: boolean;
  mapValid: boolean;
} {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { map: {}, storageAvailable: false, mapValid: false };
  }
  if (raw === null) return { map: {}, storageAvailable: true, mapValid: true };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { map: {}, storageAvailable: true, mapValid: false };
    }
    const entries = Object.entries(parsed);
    return {
      map: Object.fromEntries(
        entries.filter((entry): entry is [string, string] => isValidStoredSessionId(entry[1])),
      ),
      storageAvailable: true,
      mapValid: entries.every((entry) => isValidStoredSessionId(entry[1])),
    };
  } catch {
    return { map: {}, storageAvailable: true, mapValid: false };
  }
}

export function readSessionMap(): Record<string, string> {
  return readSessionMapWithStatus().map;
}

export function writeSessionMap(map: Record<string, string>): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
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
export function useSession(
  caseId: string,
  difficulty: string,
  enabled = true,
  onPersistenceFailure?: () => void,
  dailyDate: string | null = null,
) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionRoomId, setSessionRoomId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionScopeKey, setSessionScopeKey] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<Knowledge>({ known: [], derived: [] });
  const [notebook, setNotebook] = useState<EvidenceDetail[]>([]);
  const [world, setWorld] = useState<World | null>(null);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [lastResultState, setLastResultState] = useState<{
    caseId: string;
    sessionId: string;
    result: InteractResult;
  } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeDialogue, setActiveDialogue] = useState<ActiveDialogue | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const doorConfigRef = useRef<CaseInfo['doors'] | null>(null);
  const [closed, setClosed] = useState<ClosedCase | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionRequestEpochRef = useRef(0);
  const caseIdRef = useRef(caseId);
  caseIdRef.current = caseId;
  const interactionRequestRef = useRef(0);
  const interactionBusyRef = useRef(false);
  const targetSessionKey = sessionStorageKey(caseId, difficulty, dailyDate);
  const sessionMatchesCurrentScope = sessionScopeKey === targetSessionKey;
  const currentSessionId = sessionMatchesCurrentScope ? sessionId : null;
  const currentSessionRoomId = sessionMatchesCurrentScope ? sessionRoomId : null;
  const currentSessionError = sessionMatchesCurrentScope ? sessionError : null;
  const currentSessionLoading = enabled && (!sessionMatchesCurrentScope || sessionLoading);
  const lastResult =
    sessionMatchesCurrentScope && lastResultState?.caseId === caseId && lastResultState.sessionId === currentSessionId
      ? lastResultState.result
      : null;
  const firedRef = useRef<string[]>([]);
  const lastSyncRef = useRef<{ npcs: { id: string; label: string; roomId: string }[] } | null>(null);
  sessionIdRef.current = currentSessionId;

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
    async (sid: string, isCurrent?: () => boolean) => {
      const [kn, ev, wd, st] = await Promise.all([
        api.knowledge(sid),
        api.evidence(sid),
        api.world(sid),
        api.getSession(sid),
      ]);
      if (sessionIdRef.current !== sid || (isCurrent && !isCurrent())) return;
      setKnowledge(kn);
      setNotebook(ev.evidence);
      setSessionRoomId(st.current_room);
      setMeta({ difficulty: st.difficulty, hints_used: st.hints_used, score: st.score });
      syncWorld(wd);
      gameEvents.emit({
        type: 'EVIDENCE_SYNC',
        payload: { evidenceIds: ev.evidence.map((e) => e.id) },
      });
    },
    [syncWorld],
  );

  const invalidateInteraction = useCallback(() => {
    interactionRequestRef.current += 1;
    interactionBusyRef.current = false;
    setBusy(false);
    setLastResultState(null);
  }, []);

  const restoreClosed = (accused: string | null, correct: boolean | null) => {
    if (accused !== null && correct !== null) setClosed({ accused, correct });
  };

  const resetCaseState = () => {
    sessionRequestEpochRef.current += 1;
    invalidateInteraction();
    setKnowledge({ known: [], derived: [] });
    setNotebook([]);
    setWorld(null);
    setSessionRoomId(null);
    setMeta(null);
    setLastError(null);
    setSessionError(null);
    setSessionLoading(false);
    setSessionScopeKey(null);
    setCaseInfo(null);
    doorConfigRef.current = null;
    setClosed(null);
    setActiveDialogue(null);
    sessionIdRef.current = null;
    setSessionId(null);
    firedRef.current = [];
    lastSyncRef.current = null;
  };

  const [restartNonce, setRestartNonce] = useState(0);
  const freshSessionForRef = useRef<string | null>(null);

  const newInvestigation = useCallback((targetCaseId = caseId, targetDailyDate = dailyDate) => {
    sessionRequestEpochRef.current += 1;
    invalidateInteraction();
    // Invalidate the old session in the same event turn so the game scene
    // cannot briefly remount against stale session state before the effect
    // below begins loading the replacement.
    sessionIdRef.current = null;
    setSessionId(null);
    setSessionScopeKey(null);
    setSessionRoomId(null);
    setSessionError(null);
    setSessionLoading(true);
    freshSessionForRef.current = sessionStorageKey(targetCaseId, difficulty, targetDailyDate);
    setRestartNonce((n) => n + 1);
  }, [caseId, dailyDate, difficulty, invalidateInteraction]);

  const retrySession = useCallback(() => {
    sessionRequestEpochRef.current += 1;
    invalidateInteraction();
    setRestartNonce((n) => n + 1);
  }, [invalidateInteraction]);

  useEffect(() => {
    if (!enabled) {
      sessionRequestEpochRef.current += 1;
      setSessionLoading(false);
      setSessionScopeKey(null);
      sessionIdRef.current = null;
      freshSessionForRef.current = null;
      return;
    }
    let cancelled = false;
    const mapKey = sessionStorageKey(caseId, difficulty, dailyDate);
    resetCaseState();
    setSessionScopeKey(mapKey);
    setSessionLoading(true);
    (async () => {
      try {
        const detail = await api.caseDetail(caseId);
        if (cancelled) return;
        setCaseInfo(detail);
        doorConfigRef.current = detail.doors;
        gameEvents.emit({ type: 'DOOR_CONFIG_SYNC', payload: { doors: detail.doors } });
        const mapResult = readSessionMapWithStatus();
        const canPersistSessionMap = mapResult.storageAvailable && mapResult.mapValid;
        if (!canPersistSessionMap) onPersistenceFailure?.();
        const map = mapResult.map;
        // One-time migration from the single-session storage key.
        try {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (canPersistSessionMap && legacy && !map['blackwood_manor:standard']) {
            map['blackwood_manor:standard'] = legacy;
            if (!writeSessionMap(map)) {
              onPersistenceFailure?.();
            } else {
              try {
                localStorage.removeItem(LEGACY_STORAGE_KEY);
              } catch {
                /* The migrated session reference is already stored safely. */
              }
            }
          }
        } catch {
          onPersistenceFailure?.();
        }
        const stored = map[mapKey];
        const forceFresh = freshSessionForRef.current === mapKey;
        if (stored && !forceFresh) {
          try {
            const existing = await api.getSession(stored);
            if (cancelled) return;
            sessionIdRef.current = stored;
            setSessionScopeKey(mapKey);
            setSessionRoomId(existing.current_room);
            setSessionId(stored);
            setSessionError(null);
            restoreClosed(existing.accused, existing.correct);
            await refresh(stored);
            return;
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              const latestMap = readSessionMapWithStatus();
              if (!latestMap.storageAvailable || !latestMap.mapValid) {
                onPersistenceFailure?.();
              } else {
                const next = { ...latestMap.map };
                delete next[mapKey];
                if (!writeSessionMap(next)) onPersistenceFailure?.();
              }
            } else {
              throw err;
            }
          }
        }
        const created = await api.createSession(caseId, difficulty);
        if (cancelled) return;
        const latestMap = readSessionMapWithStatus();
        if (!latestMap.storageAvailable || !latestMap.mapValid) {
          onPersistenceFailure?.();
        } else if (!writeSessionMap({ ...latestMap.map, [mapKey]: created.id })) {
          onPersistenceFailure?.();
        }
        if (freshSessionForRef.current === mapKey) freshSessionForRef.current = null;
        sessionIdRef.current = created.id;
        setSessionScopeKey(mapKey);
        setSessionRoomId(created.current_room);
        setSessionId(created.id);
        setSessionError(null);
        await refresh(created.id);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setSessionError(`The investigation service returned an error (${err.status}). Try again.`);
        } else {
          setSessionError('Could not reach the investigation service. Check that it is running, then try again.');
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, dailyDate, difficulty, enabled, onPersistenceFailure, refresh, restartNonce]);

  const interact = useCallback(
    async (objectId: string) => {
      const requestCaseId = caseId;
      const sid = sessionIdRef.current;
      if (!sid || interactionBusyRef.current) return;
      const requestId = ++interactionRequestRef.current;
      interactionBusyRef.current = true;
      setBusy(true);
      setLastError(null);
      const isCurrentRequest = () =>
        interactionRequestRef.current === requestId &&
        caseIdRef.current === requestCaseId &&
        sessionIdRef.current === sid;
      try {
        const result = await api.interact(sid, objectId);
        if (!isCurrentRequest()) return;
        setLastResultState({ caseId: requestCaseId, sessionId: sid, result });
        await refresh(sid, isCurrentRequest);
        if (!isCurrentRequest()) return;
        if (!result.already_discovered) {
          gameEvents.emit({
            type: 'EVIDENCE_DISCOVERED',
            payload: { evidenceId: result.evidence.id, title: result.evidence.title },
          });
        }
      } catch (err) {
        if (isCurrentRequest()) {
          setLastError(err instanceof Error ? err.message : 'Interaction failed');
        }
      } finally {
        if (interactionRequestRef.current === requestId) {
          interactionBusyRef.current = false;
          setBusy(false);
        }
      }
    },
    [caseId, refresh],
  );

  const visitDialogue = useCallback(
    async (nodeId: string): Promise<DialogueVisitResult> => {
      const sid = sessionIdRef.current;
      if (!sid) throw new Error('No session');
      const requestEpoch = sessionRequestEpochRef.current;
      const isCurrentRequest = () =>
        sessionIdRef.current === sid && sessionRequestEpochRef.current === requestEpoch;
      const result = await api.visitDialogue(sid, nodeId);
      if (!isCurrentRequest()) return result;
      await refresh(sid, isCurrentRequest);
      if (!isCurrentRequest()) return result;
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
    setSessionRoomId(roomId);
    api.move(sid, roomId).catch(() => {
      /* movement stays local even if the backend is down */
    });
  }, []);

  const accuse = useCallback(async (suspect: string): Promise<AccuseResult> => {
    const sid = sessionIdRef.current;
    if (!sid) throw new Error('No session');
    const requestEpoch = sessionRequestEpochRef.current;
    const result = await api.accuse(sid, suspect);
    if (sessionIdRef.current !== sid || sessionRequestEpochRef.current !== requestEpoch) return result;
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
        // Scene (re)booted after earlier syncs: replay case definitions and
        // the latest world state so doors and NPC markers match the case.
        if (doorConfigRef.current) {
          gameEvents.emit({
            type: 'DOOR_CONFIG_SYNC',
            payload: { doors: doorConfigRef.current },
          });
        }
        if (lastSyncRef.current) {
          gameEvents.emit({ type: 'WORLD_SYNC', payload: lastSyncRef.current });
        }
      }
    });
    return off;
  }, [interact, move]);

  return {
    sessionEpoch: sessionRequestEpochRef.current,
    sessionId: currentSessionId,
    sessionRoomId: currentSessionId ? currentSessionRoomId : null,
    sessionError: currentSessionError,
    sessionLoading: currentSessionLoading,
    knowledge: currentSessionId ? knowledge : EMPTY_KNOWLEDGE,
    notebook: currentSessionId ? notebook : EMPTY_NOTEBOOK,
    world: currentSessionId ? world : null,
    meta: currentSessionId ? meta : null,
    caseInfo: sessionMatchesCurrentScope ? caseInfo : null,
    closed: currentSessionId ? closed : null,
    accuse,
    newInvestigation,
    retrySession,
    lastResult,
    lastError: currentSessionId ? lastError : null,
    busy: currentSessionId ? busy : false,
    activeDialogue: currentSessionId ? activeDialogue : null,
    closeDialogue: () => {
      setActiveDialogue(null);
      if (!sessionLoading && !sessionError) gameEvents.emit({ type: 'RESUME_GAME' });
    },
    visitDialogue,
  };
}
