import { useState } from 'react';
import { api, fmt, type DerivedDetail } from '../../../api/client';

/**
 * Deductions panel: every entry is backend-derived with provenance.
 * WHY? answers come from the reason/query endpoint (backward chaining),
 * never from narration written in the frontend.
 */
export default function HypothesisPanel({
  sessionId,
  derived,
}: {
  sessionId: string | null;
  derived: DerivedDetail[];
}) {
  const [why, setWhy] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  if (derived.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No deductions yet. Discover evidence and the engine will reason from what you found.
      </p>
    );
  }

  const askWhy = async (d: DerivedDetail) => {
    const key = fmt(d.fact);
    setOpen(key);
    if (why[key] || !sessionId) return;
    try {
      const result = await api.query(sessionId, d.fact.name, d.fact.args);
      setWhy((prev) => ({ ...prev, [key]: result.why }));
      // Independent cross-check via the isolated resolution engine.
      api
        .resolution(sessionId, d.fact.name, d.fact.args)
        .then((ref) =>
          setCheck((prev) => ({
            ...prev,
            [key]: ref.success
              ? `✓ independently verified by resolution refutation (${ref.steps.length} steps)`
              : '⚠ resolution refutation disagrees — flagged for review',
          })),
        )
        .catch(() => {
          /* verification is best-effort; the primary proof stands */
        });
    } catch {
      setWhy((prev) => ({ ...prev, [key]: 'Could not reach the reasoning backend.' }));
    }
  };

  return (
    <ul className="space-y-2">
      {derived.map((d) => {
        const key = fmt(d.fact);
        return (
          <li key={d.fact_id} className="rounded border border-stone-800 bg-stone-900 p-2">
            <button
              className="w-full text-left"
              onClick={() => void askWhy(d)}
              title="Ask WHY? (backward-chaining proof)"
            >
              <span className="font-mono text-xs text-amber-200">{key}</span>
              <span className="ml-2 text-xs text-stone-500">via {d.rule_id} · WHY?</span>
            </button>
            {open === key && (
              <>
                <pre className="mt-1 whitespace-pre-wrap font-mono text-xs leading-snug text-stone-300">
                  {why[key] ?? 'Asking the engine…'}
                </pre>
                {check[key] && (
                  <p className="mt-1 font-mono text-xs text-stone-500">{check[key]}</p>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
