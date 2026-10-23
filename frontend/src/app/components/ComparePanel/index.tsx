import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, type SuspectComparison } from '../../../api/client';

/**
 * Spoiler-safe side-by-side: provability + citations, never correctness.
 * React never reasons — everything comes from reason/compare.
 */
export default function ComparePanel({
  sessionId,
  suspects,
  names,
  evidenceVersion,
  onFocusEvidence,
}: {
  sessionId: string | null;
  suspects: string[];
  names: Record<string, string>;
  evidenceVersion: string;
  onFocusEvidence: (evidenceId: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(suspects);
  const [rows, setRows] = useState<SuspectComparison[]>([]);
  const [rowsContext, setRowsContext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const suspectsKey = JSON.stringify(suspects);
  const contextKey = JSON.stringify([sessionId, evidenceVersion, suspectsKey]);
  const contextKeyRef = useRef(contextKey);
  const selectionKey = JSON.stringify(selected);
  const outputKey = JSON.stringify([contextKey, selectionKey]);
  const needsMoreSuspects = selected.length < 2;

  useLayoutEffect(() => {
    contextKeyRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    requestId.current += 1;
    const available = new Set<string>(JSON.parse(suspectsKey) as string[]);
    setSelected((current) => current.filter((suspect) => available.has(suspect)));
    setRows([]);
    setRowsContext(null);
    setError(null);
    setErrorContext(null);
    setBusy(false);
    return () => {
      requestId.current += 1;
    };
  }, [contextKey, suspectsKey]);

  const toggle = (suspect: string) => {
    requestId.current += 1;
    setBusy(false);
    setSelected((previous) =>
      previous.includes(suspect)
        ? previous.filter((item) => item !== suspect)
        : [...previous, suspect],
    );
    setRows([]);
    setRowsContext(null);
    setError(null);
    setErrorContext(null);
  };

  const run = async () => {
    if (
      !sessionId ||
      needsMoreSuspects ||
      busy ||
      selected.some((suspect) => !suspects.includes(suspect))
    ) {
      return;
    }
    const id = ++requestId.current;
    const requestedContext = contextKey;
    const requestedOutput = outputKey;
    const requestedSelection = [...selected];
    setBusy(true);
    setRows([]);
    setRowsContext(null);
    setError(null);
    setErrorContext(null);
    try {
      const response = await api.compare(sessionId, requestedSelection);
      if (requestId.current === id && contextKeyRef.current === requestedContext) {
        setRows(response.compared);
        setRowsContext(requestedOutput);
      }
    } catch {
      if (requestId.current === id && contextKeyRef.current === requestedContext) {
        setError('Comparison failed — is the backend running?');
        setErrorContext(requestedOutput);
      }
    } finally {
      if (requestId.current === id) setBusy(false);
    }
  };

  const visibleRows = rowsContext === outputKey ? rows : [];
  const visibleError = errorContext === outputKey ? error : null;
  const hasCurrentResult = rowsContext === outputKey;

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <fieldset className="mb-3 flex flex-wrap gap-2">
          <legend className="mb-2 w-full text-xs text-stone-400">
          Suspects to compare <span className="text-stone-400">({selected.length} selected)</span>
          </legend>
          {suspects.map((suspect) => (
            <label
              key={suspect}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm transition-colors ${
                selected.includes(suspect)
                  ? 'border-amber-800 bg-amber-950/35 text-amber-100'
                  : 'border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-600'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(suspect)}
                disabled={busy}
                onChange={() => toggle(suspect)}
                className="accent-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              />
              {names[suspect] ?? suspect}
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          disabled={!sessionId || needsMoreSuspects || busy}
          className="min-h-11 rounded-sm border border-amber-800 bg-amber-950/30 px-3 py-2 text-sm font-semibold text-amber-100 hover:border-amber-600 hover:bg-amber-950/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Comparing…' : 'Compare selected'}
        </button>
      </form>
      {needsMoreSuspects && (
        <p className="mb-3 mt-2 text-xs leading-relaxed text-stone-400" role="status">
          Choose at least two suspects to see how the discovered clues distinguish them.
        </p>
      )}
      {busy && (
        <p className="text-sm text-stone-300" role="status">
          Comparing suspects…
        </p>
      )}
      <p className="mb-3 max-w-prose text-xs leading-relaxed text-stone-400">
        Results cover only the selected suspects. “Only possible” means no selected rival is established;
        “one of several” means the clues also establish a rival; “not established” means the discovered
        evidence does not support this suspect. This comparison does not identify the culprit.
      </p>
      {visibleError && (
        <p className="text-sm text-red-300" role="alert">
          {visibleError}
        </p>
      )}
      {visibleRows.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {visibleRows.map((row) => {
            const tone = !row.provable
              ? 'border-stone-700 bg-stone-950/40 text-stone-300'
              : row.support_level === 'strong'
                ? 'border-emerald-800 bg-emerald-950/25 text-emerald-200'
                : 'border-amber-800 bg-amber-950/25 text-amber-200';
            const label = !row.provable
              ? 'not established by discovered evidence'
              : row.support_level === 'strong'
                ? 'only possible among selected'
                : 'one of several possible';
            return (
              <li
                key={row.suspect}
                className="rounded-sm border border-stone-800 bg-stone-900 p-3 text-sm"
              >
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-stone-100">
                    {names[row.suspect] ?? row.suspect}
                  </h3>
                  <span className={`rounded-sm border px-2 py-1 text-xs leading-snug ${tone}`}>
                    {label}
                  </span>
                </header>
                {row.supporting.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs text-stone-400">Supporting clues</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {row.supporting.map((clue) => (
                        <li key={clue.id}>
                          <button
                            type="button"
                            onClick={() => onFocusEvidence(clue.id)}
                            className="inline-flex min-h-11 items-center rounded-sm border border-stone-700 px-2 text-left text-xs text-stone-200 underline decoration-amber-800 underline-offset-2 hover:border-amber-700 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                          >
                            {clue.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {row.contradicting.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs text-stone-400">Evidence supporting a selected rival</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {row.contradicting.map((clue) => (
                        <li key={clue.id}>
                          <button
                            type="button"
                            onClick={() => onFocusEvidence(clue.id)}
                            className="inline-flex min-h-11 items-center rounded-sm border border-stone-700 px-2 text-left text-xs text-stone-200 underline decoration-amber-800 underline-offset-2 hover:border-amber-700 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                          >
                            {clue.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-3 border-l-2 border-stone-700 pl-3 text-sm leading-relaxed text-stone-300">
                  {row.why}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {!busy && hasCurrentResult && visibleRows.length === 0 && (
        <p className="text-sm text-stone-300" role="status">
          No comparison results are available for this selection.
        </p>
      )}
    </div>
  );
}
