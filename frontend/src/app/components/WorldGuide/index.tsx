import { useState } from 'react';
import type { CaseInfo, EvidenceDetail, World } from '../../../api/client';
import { getLayout } from '../../../game/layouts';
import { portrait } from '../../../game/portraits';

function KeyMarker({ x, y, color, scale = 1 }: { x: number; y: number; color: string; scale?: number }) {
  return (
    <g aria-hidden="true" fill="none" stroke={color} strokeWidth={4 * scale} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={x - 5 * scale} cy={y - 5 * scale} r={5 * scale} />
      <path d={`M${x - scale} ${y - scale} L${x + 11 * scale} ${y + 11 * scale} M${x + 6 * scale} ${y + 6 * scale} l${4 * scale}-${4 * scale} M${x + 9 * scale} ${y + 9 * scale} l${4 * scale}-${4 * scale}`} />
    </g>
  );
}

type MapLegendKind = 'current' | 'explored' | 'unvisited' | 'available' | 'locked' | 'suspect' | 'unfound' | 'found' | 'key';

function MapLegendIcon({ kind }: { kind: MapLegendKind }) {
  const common = { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true as const, shapeRendering: 'crispEdges' as const };
  switch (kind) {
    case 'current':
      return <svg {...common}><rect x="1" y="1" width="14" height="14" rx="2" fill="#78350f" stroke="#fbbf24" strokeWidth="2" /></svg>;
    case 'explored':
      return <svg {...common}><rect x="1" y="1" width="14" height="14" rx="2" fill="#292524" stroke="#a8a29e" strokeWidth="2" /></svg>;
    case 'unvisited':
      return <svg {...common}><rect x="1" y="1" width="14" height="14" rx="2" fill="#0c0a09" stroke="#44403c" strokeWidth="2" /></svg>;
    case 'available':
      return <svg {...common}><rect x="2" y="2" width="12" height="12" rx="2" fill="#fbbf24" stroke="#451a03" strokeWidth="2" /><path d="m6 4 4 4-4 4" fill="none" stroke="#451a03" strokeWidth="2" /></svg>;
    case 'locked':
      return <svg {...common}><rect x="2" y="2" width="12" height="12" rx="2" fill="#fb7185" stroke="#881337" strokeWidth="2" /><path d="m5 5 6 6m0-6-6 6" fill="none" stroke="#881337" strokeWidth="2" /></svg>;
    case 'suspect':
      return <svg {...common}><circle cx="8" cy="8" r="6" fill="#581c87" stroke="#e9d5ff" strokeWidth="2" /></svg>;
    case 'unfound':
      return <svg {...common}><circle cx="8" cy="8" r="6" fill="#38bdf8" stroke="#082f49" strokeWidth="2" /></svg>;
    case 'found':
      return <svg {...common}><rect x="3" y="3" width="10" height="10" transform="rotate(45 8 8)" fill="#34d399" stroke="#064e3b" strokeWidth="2" /></svg>;
    case 'key':
      return <svg {...common}><KeyMarker x={8} y={8} color="#fbbf24" scale={0.5} /></svg>;
  }
}

/**
 * World guide: a text legend for everything the canvas shows — areas,
 * gates, suspects (with live locations), and evidence (found vs. not).
 * No spoilers: descriptions come from the public case detail endpoint.
 */
export default function WorldGuide({
  caseInfo,
  world,
  notebook,
  caseId,
  currentRoomId,
  visitedRooms,
  onFocusEvidence,
}: {
  caseInfo: CaseInfo;
  world: World | null;
  notebook: EvidenceDetail[];
  caseId: string;
  currentRoomId: string;
  visitedRooms: string[];
  onFocusEvidence: (evidenceId: string) => void;
}) {
  const [mapFocus, setMapFocus] = useState<{ caseId: string; roomId?: string; suspectId?: string } | null>(null);
  const layout = getLayout(caseId);
  const focusedSuspectId = mapFocus?.caseId === caseId ? mapFocus.suspectId : undefined;
  const focusedSuspect = focusedSuspectId
    ? world?.npcs.find((npc) => npc.id === focusedSuspectId)
    : undefined;
  const focusedRoomId = mapFocus?.caseId === caseId
    ? focusedSuspectId ? focusedSuspect?.location : mapFocus.roomId
    : undefined;
  const focusedRoomName = focusedRoomId
    ? layout.rooms.find((room) => room.id === focusedRoomId)?.name ?? null
    : null;
  const focusedRoom = focusedRoomId
    ? layout.rooms.find((room) => room.id === focusedRoomId)
    : undefined;
  const mapView = focusedRoom
    ? `${focusedRoom.x - 48} ${focusedRoom.y - 48} ${focusedRoom.w + 96} ${focusedRoom.h + 96}`
    : `0 0 ${layout.worldW} ${layout.worldH}`;
  const found = new Set(notebook.map((e) => e.id));
  const knownEvidence = new Map(notebook.map((e) => [e.id, e] as const));
  const visited = new Set([...visitedRooms, currentRoomId]);
  const caseDoorForPortal = (portal: (typeof layout.doors)[number]) =>
    caseInfo.doors.find(
      (door) => door.between.includes(portal.roomId) && door.between.includes(portal.targetRoomId),
    );
  const isDoorLocked = (door: (typeof caseInfo.doors)[number]) =>
    Boolean(door.locked && door.unlock_evidence && !found.has(door.unlock_evidence));
  const mapEvidence = layout.objects.filter((object) => object.evidence);
  const roomName = (id: string) => caseInfo.rooms.find((r) => r.id === id)?.name ?? id;
  const evidenceRoomName = (evidenceId: string) => {
    const roomId = mapEvidence.find((object) => object.evidence === evidenceId)?.roomId;
    return roomId ? roomName(roomId) : 'unknown location';
  };
  const currentRoutes = layout.doors
    .filter((portal) => portal.roomId === currentRoomId)
    .map((portal) => {
      const door = caseDoorForPortal(portal);
      const locked = door ? isDoorLocked(door) : false;
      const keyTitle = door?.unlock_evidence
        ? knownEvidence.get(door.unlock_evidence)?.title
        : undefined;
      return {
        description: locked
          ? `Locked to ${roomName(portal.targetRoomId)} — find ${keyTitle ?? 'the required key'}`
          : `Open to ${roomName(portal.targetRoomId)}`,
      };
    });
  const suspectIds = new Set(caseInfo.suspects);
  const suspectsByRoom = new Map<string, Array<{ id: string; name: string }>>();
  for (const npc of world?.npcs ?? []) {
    if (!suspectIds.has(npc.id)) continue;
    const occupants = suspectsByRoom.get(npc.location) ?? [];
    occupants.push({ id: npc.id, name: npc.name });
    suspectsByRoom.set(npc.location, occupants);
  }
  const npcLocation = (id: string) =>
    world?.npcs.find((n) => n.id === id)?.location;
  // Demeanor: flavor-only read of the investigation's heat. The backend
  // owns positions and truth; this just narrates the event counter.
  const demeanor = () => {
    const heat = world?.event_counter ?? 0;
    if (heat >= 7) return 'on edge';
    if (heat >= 3) return 'watching you';
    return 'settled into routine';
  };

  return (
    <div className="space-y-3">
      <section aria-labelledby="world-map-title">
        <div className="mb-1 flex min-h-11 items-center justify-between gap-2">
          <h3 id="world-map-title" className="text-sm font-semibold text-stone-200">Case map</h3>
          <button
            type="button"
            onClick={() => setMapFocus(null)}
            className="inline-flex min-h-11 items-center rounded px-2 text-xs font-medium text-sky-300 underline underline-offset-2 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            aria-label="Fit all areas on the case map"
          >
            Fit all areas
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {focusedRoomName
            ? `${focusedSuspect ? `${focusedSuspect.name} last seen in ` : ''}${focusedRoomName} highlighted on the case map.`
            : ''}
        </p>
        <svg
          id="case-map"
          viewBox={mapView}
          className="block w-full rounded border border-stone-800 bg-stone-950"
          role="group"
          aria-label={`Case map showing rooms, doorways, clue markers, and last-seen suspect locations. Current room: ${roomName(currentRoomId)}.`}
        >
          <title>Case map — current room: {roomName(currentRoomId)}</title>
          {layout.rooms.map((room) => {
            const current = room.id === currentRoomId;
            const focused = focusedRoomId === room.id;
            const explored = visited.has(room.id);
            const roomClues = layout.objects.filter((object) => object.roomId === room.id && object.evidence);
            const foundInRoom = roomClues.filter((object) => found.has(object.evidence!)).length;
            const roomSuspects = suspectsByRoom.get(room.id) ?? [];
            const suspectMarkerX = room.x + room.w - 58;
            const suspectMarkerY = room.y + 58;
            const suspectClipId = `suspect-portrait-${caseId}-${room.id}`;
            return (
              <g key={room.id}>
                <rect
                  x={room.x + 12}
                  y={room.y + 12}
                  width={room.w - 24}
                  height={room.h - 24}
                  rx="18"
                  fill={current ? '#78350f' : explored ? '#292524' : '#0c0a09'}
                  stroke={current ? '#fbbf24' : focused ? '#38bdf8' : explored ? '#a8a29e' : '#44403c'}
                  strokeWidth={current || focused ? '12' : '8'}
                />
                {layout.doors.filter((door) => door.roomId === room.id).map((door) => {
                  const caseDoor = caseDoorForPortal(door);
                  const locked = caseDoor ? isDoorLocked(caseDoor) : false;
                  const centerX = door.x + door.w / 2;
                  const centerY = door.y + door.h / 2;
                  const fromCurrentRoom = door.roomId === currentRoomId;
                  const routeContext = fromCurrentRoom ? ' from your current room' : '';
                  const label = locked
                    ? `${roomName(door.targetRoomId)} doorway locked${routeContext}. A key is required.`
                    : `${roomName(door.targetRoomId)} doorway available${routeContext}.`;
                  return (
                    <g key={door.id} role="img" aria-label={label}>
                      <title>{label}</title>
                      {fromCurrentRoom && (
                        <circle
                          cx={centerX}
                          cy={centerY}
                          r="23"
                          fill="none"
                          stroke="#fef3c7"
                          strokeWidth="4"
                        />
                      )}
                      <rect
                        x={centerX - 14}
                        y={centerY - 14}
                        width="28"
                        height="28"
                        rx="4"
                        fill={locked ? '#fb7185' : '#fbbf24'}
                        stroke={locked ? '#881337' : '#451a03'}
                        strokeWidth="6"
                      />
                      {locked ? (
                        <g aria-hidden="true">
                          <path
                            d={`M ${centerX - 4} ${centerY - 2} V ${centerY - 5} C ${centerX - 4} ${centerY - 10} ${centerX + 4} ${centerY - 10} ${centerX + 4} ${centerY - 5} V ${centerY - 2}`}
                            fill="none"
                            stroke="#881337"
                            strokeWidth="2.5"
                          />
                          <rect x={centerX - 6} y={centerY - 2} width="12" height="9" rx="1" fill="#881337" />
                          <circle cx={centerX} cy={centerY + 2} r="1.5" fill="#fb7185" />
                        </g>
                      ) : (
                        <g aria-hidden="true" fill="none" stroke="#451a03" strokeWidth="2">
                          <path d={`M ${centerX - 6} ${centerY - 8} V ${centerY + 8} L ${centerX + 5} ${centerY + 5} V ${centerY - 5} Z`} />
                          <circle cx={centerX + 2} cy={centerY} r="1" fill="#451a03" stroke="none" />
                        </g>
                      )}
                    </g>
                  );
                })}
                <text
                  x={room.x + room.w / 2}
                  y={room.y + room.h / 2 + (current ? -8 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={current ? '#fef3c7' : explored ? '#d6d3d1' : '#a8a29e'}
                  fontFamily="VT323, monospace"
                  fontSize="80"
                >
                  {room.name}
                </text>
                {current && (
                  <text
                    x={room.x + room.w / 2}
                    y={room.y + room.h / 2 + 52}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fcd34d"
                    fontFamily="Press Start 2P, monospace"
                    fontSize="72"
                  >
                    HERE
                  </text>
                )}
                {explored && roomClues.length > 0 && (
                  <text
                    x={room.x + room.w / 2}
                    y={room.y + room.h / 2 + 112}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={foundInRoom === roomClues.length ? '#86efac' : '#bae6fd'}
                    fontFamily="Press Start 2P, monospace"
                    fontSize="28"
                    aria-label={`${foundInRoom} of ${roomClues.length} clues found in ${room.name}`}
                  >
                    CLUES {foundInRoom}/{roomClues.length}
                  </text>
                )}
                {roomSuspects.length > 0 && (
                  <g role="img" aria-label={`${roomSuspects.map((occupant) => occupant.name).join(', ')} last seen in ${room.name}`}>
                    <title>{`${roomSuspects.map((occupant) => occupant.name).join(', ')} last seen in ${room.name}`}</title>
                    {focusedSuspect && roomSuspects.some((occupant) => occupant.id === focusedSuspect.id) && (
                      <circle
                        cx={suspectMarkerX}
                        cy={suspectMarkerY}
                        r="40"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="7"
                        strokeDasharray="8 5"
                      />
                    )}
                    <circle
                      cx={suspectMarkerX}
                      cy={suspectMarkerY}
                      r="34"
                      fill="#581c87"
                      stroke="#e9d5ff"
                      strokeWidth="6"
                    />
                    <defs>
                      <clipPath id={suspectClipId}>
                        <circle cx={suspectMarkerX} cy={suspectMarkerY} r="29" />
                      </clipPath>
                    </defs>
                    <image
                      href={portrait(roomSuspects[0].id, caseId)}
                      x={suspectMarkerX - 29}
                      y={suspectMarkerY - 29}
                      width="58"
                      height="58"
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#${suspectClipId})`}
                    />
                    {roomSuspects.length > 1 && (
                      <g aria-hidden="true">
                        <circle cx={suspectMarkerX + 23} cy={suspectMarkerY - 23} r="16" fill="#581c87" stroke="#faf5ff" strokeWidth="3" />
                        <text
                          x={suspectMarkerX + 23}
                          y={suspectMarkerY - 22}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#faf5ff"
                          fontFamily="Press Start 2P, monospace"
                          fontSize="12"
                        >
                          {roomSuspects.length}
                        </text>
                      </g>
                    )}
                  </g>
                )}
                {layout.objects
                  .filter((object) => object.roomId === room.id && object.evidence)
                  .map((object) => {
                    const discovered = found.has(object.evidence!);
                    if (!discovered && !visited.has(room.id)) return null;
                    const evidence = caseInfo.evidence.find((item) => item.id === object.evidence);
                    const isKnownKey = discovered && knownEvidence.get(object.evidence!)?.category === 'key';
                    return discovered ? (
                      <g
                        key={object.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${evidence?.title ?? 'found clue'}${isKnownKey ? ' (key clue)' : ''} from ${roomName(room.id)} in the evidence notebook`}
                        className="cursor-pointer focus-visible:outline focus-visible:outline-amber-300 focus-visible:outline-offset-4"
                        onClick={() => onFocusEvidence(object.evidence!)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onFocusEvidence(object.evidence!);
                          }
                        }}
                      >
                        <title>Open {evidence?.title ?? 'found clue'}{isKnownKey ? ' (key clue)' : ''} from {roomName(room.id)} in the evidence notebook</title>
                        <rect
                          x={object.x - 26}
                          y={object.y - 26}
                          width="52"
                          height="52"
                          rx="4"
                          transform={`rotate(45 ${object.x} ${object.y})`}
                          fill="#34d399"
                          stroke="#064e3b"
                          strokeWidth="8"
                        />
                        {isKnownKey && <KeyMarker x={object.x} y={object.y} color="#064e3b" scale={1.1} />}
                      </g>
                    ) : (
                      <g key={object.id} role="img" aria-label={`Unfound clue location in ${roomName(room.id)}`}>
                        <title>Unfound clue location in an explored room</title>
                        <circle
                          cx={object.x}
                          cy={object.y}
                          r="30"
                          fill="#38bdf8"
                          stroke="#082f49"
                          strokeWidth="8"
                        />
                      </g>
                    );
                  })}
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-400">
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="current" />You are here</span>
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="explored" />Explored</span>
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="unvisited" />Unvisited</span>
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="available" />Available doorway</span>
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="locked" />Locked doorway</span>
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="suspect" />Suspects last seen</span>
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="unfound" />Unfound clue in explored room</span>
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="found" />Clue found · select to open notebook</span>
          <span className="inline-flex items-center gap-1"><MapLegendIcon kind="key" />Key clue found in notebook</span>
        </div>
        <p className="mt-1 text-xs text-stone-300" role="status">
          From {roomName(currentRoomId)}: {currentRoutes.length > 0
            ? currentRoutes.map((route) => route.description).join(' · ')
            : 'No adjoining areas listed.'}
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Map markers show clue locations. Use Areas for room status, Gates for destinations and key requirements, and Suspects for last-seen locations.{' '}
          Use Locate beside an area or reported suspect to highlight it on the map. Select a found clue marker or entry below to open it in the notebook.
        </p>
      </section>
      <details open>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-stone-200 focus-visible:outline focus-visible:outline-amber-300">
          Areas ({caseInfo.rooms.length})
        </summary>
        <ul className="mt-1 space-y-1">
          {caseInfo.rooms.map((r) => {
            const roomEvidence = mapEvidence.filter((object) => object.roomId === r.id);
            const roomFound = roomEvidence.filter((object) => object.evidence && found.has(object.evidence)).length;
            const explored = visited.has(r.id);
            return (
              <li key={r.id} className="text-sm text-stone-300">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="font-semibold text-stone-100">{r.name}</span>
                  <span className="font-mono text-[10px] text-stone-400">
                    {r.id === currentRoomId ? 'YOU ARE HERE' : explored ? 'EXPLORED' : 'UNVISITED'}
                  </span>
                  {explored && roomEvidence.length > 0 && (
                    <span className="font-mono text-[10px] text-sky-300">
                      CLUES {roomFound}/{roomEvidence.length}
                    </span>
                  )}
                  <a
                    href="#case-map"
                    aria-label={mapFocus?.caseId === caseId && mapFocus.roomId === r.id
                      ? `Show ${r.name} on the case map again`
                      : `Locate ${r.name} on the case map`}
                    onClick={() => setMapFocus({ caseId, roomId: r.id })}
                    className="inline-flex min-h-11 items-center rounded px-1 text-sky-300 underline underline-offset-2 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >
                    {mapFocus?.caseId === caseId && mapFocus.roomId === r.id ? 'Shown on map' : 'Locate'}
                  </a>
                </div>
                <span className="block text-stone-400">{r.description}</span>
              </li>
            );
          })}
        </ul>
      </details>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-stone-200 focus-visible:outline focus-visible:outline-amber-300">
          Gates ({caseInfo.doors.length})
        </summary>
        <ul className="mt-1 space-y-1">
          {caseInfo.doors.map((d) => {
            const locked = isDoorLocked(d);
            const discoveredKeyTitle = d.unlock_evidence
              ? knownEvidence.get(d.unlock_evidence)?.title
              : undefined;
            return (
              <li key={d.id} className="font-mono text-xs text-stone-300">
                <span className={`inline-flex items-center gap-1 ${locked ? 'text-rose-300' : 'text-amber-300'}`}>
                  <MapLegendIcon kind={locked ? 'locked' : 'available'} />
                  {locked ? 'LOCKED' : 'OPEN'}
                </span>
                {' '}{d.between.map(roomName).join(' to ')}
                {locked && (
                  <span className="text-stone-400">
                    {' '}· Find {discoveredKeyTitle ?? 'the required key'}
                  </span>
                )}
                {!locked && discoveredKeyTitle && d.unlock_evidence && (
                  <span className="text-stone-400">
                    {' '}· Opened with{' '}
                    <button
                      type="button"
                      aria-label={`Open ${discoveredKeyTitle} in the evidence notebook`}
                      className="inline-flex min-h-11 items-center rounded px-1 text-sky-300 underline underline-offset-2 hover:text-sky-100 focus-visible:outline focus-visible:outline-amber-300"
                      onClick={() => onFocusEvidence(d.unlock_evidence!)}
                    >
                      {discoveredKeyTitle}
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      <details open>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-stone-200 focus-visible:outline focus-visible:outline-amber-300">
          Suspects ({caseInfo.suspects.length})
        </summary>
        {world && (
          <p className="mb-2 text-xs text-stone-400">
            Case atmosphere: <span className="text-amber-200">{demeanor()}</span>
          </p>
        )}
        <ul className="mt-1 space-y-1">
          {caseInfo.suspects.map((id) => {
            const npc = caseInfo.npcs.find((n) => n.id === id);
            const suspectName = npc?.name ?? id;
            const location = npcLocation(id);
            const locatedRoom = location ? layout.rooms.find((room) => room.id === location) : undefined;
            const suspectFocused = mapFocus?.caseId === caseId && mapFocus.suspectId === id;
            return (
              <li key={id} className="flex flex-wrap items-center gap-2 py-1 text-sm text-stone-300">
                <img
                  src={portrait(id, caseId)}
                  alt=""
                  width={40}
                  height={39}
                  loading="lazy"
                  className="pixel-img shrink-0 rounded border border-purple-900 bg-stone-950"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block">
                    <span className="font-semibold text-amber-200">{suspectName}</span>
                    <span className="ml-2 text-xs text-stone-400">{npc?.role ?? 'suspect'}</span>
                  </span>
                  <span className="block text-xs text-stone-400">
                    {locatedRoom
                      ? `Last seen: ${locatedRoom.name}`
                      : location ? 'Last seen: area not on map'
                      : world ? 'Location not reported yet' : 'Waiting for location data'}
                  </span>
                </span>
                {locatedRoom && (
                  <a
                    href="#case-map"
                    aria-label={suspectFocused
                      ? `Show ${suspectName} on the case map again`
                      : `Locate ${suspectName}, last seen in ${locatedRoom.name}, on the case map`}
                    aria-current={suspectFocused ? 'location' : undefined}
                    onClick={() => setMapFocus({ caseId, suspectId: id })}
                    className="inline-flex min-h-11 shrink-0 items-center rounded px-1 text-sky-300 underline underline-offset-2 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >
                    {suspectFocused ? 'Shown on map' : 'Locate'}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-stone-200 focus-visible:outline focus-visible:outline-amber-300">
          Evidence ({found.size}/{caseInfo.evidence.length})
        </summary>
        <ul className="mt-1 space-y-1">
          {caseInfo.evidence.map((e) => (
            <li key={e.id} className="text-sm text-stone-300">
              {found.has(e.id) ? (
                <button
                  type="button"
                  aria-label={`Open ${e.title} from ${evidenceRoomName(e.id)} in the evidence notebook`}
                  onClick={() => onFocusEvidence(e.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded px-1 text-left text-emerald-300 hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 focus-visible:outline-offset-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapLegendIcon kind="found" />
                    <span className="flex min-w-0 flex-col">
                      <span>{e.title}</span>
                      <span className="text-xs text-stone-400">In {evidenceRoomName(e.id)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-amber-300">Open notebook</span>
                </button>
              ) : (
                <span className="flex min-h-11 items-center gap-2 text-stone-400">
                  <MapLegendIcon kind="unfound" />Undiscovered evidence
                </span>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
