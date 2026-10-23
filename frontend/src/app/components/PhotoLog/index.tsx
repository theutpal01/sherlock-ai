import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

export interface Photo {
  id: string;
  src: string;
  title: string;
  room: string;
  counter: number;
}

type RemovalNotice =
  | { kind: 'removed'; photo: Photo; index: number }
  | { kind: 'restored'; title: string }
  | { kind: 'failed'; title: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function fieldReportHtml(caseId: string, photos: Photo[]): string {
  const caseTitle = caseId.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const entries = photos.map((photo) => `
    <article>
      <img src="${escapeHtml(photo.src)}" alt="Scene view in ${escapeHtml(photo.room)}: ${escapeHtml(photo.title)}">
      <h2>${escapeHtml(photo.title)}</h2>
      <p>${escapeHtml(photo.room)} · event #${photo.counter}</p>
    </article>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(caseTitle)} — Field Photo Report</title>
  <style>
    :root { color-scheme: dark; font: 16px/1.5 system-ui, sans-serif; background: #0c0a09; color: #f5f5f4; }
    body { margin: 0; padding: clamp(1rem, 4vw, 3rem); }
    main { max-width: 64rem; margin: 0 auto; }
    header { margin-bottom: 1.5rem; border-bottom: 1px solid #44403c; padding-bottom: 1rem; }
    h1 { color: #fcd34d; font-size: 1.4rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: 1rem; }
    article { min-width: 0; overflow: hidden; border: 1px solid #44403c; border-radius: .5rem; background: #1c1917; padding: .75rem; }
    img { display: block; width: 100%; height: auto; border-radius: .25rem; image-rendering: pixelated; }
    h2 { margin: .75rem 0 .25rem; font-size: 1rem; }
    p, small { color: #a8a29e; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(caseTitle)} — Field Photo Report</h1>
      <p>${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} · Exported ${new Date().toLocaleString()}</p>
      <small>Images are embedded in this file, so it can be opened offline.</small>
    </header>
    <section class="grid" aria-label="Field photos">${entries}
    </section>
  </main>
</body>
</html>`;
}

function PhotoViewer({
  photos,
  index,
  evidenceIds,
  onClose,
  onSelect,
  onFocusEvidence,
}: {
  photos: Photo[];
  index: number;
  evidenceIds: string[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onFocusEvidence: (id: string) => void;
}) {
  const photo = photos[index];
  const { dialogRef, handleKeyDown, skipFocusRestore } = useDialogFocus(onClose);
  const newer = photos[index - 1];
  const older = photos[index + 1];
  const evidenceId = photo.id.startsWith('manual-') ? null : photo.id;
  const canReviewEvidence = evidenceId !== null && evidenceIds.includes(evidenceId);
  const downloadName = `${photo.id.replace(/[^a-zA-Z0-9_-]/g, '-')}.jpg`;

  const handleViewerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    handleKeyDown(event);
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowLeft' && newer) {
      event.preventDefault();
      onSelect(newer.id);
    } else if (event.key === 'ArrowRight' && older) {
      event.preventDefault();
      onSelect(older.id);
    }
  };

  const reviewEvidence = () => {
    if (!canReviewEvidence || evidenceId === null) return;
    skipFocusRestore();
    onClose();
    onFocusEvidence(evidenceId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/95 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-viewer-title"
        tabIndex={-1}
        onKeyDown={handleViewerKeyDown}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-5xl flex-col rounded-lg border border-stone-700 bg-stone-950 p-3 outline-none sm:p-5"
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="photo-viewer-title" className="truncate text-lg font-semibold text-stone-100">
              {photo.title}
            </h2>
            <p className="mt-1 font-mono text-xs text-stone-400">
              {photo.room} · event #{photo.counter}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 rounded border border-stone-700 px-3 text-sm text-amber-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Close
          </button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded bg-black p-2">
          <img
            src={photo.src}
            alt={`Scene view in ${photo.room}: ${photo.title}`}
            className="pixel-img max-h-[min(68dvh,720px)] max-w-full object-contain"
          />
        </div>
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!newer}
              onClick={() => newer && onSelect(newer.id)}
              className="min-h-11 rounded border border-stone-700 px-3 text-sm text-stone-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Newer
            </button>
            <p aria-live="polite" aria-atomic="true" className="min-w-16 text-center font-mono text-xs text-stone-400">
              {photos.length - index} / {photos.length}
            </p>
            <button
              type="button"
              disabled={!older}
              onClick={() => older && onSelect(older.id)}
              className="min-h-11 rounded border border-stone-700 px-3 text-sm text-stone-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Older
            </button>
          </div>
          <a
            href={photo.src}
            download={downloadName}
            className="inline-flex min-h-11 items-center rounded border border-stone-700 px-3 text-sm text-stone-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Download photo
          </a>
          {canReviewEvidence && (
            <button
              type="button"
              onClick={reviewEvidence}
              className="inline-flex min-h-11 items-center rounded border border-amber-800 px-3 text-sm text-amber-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Open clue in Case File
            </button>
          )}
          {evidenceId !== null && !canReviewEvidence && (
            <p className="text-xs text-stone-400">
              This clue is not in the current investigation.
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

/**
 * Photo log: thumbnails snapped from the live scene at each discovery,
 * plus a manual shutter. Images persist per case (capped); newest first.
 */
export default function PhotoLog({
  caseId,
  photos,
  room,
  maxPhotos,
  evidenceIds,
  storageWarning,
  onManualSnap,
  onRemove,
  onRestore,
  onFocusEvidence,
}: {
  caseId: string;
  photos: Photo[];
  room: string;
  maxPhotos: number;
  evidenceIds: string[];
  storageWarning: boolean;
  onManualSnap: () => Promise<boolean>;
  onRemove: (id: string) => boolean;
  onRestore: (photo: Photo, index: number) => boolean;
  onFocusEvidence: (id: string) => void;
}) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [snapState, setSnapState] = useState<'idle' | 'capturing' | 'success' | 'error'>('idle');
  const [removalNotice, setRemovalNotice] = useState<RemovalNotice | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'success' | 'error'>('idle');
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeViewer = useCallback(() => setViewingId(null), []);
  const viewingIndex = viewingId ? photos.findIndex((photo) => photo.id === viewingId) : -1;

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const snap = async () => {
    if (snapState === 'capturing') return;
    setSnapState('capturing');
    try {
      setSnapState(await onManualSnap() ? 'success' : 'error');
    } catch {
      setSnapState('error');
    }
  };

  const exportFieldReport = () => {
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    let downloadStarted = false;
    try {
      url = URL.createObjectURL(new Blob([fieldReportHtml(caseId, photos)], { type: 'text/html;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = `sherlock-field-report-${caseId.replace(/[^a-z0-9_-]/gi, '-')}.html`;
      document.body.append(link);
      link.click();
      downloadStarted = true;
      setExportState('success');
    } catch {
      setExportState('error');
    } finally {
      link?.remove();
      if (url) {
        if (downloadStarted) {
          const downloadedUrl = url;
          window.setTimeout(() => URL.revokeObjectURL(downloadedUrl), 1000);
        } else {
          URL.revokeObjectURL(url);
        }
      }
    }
  };

  const removePhoto = (photo: Photo, index: number) => {
    if (!onRemove(photo.id)) return;
    setRemovalNotice({ kind: 'removed', photo, index });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setRemovalNotice(null);
      undoTimer.current = null;
    }, 5000);
  };

  const undoRemove = () => {
    if (!removalNotice || removalNotice.kind !== 'removed') return;
    const { photo, index } = removalNotice;
    const restored = onRestore(photo, index);
    setRemovalNotice({ kind: restored ? 'restored' : 'failed', title: photo.title });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setRemovalNotice(null);
      undoTimer.current = null;
    }, 5000);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-stone-400">
          {photos.length === 0
            ? 'No shots yet — new finds auto-snap.'
            : photos.length >= maxPhotos
              ? `${photos.length}/${maxPhotos} shots — new captures replace the oldest.`
              : `${photos.length}/${maxPhotos} shots.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={exportFieldReport}
              className="min-h-11 rounded border border-amber-800 px-2 py-1 text-xs text-amber-200 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Download all photos
            </button>
          )}
          <button
            type="button"
            onClick={snap}
            disabled={snapState === 'capturing'}
            aria-label={snapState === 'capturing' ? 'Capturing the current view' : `Snap the current view in ${room || 'this room'}`}
            className="min-h-11 rounded border border-stone-700 px-2 py-1 text-xs text-stone-200 hover:bg-stone-800 disabled:cursor-wait disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              shapeRendering="crispEdges"
              className="mr-1 inline-block align-[-2px]"
            >
              <path d="M2 4h3l1-2h4l1 2h3v10H2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8" cy="9" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {snapState === 'capturing' ? 'Capturing…' : 'Snap'}
          </button>
        </div>
      </div>
      {storageWarning && (
        <p role="status" aria-live="polite" className="mb-2 text-xs text-amber-300">
          Browser storage is unavailable or full. Photo changes may be lost if you switch investigations or reload.
        </p>
      )}
      {exportState !== 'idle' && (
        <p role="status" aria-live="polite" className={`mb-2 text-xs ${exportState === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
          {exportState === 'success' ? 'Offline field report downloaded.' : 'Could not create the field report.'}
        </p>
      )}
      {removalNotice && (
        <p role="status" aria-live="polite" aria-atomic="true" className="mb-2 flex flex-wrap items-center gap-2 text-xs text-stone-300">
          {removalNotice.kind === 'removed' ? (
            <>
              Photo removed from the field log.
              <button
                type="button"
                onClick={undoRemove}
                className="min-h-11 rounded px-2 font-semibold text-amber-300 underline decoration-amber-700 underline-offset-2 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                Undo remove
              </button>
            </>
          ) : removalNotice.kind === 'restored' ? (
            `${removalNotice.title} restored to the field log.`
          ) : (
            `Could not restore ${removalNotice.title}; the field log has changed.`
          )}
        </p>
      )}
      {snapState !== 'idle' && (
        <p
          role="status"
          aria-live="polite"
          className={`mb-2 text-xs ${snapState === 'error' ? 'text-red-300' : snapState === 'success' ? 'text-emerald-300' : 'text-stone-400'}`}
        >
          {snapState === 'capturing' && 'Capturing current view…'}
          {snapState === 'success' && 'Photo added to the field log.'}
          {snapState === 'error' && 'Could not capture this view. Try again.'}
        </p>
      )}
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2">
          {photos.map((photo, index) => (
            <li key={photo.id} className="rounded border border-stone-800 bg-stone-900 p-1">
              <button
                type="button"
                onClick={() => setViewingId(photo.id)}
                aria-label={`View full photo in ${photo.room}: ${photo.title}`}
                className="block min-h-11 w-full rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                <img
                  src={photo.src}
                  alt=""
                  loading="lazy"
                  className="pixel-img w-full rounded-sm"
                />
              </button>
              <p className="mt-1 truncate text-xs font-semibold text-stone-200" title={photo.title}>
                {photo.title}
              </p>
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-stone-400">
                  {photo.room} · event #{photo.counter}
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={photo.src}
                    download={`${photo.id.replace(/[^a-zA-Z0-9_-]/g, '-')}.jpg`}
                    aria-label={`Download photo ${photo.title}`}
                    title="Download photo"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded px-1 text-xs text-stone-300 hover:bg-stone-800 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges">
                      <path d="M8 1v8m0 0 3-3m-3 3L5 6M2 10v3h12v-3" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </a>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo, index)}
                    aria-label={`Remove photo ${photo.title}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded px-1 text-xs text-stone-300 hover:bg-stone-800 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-300"
                  >
                    <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 16 16" shapeRendering="crispEdges">
                      <path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {viewingIndex >= 0 && (
        <PhotoViewer
          photos={photos}
          index={viewingIndex}
          evidenceIds={evidenceIds}
          onClose={closeViewer}
          onSelect={setViewingId}
          onFocusEvidence={onFocusEvidence}
        />
      )}
    </div>
  );
}
