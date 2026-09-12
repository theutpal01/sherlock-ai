import type { CaseSummary } from '../../../api/client';
import { portrait } from '../../../game/art';

const CAST_PORTRAITS = ['player', 'bob', 'mara', 'theo', 'vera', 'otto', 'nell', 'grey', 'kit'];

export interface CaseProgress {
  caseId: string;
  status: 'fresh' | 'active' | 'solved' | 'failed';
  evidenceFound: number;
  evidenceTotal: number;
  score: number | null;
}

/**
 * Title menu: case cards with progress, difficulty pick, start/continue.
 * Nothing here reasons or mutates game state — Start hands off to App.
 */
export default function MainMenu({
  cases,
  progress,
  difficulty,
  onDifficulty,
  onStart,
  onHowTo,
}: {
  cases: CaseSummary[];
  progress: Record<string, CaseProgress>;
  difficulty: 'standard' | 'classic';
  onDifficulty: (d: 'standard' | 'classic') => void;
  onStart: (caseId: string, fresh: boolean) => void;
  onHowTo: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="pixel-panel rounded bg-stone-950 p-6 text-center">
        <p className="font-pixel text-xs text-amber-400">◆ A SYMBOLIC DETECTIVE GAME ◆</p>
        <h1 className="font-pixel mt-3 text-3xl text-stone-100">SHERLOCK AI</h1>
        <div className="mt-3 flex items-end justify-center gap-1" aria-hidden="true">
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
        <p className="mt-3 text-stone-400">
          Examine objects. Question suspects. Let the evidence — not assumptions — name the culprit.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-stone-400">Mode:</span>
          {(['standard', 'classic'] as const).map((d) => (
            <button
              key={d}
              onClick={() => onDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`pixel-btn rounded px-3 py-1 text-sm ${
                difficulty === d ? 'bg-amber-800 text-amber-100' : 'bg-stone-900 text-stone-300'
              }`}
              title={d === 'classic' ? 'No hints, solved score ×2' : 'Hints cost 50 pts'}
            >
              {d === 'standard' ? 'Standard' : 'Classic'}
            </button>
          ))}
          <button
            onClick={onHowTo}
            className="pixel-btn rounded bg-stone-900 px-3 py-1 text-sm text-stone-200"
          >
            How to play
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {cases.map((c) => {
          const p = progress[c.id];
          const started = p && p.status !== 'fresh';
          const replay = p?.status === 'solved' || p?.status === 'failed';
          return (
            <div key={c.id} className="pixel-panel rounded bg-stone-950 p-4">
              <h2 className="font-pixel text-sm text-stone-100">{c.title}</h2>
              <p className="mt-2 min-h-12 text-stone-400">{c.description}</p>
              <p className="mt-2 font-mono text-xs text-stone-500">
                {p?.status === 'solved' && `★ Solved · score ${p.score ?? '—'}`}
                {p?.status === 'failed' && '✗ Accusation failed'}
                {p?.status === 'active' && `In progress · evidence ${p.evidenceFound}/${p.evidenceTotal}`}
                {(!p || p.status === 'fresh') && `${c.evidence} leads · ${c.suspects.length} suspects`}
              </p>
              <button
                onClick={() => onStart(c.id, replay)}
                className="pixel-btn mt-3 w-full rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100"
              >
                {replay ? 'Play again' : started ? 'Continue' : 'Start investigation'}
              </button>
            </div>
          );
        })}
        {cases.length === 0 && (
          <p className="text-stone-500">Loading cases from the backend…</p>
        )}
      </div>
    </div>
  );
}
