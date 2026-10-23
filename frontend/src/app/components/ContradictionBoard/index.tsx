import { useEffect, useState } from 'react';
import { api, type Contradiction, type EvidenceDetail } from '../../../api/client';

/**
 * Contradiction board: claim-vs-fact mismatches from player-known facts.
 * Spoiler-safe — the backend only reports what the player discovered.
 */
export default function ContradictionBoard({
  sessionId,
  version,
  evidence,
  onFocusEvidence,
}: {
  sessionId: string | null;
  version: string;
  evidence: EvidenceDetail[];
  onFocusEvidence: (id: string) => void;
}) {
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([sessionId, version, retry]);
  const [request, setRequest] = useState<{
    key: string;
    items: Contradiction[];
    error: string | null;
    loading: boolean;
  }>({ key: '', items: [], error: null, loading: false });

  useEffect(() => {
    if (!sessionId) {
      setRequest({ key: requestKey, items: [], error: null, loading: false });
      return;
    }

    let cancelled = false;
    setRequest({ key: requestKey, items: [], error: null, loading: true });
    api
      .contradictions(sessionId)
      .then((r) => {
        if (!cancelled) {
          setRequest({ key: requestKey, items: r.items, error: null, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRequest({
            key: requestKey,
            items: [],
            error: 'Could not load contradictions.',
            loading: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, sessionId]);

  const requestMatches = request.key === requestKey;
  if (!sessionId) {
    return <p className="text-sm text-stone-400">Start an investigation to review contradictions.</p>;
  }
  if (!requestMatches || request.loading) {
    return (
      <p className="text-sm text-stone-400" role="status">
        Checking discovered claims…
      </p>
    );
  }
  if (request.error) {
    return (
      <div>
        <p className="text-sm text-red-300" role="alert">{request.error}</p>
        <button
          type="button"
          onClick={() => setRetry((value) => value + 1)}
          className="mt-2 min-h-11 rounded border border-stone-700 px-2 py-1 text-sm text-stone-200 hover:bg-stone-800"
        >
          Retry
        </button>
      </div>
    );
  }
  if (request.items.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        No contradictions yet. Claims and sightings will clash here when they do.
      </p>
    );
  }

  const duplicateCounts = new Map<string, number>();
  const evidenceTitles = new Map(evidence.map((item) => [item.id, item.title]));
  const readable = (value: string) =>
    value
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  return (
    <ul className="space-y-2" aria-live="polite">
      {request.items.map((c) => {
        const signature = JSON.stringify([
          c.person,
          c.claimed_room,
          c.actual_room,
          c.time,
          c.kind,
          c.rule_id,
        ]);
        const occurrence = duplicateCounts.get(signature) ?? 0;
        duplicateCounts.set(signature, occurrence + 1);
        return (
          <li
            key={`${signature}:${occurrence}`}
            className="rounded border border-red-900 bg-stone-900 p-2 text-sm"
          >
            <span className="font-semibold text-red-200">{readable(c.person)}</span>
            {c.kind === 'claim_vs_fact' ? (
              <span className="text-stone-300">
                {' '}said they were in <span className="font-semibold text-stone-100">{readable(c.claimed_room)}</span>,
                {' '}but were seen in <span className="font-semibold text-stone-100">{readable(c.actual_room)}</span>{' '}
                <span className="text-stone-400">at {c.time}</span>
              </span>
            ) : (
              <span className="text-stone-300">
                {' '}alibi contradicted by rule{' '}
                <span className="font-mono text-xs text-amber-200">{readable(c.rule_id)}</span>
              </span>
            )}
            {c.evidence_ids.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Supporting evidence">
                {c.evidence_ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onFocusEvidence(id)}
                    className="min-h-11 rounded border border-stone-700 px-2 py-1 text-xs text-amber-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >
                    Review: {evidenceTitles.get(id) ?? 'supporting clue'}
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
