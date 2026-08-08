/**
 * Data validator.
 *
 * Runs at boot (and in tests/) to catch broken references before they can
 * cause a runtime crash mid-match: duplicate ids, missing abilities, broken
 * transformation chains, unknown stages, invalid unlock requirements.
 *
 * Returns a report rather than throwing, so a single bad entry degrades that
 * one fighter instead of taking the whole game down.
 */

import { FIGHTERS, FIGHTER_ORDER } from './data/fighters.js';
import { ABILITIES } from './data/abilities.js';
import { TRANSFORMATIONS } from './data/transformations.js';
import { SUMMONS } from './data/summons.js';
import { STAGES } from './data/stages.js';
import { AI_PROFILES } from './data/ai-profiles.js';
import { STORY } from './data/story.js';
import { ARCADE_LADDERS, BOSS_RUSHES, TOWER_FLOORS, CONDITIONS } from './data/arcade.js';
import { UNLOCK_TYPES } from './data/unlocks.js';
import { ARCHETYPES, ERAS, PLAYABLE_STATUS, ABILITY_CATEGORIES } from './constants.js';

export function validateAll({ strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  /* ------------------------------------------------------------ fighters -- */
  const seen = new Set();
  for (const id of FIGHTER_ORDER) {
    const f = FIGHTERS[id];
    if (seen.has(id)) err(`Duplicate fighter id: ${id}`);
    seen.add(id);

    if (!f.displayName) err(`Fighter ${id}: missing displayName`);
    if (!ARCHETYPES.includes(f.archetype)) err(`Fighter ${id}: unknown archetype "${f.archetype}"`);
    if (!ERAS.includes(f.era)) warn(`Fighter ${id}: unusual era "${f.era}"`);
    if (![PLAYABLE_STATUS.COMPLETE, PLAYABLE_STATUS.PROTOTYPE].includes(f.playableStatus)) {
      err(`Fighter ${id}: unknown playableStatus "${f.playableStatus}"`);
    }
    if (!AI_PROFILES[f.aiProfile]) warn(`Fighter ${id}: unknown aiProfile "${f.aiProfile}" (falls back to balanced)`);

    // stats
    for (const [k, v] of Object.entries(f.baseStats)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        err(`Fighter ${id}: baseStats.${k} is not a positive number (${v})`);
      }
    }

    // abilities
    const refs = [
      ...f.basicCombos, ...f.airCombos, ...f.abilities,
      f.heavy, f.launcher, f.dashAttack, f.throwAttack, f.guardCounter, f.ultimate,
    ].filter(Boolean);
    for (const aid of refs) {
      if (!ABILITIES[aid]) err(`Fighter ${id}: references missing ability "${aid}"`);
    }
    if (f.basicCombos.length < 2) warn(`Fighter ${id}: only ${f.basicCombos.length} basic attacks`);
    if (!ABILITIES[f.ultimate]) err(`Fighter ${id}: missing ultimate`);

    // A "complete" fighter must not be using template moves.
    if (f.playableStatus === PLAYABLE_STATUS.COMPLETE) {
      const templated = refs.filter((aid) => ABILITIES[aid]?.prototype);
      if (templated.length) {
        err(`Fighter ${id} is marked complete but uses prototype template moves: ${templated.join(', ')}`);
      }
    }

    // transformations
    for (const tid of f.transformations) {
      const t = TRANSFORMATIONS[tid];
      if (!t) { err(`Fighter ${id}: references missing transformation "${tid}"`); continue; }
      if (t.previousForm && !TRANSFORMATIONS[t.previousForm]) {
        err(`Transformation ${tid}: previousForm "${t.previousForm}" does not exist`);
      }
      if (t.nextForm && !TRANSFORMATIONS[t.nextForm]) {
        err(`Transformation ${tid}: nextForm "${t.nextForm}" does not exist`);
      }
      if (t.ultimateOverride && !ABILITIES[t.ultimateOverride]) {
        err(`Transformation ${tid}: ultimateOverride "${t.ultimateOverride}" does not exist`);
      }
      for (const [slot, aid] of Object.entries(t.abilityOverrides || {})) {
        if (!ABILITIES[aid]) err(`Transformation ${tid}: abilityOverrides[${slot}] "${aid}" does not exist`);
      }
      if (t.unlockRequirement && !UNLOCK_TYPES.includes(t.unlockRequirement.type)) {
        err(`Transformation ${tid}: unknown unlock type "${t.unlockRequirement.type}"`);
      }
    }

    // summons
    for (const aid of f.summons) {
      if (!SUMMONS[aid]) err(`Fighter ${id}: references missing summon "${aid}"`);
    }

    // unlocks
    if (!f.unlockRequirement || !UNLOCK_TYPES.includes(f.unlockRequirement.type)) {
      err(`Fighter ${id}: invalid unlockRequirement type "${f.unlockRequirement?.type}"`);
    }

    // asset paths must stay relative (GitHub Pages project subpath)
    for (const key of ['portrait', 'spriteSet', 'audioSet']) {
      const p = f[key];
      if (typeof p === 'string' && (p.startsWith('/') || /^https?:/i.test(p))) {
        err(`Fighter ${id}: ${key} must be a relative path, got "${p}"`);
      }
    }
  }

  /* ----------------------------------------------------------- abilities -- */
  for (const [aid, a] of Object.entries(ABILITIES)) {
    if (!ABILITY_CATEGORIES.includes(a.category)) err(`Ability ${aid}: unknown category "${a.category}"`);
    if (a.startup < 0 || a.recovery < 0) err(`Ability ${aid}: negative frame data`);
    if (a.damage < 0) err(`Ability ${aid}: negative damage`);
    if (a.hits < 1) err(`Ability ${aid}: hits must be >= 1`);
    for (const next of a.chainInto || []) {
      if (!ABILITIES[next]) err(`Ability ${aid}: chainInto references missing "${next}"`);
    }
    if (a.projectile) {
      const p = a.projectile;
      if (p.speed <= 0) err(`Ability ${aid}: projectile speed must be positive`);
      if (p.count < 1) err(`Ability ${aid}: projectile count must be >= 1`);
    }
    if (a.requirements?.form && !TRANSFORMATIONS[a.requirements.form]) {
      err(`Ability ${aid}: requires unknown form "${a.requirements.form}"`);
    }
  }

  /* ------------------------------------------------------------- stages --- */
  for (const [sid, s] of Object.entries(STAGES)) {
    if (!Array.isArray(s.day) || !Array.isArray(s.night)) err(`Stage ${sid}: missing day/night gradients`);
    if (!Array.isArray(s.layers)) err(`Stage ${sid}: layers must be an array`);
    for (const l of s.layers) {
      if (typeof l.parallax !== 'number') err(`Stage ${sid}: layer "${l.kind}" missing parallax`);
    }
    if (s.unlockRequirement && !UNLOCK_TYPES.includes(s.unlockRequirement.type)) {
      err(`Stage ${sid}: unknown unlock type "${s.unlockRequirement.type}"`);
    }
  }

  /* -------------------------------------------------------------- story --- */
  const chapterIds = new Set();
  for (const c of STORY.chapters) {
    if (chapterIds.has(c.id)) err(`Duplicate story chapter id: ${c.id}`);
    chapterIds.add(c.id);
    if (c.unlockAfter && !STORY.chapters.some((x) => x.id === c.unlockAfter)) {
      err(`Chapter ${c.id}: unlockAfter "${c.unlockAfter}" does not exist`);
    }
    for (const n of c.nodes) {
      if (n.type === 'battle') {
        if (!FIGHTERS[n.player]) err(`Chapter ${c.id} node ${n.id}: unknown player "${n.player}"`);
        if (!FIGHTERS[n.opponent]) err(`Chapter ${c.id} node ${n.id}: unknown opponent "${n.opponent}"`);
        if (!STAGES[n.stage]) err(`Chapter ${c.id} node ${n.id}: unknown stage "${n.stage}"`);
        for (const cond of n.conditions || []) {
          if (!CONDITIONS[cond.id]) err(`Chapter ${c.id} node ${n.id}: unknown condition "${cond.id}"`);
        }
      } else if (n.type === 'dialogue') {
        if (!STAGES[n.stage]) err(`Chapter ${c.id} node ${n.id}: unknown stage "${n.stage}"`);
        if (!Array.isArray(n.lines) || n.lines.length === 0) err(`Chapter ${c.id} node ${n.id}: no dialogue lines`);
      } else {
        err(`Chapter ${c.id} node ${n.id}: unknown node type "${n.type}"`);
      }
    }
    for (const fid of c.rewards?.unlockFighters || []) {
      if (!FIGHTERS[fid]) err(`Chapter ${c.id}: reward unlocks unknown fighter "${fid}"`);
    }
    for (const sid of c.rewards?.unlockStages || []) {
      if (!STAGES[sid]) err(`Chapter ${c.id}: reward unlocks unknown stage "${sid}"`);
    }
  }

  /* ------------------------------------------------------------- arcade --- */
  for (const l of ARCADE_LADDERS) {
    for (const sid of l.stages) if (!STAGES[sid]) err(`Ladder ${l.id}: unknown stage "${sid}"`);
    for (const o of l.opponents) {
      if (o.pick === 'fixed') {
        if (!FIGHTERS[o.id]) err(`Ladder ${l.id}: unknown opponent "${o.id}"`);
      } else {
        for (const p of o.pool) if (!FIGHTERS[p]) err(`Ladder ${l.id}: unknown pool entry "${p}"`);
      }
    }
    for (const fid of l.rewards?.unlockFighters || []) {
      if (!FIGHTERS[fid]) err(`Ladder ${l.id}: reward unlocks unknown fighter "${fid}"`);
    }
  }
  for (const r of BOSS_RUSHES) {
    if (!STAGES[r.stage]) err(`Boss rush ${r.id}: unknown stage "${r.stage}"`);
    for (const o of r.opponents) if (!FIGHTERS[o]) err(`Boss rush ${r.id}: unknown opponent "${o}"`);
    for (const fid of r.rewards?.unlockFighters || []) {
      if (!FIGHTERS[fid]) err(`Boss rush ${r.id}: reward unlocks unknown fighter "${fid}"`);
    }
  }
  for (const f of TOWER_FLOORS) {
    if (!FIGHTERS[f.opponent]) err(`Tower floor ${f.floor}: unknown opponent "${f.opponent}"`);
    if (!STAGES[f.stage]) err(`Tower floor ${f.floor}: unknown stage "${f.stage}"`);
    for (const c of f.conditions) if (!CONDITIONS[c]) err(`Tower floor ${f.floor}: unknown condition "${c}"`);
  }

  /* ------------------------------------------------------------ summary --- */
  const stats = {
    fighters: FIGHTER_ORDER.length,
    complete: FIGHTER_ORDER.filter((id) => FIGHTERS[id].playableStatus === PLAYABLE_STATUS.COMPLETE).length,
    prototype: FIGHTER_ORDER.filter((id) => FIGHTERS[id].playableStatus === PLAYABLE_STATUS.PROTOTYPE).length,
    abilities: Object.keys(ABILITIES).length,
    signatureAbilities: Object.values(ABILITIES).filter((a) => !a.prototype).length,
    transformations: Object.keys(TRANSFORMATIONS).length,
    summons: Object.keys(SUMMONS).length,
    stages: Object.keys(STAGES).length,
    chapters: STORY.chapters.length,
    towerFloors: TOWER_FLOORS.length,
  };

  const ok = errors.length === 0 && (!strict || warnings.length === 0);
  return { ok, errors, warnings, stats };
}

export default validateAll;
