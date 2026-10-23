import { useEffect, useMemo, useRef, useState } from 'react';
import { api, fmt, type CaseInfo, type EvidenceDetail, type WhatIfResult } from '../../../api/client';

/**
 * What-if sandbox: exclude discovered evidence, add hypothetical ground
 * facts, and see the suspect set change. Read-only — the session is never
 * mutated and guilty() hypotheses are rejected by the backend (422).
 */
export default function WhatIfPanel({
  sessionId,
  caseId,
  caseInfo,
  evidence,
  names,
  onFocusEvidence,
}: {
  sessionId: string | null;
  caseId: string;
  caseInfo: CaseInfo | null;
  evidence: EvidenceDetail[];
  names: Record<string, string>;
  onFocusEvidence: (id: string) => void;
}) {
  const [excluded, setExcluded] = useState<string[]>([]);
  const [factName, setFactName] = useState('');
  const [factArgs, setFactArgs] = useState('');
  const [sightingKind, setSightingKind] = useState<'was_at' | 'claims_at'>('was_at');
  const [sightingPerson, setSightingPerson] = useState('');
  const [sightingRoom, setSightingRoom] = useState('');
  const [sightingTime, setSightingTime] = useState('');
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const evidenceIds = useMemo(() => evidence.map((item) => item.id).sort(), [evidence]);
  const evidenceKey = evidenceIds.join('\u0000');
  const previousEvidenceKey = useRef(evidenceKey);
  const evidenceKeyRef = useRef(evidenceKey);
  evidenceKeyRef.current = evidenceKey;
  const trimmedFactName = factName.trim();
  const parsedFactArgs = factArgs.trim() === '' ? [] : factArgs.split(',').map((arg) => arg.trim());
  const missingFactArgs = trimmedFactName !== '' && parsedFactArgs.length === 0;
  const hasEmptyFactArg = trimmedFactName !== '' && parsedFactArgs.some((arg) => arg === '');
  const invalidFactArgs = missingFactArgs || hasEmptyFactArg;
  const people = useMemo(() => {
    const labels = new Map((caseInfo?.npcs ?? []).map((npc) => [npc.id, npc.name]));
    for (const id of caseInfo?.suspects ?? []) {
      if (!labels.has(id)) labels.set(id, names[id] ?? id.replace(/_/g, ' '));
    }
    return Array.from(labels, ([id, name]) => ({ id, name: names[id] ?? name })).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
  }, [caseInfo, names]);
  const hasGuidedSighting = sightingPerson !== '' && sightingRoom !== '' && sightingTime !== '';
  const hasPartialSighting =
    !hasGuidedSighting && (sightingPerson !== '' || sightingRoom !== '' || sightingTime !== '');
  const hasScenarioInput =
    hasGuidedSighting || hasPartialSighting || trimmedFactName !== '' || factArgs.trim() !== '';

  const clearResult = () => {
    setResult(null);
    setError(null);
    setExportStatus(null);
  };

  const clearScenario = () => {
    setSightingKind('was_at');
    setSightingPerson('');
    setSightingRoom('');
    setSightingTime('');
    setFactName('');
    setFactArgs('');
    clearResult();
  };

  useEffect(() => {
    if (previousEvidenceKey.current === evidenceKey) return;
    previousEvidenceKey.current = evidenceKey;
    setExcluded((current) => current.filter((id) => evidenceIds.includes(id)));
    setResult(null);
    setError(null);
    setExportStatus(null);
  }, [evidenceIds, evidenceKey]);

  const toggle = (id: string) => {
    setExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    clearResult();
  };

  const buildExtraFacts = () => {
    const extra: { name: string; args: string[] }[] = [];
    if (hasGuidedSighting) {
      extra.push({
        name: sightingKind,
        args: [sightingPerson, sightingRoom, sightingTime.replace(':', '_')],
      });
    }
    if (trimmedFactName !== '') extra.push({ name: trimmedFactName, args: parsedFactArgs });
    return extra;
  };

  const run = async () => {
    if (!sessionId || busy || invalidFactArgs) return;
    const requestEvidenceKey = evidenceKey;
    setBusy(true);
    setError(null);
    setExportStatus(null);
    try {
      const nextResult = await api.whatif(sessionId, excluded, buildExtraFacts());
      if (requestEvidenceKey === evidenceKeyRef.current) setResult(nextResult);
    } catch (e) {
      if (requestEvidenceKey === evidenceKeyRef.current) {
        setError(e instanceof Error ? e.message : 'What-if failed');
        setResult(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const label = (id: string) => names[id] ?? id;

  const downloadReport = () => {
    if (!result) return;
    try {
      const lines = [
        `# What-if analysis — ${caseId}`,
        '',
        `Exported ${new Date().toLocaleString()}.`,
        '',
        '**Read-only hypothetical analysis.** Exclusions and extra facts apply only to this report; they do not change the investigation or its deductions.',
        '',
        '## Scenario inputs',
        '',
        `- Excluded discovered evidence: ${excluded.length}`,
        ...(excluded.length > 0
          ? excluded.map((id) => {
              const title = evidence.find((item) => item.id === id)?.title ?? id;
              return `  - ${title} (\`${id}\`)`;
            })
          : ['  - None']),
      ];

      if (hasGuidedSighting) {
        const person = label(sightingPerson);
        const room = caseInfo?.rooms.find((item) => item.id === sightingRoom)?.name ?? sightingRoom;
        const interpretation = sightingKind === 'was_at' ? 'was seen at' : 'claimed to be at';
        lines.push(
          `- Guided sighting: ${person} ${interpretation} ${room} at ${sightingTime}.`,
          `  - Submitted fact: \`${sightingKind}(${sightingPerson}, ${sightingRoom}, ${sightingTime.replace(':', '_')})\``,
        );
      } else if (hasPartialSighting) {
        lines.push('- The incomplete guided sighting was not submitted.');
      }

      if (trimmedFactName !== '') {
        lines.push(`- Advanced fact: \`${trimmedFactName}(${parsedFactArgs.join(', ')})\``);
      } else if (factArgs.trim() !== '') {
        lines.push('- Advanced arguments without a predicate were not submitted.');
      }
      if (!hasGuidedSighting && trimmedFactName === '') {
        lines.push('- No additional facts were submitted; this run only changes evidence exclusions.');
      }

      lines.push(
        '',
        '## Suspect comparison',
        '',
        `- Base: ${result.base_suspects.map(label).join(', ') || 'None'}`,
        `- Under hypothesis: ${result.hypo_suspects.map(label).join(', ') || 'None'}`,
        `- Added: ${result.added_suspects.map(label).join(', ') || 'None'}`,
        `- Removed: ${result.removed_suspects.map(label).join(', ') || 'None'}`,
        '',
        `## Derived facts (${result.new_derived_count})`,
        '',
        ...(result.derived.length > 0
          ? result.derived.map((item) => `- \`${fmt(item.fact)}\`${item.rule_id ? ` (via ${item.rule_id})` : ''}`)
          : ['- No derived facts were returned.']),
        '',
      );

      const markdown = lines.join('\n');
      const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sherlock-${caseId.replace(/[^a-z0-9_-]/gi, '-')}-what-if.md`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus('What-if report download started.');
    } catch {
      setExportStatus('Could not create the what-if report.');
    }
  };

  return (
    <div>
      {evidence.length > 0 ? (
        <fieldset className="mb-2">
          <legend className="mb-1 text-xs text-stone-400">Exclude discovered evidence</legend>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-stone-400">{excluded.length} of {evidence.length} excluded</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || excluded.length === evidence.length}
                onClick={() => {
                  setExcluded(evidenceIds);
                  clearResult();
                }}
                className="min-h-11 rounded px-2 text-xs text-amber-200 underline decoration-amber-800 underline-offset-2 hover:bg-stone-800 disabled:opacity-60"
              >
                Exclude all
              </button>
              <button
                type="button"
                disabled={busy || excluded.length === 0}
                onClick={() => {
                  setExcluded([]);
                  clearResult();
                }}
                className="min-h-11 rounded px-2 text-xs text-stone-300 underline decoration-stone-600 underline-offset-2 hover:bg-stone-800 disabled:opacity-60"
              >
                Clear exclusions
              </button>
            </div>
          </div>
          <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
            {evidence.map((e) => (
              <div key={e.id} className="flex min-h-11 items-center gap-1 rounded border border-stone-800 px-1">
                <label htmlFor={`what-if-exclude-${e.id}`} className="flex min-h-11 flex-1 items-center gap-1 text-xs text-stone-300">
                  <input
                    id={`what-if-exclude-${e.id}`}
                    type="checkbox"
                    checked={excluded.includes(e.id)}
                    disabled={busy}
                    onChange={() => toggle(e.id)}
                    className="accent-amber-500"
                  />
                  {e.title}
                </label>
                <button
                  type="button"
                  onClick={() => onFocusEvidence(e.id)}
                  aria-label={`Review ${e.title} in the evidence notebook`}
                  className="min-h-11 rounded px-2 text-xs text-amber-200 underline decoration-amber-800 underline-offset-2 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mb-2 text-xs text-stone-400">Discover evidence to exclude it here.</p>
      )}
      <p className="mb-2 text-xs text-stone-400">
        Build a sighting below or add an advanced fact; you can combine them. Leave both blank to test evidence exclusions alone. Nothing here changes your investigation.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
        className="mb-2 space-y-2"
      >
        {caseInfo && (
          <fieldset className="rounded border border-stone-800 p-3">
            <legend className="px-1 text-xs font-semibold text-amber-200">Build a sighting hypothesis</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-stone-400">
                Interpretation
                <select
                  value={sightingKind}
                  disabled={busy}
                  onChange={(event) => {
                    setSightingKind(event.target.value as 'was_at' | 'claims_at');
                    clearResult();
                  }}
                  className="mt-1 min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-2 text-sm text-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 focus-visible:outline-offset-1"
                >
                  <option value="was_at">Was seen at</option>
                  <option value="claims_at">Claims to be at</option>
                </select>
              </label>
              <label className="text-xs text-stone-400">
                Person
                <select
                  value={sightingPerson}
                  disabled={busy || people.length === 0}
                  onChange={(event) => {
                    setSightingPerson(event.target.value);
                    clearResult();
                  }}
                  className="mt-1 min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-2 text-sm text-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 focus-visible:outline-offset-1"
                >
                  <option value="">Choose a person</option>
                  {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-stone-400">
                Location
                <select
                  value={sightingRoom}
                  disabled={busy}
                  onChange={(event) => {
                    setSightingRoom(event.target.value);
                    clearResult();
                  }}
                  className="mt-1 min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-2 text-sm text-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 focus-visible:outline-offset-1"
                >
                  <option value="">Choose a location</option>
                  {caseInfo.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-stone-400">
                Case time
                <input
                  type="time"
                  value={sightingTime}
                  disabled={busy}
                  onChange={(event) => {
                    setSightingTime(event.target.value);
                    clearResult();
                  }}
                  className="mt-1 min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-2 text-sm text-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 focus-visible:outline-offset-1"
                />
              </label>
            </div>
            {hasPartialSighting && (
              <p className="mt-2 text-xs text-stone-400" role="status">
                Choose a person, location, and time to include this sighting.
              </p>
            )}
          </fieldset>
        )}
        <details className="rounded border border-stone-800 px-3">
          <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-stone-300">
            Advanced predicate input
          </summary>
          <div className="flex flex-wrap items-end gap-2 pb-3">
            <label className="text-xs text-stone-400">
              Predicate
              <input
                value={factName}
                disabled={busy}
                onChange={(e) => {
                  setFactName(e.target.value);
                  clearResult();
                }}
                placeholder="was_at"
                className="ml-1 min-h-11 w-28 rounded border border-stone-700 bg-stone-900 px-1 py-0.5 font-mono text-xs text-stone-200"
              />
            </label>
            <label className="text-xs text-stone-400">
              Args (comma separated)
              <input
                value={factArgs}
                disabled={busy}
                aria-invalid={invalidFactArgs || undefined}
                aria-describedby={invalidFactArgs ? 'what-if-args-status' : undefined}
                onChange={(e) => {
                  setFactArgs(e.target.value);
                  clearResult();
                }}
                placeholder="person, location, HH_MM"
                className="ml-1 min-h-11 w-44 rounded border border-stone-700 bg-stone-900 px-1 py-0.5 font-mono text-xs text-stone-200"
              />
            </label>
          </div>
        </details>
        {invalidFactArgs && (
          <p id="what-if-args-status" className="text-xs text-amber-200" role="status">
            {missingFactArgs
              ? 'Enter at least one argument for this predicate.'
              : 'Fill every comma-separated argument; empty values are not allowed.'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!sessionId || busy || invalidFactArgs || (excluded.length === 0 && !hasGuidedSighting && trimmedFactName === '')}
            className="min-h-11 rounded border border-stone-700 px-2 py-1 text-sm text-stone-200 hover:bg-stone-800 disabled:opacity-60"
          >
            {busy ? 'Testing…' : 'Test hypothesis'}
          </button>
          <button
            type="button"
            disabled={busy || !hasScenarioInput}
            onClick={clearScenario}
            className="min-h-11 rounded px-2 py-1 text-sm text-amber-200 underline decoration-amber-800 underline-offset-2 hover:bg-stone-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Clear scenario
          </button>
        </div>
      </form>
      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="rounded border border-stone-800 bg-stone-900 p-2 text-sm" aria-live="polite">
          <div className="space-y-1 text-stone-300">
            <p>Base: {result.base_suspects.map(label).join(', ') || '—'}</p>
            <p>Hypothetical: {result.hypo_suspects.map(label).join(', ') || '—'}</p>
          </div>
          {result.added_suspects.length > 0 && (
            <p className="text-emerald-300">Added: {result.added_suspects.map(label).join(', ')}</p>
          )}
          {result.removed_suspects.length > 0 && (
            <p className="text-red-300">Removed: {result.removed_suspects.map(label).join(', ')}</p>
          )}
          <p className="mt-1 font-mono text-xs text-stone-400">
            {result.new_derived_count} derived fact(s) under hypothesis
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={downloadReport}
            className="mt-2 min-h-11 rounded border border-stone-700 px-3 text-sm text-stone-200 hover:bg-stone-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Download What-if report
          </button>
          {result.derived.length > 0 && (
            <details className="mt-2 rounded border border-stone-800 px-2 py-1">
              <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-amber-200">
                Inspect derived facts ({result.derived.length})
              </summary>
              <ul className="space-y-1 pb-2">
                {result.derived.map((item) => (
                  <li key={item.fact_id} className="text-xs text-stone-300">
                    <span className="font-mono">{fmt(item.fact)}</span>
                    {item.rule_id && <span className="ml-2 text-stone-400">via {item.rule_id}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {exportStatus && (
        <p className="mt-2 text-xs text-stone-300" role="status" aria-live="polite">
          {exportStatus}
        </p>
      )}
    </div>
  );
}
