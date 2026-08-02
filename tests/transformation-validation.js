/**
 * Transformation validation: chain integrity, real activation requirements,
 * and the rule that forms are never duplicated as roster cards.
 */

import { suite, test, assert, assertAtLeast, assertEmpty } from './helpers.js';
import { TRANSFORMATIONS, chainFrom } from '../js/data/transformations.js';
import { FIGHTERS, FIGHTER_ORDER } from '../js/data/fighters.js';
import { ABILITIES } from '../js/data/abilities.js';
import { UNLOCK_TYPES } from '../js/data/unlocks.js';

export function run() {
  suite('transformation-validation');

  test('transformations exist', () => {
    assertAtLeast(Object.keys(TRANSFORMATIONS).length, 60, 'Too few transformations');
  });

  test('previousForm / nextForm links are consistent both ways', () => {
    const bad = [];
    for (const [id, t] of Object.entries(TRANSFORMATIONS)) {
      if (t.previousForm) {
        const p = TRANSFORMATIONS[t.previousForm];
        if (!p) bad.push(`${id}: previousForm ${t.previousForm} missing`);
        else if (p.nextForm !== id) bad.push(`${id}: previous form does not point back`);
      }
      if (t.nextForm) {
        const n = TRANSFORMATIONS[t.nextForm];
        if (!n) bad.push(`${id}: nextForm ${t.nextForm} missing`);
        else if (n.previousForm !== id) bad.push(`${id}: next form does not point back`);
      }
    }
    assertEmpty(bad, 'Broken transformation chains');
  });

  test('chains terminate (no cycles)', () => {
    const bad = [];
    for (const id of Object.keys(TRANSFORMATIONS)) {
      const seen = new Set();
      let cur = id;
      let guard = 0;
      while (cur && guard++ < 50) {
        if (seen.has(cur)) { bad.push(`${id}: cycle at ${cur}`); break; }
        seen.add(cur);
        cur = TRANSFORMATIONS[cur].nextForm;
      }
      if (guard >= 50) bad.push(`${id}: chain does not terminate`);
    }
    assertEmpty(bad, 'Transformation cycles');
  });

  test('every form has a real activation requirement', () => {
    const bad = [];
    for (const [id, t] of Object.entries(TRANSFORMATIONS)) {
      const r = t.activationRequirement;
      const hasCost = (r.awakening ?? 0) > 0 || (r.chakra ?? 0) > 0
        || r.healthBelow != null || r.healthAbove != null || r.oncePerMatch || r.previousForm;
      if (!hasCost) bad.push(`${id}: pressing the button would be enough`);
    }
    assertEmpty(bad, 'Forms with no requirement');
  });

  test('ability and ultimate overrides resolve', () => {
    const bad = [];
    for (const [id, t] of Object.entries(TRANSFORMATIONS)) {
      for (const [slot, aid] of Object.entries(t.abilityOverrides || {})) {
        if (!ABILITIES[aid]) bad.push(`${id}.abilityOverrides[${slot}] → ${aid}`);
      }
      if (t.ultimateOverride && !ABILITIES[t.ultimateOverride]) {
        bad.push(`${id}.ultimateOverride → ${t.ultimateOverride}`);
      }
    }
    assertEmpty(bad, 'Broken transformation overrides');
  });

  test('unlock requirements use known types', () => {
    const bad = [];
    for (const [id, t] of Object.entries(TRANSFORMATIONS)) {
      if (t.unlockRequirement && !UNLOCK_TYPES.includes(t.unlockRequirement.type)) {
        bad.push(`${id}: ${t.unlockRequirement.type}`);
      }
    }
    assertEmpty(bad, 'Bad transformation unlock types');
  });

  test('every fighter transformation reference resolves', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      for (const tid of FIGHTERS[id].transformations) {
        if (!TRANSFORMATIONS[tid]) bad.push(`${id} → ${tid}`);
      }
    }
    assertEmpty(bad, 'Missing transformations');
  });

  test('a fighter owns a contiguous chain starting at the root', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const list = FIGHTERS[id].transformations;
      if (!list.length) continue;
      const first = TRANSFORMATIONS[list[0]];
      if (first.previousForm) bad.push(`${id}: chain does not start at a root form`);
      const walked = chainFrom(list[0]).map((t) => t.id);
      if (walked.join(',') !== list.join(',')) {
        bad.push(`${id}: declared chain does not match the linked chain`);
      }
    }
    assertEmpty(bad, 'Chain mismatch');
  });

  test('no transformation is also a roster card', () => {
    const bad = [];
    for (const tid of Object.keys(TRANSFORMATIONS)) {
      if (FIGHTERS[tid]) bad.push(`${tid} exists as both a form and a fighter`);
    }
    assertEmpty(bad, 'Forms duplicated as fighters');
  });

  test('named chains match the design brief', () => {
    const expect = (fighter, forms) => {
      const list = FIGHTERS[fighter].transformations.map((t) => TRANSFORMATIONS[t].displayName);
      for (const f of forms) {
        assert(list.some((n) => n.toLowerCase().includes(f.toLowerCase())),
          `${fighter} is missing a "${f}" form (has: ${list.join(', ')})`);
      }
    };
    expect('naruto', ['Sage Mode', 'Kurama Chakra Mode', 'Six Paths', 'Baryon']);
    expect('sasuke', ['Sharingan', 'Curse Mark', 'Mangekyo', 'Eternal', 'Rinnegan']);
    expect('madara', ['Mangekyo', 'Rinnegan', 'Six Paths', 'Ten-Tails']);
    expect('boruto', ['Karma', 'True Essence']);
    expect('kawaki', ['Karma', 'Isshiki']);
    expect('guy', ['Gate of Death']);
    expect('lee', ['Gate of View']);
    expect('gaara', ['Shukaku']);
    expect('bee', ['Gyuki']);
  });

  test('drain-based forms cannot kill their own user outright', () => {
    // healthDrain is clamped at 1 HP in the transformation system; make sure no
    // form declares an absurd value that would trivialise that clamp.
    const bad = Object.values(TRANSFORMATIONS)
      .filter((t) => t.healthDrain > 12)
      .map((t) => `${t.id}: ${t.healthDrain}/s`);
    assertEmpty(bad, 'Excessive health drain');
  });
}
