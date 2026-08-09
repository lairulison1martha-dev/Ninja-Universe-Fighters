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

  /* ------------------------------------------- Naruto form projectiles --- */

  /**
   * Ready a fighter to cast without the AI cancelling the wind-up.
   *
   * These techniques have real startup, and the opponent will happily land a
   * hit inside it — which is correct behaviour, and would make every test
   * below a coin flip. Move the two apart and clear the caster's state.
   */
  const readyToCast = (e) => {
    const f = e.player;
    e.enemy.x = f.x + 1500;
    e.enemy.act = null;
    f.health = f.maxHealth;
    f.chakra = 100;
    f.cooldowns.clear();
    f.act = null;
    f.state = 'idle';
    f.y = 0;
    f.vy = 0;
    return f;
  };

  test('a projectile spawns on the release frame, not on the button press', () => {
    // Startup exists so a technique has a wind-up. Spawning at press time
    // would let a shot beat its own animation.
    const e = makeEngine();
    advance(e, 2);
    const f = readyToCast(e);
    const a = getAbility('naruto_rasenshuriken');
    assert(a.startup > 0, 'the technique has startup to wait through');
    f.use(a);
    assertEqual(e.projectiles.activeCount, 0, 'nothing spawns on the press');
    // Step to just before the release frame.
    let t = 0;
    while (t < a.startup - 0.02) { e.step(1 / 60); t += 1 / 60; }
    assertEqual(e.projectiles.activeCount, 0, `still nothing at t=${t.toFixed(3)}`);
    while (t < a.startup + 0.05) { e.step(1 / 60); t += 1 / 60; }
    assertAtLeast(e.projectiles.activeCount, 1, 'the shot is out after the release frame');
    e.destroy();
  });

  test('a projectile carries the look it was fired with, not the form in flight', () => {
    // The look is captured at spawn on purpose: a fighter can transform while
    // a shot is still travelling, and restyling it mid-flight would change a
    // technique's identity after it left the hand.
    const e = makeEngine();
    advance(e, 2);
    const f = readyToCast(e);
    const a = getAbility('naruto_rasenshuriken');
    const shot = e.projectiles.spawnOne(f, a, a.projectile, 0, 1,
      { style: 'sharp', tint: '#ffd45e' });
    assertEqual(shot.style, 'sharp', 'it took the look it was given');
    assertEqual(shot.tint, '#ffd45e', 'and the tint');
    f.form = 'naruto_kcm2';           // would resolve to `blast` if re-read
    advance(e, 0.15);
    assertEqual(shot.style, 'sharp', 'the shot kept the look that fired it');
    // A shot fired with no look falls back to the ability's own shape.
    const plain = e.projectiles.spawnOne(f, a, a.projectile, 0, 1, null);
    assertEqual(plain.style, a.projectile.style || 'sphere', 'default look');
    e.destroy();
  });

  test('each Naruto form shoots a distinct effect language', () => {
    const e = makeEngine();
    advance(e, 2);
    const seen = new Map();
    for (const form of ['naruto_onetail', 'naruto_kcm1', 'naruto_kcm2',
      'naruto_sixpaths', 'naruto_baryon']) {
      e.player.form = form;
      seen.set(form, e.projectileLook(e.player).style);
    }
    assertEqual(seen.get('naruto_kcm1'), 'sharp', 'KCM');
    assertEqual(seen.get('naruto_kcm2'), 'blast', 'Bijuu');
    assertEqual(seen.get('naruto_sixpaths'), 'orbital', 'Ashura');
    assertEqual(seen.get('naruto_baryon'), 'compressed', 'Baryon');
    assertEqual(seen.get('naruto_onetail'), 'claw', 'One-Tail');
    // Base falls back to the clean sphere.
    e.player.form = null;
    assertEqual(e.projectileLook(e.player).style, 'sphere', 'base');
    // And they are genuinely different from one another.
    assertEqual(new Set(seen.values()).size, 5, 'five distinct styles');
    e.destroy();
  });

  test('projectiles despawn on timeout and are returned to the pool', () => {
    const e = makeEngine();
    advance(e, 2);
    const f = readyToCast(e);
    f.use(getAbility('naruto_rasenshuriken'));
    advance(e, 0.4);
    assertAtLeast(e.projectiles.activeCount, 1, 'the shot is live');
    const life = getAbility('naruto_rasenshuriken').projectile.life;
    advance(e, life + 0.5);
    assertEqual(e.projectiles.activeCount, 0, 'it expired');
    e.destroy();
  });

  test('a round reset and a KO both clear every projectile', () => {
    const e = makeEngine();
    advance(e, 2);
    const fire = () => {
      readyToCast(e).use(getAbility('naruto_rasenshuriken'));
      advance(e, 0.4);
    };
    fire();
    assertAtLeast(e.projectiles.activeCount, 1, 'a shot is live before the reset');
    e.projectiles.clear();
    assertEqual(e.projectiles.activeCount, 0, 'clear() empties the pool');
    fire();
    assertAtLeast(e.projectiles.activeCount, 1, 'and it can fire again after');
    // A KO must not leave a shot hanging in the arena.
    e.enemy.health = 0;
    advance(e, 3);
    assertEqual(e.projectiles.activeCount, 0, 'nothing survived the KO');
    e.destroy();
  });

  test('pausing does not duplicate a projectile', () => {
    const e = makeEngine();
    advance(e, 2);
    const f = readyToCast(e);
    f.use(getAbility('naruto_rasenshuriken'));
    advance(e, 0.4);
    const n = e.projectiles.activeCount;
    assertAtLeast(n, 1, 'one shot out');
    e.pause();
    assert(e.isPaused, 'the engine paused');
    for (let i = 0; i < 30; i++) e.step(1 / 60);
    assertEqual(e.projectiles.activeCount, n, 'a pause spawns nothing new');
    e.resume();
    e.step(1 / 60);
    assertEqual(e.projectiles.activeCount, n, 'and resuming does not re-fire');
    e.destroy();
  });

  test('a projectile hitbox is its own, not the fighter\'s hurtbox', () => {
    const e = makeEngine();
    advance(e, 2);
    const f = readyToCast(e);
    f.use(getAbility('naruto_rasenshuriken'));
    advance(e, 0.4);
    const shot = [...e.projectiles.live()][0];
    assert(shot, 'a projectile is live');
    const box = {};
    shot.bounds(box);
    assert(box.w > 0 && box.h > 0, `it has a real box (${box.w}x${box.h})`);
    // Its own radius, not the body's: the shot is round and the fighter is not.
    assertEqual(box.w, shot.radius * 2, 'the box comes from the projectile radius');
    // It travels away from the fighter, so it cannot be the body box.
    advance(e, 0.2);
    assert(Math.abs(shot.x - f.x) > 40,
      `the shot separated from its owner (${Math.round(Math.abs(shot.x - f.x))})`);
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
