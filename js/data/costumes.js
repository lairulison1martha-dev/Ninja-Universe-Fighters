/**
 * Costumes and skins.
 *
 * The roster is 110 unique people. Alternate ages, titles, masks and Edo
 * versions are not separate fighters — they are costumes on the one fighter,
 * and *awakenings* (Sage Mode, the Gates, Karma, Susanoo…) are transformations,
 * which live in js/data/transformations.js.
 *
 * A costume changes appearance and, where it makes sense, swaps an ability
 * loadout. It never changes who you are picking: choosing Hokage Naruto is
 * still choosing Naruto Uzumaki, so he cannot end up fighting himself and the
 * roster cannot grow duplicates through the back door.
 *
 * `legacyId` records the roster card this costume replaced, which is what the
 * save migration uses to convert an old unlock into a costume unlock.
 */

/**
 * @typedef {Object} Costume
 * @property {string} id
 * @property {string} name
 * @property {Object} unlockRule       what has to happen to earn it
 * @property {string} [legacyId]       the roster card this replaced
 * @property {string} [spriteSetId]    its own sprite set, when art exists
 * @property {string} [portrait]       its own portrait, when art exists
 * @property {string} [preview]        select-screen preview image
 * @property {boolean} [paletteFallback] true = safe to render with base art
 * @property {'complete'|'placeholder'|'fallback'} assetStatus
 */

/** Asset status values, in order of how finished they are. */
export const ASSET_STATUS = Object.freeze({
  /** Its own sprite set exists and has every required animation. */
  COMPLETE: 'complete',
  /** Its own sprite set exists but is knowingly stand-in art. */
  PLACEHOLDER: 'placeholder',
  /** No art of its own — renders with the fighter's base set. */
  FALLBACK: 'fallback',
});

const DEFAULT_OUTFIT = {
  id: 'default',
  name: 'Default Outfit',
  unlockRule: { type: 'default' },
  assetStatus: ASSET_STATUS.FALLBACK,
  paletteFallback: true,
  spriteSetId: null,
  portrait: null,
  preview: null,
};

/** Costume lists per fighter. Everyone implicitly has `default` first. */
export const COSTUMES = Object.freeze({
  naruto: [
    { id: 'kid', name: 'Academy Days', legacyId: null, unlockRule: { type: 'default' } },
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'the_last', name: 'The Last', legacyId: 'rtn_naruto', unlockRule: { type: 'mastery', value: 3 } },
    { id: 'hokage', name: 'Seventh Hokage', legacyId: 'naruto_hokage', unlockRule: { type: 'mastery', value: 5 } },
    { id: 'adult', name: 'Adult', legacyId: 'naruto_adult', unlockRule: { type: 'mastery', value: 5 } },
  ],
  sasuke: [
    { id: 'kid', name: 'Academy Days', unlockRule: { type: 'default' } },
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'the_last', name: 'The Last', legacyId: 'rtn_sasuke', unlockRule: { type: 'mastery', value: 3 } },
    { id: 'adult', name: 'Adult', legacyId: 'sasuke_adult', unlockRule: { type: 'mastery', value: 5 } },
  ],
  sakura: [
    { id: 'genin', name: 'Genin', unlockRule: { type: 'default' } },
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'sakura_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  kakashi: [
    { id: 'young', name: 'Young Kakashi', legacyId: 'kakashi_young', unlockRule: { type: 'mastery', value: 2 } },
    { id: 'anbu', name: 'ANBU', legacyId: 'sakumo', unlockRule: { type: 'mastery', value: 3 } },
    { id: 'jonin', name: 'Jonin', unlockRule: { type: 'default' } },
    { id: 'hokage', name: 'Sixth Hokage', legacyId: 'kakashi_hokage', unlockRule: { type: 'mastery', value: 5 } },
  ],
  obito: [
    { id: 'young', name: 'Young Obito', legacyId: 'obito_young', unlockRule: { type: 'mastery', value: 2 } },
    { id: 'tobi', name: 'Tobi', unlockRule: { type: 'mastery', value: 3 } },
    { id: 'masked', name: 'Masked', unlockRule: { type: 'default' } },
    { id: 'white_mask', name: 'White Mask', unlockRule: { type: 'mastery', value: 4 } },
    { id: 'war', name: 'War Arc', legacyId: 'rin', unlockRule: { type: 'mastery', value: 5 } },
  ],
  madara: [
    { id: 'young', name: 'Young Madara', legacyId: 'madara_young', unlockRule: { type: 'mastery', value: 2 } },
    { id: 'valley', name: 'Valley of the End', unlockRule: { type: 'default' } },
    { id: 'war', name: 'War Arc', unlockRule: { type: 'mastery', value: 3 } },
    { id: 'edo', name: 'Edo Tensei', legacyId: 'madara_edo', unlockRule: { type: 'mastery', value: 4 } },
  ],
  gaara: [
    { id: 'genin', name: 'Chunin Exams', unlockRule: { type: 'default' } },
    { id: 'kazekage', name: 'Fifth Kazekage', legacyId: 'gaara_kazekage', unlockRule: { type: 'mastery', value: 4 } },
    { id: 'adult', name: 'Adult', legacyId: 'gaara_adult', unlockRule: { type: 'mastery', value: 5 } },
  ],
  minato: [
    { id: 'young', name: 'Young Minato', legacyId: 'minato_young', unlockRule: { type: 'mastery', value: 2 } },
    { id: 'hokage', name: 'Fourth Hokage', unlockRule: { type: 'default' } },
  ],
  hashirama: [
    { id: 'young', name: 'Warring States', legacyId: 'hashirama_young', unlockRule: { type: 'mastery', value: 3 } },
    { id: 'hokage', name: 'First Hokage', unlockRule: { type: 'default' } },
  ],
  tobirama: [
    { id: 'young', name: 'Warring States', legacyId: 'tobirama_young', unlockRule: { type: 'mastery', value: 3 } },
    { id: 'hokage', name: 'Second Hokage', unlockRule: { type: 'default' } },
  ],
  hiruzen: [
    { id: 'young', name: 'The Professor', legacyId: 'hiruzen_young', unlockRule: { type: 'mastery', value: 3 } },
    { id: 'elder', name: 'Third Hokage', unlockRule: { type: 'default' } },
  ],
  jiraiya: [
    { id: 'young', name: 'Young Jiraiya', legacyId: 'jiraiya_young', unlockRule: { type: 'mastery', value: 2 } },
    { id: 'sannin', name: 'Toad Sage', unlockRule: { type: 'default' } },
  ],
  orochimaru: [
    { id: 'young', name: 'Young Orochimaru', legacyId: 'orochimaru_young', unlockRule: { type: 'mastery', value: 2 } },
    { id: 'sannin', name: 'Sannin', unlockRule: { type: 'default' } },
  ],
  tsunade: [
    { id: 'young', name: 'Young Tsunade', legacyId: 'tsunade_young', unlockRule: { type: 'mastery', value: 2 } },
    { id: 'hokage', name: 'Fifth Hokage', unlockRule: { type: 'default' } },
  ],
  guy: [
    { id: 'young', name: 'Young Guy', legacyId: 'guy_young', unlockRule: { type: 'mastery', value: 2 } },
    { id: 'jonin', name: 'Jonin', unlockRule: { type: 'default' } },
  ],
  lee: [
    { id: 'genin', name: 'Chunin Exams', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'lee_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  boruto: [
    { id: 'genin', name: 'Genin', unlockRule: { type: 'default' } },
    { id: 'timeskip', name: 'Time Skip', legacyId: 'houki', unlockRule: { type: 'mastery', value: 4 } },
  ],
  hinata: [
    { id: 'genin', name: 'Genin', unlockRule: { type: 'default' } },
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'hinata_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  shikamaru: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'shikamaru_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  choji: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'choji_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  ino: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'ino_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  kiba: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'kiba_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  shino: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'shino_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  tenten: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'tenten_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  sai: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'sai_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  temari: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'temari_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  kankuro: [
    { id: 'shippuden', name: 'Shippuden', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'kankuro_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  konohamaru: [
    { id: 'genin', name: 'Genin', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Jonin', legacyId: 'konohamaru_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  hanabi: [
    { id: 'genin', name: 'Genin', unlockRule: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'hanabi_adult', unlockRule: { type: 'mastery', value: 4 } },
  ],
  momoshiki: [
    { id: 'base', name: 'Base', unlockRule: { type: 'default' } },
  ],
  white_zetsu: [
    { id: 'base', name: 'White Zetsu', legacyId: 'zetsu', unlockRule: { type: 'default' } },
  ],
});

/**
 * Costume ids that have their own generated sprite set.
 *
 * This list is what separates "we drew it" from "it borrows the base body".
 * It is checked against the asset manifest by a test, so a costume cannot
 * claim finished art it does not have.
 */
export const COSTUMES_WITH_ART = Object.freeze([
  'naruto:kid', 'naruto:shippuden', 'naruto:hokage',
  'sasuke:kid', 'sasuke:shippuden', 'sasuke:adult',
  'sakura:genin', 'sakura:shippuden',
  'kakashi:jonin', 'kakashi:hokage',
  'gaara:genin', 'gaara:kazekage',
  'hinata:genin', 'hinata:shippuden',
  'obito:young', 'obito:masked',
  'madara:valley', 'madara:war',
]);

const WITH_ART = new Set(COSTUMES_WITH_ART);

/**
 * Fill in the derived fields once, at module load.
 *
 * A costume with its own sprite set points at it and is `complete`; everything
 * else is explicitly `fallback` and renders with the fighter's base art. There
 * is deliberately no middle state where a costume silently looks finished.
 */
function decorate(fighterId, c) {
  const key = `${fighterId}:${c.id}`;
  const hasArt = WITH_ART.has(key);
  return Object.freeze({
    ...c,
    fighterId,
    unlockRule: c.unlockRule || c.unlock || { type: 'default' },
    spriteSetId: hasArt ? `${fighterId}__${c.id}` : null,
    portrait: hasArt ? `assets/fighters/${fighterId}/costumes/${c.id}/portrait.png` : null,
    preview: hasArt ? `assets/fighters/${fighterId}/costumes/${c.id}/portrait.png` : null,
    paletteFallback: !hasArt,
    assetStatus: hasArt ? ASSET_STATUS.COMPLETE : ASSET_STATUS.FALLBACK,
  });
}

const RESOLVED = new Map();
for (const [fighterId, list] of Object.entries(COSTUMES)) {
  RESOLVED.set(fighterId, list.map((c) => decorate(fighterId, c)));
}

/** Every costume a fighter has, the default outfit first. */
export function costumesFor(fighterId) {
  const base = Object.freeze({ ...DEFAULT_OUTFIT, fighterId });
  return [base, ...(RESOLVED.get(fighterId) || [])];
}

/** True when the fighter has anything to choose between. */
export function hasCostumeChoice(fighterId) {
  return costumesFor(fighterId).length > 1;
}

/** Look up one costume; falls back to the default outfit. */
export function getCostume(fighterId, costumeId) {
  const list = costumesFor(fighterId);
  return list.find((c) => c.id === costumeId) || list[0];
}

/**
 * The sprite set a costume should render with, or null for the base set.
 * Callers treat null as "use the fighter's own art" — never as an error.
 */
export function costumeSpriteSetId(fighterId, costumeId) {
  return getCostume(fighterId, costumeId).spriteSetId;
}

/**
 * Legacy roster id -> { fighterId, costumeId }.
 *
 * Built from the `legacyId` fields so the save migration can turn "this player
 * had Hokage Naruto unlocked" into "this player has Naruto's Hokage costume".
 */
export const COSTUME_BY_LEGACY_ID = Object.freeze(
  Object.entries(COSTUMES).reduce((acc, [fighterId, list]) => {
    for (const c of list) {
      if (c.legacyId) acc[c.legacyId] = { fighterId, costumeId: c.id };
    }
    return acc;
  }, {}),
);

export const COSTUME_COUNT = Object.values(COSTUMES)
  .reduce((n, list) => n + list.length, 0);

export default COSTUMES;
