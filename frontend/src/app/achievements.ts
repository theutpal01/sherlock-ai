import type { AccuseResult } from '../api/client';
import { CASE_IDS } from '../game/layouts';
import { readBestStars, starsFor } from './verdictStars';

/** Retention badges: purely frontend, derived from verdicts + best stars.
 * Nothing here touches the engine or scoring — it's a display layer over
 * data the player already earned. */

export interface Achievement {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-case', name: 'First Case Closed', desc: 'Solve any case with a correct accusation.' },
  { id: 'clean-sheet', name: 'Clean Sheet', desc: 'Solve a case without spending a single hint.' },
  { id: 'classic-master', name: 'Classic Master', desc: 'Solve a case in Classic mode (no hints allowed).' },
  { id: 'perfectionist', name: 'Perfectionist', desc: 'Earn a 3-star verdict.' },
  { id: 'nothing-overlooked', name: 'Nothing Overlooked', desc: 'Find every clue in a case before making a correct accusation.' },
  { id: 'completionist', name: 'Completionist', desc: 'Solve three different cases.' },
];

const UNLOCK_KEY = 'sherlock-achievements';
const SESSION_UNLOCKED = new Set<string>();

export interface AchievementUnlockResult {
  unlocked: Achievement[];
  persistenceFailed: boolean;
}

export function readUnlocked(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? '[]') as unknown;
    return new Set([
      ...(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []),
      ...SESSION_UNLOCKED,
    ]);
  } catch {
    return new Set(SESSION_UNLOCKED);
  }
}

function solvedCaseCount(): number {
  return CASE_IDS.filter((caseId) => readBestStars(caseId) > 0).length;
}

/**
 * Evaluate a fresh verdict against every badge; persist and return only
 * the newly unlocked ones so the overlay can celebrate exactly those.
 * Safe to call synchronously at accuse time: the completionist check reads
 * the best-stars map but counts the current case as solved when this very
 * verdict is correct, so no render-ordering trap with VerdictReport.
 */
export function unlockAtVerdict(
  caseId: string,
  verdict: AccuseResult,
  allEvidenceFound = false,
): AchievementUnlockResult {
  const unlocked = readUnlocked();
  const fresh: Achievement[] = [];
  const grant = (id: string) => {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) fresh.push(def);
    }
  };
  if (verdict.correct) {
    grant('first-case');
    if ((verdict.breakdown?.hint_cost ?? 0) === 0) grant('clean-sheet');
    if ((verdict.breakdown?.multiplier ?? 1) > 1) grant('classic-master');
    if (starsFor(verdict) === 3) grant('perfectionist');
    if (allEvidenceFound) grant('nothing-overlooked');
    const solved = solvedCaseCount() + (
      CASE_IDS.includes(caseId) && readBestStars(caseId) === 0 ? 1 : 0
    );
    if (solved >= 3) grant('completionist');
  }
  if (fresh.length === 0) return { unlocked: fresh, persistenceFailed: false };

  for (const achievement of fresh) SESSION_UNLOCKED.add(achievement.id);
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify([...unlocked]));
    return { unlocked: fresh, persistenceFailed: false };
  } catch {
    /* Keep this visit's badge progress and tell the player it may not persist. */
    return { unlocked: fresh, persistenceFailed: true };
  }
}
