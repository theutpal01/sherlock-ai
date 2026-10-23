import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { sound } from '../../../game/sound';

const SEQ_LEN = 3;
const TILE_COUNT = 9;

function readSolved(caseId: string): { ids: string[]; failed: boolean } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(`sherlock-analyzed:${caseId}`);
  } catch {
    return { ids: [], failed: true };
  }
  if (raw === null) return { ids: [], failed: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ids: [], failed: true };
  }
  if (!Array.isArray(parsed)) return { ids: [], failed: true };
  const ids = parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  return {
    ids: [...new Set(ids)],
    failed: parsed.some((id) => typeof id !== 'string' || id.trim().length === 0),
  };
}

function writeSolved(caseId: string, ids: string[]): boolean {
  try {
    const uniqueIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0))];
    localStorage.setItem(`sherlock-analyzed:${caseId}`, JSON.stringify(uniqueIds));
    return true;
  } catch {
    return false;
  }
}

export function isSolved(caseId: string, evidenceId: string): boolean {
  return readSolved(caseId).ids.includes(evidenceId);
}

function markSolved(caseId: string, evidenceId: string): boolean {
  const saved = readSolved(caseId);
  if (saved.failed) return false;
  if (saved.ids.includes(evidenceId)) return true;
  return writeSolved(caseId, [...saved.ids, evidenceId]);
}

/**
 * Optional lab calibration exercise: watch and repeat a tile sequence.
 * Completion is recorded locally as a notebook badge; case reasoning and
 * facts remain owned by the backend.
 */
export default function ForensicsGame({
  caseId,
  evidenceId,
  title,
  onSolved,
}: {
  caseId: string;
  evidenceId: string;
  title: string;
  onSolved: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'failed' | 'done'>('idle');
  const [persistenceWarning, setPersistenceWarning] = useState(() => readSolved(caseId).failed);
  const [sequence, setSequence] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [progress, setProgress] = useState(0);
  const [focusedTile, setFocusedTile] = useState(0);
  const [interrupted, setInterrupted] = useState(false);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const beginButtonRef = useRef<HTMLButtonElement | null>(null);
  const phaseStatusRef = useRef<HTMLParagraphElement | null>(null);
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const completionStatusRef = useRef<HTMLParagraphElement | null>(null);
  const timers = useRef<number[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const resetWhenHidden = () => {
      if (
        document.visibilityState !== 'hidden' ||
        (phaseRef.current !== 'showing' && phaseRef.current !== 'input')
      ) return;

      timers.current.forEach(clearTimeout);
      timers.current = [];
      setLit(null);
      setSequence([]);
      setProgress(0);
      setAnnouncement('');
      setInterrupted(true);
      setPhase('idle');
    };
    document.addEventListener('visibilitychange', resetWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', resetWhenHidden);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (phase === 'showing') phaseStatusRef.current?.focus();
    else if (phase === 'idle' && interrupted) beginButtonRef.current?.focus();
    else if (phase === 'input') {
      setFocusedTile(0);
      tileRefs.current[0]?.focus();
    } else if (phase === 'failed') retryButtonRef.current?.focus();
    else if (phase === 'done') completionStatusRef.current?.focus();
  }, [phase, interrupted]);

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const seq = Array.from({ length: SEQ_LEN }, () => Math.floor(Math.random() * TILE_COUNT));
    setSequence(seq);
    setProgress(0);
    setAnnouncement('');
    setInterrupted(false);
    setPhase('showing');
    seq.forEach((tile, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setLit(tile);
          setAnnouncement(`Step ${i + 1}: tile ${tile + 1}`);
          sound.labTile(tile);
        }, 500 + i * 650),
        window.setTimeout(() => setLit(null), 500 + i * 650 + 450),
      );
    });
    timers.current.push(window.setTimeout(() => setPhase('input'), 500 + seq.length * 650));
  };

  const press = (tile: number) => {
    if (phase !== 'input') return;
    if (tile === sequence[progress]) {
      const next = progress + 1;
      setProgress(next);
      if (next === sequence.length) {
        setPhase('done');
        setPersistenceWarning(!markSolved(caseId, evidenceId));
        sound.labComplete();
        onSolved();
      } else sound.labTile(tile);
    } else {
      sound.labMistake();
      setPhase('failed');
    }
  };

  const moveTileFocus = (event: KeyboardEvent<HTMLButtonElement>, tile: number) => {
    const row = Math.floor(tile / 3);
    const column = tile % 3;
    let next = tile;
    if (event.key === 'ArrowLeft') next = column > 0 ? tile - 1 : tile;
    else if (event.key === 'ArrowRight') next = column < 2 ? tile + 1 : tile;
    else if (event.key === 'ArrowUp') next = row > 0 ? tile - 3 : tile;
    else if (event.key === 'ArrowDown') next = row < 2 ? tile + 3 : tile;
    else return;
    event.preventDefault();
    if (next === tile) return;
    setFocusedTile(next);
    tileRefs.current[next]?.focus();
  };

  if (phase === 'done') {
    return (
      <div className="mt-1">
        <p ref={completionStatusRef} tabIndex={-1} className="text-xs text-emerald-300" role="status">
          Lab exercise complete for this clue.
        </p>
        {persistenceWarning && (
          <p className="mt-1 text-xs text-amber-200" role="status" aria-live="polite">
            This exercise is complete now, but browser storage could not save its completion for a later visit.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1 rounded border border-stone-700 bg-stone-950 p-1.5">
      {persistenceWarning && (
        <p role="status" aria-live="polite" className="mb-1 text-xs text-amber-200">
          Saved lab progress could not be loaded. Completion may not persist across visits.
        </p>
      )}
      {phase === 'idle' && (
        <>
          {interrupted && (
            <p role="status" className="mb-1 text-xs text-amber-200">
              Lab sequence reset when you left the tab. Begin again when ready.
            </p>
          )}
          <button
            ref={beginButtonRef}
            onClick={start}
            aria-label={`Start the lab sequence for ${title}`}
            className="min-h-11 w-full rounded border border-stone-700 px-3 py-2 text-xs text-stone-200 hover:bg-stone-800"
          >
            Begin lab sequence
          </button>
        </>
      )}
      {(phase === 'showing' || phase === 'input') && (
        <>
          <p ref={phaseStatusRef} tabIndex={-1} className="mb-1 text-xs text-stone-400" aria-live="polite">
            {phase === 'showing' ? 'Watch the tiles; notes play when sound is enabled…' : `Repeat it (${progress}/${sequence.length})`}
          </p>
          {phase === 'input' && (
            <p className="mb-1 text-xs text-stone-400">
              Tap a tile, or use the arrow keys and press Enter or Space to choose.
            </p>
          )}
          {phase === 'showing' && (
            <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
          )}
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Forensics sequence tiles">
            {Array.from({ length: TILE_COUNT }, (_, i) => (
              <button
                key={i}
                ref={(element) => { tileRefs.current[i] = element; }}
                onClick={() => press(i)}
                onFocus={() => setFocusedTile(i)}
                onKeyDown={(event) => moveTileFocus(event, i)}
                tabIndex={i === focusedTile ? 0 : -1}
                disabled={phase !== 'input'}
                aria-label={`Tile ${i + 1}`}
                className={`h-11 rounded border text-xs disabled:opacity-100 ${
                  lit === i
                    ? 'border-amber-300 bg-amber-500 text-amber-950'
                    : 'border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-500'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}
      {phase === 'failed' && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-red-300" role="status">Sequence missed — try again.</p>
          <button
            ref={retryButtonRef}
            onClick={start}
            className="min-h-11 shrink-0 rounded border border-stone-700 px-3 py-2 text-xs text-stone-200 hover:bg-stone-800"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
