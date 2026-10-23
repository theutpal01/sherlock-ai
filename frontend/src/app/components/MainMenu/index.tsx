import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CaseSummary, DailyCase } from '../../../api/client';
import { ACHIEVEMENTS, readUnlocked } from '../../achievements';
import { portrait } from '../../../game/portraits';
import { readBestStars } from '../../verdictStars';
import SaveDataTransfer from '../SaveDataTransfer';
import RatingStars from '../RatingStars';

const CAST_PORTRAITS = [
  'player',
  'bob',
  'mara',
  'theo',
  'vera',
  'otto',
  'nell',
  'grey',
  'kit',
  'finn',
  'odda',
  'corwin',
  'cook',
  'stablehand',
  'celia',
  'rowan',
  'ada',
  'arthur',
];
const CASE_DISPLAY_ORDER = [
  'starfall_observatory',
  'glasshouse_orchid',
  'midnight_mail',
];

function orderCasesForMenu(cases: CaseSummary[]): CaseSummary[] {
  const rank = new Map(CASE_DISPLAY_ORDER.map((id, index) => [id, index]));
  return [...cases].sort(
    (a, b) => (rank.get(a.id) ?? CASE_DISPLAY_ORDER.length) - (rank.get(b.id) ?? CASE_DISPLAY_ORDER.length),
  );
}
const CASE_ART_ALT: Record<string, string> = {
  blackwood_manor: 'A gothic manor behind iron gates under a full moon.',
  holloway_theatre: 'An empty theater stage framed by red curtains and rows of seats.',
  saltmarsh_lighthouse: 'A lighthouse on a rocky coast amid stormy surf.',
  starfall_observatory: 'A remote observatory beneath a brilliant meteor shower.',
  glasshouse_orchid: 'A moonlit orchid waits in a rain-streaked Victorian glasshouse.',
  midnight_mail: 'A sealed diplomatic dispatch has vanished aboard a fogbound midnight express.',
};

function caseArtStyle(caseId: string): CSSProperties {
  const dedicatedArt: Record<string, string> = {
    blackwood_manor: 'blackwood-manor',
    holloway_theatre: 'holloway-theatre',
    saltmarsh_lighthouse: 'saltmarsh-lighthouse',
    starfall_observatory: 'starfall-observatory',
    glasshouse_orchid: 'glasshouse-orchid',
    midnight_mail: 'midnight-mail',
  };
  if (dedicatedArt[caseId]) {
    return {
      backgroundImage: `url(/assets/cases/${dedicatedArt[caseId]}.webp)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {
    backgroundImage: 'url(/assets/cases/case-triptych.webp)',
    backgroundSize: '300% 100%',
    backgroundPosition: '0% center',
  };
}

export interface ModeProgress {
  status: 'fresh' | 'active' | 'solved' | 'failed';
  evidenceFound: number;
  evidenceTotal: number;
  score: number | null;
}

export interface CaseProgress {
  modes: Record<'standard' | 'classic', ModeProgress>;
}

/**
 * Title menu: case cards with progress, difficulty pick, start/continue.
 * Nothing here reasons or mutates game state — Start hands off to App.
 */
export default function MainMenu({
  cases,
  casesLoading,
  casesError,
  onRetryCases,
  daily,
  dailyFetchStatus,
  onRetryDaily,
  dailyProgress,
  progress,
  difficulty,
  onDifficulty,
  muted,
  preferenceStorageWarning,
  sessionStorageWarning,
  onMute,
  volume,
  onVolume,
  onStart,
  onHowTo,
}: {
  cases: CaseSummary[];
  casesLoading: boolean;
  casesError: string | null;
  onRetryCases: () => void;
  daily: DailyCase | null;
  dailyFetchStatus: 'loading' | 'ready' | 'refreshing' | 'error';
  onRetryDaily: () => void;
  dailyProgress: ModeProgress | null;
  progress: Record<string, CaseProgress>;
  difficulty: 'standard' | 'classic';
  onDifficulty: (d: 'standard' | 'classic') => void;
  muted: boolean;
  preferenceStorageWarning: boolean;
  sessionStorageWarning: boolean;
  onMute: () => void;
  volume: number;
  onVolume: (volume: number) => void;
  onStart: (caseId: string, fresh: boolean, dailyDate?: string) => void;
  onHowTo: () => void;
}) {
  const dailyCardRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const [retryFocusPending, setRetryFocusPending] = useState(false);
  const dailyModeProgress = dailyProgress;
  const dailyStatus = dailyModeProgress?.status ?? 'fresh';
  const dailyReplay = dailyStatus === 'solved' || dailyStatus === 'failed';
  const dailyAction = dailyStatus === 'active'
    ? 'Continue daily case'
    : dailyReplay ? 'Replay daily case' : 'Open daily case';
  const dailyIsCurrent = Boolean(
    daily && dailyFetchStatus === 'ready' && daily.date === new Date().toISOString().slice(0, 10),
  );
  const dailyFetchMessage = dailyFetchStatus === 'loading' && !daily
    ? "Loading today's Case of the Day…"
    : dailyFetchStatus === 'refreshing'
      ? 'Updating the Case of the Day for the current UTC date…'
      : dailyFetchStatus === 'error'
        ? daily
          ? `Could not refresh the Case of the Day. The displayed date, ${daily.date}, is the last available.`
          : "Could not load today's Case of the Day."
        : daily && !dailyIsCurrent
          ? 'Updating the Case of the Day for the current UTC date…'
          : '';

  useEffect(() => {
    if (!retryFocusPending || dailyFetchStatus !== 'ready' || !dailyIsCurrent) return;
    dailyCardRef.current?.focus();
    setRetryFocusPending(false);
  }, [dailyFetchStatus, dailyIsCurrent, retryFocusPending]);

  const unlocked = readUnlocked();
  const earnedBadgeCount = ACHIEVEMENTS.filter((achievement) => unlocked.has(achievement.id)).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <a
        href="#case-archive"
        className="pixel-btn mb-4 inline-flex min-h-11 items-center rounded border border-amber-700 bg-stone-900 px-4 py-2 font-semibold text-amber-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        {cases.length > 0 ? `BROWSE ALL ${cases.length} CASES ↓` : 'BROWSE CASES ↓'}
      </a>
      <div className="pixel-panel anim-sheen rounded bg-stone-950 p-6 text-center">
        <p className="anim-fade-up font-pixel text-xs text-amber-400">
          <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 rotate-45 bg-amber-400 align-middle" />
          A SYMBOLIC DETECTIVE GAME
          <span aria-hidden="true" className="ml-2 inline-block h-1.5 w-1.5 rotate-45 bg-amber-400 align-middle" />
        </p>
        <h1 className="anim-fade-up font-pixel mt-3 text-3xl text-stone-100" style={{ animationDelay: '0.08s' }}>
          SHERLOCK AI
        </h1>
        <div
          className="anim-fade-up mx-auto mt-3 grid w-fit grid-cols-7 justify-items-center gap-1"
          style={{ animationDelay: '0.16s' }}
          aria-hidden="true"
        >
          {CAST_PORTRAITS.map((id) => (
            <img
              key={id}
              src={portrait(id)}
              alt=""
              width={36}
              height={35}
              className="pixel-img rounded-sm border border-stone-800 bg-stone-900"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ))}
        </div>
        <p className="anim-fade-up mt-3 text-stone-400" style={{ animationDelay: '0.24s' }}>
          Examine objects. Question suspects. Let the evidence — not assumptions — name the culprit.
        </p>
        <div
          className="anim-fade-up mt-4 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: '0.32s' }}
        >
          <div role="group" aria-label="Investigation difficulty" className="flex flex-wrap items-center gap-3">
            <span className="text-stone-400">Mode:</span>
            {(['standard', 'classic'] as const).map((d) => (
              <button
                key={d}
                onClick={() => onDifficulty(d)}
                aria-pressed={difficulty === d}
                aria-label={d === 'classic'
                  ? 'Classic. Hints are disabled and a correct verdict doubles the score.'
                  : 'Standard. Hints are available and each hint costs 50 points.'}
                className={`pixel-btn min-h-11 rounded px-3 py-1 text-sm ${
                  difficulty === d ? 'bg-amber-800 text-amber-100' : 'bg-stone-900 text-stone-300'
                }`}
                title={d === 'classic' ? 'No hints; double score for correct verdicts' : 'Hints cost 50 points'}
              >
                {d === 'standard' ? 'Standard' : 'Classic'}
              </button>
            ))}
          </div>
          <button
            onClick={onHowTo}
            className="pixel-btn min-h-11 rounded bg-stone-900 px-3 py-1 text-sm text-stone-200"
          >
            How to play
          </button>
          <button
            onClick={onMute}
            className="pixel-btn min-h-11 rounded bg-stone-900 px-3 py-1 text-sm text-stone-200"
            aria-pressed={!muted}
            aria-label="Sound effects"
            title="Toggle sound effects"
          >
            Sound: {muted ? 'off' : 'on'}
          </button>
          <label className="flex min-h-11 items-center gap-2 rounded bg-stone-900 px-3 py-1 text-sm text-stone-200">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => onVolume(Number(event.currentTarget.value))}
              aria-label="Sound effects volume"
              aria-valuetext={`${Math.round(volume * 100)} percent`}
              className="h-11 w-24 accent-amber-500"
            />
            <span className="min-w-8 text-right font-mono text-xs">{Math.round(volume * 100)}%</span>
          </label>
        </div>
        {preferenceStorageWarning && (
          <p role="status" aria-live="polite" className="mt-3 text-xs text-amber-300">
            Sound settings are active now, but browser storage is unavailable; they may reset after reload.
          </p>
        )}
        {sessionStorageWarning && (
          <div className="mt-2 text-xs text-amber-300">
            <p role="status" aria-live="polite">
              Session references could not be read or saved in browser storage. Server-side progress remains intact, but saved investigations may not resume after a reload.
            </p>
            <a
              href="#browser-data-backup"
              className="mt-1 inline-flex min-h-11 items-center font-semibold text-amber-200 underline decoration-amber-700 underline-offset-4 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Go to browser data backup
            </a>
          </div>
        )}
      </div>

      <p className="anim-fade-up mt-5 text-center font-pixel text-xs text-amber-400" style={{ animationDelay: '0.4s' }}>
        <span className="anim-press-blink">PRESS A CASE TO BEGIN</span>
      </p>

      {daily && (
        <button
          ref={dailyCardRef}
          type="button"
          onClick={() => {
            if (!dailyIsCurrent || daily.date !== new Date().toISOString().slice(0, 10)) return;
            onStart(daily.id, dailyReplay, daily.date);
          }}
          aria-disabled={!dailyIsCurrent}
          aria-label={dailyIsCurrent
            ? `${dailyAction}: ${daily.title}`
            : dailyFetchStatus === 'error'
              ? `Case of the Day for ${daily.date}; its current-day version could not be loaded`
              : `Case of the Day for ${daily.date}; updating to the current UTC date`}
          className={`pixel-panel anim-fade-up mt-4 flex w-full flex-col gap-3 rounded border bg-stone-950 p-4 text-left sm:flex-row sm:items-center ${dailyIsCurrent ? 'border-amber-700' : 'cursor-wait border-stone-700 opacity-80'}`}
          style={{ animationDelay: '0.42s' }}
        >
          {dailyIsCurrent ? (
            <>
              <span
                aria-hidden="true"
                className="pixel-img aspect-square w-24 shrink-0 rounded border border-stone-700 bg-stone-900 bg-no-repeat"
                style={caseArtStyle(daily.id)}
              />
              <span className="min-w-0">
                <span className="block font-pixel text-xs text-amber-400">
                  <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 rotate-45 bg-amber-400 align-middle" />
                  CASE OF THE DAY · {daily.date}
                </span>
                <span className="mt-2 block font-pixel text-sm text-stone-100">{daily.title}</span>
                <span className="mt-1 block text-sm text-stone-400">{daily.description}</span>
                <span className="mt-2 block font-mono text-xs text-stone-400">
                  {dailyStatus === 'active' && `In progress · evidence ${dailyModeProgress?.evidenceFound ?? 0}/${dailyModeProgress?.evidenceTotal ?? daily.evidence}`}
                  {dailyStatus === 'solved' && `Solved · score ${dailyModeProgress?.score ?? '—'}`}
                  {dailyStatus === 'failed' && 'Last accusation failed'}
                  {dailyStatus === 'fresh' && `${daily.evidence} leads · ${daily.suspects.length} suspects`}
                </span>
                <span className="mt-2 block text-xs font-semibold text-amber-300">{dailyAction}</span>
              </span>
            </>
          ) : (
            <span className="min-h-24 min-w-0 self-center">
              <span className="block font-pixel text-xs text-amber-400">CASE OF THE DAY</span>
              <span className="mt-2 block text-sm text-stone-300">
                {dailyFetchStatus === 'error' ? `The ${daily.date} case is unavailable.` : "Updating today's case…"}
              </span>
            </span>
          )}
        </button>
      )}
      {dailyFetchMessage && (
        <div className="mt-2">
          <p role="status" aria-live="polite" className="text-sm text-amber-300">{dailyFetchMessage}</p>
          {(dailyFetchStatus === 'error' || dailyFetchStatus === 'refreshing' || retryFocusPending) && (
            <button
              ref={retryButtonRef}
              type="button"
              aria-disabled={dailyFetchStatus !== 'error'}
              onClick={() => {
                if (dailyFetchStatus !== 'error') return;
                setRetryFocusPending(document.activeElement === retryButtonRef.current);
                onRetryDaily();
              }}
              onBlur={(event) => {
                if (event.relatedTarget instanceof HTMLElement && !event.currentTarget.contains(event.relatedTarget)) {
                  setRetryFocusPending(false);
                }
              }}
              className="mt-1 min-h-11 rounded px-2 text-sm text-amber-200 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              {dailyFetchStatus === 'refreshing' ? 'Retrying Case of the Day…' : 'Retry Case of the Day'}
            </button>
          )}
        </div>
      )}

      <section id="case-archive" className="mt-6 scroll-mt-4" aria-labelledby="case-archive-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="case-archive-title" className="font-pixel text-xs text-amber-400">AVAILABLE CASES</h2>
          {cases.length > 0 && (
            <span className="font-mono text-xs text-stone-400">{cases.length} investigations</span>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
        {orderCasesForMenu(cases).map((c, idx) => {
          const p = progress[c.id];
          const modeProgress = p?.modes[difficulty];
          const status = modeProgress?.status ?? 'fresh';
          const bestStars = readBestStars(c.id);
          const replay = status === 'solved' || status === 'failed';
          const otherDifficulty = difficulty === 'standard' ? 'classic' : 'standard';
          const otherModeProgress = p?.modes[otherDifficulty];
          const otherModeName = otherDifficulty === 'classic' ? 'Classic' : 'Standard';
          const otherModeActive = otherModeProgress?.status === 'active' && status !== 'active';
          const action = !p
            ? 'Open investigation'
            : replay ? 'Play again' : status === 'active' ? 'Continue' : 'Start investigation';
          return (
            <div
              key={c.id}
              className="pixel-panel case-card anim-fade-up rounded bg-stone-950 p-4"
              style={{ animationDelay: `${0.44 + idx * 0.1}s` }}
            >
              <div
                role="img"
                aria-label={CASE_ART_ALT[c.id] ?? `${c.title} case artwork`}
                className="pixel-img mb-3 aspect-square rounded border border-stone-800 bg-stone-900 bg-no-repeat"
                style={caseArtStyle(c.id)}
              />
              <h2 className="font-pixel text-sm text-stone-100">{c.title}</h2>
              <p className="mt-2 min-h-12 text-stone-400">{c.description}</p>
              <p className="mt-2 font-mono text-xs text-stone-400">
                {status === 'solved' && `Solved · score ${modeProgress?.score ?? '—'}`}
                {status === 'failed' && 'Accusation failed'}
                {status === 'active' && `In progress · evidence ${modeProgress?.evidenceFound ?? 0}/${modeProgress?.evidenceTotal ?? c.evidence}`}
                {status === 'fresh' && `${c.evidence} leads · ${c.suspects.length} suspects`}
              </p>
              {otherModeProgress?.status === 'solved' && otherModeProgress.score !== null && (
                <p className="mt-1 font-mono text-xs text-stone-400">
                  {otherModeName} solved · score {otherModeProgress.score}
                </p>
              )}
              {otherModeProgress?.status === 'failed' && (
                <p className="mt-1 font-mono text-xs text-stone-400">
                  {otherModeName} accusation failed
                </p>
              )}
              {otherModeActive && (
                <p className="mt-1 font-mono text-xs text-amber-300">
                  {otherModeName} investigation in progress
                </p>
              )}
              {bestStars > 0 && (
                <p className="mt-1 font-mono text-xs text-amber-300">
                  <RatingStars value={bestStars} label={`${bestStars} of 3 stars`} />
                  <span className="ml-2 text-stone-400">Best verdict</span>
                </p>
              )}
              <button
                onClick={() => onStart(c.id, replay)}
                aria-label={`${action}: ${c.title}`}
                className="pixel-btn mt-3 min-h-11 w-full rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100"
              >
                {action}
              </button>
            </div>
          );
        })}
        {cases.length === 0 && casesLoading && (
          <p className="text-stone-400" role="status" aria-live="polite">Loading cases…</p>
        )}
        {cases.length === 0 && casesError && (
          <div className="col-span-full rounded border border-red-900 bg-red-950/50 p-4" role="alert">
            <p className="text-sm text-red-200">{casesError}</p>
            <button onClick={onRetryCases} className="pixel-btn mt-3 min-h-11 rounded bg-stone-800 px-3 py-2 text-sm text-stone-100">
              Retry loading cases
            </button>
          </div>
        )}
        {cases.length === 0 && !casesLoading && !casesError && (
          <div className="col-span-full rounded border border-stone-700 bg-stone-950 p-4" role="status">
            <p className="font-pixel text-xs text-stone-200">No cases are available right now.</p>
            <p className="mt-2 text-sm text-stone-400">Check back with the case desk to try loading the archive again.</p>
            <button onClick={onRetryCases} className="pixel-btn mt-3 min-h-11 rounded bg-amber-800 px-3 py-2 text-sm text-amber-100">
              Check again
            </button>
          </div>
        )}
        </div>
      </section>

      <div className="pixel-panel mt-6 rounded bg-stone-950 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-pixel text-xs text-amber-400">BADGES</h2>
          <span
            className="font-mono text-xs text-stone-400"
            aria-label={`${earnedBadgeCount} of ${ACHIEVEMENTS.length} badges earned`}
          >
            {earnedBadgeCount}/{ACHIEVEMENTS.length} earned
          </span>
        </div>
        <ul className="mt-2 space-y-1">
          {ACHIEVEMENTS.map((a) => {
            const has = unlocked.has(a.id);
            return (
              <li key={a.id} className={`flex items-start gap-2 text-sm ${has ? 'text-amber-100' : 'text-stone-400'}`}>
                <svg
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                  shapeRendering="crispEdges"
                  className={`mt-0.5 shrink-0 ${has ? 'text-amber-300' : 'text-stone-500'}`}
                >
                  {has ? (
                    <g fill="currentColor">
                      <rect x="4" y="1" width="8" height="2" />
                      <rect x="3" y="3" width="10" height="2" />
                      <rect x="4" y="5" width="8" height="2" />
                      <rect x="5" y="7" width="6" height="2" />
                      <rect x="2" y="3" width="2" height="3" />
                      <rect x="1" y="5" width="3" height="2" />
                      <rect x="3" y="7" width="3" height="2" />
                      <rect x="12" y="3" width="2" height="3" />
                      <rect x="12" y="5" width="3" height="2" />
                      <rect x="10" y="7" width="3" height="2" />
                      <rect x="7" y="9" width="2" height="4" />
                      <rect x="4" y="13" width="8" height="2" />
                    </g>
                  ) : (
                    <g fill="currentColor">
                      <rect x="5" y="1" width="6" height="2" />
                      <rect x="3" y="3" width="2" height="4" />
                      <rect x="11" y="3" width="2" height="4" />
                      <path d="M2 7h12v8H2zM7 9h2v4H7z" fillRule="evenodd" />
                    </g>
                  )}
                </svg>
                <span className="min-w-0">
                  <span className="sr-only">{has ? 'Earned: ' : 'Locked: '}</span>
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-stone-400"> — {a.desc}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <SaveDataTransfer />
    </div>
  );
}
