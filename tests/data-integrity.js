/**
 * Cross-cutting data integrity: stages, story, arcade, tower, summons,
 * achievements and the full validator.
 */

import { suite, test, assert, assertAtLeast, assertEmpty } from './helpers.js';
import validateAll from '../js/data-validator.js';
import { STAGES, STAGE_ORDER } from '../js/data/stages.js';
import { STORY } from '../js/data/story.js';
import { ARCADE_LADDERS, BOSS_RUSHES, TOWER_FLOORS, CONDITIONS } from '../js/data/arcade.js';
import { SUMMONS } from '../js/data/summons.js';
import { ACHIEVEMENTS } from '../js/data/achievements.js';
import { AI_PROFILES } from '../js/data/ai-profiles.js';
import { FIGHTERS, FIGHTER_ORDER } from '../js/data/fighters.js';
import { defaultSave } from '../js/save-manager.js';

export function run() {
  suite('data-integrity');

  test('the boot-time validator reports no errors', () => {
    const r = validateAll();
    assertEmpty(r.errors, 'Validator errors');
  });

  test('the validator reports the expected content scale', () => {
    const r = validateAll();
    assertAtLeast(r.stats.fighters, 100, 'fighters');
    assertAtLeast(r.stats.complete, 20, 'complete fighters');
    assertAtLeast(r.stats.abilities, 300, 'abilities');
    assertAtLeast(r.stats.transformations, 60, 'transformations');
    assertAtLeast(r.stats.stages, 12, 'stages');
    assertAtLeast(r.stats.chapters, 10, 'story chapters');
    assertAtLeast(r.stats.towerFloors, 100, 'tower floors');
  });

  test('stages have day and night palettes plus layers', () => {
    const bad = [];
    for (const id of STAGE_ORDER) {
      const s = STAGES[id];
      if (!Array.isArray(s.day) || s.day.length !== 3) bad.push(`${id}: day palette`);
      if (!Array.isArray(s.night) || s.night.length !== 3) bad.push(`${id}: night palette`);
      if (!s.layers.length) bad.push(`${id}: no parallax layers`);
      if (!s.musicId) bad.push(`${id}: no music id`);
    }
    assertEmpty(bad, 'Stage problems');
  });

  test('stage colours are valid CSS hex values', () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    const bad = [];
    for (const id of STAGE_ORDER) {
      const s = STAGES[id];
      for (const c of [...s.day, ...s.night, s.groundColor, s.groundAccent]) {
        if (!hex.test(c)) bad.push(`${id}: ${c}`);
      }
      for (const l of s.layers) {
        if (l.color && !hex.test(l.color)) bad.push(`${id} layer ${l.kind}: ${l.color}`);
      }
    }
    assertEmpty(bad, 'Bad stage colours');
  });

  test('every story battle node names a real fighter and stage', () => {
    const bad = [];
    for (const c of STORY.chapters) {
      for (const n of c.nodes) {
        if (n.type !== 'battle') continue;
        if (!FIGHTERS[n.player]) bad.push(`${c.id}/${n.id}: player ${n.player}`);
        if (!FIGHTERS[n.opponent]) bad.push(`${c.id}/${n.id}: opponent ${n.opponent}`);
        if (!STAGES[n.stage]) bad.push(`${c.id}/${n.id}: stage ${n.stage}`);
      }
    }
    assertEmpty(bad, 'Story references');
  });

  test('the story is playable start to finish', () => {
    // Every chapter after the first must be reachable from its predecessor.
    const ids = STORY.chapters.map((c) => c.id);
    const bad = [];
    STORY.chapters.forEach((c, i) => {
      if (i === 0) {
        if (c.unlockAfter) bad.push(`${c.id}: the first chapter must not be gated`);
        return;
      }
      if (!c.unlockAfter) { bad.push(`${c.id}: no unlockAfter`); return; }
      if (!ids.includes(c.unlockAfter)) bad.push(`${c.id}: unlockAfter ${c.unlockAfter} missing`);
    });
    assertEmpty(bad, 'Story progression');
  });

  test('every story chapter has at least one battle', () => {
    const bad = STORY.chapters
      .filter((c) => !c.nodes.some((n) => n.type === 'battle'))
      .map((c) => c.id);
    assertEmpty(bad, 'Chapters with no fights');
  });

  test('tower floors are numbered 1..100 with no gaps', () => {
    const bad = [];
    TOWER_FLOORS.forEach((f, i) => {
      if (f.floor !== i + 1) bad.push(`index ${i} has floor ${f.floor}`);
    });
    assertEmpty(bad, 'Tower numbering');
  });

  test('tower conditions all exist and are applicable', () => {
    const bad = [];
    for (const f of TOWER_FLOORS) {
      for (const c of f.conditions) {
        if (!CONDITIONS[c]) { bad.push(`floor ${f.floor}: ${c}`); continue; }
        // Applying a condition must not throw on a plain rules object.
        const rules = { chakraRegen: 6, startHealth: 1, substitutionStocks: 3, roundTime: 99 };
        try { CONDITIONS[c].apply(rules); } catch (err) { bad.push(`floor ${f.floor}: ${c} threw ${err.message}`); }
      }
    }
    assertEmpty(bad, 'Tower conditions');
  });

  test('the first five tower floors have no special conditions', () => {
    const bad = TOWER_FLOORS.slice(0, 5).filter((f) => f.conditions.length).map((f) => f.floor);
    assertEmpty(bad, 'Early tower floors should be a gentle introduction');
  });

  test('arcade ladders have as many stages as opponents', () => {
    const bad = ARCADE_LADDERS
      .filter((l) => l.stages.length < l.opponents.length)
      .map((l) => `${l.id}: ${l.stages.length} stages for ${l.opponents.length} fights`);
    assertEmpty(bad, 'Ladder stage lists');
  });

  test('every arcade ladder ends with a boss', () => {
    const bad = ARCADE_LADDERS
      .filter((l) => !l.opponents[l.opponents.length - 1].boss)
      .map((l) => l.id);
    assertEmpty(bad, 'Ladders without a final boss');
  });

  test('boss rushes name only real fighters', () => {
    const bad = [];
    for (const r of BOSS_RUSHES) {
      for (const o of r.opponents) if (!FIGHTERS[o]) bad.push(`${r.id}: ${o}`);
    }
    assertEmpty(bad, 'Boss rush rosters');
  });

  test('summons have a behaviour, a cooldown and a cost', () => {
    const bad = [];
    for (const [id, a] of Object.entries(SUMMONS)) {
      if (!a.behaviour) bad.push(`${id}: no behaviour`);
      if (!(a.cooldown > 0)) bad.push(`${id}: cooldown ${a.cooldown}`);
      if (!(a.chakraCost > 0)) bad.push(`${id}: cost ${a.chakraCost}`);
      if (!a.description) bad.push(`${id}: no description`);
    }
    assertEmpty(bad, 'Assist problems');
  });

  test('achievement predicates run against a fresh save without throwing', () => {
    const save = defaultSave();
    const bad = [];
    for (const a of ACHIEVEMENTS) {
      try { a.check(save); } catch (err) { bad.push(`${a.id}: ${err.message}`); }
    }
    assertEmpty(bad, 'Achievement predicates');
  });

  test('no achievement is already earned on a brand-new save', () => {
    const save = defaultSave();
    const bad = ACHIEVEMENTS.filter((a) => {
      try { return !!a.check(save); } catch { return false; }
    }).map((a) => a.id);
    assertEmpty(bad, 'Achievements granted for doing nothing');
  });

  test('every AI profile referenced by a fighter exists', () => {
    const bad = FIGHTER_ORDER
      .filter((id) => !AI_PROFILES[FIGHTERS[id].aiProfile])
      .map((id) => `${id} → ${FIGHTERS[id].aiProfile}`);
    assertEmpty(bad, 'Missing AI profiles');
  });

  test('AI profiles keep their weights in range', () => {
    const bad = [];
    for (const [id, p] of Object.entries(AI_PROFILES)) {
      for (const key of ['aggression', 'defence', 'zoning', 'dashiness', 'airiness',
        'jutsuUse', 'comboGreed', 'ultimatePatience', 'substitutionBias', 'counterBias']) {
        const v = p[key];
        if (typeof v !== 'number' || v < 0 || v > 1) bad.push(`${id}.${key} = ${v}`);
      }
      if (!Array.isArray(p.idealRange) || p.idealRange[0] >= p.idealRange[1]) {
        bad.push(`${id}.idealRange = ${JSON.stringify(p.idealRange)}`);
      }
    }
    assertEmpty(bad, 'AI profile weights');
  });

  test('the twenty complete fighters each have a named AI personality', () => {
    const named = ['naruto', 'sasuke', 'sakura', 'kakashi', 'lee', 'gaara', 'itachi',
      'pain', 'madara', 'boruto', 'kawaki', 'momoshiki', 'minato', 'hashirama',
      'guy', 'bee', 'obito', 'jiraiya', 'orochimaru', 'tsunade'];
    const bad = named.filter((id) => FIGHTERS[id].aiProfile !== id);
    assertEmpty(bad, 'Complete fighters should use their own AI profile');
  });

  test('asset paths are relative, never rooted or remote', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const f = FIGHTERS[id];
      for (const key of ['portrait', 'spriteSet', 'audioSet']) {
        const p = f[key];
        if (p.startsWith('/') || /^https?:/i.test(p)) bad.push(`${id}.${key} = ${p}`);
      }
    }
    assertEmpty(bad, 'Non-relative asset paths');
    assert(true);
  });
}
