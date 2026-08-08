/**
 * Roster validation: ids, required fields, counts, unlock reachability.
 */

import { suite, test, assert, assertEqual, assertAtLeast, assertEmpty } from './helpers.js';
import { FIGHTERS, FIGHTER_ORDER, ROSTER_SIZE, COMPLETE_FIGHTERS } from '../js/data/fighters.js';
import { UNLOCK_TYPES, STARTER_FIGHTERS } from '../js/data/unlocks.js';
import { ARCHETYPES, ERAS, PLAYABLE_STATUS } from '../js/constants.js';

const REQUIRED = [
  'id', 'displayName', 'shortName', 'era', 'village', 'clan', 'organization',
  'rank', 'archetype', 'description', 'difficulty', 'playableStatus',
  'unlockRequirement', 'baseStats', 'chakraNatures', 'passiveAbilities',
  'basicCombos', 'airCombos', 'dashAttack', 'throwAttack', 'guardCounter',
  'abilities', 'ultimate', 'summons', 'transformations', 'portrait',
  'spriteSet', 'audioSet', 'aiProfile', 'colors', 'tags',
];

export function run() {
  suite('roster-validation');

  test('roster has at least 100 fighters', () => {
    assertAtLeast(ROSTER_SIZE, 100, 'Roster too small');
  });

  test('no duplicate fighter ids', () => {
    const seen = new Set();
    const dupes = [];
    for (const id of FIGHTER_ORDER) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    assertEmpty(dupes, 'Duplicate fighter ids');
  });

  test('every fighter has every required field', () => {
    const missing = [];
    for (const id of FIGHTER_ORDER) {
      const f = FIGHTERS[id];
      for (const key of REQUIRED) {
        if (f[key] === undefined || f[key] === null) missing.push(`${id}.${key}`);
      }
    }
    assertEmpty(missing, 'Missing fighter fields');
  });

  test('base stats are complete and positive', () => {
    const bad = [];
    const keys = ['health', 'chakra', 'attack', 'defense', 'speed', 'chakraControl', 'guard', 'substitution', 'awakeningRate'];
    for (const id of FIGHTER_ORDER) {
      const s = FIGHTERS[id].baseStats;
      for (const k of keys) {
        if (typeof s[k] !== 'number' || !(s[k] > 0)) bad.push(`${id}.${k} = ${s[k]}`);
      }
    }
    assertEmpty(bad, 'Bad base stats');
  });

  test('archetypes and eras are from the canonical lists', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const f = FIGHTERS[id];
      if (!ARCHETYPES.includes(f.archetype)) bad.push(`${id}: archetype ${f.archetype}`);
      if (!ERAS.includes(f.era)) bad.push(`${id}: era ${f.era}`);
    }
    assertEmpty(bad, 'Unknown archetype/era');
  });

  test('unlock requirements use known types', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const r = FIGHTERS[id].unlockRequirement;
      if (!r || !UNLOCK_TYPES.includes(r.type)) bad.push(`${id}: ${r?.type}`);
    }
    assertEmpty(bad, 'Bad unlock types');
  });

  test('starter fighters exist and are unlocked by default', () => {
    const bad = [];
    for (const id of STARTER_FIGHTERS) {
      if (!FIGHTERS[id]) { bad.push(`${id} does not exist`); continue; }
      if (FIGHTERS[id].unlockRequirement.type !== 'default') {
        bad.push(`${id} is a starter but has unlock type ${FIGHTERS[id].unlockRequirement.type}`);
      }
    }
    assertEmpty(bad, 'Starter roster problems');
  });

  test('at least 20 fighters have complete hand-authored kits', () => {
    assertAtLeast(COMPLETE_FIGHTERS.length, 20, 'Not enough complete fighters');
  });

  test('playableStatus is one of the two known values', () => {
    const bad = FIGHTER_ORDER.filter((id) => ![PLAYABLE_STATUS.COMPLETE, PLAYABLE_STATUS.PROTOTYPE]
      .includes(FIGHTERS[id].playableStatus));
    assertEmpty(bad, 'Bad playableStatus');
  });

  test('every fighter has movement data derived from stats', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const m = FIGHTERS[id].movement;
      if (!m || !(m.walkSpeed > 0) || !(m.runSpeed > m.walkSpeed) || !(m.jumpVelocity > 0)) {
        bad.push(`${id}: ${JSON.stringify(m)}`);
      }
    }
    assertEmpty(bad, 'Bad movement data');
  });

  test('colours are defined so every fighter is visually distinct', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const c = FIGHTERS[id].colors;
      for (const k of ['primary', 'secondary', 'accent', 'hair', 'aura', 'skin']) {
        if (typeof c[k] !== 'string' || !c[k]) bad.push(`${id}.colors.${k}`);
      }
    }
    assertEmpty(bad, 'Missing colours');
  });

  test('the complete twenty are exactly the intended list', () => {
    const expected = [
      'naruto', 'sasuke', 'sakura', 'kakashi', 'lee', 'gaara', 'itachi', 'pain',
      'madara', 'boruto', 'kawaki', 'momoshiki', 'minato', 'hashirama', 'guy',
      'bee', 'obito', 'jiraiya', 'orochimaru', 'tsunade',
    ];
    for (const id of expected) {
      assert(COMPLETE_FIGHTERS.includes(id), `${id} should have a complete move set`);
    }
    assertEqual(COMPLETE_FIGHTERS.length, expected.length, 'Complete-fighter count changed');
  });
}
