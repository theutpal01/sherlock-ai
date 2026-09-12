import type { CaseInfo, EvidenceDetail, World } from '../../../api/client';

/**
 * World guide: a text legend for everything the canvas shows — areas,
 * gates, suspects (with live locations), and evidence (found vs. not).
 * No spoilers: descriptions come from the public case detail endpoint.
 */
export default function WorldGuide({
  caseInfo,
  world,
  notebook,
}: {
  caseInfo: CaseInfo;
  world: World | null;
  notebook: EvidenceDetail[];
}) {
  const found = new Set(notebook.map((e) => e.id));
  const roomName = (id: string) => caseInfo.rooms.find((r) => r.id === id)?.name ?? id;
  const npcLocation = (id: string) =>
    world?.npcs.find((n) => n.id === id)?.location ?? '…';

  return (
    <div className="space-y-3">
      <details open>
        <summary className="cursor-pointer text-sm font-semibold text-stone-200">
          Areas ({caseInfo.rooms.length})
        </summary>
        <ul className="mt-1 space-y-1">
          {caseInfo.rooms.map((r) => (
            <li key={r.id} className="text-sm text-stone-300">
              <span className="font-semibold text-stone-100">{r.name}</span>
              <span className="text-stone-500"> — {r.description}</span>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-stone-200">
          Gates ({caseInfo.doors.length})
        </summary>
        <ul className="mt-1 space-y-1">
          {caseInfo.doors.map((d) => (
            <li key={d.id} className="font-mono text-xs text-stone-300">
              ◆ {d.between.map(roomName).join(' ↔ ')}
            </li>
          ))}
        </ul>
      </details>
      <details open>
        <summary className="cursor-pointer text-sm font-semibold text-stone-200">
          Suspects ({caseInfo.suspects.length})
        </summary>
        <ul className="mt-1 space-y-1">
          {caseInfo.suspects.map((id) => {
            const npc = caseInfo.npcs.find((n) => n.id === id);
            return (
              <li key={id} className="text-sm text-stone-300">
                <span className="font-semibold text-amber-200">{npc?.name ?? id}</span>
                <span className="text-stone-500">
                  {' '}
                  · {npc?.role ?? 'suspect'} · last seen: {roomName(npcLocation(id))}
                </span>
              </li>
            );
          })}
        </ul>
      </details>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-stone-200">
          Evidence ({found.size}/{caseInfo.evidence.length})
        </summary>
        <ul className="mt-1 space-y-1">
          {caseInfo.evidence.map((e) => (
            <li key={e.id} className="text-sm text-stone-300">
              {found.has(e.id) ? (
                <span className="text-emerald-300">✓ {e.title}</span>
              ) : (
                <span className="text-stone-500">○ {e.title}</span>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
