/**
 * Costume and transformation artwork tests.
 *
 * The rendering rule this suite exists to protect is one line long:
 *
 *     active transformation -> selected costume -> base fighter -> procedural
 *
 * Everything else here is about not lying: a costume cannot claim art it does
 * not have, a locked costume cannot be worn, a fallback is reported rather than
 * passed off as finished, and none of it turns a costume or a form into an
 * extra roster card.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  suite, test, assert, assertEqual, assertAtLeast, assertEmpty, installBrowserStubs,
} from './helpers.js';

installBrowserStubs();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { FIGHTERS, FIGHTER_ORDER } = await import('../js/data/fighters.js');
const {
  COSTUMES, COSTUMES_WITH_ART, ASSET_STATUS,
  costumesFor, getCostume, hasCostumeChoice, costumeSpriteSetId,
} = await import('../js/data/costumes.js');
const { TRANSFORMATIONS, FORMS_WITH_ART } = await import('../js/data/transformations.js');
const {
  SpriteSheet, spriteRegistry, REQUIRED_ANIMATIONS, missingAnimations,
} = await import('../js/combat/sprite-animator.js');
const { Fighter } = await import('../js/combat/fighter.js');
const { CombatEngine } = await import('../js/combat/combat-engine.js');
const { transform, revert } = await import('../js/combat/transformation-system.js');
const { migrate, defaultSave } = await import('../js/save-manager.js');
const saveManager = (await import('../js/save-manager.js')).default;
const { spriteFallbacks, clearSpriteFallbacks } = await import('../js/asset-report.js');
const { SIM_DT } = await import('../js/constants.js');

const readMeta = (dir) => JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'fighter.json'), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** Register metadata-only sheets so resolution can be tested headlessly. */
function registerSets(ids) {
  spriteRegistry.clear();
  for (const { id, dir } of ids) {
    spriteRegistry.add(id, new SpriteSheet(readMeta(dir), null));
  }
}

export function run() {
  suite('costume-validation');

  /* -------------------------------------------------------------- data -- */

  test('every costume declares the full data shape', () => {
    const problems = [];
    for (const fighterId of FIGHTER_ORDER) {
      for (const c of costumesFor(fighterId)) {
        if (!c.id) problems.push(`${fighterId}: costume with no id`);
        if (!c.name) problems.push(`${fighterId}/${c.id}: no name`);
        if (!c.unlockRule?.type) problems.push(`${fighterId}/${c.id}: no unlockRule`);
        if (!Object.values(ASSET_STATUS).includes(c.assetStatus)) {
          problems.push(`${fighterId}/${c.id}: assetStatus "${c.assetStatus}"`);
        }
        if (typeof c.paletteFallback !== 'boolean') {
          problems.push(`${fighterId}/${c.id}: paletteFallback missing`);
        }
        if (c.spriteSetId === undefined || c.portrait === undefined || c.preview === undefined) {
          problems.push(`${fighterId}/${c.id}: sprite fields missing`);
        }
      }
    }
    assertEmpty(problems, 'Costumes with an incomplete data shape');
  });

  test('every fighter has a default outfit and it is always first', () => {
    const problems = [];
    for (const fighterId of FIGHTER_ORDER) {
      const list = costumesFor(fighterId);
      if (list[0]?.id !== 'default') problems.push(`${fighterId}: no default outfit first`);
      if (list[0]?.name !== 'Default Outfit') problems.push(`${fighterId}: default is misnamed`);
    }
    assertEmpty(problems, 'Fighters without a usable default outfit');
  });

  test('a costume claiming its own art really has it', () => {
    const problems = [];
    for (const key of COSTUMES_WITH_ART) {
      const [fighterId, costumeId] = key.split(':');
      const dir = `assets/fighters/${fighterId}/costumes/${costumeId}`;
      if (!exists(`${dir}/sprite-sheet.png`)) problems.push(`${key}: no sprite sheet`);
      if (!exists(`${dir}/portrait.png`)) problems.push(`${key}: no portrait`);
      if (!exists(`${dir}/fighter.json`)) problems.push(`${key}: no metadata`);
      const costume = getCostume(fighterId, costumeId);
      if (costume.assetStatus !== ASSET_STATUS.COMPLETE) {
        problems.push(`${key}: art on disk but status is ${costume.assetStatus}`);
      }
    }
    assertEmpty(problems, 'Costumes claiming art they do not have');
    assertAtLeast(COSTUMES_WITH_ART.length, 18, 'The first art batch is 18 costumes');
  });

  test('a costume without its own art is marked fallback, not complete', () => {
    const lying = [];
    for (const fighterId of FIGHTER_ORDER) {
      for (const c of costumesFor(fighterId)) {
        const hasArt = exists(`assets/fighters/${fighterId}/costumes/${c.id}/sprite-sheet.png`);
        if (!hasArt && c.assetStatus === ASSET_STATUS.COMPLETE) {
          lying.push(`${fighterId}/${c.id} claims complete with no sprite set`);
        }
        if (!hasArt && c.spriteSetId) {
          lying.push(`${fighterId}/${c.id} points at a sprite set that is not there`);
        }
      }
    }
    assertEmpty(lying, 'Costumes passing a fallback off as finished art');
  });

  test('a transformation claiming its own art really has it', () => {
    const problems = [];
    for (const formId of FORMS_WITH_ART) {
      const form = TRANSFORMATIONS[formId];
      if (!form) { problems.push(`${formId}: not a real transformation`); continue; }
      const dir = `assets/fighters/${form.fighterId}/forms/${formId}`;
      if (!exists(`${dir}/sprite-sheet.png`)) problems.push(`${formId}: no sprite sheet`);
      if (form.assetStatus !== 'complete') problems.push(`${formId}: status ${form.assetStatus}`);
      if (form.spriteSetId !== formId) problems.push(`${formId}: spriteSetId mismatch`);
    }
    assertEmpty(problems, 'Transformations claiming art they do not have');
    assertAtLeast(FORMS_WITH_ART.length, 30, 'The first transformation art batch');
  });

  test('transformations without art fall back rather than claim completion', () => {
    const lying = Object.values(TRANSFORMATIONS)
      .filter((t) => t.assetStatus === 'complete'
        && !exists(`assets/fighters/${t.fighterId}/forms/${t.id}/sprite-sheet.png`))
      .map((t) => t.id);
    assertEmpty(lying, 'Transformations claiming art they do not have');
    const noStatus = Object.values(TRANSFORMATIONS).filter((t) => !t.assetStatus).map((t) => t.id);
    assertEmpty(noStatus, 'Transformations with no assetStatus');
  });

  test('every transformation declares the effect hooks', () => {
    const problems = [];
    for (const t of Object.values(TRANSFORMATIONS)) {
      if (!t.activationEffect) problems.push(`${t.id}: no activationEffect`);
      if (!t.revertEffect) problems.push(`${t.id}: no revertEffect`);
      if (!t.auraEffect) problems.push(`${t.id}: no auraEffect`);
      if (t.spriteSetId === undefined) problems.push(`${t.id}: no spriteSetId field`);
      if (t.portrait === undefined) problems.push(`${t.id}: no portrait field`);
    }
    assertEmpty(problems, 'Transformations missing the artwork/effect hooks');
  });

  test('every sprite set on disk has all 18 required animations', () => {
    const required = Object.keys(REQUIRED_ANIMATIONS);
    assertEqual(required.length, 18, 'The brief lists 18 required animations');
    const problems = [];
    const check = (dir, label) => {
      if (!exists(`${dir}/fighter.json`)) return;
      const missing = missingAnimations(readMeta(dir));
      if (missing.length) problems.push(`${label}: missing ${missing.join(', ')}`);
    };
    for (const fighterId of FIGHTER_ORDER) {
      check(`assets/fighters/${fighterId}`, fighterId);
    }
    for (const key of COSTUMES_WITH_ART) {
      const [f, c] = key.split(':');
      check(`assets/fighters/${f}/costumes/${c}`, key);
    }
    for (const formId of FORMS_WITH_ART) {
      const form = TRANSFORMATIONS[formId];
      if (form) check(`assets/fighters/${form.fighterId}/forms/${formId}`, formId);
    }
    assertEmpty(problems, 'Sprite sets missing required animations');
  });

  test('the asset manifest matches what is on disk', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'assets', 'asset-manifest.json'), 'utf8'),
    );
    assertAtLeast(manifest.entries.length, 300, 'The manifest should cover the whole roster');
    const wrong = manifest.entries.filter((e) => {
      const onDisk = exists(e.spritePath);
      return (e.assetStatus === 'complete') !== onDisk;
    });
    assertEmpty(wrong.slice(0, 10).map((e) => `${e.fighterId}/${e.costumeId || e.transformationId}`),
      'Manifest entries whose status disagrees with the filesystem');
    const noFallback = manifest.entries
      .filter((e) => e.assetStatus === 'fallback' && !e.fallbackTo)
      .map((e) => `${e.fighterId}/${e.costumeId || e.transformationId}`);
    assertEmpty(noFallback, 'Fallback entries that do not say what they fall back to');
  });

  /* ------------------------------------------------------ save / equip -- */

  test('costume selection persists in the save', () => {
    const sm = saveManager;
    sm.data = defaultSave();
    assertEqual(sm.equippedCostume('naruto'), 'default', 'starts on the default outfit');
    sm.equipCostume('naruto', 'kid');
    assertEqual(sm.equippedCostume('naruto'), 'kid', 'equipping sticks');
    assertEqual(sm.data.equippedCostumes.naruto, 'kid', 'and is written to the save');
    // Survives a save/load round trip.
    const roundTripped = migrate(JSON.parse(JSON.stringify(sm.data)));
    assertEqual(roundTripped.equippedCostumes.naruto, 'kid', 'survives a reload');
  });

  test('locked costumes cannot be equipped', () => {
    const sm = saveManager;
    sm.data = defaultSave();
    assert(!sm.isCostumeUnlocked('naruto', 'hokage'), 'Hokage starts locked');
    const got = sm.equipCostume('naruto', 'hokage');
    assertEqual(got, 'default', 'equipping a locked costume must not take effect');
    assertEqual(sm.equippedCostume('naruto'), 'default', 'and must not be stored');
    sm.unlockCostume('naruto', 'hokage');
    assertEqual(sm.equipCostume('naruto', 'hokage'), 'hokage', 'it works once unlocked');
  });

  test('the base costume always works, even for a corrupt selection', () => {
    const sm = saveManager;
    sm.data = defaultSave();
    sm.data.equippedCostumes.naruto = 'not_a_real_costume';
    assertEqual(sm.equippedCostume('naruto'), 'default',
      'an unknown costume falls back to the default outfit');
    for (const fighterId of FIGHTER_ORDER) {
      assert(sm.isCostumeUnlocked(fighterId, 'default'),
        `${fighterId}: the default outfit must always be available`);
    }
  });

  test('mastery unlocks a costume without an explicit unlock', () => {
    const sm = saveManager;
    sm.data = defaultSave();
    assert(!sm.isCostumeUnlocked('naruto', 'hokage'), 'locked at mastery 0');
    sm.data.mastery.naruto = { level: 5, xp: 0, wins: 0, matches: 0 };
    assert(sm.isCostumeUnlocked('naruto', 'hokage'), 'unlocked at mastery 5');
  });

  /* --------------------------------------------------- render priority -- */

  test('a costume sprite overrides the base sprite', () => {
    registerSets([
      { id: 'naruto', dir: 'assets/fighters/naruto' },
      { id: 'naruto__hokage', dir: 'assets/fighters/naruto/costumes/hokage' },
    ]);
    const base = new Fighter('naruto', { side: 1 });
    assertEqual(base.sheet.meta.id, 'naruto', 'default outfit uses the base set');

    const dressed = new Fighter('naruto', { side: 1, costumeId: 'hokage' });
    assertEqual(dressed.sheet.meta.id, 'naruto__hokage', 'the costume set wins over the base');
  });

  test('a transformation sprite overrides the costume sprite', () => {
    registerSets([
      { id: 'naruto', dir: 'assets/fighters/naruto' },
      { id: 'naruto__hokage', dir: 'assets/fighters/naruto/costumes/hokage' },
      { id: 'naruto_sage', dir: 'assets/fighters/naruto/forms/naruto_sage' },
    ]);
    const f = new Fighter('naruto', { side: 1, costumeId: 'hokage' });
    assertEqual(f.sheet.meta.id, 'naruto__hokage', 'starts in the costume');
    f.setFormSprite('naruto_sage');
    assertEqual(f.sheet.meta.id, 'naruto_sage', 'the transformation takes priority');
  });

  test('reverting restores the selected costume, not the base art', () => {
    registerSets([
      { id: 'naruto', dir: 'assets/fighters/naruto' },
      { id: 'naruto__hokage', dir: 'assets/fighters/naruto/costumes/hokage' },
      { id: 'naruto_sage', dir: 'assets/fighters/naruto/forms/naruto_sage' },
    ]);
    const f = new Fighter('naruto', { side: 1, costumeId: 'hokage' });
    f.setFormSprite('naruto_sage');
    assertEqual(f.sheet.meta.id, 'naruto_sage', 'transformed');
    f.setFormSprite(null);
    assertEqual(f.sheet.meta.id, 'naruto__hokage', 'reverts to the chosen costume');
  });

  test('transforming preserves position, facing, health and combat state', () => {
    registerSets([
      { id: 'naruto', dir: 'assets/fighters/naruto' },
      { id: 'naruto_sage', dir: 'assets/fighters/naruto/forms/naruto_sage' },
    ]);
    const e = new CombatEngine();
    e.setup({
      playerId: 'naruto', opponentId: 'sasuke', stageId: 'training_dojo',
      difficulty: 'normal', rounds: 1, timer: 99,
    });
    const f = e.player;
    for (let i = 0; i < 90; i++) e.step(SIM_DT);
    f.x = 742;
    f.y = 0;
    f.facing = -1;
    f.health = 613;
    f.chakra = 44;
    f.awakening = 100;
    const before = {
      x: f.x, y: f.y, facing: f.facing, health: f.health, chakra: f.chakra,
      target: f.trackTarget, state: f.state, animName: f.anim.name,
    };

    const form = transform(f, null, null);
    assert(form, 'the transformation should activate');

    assertEqual(f.x, before.x, 'position x preserved');
    assertEqual(f.y, before.y, 'position y preserved');
    assertEqual(f.facing, before.facing, 'facing preserved');
    assertEqual(f.health, before.health, 'health preserved');
    assertEqual(f.trackTarget, before.target, 'current target preserved');
    assertEqual(f.anim.name, before.animName, 'animation state preserved');
    assert(f.chakra <= before.chakra, 'chakra is only spent, never restored');
    e.destroy();
  });

  test('a missing costume sprite falls back safely and is reported', () => {
    clearSpriteFallbacks();
    // Only the base set is registered; the costume set is deliberately absent.
    registerSets([{ id: 'naruto', dir: 'assets/fighters/naruto' }]);
    const f = new Fighter('naruto', { side: 1, costumeId: 'hokage' });
    assertEqual(f.sheet.meta.id, 'naruto', 'falls back to the base fighter art');
    assert(f.anim.available, 'and stays animatable');
    const reported = spriteFallbacks();
    assert(reported.some((r) => r.level === 'costume' && r.want === 'naruto__hokage'),
      `The fallback must be reported, got ${JSON.stringify(reported)}`);
  });

  test('a missing transformation sprite falls back safely and is reported', () => {
    clearSpriteFallbacks();
    registerSets([
      { id: 'naruto', dir: 'assets/fighters/naruto' },
      { id: 'naruto__hokage', dir: 'assets/fighters/naruto/costumes/hokage' },
    ]);
    const f = new Fighter('naruto', { side: 1, costumeId: 'hokage' });
    f.setFormSprite('naruto_baryon');
    assertEqual(f.sheet.meta.id, 'naruto__hokage',
      'an absent form set falls through to the costume, not to nothing');
    const reported = spriteFallbacks();
    assert(reported.some((r) => r.level === 'transformation'),
      'The transformation fallback must be reported');
  });

  test('with no art at all the fighter still runs procedurally', () => {
    spriteRegistry.clear();
    const f = new Fighter('naruto', { side: 1, costumeId: 'hokage' });
    assertEqual(f.sheet, null, 'no sheet');
    assert(!f.anim.available, 'the animator reports itself unavailable');
    const ctx = { effects: { emit() {}, number() {} }, playSound() {}, fireProjectile() {} };
    for (let i = 0; i < 60; i++) f.step(SIM_DT, ctx);
    assert(f.time > 0, 'combat still simulates');
  });

  /* ------------------------------------------------------------ matches -- */

  test('a mirror match can use different costumes on each side', () => {
    const e = new CombatEngine();
    e.setup({
      playerId: 'naruto', opponentId: 'naruto', stageId: 'training_dojo',
      difficulty: 'normal', rounds: 1, timer: 99,
      playerCostume: 'hokage', opponentCostume: 'kid',
    });
    assertEqual(e.player.costumeId, 'hokage', 'player costume');
    assertEqual(e.enemy.costumeId, 'kid', 'AI costume');
    assert(e.player !== e.enemy, 'two separate fighters');
    assertEqual(e.player.costumeSetId, 'naruto__hokage', 'player sprite set');
    assertEqual(e.enemy.costumeSetId, 'naruto__kid', 'AI sprite set');
    const counts = e.assertPvE();
    assertEqual(counts.human, 1, 'still one human');
    assertEqual(counts.ai, 1, 'still one AI');
    e.destroy();
  });

  test('the costume choice carries into the match', () => {
    const e = new CombatEngine();
    e.setup({
      playerId: 'gaara', opponentId: 'sasuke', stageId: 'training_dojo',
      difficulty: 'normal', rounds: 1, timer: 99,
      playerCostume: 'kazekage', opponentCostume: 'adult',
    });
    assertEqual(e.player.costumeId, 'kazekage', 'player costume reached the fighter');
    assertEqual(e.enemy.costumeId, 'adult', 'AI costume reached the fighter');
    e.destroy();
  });

  test('costumes never become extra roster cards', () => {
    const strays = [];
    for (const fighterId of Object.keys(COSTUMES)) {
      for (const c of costumesFor(fighterId)) {
        const asFighter = `${fighterId}_${c.id}`;
        if (FIGHTERS[c.id] && c.id !== 'default') strays.push(`${c.id} is a fighter id`);
        if (FIGHTERS[asFighter]) strays.push(`${asFighter} is a fighter id`);
      }
    }
    for (const t of Object.values(TRANSFORMATIONS)) {
      if (FIGHTERS[t.id]) strays.push(`${t.id} is a fighter id`);
    }
    assertEmpty(strays, 'Costumes or transformations leaking into the roster');
    assertEqual(FIGHTER_ORDER.length, 110, 'the roster is still exactly 110');
  });

  test('every fighter with a choice exposes at least two wearable costumes', () => {
    const sm = saveManager;
    sm.data = defaultSave();
    const problems = [];
    for (const fighterId of Object.keys(COSTUMES)) {
      if (!hasCostumeChoice(fighterId)) problems.push(`${fighterId}: no choice at all`);
      const wearable = costumesFor(fighterId)
        .filter((c) => sm.isCostumeUnlocked(fighterId, c.id));
      if (wearable.length < 2) problems.push(`${fighterId}: only ${wearable.length} wearable`);
    }
    assertEmpty(problems, 'Fighters whose costume picker would be pointless');
  });

  test('costumeSpriteSetId is null for anything without art', () => {
    assertEqual(costumeSpriteSetId('naruto', 'default'), null, 'default has no set of its own');
    assertEqual(costumeSpriteSetId('naruto', 'the_last'), null, 'no art yet -> null');
    assertEqual(costumeSpriteSetId('naruto', 'hokage'), 'naruto__hokage', 'art -> set id');
  });
}
