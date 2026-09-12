import { blackwoodLayout } from './blackwood';
import { hollowayLayout } from './holloway';
import type { CaseLayout } from './types';

export type { CaseLayout, DoorLayout, ObjectLayout, RoomLayout } from './types';
export { NPC_RADIUS, roomName } from './types';

const REGISTRY: Record<string, CaseLayout> = {
  [blackwoodLayout.caseId]: blackwoodLayout,
  [hollowayLayout.caseId]: hollowayLayout,
};

/** Layout lookup by case id; falls back to Blackwood for unknown ids. */
export function getLayout(caseId: string): CaseLayout {
  return REGISTRY[caseId] ?? blackwoodLayout;
}
