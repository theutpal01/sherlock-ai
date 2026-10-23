import { blackwoodLayout } from './blackwood';
import { hollowayLayout } from './holloway';
import { saltmarshLayout } from './saltmarsh';
import { starfallObservatoryLayout } from './starfall_observatory';
import { glasshouseOrchidLayout } from './glasshouse_orchid';
import { midnightMailLayout } from './midnight_mail';
import type { CaseLayout } from './types';

export type { CaseLayout, DoorLayout, ObjectLayout, RoomLayout } from './types';
export { NPC_RADIUS, roomName } from './types';

const REGISTRY: Record<string, CaseLayout> = {
  [blackwoodLayout.caseId]: blackwoodLayout,
  [hollowayLayout.caseId]: hollowayLayout,
  [saltmarshLayout.caseId]: saltmarshLayout,
  [starfallObservatoryLayout.caseId]: starfallObservatoryLayout,
  [glasshouseOrchidLayout.caseId]: glasshouseOrchidLayout,
  [midnightMailLayout.caseId]: midnightMailLayout,
};

export const CASE_IDS = Object.keys(REGISTRY);

/** Layout lookup by case id; falls back to Blackwood for unknown ids. */
export function getLayout(caseId: string): CaseLayout {
  return REGISTRY[caseId] ?? blackwoodLayout;
}
