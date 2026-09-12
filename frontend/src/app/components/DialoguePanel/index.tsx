import { useEffect, useRef, useState } from 'react';
import {
  ApiError,
  api,
  type DialogueListEntry,
  type DialogueNode,
  type EvidenceDetail,
} from '../../../api/client';
import { portrait } from '../../../game/art';

/**
 * Structured dialogue tree (spec section 10): no free-form generation.
 * Node text is fetched ONLY by visiting — the catalogue lists ids and
 * availability, never words. Responses advance via node ids.
 */
export default function DialoguePanel({
  sessionId,
  npcId,
  npcName,
  onVisit,
  onClose,
}: {
  sessionId: string;
  npcId: string;
  npcName: string;
  onVisit: (nodeId: string) => Promise<{
    node: DialogueNode;
    unlocked_evidence: EvidenceDetail[];
  }>;
  onClose: () => void;
}) {
  const [nodes, setNodes] = useState<DialogueListEntry[]>([]);
  const [current, setCurrent] = useState<DialogueNode | null>(null);
  const [unlocked, setUnlocked] = useState<EvidenceDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .dialogueList(sessionId)
      .then((list) => {
        if (!cancelled) setNodes(list.nodes.filter((n) => n.speaker === npcId));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load dialogue.');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, npcId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visit = async (nodeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await onVisit(nodeId);
      setCurrent(result.node);
      setUnlocked(result.unlocked_evidence);
      const list = await api.dialogueList(sessionId);
      setNodes(list.nodes.filter((n) => n.speaker === npcId));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `The thread is not available: ${err.message}`
          : 'Dialogue failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Conversation with ${npcName}`}
    >
      <div className="w-full max-w-lg rounded-lg border border-stone-700 bg-stone-950 p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={portrait(npcId)}
              alt={`${npcName} portrait`}
              width={80}
              height={78}
              className="pixel-img rounded border-2 border-stone-700 bg-stone-900"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h2 className="font-semibold text-stone-100">{npcName}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-800"
            aria-label="End conversation"
          >
            Leave (Esc)
          </button>
        </div>

        {current ? (
          <div aria-live="polite">
            <p className="text-sm italic text-stone-200">“{current.text}”</p>
            {unlocked.length > 0 && (
              <p className="mt-2 text-xs text-amber-200">
                Noted testimony: {unlocked.map((e) => e.title).join(' · ')}
              </p>
            )}
            <div className="mt-3 space-y-2">
              {current.responses.map((r) => (
                <button
                  key={r.next}
                  disabled={loading}
                  onClick={() => void visit(r.next)}
                  className="block w-full rounded border border-stone-700 px-3 py-2 text-left text-sm text-stone-100 hover:bg-stone-800 disabled:opacity-50"
                >
                  → {r.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-400">
            Choose what to ask. Locked threads open as you find evidence.
          </p>
        )}

        <div className="mt-4 border-t border-stone-800 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Threads
          </h3>
          <ul className="space-y-1">
            {nodes.map((n) => (
              <li key={n.id}>
                <button
                  disabled={!n.available || loading}
                  onClick={() => void visit(n.id)}
                  className="w-full rounded px-2 py-1 text-left font-mono text-xs text-stone-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {n.visited ? '✓' : n.available ? '○' : '🔒'} {n.id}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-300" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
