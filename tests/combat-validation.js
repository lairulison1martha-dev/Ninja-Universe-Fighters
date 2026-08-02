/**
 * Combat simulation tests.
 *
 * These actually run the engine headlessly for hundreds of simulated frames to
 * check that a match reaches a conclusion, that damage scaling and the combo
 * cap work, and that transformations refuse to activate without their
 * requirements.
 */

import { suite, test, assert, assertEqual, assertAtLeast, installBrowserStubs } from './helpers.js';

installBrowserStubs();

const { CombatEngine, PHASE } = await import('../js/combat/combat-engine.js');
const { ComboTracker } = await import('../js/combat/combo-system.js');
const { canTransform } = await import('../js/combat/transformation-system.js');
const { COMBAT, SIM_DT } = await import('../js/constants.js');
const { getAbility } = await import('../js/data/abilities.js');

function makeEngine(overrides = {}) {
  const e = new CombatEngine();
  e.setup({
    playerId: 'naruto',
    opponentId: 'sasuke',
    stageId: 'training_dojo',
    difficulty: 'normal',
    rounds: 1,
    timer: 99,
    ...overrides,
  });
  return e;
}

/** Advance the engine by `seconds` of simulated time. */
function advance(engine, seconds) {
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) engine.step(SIM_DT);
}

export function run() {
  suite('combat-validation');

  test('an engine can be created and stepped without throwing', () => {
    const e = makeEngine();
    advance(e, 3);
    assert(e.fighters.length === 2, 'Two fighters expected');
    assert(e.phase === PHASE.FIGHT, `Expected FIGHT phase, got ${e.phase}`);
    e.destroy();
  });

  test('the intro phase ends and both fighters become actionable', () => {
    const e = makeEngine();
    advance(e, 2);
    assertEqual(e.player.state, 'idle', 'Player should be idle after the intro');
    e.destroy();
  });

  test('a match with a 1-second timer resolves by time-out', () => {
    const e = makeEngine({ timer: 1 });
    let ended = null;
    e.addEventListener('match-end', (ev) => { ended = ev.detail; });
    advance(e, 12);
    assert(ended, 'The match never ended');
    e.destroy();
  });

  test('damage scaling reduces later hits in a combo', () => {
    const c = new ComboTracker();
    const first = c.addHit(100);
    for (let i = 0; i < 10; i++) c.addHit(100);
    const late = c.addHit(100);
    assertEqual(first, 100, 'First hit should be unscaled');
    assert(late < first * 0.75, `Late hits should scale down, got ${late}`);
    assert(late >= 100 * COMBAT.comboScalingMin - 0.001, 'Scaling should not fall below the floor');
  });

  test('the combo cap is enforced', () => {
    const c = new ComboTracker();
    for (let i = 0; i < COMBAT.maxHitsPerCombo; i++) c.addHit(10);
    assert(c.atCap, 'Combo should be at the cap');
  });

  test('wall and ground bounces are limited to once per combo', () => {
    const c = new ComboTracker();
    assert(c.canWallBounce(), 'First wall bounce should be allowed');
    c.useWallBounce();
    assert(!c.canWallBounce(), 'Second wall bounce should be blocked');
    assert(c.canGroundBounce(), 'Ground bounce is tracked separately');
    c.useGroundBounce();
    assert(!c.canGroundBounce(), 'Second ground bounce should be blocked');
  });

  test('transformations refuse to activate without their requirements', () => {
    const e = makeEngine();
    advance(e, 2);
    const f = e.player;
    f.awakening = 0;
    const denied = canTransform(f);
    assert(!denied.ok, 'Transform should be denied at 0 awakening');
    assert(denied.reason.length > 0, 'A reason should be given');

    f.awakening = 100;
    f.chakra = 100;
    const allowed = canTransform(f);
    assert(allowed.ok, `The first form in the chain should be legal, got: ${allowed.reason}`);
    assert(allowed.form.id === 'naruto_onetail',
      `Expected the chain to start at One-Tail Cloak, got ${allowed.form.id}`);
    e.destroy();
  });

  test('a chained form cannot be skipped', () => {
    const e = makeEngine();
    advance(e, 2);
    const f = e.player;
    f.awakening = 100;
    f.chakra = 100;
    // naruto_kcm2 requires naruto_kcm1 first.
    const res = canTransform(f, 'naruto_kcm2');
    assert(!res.ok, 'Should not be able to jump straight to KCM2');
    e.destroy();
  });

  test('once-per-match forms cannot be used twice', () => {
    const e = makeEngine();
    advance(e, 2);
    const f = e.player;
    f.ignoreUnlocks = true;
    f.form = 'naruto_sixpaths';
    f.awakening = 100;
    f.health = f.maxHealth * 0.2;
    f.usedForms.add('naruto_baryon');
    const res = canTransform(f, 'naruto_baryon');
    assert(!res.ok && /once per match/i.test(res.reason), `Expected once-per-match refusal, got: ${res.reason}`);
    e.destroy();
  });

  test('an ability cannot be used without enough chakra', () => {
    const e = makeEngine();
    advance(e, 2);
    const f = e.player;
    f.chakra = 0;
    const rasengan = getAbility('naruto_rasengan');
    const res = f.canUse(rasengan);
    assert(!res.ok, 'Rasengan should be refused at 0 chakra');
    e.destroy();
  });

  test('cooldowns block repeat use and then expire', () => {
    const e = makeEngine();
    advance(e, 2);
    const f = e.player;
    f.chakra = 100;
    const a = getAbility('naruto_rasengan');
    assert(f.use(a), 'First use should succeed');
    assert(f.cooldownLeft(a.id) > 0, 'Cooldown should be running');
    f.chakra = 100;
    assert(!f.canUse(a).ok, 'Second use should be blocked');
    advance(e, a.cooldown + 1);
    f.chakra = 100;
    assertEqual(f.cooldownLeft(a.id), 0, 'Cooldown should have expired');
    e.destroy();
  });

  test('the AI never inspects the opponent input buffer', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(fileURLToPath(new URL('../js/combat/ai-controller.js', import.meta.url)), 'utf8');
    assert(!/\.buffer\b/.test(src), 'AI reads an input buffer');
    assert(!/input\.p1|inputManager|InputState/.test(src), 'AI imports player input state');
    assert(/reaction/.test(src), 'AI has no reaction delay');
  });

  test('every difficulty has a non-zero reaction delay', () => {
    // A zero delay would let the AI act on the same frame as the player.
    const { DIFFICULTY_TUNING } = globalThis.__NUF_TUNING || {};
    void DIFFICULTY_TUNING;
    for (const [name, t] of Object.entries(TUNING)) {
      assert(t.reaction > 0, `${name} has a zero reaction delay`);
    }
  });

  test('a full AI-vs-AI match completes without errors', () => {
    const e = makeEngine({ playerId: 'lee', opponentId: 'gaara', timer: 20, rounds: 1 });
    // Give the player an AI too, so both sides act.
    const { AIController } = AI;
    const ai = new AIController(e.player, 'hard');
    e.controllers.set(e.player.id, ai);
    let ended = null;
    e.addEventListener('match-end', (ev) => { ended = ev.detail; });
    advance(e, 40);
    assert(ended, 'AI-vs-AI match did not finish');
    assertAtLeast(e.player.stats.damageDealt + e.enemy.stats.damageDealt, 1,
      'Neither AI landed a single hit in 20 seconds');
    e.destroy();
  });

  test('projectiles are pooled, not allocated per shot', () => {
    const e = makeEngine();
    advance(e, 2);
    const before = e.projectiles.items.length;
    const f = e.player;
    for (let i = 0; i < 40; i++) {
      f.chakra = 100;
      f.cooldowns.clear();
      f.act = null;
      f.state = 'idle';
      f.use(getAbility('naruto_rasenshuriken'));
      advance(e, 0.4);
    }
    assertEqual(e.projectiles.items.length, before, 'Projectile pool grew');
    e.destroy();
  });

  test('the effect pool has a hard ceiling', () => {
    const e = makeEngine();
    for (let i = 0; i < 200; i++) e.effects.emit('ultimate_burst', 500, 100, { countScale: 2 });
    assert(e.effects.activeCount <= e.effects.p.length, 'Effect pool overflowed');
    e.destroy();
  });
}

const { DIFFICULTY_TUNING: TUNING } = await import('../js/constants.js');
const AI = await import('../js/combat/ai-controller.js');
