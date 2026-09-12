import { useState } from 'react';
import { api, type AccuseResult } from '../../../api/client';
import { portrait } from '../../../game/art';

interface SuspectState {
  provable: boolean | null;
  why: string | null;
  open: boolean;
}

/**
 * Suspect / hypothesis UI. Provability comes from backward-chaining
 * queries; accusations resolve via onAccuse (the App shows the verdict
 * overlay). Terminal sessions hide the buttons via `closed`.
 */
export default function SuspectPanel({
  sessionId,
  suspects,
  names,
  closed,
  onAccuse,
}: {
  sessionId: string | null;
  suspects: string[];
  names: Record<string, string>;
  closed: { accused: string; correct: boolean } | null;
  onAccuse: (suspect: string) => Promise<AccuseResult>;
}) {
  const [states, setStates] = useState<Record<string, SuspectState>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async (id: string) => {
    const current = states[id] ?? { provable: null, why: null, open: false };
    const open = !current.open;
    setStates((prev) => ({ ...prev, [id]: { ...current, open } }));
    if (open && current.provable === null && sessionId) {
      try {
        const result = await api.query(sessionId, 'possible_suspect', [id]);
        setStates((prev) => ({
          ...prev,
          [id]: { provable: result.success, why: result.why, open: true },
        }));
      } catch {
        setStates((prev) => ({
          ...prev,
          [id]: { provable: null, why: 'Could not reach the reasoning backend.', open: true },
        }));
      }
    }
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

  return (
    <div>
      <ul className="space-y-2">
        {suspects.map((id) => {
          const st = states[id] ?? { provable: null, why: null, open: false };
          return (
            <li key={id} className="rounded border border-stone-800 bg-stone-900 p-2">
              <div className="flex items-center justify-between gap-2">
                <img
                  src={portrait(id)}
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
                  className="flex-1 text-left text-sm font-semibold text-stone-100"
                  onClick={() => void toggle(id)}
                >
                  {names[id] ?? id}{' '}
                  <span className="text-xs font-normal text-stone-500">
                    {st.provable === null
                      ? '· query…'
                      : st.provable
                        ? '· possible suspect'
                        : '· no case yet'}
                  </span>
                </button>
                {!closed && (
                  <button
                    disabled={busy}
                    onClick={() => void accuse(id)}
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      confirm === id
                        ? 'bg-red-700 text-white hover:bg-red-600'
                        : 'border border-red-900 text-red-300 hover:bg-red-950'
                    } disabled:opacity-50`}
                  >
                    {confirm === id ? 'Confirm?' : 'Accuse'}
                  </button>
                )}
              </div>
              {st.open && st.why && (
                <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-snug text-stone-300">
                  {st.provable === null ? '…' : st.why}
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
