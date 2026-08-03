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

/** @typedef {{ id: string, name: string, legacyId?: string, unlock?: Object,
 *              palette?: Object, loadout?: string }} Costume */

const DEFAULT = { id: 'default', name: 'Default', unlock: { type: 'default' } };

/** Costume lists per fighter. Everyone implicitly has `default` first. */
export const COSTUMES = Object.freeze({
  naruto: [
    { id: 'kid', name: 'Academy Days', legacyId: null, unlock: { type: 'default' } },
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'the_last', name: 'The Last', legacyId: 'rtn_naruto', unlock: { type: 'mastery', value: 3 } },
    { id: 'hokage', name: 'Seventh Hokage', legacyId: 'naruto_hokage', unlock: { type: 'mastery', value: 5 } },
    { id: 'adult', name: 'Adult', legacyId: 'naruto_adult', unlock: { type: 'mastery', value: 5 } },
  ],
  sasuke: [
    { id: 'kid', name: 'Academy Days', unlock: { type: 'default' } },
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'the_last', name: 'The Last', legacyId: 'rtn_sasuke', unlock: { type: 'mastery', value: 3 } },
    { id: 'adult', name: 'Adult', legacyId: 'sasuke_adult', unlock: { type: 'mastery', value: 5 } },
  ],
  sakura: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'sakura_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  kakashi: [
    { id: 'young', name: 'Young Kakashi', legacyId: 'kakashi_young', unlock: { type: 'mastery', value: 2 } },
    { id: 'anbu', name: 'ANBU', legacyId: 'sakumo', unlock: { type: 'mastery', value: 3 } },
    { id: 'jonin', name: 'Jonin', unlock: { type: 'default' } },
    { id: 'hokage', name: 'Sixth Hokage', legacyId: 'kakashi_hokage', unlock: { type: 'mastery', value: 5 } },
  ],
  obito: [
    { id: 'young', name: 'Young Obito', legacyId: 'obito_young', unlock: { type: 'mastery', value: 2 } },
    { id: 'tobi', name: 'Tobi', unlock: { type: 'mastery', value: 3 } },
    { id: 'masked', name: 'Masked', unlock: { type: 'default' } },
    { id: 'white_mask', name: 'White Mask', unlock: { type: 'mastery', value: 4 } },
    { id: 'war', name: 'War Arc', legacyId: 'rin', unlock: { type: 'mastery', value: 5 } },
  ],
  madara: [
    { id: 'young', name: 'Young Madara', legacyId: 'madara_young', unlock: { type: 'mastery', value: 2 } },
    { id: 'valley', name: 'Valley of the End', unlock: { type: 'default' } },
    { id: 'edo', name: 'Edo Tensei', legacyId: 'madara_edo', unlock: { type: 'mastery', value: 4 } },
  ],
  gaara: [
    { id: 'genin', name: 'Chunin Exams', unlock: { type: 'default' } },
    { id: 'kazekage', name: 'Fifth Kazekage', legacyId: 'gaara_kazekage', unlock: { type: 'mastery', value: 4 } },
    { id: 'adult', name: 'Adult', legacyId: 'gaara_adult', unlock: { type: 'mastery', value: 5 } },
  ],
  minato: [
    { id: 'young', name: 'Young Minato', legacyId: 'minato_young', unlock: { type: 'mastery', value: 2 } },
    { id: 'hokage', name: 'Fourth Hokage', unlock: { type: 'default' } },
  ],
  hashirama: [
    { id: 'young', name: 'Warring States', legacyId: 'hashirama_young', unlock: { type: 'mastery', value: 3 } },
    { id: 'hokage', name: 'First Hokage', unlock: { type: 'default' } },
  ],
  tobirama: [
    { id: 'young', name: 'Warring States', legacyId: 'tobirama_young', unlock: { type: 'mastery', value: 3 } },
    { id: 'hokage', name: 'Second Hokage', unlock: { type: 'default' } },
  ],
  hiruzen: [
    { id: 'young', name: 'The Professor', legacyId: 'hiruzen_young', unlock: { type: 'mastery', value: 3 } },
    { id: 'elder', name: 'Third Hokage', unlock: { type: 'default' } },
  ],
  jiraiya: [
    { id: 'young', name: 'Young Jiraiya', legacyId: 'jiraiya_young', unlock: { type: 'mastery', value: 2 } },
    { id: 'sannin', name: 'Toad Sage', unlock: { type: 'default' } },
  ],
  orochimaru: [
    { id: 'young', name: 'Young Orochimaru', legacyId: 'orochimaru_young', unlock: { type: 'mastery', value: 2 } },
    { id: 'sannin', name: 'Sannin', unlock: { type: 'default' } },
  ],
  tsunade: [
    { id: 'young', name: 'Young Tsunade', legacyId: 'tsunade_young', unlock: { type: 'mastery', value: 2 } },
    { id: 'hokage', name: 'Fifth Hokage', unlock: { type: 'default' } },
  ],
  guy: [
    { id: 'young', name: 'Young Guy', legacyId: 'guy_young', unlock: { type: 'mastery', value: 2 } },
    { id: 'jonin', name: 'Jonin', unlock: { type: 'default' } },
  ],
  lee: [
    { id: 'genin', name: 'Chunin Exams', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'lee_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  boruto: [
    { id: 'genin', name: 'Genin', unlock: { type: 'default' } },
    { id: 'timeskip', name: 'Time Skip', legacyId: 'houki', unlock: { type: 'mastery', value: 4 } },
  ],
  hinata: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'hinata_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  shikamaru: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'shikamaru_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  choji: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'choji_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  ino: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'ino_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  kiba: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'kiba_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  shino: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'shino_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  tenten: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'tenten_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  sai: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'sai_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  temari: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'temari_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  kankuro: [
    { id: 'shippuden', name: 'Shippuden', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'kankuro_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  konohamaru: [
    { id: 'genin', name: 'Genin', unlock: { type: 'default' } },
    { id: 'adult', name: 'Jonin', legacyId: 'konohamaru_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  hanabi: [
    { id: 'genin', name: 'Genin', unlock: { type: 'default' } },
    { id: 'adult', name: 'Adult', legacyId: 'hanabi_adult', unlock: { type: 'mastery', value: 4 } },
  ],
  momoshiki: [
    { id: 'base', name: 'Base', unlock: { type: 'default' } },
  ],
  white_zetsu: [
    { id: 'base', name: 'White Zetsu', legacyId: 'zetsu', unlock: { type: 'default' } },
  ],
});

/** Every costume a fighter has, `default` included. */
export function costumesFor(fighterId) {
  const extra = COSTUMES[fighterId] || [];
  return [DEFAULT, ...extra];
}

/** Look up one costume; falls back to `default`. */
export function getCostume(fighterId, costumeId) {
  return costumesFor(fighterId).find((c) => c.id === costumeId) || DEFAULT;
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
