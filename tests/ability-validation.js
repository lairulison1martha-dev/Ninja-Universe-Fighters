/**
 * Ability validation: schema completeness, references, and the honesty rule
 * that "complete" fighters must not be using prototype template moves.
 */

import { suite, test, assert, assertAtLeast, assertEmpty } from './helpers.js';
import { ABILITIES } from '../js/data/abilities.js';
import { FIGHTERS, FIGHTER_ORDER } from '../js/data/fighters.js';
import { ABILITY_CATEGORIES, PLAYABLE_STATUS } from '../js/constants.js';

const REQUIRED = [
  'id', 'displayName', 'category', 'chakraCost', 'cooldown', 'damage',
  'guardDamage', 'startup', 'activeFrames', 'recovery', 'range', 'hitStun',
  'blockStun', 'knockbackX', 'knockbackY', 'launch', 'groundBounce',
  'wallBounce', 'invulnerability', 'projectile', 'tracking', 'area',
  'effectId', 'soundId', 'animationId', 'statusEffects', 'requirements',
];

export function run() {
  suite('ability-validation');

  test('abilities exist in meaningful numbers', () => {
    assertAtLeast(Object.keys(ABILITIES).length, 300, 'Too few abilities');
  });

  test('every ability has the full schema', () => {
    const missing = [];
    for (const [id, a] of Object.entries(ABILITIES)) {
      for (const key of REQUIRED) {
        if (a[key] === undefined) missing.push(`${id}.${key}`);
      }
    }
    assertEmpty(missing, 'Missing ability fields');
  });

  test('categories are valid', () => {
    const bad = Object.values(ABILITIES)
      .filter((a) => !ABILITY_CATEGORIES.includes(a.category))
      .map((a) => `${a.id}: ${a.category}`);
    assertEmpty(bad, 'Unknown ability categories');
  });

  test('frame data is sane', () => {
    const bad = [];
    for (const a of Object.values(ABILITIES)) {
      if (a.startup < 0 || a.activeFrames < 0 || a.recovery < 0) bad.push(`${a.id}: negative frames`);
      if (a.totalTime <= 0) bad.push(`${a.id}: zero-length move`);
      if (a.hits < 1) bad.push(`${a.id}: ${a.hits} hits`);
      if (a.damage < 0) bad.push(`${a.id}: negative damage`);
    }
    assertEmpty(bad, 'Bad frame data');
  });

  test('chainInto targets all exist', () => {
    const bad = [];
    for (const a of Object.values(ABILITIES)) {
      for (const next of a.chainInto) if (!ABILITIES[next]) bad.push(`${a.id} → ${next}`);
    }
    assertEmpty(bad, 'Broken chains');
  });

  test('projectile specs are valid', () => {
    const bad = [];
    for (const a of Object.values(ABILITIES)) {
      if (!a.projectile) continue;
      const p = a.projectile;
      if (!(p.speed > 0)) bad.push(`${a.id}: speed ${p.speed}`);
      if (!(p.life > 0)) bad.push(`${a.id}: life ${p.life}`);
      if (!(p.radius > 0)) bad.push(`${a.id}: radius ${p.radius}`);
      if (!(p.count >= 1)) bad.push(`${a.id}: count ${p.count}`);
    }
    assertEmpty(bad, 'Bad projectile specs');
  });

  test('every fighter ability reference resolves', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const f = FIGHTERS[id];
      const refs = [
        ...f.basicCombos, ...f.airCombos, ...f.abilities,
        f.heavy, f.launcher, f.dashAttack, f.throwAttack, f.guardCounter, f.ultimate,
      ].filter(Boolean);
      for (const aid of refs) if (!ABILITIES[aid]) bad.push(`${id} → ${aid}`);
    }
    assertEmpty(bad, 'Missing ability references');
  });

  test('fighters marked complete use no prototype template moves', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const f = FIGHTERS[id];
      if (f.playableStatus !== PLAYABLE_STATUS.COMPLETE) continue;
      const refs = [
        ...f.basicCombos, ...f.airCombos, ...f.abilities,
        f.heavy, f.launcher, f.dashAttack, f.throwAttack, f.guardCounter, f.ultimate,
      ].filter(Boolean);
      for (const aid of refs) {
        if (ABILITIES[aid]?.prototype) bad.push(`${id} uses template move ${aid}`);
      }
    }
    assertEmpty(bad, 'Complete fighters must not use templates');
  });

  test('complete fighters really do have different move sets from each other', () => {
    const complete = FIGHTER_ORDER.filter((id) => FIGHTERS[id].playableStatus === PLAYABLE_STATUS.COMPLETE);
    const seen = new Map();
    const clashes = [];
    for (const id of complete) {
      const f = FIGHTERS[id];
      // Fingerprint = the numbers that define how the kit actually plays.
      const fp = [...f.basicCombos, f.heavy, f.launcher, f.ultimate]
        .map((aid) => {
          const a = ABILITIES[aid];
          return `${a.damage}:${a.startup.toFixed(3)}:${a.recovery.toFixed(3)}:${a.range}`;
        })
        .join('|');
      if (seen.has(fp)) clashes.push(`${id} has identical numbers to ${seen.get(fp)}`);
      seen.set(fp, id);
    }
    assertEmpty(clashes, 'Complete fighters share a move-set fingerprint');
  });

  test('every complete fighter has at least two jutsu plus an ultimate', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const f = FIGHTERS[id];
      if (f.playableStatus !== PLAYABLE_STATUS.COMPLETE) continue;
      if (f.abilities.length < 2) bad.push(`${id} has ${f.abilities.length} jutsu`);
      if (!ABILITIES[f.ultimate]) bad.push(`${id} has no ultimate`);
      if (f.basicCombos.length < 3) bad.push(`${id} has a ${f.basicCombos.length}-hit ground chain`);
      if (f.airCombos.length < 2) bad.push(`${id} has a ${f.airCombos.length}-hit air chain`);
    }
    assertEmpty(bad, 'Incomplete "complete" fighters');
  });

  test('prototype template moves are labelled as such', () => {
    const bad = [];
    for (const a of Object.values(ABILITIES)) {
      if (!a.prototype) continue;
      if (!/prototype/i.test(a.description)) bad.push(a.id);
    }
    assertEmpty(bad, 'Prototype moves missing their label');
  });

  test('ultimates cost chakra and have a cooldown', () => {
    const bad = [];
    for (const a of Object.values(ABILITIES)) {
      if (a.category !== 'ultimate') continue;
      if (a.chakraCost < 40) bad.push(`${a.id}: only ${a.chakraCost} chakra`);
      if (a.cooldown < 10) bad.push(`${a.id}: only ${a.cooldown}s cooldown`);
    }
    assertEmpty(bad, 'Ultimates are too cheap');
  });

  test('sound and effect ids are non-empty strings', () => {
    const bad = Object.values(ABILITIES)
      .filter((a) => typeof a.soundId !== 'string' || typeof a.effectId !== 'string')
      .map((a) => a.id);
    assertEmpty(bad, 'Missing sound/effect ids');
    assert(true);
  });
}
