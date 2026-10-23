/** Preloaded 24x32 walk sheets for the detective and case NPCs. */
export const CHAR_IDS = [
  'player',
  'bob',
  'blackwood-heir',
  'blackwood-housekeeper',
  'blackwood-gardener',
  'blackwood-butler',
  'holloway-soprano',
  'holloway-stage-manager',
  'holloway-stagehand',
  'holloway-callboy',
  'saltmarsh-apprentice',
  'saltmarsh-cook',
  'saltmarsh-keeper',
  'conductor',
  'cook',
  'cora',
  'curator',
  'glasshouse-curator',
  'finn',
  'grey',
  'guard',
  'glasshouse-gardener',
  'glasshouse-groundskeeper',
  'hale',
  'innkeeper',
  'iris',
  'kit',
  'mara',
  'midnight-clerk',
  'midnight-guard',
  'midnight-porter',
  'nell',
  'otto',
  'passenger',
  'pia',
  'pip',
  'porter',
  'sable',
  'scholar',
  'starfall-scholar',
  'starfall-iris',
  'starfall-mara',
  'seth',
  'stablehand',
  'theo',
  'vera',
  'wren',
] as const;

export const DEDICATED_PORTRAIT_IDS = [
  'odda', 'corwin',
  'scholar', 'iris', 'mara',
  'celia', 'rowan', 'theo',
  'ada', 'arthur',
  'finn-mercer',
] as const;
const DEDICATED_PORTRAIT_ID_SET = new Set<string>(DEDICATED_PORTRAIT_IDS);

/** Reuse credited cast art where case-specific IDs have no dedicated sheet. */
const NPC_ART_IDS: Record<string, (typeof CHAR_IDS)[number]> = {
  odda: 'cook',
  corwin: 'stablehand',
  celia: 'curator',
  rowan: 'stablehand',
  ada: 'conductor',
  arthur: 'guard',
};
const CHAR_ID_SET = new Set<string>(CHAR_IDS);

const CASE_NPC_ART_IDS: Record<string, Record<string, (typeof CHAR_IDS)[number]>> = {
  blackwood_manor: {
    bob: 'blackwood-heir', mara: 'blackwood-housekeeper',
    theo: 'blackwood-gardener', grey: 'blackwood-butler',
  },
  holloway_theatre: {
    vera: 'holloway-soprano', nell: 'holloway-stage-manager',
    otto: 'holloway-stagehand', kit: 'holloway-callboy',
  },
  saltmarsh_lighthouse: {
    finn: 'saltmarsh-apprentice', odda: 'saltmarsh-cook', corwin: 'saltmarsh-keeper',
  },
  starfall_observatory: {
    scholar: 'starfall-scholar', iris: 'starfall-iris', mara: 'starfall-mara',
  },
  glasshouse_orchid: {
    celia: 'glasshouse-curator', rowan: 'glasshouse-gardener',
    theo: 'glasshouse-groundskeeper',
  },
  midnight_mail: {
    ada: 'midnight-clerk', arthur: 'midnight-guard', finn: 'midnight-porter',
  },
};

/** The player and case-specific NPC sheets loaded by one scene. */
export function characterAssetIdsForCase(caseId: string): (typeof CHAR_IDS)[number][] {
  const caseAssets = CASE_NPC_ART_IDS[caseId];
  if (!caseAssets) return [...CHAR_IDS];
  return [...new Set<(typeof CHAR_IDS)[number]>(['player', ...Object.values(caseAssets)])];
}

export function characterAssetId(npcId: string, caseId?: string): (typeof CHAR_IDS)[number] {
  const caseAssetId = CASE_NPC_ART_IDS[caseId ?? '']?.[npcId];
  if (caseAssetId) return caseAssetId;
  return NPC_ART_IDS[npcId] ??
    (CHAR_ID_SET.has(npcId) ? (npcId as (typeof CHAR_IDS)[number]) : 'player');
}

/** DOM portrait path for an NPC id (assets verified into public/). */
export function portrait(npcId: string, caseId?: string): string {
  const casePortraits: Record<string, Record<string, string>> = {
    blackwood_manor: {
      mara: 'blackwood-housekeeper', theo: 'blackwood-gardener', grey: 'blackwood-butler',
    },
    holloway_theatre: { kit: 'holloway-callboy' },
    saltmarsh_lighthouse: { finn: 'saltmarsh-apprentice' },
    midnight_mail: { finn: 'finn-mercer' },
  };
  const portraitId = casePortraits[caseId ?? '']?.[npcId] ??
    (DEDICATED_PORTRAIT_ID_SET.has(npcId) ? npcId : characterAssetId(npcId, caseId));
  return `/assets/faces/npc-${portraitId}.png`;
}
