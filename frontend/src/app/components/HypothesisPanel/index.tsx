import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  api,
  fmt,
  type DerivedDetail,
  type EvidenceDetail,
  type ProofNodeDetail,
  type QueryResult,
} from '../../../api/client';

function ProofBranch({
  node,
  evidenceById,
}: {
  node: ProofNodeDetail;
  evidenceById: Map<string, EvidenceDetail>;
}) {
  const evidence = node.source ? evidenceById.get(node.source) : undefined;
  const origin = node.rule_id
    ? `Rule ${node.rule_id}`
    : evidence
      ? 'Observed in evidence'
      : node.category === 'case'
        ? 'Case file'
        : node.source
          ? `Source: ${node.source}`
          : 'Known fact';

  return (
    <li className="border-l border-stone-700 pl-3">
      <p className="font-mono text-xs text-stone-200">{fmt(node.goal)}</p>
      <p className="mt-0.5 text-xs text-stone-400">
        {origin}
        {evidence && (
          <>
            {' · '}
            <a
              href={`#evidence-${evidence.id}`}
              className="text-amber-300 underline decoration-amber-800 underline-offset-2 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              View {evidence.title}
            </a>
          </>
        )}
      </p>
      {node.children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {node.children.map((child, index) => (
            <ProofBranch key={`${child.fact_id ?? child.rule_id ?? fmt(child.goal)}-${index}`} node={child} evidenceById={evidenceById} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Deductions and their backend-generated proof trees, linked to discovered evidence. */
export default function HypothesisPanel({
  sessionId,
  derived,
  evidence,
  evidenceVersion,
}: {
  sessionId: string | null;
  derived: DerivedDetail[];
  evidence: EvidenceDetail[];
  evidenceVersion: string;
}) {
  const [proofs, setProofs] = useState<Record<string, QueryResult>>({});
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const contextKey = JSON.stringify([sessionId, evidenceVersion]);
  const [proofsContext, setProofsContext] = useState(contextKey);
  const contextKeyRef = useRef(contextKey);
  const requestGeneration = useRef(0);
  const evidenceById = new Map<string, EvidenceDetail>(
    evidence.map((item) => [item.id, item] as const),
  );
  const query = filter.trim().toLowerCase();
  const visibleDerived = derived.filter((item) =>
    `${fmt(item.fact)} ${item.rule_id ?? ''}`.toLowerCase().includes(query),
  );

  useLayoutEffect(() => {
    contextKeyRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    requestGeneration.current += 1;
    setProofs({});
    setChecks({});
    setLoading({});
    setErrors({});
    setOpen(null);
    setProofsContext(contextKey);
    return () => {
      requestGeneration.current += 1;
    };
  }, [contextKey]);

  if (derived.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        No deductions yet. Discover evidence and the engine will reason from what you found.
      </p>
    );
  }

  const askWhy = async (d: DerivedDetail) => {
    const key = fmt(d.fact);
    if (open === key) {
      setOpen(null);
      return;
    }
    setOpen(key);
    if (proofs[key] || loading[key] || !sessionId) return;
    const requestedContext = contextKey;
    const generation = requestGeneration.current;
    const isCurrent = () =>
      requestGeneration.current === generation && contextKeyRef.current === requestedContext;
    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
    try {
      const result = await api.query(sessionId, d.fact.name, d.fact.args);
      if (!isCurrent()) return;
      setProofs((prev) =>
        isCurrent() ? { ...prev, [key]: result } : prev,
      );
      if (result.success) {
        api
          .resolution(sessionId, d.fact.name, d.fact.args)
          .then((ref) => {
            if (!isCurrent()) return;
            setChecks((prev) =>
              isCurrent()
                ? {
                    ...prev,
                    [key]: ref.success
                      ? `Independently verified (${ref.steps.length} resolution steps).`
                      : 'The independent proof check disagreed; this result needs review.',
                  }
                : prev,
            );
          })
          .catch(() => {
            /* The primary proof remains available if the cross-check fails. */
          });
      }
    } catch {
      if (isCurrent()) {
        setErrors((prev) =>
          isCurrent() ? { ...prev, [key]: 'Could not load this proof. Try again.' } : prev,
        );
      }
    } finally {
      if (isCurrent()) {
        setLoading((prev) => (isCurrent() ? { ...prev, [key]: false } : prev));
      }
    }
  };

  return (
    <div>
      <label className="mb-2 block text-xs text-stone-400">
        Find a deduction
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && filter) {
              event.preventDefault();
              setFilter('');
            }
          }}
          placeholder="Search conclusions or rule IDs…"
          className="min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-3 py-1 text-xs text-stone-200"
        />
      </label>
      {filter && <p className="mb-2 text-xs text-stone-400" role="status">Showing {visibleDerived.length} of {derived.length} deductions.</p>}
      {visibleDerived.length > 0 ? <ul className="space-y-2">
      {visibleDerived.map((d) => {
        const key = fmt(d.fact);
        const currentContext = proofsContext === contextKey;
        const result = currentContext ? proofs[key] : undefined;
        const isOpen = currentContext && open === key;
        return (
          <li key={d.fact_id} className="rounded border border-stone-800 bg-stone-900 p-2">
            <button
              className="min-h-11 w-full rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
              onClick={() => void askWhy(d)}
              aria-expanded={isOpen}
              title="Show the facts and rules behind this deduction"
            >
              <span className="block font-mono text-xs text-amber-200">{key}</span>
              <span className="mt-1 block text-xs text-stone-400">
                {isOpen ? 'Hide proof' : 'Show proof'}
                {d.rule_id ? ` · Rule ${d.rule_id}` : ''}
              </span>
            </button>
            {isOpen && (
              <div className="mt-2 border-t border-stone-800 pt-2" aria-live="polite">
                {loading[key] && <p className="text-xs text-stone-400">Following the proof…</p>}
                {errors[key] && <p className="text-xs text-red-300" role="alert">{errors[key]}</p>}
                {result && !result.success && (
                  <p className="rounded border border-amber-900 bg-amber-950/40 p-2 text-xs leading-relaxed text-amber-100">
                    This claim cannot be proved from the facts you have found so far. Keep investigating; new evidence may complete the proof.
                  </p>
                )}
                {result?.success && (
                  <>
                    <p className="mb-2 text-xs text-stone-400">This conclusion follows from:</p>
                    <ul className="space-y-2">
                      <ProofBranch node={result.proof} evidenceById={evidenceById} />
                    </ul>
                    {checks[key] && (
                      <p className="mt-2 border-t border-stone-800 pt-2 text-xs text-stone-400">{checks[key]}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
      </ul> : <p className="text-sm text-stone-400" role="status">No deductions match “{filter}”.</p>}
    </div>
  );
}
