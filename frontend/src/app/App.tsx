import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  api,
  type AccuseResult,
  type CaseSummary,
  type DailyCase,
  type InteractResult,
} from '../api/client';
import type Phaser from 'phaser';
import { gameEvents } from '../game/events/bridge';

/** Lazy-load Phaser so the case menu does not download the game engine.
 * The engine loads when gameplay starts and stays cached for later cases. */
type GameApi = typeof import('../game/Game');
const gameApiRef: { current: GameApi | null } = { current: null };
async function gameApi(): Promise<GameApi> {
  if (!gameApiRef.current) gameApiRef.current = await import('../game/Game');
  return gameApiRef.current;
}
import CaseClosedOverlay from './components/CaseClosedOverlay';
import ChronologyPanel from './components/ChronologyPanel';
import { unlockAtVerdict, type Achievement } from './achievements';
import { starsFor, writeBestStars } from './verdictStars';
import ColdStreakMeter from './components/ColdStreakMeter';
import ComparePanel from './components/ComparePanel';
import ContradictionBoard from './components/ContradictionBoard';
import DialoguePanel from './components/DialoguePanel';
import EvidenceNotebook from './components/EvidenceNotebook';
import HintPanel from './components/HintPanel';
import HowToPlay from './components/HowToPlay';
import InvestigationLogPanel from './components/InvestigationLogPanel';
import HypothesisPanel from './components/HypothesisPanel';
import KnowledgeGraph from './components/KnowledgeGraph';
import LinkPanel from './components/LinkPanel';
import MainMenu, { type CaseProgress, type ModeProgress } from './components/MainMenu';
import PauseMenu from './components/PauseMenu';
import PhotoLog, { type Photo } from './components/PhotoLog';
import SuspectPanel from './components/SuspectPanel';
import TouchControls from './components/TouchControls';
import WhatIfPanel from './components/WhatIfPanel';
import WorldGuide from './components/WorldGuide';
import { useGameEvents } from './hooks/useGameEvents';
import { useGameSounds } from './hooks/useGameSounds';
import { useBarks } from './hooks/useBarks';
import { useDialogFocus } from './hooks/useDialogFocus';
import { readSessionMapWithStatus, useSession } from './hooks/useSession';

const BEST_STREAK_KEY = 'sherlock-best-streak';

/** All-time best deduction streak per case; session-only if storage fails. */
function readBestStreak(caseId: string): number {
  try {
    const raw = localStorage.getItem(BEST_STREAK_KEY);
    if (!raw) return 0;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return 0;
    const value = (parsed as Record<string, unknown>)[caseId];
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeBestStreak(caseId: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) return;
  try {
    const raw = localStorage.getItem(BEST_STREAK_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const map: Record<string, number> = Object.create(null) as Record<string, number>;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      for (const [key, score] of Object.entries(parsed)) {
        if (typeof score === 'number' && Number.isSafeInteger(score) && score >= 0) map[key] = score;
      }
    }
    if (value > (map[caseId] ?? 0)) {
      map[caseId] = value;
      localStorage.setItem(BEST_STREAK_KEY, JSON.stringify(map));
    }
  } catch {
    /* private mode: streak stays session-only */
  }
}

const MAX_PHOTOS = 12;
const TUTORIAL_SEEN_KEY = 'sherlock-tutorial-seen';

function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function isPhoto(value: unknown): value is Photo {
  if (typeof value !== 'object' || value === null) return false;
  const photo = value as Partial<Photo>;
  return (
    typeof photo.id === 'string' &&
    photo.id.length > 0 &&
    typeof photo.src === 'string' &&
    photo.src.startsWith('data:image/jpeg;base64,') &&
    photo.src.length > 'data:image/jpeg;base64,'.length &&
    typeof photo.title === 'string' &&
    typeof photo.room === 'string' &&
    typeof photo.counter === 'number' &&
    Number.isInteger(photo.counter) &&
    photo.counter >= 0
  );
}

function readPhotos(caseId: string): Photo[] {
  try {
    const raw = localStorage.getItem(`sherlock-photos:${caseId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = new Set<string>();
    return parsed
      .filter(isPhoto)
      .filter((photo) => {
        if (ids.has(photo.id)) return false;
        ids.add(photo.id);
        return true;
      })
      .slice(0, MAX_PHOTOS);
  } catch {
    return [];
  }
}

function writePhotos(caseId: string, photos: Photo[]): boolean {
  try {
    localStorage.setItem(`sherlock-photos:${caseId}`, JSON.stringify(photos.slice(0, MAX_PHOTOS)));
    return true;
  } catch {
    /* quota or private mode: photos stay session-only */
    return false;
  }
}

/**
 * React shell: title menu → game HUD → pause / case-closed overlays.
 * React never reasons locally and never mutates Phaser state directly
 * (spec section 14) — scene control goes through bridge commands.
 */
export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const focusMenuOnEntry = useRef(false);
  const [activeWorkbench, setActiveWorkbench] = useState<'casefile' | 'reasoning' | 'field'>('casefile');
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [casesRetry, setCasesRetry] = useState(0);
  const [dailyRetry, setDailyRetry] = useState(0);
  const [daily, setDaily] = useState<DailyCase | null>(null);
  const [dailyFetchStatus, setDailyFetchStatus] = useState<'loading' | 'ready' | 'refreshing' | 'error'>('loading');
  const [dailyProgress, setDailyProgress] = useState<ModeProgress | null>(null);
  const [dailyRunDate, setDailyRunDate] = useState<string | null>(null);
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [caseId, setCaseId] = useState('blackwood_manor');
  const [difficulty, setDifficulty] = useState<'standard' | 'classic'>(() => {
    try {
      return localStorage.getItem('sherlock-difficulty') === 'classic' ? 'classic' : 'standard';
    } catch {
      return 'standard';
    }
  });
  const [paused, setPaused] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [verdictOverlay, setVerdictOverlay] = useState<AccuseResult | null>(null);
  const [newUnlocks, setNewUnlocks] = useState<Achievement[]>([]);
  const [achievementStorageWarning, setAchievementStorageWarning] = useState(false);
  const [starStorageWarning, setStarStorageWarning] = useState(false);
  const [progress, setProgress] = useState<Record<string, CaseProgress>>({});
  const dailyProgressRequestId = useRef(0);
  const [sessionStorageWarning, setSessionStorageWarning] = useState(false);
  const reportSessionStorageFailure = useCallback(() => setSessionStorageWarning(true), []);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const [photos, setPhotos] = useState<Photo[]>(() => readPhotos(caseId));
  const [photoStorageWarning, setPhotoStorageWarning] = useState(false);
  const photosRef = useRef(photos);
  const [evidenceFocus, setEvidenceFocus] = useState<{ caseId: string; id: string; request: number } | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineRetry, setEngineRetry] = useState(0);
  const [discoveryToast, setDiscoveryToast] = useState<{
    id: number;
    evidenceId: string;
    title: string;
    description: string;
  } | null>(null);
  const lastResultRef = useRef<InteractResult | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastId = useRef(0);
  const { muted, toggleMuted, volume, setVolume, preferenceStorageWarning } = useGameSounds();
  const setPause = useCallback((pause: boolean) => {
    gameEvents.emit({ type: pause ? 'PAUSE_GAME' : 'RESUME_GAME' });
    setPaused(pause);
  }, []);
  const resetStreak = () => {
    streakRef.current = 0;
    setStreak(0);
  };
  const session = useSession(caseId, difficulty, screen === 'game', reportSessionStorageFailure, dailyRunDate);
  const {
    sessionId,
    sessionEpoch,
    sessionRoomId,
    sessionError,
    sessionLoading,
    knowledge,
    notebook,
    world,
    meta,
    caseInfo,
    closed,
    accuse,
    newInvestigation,
    retrySession,
    lastResult,
    lastError,
    activeDialogue,
    closeDialogue,
    visitDialogue,
  } = session;
  const sessionReady = Boolean(sessionId) && !sessionLoading && !sessionError;
  useEffect(() => {
    if (screen !== 'game') {
      document.title = 'SherlockAI';
      return;
    }

    const activeCaseTitle = cases.find((caseSummary) => caseSummary.id === caseId)?.title;
    if (!activeCaseTitle) {
      document.title = 'SherlockAI';
      return;
    }

    const runLabel = dailyRunDate
      ? `Case of the Day (${dailyRunDate})`
      : difficulty === 'classic'
        ? 'Classic'
        : 'Standard';
    document.title = `${activeCaseTitle} — ${runLabel} | SherlockAI`;
  }, [screen, cases, caseId, dailyRunDate, difficulty]);
  const accusationScopeKey = JSON.stringify([screen, caseId, difficulty, dailyRunDate, sessionId, sessionEpoch]);
  const accusationScopeRef = useRef({ key: accusationScopeKey, generation: 0 });
  useLayoutEffect(() => {
    if (accusationScopeRef.current.key !== accusationScopeKey) {
      accusationScopeRef.current = {
        key: accusationScopeKey,
        generation: accusationScopeRef.current.generation + 1,
      };
    }
  }, [accusationScopeKey]);
  const { room, log, earlierLog, omittedLogCount, logStorageWarning, visitedRooms, nearbyInteraction, recordDialogue, dialogueHistoryByNpc } = useGameEvents(
    caseId,
    sessionId,
    screen === 'game' && sessionReady,
    () => setActiveWorkbench('casefile'),
    sessionRoomId,
  );
  const photoContextRef = useRef({ caseId, sessionId });
  const manualPhotoSequence = useRef(0);
  useLayoutEffect(() => {
    if (photoContextRef.current.caseId !== caseId) setPhotoStorageWarning(false);
    photoContextRef.current = { caseId, sessionId };
    const savedPhotos = readPhotos(caseId);
    photosRef.current = savedPhotos;
    setPhotos(savedPhotos);
  }, [caseId, sessionId]);
  useEffect(() => {
    try {
      localStorage.setItem('sherlock-difficulty', difficulty);
    } catch {
      /* private mode: the choice lasts for this page session */
    }
  }, [difficulty]);

  const closeHowTo = useCallback(() => {
    setShowHowTo(false);
    if (
      screen === 'game' &&
      !paused &&
      !sessionLoading &&
      !sessionError &&
      !engineLoading &&
      !engineError &&
      !activeDialogue &&
      !verdictOverlay
    ) {
      gameEvents.emit({ type: 'RESUME_GAME' });
    }
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
    } catch {
      /* The guide can be shown again when browser storage is unavailable. */
    }
  }, [screen, paused, sessionLoading, sessionError, engineLoading, engineError, activeDialogue, verdictOverlay]);

  useEffect(() => {
    if (sessionId && !sessionLoading && !sessionError && !hasSeenTutorial()) {
      setShowHowTo(true);
    }
  }, [sessionId, sessionLoading, sessionError]);

  useEffect(() => {
    setEvidenceFocus(null);
  }, [caseId]);

  useEffect(() => {
    gameEvents.emit({ type: sessionLoading || sessionError ? 'PAUSE_GAME' : 'RESUME_GAME' });
  }, [sessionLoading, sessionError]);

  useEffect(() => {
    if (screen === 'game' && showHowTo) {
      gameEvents.emit({ type: 'PAUSE_GAME' });
    }
  }, [screen, showHowTo]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (
        document.visibilityState === 'hidden' &&
        screen === 'game' &&
        !sessionLoading &&
        !sessionError &&
        !engineLoading &&
        !engineError &&
        !activeDialogue &&
        !verdictOverlay &&
        !showHowTo &&
        !paused
      ) {
        setPause(true);
      }
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    pauseWhenHidden();
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, [
    screen,
    sessionLoading,
    sessionError,
    engineLoading,
    engineError,
    activeDialogue,
    verdictOverlay,
    showHowTo,
    paused,
    setPause,
  ]);

  useBarks(
    room.roomId,
    world?.npcs ?? [],
    screen === 'game' && !paused && !showHowTo && !activeDialogue && !verdictOverlay && !closed && !sessionLoading && !sessionError && !engineLoading && !engineError,
  );
  const names: Record<string, string> = Object.fromEntries(
    (caseInfo?.npcs ?? []).map((npc) => [npc.id, npc.name]),
  );
  const evidenceTotal = caseInfo?.evidence.length ?? 0;
  const evidenceVersion = JSON.stringify({
    evidence: notebook.map((item) => item.id).sort(),
    known: knowledge.known
      .map((fact) => JSON.stringify([fact.name, fact.args, fact.source ?? null]))
      .sort(),
    derived: knowledge.derived
      .map((item) => JSON.stringify([
        item.fact_id,
        item.rule_id,
        item.fact.name,
        item.fact.args,
        [...item.supports].sort(),
      ]))
      .sort(),
  });
  let sessionStatus = 'Preparing investigation…';
  let sessionStatusColor = 'bg-stone-500';
  if (sessionError) {
    sessionStatus = 'Investigation unavailable';
    sessionStatusColor = 'bg-red-500';
  } else if (sessionReady && closed) {
    sessionStatus = 'Case closed';
    sessionStatusColor = 'bg-emerald-400';
  } else if (sessionReady) {
    sessionStatus = 'Investigation active';
    sessionStatusColor = 'bg-amber-400';
  }

  // A fresh investigation starts the cold streak at zero, but the
  // all-time best per case survives in localStorage.
  useEffect(() => {
    const savedBest = readBestStreak(caseId);
    streakRef.current = 0;
    bestStreakRef.current = savedBest;
    setStreak(0);
    setBestStreak(savedBest);
    setDiscoveryToast(null);
    lastResultRef.current = null;
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, [caseId, sessionId]);

  const appendPhoto = useCallback((snapshotCaseId: string, snapshotSessionId: string, shot: Photo) => {
    const current = photoContextRef.current;
    if (current.caseId !== snapshotCaseId || current.sessionId !== snapshotSessionId) return false;
    const previous = photosRef.current;
    if (previous.some((photo) => photo.id === shot.id)) return false;
    const next = [shot, ...previous].slice(0, MAX_PHOTOS);
    photosRef.current = next;
    setPhotoStorageWarning(!writePhotos(snapshotCaseId, next));
    setPhotos(next);
    return true;
  }, []);

  // Any discovery that adds new facts/derivations keeps the streak alive and
  // pops an auto-dismissing toast in the game view.
  useEffect(() => {
    const result = lastResult;
    if (!result || result.already_discovered || result === lastResultRef.current) return;
    lastResultRef.current = result;
    const nextStreak = streakRef.current + 1;
    streakRef.current = nextStreak;
    setStreak(nextStreak);
    if (nextStreak > bestStreakRef.current) {
      bestStreakRef.current = nextStreak;
      setBestStreak(nextStreak);
      writeBestStreak(caseId, nextStreak);
    }
    setDiscoveryToast({
      id: ++toastId.current,
      evidenceId: result.evidence.id,
      title: result.evidence.title,
      description: result.evidence.description,
    });
    // Photo log: snap the live scene for every fresh discovery.
    const game = gameRef.current;
    const snapshotCaseId = caseId;
    if (game && sessionId) {
      const snapshotSessionId = sessionId;
      void gameApi().then((api) => api.snapshotGame(game)).then((src) => {
        if (!src) return;
        const shot: Photo = {
          id: result.evidence.id,
          src,
          title: result.evidence.title,
          room: result.evidence.location,
          counter: result.event_counter,
        };
        appendPhoto(snapshotCaseId, snapshotSessionId, shot);
      }).catch(() => {
        // A failed optional snapshot must not disrupt evidence discovery.
      });
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setDiscoveryToast(null), 4500);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [appendPhoto, caseId, lastResult, sessionId]);

  useEffect(() => {
    let cancelled = false;
    setCasesLoading(true);
    setCasesError(null);
    api
      .cases()
      .then((list) => {
        if (!cancelled) setCases(list.cases);
      })
      .catch(() => {
        if (!cancelled) setCasesError('Could not load cases. Check that the backend is running, then try again.');
      })
      .finally(() => {
        if (!cancelled) setCasesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [casesRetry]);

  // Refresh the Case of the Day on its UTC boundary while the title screen is
  // open. Pausing the timer during an investigation keeps the active daily
  // session's date and deterministic scene seed stable until the player returns.
  useEffect(() => {
    if (screen !== 'menu') return;
    let cancelled = false;
    let timer: number | null = null;
    const refreshDaily = () => {
      setDailyFetchStatus(daily ? 'refreshing' : 'loading');
      api.daily()
        .then((result) => {
          if (!cancelled) {
            setDaily(result);
            setDailyFetchStatus('ready');
          }
        })
        .catch(() => {
          if (!cancelled) setDailyFetchStatus('error');
        });
    };

    const todayUtc = new Date().toISOString().slice(0, 10);
    if (!daily || daily.date !== todayUtc) refreshDaily();

    const scheduleNextRefresh = () => {
      const now = new Date();
      const nextUtcMidnight = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      );
      timer = window.setTimeout(() => {
        if (cancelled) return;
        refreshDaily();
        scheduleNextRefresh();
      }, Math.max(0, nextUtcMidnight - now.getTime() + 1000));
    };
    scheduleNextRefresh();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [screen, daily?.date, casesRetry, dailyRetry]);

  // Keep each difficulty's progress separately so the selected CTA cannot
  // mistake a solved run in one mode for a solved run in the other.
  useEffect(() => {
    if (screen !== 'menu' || cases.length === 0) return;
    let cancelled = false;
    (async () => {
      const mapResult = readSessionMapWithStatus();
      if (!mapResult.storageAvailable || !mapResult.mapValid) reportSessionStorageFailure();
      const map = mapResult.map;
      const out: Record<string, CaseProgress> = {};
      await Promise.all(
        cases.map(async (c) => {
          if (cancelled) return;
          try {
            const detail = await api.caseDetail(c.id);
            if (cancelled) return;
            const emptyRun = (): ModeProgress => ({
              status: 'fresh',
              evidenceFound: 0,
              evidenceTotal: detail.evidence.length,
              score: null,
            });
            const modes: Record<'standard' | 'classic', ModeProgress> = {
              standard: emptyRun(),
              classic: emptyRun(),
            };
            for (const mode of ['standard', 'classic'] as const) {
              if (cancelled) return;
              const key = `${c.id}:${mode}`;
              const sid = map[key];
              if (!sid) continue;
              try {
                const s = await api.getSession(sid);
                if (cancelled) return;
                const ev = await api.evidence(sid);
                if (cancelled) return;
                const candidate: ModeProgress = {
                  status: s.status === 'complete' ? (s.correct ? 'solved' : 'failed') : 'active',
                  evidenceFound: ev.evidence.length,
                  evidenceTotal: detail.evidence.length,
                  score: s.score,
                };
                modes[mode] = candidate;
              } catch {
                /* stale stored id — ignore */
              }
            }
            out[c.id] = { modes };
          } catch {
            /* case unreachable — skip card data */
          }
        }),
      );
      if (!cancelled) setProgress(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [screen, cases, reportSessionStorageFailure]);

  // The daily payload can roll over independently of regular case data. Keep
  // its selected-difficulty progress isolated so a UTC refresh never reloads
  // every case card. Clear the prior scope before paint so the old date or
  // difficulty cannot appear as current while the new session is loading.
  useLayoutEffect(() => {
    dailyProgressRequestId.current += 1;
    if (screen === 'menu') setDailyProgress(null);
  }, [screen, daily, difficulty]);

  useEffect(() => {
    if (screen !== 'menu') return;
    const requestId = dailyProgressRequestId.current;
    let cancelled = false;
    if (!daily) return () => {
      cancelled = true;
    };

    void (async () => {
      const mapResult = readSessionMapWithStatus();
      if (!mapResult.storageAvailable || !mapResult.mapValid) reportSessionStorageFailure();
      const sid = mapResult.map[`daily:${daily.date}:${daily.id}:${difficulty}`];
      let candidate: ModeProgress | null = null;
      if (sid) {
        try {
          const [s, ev] = await Promise.all([api.getSession(sid), api.evidence(sid)]);
          if (cancelled || requestId !== dailyProgressRequestId.current) return;
          candidate = {
            status: s.status === 'complete' ? (s.correct ? 'solved' : 'failed') : 'active',
            evidenceFound: ev.evidence.length,
            evidenceTotal: daily.evidence,
            score: s.score,
          };
        } catch {
          /* stale daily session — show the challenge as fresh */
        }
      }
      if (!cancelled && requestId === dailyProgressRequestId.current) {
        setDailyProgress(candidate);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, daily, difficulty, reportSessionStorageFailure]);

  useEffect(() => {
    if (screen !== 'game' || !sessionReady || !mountRef.current) {
      setEngineLoading(false);
      return;
    }
    let cancelled = false;
    let game: Phaser.Game | null = null;
    setEngineLoading(true);
    setEngineError(null);
    void gameApi().then((api) => {
      if (cancelled || !mountRef.current) return;
      const dailySeed = dailyRunDate && daily?.date === dailyRunDate ? daily.seed : undefined;
      game = api.createGame(mountRef.current, caseId, room.roomId, dailySeed);
      gameRef.current = game;
      game.events.once('postrender', () => {
        if (!cancelled) setEngineLoading(false);
      });
    }).catch(() => {
      if (!cancelled) {
        setEngineError('Could not load the game. Check your connection and retry.');
        setEngineLoading(false);
      }
    });
    return () => {
      cancelled = true;
      gameRef.current = null;
      if (game) {
        const g: Phaser.Game = game;
        void gameApi().then((api) => api.destroyGame(g));
      }
    };
  }, [screen, caseId, dailyRunDate, daily?.date, daily?.seed, engineRetry, sessionId, sessionReady]);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || screen !== 'game') return;
      if (sessionLoading || sessionError || engineLoading || engineError) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      // Typing in the graph search (or any field) owns Escape itself.
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (showHowTo) {
        closeHowTo();
        return;
      }
      if (activeDialogue || verdictOverlay) return; // those own Esc / demand clicks
      if (!pausedRef.current && document.activeElement === document.body) {
        pauseButtonRef.current?.focus();
      }
      setPause(!pausedRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, showHowTo, activeDialogue, verdictOverlay, sessionLoading, sessionError, engineLoading, engineError, setPause, closeHowTo]);

  // Arrow keys / space scroll the page AND drive the detective: while the
  // game screen owns focus, keep them for movement (form controls exempt).
  useEffect(() => {
    if (screen !== 'game') return;
    const guard = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', guard);
    return () => window.removeEventListener('keydown', guard);
  }, [screen]);

  const startCase = (id: string, fresh: boolean, dailyDate?: string) => {
    const runDate = dailyDate ?? null;
    // Start fetching Phaser only after the player commits to a run, while the
    // server creates or resumes the investigation session.
    void gameApi().catch(() => undefined);
    if (fresh) newInvestigation(id, runDate);
    setCaseId(id);
    setDailyRunDate(runDate);
    setVerdictOverlay(null);
    setPaused(false);
    setScreen('game');
  };

  const retryCases = () => setCasesRetry((n) => n + 1);

  const quitToMenu = () => {
    focusMenuOnEntry.current = true;
    gameEvents.emit({ type: 'RESUME_GAME' });
    setPaused(false);
    setShowHowTo(false);
    setVerdictOverlay(null);
    setScreen('menu');
  };

  useLayoutEffect(() => {
    if (screen !== 'menu' || !focusMenuOnEntry.current) return;
    focusMenuOnEntry.current = false;
    menuRef.current?.focus();
  }, [screen]);

  const manualSnap = useCallback(async (): Promise<boolean> => {
    const game = gameRef.current;
    if (!game || !sessionId) return false;
    const snapshotCaseId = caseId;
    const snapshotSessionId = sessionId;
    const snapshotRoom = room.roomName || 'unknown';
    const snapshotCounter = lastResult?.event_counter ?? 0;
    try {
      const api = await gameApi();
      const src = await api.snapshotGame(game);
      if (!src) return false;
      const shot: Photo = {
        id: `manual-${Date.now()}-${++manualPhotoSequence.current}`,
        src,
        title: 'Field snap',
        room: snapshotRoom,
        counter: snapshotCounter,
      };
      return appendPhoto(snapshotCaseId, snapshotSessionId, shot);
    } catch {
      return false;
    }
  }, [appendPhoto, caseId, sessionId, room.roomName, lastResult?.event_counter]);

  const removePhoto = (id: string): boolean => {
    const snapshotCaseId = caseId;
    const snapshotSessionId = sessionId;
    const current = photoContextRef.current;
    if (current.caseId !== snapshotCaseId || current.sessionId !== snapshotSessionId) return false;
    const next = photosRef.current.filter((photo) => photo.id !== id);
    if (next.length === photosRef.current.length) return false;
    photosRef.current = next;
    setPhotoStorageWarning(!writePhotos(snapshotCaseId, next));
    setPhotos(next);
    return true;
  };

  const restorePhoto = (photo: Photo, index: number): boolean => {
    const snapshotCaseId = caseId;
    const snapshotSessionId = sessionId;
    const current = photoContextRef.current;
    if (current.caseId !== snapshotCaseId || current.sessionId !== snapshotSessionId) return false;
    const previous = photosRef.current;
    if (previous.some((existing) => existing.id === photo.id)) return false;
    const next = [...previous];
    next.splice(Math.min(Math.max(index, 0), next.length), 0, photo);
    const capped = next.slice(0, MAX_PHOTOS);
    photosRef.current = capped;
    setPhotoStorageWarning(!writePhotos(snapshotCaseId, capped));
    setPhotos(capped);
    return true;
  };

  const accuseAndShow = async (suspect: string) => {
    const requestGeneration = accusationScopeRef.current.generation;
    const result = await accuse(suspect);
    if (requestGeneration !== accusationScopeRef.current.generation) return result;
    const starPersistenceFailed = result.correct && !writeBestStars(caseId, starsFor(result));
    setStarStorageWarning(starPersistenceFailed);
    if (!result.correct) resetStreak();
    const discoveredEvidenceIds = new Set(notebook.map((evidence) => evidence.id));
    const allEvidenceFound = Boolean(
      caseInfo?.evidence.length &&
      caseInfo.evidence.every((evidence) => discoveredEvidenceIds.has(evidence.id)),
    );
    const achievementResult = unlockAtVerdict(caseId, result, allEvidenceFound);
    setNewUnlocks(achievementResult.unlocked);
    setAchievementStorageWarning(achievementResult.persistenceFailed);
    gameEvents.emit({ type: 'PAUSE_GAME' });
    setVerdictOverlay(result);
    return result;
  };

  const replay = () => {
    setVerdictOverlay(null);
    resetStreak();
    bestStreakRef.current = 0;
    setBestStreak(0);
    newInvestigation();
  };

  if (screen === 'menu') {
    return (
      <main
        ref={menuRef}
        tabIndex={-1}
        aria-label="Case selection"
        className="min-h-dvh bg-stone-950 text-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-4"
      >
        <MainMenu
          cases={cases}
          casesLoading={casesLoading}
          casesError={casesError}
          onRetryCases={retryCases}
          daily={daily}
          dailyFetchStatus={dailyFetchStatus}
          onRetryDaily={() => setDailyRetry((retry) => retry + 1)}
          dailyProgress={dailyProgress}
          progress={progress}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          muted={muted}
          preferenceStorageWarning={preferenceStorageWarning}
          sessionStorageWarning={sessionStorageWarning}
          onMute={toggleMuted}
          volume={volume}
          onVolume={setVolume}
          onStart={startCase}
          onHowTo={() => setShowHowTo(true)}
        />
        {showHowTo && <HowToPlay onClose={closeHowTo} />}
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="font-pixel mr-1 text-base tracking-tight text-stone-100">SHERLOCK AI</h1>
          <button
            ref={pauseButtonRef}
            onClick={() => setPause(true)}
            disabled={sessionLoading || Boolean(sessionError) || engineLoading || Boolean(engineError) || showHowTo || Boolean(activeDialogue) || Boolean(verdictOverlay)}
            className="min-h-11 rounded border border-stone-700 px-2 py-1 text-sm text-stone-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            title="Pause (Esc)"
            aria-keyshortcuts="Escape"
          >
            Pause
          </button>
          <button
            onClick={toggleMuted}
            className="min-h-11 rounded border border-stone-700 px-2 py-1 text-sm text-stone-300 hover:bg-stone-800"
            aria-pressed={!muted}
            aria-label="Sound effects"
            title="Toggle sound effects"
          >
            Sound: {muted ? 'off' : 'on'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-900 pt-3 text-sm">
          <p className="font-semibold text-stone-100">{caseInfo ? caseTitle(cases, caseId) : 'Loading case…'}</p>
          <p className="text-stone-400">Room <span className="text-stone-200">{room.roomName}</span></p>
          {activeWorkbench !== 'field' && (
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              Current room: {room.roomName}
            </span>
          )}
          <p className="text-stone-400">Evidence <span className="text-stone-200">{notebook.length}/{evidenceTotal || '…'}</span></p>
          <p className="text-stone-400">Clock <span className="text-stone-200">{world ? world.event_counter : '—'}</span></p>
          <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-stone-400">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${sessionStatusColor}`}
            />
            {sessionStatus}
          </span>
        </div>
        {sessionStorageWarning && (
          <p role="status" aria-live="polite" className="mt-2 text-xs text-amber-300">
            Session references could not be read or saved in browser storage. Server-side progress remains intact, but this investigation may not resume after a reload.
          </p>
        )}
      </header>
      <main className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[2fr_1fr] lg:p-6">
        <section className="relative overflow-hidden rounded-lg border border-stone-800">
          <div className="relative">
            <div
              ref={mountRef}
              role="application"
              aria-label="Interactive investigation scene"
              aria-describedby="game-stage-controls"
              tabIndex={0}
              className="aspect-[2/1] max-h-[480px] w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 focus-visible:outline-offset-2"
            />
            <p id="game-stage-controls" className="sr-only">
              Current room: {room.roomName}. Use the arrow keys or WASD to move. Walk to a gold doorway to change rooms. Press E to examine an object or talk to a nearby person, and press Escape to pause. You can also use the nearby action button and the HTML case map outside the game scene.
            </p>
            {engineLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-950/75 text-sm text-stone-200" role="status" aria-live="polite">
                Loading game…
              </div>
            )}
            {engineError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-stone-950/90 p-4 text-center text-sm text-stone-200">
                <p role="alert">{engineError}</p>
                <button
                  className="pixel-btn min-h-11 rounded bg-amber-800 px-4 py-2 font-semibold text-amber-100"
                  onClick={() => setEngineRetry((attempt) => attempt + 1)}
                  autoFocus
                >
                  Retry loading the game
                </button>
                <button
                  className="pixel-btn min-h-11 rounded bg-stone-800 px-4 py-2 text-stone-200"
                  onClick={quitToMenu}
                >
                  Back to cases
                </button>
              </div>
            )}
          </div>
          {!engineLoading && !engineError && !sessionLoading && !sessionError && !paused && !verdictOverlay && !activeDialogue && !closed && (
            <TouchControls />
          )}
          <p className="border-t border-stone-800 px-4 py-2 text-xs text-stone-400">
            Move with arrow keys or WASD · use the D-pad on touch screens · walk into a gold doorway to
            change rooms · near an object or character, press E, use the nearby action button, or tap
            it · Esc pauses
          </p>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {nearbyInteraction
              ? `Nearby interaction available: ${nearbyInteraction.kind === 'npc' ? 'talk to' : 'examine'} ${nearbyInteraction.label}. Activate the nearby action button to begin.`
              : ''}
          </p>
          {nearbyInteraction && !activeDialogue && !paused && !closed && !sessionLoading && !sessionError && !engineLoading && !engineError && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-800 bg-stone-900/70 px-4 py-2">
              <span className="text-sm text-stone-200">Nearby: {nearbyInteraction.label}</span>
              <button
                className="pixel-btn min-h-11 rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100"
                aria-keyshortcuts="E Enter Space"
                onClick={() => gameEvents.emit({ type: 'INTERACT_PRESSED' })}
              >
                {nearbyInteraction.kind === 'npc' ? 'Talk to' : 'Examine'} {nearbyInteraction.label}
              </button>
            </div>
          )}
          {lastError && (
            <p className="border-t border-red-900 bg-red-950 px-4 py-2 text-xs text-red-200" role="alert">
              {lastError}
            </p>
          )}
          {discoveryToast && (
            <div
              key={discoveryToast.id}
              className="anim-toast absolute right-3 top-3 z-10 max-w-xs rounded border-2 border-amber-500 bg-stone-950/95 p-3 shadow-[4px_4px_0_0_#000]"
            >
              <div role="status" aria-live="polite">
                <p className="font-pixel text-[10px] text-amber-300">CLUE DISCOVERED</p>
                <p className="mt-1 text-sm font-semibold text-stone-100">{discoveryToast.title}</p>
                <p className="mt-0.5 text-xs text-stone-300">{discoveryToast.description}</p>
              </div>
              <button
                type="button"
                className="pixel-btn mt-2 min-h-11 rounded bg-amber-900 px-3 py-2 text-xs font-semibold text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                onFocus={() => {
                  if (toastTimer.current) clearTimeout(toastTimer.current);
                }}
                onBlur={() => {
                  toastTimer.current = setTimeout(() => {
                    setDiscoveryToast((current) => current?.id === discoveryToast.id ? null : current);
                  }, 4500);
                }}
                onClick={() => {
                  setEvidenceFocus((previous) => ({
                    caseId,
                    id: discoveryToast.evidenceId,
                    request: (previous?.request ?? 0) + 1,
                  }));
                  setActiveWorkbench('casefile');
                  setDiscoveryToast(null);
                }}
              >
                Open clue in case file
              </button>
            </div>
          )}
        </section>
        <aside className="flex max-h-[640px] min-h-0 flex-col gap-3 overflow-y-auto">
          <ColdStreakMeter streak={streak} />
          <div role="tablist" className="sticky top-0 z-10 grid grid-cols-3 gap-1 rounded-lg border border-stone-800 bg-stone-950 p-1" aria-label="Investigation workspaces">
            {([
              ['casefile', 'Case file', `${notebook.length}/${caseInfo?.evidence.length ?? '…'} finds`],
              ['reasoning', 'Reasoning', `${knowledge.derived.length} deductions`],
              ['field', 'Field kit', `${visitedRooms.length}/${caseInfo?.rooms.length ?? '…'} rooms`],
            ] as const).map(([id, label, detail]) => (
              <button
                key={id}
                type="button"
                id={`workspace-tab-${id}`}
                role="tab"
                aria-selected={activeWorkbench === id}
                aria-controls={`workspace-panel-${id}`}
                tabIndex={activeWorkbench === id ? 0 : -1}
                aria-label={`${label}, ${detail}`}
                onClick={() => setActiveWorkbench(id)}
                onFocus={() => setActiveWorkbench(id)}
                onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                  const tabs = Array.from(
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
                  );
                  const current = tabs.indexOf(event.currentTarget);
                  let next = current;
                  if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
                  else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
                  else if (event.key === 'Home') next = 0;
                  else if (event.key === 'End') next = tabs.length - 1;
                  else return;
                  event.preventDefault();
                  tabs[next]?.focus();
                }}
                className={`rounded px-2 py-2 text-xs font-semibold transition-colors ${
                  activeWorkbench === id
                    ? 'bg-amber-900 text-amber-100'
                    : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
                }`}
              >
                <span className="block">{label}</span>
                <span className={`mt-0.5 block font-mono text-[10px] font-normal ${activeWorkbench === id ? 'text-amber-300' : 'text-stone-400'}`}>
                  {detail}
                </span>
              </button>
            ))}
          </div>

          <section id="workspace-panel-casefile" role="tabpanel" aria-labelledby="workspace-tab-casefile" tabIndex={0} hidden={activeWorkbench !== 'casefile'} className="space-y-3">
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Evidence Notebook ({notebook.length})</h2>
                <EvidenceNotebook
                  key={caseId}
                  items={notebook}
                  caseId={caseId}
                  focusEvidence={evidenceFocus?.caseId === caseId ? evidenceFocus : null}
                />
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Deductions ({knowledge.derived.length})</h2>
                <HypothesisPanel
                  key={`why-${sessionId ?? 'none'}`}
                  sessionId={sessionId}
                  derived={knowledge.derived}
                  evidence={notebook}
                  evidenceVersion={evidenceVersion}
                />
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Compare Suspects</h2>
                {caseInfo ? (
                  <ComparePanel
                    key={`cmp-${sessionId ?? 'none'}`}
                    sessionId={sessionId}
                    suspects={caseInfo.suspects}
                    names={names}
                    evidenceVersion={evidenceVersion}
                    onFocusEvidence={(id) => {
                      setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
                      setActiveWorkbench('casefile');
                    }}
                  />
                ) : <p className="text-sm text-stone-400">Loading case…</p>}
              </div>
              <div className="rounded-lg border border-red-950 bg-stone-950 p-4">
                <h2 className="mb-2 font-semibold">Suspects &amp; Accusation</h2>
                {caseInfo ? (
                  <SuspectPanel
                    key={`sus-${sessionId ?? 'none'}`}
                    sessionId={sessionId}
                    caseId={caseId}
                    suspects={caseInfo.suspects}
                    names={names}
                    closed={closed}
                    onAccuse={accuseAndShow}
                    evidenceVersion={evidenceVersion}
                  />
                ) : <p className="text-sm text-stone-400">Loading case…</p>}
              </div>
          </section>

          <section id="workspace-panel-reasoning" role="tabpanel" aria-labelledby="workspace-tab-reasoning" tabIndex={0} hidden={activeWorkbench !== 'reasoning'} className="space-y-3">
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Evidence Chronology</h2>
                <ChronologyPanel
                  caseId={caseId}
                  knowledge={knowledge}
                  evidence={notebook}
                  people={Object.fromEntries((caseInfo?.npcs ?? []).map((npc) => [npc.id, npc.name]))}
                  rooms={Object.fromEntries((caseInfo?.rooms ?? []).map((room) => [room.id, room.name]))}
                  onFocusEvidence={(id) => {
                    setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
                    setActiveWorkbench('casefile');
                  }}
                />
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Contradictions</h2>
                <ContradictionBoard
                  sessionId={sessionId}
                  version={evidenceVersion}
                  evidence={notebook}
                  onFocusEvidence={(id) => {
                    setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
                    setActiveWorkbench('casefile');
                  }}
                />
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">What-if Sandbox</h2>
                <WhatIfPanel
                  key={`what-if-${sessionId ?? 'none'}`}
                  sessionId={sessionId}
                  caseId={caseId}
                  caseInfo={caseInfo}
                  evidence={notebook}
                  names={names}
                  onFocusEvidence={(id) => {
                    setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
                    setActiveWorkbench('casefile');
                  }}
                />
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Link Finds</h2>
                <LinkPanel key={`link-${sessionId ?? 'none'}`} sessionId={sessionId} evidence={notebook} />
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Case Graph</h2>
                <KnowledgeGraph sessionId={sessionId} version={evidenceVersion} />
              </div>
          </section>

          <section id="workspace-panel-field" role="tabpanel" aria-labelledby="workspace-tab-field" tabIndex={0} hidden={activeWorkbench !== 'field'} className="space-y-3">
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Photo Log ({photos.length})</h2>
                <PhotoLog
                  key={`${caseId}:${sessionId ?? 'none'}`}
                  caseId={caseId}
                  photos={photos}
                  room={room.roomName || 'unknown'}
                  maxPhotos={MAX_PHOTOS}
                  evidenceIds={notebook.map((evidence) => evidence.id)}
                  storageWarning={photoStorageWarning}
                  onManualSnap={manualSnap}
                  onRemove={removePhoto}
                  onRestore={restorePhoto}
                  onFocusEvidence={(id) => {
                    setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
                    setActiveWorkbench('casefile');
                  }}
                />
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">Detective&apos;s Instinct</h2>
                <HintPanel key={sessionId ?? 'none'} sessionId={sessionId} difficulty={meta?.difficulty ?? difficulty} closed={closed} hintsUsed={meta?.hints_used ?? 0} onHintUsed={resetStreak} />
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <h2 className="mb-2 font-semibold">World Guide</h2>
                {caseInfo ? (
                  <WorldGuide
                    caseInfo={caseInfo}
                    world={world}
                    notebook={notebook}
                    caseId={caseId}
                    currentRoomId={room.roomId}
                    visitedRooms={visitedRooms}
                    onFocusEvidence={(id) => {
                      setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
                      setActiveWorkbench('casefile');
                    }}
                  />
                ) : <p className="text-sm text-stone-400">Loading case…</p>}
              </div>
              <div className="rounded-lg border border-stone-800 p-4">
                <InvestigationLogPanel
                  key={`${caseId}:${sessionId ?? 'none'}`}
                  caseId={caseId}
                  recent={log}
                  earlier={earlierLog}
                  omittedCount={omittedLogCount}
                storageWarning={logStorageWarning}
                  onFocusEvidence={(id) => {
                    setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
                    setActiveWorkbench('casefile');
                  }}
                />
              </div>
          </section>
        </aside>
      </main>
      {activeDialogue && sessionId && (
        <DialoguePanel
          key={`${caseId}:${sessionEpoch}:${sessionId}:${activeDialogue.npcId}`}
          sessionId={sessionId}
          caseId={caseId}
          npcId={activeDialogue.npcId}
          npcName={activeDialogue.npcName}
          onVisit={visitDialogue}
          history={dialogueHistoryByNpc[activeDialogue.npcId] ?? []}
          onHistoryEntry={(entry) => recordDialogue(activeDialogue.npcId, activeDialogue.npcName, entry.question, entry.answer)}
          onFocusEvidence={(id) => {
            setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
            setActiveWorkbench('casefile');
            closeDialogue();
          }}
          onClose={closeDialogue}
        />
      )}
      {paused && !verdictOverlay && (
        <PauseMenu
          onResume={() => setPause(false)}
          onHowTo={() => setShowHowTo(true)}
          onRestart={() => {
            setPause(false);
            newInvestigation();
          }}
          onQuit={quitToMenu}
          muted={muted}
          preferenceStorageWarning={preferenceStorageWarning}
          sessionStorageWarning={sessionStorageWarning}
          onMute={toggleMuted}
          volume={volume}
          onVolume={setVolume}
          returnFocusRef={pauseButtonRef}
        />
      )}
      {sessionLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4" role="status" aria-live="polite">
          <p className="pixel-panel rounded bg-stone-950 p-5 text-center text-stone-100">Opening your investigation…</p>
        </div>
      )}
      {sessionError && (
        <SessionErrorDialog error={sessionError} onRetry={retrySession} onBack={quitToMenu} />
      )}
      {showHowTo && !sessionLoading && !sessionError && <HowToPlay onClose={closeHowTo} />}
      {verdictOverlay && (
        <CaseClosedOverlay
          verdict={verdictOverlay}
          streak={bestStreak}
          caseId={caseId}
          unlocks={newUnlocks}
          achievementStorageWarning={achievementStorageWarning}
          starStorageWarning={starStorageWarning}
          onReplay={replay}
          onReview={() => {
            setVerdictOverlay(null);
            gameEvents.emit({ type: 'RESUME_GAME' });
          }}
          onFocusEvidence={(id) => {
            setEvidenceFocus((prev) => ({ caseId, id, request: (prev?.request ?? 0) + 1 }));
            setActiveWorkbench('casefile');
          }}
          onMenu={quitToMenu}
        />
      )}
    </div>
  );
}

function caseTitle(cases: { id: string; title: string }[], caseId: string): string {
  return cases.find((c) => c.id === caseId)?.title ?? 'Blackwood Manor';
}

function SessionErrorDialog({
  error,
  onRetry,
  onBack,
}: {
  error: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { dialogRef, handleKeyDown } = useDialogFocus();
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-error-title"
      aria-describedby="session-error-message"
      onKeyDown={handleKeyDown}
    >
      <div className="pixel-panel w-full max-w-md rounded bg-stone-950 p-5">
        <h2 id="session-error-title" className="font-pixel text-sm text-red-300">INVESTIGATION UNAVAILABLE</h2>
        <p id="session-error-message" className="mt-3 text-sm text-stone-300">{error}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={onRetry} className="pixel-btn min-h-11 flex-1 rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100">Try again</button>
          <button onClick={onBack} className="pixel-btn min-h-11 flex-1 rounded bg-stone-800 px-3 py-2 text-sm text-stone-200">Back to cases</button>
        </div>
      </div>
    </div>
  );
}
