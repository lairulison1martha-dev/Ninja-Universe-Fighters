/**
 * Combat engine.
 *
 * Owns the match: two fighters, the arena, projectiles, effects, the camera,
 * round flow and hit resolution. Simulation is a FIXED TIMESTEP (see
 * game-loop.js); rendering is decoupled.
 */

import { ARENA, COMBAT, SIM_DT, DIFFICULTY_TUNING } from '../constants.js';
import { getAbility } from '../data/abilities.js';
import { getStage } from '../data/stages.js';
import { CONDITIONS } from '../data/arcade.js';
import settings from '../settings-manager.js';
import audio from '../audio-manager.js';
import { Fighter } from './fighter.js';
import { AIController } from './ai-controller.js';
import { ProjectilePool } from './projectile.js';
import { EffectPool } from './effect-pool.js';
import { CameraController } from './camera-controller.js';
import { AssistSystem } from './assist-system.js';
import { STATE, HIT_STATES } from './fighter-state.js';
import { SCRATCH, overlaps } from './hitbox.js';
import { canBlock, applyBlock } from './guard-system.js';
import { substitute } from './substitution-system.js';
import { transform, endOfRoundReset } from './transformation-system.js';
import { applyStatusEffects } from './status-effects.js';

export const PHASE = {
  INTRO: 'intro',
  FIGHT: 'fight',
  ROUND_END: 'round-end',
  MATCH_END: 'match-end',
  PAUSED: 'paused',
};

export class CombatEngine extends EventTarget {
  constructor() {
    super();
    this.effects = new EffectPool();
    this.projectiles = new ProjectilePool();
    this.camera = new CameraController();
    this.assists = new AssistSystem(this.effects);
    this.fighters = [];
    this.controllers = new Map();
    this.pendingProjectiles = [];
    this.hitStop = 0;
    this.slowMo = 0;
    this.phase = PHASE.INTRO;
    this.phaseTimer = 0;
    this.time = 0;
    this.config = null;
    this.stage = null;
    this.round = 1;
    this.roundWins = [0, 0];
    this.roundTime = COMBAT.roundTimeDefault;
    this.trainingData = null;
    this.conditions = [];
    this.lastAnnouncement = '';
  }

  /* --------------------------------------------------------------- setup -- */

  /**
   * @param {{
   *   playerId: string, opponentId: string, stageId: string, variant?: string,
   *   difficulty?: string, rounds?: number, timer?: number, mode?: string,
   *   conditions?: string[], opponentHealthBonus?: number, training?: boolean,
   *   startHealth?: number
   * }} cfg
   */
  setup(cfg) {
    this.config = cfg;
    this.stage = getStage(cfg.stageId) || getStage('training_dojo');
    this.variant = cfg.variant || this.stage.defaultVariant || 'day';
    this.roundsToWin = Math.ceil((cfg.rounds ?? settings.values.defaultRounds) / 2);
    this.maxRounds = cfg.rounds ?? settings.values.defaultRounds;
    this.round = 1;
    this.roundWins = [0, 0];
    this.time = 0;

    // Build the rule set from the named conditions.
    const rules = {
      chakraRegen: COMBAT.chakraRegen,
      startHealth: cfg.startHealth ?? 1,
      startHealthOpponent: 1,
      opponentHealthBonus: cfg.opponentHealthBonus ?? 0,
      substitutionStocks: COMBAT.substitutionStocks,
      guardDisabled: false,
      ultimateDisabled: false,
      transformDisabled: false,
      roundTime: cfg.timer ?? settings.values.defaultTimer,
      damageMultiplier: 1,
      opponentRangedOnly: false,
    };
    this.conditions = [];
    for (const id of cfg.conditions || []) {
      const c = CONDITIONS[id];
      if (!c) continue;
      c.apply(rules);
      this.conditions.push({ id, label: c.label });
    }
    this.rules = rules;
    this.roundTime = rules.roundTime || COMBAT.roundTimeDefault;

    const player = new Fighter(cfg.playerId, {
      side: 1, isPlayer: true, ignoreUnlocks: !!cfg.training,
    });
    const enemy = new Fighter(cfg.opponentId, {
      side: -1, isPlayer: false, healthBonus: rules.opponentHealthBonus,
      ignoreUnlocks: true,
    });

    for (const [f, frac] of [[player, rules.startHealth], [enemy, rules.startHealthOpponent]]) {
      f.startHealthFraction = frac;
      f.chakraRegenRate = rules.chakraRegen;
      f.guardDisabled = rules.guardDisabled;
      f.ultimateDisabled = rules.ultimateDisabled;
      f.transformDisabled = rules.transformDisabled;
      f.damageMultiplier = rules.damageMultiplier;
      f.substitutionsDisabled = rules.substitutionStocks === 0;
    }

    this.fighters = [player, enemy];
    this.player = player;
    this.enemy = enemy;
    player.trackTarget = enemy;
    enemy.trackTarget = player;
    player.opponentHasStatus = (id) => enemy.statuses.some((s) => s.id === id);
    enemy.opponentHasStatus = (id) => player.statuses.some((s) => s.id === id);

    this.assists.register(player);
    this.assists.register(enemy);

    const difficulty = cfg.difficulty || settings.values.defaultDifficulty;
    const ai = new AIController(enemy, difficulty);
    ai._rng = (cfg.opponentId.length * 2654435761) >>> 0 || 12345;
    if (rules.opponentRangedOnly) ai.rangedOnly = true;
    this.controllers.set(enemy.id, ai);
    this.difficulty = difficulty;
    this.difficultyTuning = DIFFICULTY_TUNING[difficulty] || DIFFICULTY_TUNING.normal;

    this.isTraining = !!cfg.training;
    if (this.isTraining) {
      this.trainingData = {
        lastDamage: 0, comboDamage: 0, comboHits: 0, maxCombo: 0,
        lastMove: '-', frameData: '-',
      };
    }

    this.assertPvE();
    this.startRound(1);
    return this;
  }

  /**
   * Ninja Universe Fighters is single-player PvE: one human, one AI, always.
   *
   * There is no second human controller anywhere in the codebase and no
   * networking, but the shape of a match is easy to break by accident (a mode
   * that forgets to build an AI, a training setup that marks both sides as the
   * player), so the rule is asserted at setup rather than assumed. It throws
   * because a match with two humans or two AIs is not playable — better to fail
   * loudly at the start than to hand the player an unresponsive fight.
   *
   * @returns {{ human: number, ai: number }}
   */
  assertPvE() {
    const human = this.fighters.filter((f) => f.isPlayer);
    const ai = this.fighters.filter((f) => this.controllers.has(f.id));

    if (this.fighters.length !== 2) {
      throw new Error(`A match needs exactly 2 fighters, got ${this.fighters.length}`);
    }
    if (human.length !== 1) {
      throw new Error(`Player vs AI needs exactly 1 human-controlled fighter, got ${human.length}`);
    }
    if (ai.length !== 1) {
      throw new Error(`Player vs AI needs exactly 1 AI-controlled fighter, got ${ai.length}`);
    }
    if (human[0] === ai[0]) {
      throw new Error('The same fighter cannot be both human- and AI-controlled');
    }
    return { human: human.length, ai: ai.length };
  }

  startRound(n) {
    this.round = n;
    this.phase = PHASE.INTRO;
    this.phaseTimer = 1.5;
    this.roundClock = this.roundTime;
    const mid = ARENA.width / 2;
    this.player.resetForRound(mid - 220, 1, n);
    this.enemy.resetForRound(mid + 220, -1, n);
    this.projectiles.clear();
    this.effects.clear();
    this.assists.reset();
    this.pendingProjectiles.length = 0;
    this.camera.snap(this.player, this.enemy);
    this.hitStop = 0;
    this.slowMo = 0;

    if (this.isTraining) this.applyTrainingSettings();

    this.announce(this.maxRounds > 1 ? `Round ${n}` : 'Fight');
    this.dispatchEvent(new CustomEvent('round-start', { detail: { round: n } }));
  }

  applyTrainingSettings() {
    const t = this.trainingSettings || {};
    this.player.infiniteHealth = !!t.infiniteHealth;
    this.player.infiniteChakra = !!t.infiniteChakra;
    this.player.infiniteSubstitution = !!t.infiniteSubstitution;
    this.enemy.infiniteHealth = !!t.dummyInfiniteHealth;
    const ai = this.controllers.get(this.enemy.id);
    if (ai) ai.dummyMode = t.dummy === 'ai' ? null : (t.dummy || 'stationary');
  }

  /* -------------------------------------------------------------- helpers -- */

  abilityById(id) { return getAbility(id); }

  announce(text, seconds = 1.1) {
    this.lastAnnouncement = text;
    this.dispatchEvent(new CustomEvent('announce', { detail: { text, seconds } }));
  }

  playSound(id, source) {
    if (!id) return;
    const pan = source ? Math.max(-0.7, Math.min(0.7, (source.x - this.camera.x) / 700)) : 0;
    audio.play(id, { pan });
  }

  fireProjectile(owner, ability) {
    this.projectiles.fire(owner, ability, this.pendingProjectiles);
  }

  requestTransform(fighter) {
    const form = transform(fighter, null, this.effects);
    if (!form) return false;
    fighter.setState(STATE.TRANSFORM, 0.7);
    this.playSound('sfx_transform', fighter);
    this.camera.shake(14, 0.4);
    audio.duck(0.5, 1.0);
    this.announce(form.displayName, 1.0);
    this.dispatchEvent(new CustomEvent('transform', { detail: { fighter, form } }));
    return true;
  }

  requestSubstitution(fighter) {
    const other = this.other(fighter);
    if (substitute(fighter, other, this.effects)) {
      this.playSound('sfx_substitute', fighter);
      return true;
    }
    return false;
  }

  onUltimateStarted(fighter, ability) {
    if (!ability.cutIn) return;
    this.camera.focusOn(fighter, 0.9);
    audio.duck(0.3, 1.4);
    this.dispatchEvent(new CustomEvent('cutin', {
      detail: { fighter, ability },
    }));
  }

  other(f) { return f === this.fighters[0] ? this.fighters[1] : this.fighters[0]; }

  /* ------------------------------------------------------------ main step -- */

  step(dt) {
    if (this.phase === PHASE.PAUSED) return;

    // Hit-stop freezes the simulation for impact weight.
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.effects.update(dt * 0.25);
      this.camera.update(dt, this.player, this.enemy);
      return;
    }

    let step = dt;
    if (this.slowMo > 0) {
      this.slowMo -= dt;
      step = dt * 0.32;
    }

    this.time += step;

    switch (this.phase) {
      case PHASE.INTRO:
        this.phaseTimer -= dt;
        for (const f of this.fighters) { f.time += step; f.animTime += step; }
        if (this.phaseTimer <= 0) {
          this.phase = PHASE.FIGHT;
          for (const f of this.fighters) f.setState(STATE.IDLE);
          this.announce('Fight!', 0.9);
          this.playSound('sfx_round_start');
        }
        break;

      case PHASE.FIGHT:
        this._stepFight(step);
        break;

      case PHASE.ROUND_END:
        this.phaseTimer -= dt;
        this._stepPhysicsOnly(step);
        if (this.phaseTimer <= 0) this._advanceRound();
        break;

      case PHASE.MATCH_END:
        this._stepPhysicsOnly(step);
        break;

      default: break;
    }

    this.effects.update(step);
    this.camera.update(step, this.player, this.enemy);
  }

  _stepPhysicsOnly(dt) {
    for (const f of this.fighters) f.step(dt, this.ctx(f));
    this.projectiles.update(dt, ARENA, this.fighters);
  }

  ctx(f) {
    if (!this._ctxCache) this._ctxCache = new Map();
    let c = this._ctxCache.get(f.id);
    if (!c) {
      c = {
        effects: this.effects,
        camera: this.camera,
        playSound: (id, src) => this.playSound(id, src),
        fireProjectile: (owner, a) => this.fireProjectile(owner, a),
        engine: this,
      };
      this._ctxCache.set(f.id, c);
    }
    c.opponent = this.other(f);
    return c;
  }

  _stepFight(dt) {
    // Round timer
    if (this.roundTime > 0) {
      this.roundClock = Math.max(0, this.roundClock - dt);
      if (this.roundClock <= 0) { this._timeOut(); return; }
    }

    // AI
    for (const f of this.fighters) {
      const ai = this.controllers.get(f.id);
      if (ai) {
        ai.update(dt, {
          opponent: this.other(f),
          projectiles: this.projectiles,
          engine: this,
          effects: this.effects,
          playSound: (id, src) => this.playSound(id, src),
        });
      }
    }

    // Fighters
    for (const f of this.fighters) f.step(dt, this.ctx(f));

    // Delayed multi-shot projectiles
    for (let i = this.pendingProjectiles.length - 1; i >= 0; i--) {
      const p = this.pendingProjectiles[i];
      p.at -= dt;
      if (p.at <= 0) {
        this.projectiles.spawnOne(p.owner, p.ability, p.spec, p.angle);
        this.pendingProjectiles.splice(i, 1);
      }
    }

    this.projectiles.update(dt, ARENA, this.fighters);
    this.projectiles.resolveClashes((x, y) => {
      this.effects.emit('guard_spark', x, y, { scale: 1.1 });
      this.playSound('sfx_block');
    });

    this._resolveBodyCollision();
    this._leashFighters();
    this._resolveMeleeHits();
    this._resolveProjectileHits();
    this.assists.update(dt, this.fighters, (owner, target, assist) => {
      this._applyAssistHit(owner, target, assist);
    });

    this._checkKO();

    if (this.isTraining) this._updateTrainingReadout();
  }

  /** Fighters push each other apart instead of overlapping. */
  _resolveBodyCollision() {
    const [a, b] = this.fighters;
    if (a.state === STATE.KO || b.state === STATE.KO) return;
    const dx = b.x - a.x;
    const minDist = (a.width + b.width) * 0.5;
    const d = Math.abs(dx);
    if (d >= minDist || d === 0) return;
    // Only push apart on the ground or when both are at similar heights.
    if (Math.abs(a.y - b.y) > 110) return;
    const push = (minDist - d) / 2;
    const dir = Math.sign(dx) || 1;
    a.x -= dir * push;
    b.x += dir * push;
    a.x = Math.max(ARENA.wallPadding, Math.min(ARENA.width - ARENA.wallPadding, a.x));
    b.x = Math.max(ARENA.wallPadding, Math.min(ARENA.width - ARENA.wallPadding, b.x));
  }

  /**
   * Stop the fighters drifting further apart than the camera can frame.
   * Whoever is moving away is pulled back, so a fighter being knocked across
   * the arena still reads on screen.
   */
  _leashFighters() {
    const [a, b] = this.fighters;
    const dx = b.x - a.x;
    const dist = Math.abs(dx);
    const max = COMBAT.maxSeparation;
    if (dist <= max) return;
    const over = dist - max;
    const dir = Math.sign(dx) || 1;
    // Split the correction by who is travelling outward, so a knocked-back
    // fighter keeps their momentum and the other one closes the gap.
    const aOut = Math.max(0, -a.vx * dir);
    const bOut = Math.max(0, b.vx * dir);
    const total = aOut + bOut;
    const aShare = total > 1 ? aOut / total : 0.5;
    a.x += dir * over * aShare;
    b.x -= dir * over * (1 - aShare);
    a.x = Math.max(ARENA.wallPadding, Math.min(ARENA.width - ARENA.wallPadding, a.x));
    b.x = Math.max(ARENA.wallPadding, Math.min(ARENA.width - ARENA.wallPadding, b.x));
  }

  _resolveMeleeHits() {
    for (const attacker of this.fighters) {
      if (!attacker.isActiveFrame) continue;
      const ability = attacker.act.ability;
      const defender = this.other(attacker);
      if (defender.isDead) continue;

      attacker.attackBox(SCRATCH.a, ability);
      defender.hurtbox(SCRATCH.b);
      if (!overlaps(SCRATCH.a, SCRATCH.b)) continue;

      attacker.consumeHit();
      this._applyHit(attacker, defender, ability);
    }
  }

  _resolveProjectileHits() {
    for (const p of this.projectiles.live()) {
      const defender = this.other(p.owner);
      if (defender.isDead) continue;
      if (p.hitIds.has(defender.id)) continue;
      p.bounds(SCRATCH.a);
      defender.hurtbox(SCRATCH.b);
      if (!overlaps(SCRATCH.a, SCRATCH.b)) continue;

      // Reflect sends it back instead of hitting.
      if (defender.mods.reflect) {
        p.vx *= -1;
        p.owner = defender;
        p.hitIds.clear();
        this.effects.emit('yata_shine', p.x, p.y, { scale: 1 });
        this.playSound('sfx_block', defender);
        continue;
      }
      // Absorb converts it into chakra.
      if (defender.mods.absorb) {
        const power = defender.mods.absorbPower * (defender.absorbRefund || 1);
        defender.chakra = Math.min(100, defender.chakra + p.ability.chakraCost * power);
        if (defender.mods.storedJutsu) defender.hasStoredJutsu = true;
        p.active = false;
        this.effects.emit('rinnegan_absorb', defender.x, defender.y + 80, { scale: 1.1 });
        this.playSound('sfx_absorb', defender);
        continue;
      }

      p.hitIds.add(defender.id);
      this._applyHit(p.owner, defender, p.ability, p);
      p.onHit();
    }
  }

  _applyAssistHit(owner, target, assist) {
    if (target.invulnerable) return;
    const dmg = assist.damage * owner.attackPower;
    target.health = Math.max(0, target.health - dmg);
    target.stats.damageTaken += dmg;
    target.vx += Math.sign(target.x - owner.x || 1) * assist.knockbackX;
    target.setState(STATE.HITSTUN, assist.hitStun);
    applyStatusEffects(owner, target, assist.statusEffects, { damage: dmg });
    this.effects.emit(assist.effectId, target.x, target.y + 80, { scale: assist.size, color: assist.color });
    this.effects.number(target.x, target.y + 150, String(Math.round(dmg)), '#cfe8ff');
    this.playSound('sfx_hit_light', target);
  }

  /**
   * The single place damage is applied. Handles blocking, armour, clones,
   * counters, damage scaling, knockback, bounces, awakening and hit-stop.
   */
  _applyHit(attacker, defender, ability, projectile = null) {
    // Invulnerable / phasing defenders take nothing.
    if (defender.invulnerable) {
      this.effects.emit('kamui_warp', defender.x, defender.y + 80, { countScale: 0.5 });
      return;
    }

    // Counter stance: the defender turns the hit into their own punish.
    if (defender.mods.counterStance && !ability.unblockable) {
      defender.invulnUntil = defender.time + 0.35;
      const gc = defender.abilities.guardCounter;
      if (gc) defender.use(gc, { force: true });
      this.effects.emit('sharingan_flash', defender.x, defender.y + 90, { scale: 1.2 });
      this.playSound('sfx_guard_break', defender);
      if (defender.counterChakraRefund) {
        defender.chakra = Math.min(100, defender.chakra + defender.counterChakraRefund);
      }
      return;
    }

    // Clone guard soaks a hit entirely.
    if (defender.mods.cloneHits > 0) {
      const s = defender.statuses.find((v) => v.id === 'clone_guard');
      if (s) {
        s.magnitude -= 1;
        if (s.magnitude <= 0) defender.statuses.splice(defender.statuses.indexOf(s), 1);
        this.effects.emit('clone_flash', defender.x, defender.y + 80, { scale: 1.1 });
        this.playSound('sfx_substitute', defender);
        return;
      }
    }

    const blocked = canBlock(defender, attacker.x, ability);

    if (blocked) {
      const res = applyBlock(defender, ability, attacker);
      const chip = res.chip * attacker.attackPower / defender.defensePower;
      defender.health = Math.max(0, defender.health - chip);
      defender.stats.damageTaken += chip;
      defender.vx = Math.sign(defender.x - attacker.x || attacker.facing) * res.pushback;
      attacker.vx = -attacker.facing * res.pushback * 0.35;
      defender.setState(res.broke ? STATE.GUARDBREAK : STATE.BLOCKSTUN, res.blockStun);
      defender.addAwakening(COMBAT.awakeningOnDamageTaken * 0.4);
      attacker.addAwakening(COMBAT.awakeningOnDamageDealt * 0.3);
      this.effects.emit(res.broke ? 'guard_spark' : 'guard_spark',
        defender.x + defender.facing * 40, defender.y + 90, { scale: res.broke ? 1.8 : 1 });
      this.playSound(res.broke ? 'sfx_guard_break' : 'sfx_block', defender);
      this.hitStop = Math.max(this.hitStop, COMBAT.hitStopBase * 0.6);
      if (res.broke) {
        this.camera.shake(12, 0.25);
        this.announce('Guard Break!', 0.7);
      }
      if (defender.mods.thorns > 0) {
        attacker.health = Math.max(0, attacker.health - defender.mods.thorns);
      }
      this.dispatchEvent(new CustomEvent('block', { detail: { defender, ability } }));
      return;
    }

    // Armour: absorb the hit but still take (reduced) damage and no stun.
    let armoured = false;
    if (defender.armorLeft > 0 && !ability.guardBreak && ability.category !== 'ultimate') {
      defender.armorLeft--;
      armoured = true;
    }

    // --- damage ----------------------------------------------------------
    let raw = ability.damage * attacker.attackPower * attacker.damageMultiplier;
    if (attacker.passiveMeleeBonus > 1 && !ability.projectile) raw *= attacker.passiveMeleeBonus;
    if (attacker.hasStoredJutsu && ability.projectile) {
      raw *= 1 + (attacker.storedJutsuBonus || 0.25);
      attacker.hasStoredJutsu = false;
    }
    if (attacker.criticalBonus && HIT_STATES.has(defender.state) && ability.category === 'heavy') {
      raw *= attacker.criticalBonus;
    }
    if (defender.firstHitReduction && !defender.combo.active && attacker.combo.hits === 0) {
      raw *= 1 - defender.firstHitReduction;
    }
    raw /= defender.defensePower;
    if (armoured) raw *= 0.55;

    const damage = attacker.combo.addHit(raw);
    defender.health = Math.max(0, defender.health - damage);
    attacker.stats.damageDealt += damage;
    defender.stats.damageTaken += damage;
    attacker.stats.hits++;
    if (attacker.combo.hits > attacker.stats.maxCombo) attacker.stats.maxCombo = attacker.combo.hits;

    attacker.addAwakening(COMBAT.awakeningOnDamageDealt * (damage / 30));
    defender.addAwakening(COMBAT.awakeningOnDamageTaken * (damage / 30));

    // --- reactions --------------------------------------------------------
    const dir = Math.sign(defender.x - attacker.x) || attacker.facing;
    if (!armoured) {
      const stunScale = attacker.combo.stunScale();
      defender.vx = dir * ability.knockbackX * (defender.airborne ? 0.75 : 1);
      if (ability.launch || ability.knockbackY < 0) {
        defender.vy = Math.abs(ability.knockbackY || 620);
        defender.y = Math.max(defender.y, 2);
        defender.setState(STATE.LAUNCHED, ability.hitStun * stunScale * 1.4);
        this.playSound('sfx_launch', defender);
      } else if (ability.knockbackY > 0) {
        // downward spike
        defender.vy = -Math.abs(ability.knockbackY);
        defender.setState(STATE.HITSTUN, ability.hitStun * stunScale);
      } else {
        defender.setState(defender.airborne ? STATE.LAUNCHED : STATE.HITSTUN, ability.hitStun * stunScale);
      }

      if (ability.wallBounce && attacker.combo.canWallBounce()) {
        defender.pendingWallBounce = true;
        attacker.combo.useWallBounce();
      }
      if (ability.groundBounce && attacker.combo.canGroundBounce() && defender.y > 40) {
        attacker.combo.useGroundBounce();
        defender.vy = -Math.abs(defender.vy) - 200;
      }
      // Hard combo cap: force a knockdown so nothing can loop forever.
      if (attacker.combo.atCap) {
        defender.setState(STATE.KNOCKDOWN, 0.7);
        defender.vy = Math.max(defender.vy, 120);
        attacker.combo.end();
      }
    }

    // --- status effects, feedback ----------------------------------------
    applyStatusEffects(attacker, defender, ability.statusEffects, {
      damage,
      facing: attacker.facing,
      durationScale: attacker.statusDurationBonus,
    });

    defender.flash = 1;
    defender.lastHitBy = ability.id;

    const heavy = ability.category === 'ultimate' ? COMBAT.hitStopUltimate
      : (ability.category === 'heavy' || ability.damage > 70) ? COMBAT.hitStopHeavy
        : COMBAT.hitStopBase;
    this.hitStop = Math.max(this.hitStop, heavy);
    this.camera.shake(ability.category === 'ultimate' ? 26 : Math.min(18, 4 + ability.damage * 0.12),
      ability.category === 'ultimate' ? 0.5 : 0.22);

    const hx = defender.x - dir * 20;
    const hy = defender.y + defender.height * 0.55;
    this.effects.emit(ability.effectId || 'impact_default', hx, hy, {
      facing: attacker.facing,
      scale: ability.category === 'ultimate' ? 1.8 : 1,
    });
    this.effects.number(hx, hy + 30, String(Math.round(damage)),
      ability.category === 'ultimate' ? '#ffc75a' : '#ffe9a8',
      ability.category === 'ultimate' ? 1.5 : 1);
    this.playSound(ability.soundId || 'sfx_hit_light', defender);

    if (projectile) projectile.hitIds.add(defender.id);

    if (defender.mods.thorns > 0) {
      attacker.health = Math.max(0, attacker.health - defender.mods.thorns);
    }

    this.dispatchEvent(new CustomEvent('hit', {
      detail: { attacker, defender, ability, damage, combo: attacker.combo.hits },
    }));

    if (defender.health <= 0) {
      const died = defender.kill();
      if (died) {
        if (ability.slowMoFinish) this.slowMo = 1.1;
        if (ability.category === 'ultimate') attacker.ultimateFinish = true;
      }
    }
  }

  /* --------------------------------------------------------- round flow -- */

  _checkKO() {
    const [a, b] = this.fighters;
    if (!a.isDead && !b.isDead) return;
    if (this.phase !== PHASE.FIGHT) return;

    const winner = a.isDead && b.isDead ? null : (a.isDead ? b : a);
    this._endRound(winner, a.isDead && b.isDead ? 'double' : 'ko');
  }

  _timeOut() {
    const [a, b] = this.fighters;
    const fa = a.health / a.maxHealth;
    const fb = b.health / b.maxHealth;
    let winner = null;
    if (Math.abs(fa - fb) > 0.001) winner = fa > fb ? a : b;
    this._endRound(winner, 'time');
  }

  _endRound(winner, reason) {
    this.phase = PHASE.ROUND_END;
    this.phaseTimer = 2.4;
    this.playSound('sfx_ko');
    audio.duck(0.4, 1.6);

    if (winner) {
      const idx = this.fighters.indexOf(winner);
      this.roundWins[idx]++;
      const perfect = winner.health >= winner.maxHealth - 0.5;
      const comeback = winner.health / winner.maxHealth < 0.1;
      winner.roundPerfect = perfect;
      winner.roundComeback = comeback;
      this.announce(reason === 'time' ? 'Time Up' : (perfect ? 'Perfect!' : 'K.O.'), 1.6);
    } else {
      this.announce('Draw', 1.6);
    }

    this.dispatchEvent(new CustomEvent('round-end', {
      detail: { winner, reason, roundWins: [...this.roundWins], round: this.round },
    }));
  }

  _advanceRound() {
    const [pw, ew] = this.roundWins;
    const done = pw >= this.roundsToWin || ew >= this.roundsToWin || this.round >= this.maxRounds;
    if (done) {
      this.phase = PHASE.MATCH_END;
      const winner = pw > ew ? this.player : ew > pw ? this.enemy : null;
      if (winner) winner.setState(STATE.VICTORY, 3);
      this.playSound(winner === this.player ? 'sfx_victory' : 'sfx_defeat');
      this.dispatchEvent(new CustomEvent('match-end', {
        detail: {
          winner,
          playerWon: winner === this.player,
          roundWins: [...this.roundWins],
          stats: {
            player: { ...this.player.stats },
            enemy: { ...this.enemy.stats },
          },
        },
      }));
      return;
    }
    for (const f of this.fighters) endOfRoundReset(f);
    this.startRound(this.round + 1);
  }

  /* ------------------------------------------------------------- training -- */

  _updateTrainingReadout() {
    const t = this.trainingData;
    const p = this.player;
    t.comboHits = p.combo.hits;
    t.comboDamage = Math.round(p.combo.damage);
    if (p.combo.longest > t.maxCombo) t.maxCombo = p.combo.longest;
    if (p.act) {
      const a = p.act.ability;
      t.lastMove = a.displayName;
      t.frameData = `${Math.round(a.startup * 60)}/${Math.round(a.activeFrames * 60)}/${Math.round(a.recovery * 60)}`;
    }
  }

  resetPositions() {
    const mid = ARENA.width / 2;
    this.player.x = mid - 220;
    this.player.y = 0; this.player.vx = 0; this.player.vy = 0;
    this.player.facing = 1;
    this.player.setState(STATE.IDLE);
    this.player.combo.end();
    this.enemy.x = mid + 220;
    this.enemy.y = 0; this.enemy.vx = 0; this.enemy.vy = 0;
    this.enemy.facing = -1;
    this.enemy.setState(STATE.IDLE);
    this.enemy.health = this.enemy.maxHealth;
    this.enemy.displayHealth = this.enemy.maxHealth;
    this.enemy.statuses.length = 0;
    this.projectiles.clear();
    this.effects.clear();
    this.camera.snap(this.player, this.enemy);
  }

  pause() { if (this.phase !== PHASE.PAUSED) { this._prevPhase = this.phase; this.phase = PHASE.PAUSED; } }
  resume() { if (this.phase === PHASE.PAUSED) this.phase = this._prevPhase || PHASE.FIGHT; }
  get isPaused() { return this.phase === PHASE.PAUSED; }

  destroy() {
    this.fighters = [];
    this.controllers.clear();
    this.projectiles.clear();
    this.effects.clear();
    this._ctxCache = null;
  }
}

export { SIM_DT };
