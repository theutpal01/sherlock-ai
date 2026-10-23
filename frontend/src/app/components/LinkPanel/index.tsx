import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, type EvidenceDetail, type LinkResult } from '../../../api/client';

/**
 * Evidence linking: pick two discovered evidence items and test whether
 * they jointly feed a derived conclusion. Read-only — the session is never
 * mutated and only discovered evidence is linkable (backend 404s the rest).
 */
export default function LinkPanel({
  sessionId,
  evidence,
}: {
  sessionId: string | null;
  evidence: EvidenceDetail[];
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [result, setResult] = useState<LinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputContext, setOutputContext] = useState<{
    sessionId: string;
    evidenceKey: string;
    a: string;
    b: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const evidenceKey = JSON.stringify(evidence.map((item) => item.id).sort());
  const currentContext = useRef({ sessionId, evidenceKey });

  useLayoutEffect(() => {
    currentContext.current = { sessionId, evidenceKey };
  }, [sessionId, evidenceKey]);

  useEffect(() => {
    const available = new Set<string>(JSON.parse(evidenceKey));
    requestId.current += 1;
    setA((selected) => (available.has(selected) ? selected : ''));
    setB((selected) => (available.has(selected) ? selected : ''));
    setResult(null);
    setError(null);
    setOutputContext(null);
    setBusy(false);
    return () => {
      requestId.current += 1;
    };
  }, [evidenceKey, sessionId]);

  const run = async () => {
    const available = new Set(evidence.map((item) => item.id));
    if (!sessionId || !available.has(a) || !available.has(b) || a === b || busy) return;
    const requestSessionId = sessionId;
    const requestEvidenceKey = evidenceKey;
    const requestA = a;
    const requestB = b;
    const id = ++requestId.current;
    const isCurrent = () =>
      requestId.current === id &&
      currentContext.current.sessionId === requestSessionId &&
      currentContext.current.evidenceKey === requestEvidenceKey;
    setBusy(true);
    setError(null);
    setResult(null);
    setOutputContext(null);
    try {
      const linked = await api.link(requestSessionId, requestA, requestB);
      if (isCurrent()) {
        setResult(linked);
        setOutputContext({
          sessionId: requestSessionId,
          evidenceKey: requestEvidenceKey,
          a: requestA,
          b: requestB,
        });
      }
    } catch (e) {
      if (isCurrent()) {
        setError(e instanceof Error ? e.message : 'Link test failed');
        setOutputContext({
          sessionId: requestSessionId,
          evidenceKey: requestEvidenceKey,
          a: requestA,
          b: requestB,
        });
      }
    } finally {
      if (isCurrent()) setBusy(false);
    }
  };

  const title = (id: string) => evidence.find((item) => item.id === id)?.title ?? id;
  const optionLabel = (item: EvidenceDetail) =>
    `${item.title} · ${item.location.replace(/[_-]+/g, ' ')}`;
  const readable = (value: string) =>
    value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  const selectClass =
    'min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-1 py-0.5 text-xs text-stone-200';
  const sameEvidence = Boolean(a && b && a === b);
  const availableIds = new Set(evidence.map((item) => item.id));
  const validPair = Boolean(a && b && a !== b && availableIds.has(a) && availableIds.has(b));
  const outputIsCurrent =
    outputContext !== null &&
    outputContext.sessionId === sessionId &&
    outputContext.evidenceKey === evidenceKey &&
    outputContext.a === a &&
    outputContext.b === b;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run();
      }}
    >
      {evidence.length >= 2 ? (
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs text-stone-400">
            First find
            <select
              value={a}
              onChange={(event) => {
                const next = event.target.value;
                setA(next);
                if (next === b) setB('');
                setResult(null);
                setError(null);
                setOutputContext(null);
              }}
              disabled={busy}
              className={selectClass}
            >
              <option value="">— pick —</option>
              {evidence.map((item) => (
                <option key={item.id} value={item.id}>
                  {optionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-400">
            Second find
            <select
              value={b}
              onChange={(event) => {
                setB(event.target.value);
                setResult(null);
                setError(null);
                setOutputContext(null);
              }}
              disabled={busy}
              className={selectClass}
            >
              <option value="">— pick —</option>
              {evidence.map((item) => (
                <option key={item.id} value={item.id} disabled={item.id === a}>
                  {optionLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="mb-2 text-xs text-stone-400">Discover two finds to test a link.</p>
      )}
      {sameEvidence && (
        <p className="mb-2 text-xs text-amber-200" role="status">
          Choose two different finds.
        </p>
      )}
      <button
        type="submit"
        disabled={!sessionId || !validPair || busy}
        className="min-h-11 rounded border border-stone-700 px-2 py-1 text-sm text-stone-200 hover:bg-stone-800 disabled:opacity-60"
      >
        {busy ? 'Testing…' : 'Test link'}
      </button>
      {outputIsCurrent && error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {outputIsCurrent && result && (
        <div className="mt-2 rounded border border-stone-800 bg-stone-900 p-2 text-sm" aria-live="polite">
          {result.linked ? (
            <>
              <p className="text-emerald-300">
                Linked: {title(result.a)} × {title(result.b)}
              </p>
              <ul className="mt-1 space-y-1">
                {result.links.map((link) => (
                  <li key={link.conclusion} className="font-mono text-xs text-stone-300">
                    {readable(link.conclusion)}
                    <span className="text-stone-400"> via {link.via_rules.map(readable).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-stone-400">
              No direct connection between {title(result.a)} and {title(result.b)} — yet.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
