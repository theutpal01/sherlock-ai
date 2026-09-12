/** Shared layout shapes: every case ships one CaseLayout (hand-authored
 * gameplay coordinates; a tilemap can replace any file without touching
 * scene logic). Room topology must mirror that case's map.json. */

import type { FloorStyle, WallStyle } from '../art';

export interface RoomLayout {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floorStyle: FloorStyle;
  wallStyle: WallStyle;
  decor?: Array<{ tex: string; x: number; y: number; scale?: number }>;
}

export interface DoorLayout {
  id: string;
  roomId: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  targetRoomId: string;
}

export type ObjectSprite =
  | { kind: 'frame'; frame: number }
  | { kind: 'texture'; key: string }
  | { kind: 'image'; key: string };

export interface ObjectLayout {
  id: string;
  roomId: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  sprite: ObjectSprite;
  scale?: number;
  /** Evidence id revealed here (mirrors entities.json), for plate state. */
  evidence?: string;
}

export interface CaseLayout {
  caseId: string;
  rooms: RoomLayout[];
  spawns: Record<string, { x: number; y: number }>;
  doors: DoorLayout[];
  objects: ObjectLayout[];
  /** Ordered stand-spots per room; nth NPC (sorted by id) takes nth spot. */
  npcSpots: Record<string, Array<{ x: number; y: number }>>;
  worldW: number;
  worldH: number;
  startRoom: string;
}

export const NPC_RADIUS = 60;

export function roomName(layout: CaseLayout, roomId: string): string {
  return layout.rooms.find((r) => r.id === roomId)?.name ?? roomId;
}
