import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  fmt,
  type AccuseResult,
  type CaseSummary,
  type DerivedDetail,
  type FactDetail,
} from '../api/client';
import { createGame, destroyGame } from '../game/Game';
import { gameEvents } from '../game/events/bridge';
import CaseClosedOverlay from './components/CaseClosedOverlay';
import DialoguePanel from './components/DialoguePanel';
import EvidenceNotebook from './components/EvidenceNotebook';
import HintPanel from './components/HintPanel';
import HowToPlay from './components/HowToPlay';
import HypothesisPanel from './components/HypothesisPanel';
import KnowledgeGraph from './components/KnowledgeGraph';
import MainMenu, { type CaseProgress } from './components/MainMenu';
import PauseMenu from './components/PauseMenu';
import SuspectPanel from './components/SuspectPanel';
import TouchControls from './components/TouchControls';
import WorldGuide from './components/WorldGuide';
import { useGameEvents } from './hooks/useGameEvents';
import { useGameSounds } from './hooks/useGameSounds';
import { readSessionMap, useSession, writeSessionMap } from './hooks/useSession';

function rankStatus(status: CaseProgress['status']): number {
  return status === 'solved' ? 3 : status === 'failed' ? 2 : status === 'active' ? 1 : 0;
}

/**
 * React shell: title menu → game HUD → pause / case-closed overlays.
 * React never reasons locally and never mutates Phaser state directly
 * (spec section 14) — scene control goes through bridge commands.
 */
export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [caseId, setCaseId] = useState('blackwood_manor');
  const [difficulty, setDifficulty] = useState<'standard' | 'classic'>('standard');
  const [paused, setPaused] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [verdictOverlay, setVerdictOverlay] = useState<AccuseResult | null>(null);
  const [progress, setProgress] = useState<Record<string, CaseProgress>>({});
  const { room, log } = useGameEvents();
  const { muted, toggleMuted } = useGameSounds();
  const session = useSession(caseId, difficulty, screen === 'game');
  const {
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
    activeDialogue,
    closeDialogue,
    visitDialogue,
  } = session;
  const names: Record<string, string> = Object.fromEntries(
    (caseInfo?.npcs ?? []).map((npc) => [npc.id, npc.name]),
  );
  const evidenceTotal = caseInfo?.evidence.length ?? 0;

  useEffect(() => {
    let cancelled = false;
    api
      .cases()
      .then((list) => {
        if (!cancelled) setCases(list.cases);
      })
      .catch(() => {
        /* menu shows its loading fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Menu progress cards: best run per case across difficulties.
  useEffect(() => {
    if (screen !== 'menu' || cases.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = readSessionMap();
      const out: Record<string, CaseProgress> = {};
      await Promise.all(
        cases.map(async (c) => {
          const fresh: CaseProgress = {
            caseId: c.id,
            status: 'fresh',
            evidenceFound: 0,
            evidenceTotal: c.evidence,
            score: null,
          };
          try {
            const detail = await api.caseDetail(c.id);
            fresh.evidenceTotal = detail.evidence.length;
            let best = fresh;
            for (const key of [`${c.id}:standard`, `${c.id}:classic`]) {
              const sid = map[key];
              if (!sid) continue;
              try {
                const s = await api.getSession(sid);
                const ev = await api.evidence(sid);
                const candidate: CaseProgress = {
                  caseId: c.id,
                  status: s.status === 'complete' ? (s.correct ? 'solved' : 'failed') : 'active',
                  evidenceFound: ev.evidence.length,
                  evidenceTotal: detail.evidence.length,
                  score: s.score,
                };
                if (rankStatus(candidate.status) > rankStatus(best.status)) best = candidate;
              } catch {
                /* stale stored id — ignore */
              }
            }
            out[c.id] = best;
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
  }, [screen, cases]);

  useEffect(() => {
    if (screen !== 'game' || !mountRef.current) return;
    const game = createGame(mountRef.current, caseId);
    return () => {
      destroyGame(game);
    };
  }, [screen, caseId]);

  const setPause = useCallback((pause: boolean) => {
    gameEvents.emit({ type: pause ? 'PAUSE_GAME' : 'RESUME_GAME' });
    setPaused(pause);
  }, []);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || screen !== 'game') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      // Typing in the graph search (or any field) owns Escape itself.
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (showHowTo) {
        setShowHowTo(false);
        return;
      }
      if (activeDialogue || verdictOverlay) return; // those own Esc / demand clicks
      setPause(!pausedRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, showHowTo, activeDialogue, verdictOverlay, setPause]);

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

  const startCase = (id: string, fresh: boolean) => {
    if (fresh) {
      // Replaying a closed case must not resume the terminal session.
      const map = readSessionMap();
      delete map[`${id}:${difficulty}`];
      writeSessionMap(map);
    }
    setCaseId(id);
    setVerdictOverlay(null);
    setPaused(false);
    setScreen('game');
  };

  const quitToMenu = () => {
    gameEvents.emit({ type: 'RESUME_GAME' });
    setPaused(false);
    setShowHowTo(false);
    setVerdictOverlay(null);
    setScreen('menu');
  };

  const accuseAndShow = async (suspect: string) => {
    const result = await accuse(suspect);
    setVerdictOverlay(result);
    return result;
  };

  const replay = () => {
    setVerdictOverlay(null);
    newInvestigation();
  };

  if (screen === 'menu') {
    return (
      <div className="min-h-screen flex justify-center items-center bg-stone-950 text-stone-100">
        <MainMenu
          cases={cases}
          progress={progress}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          onStart={startCase}
          onHowTo={() => setShowHowTo(true)}
        />
        {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-pixel text-base tracking-tight text-stone-100">SHERLOCK AI</h1>
          <button
            onClick={() => setPause(true)}
            className="rounded border border-stone-700 px-2 py-1 text-sm text-stone-300 hover:bg-stone-800"
            title="Pause (Esc)"
          >
            Menu
          </button>
          <button
            onClick={toggleMuted}
            className="rounded border border-stone-700 px-2 py-1 text-sm text-stone-300 hover:bg-stone-800"
            aria-pressed={!muted}
            title="Toggle synthesized sound effects"
          >
            Sound: {muted ? 'off' : 'on'}
          </button>
          <p className="text-sm text-stone-400">
            {caseInfo ? caseTitle(cases, caseId) : '…'} · {room.roomName} · clock{' '}
            {world ? world.event_counter : '—'} · evidence {notebook.length}/{evidenceTotal || '…'} ·{' '}
            {sessionError ?? (sessionId ? `session ${sessionId.slice(0, 8)}` : 'starting session…')}
          </p>
        </div>
      </header>
      <main className="grid gap-4 p-6 lg:grid-cols-[2fr_1fr]">
        <section className="relative overflow-hidden rounded-lg border border-stone-800">
          <div ref={mountRef} className="h-[320px] w-full sm:h-[480px]" />
          <TouchControls />
          <p className="border-t border-stone-800 px-4 py-2 text-xs text-stone-500">
            Move with WASD / arrow keys · walk into a gold doorway to change rooms · press E near an
            object to examine it or a character to talk · Esc pauses
          </p>
          {lastError && (
            <p className="border-t border-red-900 bg-red-950 px-4 py-2 text-xs text-red-200" role="alert">
              {lastError}
            </p>
          )}
          {lastResult && !lastResult.already_discovered && (
            <div className="border-t border-amber-900 bg-amber-950 px-4 py-2 text-xs text-amber-100" aria-live="polite">
              <p className="font-semibold">Discovered: {lastResult.evidence.title}</p>
              <p className="text-amber-200">{lastResult.evidence.description}</p>
              {lastResult.new_facts.length > 0 && (
                <p className="mt-1 font-mono text-xs">
                  + {lastResult.new_facts.map((f: FactDetail) => fmt(f)).join(' · ')}
                </p>
              )}
              {lastResult.derived.length > 0 && (
                <p className="mt-1 font-mono text-xs">
                  ⊢ {lastResult.derived.map((d: DerivedDetail) => `${fmt(d.fact)} [${d.rule_id}]`).join(' · ')}
                </p>
              )}
            </div>
          )}
        </section>
        <aside className="flex max-h-[640px] flex-col gap-4 overflow-y-auto">
          <div className="rounded-lg border border-stone-800 p-4">
            <h2 className="mb-2 font-semibold">Evidence Notebook ({notebook.length})</h2>
            <EvidenceNotebook items={notebook} />
          </div>
          <div className="rounded-lg border border-stone-800 p-4">
            <h2 className="mb-2 font-semibold">Deductions ({knowledge.derived.length})</h2>
            <HypothesisPanel
              key={`why-${sessionId ?? 'none'}`}
              sessionId={sessionId}
              derived={knowledge.derived}
            />
          </div>
          <div className="rounded-lg border border-stone-800 p-4">
            <h2 className="mb-2 font-semibold">Detective&apos;s Instinct</h2>
            <HintPanel
              key={sessionId ?? 'none'}
              sessionId={sessionId}
              difficulty={meta?.difficulty ?? difficulty}
              closed={closed}
              hintsUsed={meta?.hints_used ?? 0}
            />
          </div>
          <div className="rounded-lg border border-red-950 bg-stone-950 p-4">
            <h2 className="mb-2 font-semibold">Suspects &amp; Accusation</h2>
            {caseInfo ? (
              <SuspectPanel
                key={`sus-${sessionId ?? 'none'}`}
                sessionId={sessionId}
                suspects={caseInfo.suspects}
                names={names}
                closed={closed}
                onAccuse={accuseAndShow}
              />
            ) : (
              <p className="text-sm text-stone-500">Loading case…</p>
            )}
          </div>
          <div className="rounded-lg border border-stone-800 p-4">
            <h2 className="mb-2 font-semibold">Case Graph</h2>
            <KnowledgeGraph
              sessionId={sessionId}
              version={`${notebook.length}:${knowledge.derived.length}`}
            />
          </div>
          <div className="rounded-lg border border-stone-800 p-4">
            <h2 className="mb-2 font-semibold">World Guide</h2>
            {caseInfo ? (
              <WorldGuide caseInfo={caseInfo} world={world} notebook={notebook} />
            ) : (
              <p className="text-sm text-stone-500">Loading case…</p>
            )}
          </div>
          <div className="rounded-lg border border-stone-800 p-4">
            <h2 className="mb-2 font-semibold">Investigation Log</h2>
            {log.length === 0 ? (
              <p className="text-sm text-stone-500">Walk around to begin…</p>
            ) : (
              <ul className="space-y-1 text-sm text-stone-300">
                {log.map((line, i) => (
                  <li key={i}>· {line}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
      {activeDialogue && sessionId && (
        <DialoguePanel
          sessionId={sessionId}
          npcId={activeDialogue.npcId}
          npcName={activeDialogue.npcName}
          onVisit={visitDialogue}
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
          onMute={toggleMuted}
        />
      )}
      {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}
      {verdictOverlay && (
        <CaseClosedOverlay
          verdict={verdictOverlay}
          onReplay={replay}
          onReview={() => setVerdictOverlay(null)}
          onMenu={quitToMenu}
        />
      )}
    </div>
  );
}

function caseTitle(cases: { id: string; title: string }[], caseId: string): string {
  return cases.find((c) => c.id === caseId)?.title ?? 'Blackwood Manor';
}
