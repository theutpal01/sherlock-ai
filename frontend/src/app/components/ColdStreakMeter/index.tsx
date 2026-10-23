import { useEffect, useState } from 'react';

/**
 * Cold Streak: the detective's deduction combo. Every discovery that adds
 * new facts or deductions keeps the chain alive and heats the meter;
 * asking for a hint, restarting, or a wrong accusation cools it back down.
 * Pure presentation — it never mutates game/session state and never
 * reasons locally.
 */

/** Flame segments cap here so the bar fills fully, then the count keeps climbing. */
const MAX_SEGMENTS = 8;

interface Tier {
  min: number;
  label: string;
  bar: string; // filled-segment class
  text: string; // tier label class
}

const TIERS: Tier[] = [
  { min: 0, label: 'COLD', bar: 'bg-stone-600', text: 'text-stone-400' },
  { min: 1, label: 'WARMING', bar: 'bg-amber-500', text: 'text-amber-300' },
  { min: 3, label: 'ON THE TRAIL', bar: 'bg-amber-400', text: 'text-amber-200' },
  { min: 5, label: 'HOT', bar: 'bg-orange-500', text: 'text-orange-300' },
  { min: 8, label: 'ELEMENTARY!', bar: 'bg-red-500', text: 'text-red-300' },
];

function tierFor(streak: number): Tier {
  let t = TIERS[0];
  for (const tier of TIERS) {
    if (streak >= tier.min) t = tier;
  }
  return t;
}

export default function ColdStreakMeter({ streak }: { streak: number }) {
  const tier = tierFor(streak);
  const filled = Math.min(streak, MAX_SEGMENTS);
  const [pulse, setPulse] = useState(0);

  // Re-pulse the meter each time the streak climbs (a +1 arrives).
  useEffect(() => {
    if (streak > 0) setPulse((n) => n + 1);
  }, [streak]);

  return (
    <div className="rounded-lg border border-stone-800 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Cold Streak</h2>
        <span className={`font-pixel text-xs ${tier.text}`}>{tier.label}</span>
      </div>
      <div
        key={pulse}
        className="anim-streak-pulse mt-2 flex gap-1"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={MAX_SEGMENTS}
        aria-valuenow={Math.min(streak, MAX_SEGMENTS)}
        aria-label="Deduction streak"
        aria-valuetext={`${streak} ${streak === 1 ? 'discovery' : 'discoveries'} in a row — ${tier.label}`}
      >
        {Array.from({ length: MAX_SEGMENTS }).map((_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 rounded-sm ${i < filled ? tier.bar : 'bg-stone-800'}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-400">
        {streak === 0
          ? 'Chain discoveries back-to-back to heat up.'
          : `${streak} discovery${streak === 1 ? '' : 's'} in a row. A hint or a wrong guess cools it.`}
      </p>
    </div>
  );
}
