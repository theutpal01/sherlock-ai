import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gameEvents, type GameEvent } from '../../game/events/bridge';
import { getLayout, roomName } from '../../game/layouts';

export interface RoomState {
  roomId: string;
  roomName: string;
}

export interface NearbyInteraction {
  kind: 'object' | 'npc';
  id: string;
  label: string;
}

export type InvestigationLogCategory = 'room' | 'evidence' | 'interaction' | 'dialogue' | 'world' | 'case';

export interface InvestigationLogEntry {
  id: number;
  text: string;
  category: InvestigationLogCategory;
  roomId: string;
  roomName: string;
  evidenceId?: string;
  evidenceTitle?: string;
  dialogue?: StoredDialogueExchange;
}

export interface StoredDialogueExchange {
  npcId: string;
  speaker: string;
  question: string | null;
  answer: string;
}

type PendingInvestigationLogEntry = Omit<InvestigationLogEntry, 'id'>;

const RECENT_LOG_LIMIT = 8;
const SESSION_LOG_LIMIT = 500;
const SESSION_LOG_STORAGE_PREFIX = 'sherlock-investigation-log:';
const LOG_CATEGORIES: InvestigationLogCategory[] = ['room', 'evidence', 'interaction', 'dialogue', 'world', 'case'];

function isStoredDialogueExchange(value: unknown): value is StoredDialogueExchange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const dialogue = value as Record<string, unknown>;
  return typeof dialogue.npcId === 'string' &&
    typeof dialogue.speaker === 'string' &&
    (dialogue.question === null || typeof dialogue.question === 'string') &&
    typeof dialogue.answer === 'string';
}

function sessionLogStorageKey(caseId: string, sessionId: string): string {
  return `${SESSION_LOG_STORAGE_PREFIX}${encodeURIComponent(caseId)}:${encodeURIComponent(sessionId)}`;
}

function isInvestigationLogEntry(value: unknown): value is InvestigationLogEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  const dialogueIsValid = entry.dialogue === undefined ||
    (entry.category === 'dialogue' && isStoredDialogueExchange(entry.dialogue));
  return Number.isSafeInteger(entry.id) &&
    typeof entry.text === 'string' &&
    typeof entry.category === 'string' && LOG_CATEGORIES.includes(entry.category as InvestigationLogCategory) &&
    typeof entry.roomId === 'string' &&
    typeof entry.roomName === 'string' &&
    (entry.evidenceId === undefined || typeof entry.evidenceId === 'string') &&
    (entry.evidenceTitle === undefined || typeof entry.evidenceTitle === 'string') &&
    dialogueIsValid;
}

function readSessionLog(caseId: string, sessionId: string): {
  entries: InvestigationLogEntry[];
  count: number;
  storageWarning: boolean;
} {
  try {
    const raw = localStorage.getItem(sessionLogStorageKey(caseId, sessionId));
    if (!raw) return { entries: [], count: 0, storageWarning: false };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { entries: [], count: 0, storageWarning: true };
    }
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.entries)) return { entries: [], count: 0, storageWarning: true };
    const validEntries = record.entries.filter(isInvestigationLogEntry);
    const entries = validEntries.slice(-SESSION_LOG_LIMIT);
    const validCount = Number.isSafeInteger(record.count) && (record.count as number) >= entries.length;
    const count = validCount ? record.count as number : entries.length;
    return {
      entries,
      count,
      storageWarning: !validCount || validEntries.length !== record.entries.length || record.entries.length > SESSION_LOG_LIMIT,
    };
  } catch {
    return { entries: [], count: 0, storageWarning: true };
  }
}

function prunePreviousSessionLogs(caseId: string, sessionId: string): boolean {
  try {
    const prefix = `${SESSION_LOG_STORAGE_PREFIX}${encodeURIComponent(caseId)}:`;
    const currentKey = sessionLogStorageKey(caseId, sessionId);
    const staleKeys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix) && key !== currentKey) staleKeys.push(key);
    }
    staleKeys.forEach((key) => localStorage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

/** Subscribes to the Phaser↔React bridge; unsubscribes on unmount. */
export function useGameEvents(
  caseId: string,
  sessionId: string | null,
  active = true,
  onOpenEvidenceNotebook?: () => void,
  sessionRoomId: string | null = null,
) {
  const initialLayout = getLayout(caseId);
  const initialRoomId = sessionRoomId && initialLayout.rooms.some((candidate) => candidate.id === sessionRoomId)
    ? sessionRoomId
    : initialLayout.startRoom;
  const initialRoom = {
    roomId: initialRoomId,
    roomName: roomName(initialLayout, initialRoomId),
  };
  const currentScopeKey = JSON.stringify([caseId, sessionId]);
  const [hydratedScopeKey, setHydratedScopeKey] = useState<string | null>(null);
  const hydratedScopeKeyRef = useRef<string | null>(null);
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const currentRoomRef = useRef<RoomState>(initialRoom);
  const previousCaseIdRef = useRef(caseId);
  const previousSessionIdRef = useRef(sessionId);
  const nextLogId = useRef(0);
  const sessionLogRef = useRef<InvestigationLogEntry[]>([]);
  const sessionLogCountRef = useRef(0);
  const pendingLogEntriesRef = useRef<PendingInvestigationLogEntry[]>([]);
  const pendingLogCountRef = useRef(0);
  const pendingLogCaseIdRef = useRef(caseId);
  const hydratedSessionKeyRef = useRef<string | null>(null);
  const sessionIdRef = useRef(sessionId);
  const sessionRoomIdRef = useRef(sessionRoomId);
  const caseIdRef = useRef(caseId);
  const [visitedRooms, setVisitedRooms] = useState<string[]>([initialRoom.roomId]);
  const [log, setLog] = useState<InvestigationLogEntry[]>([]);
  const [sessionLog, setSessionLog] = useState<InvestigationLogEntry[]>([]);
  const [sessionLogCount, setSessionLogCount] = useState(0);
  const [logStorageWarning, setLogStorageWarning] = useState(false);
  const [nearbyInteraction, setNearbyInteraction] = useState<NearbyInteraction | null>(null);
  const activeRef = useRef(active);
  const openNotebookRef = useRef(onOpenEvidenceNotebook);

  useLayoutEffect(() => {
    sessionIdRef.current = sessionId;
    sessionRoomIdRef.current = sessionRoomId;
    caseIdRef.current = caseId;
    openNotebookRef.current = onOpenEvidenceNotebook;
    if (hydratedScopeKeyRef.current !== currentScopeKey) {
      hydratedScopeKeyRef.current = null;
    }
    activeRef.current = active && hydratedScopeKey === currentScopeKey &&
      hydratedScopeKeyRef.current === currentScopeKey;
  }, [active, caseId, currentScopeKey, hydratedScopeKey, onOpenEvidenceNotebook, sessionId, sessionRoomId]);

  const appendLog = useCallback((
    category: InvestigationLogCategory,
    text: string,
    evidence?: { id: string; title: string },
    dialogue?: StoredDialogueExchange,
  ) => {
    const pendingEntry: PendingInvestigationLogEntry = {
      text,
      category,
      roomId: currentRoomRef.current.roomId,
      roomName: currentRoomRef.current.roomName,
      ...(evidence ? { evidenceId: evidence.id, evidenceTitle: evidence.title } : {}),
      ...(dialogue ? { dialogue } : {}),
    };
    const entry: InvestigationLogEntry = { id: nextLogId.current++, ...pendingEntry };
    const activeSessionId = sessionIdRef.current;
    const activeCaseId = caseIdRef.current;
    const sessionHydrated = activeSessionId !== null &&
      hydratedSessionKeyRef.current === sessionLogStorageKey(activeCaseId, activeSessionId);
    if (!sessionHydrated) {
      if (pendingLogCaseIdRef.current !== activeCaseId) {
        pendingLogEntriesRef.current = [];
        pendingLogCountRef.current = 0;
        pendingLogCaseIdRef.current = activeCaseId;
      }
      pendingLogEntriesRef.current = [
        ...pendingLogEntriesRef.current.slice(-(SESSION_LOG_LIMIT - 1)),
        pendingEntry,
      ];
      pendingLogCountRef.current += 1;
    }
    setLog((prev) => [...prev.slice(-(RECENT_LOG_LIMIT - 1)), entry]);
    const nextSessionLog = [...sessionLogRef.current.slice(-(SESSION_LOG_LIMIT - 1)), entry];
    sessionLogRef.current = nextSessionLog;
    const nextSessionLogCount = sessionLogCountRef.current + 1;
    sessionLogCountRef.current = nextSessionLogCount;
    setSessionLog(nextSessionLog);
    setSessionLogCount(nextSessionLogCount);
  }, []);

  const recordDialogue = useCallback((npcId: string, speaker: string, question: string | null, answer: string) => {
    if (!activeRef.current || hydratedScopeKeyRef.current !== currentScopeKey) return;
    const prompt = question ? `You asked: ${question} ` : '';
    appendLog('dialogue', `${prompt}${speaker}: ${answer}`, undefined, { npcId, speaker, question, answer });
  }, [appendLog, currentScopeKey]);

  const saveSessionLog = useCallback(() => {
    if (!sessionId) return;
    try {
      localStorage.setItem(sessionLogStorageKey(caseId, sessionId), JSON.stringify({
        entries: sessionLogRef.current,
        count: sessionLogCountRef.current,
      }));
    } catch {
      setLogStorageWarning(true);
    }
  }, [caseId, sessionId]);

  useEffect(() => {
    if (!active) setNearbyInteraction(null);
  }, [active]);

  useEffect(() => {
    const caseChanged = previousCaseIdRef.current !== caseId;
    const sessionChanged = previousSessionIdRef.current !== sessionId;
    previousCaseIdRef.current = caseId;
    previousSessionIdRef.current = sessionId;
    const layout = getLayout(caseId);
    const resetRoom = caseChanged || sessionChanged;
    const restored = sessionId ? readSessionLog(caseId, sessionId) : { entries: [], count: 0, storageWarning: false };
    const pruned = sessionId ? prunePreviousSessionLogs(caseId, sessionId) : true;
    if (caseChanged) {
      pendingLogEntriesRef.current = [];
      pendingLogCountRef.current = 0;
    }
    const pendingEntries = sessionId && pendingLogCaseIdRef.current === caseId
      ? pendingLogEntriesRef.current
      : [];
    const pendingCount = sessionId && pendingLogCaseIdRef.current === caseId
      ? pendingLogCountRef.current
      : 0;
    if (sessionId) {
      pendingLogEntriesRef.current = [];
      pendingLogCountRef.current = 0;
      pendingLogCaseIdRef.current = caseId;
    } else {
      // A null session ID starts a new unbound window; never carry the prior
      // session's log into a fresh investigation while its ID is loading.
      pendingLogEntriesRef.current = [];
      pendingLogCountRef.current = 0;
      pendingLogCaseIdRef.current = caseId;
    }
    const highestRestoredId = restored.entries.reduce((highest, entry) => Math.max(highest, entry.id), -1);
    const pendingStartId = Math.max(highestRestoredId + 1, restored.count) + Math.max(0, pendingCount - pendingEntries.length);
    const restoredWithPending = [
      ...restored.entries,
      ...pendingEntries.map((entry, index) => ({ ...entry, id: pendingStartId + index })),
    ].slice(-SESSION_LOG_LIMIT);
    const restoredCount = restored.count + pendingCount;
    sessionLogRef.current = restoredWithPending;
    sessionLogCountRef.current = restoredCount;
    nextLogId.current = restoredWithPending.reduce((highest, entry) => Math.max(highest, entry.id), -1) + 1;
    hydratedSessionKeyRef.current = sessionId ? sessionLogStorageKey(caseId, sessionId) : null;
    const lastLoggedRoomId = [...restoredWithPending].reverse().find((entry) => entry.category === 'room')?.roomId;
    const requestedRoomId = sessionRoomIdRef.current ?? lastLoggedRoomId;
    const nextRoomId = requestedRoomId && layout.rooms.some((candidate) => candidate.id === requestedRoomId)
      ? requestedRoomId
      : layout.startRoom;
    const nextRoom = resetRoom
      ? { roomId: nextRoomId, roomName: roomName(layout, nextRoomId) }
      : currentRoomRef.current;
    currentRoomRef.current = nextRoom;
    if (resetRoom) {
      setRoom(nextRoom);
      const restoredVisitedRooms = restoredWithPending
        .filter((entry) => entry.category === 'room' && layout.rooms.some((candidate) => candidate.id === entry.roomId))
        .map((entry) => entry.roomId);
      setVisitedRooms([...new Set([...restoredVisitedRooms, nextRoom.roomId])]);
    }
    setLog(restoredWithPending.slice(-RECENT_LOG_LIMIT));
    setSessionLog(restoredWithPending);
    setSessionLogCount(restoredCount);
    setLogStorageWarning(restored.storageWarning || !pruned);
    hydratedScopeKeyRef.current = currentScopeKey;
    setHydratedScopeKey(currentScopeKey);
    const off = gameEvents.subscribe((event: GameEvent) => {
      // A scene being replaced can emit once more before Phaser teardown runs.
      // Ignore output until the active session's room and log scope is hydrated.
      if (!activeRef.current) return;

      if (event.type === 'PLAYER_ENTERED_ROOM') {
        const payload = event.payload as RoomState;
        currentRoomRef.current = payload;
        setRoom(payload);
        setVisitedRooms((prev) => prev.includes(payload.roomId) ? prev : [...prev, payload.roomId]);
        appendLog('room', `Entered ${payload.roomName}`);
      } else if (event.type === 'EVIDENCE_DISCOVERED') {
        const payload = event.payload as { evidenceId: string; title: string };
        appendLog('evidence', `Evidence: ${payload.title}`, { id: payload.evidenceId, title: payload.title });
      } else if (event.type === 'INTERACTION_STARTED') {
        const payload = event.payload as { label: string };
        appendLog('interaction', `Examine: ${payload.label}…`);
      } else if (event.type === 'NPC_BARK') {
        const payload = event.payload as { speaker: string; text: string };
        appendLog('dialogue', `Ambient — ${payload.speaker}: ${payload.text}`);
      } else if (event.type === 'WORLD_STATE_UPDATED') {
        const payload = event.payload as { text: string };
        appendLog('world', `World: ${payload.text}`);
      } else if (event.type === 'CASE_COMPLETED') {
        const payload = event.payload as { name: string; verdict: string };
        appendLog('case', `Case closed: ${payload.name} — ${payload.verdict}`);
      } else if (event.type === 'OPEN_EVIDENCE_NOTEBOOK') {
        openNotebookRef.current?.();
      } else if (event.type === 'INTERACTION_AVAILABLE') {
        const payload = event.payload as {
          kind: 'object' | 'npc' | null;
          id: string | null;
          label?: string;
        };
        setNearbyInteraction(
          payload.kind && payload.id && payload.label
            ? { kind: payload.kind, id: payload.id, label: payload.label }
            : null,
        );
      }
    });
    return off;
  }, [appendLog, caseId, currentScopeKey, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const timeout = window.setTimeout(saveSessionLog, 250);
    return () => window.clearTimeout(timeout);
  }, [caseId, sessionId, saveSessionLog, sessionLog, sessionLogCount]);

  useEffect(() => {
    if (!sessionId) return;
    window.addEventListener('pagehide', saveSessionLog);
    return () => {
      window.removeEventListener('pagehide', saveSessionLog);
      saveSessionLog();
    };
  }, [saveSessionLog, sessionId]);

  const earlierLog = sessionLog.slice(0, Math.max(0, sessionLog.length - RECENT_LOG_LIMIT));
  const omittedLogCount = Math.max(0, sessionLogCount - sessionLog.length);
  const dialogueHistoryByNpc = useMemo(() => {
    const history: Record<string, { question: string | null; answer: string }[]> = {};
    for (const entry of sessionLog) {
      if (!entry.dialogue) continue;
      const npcHistory = history[entry.dialogue.npcId] ?? [];
      npcHistory.push({ question: entry.dialogue.question, answer: entry.dialogue.answer });
      history[entry.dialogue.npcId] = npcHistory;
    }
    return history;
  }, [sessionLog]);
  const scopeIsHydrated = hydratedScopeKey === currentScopeKey;
  return {
    room: scopeIsHydrated ? room : initialRoom,
    log: scopeIsHydrated ? log : [],
    earlierLog: scopeIsHydrated ? earlierLog : [],
    omittedLogCount: scopeIsHydrated ? omittedLogCount : 0,
    logStorageWarning: scopeIsHydrated && logStorageWarning,
    visitedRooms: scopeIsHydrated ? visitedRooms : [initialRoom.roomId],
    nearbyInteraction: scopeIsHydrated ? nearbyInteraction : null,
    recordDialogue,
    dialogueHistoryByNpc: scopeIsHydrated ? dialogueHistoryByNpc : {},
  };
}
