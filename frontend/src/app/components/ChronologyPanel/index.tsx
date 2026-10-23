import { useState } from 'react';
import type { EvidenceDetail, Knowledge } from '../../../api/client';

type ChronologyKind = 'event' | 'sighting' | 'alibi' | 'deduction';

type ChronologyEntry = {
  key: string;
  timeValue: string;
  minutes: number;
  description: string;
  kind: ChronologyKind;
  sources: EvidenceDetail[];
};

const TIMED_FACTS: Record<string, { timeArg: number; kind: Exclude<ChronologyKind, 'deduction'> }> = {
  clock_stopped_at: { timeArg: 1, kind: 'event' },
  bell_rang: { timeArg: 1, kind: 'event' },
  lamp_dark_at: { timeArg: 1, kind: 'event' },
  was_at: { timeArg: 2, kind: 'sighting' },
  claims_at: { timeArg: 2, kind: 'alibi' },
};

function parseTime(value: string | undefined): number | null {
  const match = value?.match(/^(\d{1,2})[_:](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTime(value: string): string {
  return value.replace('_', ':');
}

function titleCase(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function describeFact(
  name: string,
  args: string[],
  people: Record<string, string>,
  rooms: Record<string, string>,
): string | null {
  const person = (id: string) => people[id] ?? titleCase(id);
  const room = (id: string) => rooms[id] ?? titleCase(id);
  switch (name) {
    case 'clock_stopped_at':
      return `${titleCase(args[0] ?? 'Clock')} stopped`;
    case 'bell_rang':
      return `${titleCase(args[0] ?? 'Bell')} rang`;
    case 'lamp_dark_at':
      return `${titleCase(args[0] ?? 'Lamp')} went dark`;
    case 'was_at':
      return `${person(args[0] ?? 'Someone')} — witness placed them at ${room(args[1] ?? 'unknown location')}`;
    case 'claims_at':
      return `${person(args[0] ?? 'Someone')} — claimed to be at ${room(args[1] ?? 'unknown location')}`;
    case 'crime_time':
      return 'Incident time inferred from evidence';
    default:
      return null;
  }
}

/** A spoiler-safe sequence built only from facts tied to discovered clues. */
export default function ChronologyPanel({
  caseId,
  knowledge,
  evidence,
  people,
  rooms,
  onFocusEvidence,
}: {
  caseId: string;
  knowledge: Knowledge;
  evidence: EvidenceDetail[];
  people: Record<string, string>;
  rooms: Record<string, string>;
  onFocusEvidence: (id: string) => void;
}) {
  const [exportStatus, setExportStatus] = useState('');
  const evidenceById = new Map(evidence.map((item) => [item.id, item] as const));
  const knownEntries: ChronologyEntry[] = knowledge.known.flatMap((fact) => {
    const definition = TIMED_FACTS[fact.name];
    if (!definition || !fact.source) return [];
    const source = evidenceById.get(fact.source);
    const timeValue = fact.args[definition.timeArg];
    const minutes = parseTime(timeValue);
    const description = describeFact(fact.name, fact.args, people, rooms);
    if (!source || minutes === null || !timeValue || !description) return [];
    return [{
      key: `known:${fact.name}:${fact.args.join(':')}:${source.id}`,
      timeValue,
      minutes,
      description,
      kind: definition.kind,
      sources: [source],
    }];
  });

  // A derived incident time is useful in the timeline only when its time
  // matches a discovered physical time clue. That keeps the inference tied
  // to evidence the player can inspect rather than case truth.
  const eventSourcesByMinute = new Map<number, EvidenceDetail[]>();
  for (const entry of knownEntries) {
    if (entry.kind !== 'event') continue;
    const sourcesForTime = eventSourcesByMinute.get(entry.minutes) ?? [];
    for (const source of entry.sources) {
      if (!sourcesForTime.some((candidate) => candidate.id === source.id)) sourcesForTime.push(source);
    }
    eventSourcesByMinute.set(entry.minutes, sourcesForTime);
  }

  const derivedEntries: ChronologyEntry[] = knowledge.derived.flatMap(({ fact, fact_id }) => {
    if (fact.name !== 'crime_time') return [];
    const timeValue = fact.args[0];
    const minutes = parseTime(timeValue);
    if (minutes === null || !timeValue) return [];
    const sources = eventSourcesByMinute.get(minutes);
    if (!sources || sources.length === 0) return [];
    return [{
      key: `derived:${fact_id}`,
      timeValue,
      minutes,
      description: describeFact(fact.name, fact.args, people, rooms) ?? 'Incident time inferred from evidence',
      kind: 'deduction',
      sources,
    }];
  });

  const entries = [...knownEntries, ...derivedEntries].sort((a, b) =>
    a.minutes - b.minutes
    || (a.kind === b.kind ? 0 : a.kind === 'event' ? -1 : b.kind === 'event' ? 1 : 0)
    || a.sources[0].title.localeCompare(b.sources[0].title),
  );

  const exportChronology = () => {
    const sections = entries.flatMap(({ sources, timeValue, description, kind }) => [
      `## ${formatTime(timeValue)} — ${description}`,
      kind === 'event' ? null : `- Classification: ${kind === 'alibi' ? 'Alibi' : kind === 'deduction' ? 'Deduction' : 'Witness report'}`,
      ...sources.map((source) => `- Source clue: ${source.title} (${source.id})`),
      '',
    ].filter((line): line is string => line !== null));
    const markdown = [
      `# ${caseId} Investigation Chronology`,
      '',
      `Exported ${new Date().toLocaleDateString()}. Contains only time facts linked to clues discovered in this investigation.`,
      '',
      ...sections,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sherlock-${caseId}-chronology.md`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportStatus('Chronology report downloaded.');
  };

  return (
    <div>
      <p className="mb-3 text-xs text-stone-400">
        Only time and location facts linked to clues you have discovered appear here. Evidence-backed incident-time deductions appear once their supporting time clue is found. Witness reports and alibis are labeled separately.
      </p>
      {entries.length === 0 ? (
        <p className="rounded border border-stone-800 bg-stone-950 p-3 text-sm text-stone-400" role="status">
          Find a clock, bell, or light clue, or ask about an alibi to start building the chronology.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-stone-400">{entries.length} timeline {entries.length === 1 ? 'entry' : 'entries'}</p>
            <button
              type="button"
              onClick={exportChronology}
              className="min-h-11 rounded border border-amber-800 px-3 text-xs font-semibold text-amber-200 hover:bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Download chronology
            </button>
            <p role="status" aria-live="polite" className="min-h-4 text-xs text-stone-400">
              {exportStatus}
            </p>
          </div>
          <ol className="space-y-2" aria-label="Discovered events in chronological order">
            {entries.map(({ key, sources, timeValue, description, kind }) => (
              <li key={key} className="flex items-start gap-3 rounded border border-stone-800 bg-stone-950 p-3">
                <time className="min-w-12 pt-0.5 font-mono text-sm font-bold text-amber-300">{formatTime(timeValue)}</time>
                <div className="min-w-0 flex-1">
                  {kind !== 'event' && (
                    <span className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${kind === 'alibi' ? 'bg-orange-950 text-orange-200' : 'bg-sky-950 text-sky-200'}`}>
                      {kind === 'alibi' ? 'Alibi' : kind === 'deduction' ? 'Deduction' : 'Witness report'}
                    </span>
                  )}
                  <p className="text-sm text-stone-100">{description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-xs text-stone-400">{sources.length === 1 ? 'Source:' : 'Sources:'}</span>
                    {sources.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => onFocusEvidence(source.id)}
                        className="min-h-11 max-w-full truncate rounded px-2 text-left text-xs text-amber-200 underline decoration-amber-800 underline-offset-2 hover:bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                        aria-label={`Review source clue: ${source.title}`}
                      >
                        {source.title}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
