import { useEffect, useRef, useState } from 'react';
import {
  ApiError,
  api,
  type DialogueListEntry,
  type DialogueNode,
  type EvidenceDetail,
} from '../../../api/client';
import { portrait } from '../../../game/portraits';
import { useDialogFocus } from '../../hooks/useDialogFocus';

export type DialogueHistoryEntry = { question: string | null; answer: string };

function formatThreadLabel(id: string, speaker: string): string {
  const prefix = `${speaker}_`;
  const topic = id.startsWith(prefix) ? id.slice(prefix.length) : id;
  return topic
    .replace(/_(\d+)$/, ' · $1')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/**
 * Structured dialogue tree (spec section 10): no free-form generation.
 * Node text is fetched ONLY by visiting — the catalogue lists ids and
 * availability, never words. Responses advance via node ids.
 */
export default function DialoguePanel({
  sessionId,
  npcId,
  caseId,
  npcName,
  onVisit,
  history,
  onHistoryEntry,
  onFocusEvidence,
  onClose,
}: {
  sessionId: string;
  npcId: string;
  caseId: string;
  npcName: string;
  onVisit: (nodeId: string) => Promise<{
    node: DialogueNode;
    unlocked_evidence: EvidenceDetail[];
  }>;
  history: DialogueHistoryEntry[];
  onHistoryEntry: (entry: DialogueHistoryEntry) => void;
  onFocusEvidence: (id: string) => void;
  onClose: () => void;
}) {
  const [nodes, setNodes] = useState<DialogueListEntry[]>([]);
  const [current, setCurrent] = useState<DialogueNode | null>(null);
  const [unlocked, setUnlocked] = useState<EvidenceDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const visitRequestRef = useRef(0);
  const { dialogRef, handleKeyDown } = useDialogFocus(onClose);

  useEffect(() => {
    let cancelled = false;
    visitRequestRef.current += 1;
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
      visitRequestRef.current += 1;
    };
  }, [sessionId, npcId]);

  const visit = async (nodeId: string) => {
    const requestId = ++visitRequestRef.current;
    const question = current?.responses.find((response) => response.next === nodeId)?.text ?? null;
    setLoading(true);
    setError(null);
    try {
      const result = await onVisit(nodeId);
      if (requestId !== visitRequestRef.current) return;
      setCurrent(result.node);
      setUnlocked(result.unlocked_evidence);
      onHistoryEntry({ question, answer: result.node.text });
      const list = await api.dialogueList(sessionId);
      if (requestId === visitRequestRef.current) setNodes(list.nodes.filter((n) => n.speaker === npcId));
    } catch (err) {
      if (requestId !== visitRequestRef.current) return;
      setError(
        err instanceof ApiError
          ? `The thread is not available: ${err.message}`
          : 'Dialogue failed.',
      );
    } finally {
      if (requestId === visitRequestRef.current) setLoading(false);
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
      onKeyDown={handleKeyDown}
    >
      <div className="max-h-[calc(100dvh_-_2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-stone-700 bg-stone-950 p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={portrait(npcId, caseId)}
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
            className="min-h-11 rounded border border-stone-700 px-3 py-1 text-xs text-stone-300 hover:bg-stone-800"
            aria-label="End conversation"
          >
            Leave (Esc)
          </button>
        </div>

        {current ? (
          <div aria-live="polite">
            <p className="text-sm italic text-stone-200">“{current.text}”</p>
            {unlocked.length > 0 && (
              <div className="mt-2 text-xs text-amber-200">
                <p>Filed from this testimony:</p>
                <ul className="mt-1 space-y-1">
                  {unlocked.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => onFocusEvidence(e.id)}
                        className="min-h-11 text-left underline decoration-amber-700 underline-offset-2 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                      >
                        Review {e.title} in notebook
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {current.responses.map((r) => (
                <button
                  key={r.next}
                  disabled={loading}
                  onClick={() => void visit(r.next)}
                  className="block min-h-11 w-full rounded border border-stone-700 px-3 py-2 text-left text-sm text-stone-100 hover:bg-stone-800 disabled:opacity-50"
                >
                  {r.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-400">
            Choose what to ask. Locked threads open as you find evidence.
          </p>
        )}

        {history.length > 0 && (
          <details className="mt-4 rounded border border-stone-800 px-3 py-2">
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-stone-300 hover:text-stone-100">
              Conversation history · {history.length} {history.length === 1 ? 'reply' : 'replies'}
            </summary>
            <ol className="space-y-3 pb-2 text-sm" aria-label={`Visited dialogue with ${npcName}`}>
              {history.map((entry, index) => (
                <li key={`${index}:${entry.answer}`} className="border-l-2 border-stone-700 pl-3">
                  {entry.question && (
                    <p className="text-xs text-amber-300">You asked: {entry.question}</p>
                  )}
                  <p className="mt-1 text-stone-200">{npcName}: “{entry.answer}”</p>
                </li>
              ))}
            </ol>
          </details>
        )}

        <div className="mt-4 border-t border-stone-800 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Threads
          </h3>
          <ul className="space-y-1">
            {nodes.map((n) => {
              const status = n.visited ? 'Visited' : n.available ? 'Available' : 'Locked';
              return (
                <li key={n.id}>
                <button
                  type="button"
                  disabled={!n.available || loading}
                  onClick={() => void visit(n.id)}
                  aria-label={`${formatThreadLabel(n.id, npcId)} — ${status}`}
                  className="min-h-11 w-full rounded px-2 py-2 text-left font-mono text-xs text-stone-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  <span className={`mr-2 font-pixel text-[9px] ${n.visited ? 'text-amber-300' : n.available ? 'text-emerald-300' : 'text-stone-400'}`}>
                    {status.toUpperCase()}
                  </span>
                  {formatThreadLabel(n.id, npcId)}
                </button>
                </li>
              );
            })}
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
