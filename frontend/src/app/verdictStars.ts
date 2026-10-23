import type { AccuseResult } from '../api/client';

const STARS_KEY = 'sherlock-stars';

type StarsMapRead = { map: Record<string, number>; failed: boolean };

function readStarsMap(): StarsMapRead {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STARS_KEY);
  } catch {
    return { map: Object.create(null) as Record<string, number>, failed: true };
  }

  if (raw === null) return { map: Object.create(null) as Record<string, number>, failed: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { map: Object.create(null) as Record<string, number>, failed: true };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { map: Object.create(null) as Record<string, number>, failed: true };
  }

  const valid = Object.create(null) as Record<string, number>;
  for (const [caseId, stars] of Object.entries(parsed)) {
    if (typeof stars === 'number' && Number.isInteger(stars) && stars >= 0 && stars <= 3) {
      valid[caseId] = stars;
    }
  }
  return { map: valid, failed: false };
}

/** 0–3 stars from a verdict: wrong accusations earn none; correct ones
 * scale with the normalized score so hints and wasted actions cost stars. */
export function starsFor(verdict: AccuseResult): number {
  if (!verdict.correct) return 0;
  const cap = verdict.breakdown && verdict.breakdown.multiplier > 1 ? 2000 : 1000;
  const ratio = verdict.score / cap;
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}

export function readBestStars(caseId: string): number {
  return readStarsMap().map[caseId] ?? 0;
}

export function writeBestStars(caseId: string, value: number): boolean {
  if (!Number.isInteger(value) || value < 0 || value > 3) return true;
  const result = readStarsMap();
  if (result.failed) return false;
  if (value <= (result.map[caseId] ?? 0)) return true;

  result.map[caseId] = value;
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify(result.map));
    return true;
  } catch {
    return false;
  }
}
