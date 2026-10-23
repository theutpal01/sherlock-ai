import { useState } from 'react';
import type { InvestigationLogCategory, InvestigationLogEntry } from '../../hooks/useGameEvents';

const CATEGORY_OPTIONS: { value: 'all' | InvestigationLogCategory; label: string }[] = [
  { value: 'all', label: 'All event types' },
  { value: 'room', label: 'Room changes' },
  { value: 'evidence', label: 'Evidence discoveries' },
  { value: 'interaction', label: 'Examinations' },
  { value: 'dialogue', label: 'NPC dialogue' },
  { value: 'world', label: 'World changes' },
  { value: 'case', label: 'Case events' },
];

export default function InvestigationLogPanel({
  caseId,
  recent,
  earlier,
  omittedCount,
  storageWarning,
  onFocusEvidence,
}: {
  caseId: string;
  recent: InvestigationLogEntry[];
  earlier: InvestigationLogEntry[];
  omittedCount: number;
  storageWarning: boolean;
  onFocusEvidence: (evidenceId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | InvestigationLogCategory>('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [npcFilter, setNpcFilter] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const sessionEntries = [...earlier, ...recent];
  const roomOptions = Array.from(new Map(sessionEntries.map((entry) => [entry.roomId, entry.roomName] as const)));
  const npcOptions = Array.from(new Map(sessionEntries.flatMap((entry) =>
    entry.dialogue ? [[entry.dialogue.npcId, entry.dialogue.speaker] as const] : [],
  )));
  const filteredEntries = sessionEntries.filter((entry) =>
    (category === 'all' || entry.category === category) &&
    (roomFilter === 'all' || entry.roomId === roomFilter) &&
    (npcFilter === 'all' || entry.dialogue?.npcId === npcFilter) &&
    (!normalizedQuery || `${entry.roomName} ${entry.text}`.toLocaleLowerCase().includes(normalizedQuery)),
  );
  const categoryLabel = (value: InvestigationLogCategory) =>
    CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;

  const exportFilteredLog = () => {
    try {
      const entrySections = filteredEntries.flatMap((entry, index) => [
        `## ${index + 1}. ${categoryLabel(entry.category)}`,
        '',
        `- Room: ${entry.roomName}`,
        entry.text,
        ...(entry.evidenceId && entry.evidenceTitle
          ? [`- Evidence clue: ${entry.evidenceTitle} (ID: ${entry.evidenceId})`]
          : []),
        '',
      ]);
      const markdown = [
        `# ${caseId} Investigation Log`,
        '',
        `Exported ${new Date().toLocaleDateString()}. Entries are in session order and include only the retained log.`,
        `Event type: ${CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category}.`,
        `Room: ${roomFilter === 'all' ? 'All rooms' : roomOptions.find(([id]) => id === roomFilter)?.[1] ?? roomFilter}.`,
        `NPC replies: ${npcFilter === 'all' ? 'All NPCs' : npcOptions.find(([id]) => id === npcFilter)?.[1] ?? npcFilter}.`,
        `Search: ${query.trim() || 'none'}.`,
        `Included ${filteredEntries.length} of ${sessionEntries.length} retained events.`,
        omittedCount > 0
          ? `The oldest ${omittedCount} events were not retained and cannot appear in this report.`
          : 'No session events were omitted from the retained log.',
        '',
        ...entrySections,
      ].join('\n');
      const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sherlock-${caseId}-activity-log.md`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus('Activity report downloaded.');
    } catch {
      setExportStatus('Could not download the activity report.');
    }
  };

  return (
    <section aria-labelledby="investigation-log-heading">
      <h2 id="investigation-log-heading" className="mb-2 font-semibold">Investigation Log</h2>
      {storageWarning && (
        <p role="status" aria-live="polite" className="mb-2 text-xs text-amber-200">
          Browser storage could not save or restore this activity history. Recent events may be lost after a reload.
        </p>
      )}
      <ul
        className="space-y-1 text-sm text-stone-300"
        role="log"
        aria-labelledby="investigation-log-heading"
        aria-live="polite"
        aria-relevant="additions"
      >
        {recent.length === 0
          ? <li className="text-stone-400">Walk around to begin…</li>
          : recent.map((entry) => <li key={entry.id}>· {entry.text}</li>)}
      </ul>
      {sessionEntries.length > 0 && (
        <details className="mt-2" onToggle={(event) => setExpanded(event.currentTarget.open)}>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-stone-200 focus-visible:outline focus-visible:outline-amber-300">
            Search session history ({sessionEntries.length})
          </summary>
          {expanded && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs text-stone-300">
                  Search session entries
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  />
                </label>
                <label className="block text-xs text-stone-300">
                  Filter by event type
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as 'all' | InvestigationLogCategory)}
                    className="mt-1 min-h-11 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-stone-300">
                  Filter by room
                  <select
                    value={roomFilter}
                    onChange={(event) => setRoomFilter(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >
                    <option value="all">All rooms</option>
                    {roomOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </label>
                {npcOptions.length > 0 && (
                  <label className="block text-xs text-stone-300">
                    Filter by NPC reply
                    <select
                      value={npcFilter}
                      onChange={(event) => setNpcFilter(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                    >
                      <option value="all">All NPCs</option>
                      {npcOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <p className="text-xs text-stone-400">
                Showing {filteredEntries.length} of {sessionEntries.length} retained session entries.
              </p>
              {omittedCount > 0 && (
                <p className="text-xs text-amber-200">
                  The oldest {omittedCount} entries are not retained; this session log keeps up to 500 events.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                    setRoomFilter('all');
                    setNpcFilter('all');
                  }}
                  disabled={!normalizedQuery && category === 'all' && roomFilter === 'all' && npcFilter === 'all'}
                  className="min-h-11 rounded border border-stone-700 px-3 text-xs font-semibold text-stone-200 hover:bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear filters
                </button>
                <button
                  type="button"
                  onClick={exportFilteredLog}
                  disabled={filteredEntries.length === 0}
                  className="min-h-11 rounded border border-amber-800 px-3 text-xs font-semibold text-amber-200 hover:bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Download filtered log
                </button>
                <p role="status" aria-live="polite" className="min-h-4 text-xs text-stone-400">
                  {exportStatus}
                </p>
              </div>
              {filteredEntries.length > 0 ? (
                <ol
                  aria-label="Session investigation log entries"
                  tabIndex={0}
                  className="max-h-56 space-y-1 overflow-y-auto rounded border border-stone-800 p-2 text-sm text-stone-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  {filteredEntries.map((entry) => (
                    <li key={entry.id} className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="min-w-0 break-words">· {entry.text}</span>
                      {entry.evidenceId && entry.evidenceTitle && (
                        <button
                          type="button"
                          onClick={() => onFocusEvidence(entry.evidenceId!)}
                          aria-label={`Open ${entry.evidenceTitle} in the Evidence Notebook`}
                          className="min-h-11 shrink-0 rounded px-2 text-left text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                        >
                          Open clue
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-stone-400">No session entries match these filters.</p>
              )}
            </div>
          )}
        </details>
      )}
    </section>
  );
}
