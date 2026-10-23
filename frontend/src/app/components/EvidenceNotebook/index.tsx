import { useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceDetail } from '../../../api/client';
import { getLayout } from '../../../game/layouts';
import ForensicsGame, { isSolved } from '../ForensicsGame';

type TagMap = Record<string, string[]>;
type NoteMap = Record<string, string>;
type StorageRead<T> = { value: T; problem: boolean };
const MAX_TAGS_PER_CLUE = 8;
const MAX_TAG_LENGTH = 32;
const MAX_NOTE_LENGTH = 1000;
const MAX_BACKUP_BYTES = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTags(caseId: string): StorageRead<TagMap> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(`sherlock-tags:${caseId}`);
  } catch {
    return { value: {}, problem: true };
  }
  if (!raw) return { value: {}, problem: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { value: {}, problem: true };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { value: {}, problem: true };
  }
  try {
    const entries = Object.entries(parsed).flatMap(([evidenceId, value]) => {
      if (!Array.isArray(value)) return [];
      const tags = [...new Set(
        value
          .filter((tag): tag is string => typeof tag === 'string')
          .map((tag) => tag.trim().toLowerCase().slice(0, MAX_TAG_LENGTH))
          .filter(Boolean),
      )].slice(0, MAX_TAGS_PER_CLUE);
      return tags.length > 0 ? [[evidenceId, tags] as const] : [];
    });
    return { value: Object.fromEntries(entries), problem: false };
  } catch {
    return { value: {}, problem: true };
  }
}

function writeTags(caseId: string, map: TagMap): boolean {
  try {
    localStorage.setItem(`sherlock-tags:${caseId}`, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

function readNotes(caseId: string): StorageRead<NoteMap> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(`sherlock-notes:${caseId}`);
  } catch {
    return { value: {}, problem: true };
  }
  if (!raw) return { value: {}, problem: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { value: {}, problem: true };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { value: {}, problem: true };
  }
  return {
    value: Object.fromEntries(
      Object.entries(parsed).flatMap(([evidenceId, value]) =>
        typeof value === 'string' ? [[evidenceId, value.slice(0, MAX_NOTE_LENGTH)] as const] : [],
      ),
    ) as NoteMap,
    problem: false,
  };
}

function writeNotes(caseId: string, map: NoteMap): boolean {
  try {
    localStorage.setItem(`sherlock-notes:${caseId}`, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

/**
 * Evidence notebook annotations are private to the player and never enter
 * the knowledge base or inference engine.
 */
export default function EvidenceNotebook({
  items,
  caseId,
  focusEvidence,
}: {
  items: EvidenceDetail[];
  caseId: string;
  focusEvidence: { caseId: string; id: string; request: number } | null;
}) {
  const layout = getLayout(caseId);
  const roomNames = useMemo(
    () => Object.fromEntries(layout.rooms.map((room) => [room.id, room.name])),
    [layout],
  );
  const roomName = (roomId: string) => roomNames[roomId] ?? roomId;
  const [initialAnnotations] = useState(() => ({
    tags: readTags(caseId),
    notes: readNotes(caseId),
  }));
  const [tags, setTags] = useState<TagMap>(initialAnnotations.tags.value);
  const [notes, setNotes] = useState<NoteMap>(initialAnnotations.notes.value);
  const [annotationStorageWarning, setAnnotationStorageWarning] = useState(
    initialAnnotations.tags.problem || initialAnnotations.notes.problem,
  );
  const tagsRef = useRef(tags);
  const notesRef = useRef(notes);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [annotationFilter, setAnnotationFilter] = useState<'all' | 'notes' | 'tags' | 'annotated'>('all');
  const [sortBy, setSortBy] = useState<'case' | 'title' | 'location'>('case');
  const [labOpen, setLabOpen] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [, setSolvedTick] = useState(0);

  useEffect(() => {
    if (focusEvidence) setFilter('');
  }, [focusEvidence]);

  useEffect(() => {
    if (!focusEvidence || focusEvidence.caseId !== caseId || filter.trim()) return;
    const target = document.getElementById(`evidence-${focusEvidence.id}`);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [caseId, focusEvidence, filter, items]);

  const update = (next: TagMap) => {
    tagsRef.current = next;
    setTags(next);
    if (!writeTags(caseId, next)) setAnnotationStorageWarning(true);
  };

  const addTag = (evidenceId: string) => {
    const raw = (drafts[evidenceId] ?? '').trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (!raw) return;
    const current = tags[evidenceId] ?? [];
    if (current.includes(raw) || current.length >= MAX_TAGS_PER_CLUE) return;
    update({ ...tags, [evidenceId]: [...current, raw] });
    setDrafts((prev) => ({ ...prev, [evidenceId]: '' }));
  };

  const removeTag = (evidenceId: string, tag: string) => {
    const next = (tags[evidenceId] ?? []).filter((t) => t !== tag);
    const map = { ...tags };
    if (next.length === 0) delete map[evidenceId];
    else map[evidenceId] = next;
    update(map);
  };

  const updateNote = (evidenceId: string, note: string) => {
    const next = { ...notes };
    const boundedNote = note.slice(0, MAX_NOTE_LENGTH);
    if (boundedNote.trim()) next[evidenceId] = boundedNote;
    else delete next[evidenceId];
    notesRef.current = next;
    setNotes(next);
    if (!writeNotes(caseId, next)) setAnnotationStorageWarning(true);
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = items.filter(
      (item) =>
        (categoryFilter === 'all' || item.category === categoryFilter) &&
        (locationFilter === 'all' || item.location === locationFilter) &&
        (annotationFilter === 'all' ||
          (annotationFilter === 'notes' && Boolean(notes[item.id]?.trim())) ||
          (annotationFilter === 'tags' && (tags[item.id]?.length ?? 0) > 0) ||
          (annotationFilter === 'annotated' && (Boolean(notes[item.id]?.trim()) || (tags[item.id]?.length ?? 0) > 0))) &&
        (!q ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          (roomNames[item.location] ?? item.location).toLowerCase().includes(q) ||
          (notes[item.id] ?? '').toLowerCase().includes(q) ||
          (tags[item.id] ?? []).some((t) => t.includes(q))),
    );
    if (sortBy === 'title') {
      return filtered.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === 'location') {
      return filtered.sort((a, b) =>
        roomName(a.location).localeCompare(roomName(b.location)) || a.title.localeCompare(b.title),
      );
    }
    return filtered;
  }, [items, tags, notes, filter, roomNames, categoryFilter, locationFilter, annotationFilter, sortBy]);

  const categories = [...new Set(items.map((item) => item.category))].sort();
  const locations = [...new Set(items.map((item) => item.location))].sort((a, b) =>
    roomName(a).localeCompare(roomName(b)),
  );
  const hasFilters = Boolean(filter || categoryFilter !== 'all' || locationFilter !== 'all' || annotationFilter !== 'all');
  const clearFilters = () => {
    setFilter('');
    setCategoryFilter('all');
    setLocationFilter('all');
    setAnnotationFilter('all');
  };

  const exportNotebook = () => {
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const sections = items.map((item) => {
        const itemTags = tags[item.id] ?? [];
        const note = notes[item.id]?.trim();
        return [
          `## ${item.title}`,
          '',
          `- Evidence: ${item.id}`,
          `- Location: ${roomName(item.location)}`,
          item.category === 'key' ? '- Clue type: Key' : null,
          itemTags.length > 0 ? `- Tags: ${itemTags.map((tag) => `#${tag}`).join(', ')}` : null,
          '',
          item.description,
          note ? `\n**Detective’s note:**\n\n${note}` : null,
        ].filter((line): line is string => line !== null).join('\n');
      });
      const markdown = [
        `# ${caseId} Evidence Notebook`,
        '',
        `Exported ${new Date().toLocaleDateString()}. Contains only discovered clues and notes saved on this device.`,
        '',
        ...sections,
      ].join('\n');
      url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = `sherlock-${caseId}-notebook.md`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      setBackupStatus('Evidence notebook downloaded.');
    } catch {
      setBackupStatus('Could not create the evidence notebook download.');
    } finally {
      link?.remove();
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  };

  const exportBackup = () => {
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const backup = JSON.stringify({ version: 1, caseId, tags, notes }, null, 2);
      url = URL.createObjectURL(new Blob([backup], { type: 'application/json;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = `sherlock-${caseId}-notes.json`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      setBackupStatus('Private notes and tags backup downloaded.');
    } catch {
      setBackupStatus('Could not create the private notes and tags backup.');
    } finally {
      link?.remove();
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  };

  const importBackup = async (file: File) => {
    setBackupStatus('');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup file is too large.');
      const parsed: unknown = JSON.parse(await file.text());
      if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.tags) || !isRecord(parsed.notes)) {
        throw new Error('This file is not a valid Sherlock notes backup.');
      }
      if (parsed.caseId !== caseId) {
        throw new Error(`This backup belongs to ${String(parsed.caseId ?? 'another case')}.`);
      }

      const importedTags = Object.fromEntries(Object.entries(parsed.tags).flatMap(([id, value]) => {
        if (!Array.isArray(value)) return [];
        const clean = [...new Set(value
          .filter((tag): tag is string => typeof tag === 'string')
          .map((tag) => tag.trim().toLowerCase().slice(0, MAX_TAG_LENGTH))
          .filter(Boolean))].slice(0, MAX_TAGS_PER_CLUE);
        return clean.length > 0 ? [[id, clean] as const] : [];
      })) as TagMap;
      const importedNotes = Object.fromEntries(Object.entries(parsed.notes).flatMap(([id, value]) =>
        typeof value === 'string' && value.trim()
          ? [[id, value.slice(0, MAX_NOTE_LENGTH)] as const]
          : [],
      )) as NoteMap;

      const mergedTags = { ...tagsRef.current };
      for (const [evidenceId, imported] of Object.entries(importedTags)) {
        mergedTags[evidenceId] = [...new Set([...(mergedTags[evidenceId] ?? []), ...imported])]
          .slice(0, MAX_TAGS_PER_CLUE);
      }
      const mergedNotes = { ...notesRef.current, ...importedNotes };
      tagsRef.current = mergedTags;
      notesRef.current = mergedNotes;
      setTags(mergedTags);
      setNotes(mergedNotes);
      const tagsSaved = writeTags(caseId, mergedTags);
      const notesSaved = writeNotes(caseId, mergedNotes);
      if (!tagsSaved || !notesSaved) {
        setAnnotationStorageWarning(true);
        setBackupStatus('Backup merged for this visit, but browser storage could not save it.');
      } else {
        setBackupStatus('Backup merged into this case’s notebook.');
      }
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : 'Could not read this backup file.');
    }
  };

  return (
    <div>
      {annotationStorageWarning && (
        <p role="status" aria-live="polite" className="mb-3 rounded border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          Browser storage could not load some saved notes or tags, or could not save your changes. Notebook edits remain visible during this visit but may be lost after reloading.
        </p>
      )}
      {items.length > 0 && (
        <div className="mb-2 space-y-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && filter) {
                e.preventDefault();
                setFilter('');
              }
            }}
            placeholder="Search clues, places, tags, or notes…"
            aria-label="Search evidence titles, descriptions, locations, tags, and notes"
            className="min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-3 py-1 text-xs text-stone-200"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-stone-400">
              Clue type
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-2 text-xs text-stone-200"
              >
                <option value="all">All types</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-xs text-stone-400">
              Location
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                className="min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-2 text-xs text-stone-200"
              >
                <option value="all">All locations</option>
                {locations.map((location) => <option key={location} value={location}>{roomName(location)}</option>)}
              </select>
            </label>
            <label className="col-span-2 text-xs text-stone-400">
              Notes &amp; tags
              <select
                value={annotationFilter}
                onChange={(event) => setAnnotationFilter(event.target.value as typeof annotationFilter)}
                className="min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-2 text-xs text-stone-200"
              >
                <option value="all">All clues</option>
                <option value="notes">Clues with notes</option>
                <option value="tags">Clues with tags</option>
                <option value="annotated">Clues with notes or tags</option>
              </select>
            </label>
            <label className="col-span-2 text-xs text-stone-400">
              Sort clues
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-2 text-xs text-stone-200"
              >
                <option value="case">Case order</option>
                <option value="title">Title A–Z</option>
                <option value="location">Room, then title</option>
              </select>
            </label>
          </div>
          {hasFilters && <p className="text-xs text-stone-400" role="status">Showing {visible.length} of {items.length} discovered clues.</p>}
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={exportNotebook}
          className="min-h-11 rounded border border-stone-700 px-3 py-1 font-mono text-xs text-amber-300 hover:bg-stone-800"
        >
          Export notebook
        </button>
        <button
          type="button"
          onClick={exportBackup}
          className="min-h-11 rounded border border-stone-700 px-3 py-1 font-mono text-xs text-amber-300 hover:bg-stone-800"
        >
          Download notes backup
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          className="min-h-11 rounded border border-stone-700 px-3 py-1 font-mono text-xs text-stone-200 hover:bg-stone-800"
        >
          Import notes backup
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Choose Sherlock notes backup file"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void importBackup(file);
            event.currentTarget.value = '';
          }}
        />
      </div>
      <p className="mb-2 text-xs text-stone-400">
        JSON backups contain only your private notes and tags. Imports merge with this case’s saved annotations.
      </p>
      <p role="status" aria-live="polite" className="mb-2 min-h-4 text-xs text-stone-400">{backupStatus}</p>
      {items.length === 0 ? (
        <p className="text-sm text-stone-400">
          No evidence yet. Approach a highlighted object or character; press E or tap to investigate and collect clues.
        </p>
      ) : <ul className="space-y-2">
        {visible.map((item) => {
          const tagLimitReached = (tags[item.id]?.length ?? 0) >= MAX_TAGS_PER_CLUE;
          const tagLimitId = `tag-limit-${item.id}`;
          return (
          <li id={`evidence-${item.id}`} key={item.id} tabIndex={-1} className="scroll-mt-4 rounded border border-stone-800 bg-stone-900 p-2 target:border-amber-500 target:ring-1 target:ring-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-600">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-stone-100">{item.title}</p>
              {item.category === 'key' && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-800 bg-amber-950 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-200">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
                    <circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="m6.8 6.8 6 6m-2-2h2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Key
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400">{item.description}</p>
            <p className="mt-1 font-mono text-xs text-stone-400">{item.id} · {roomName(item.location)}</p>
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer py-2 text-xs text-amber-300 hover:text-amber-100">
                {notes[item.id]?.trim() ? 'Edit detective’s note' : 'Add a detective’s note'}
              </summary>
              <textarea
                value={notes[item.id] ?? ''}
                onChange={(e) => updateNote(item.id, e.target.value)}
                maxLength={MAX_NOTE_LENGTH}
                rows={3}
                placeholder="What does this clue suggest? Record your own theory…"
                aria-label={`Private note for ${item.title}`}
                className="mt-2 w-full resize-y rounded border border-stone-700 bg-stone-950 px-2 py-1.5 text-xs text-stone-200 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none"
              />
              <p className="mt-1 text-right font-mono text-[10px] text-stone-400">
                {(notes[item.id] ?? '').length}/{MAX_NOTE_LENGTH}
              </p>
            </details>
            <div className="mt-1 flex items-center gap-2">
              {isSolved(caseId, item.id) && (
                <span className="rounded bg-emerald-900 px-1.5 py-0.5 font-mono text-xs text-emerald-200">
                  Forensics lab complete
                </span>
              )}
              <button
                onClick={() => setLabOpen((open) => (open === item.id ? null : item.id))}
                aria-label={`${labOpen === item.id ? 'Close' : 'Open'} forensics lab for ${item.title}`}
                className="min-h-11 rounded px-2 py-1 text-xs text-stone-400 underline hover:text-stone-200"
              >
                {labOpen === item.id ? 'Close lab' : 'Forensics lab'}
              </button>
            </div>
            {labOpen === item.id && (
              <ForensicsGame
                caseId={caseId}
                evidenceId={item.id}
                title={item.title}
                onSolved={() => setSolvedTick((t) => t + 1)}
              />
            )}
            {(tags[item.id] ?? []).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1" aria-label={`Tags for ${item.title}`}>
                {(tags[item.id] ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded bg-amber-900 px-1.5 py-0.5 font-mono text-xs text-amber-200"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(item.id, tag)}
                      aria-label={`Remove tag ${tag} from ${item.title}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-amber-400 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 focus-visible:outline-offset-1"
                    >
                      <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        shapeRendering="crispEdges"
                      >
                        <path d="M4 3 13 12 M12 3 3 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1 flex gap-1">
              <input
                value={drafts[item.id] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTag(item.id);
                }}
                maxLength={MAX_TAG_LENGTH}
                disabled={tagLimitReached}
                placeholder={tagLimitReached ? 'Tag limit reached' : 'Add tag…'}
                aria-label={`Add tag to ${item.title}`}
                aria-describedby={tagLimitReached ? tagLimitId : undefined}
                className="min-h-11 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1 font-mono text-xs text-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                onClick={() => addTag(item.id)}
                disabled={tagLimitReached}
                className="min-h-11 rounded border border-stone-700 px-3 text-xs text-stone-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tag
              </button>
            </div>
            {tagLimitReached && (
              <p id={tagLimitId} className="mt-1 text-xs text-stone-400" role="status">
                Maximum {MAX_TAGS_PER_CLUE} tags per clue.
              </p>
            )}
          </li>
          );
        })}
      </ul>}
      {visible.length === 0 && hasFilters && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-stone-400" role="status">No discovered clues match these filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 shrink-0 rounded border border-stone-700 px-3 py-1 font-pixel text-[9px] text-amber-300 hover:bg-stone-800"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
