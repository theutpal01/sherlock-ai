import { useEffect, useRef, useState, type ChangeEvent } from 'react';

const BACKUP_FORMAT = 'sherlock-ai-browser-data';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
const MAX_BACKUP_KEYS = 500;

const EXACT_KEYS = new Set([
  'sherlock-sessions',
  'sherlock-session-id',
  'sherlock-stars',
  'sherlock-achievements',
  'sherlock-best-streak',
  'sherlock-sound',
  'sherlock-volume',
  'sherlock-difficulty',
  'sherlock-tutorial-seen',
]);

const KEY_PREFIXES = [
  'sherlock-notes:',
  'sherlock-tags:',
  'sherlock-photos:',
  'sherlock-analyzed:',
  'sherlock-investigation-log:',
];

type PendingRestore = {
  entries: Record<string, string>;
  existingValues: Record<string, string | null>;
  replacedCount: number;
};

function isSherlockSaveKey(key: string): boolean {
  return EXACT_KEYS.has(key) || KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function collectSaveData(): Record<string, string> {
  const entries: Record<string, string> = Object.create(null) as Record<string, string>;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !isSherlockSaveKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return entries;
}

function parseSaveData(raw: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('This is not a SherlockAI save file.');
  }

  const backup = parsed as Record<string, unknown>;
  if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
    throw new Error('This save file has an unsupported format or version.');
  }
  if (typeof backup.entries !== 'object' || backup.entries === null || Array.isArray(backup.entries)) {
    throw new Error('This save file has no valid save-data section.');
  }

  const pairs = Object.entries(backup.entries);
  if (pairs.length === 0) throw new Error('This save file contains no saved game data.');
  if (pairs.length > MAX_BACKUP_KEYS) throw new Error('This save file contains too many data entries.');

  const entries: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, value] of pairs) {
    if (!isSherlockSaveKey(key) || typeof value !== 'string') {
      throw new Error('This save file contains an unrecognized or invalid data entry.');
    }
    entries[key] = value;
  }
  return entries;
}

function readExistingValues(entries: Record<string, string>): Record<string, string | null> {
  const existingValues: Record<string, string | null> = Object.create(null) as Record<string, string | null>;
  for (const key of Object.keys(entries)) existingValues[key] = localStorage.getItem(key);
  return existingValues;
}

function countExistingValues(existingValues: Record<string, string | null>): number {
  return Object.values(existingValues).filter((value) => value !== null).length;
}

function restoreSaveData(entries: Record<string, string>, expectedValues: Record<string, string | null>): boolean {
  const previous = new Map<string, string | null>();
  for (const key of Object.keys(entries)) {
    const value = localStorage.getItem(key);
    if (value !== expectedValues[key]) return false;
    previous.set(key, value);
  }

  try {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    return true;
  } catch {
    let rolledBack = true;
    for (const [key, value] of [...previous.entries()].reverse()) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        rolledBack = false;
      }
    }
    throw new Error(rolledBack
      ? 'Restore failed. Your previous matching save data was kept.'
      : 'Restore failed and could not fully roll back. Reload the page to review saved data.');
  }
}

export default function SaveDataTransfer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reloadButtonRef = useRef<HTMLButtonElement>(null);
  const importRequestIdRef = useRef(0);
  const [status, setStatus] = useState('');
  const [reloadRequired, setReloadRequired] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);

  useEffect(() => {
    if (reloadRequired) reloadButtonRef.current?.focus();
  }, [reloadRequired]);

  useEffect(() => () => {
    importRequestIdRef.current += 1;
  }, []);

  const exportSave = () => {
    importRequestIdRef.current += 1;
    setReloadRequired(false);
    setPendingRestore(null);
    let objectUrl: string | null = null;
    let link: HTMLAnchorElement | null = null;
    let revokeAfterDelay = false;
    try {
      const entries = collectSaveData();
      if (Object.keys(entries).length === 0) {
        setStatus('No saved SherlockAI data was found in this browser.');
        return;
      }
      if (Object.keys(entries).length > MAX_BACKUP_KEYS) {
        setStatus(`This browser has more than ${MAX_BACKUP_KEYS} save-data entries. Remove older investigation logs or saved photos, then try again.`);
        return;
      }
      const backup = JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        entries,
      }, null, 2);
      const blob = new Blob([backup], { type: 'application/json;charset=utf-8' });
      if (blob.size > MAX_BACKUP_BYTES) {
        setStatus('This backup would exceed the 8 MB restore limit. Remove some saved photos or notes, then try again.');
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = objectUrl;
      link.download = `sherlock-ai-browser-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      const urlForRevocation = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(urlForRevocation), 1000);
      revokeAfterDelay = true;
      setStatus(`${Object.keys(entries).length} save-data entries downloaded.`);
    } catch {
      setStatus('Could not read or download browser save data.');
    } finally {
      try {
        link?.remove();
      } catch {
        // Keep the download error status even if the temporary link cannot be detached.
      }
      if (objectUrl && !revokeAfterDelay) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // The download failure remains the useful feedback if URL cleanup also fails.
        }
      }
    }
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const requestId = ++importRequestIdRef.current;
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setReloadRequired(false);
    setPendingRestore(null);
    setStatus('Reading backup file…');

    if (file.size > MAX_BACKUP_BYTES) {
      setStatus('This save file is larger than the 8 MB import limit.');
      return;
    }

    let raw: string;
    try {
      raw = await file.text();
    } catch {
      if (requestId !== importRequestIdRef.current) return;
      setStatus('Could not read the selected backup file.');
      return;
    }
    if (requestId !== importRequestIdRef.current) return;

    let entries: Record<string, string>;
    try {
      entries = parseSaveData(raw);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'This file is not a valid SherlockAI backup.');
      return;
    }

    let existingValues: Record<string, string | null>;
    try {
      existingValues = readExistingValues(entries);
    } catch (error) {
      setStatus('Could not inspect browser storage. It may be unavailable or full.');
      return;
    }
    setPendingRestore({ entries, existingValues, replacedCount: countExistingValues(existingValues) });
    setStatus(`Backup ready. Review ${Object.keys(entries).length} entries before restoring.`);
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    const count = Object.keys(pendingRestore.entries).length;
    try {
      const restored = restoreSaveData(pendingRestore.entries, pendingRestore.existingValues);
      if (!restored) {
        const existingValues = readExistingValues(pendingRestore.entries);
        setPendingRestore({
          ...pendingRestore,
          existingValues,
          replacedCount: countExistingValues(existingValues),
        });
        setStatus('Browser save data changed since this preview. Review the updated counts before restoring.');
        return;
      }
      setStatus(`${count} entries restored. Reload the game to apply them.`);
      setReloadRequired(true);
      setPendingRestore(null);
    } catch (error) {
      setStatus(error instanceof Error && error.message.startsWith('Restore failed')
        ? error.message
        : 'Could not access browser storage. It may be unavailable or full.');
    }
  };

  const cancelRestore = () => {
    setPendingRestore(null);
    setStatus('Restore cancelled.');
  };

  return (
    <details className="pixel-panel mt-6 rounded bg-stone-950 p-4">
      <summary id="browser-data-backup" className="min-h-11 cursor-pointer py-2 font-pixel text-xs text-amber-400 underline decoration-amber-900 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
        Browser data backup
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-stone-300">
        Download or restore notes, tags, field photos, analysis marks, badges, settings, and references to your investigations. Files are limited to 8 MB and 500 entries. This file does not contain investigation state stored on the game server; session references work only with that same server. Backup files may contain private notes and photos, so store them carefully.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportSave}
          className="min-h-11 rounded border border-amber-800 px-3 text-sm font-semibold text-amber-200 hover:bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          Download browser data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Choose a SherlockAI save backup file"
          onChange={importFile}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-11 rounded border border-stone-700 px-3 text-sm text-stone-200 hover:bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          Restore browser data…
        </button>
        {reloadRequired && (
          <button
            type="button"
            ref={reloadButtonRef}
            onClick={() => window.location.reload()}
            className="min-h-11 rounded bg-amber-800 px-3 text-sm font-semibold text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Reload to apply
          </button>
        )}
      </div>
      {pendingRestore && (
        <section className="mt-3 rounded border border-amber-900 bg-stone-900 p-3" aria-labelledby="restore-preview-title">
          <h3 id="restore-preview-title" className="font-pixel text-xs text-amber-300">Review backup before restoring</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            {Object.keys(pendingRestore.entries).length} entries total: {pendingRestore.replacedCount} will replace data already in this browser, and {Object.keys(pendingRestore.entries).length - pendingRestore.replacedCount} will be added. Data not included in this file will remain unchanged.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmRestore}
              className="min-h-11 rounded bg-amber-800 px-3 text-sm font-semibold text-amber-100 hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Replace matching data and restore
            </button>
            <button
              type="button"
              onClick={cancelRestore}
              className="min-h-11 rounded border border-stone-700 px-3 text-sm text-stone-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      <p className="mt-2 min-h-5 text-xs text-stone-400" role="status" aria-live="polite">{status}</p>
    </details>
  );
}
