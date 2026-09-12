import type { EvidenceDetail } from '../../../api/client';

/** React owns the notebook view; all facts come from the backend session. */
export default function EvidenceNotebook({ items }: { items: EvidenceDetail[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No evidence yet. Walk up to a blue object and press E.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded border border-stone-800 bg-stone-900 p-2">
          <p className="text-sm font-semibold text-stone-100">{item.title}</p>
          <p className="text-xs text-stone-400">{item.description}</p>
          <p className="mt-1 font-mono text-xs text-stone-500">{item.id} · {item.location}</p>
        </li>
      ))}
    </ul>
  );
}
