import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, type AccuseResult } from '../../../api/client';
import { portrait } from '../../../game/portraits';

interface SuspectState {
  provable: boolean | null;
  why: string | null;
  open: boolean;
  loading: boolean;
}

const EMPTY_STATE: SuspectState = { provable: null, why: null, open: false, loading: false };

/**
 * Suspect / hypothesis UI. Provability comes from backward-chaining
 * queries; accusations resolve via onAccuse (the App shows the verdict
 * overlay). Terminal sessions hide the buttons via `closed`.
 */
export default function SuspectPanel({
  sessionId,
  caseId,
  suspects,
  names,
  closed,
  onAccuse,
  evidenceVersion,
}: {
  sessionId: string | null;
  caseId: string;
  suspects: string[];
  names: Record<string, string>;
  closed: { accused: string; correct: boolean } | null;
  onAccuse: (suspect: string) => Promise<AccuseResult>;
  evidenceVersion: string;
}) {
  const [states, setStates] = useState<Record<string, SuspectState>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  const requestIds = useRef(new Map<string, number>());
  const contextKey = JSON.stringify([sessionId, evidenceVersion, suspects]);
  const [statesContext, setStatesContext] = useState(contextKey);
  const contextKeyRef = useRef(contextKey);

  useLayoutEffect(() => {
    contextKeyRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    requestIds.current.clear();
    setStates({});
    setStatesContext(contextKey);
    return () => requestIds.current.clear();
  }, [contextKey]);

  const querySuspect = useCallback(async (id: string) => {
    if (!sessionId || requestIds.current.has(id)) return;
    const requestedContext = contextKey;
    const requestId = ++requestSequence.current;
    requestIds.current.set(id, requestId);
    setStates((previous) => ({
      ...previous,
      [id]: { ...(previous[id] ?? EMPTY_STATE), loading: true, why: null },
    }));
    const isCurrent = () =>
      requestIds.current.get(id) === requestId && contextKeyRef.current === requestedContext;
    try {
      const result = await api.query(sessionId, 'possible_suspect', [id]);
      if (isCurrent()) {
        setStates((previous) => ({
          ...previous,
          [id]: {
            ...(previous[id] ?? EMPTY_STATE),
            provable: result.success,
            why: result.why,
          },
        }));
      }
    } catch {
      if (isCurrent()) {
        setStates((previous) => ({
          ...previous,
          [id]: {
            ...(previous[id] ?? EMPTY_STATE),
            provable: null,
            why: 'Could not reach the reasoning backend.',
          },
        }));
      }
    } finally {
      if (isCurrent()) {
        requestIds.current.delete(id);
        setStates((previous) => ({
          ...previous,
          [id]: { ...(previous[id] ?? EMPTY_STATE), loading: false },
        }));
      }
    }
  }, [contextKey, sessionId]);

  const toggle = (id: string) => {
    const current = (statesContext === contextKey ? states[id] : undefined) ?? EMPTY_STATE;
    const open = !current.open;
    setStates((previous) => ({
      ...previous,
      [id]: { ...(previous[id] ?? EMPTY_STATE), open },
    }));
    if (open && current.provable === null && !current.loading) void querySuspect(id);
  };

  const accuse = async (id: string) => {
    if (confirm !== id) {
      setConfirm(id);
      return;
    }
    setConfirm(null);
    setBusy(true);
    setError(null);
    try {
      await onAccuse(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accusation failed.');
    } finally {
      setBusy(false);
    }
  };

  const visibleStates = statesContext === contextKey ? states : {};

  return (
    <div>
      <ul className="space-y-2">
        {suspects.map((id) => {
          const st = visibleStates[id] ?? EMPTY_STATE;
          return (
            <li key={id} className="rounded border border-stone-800 bg-stone-900 p-2">
              <div className="flex items-center justify-between gap-2">
                <img
                  src={portrait(id, caseId)}
                  alt=""
                  width={40}
                  height={39}
                  className="pixel-img shrink-0 rounded border border-stone-700 bg-stone-950"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <button
                  className="min-h-11 flex-1 text-left text-sm font-semibold text-stone-100"
                  onClick={() => void toggle(id)}
                  aria-expanded={st.open}
                >
                  {names[id] ?? id}{' '}
                  <span className="text-xs font-normal text-stone-400">
                    {st.loading
                      ? '· checking…'
                      : st.provable === null
                        ? st.why
                          ? '· query unavailable'
                          : '· not checked'
                        : st.provable
                          ? '· possible suspect'
                          : '· no case yet'}
                  </span>
                </button>
                {!closed && (
                  <button
                    disabled={busy}
                    onClick={() => void accuse(id)}
                    className={`min-h-11 rounded px-2 py-1 text-xs font-semibold ${
                      confirm === id
                        ? 'bg-red-700 text-white hover:bg-red-600'
                        : 'border border-red-900 text-red-300 hover:bg-red-950'
                    } disabled:opacity-70`}
                  >
                    {confirm === id ? 'Confirm?' : 'Accuse'}
                  </button>
                )}
              </div>
              {st.open && (st.loading || st.why) && (
                <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-snug text-stone-300">
                  {st.loading ? 'Checking suspect against the current evidence…' : st.why}
                </pre>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-2 text-xs text-red-300" role="alert">
          {error}
        </p>
      )}

      {closed && (
        <p className="mt-2 text-xs text-stone-400" aria-live="polite">
          Case closed — accused {names[closed.accused] ?? closed.accused} (
          {closed.correct ? 'correct' : 'incorrect'}).
        </p>
      )}
    </div>
  );
}
