import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError, api, type HintDetail } from '../../../api/client';

/**
 * Detective's instinct: a deterministic, spoiler-free nudge (−50 pts).
 * Hints reference public case structure plus player progress — never
 * hidden facts. Disabled in classic difficulty and closed cases.
 */
export default function HintPanel({
  sessionId,
  difficulty,
  closed,
  hintsUsed,
  onHintUsed,
}: {
  sessionId: string | null;
  difficulty: string;
  closed: { accused: string; correct: boolean } | null;
  hintsUsed: number;
  onHintUsed?: () => void;
}) {
  const [hint, setHint] = useState<HintDetail | null>(null);
  const [used, setUsed] = useState(hintsUsed);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const contextKey = JSON.stringify([sessionId, difficulty, closed?.accused, closed?.correct]);
  const contextKeyRef = useRef(contextKey);
  const requestSequence = useRef(0);

  useLayoutEffect(() => {
    contextKeyRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    setUsed(hintsUsed);
  }, [hintsUsed]);

  useEffect(() => () => {
    requestSequence.current += 1;
  }, []);
  // Parent remounts per session (key={sessionId}), so local state is fresh.

  const ask = async () => {
    if (!sessionId || busy) return;
    const requestedContext = contextKey;
    const requestId = ++requestSequence.current;
    const isCurrent = () =>
      requestSequence.current === requestId && contextKeyRef.current === requestedContext;
    setBusy(true);
    setHint(null);
    setNote(null);
    try {
      const result = await api.hint(sessionId);
      if (isCurrent()) {
        setHint(result.hint);
        setUsed(result.hints_used);
        onHintUsed?.();
      }
    } catch (err) {
      if (isCurrent()) {
        if (err instanceof ApiError && err.status === 404) {
          setNote('No new hint is available right now. Investigate further, then ask again.');
        } else if (err instanceof Error) {
          setNote(err.message);
        } else {
          setNote('Hint failed.');
        }
      }
    } finally {
      if (requestSequence.current === requestId) setBusy(false);
    }
  };

  if (difficulty === 'classic') {
    return (
      <p className="text-sm text-stone-400">
        Hints are disabled in classic difficulty. Score ×2 if you solve it.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          onClick={() => void ask()}
          disabled={!sessionId || busy || closed !== null}
          className="min-h-11 rounded border border-amber-800 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Consulting…' : 'Ask for a hint (−50 pts)'}
        </button>
        <span className="font-mono text-xs text-stone-400">hints used: {used}</span>
      </div>
      {hint && (
        <p className="rounded border border-amber-900 bg-amber-950 p-2 text-xs text-amber-100" aria-live="polite">
          {hint.text}
        </p>
      )}
      {note && !hint && (
        <p className="text-xs text-stone-400" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  );
}
