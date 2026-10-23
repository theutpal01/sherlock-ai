/**
 * Ambient barks: flavor-only lines NPCs mutter when you share their room.
 * Never facts, never accusations — the engine owns all truth.
 */
export const BARKS: Record<string, string[]> = {
  bob: [
    'These shelves never dust themselves.',
    'Mind the clock. It keeps its own counsel.',
    'A quiet hall makes every footstep sound important.',
    'One can never have too many books, I say.',
  ],
  mara: [
    'Dinner will not serve itself, detective.',
    'I run a tight household here.',
    'Tea is best before it cools.',
    'There is always something left to set in order.',
  ],
  theo: [
    'The roses need pruning, whatever else happens.',
    'Mud? A gardener walks where the work is.',
    'Give the roses their space, detective.',
    'A garden rewards a little patience.',
  ],
  grey: [
    'The cellar keeps its cool, as do I.',
    'Vintages, detective. Nothing but vintages down here.',
    'A good glass deserves a quiet moment.',
    'Some evenings call for a slower pace.',
  ],
  vera: [
    'Places, places — the show abhors a delay.',
    'Nerves before curtain. Always.',
    'A little poise can carry one through anything.',
    'The stage feels larger when it is empty.',
  ],
  otto: [
    'These crates will not haul themselves.',
    'Rosin up, shoes ready, mind the ropes.',
    'A good prop looks convincing from the front row.',
    'Strike the set neatly and there is less to do tomorrow.',
  ],
  nell: [
    'The bell cues all of us, one way or another.',
    'I mark every entrance in this book.',
    'Fresh ink makes a tidy page.',
    'One page, then the next. That is the trick.',
  ],
  kit: [
    'A stitch in time, as they say.',
    'This curtain will outlast us all.',
    'A careful stitch can rescue an old hem.',
    'There is comfort in work done neatly.',
  ],
  finn: [
    'The lamp wants trimming by dusk.',
    'Tide waits for no keeper, nor apprentice.',
    'The wind changes its mind at sea.',
    'A clear night makes the water look endless.',
  ],
  odda: [
    'Bread first, questions after.',
    'The galley is the warmest room — stay a moment.',
    'A warm meal improves most conversations.',
    'There is always room for one more at the table.',
  ],
  corwin: [
    'Forty years I have kept this light.',
    'Log every hour. The sea forgives nothing.',
    'A lamp makes the dark less presumptuous.',
    'The light looks steady from shore, at least.',
  ],
};

/** Location-specific asides add atmosphere without changing the case's facts. */
const ROOM_BARKS: Record<string, Record<string, string[]>> = {
  bob: {
    library: ['A book never hurries an answer.', 'These volumes seem content to wait for a reader.'],
  },
  mara: {
    hall: ['A well-kept hall does most of the welcoming.', 'There is always one more thing to set straight.'],
  },
  theo: {
    garden: ['Even the neatest path has room for a wild rose.', 'Green looks better when it has room to breathe.'],
  },
  grey: {
    cellar: ['Down here, even the dust seems to keep its voice low.', 'Stone walls make good company for a quiet vintage.'],
  },
  vera: {
    auditorium: ['The empty seats are still an audience, in their way.', 'A fine room can make a whisper feel rehearsed.'],
  },
  nell: {
    stage: ['Every mark has its place before the curtain rises.', 'A cue should survive a little panic.'],
  },
  otto: {
    alley: ['A coil of rope is only useful when it remembers its loops.', 'Props behave better when they are put back neatly.'],
  },
  kit: {
    workshop: ['A neat stitch is the kind you never have to explain.', 'Thread always tangles when you look away.'],
  },
  finn: {
    bunkroom: ['A bunk feels smaller when the sea is loud.', 'The lantern makes the wood seem warmer than it is.'],
  },
  odda: {
    galley: ['A pot can make a cabin feel almost civilized.', 'Warm bread is better company than a cold stove.'],
  },
  corwin: {
    causeway: ['The wind always gets the last word out here.', 'The air tastes of salt even when the tide is out.'],
  },
};

export const GENERIC_BARKS = [
  'Hm? Oh — just thinking aloud.',
  'Carry on, detective.',
  'This place has ears, you know.',
];

export function barkFor(
  npcId: string,
  roomId: string,
  used: Set<string>,
  previous?: string,
): string {
  const lines = [...new Set([
    ...(BARKS[npcId] ?? GENERIC_BARKS),
    ...(ROOM_BARKS[npcId]?.[roomId] ?? []),
  ])];
  let choices = lines.filter((line) => !used.has(line));
  if (choices.length === 0) {
    // Begin a fresh shuffle bag without repeating the line that ended the last one.
    used.clear();
    choices = lines.filter((line) => line !== previous);
  }
  if (choices.length === 0) choices = lines;

  const selected = choices[Math.floor(Math.random() * choices.length)];
  used.add(selected);
  return selected;
}
