/**
 * The Fighter: movement, state machine, ability execution, resources.
 *
 * The engine (combat-engine.js) owns collision resolution between fighters;
 * this class owns everything about one fighter's own behaviour.
 */

import {
  ARENA, COMBAT, GRAVITY, AIR_FRICTION, GROUND_FRICTION,
} from '../constants.js';
import { getAbility } from '../data/abilities.js';
import { getFighter } from '../data/fighters.js';
import { TRANSFORMATIONS } from '../data/transformations.js';
import { STATE, LOCKED_STATES, HIT_STATES, canAct, isAirborne } from './fighter-state.js';
import {
  SpriteAnimator, spriteRegistry, animationForAbility, animationForState,
} from './sprite-animator.js';
import { costumeSpriteSetId } from '../data/costumes.js';
import { reportSpriteFallback } from '../asset-report.js';
import { setCentred } from './hitbox.js';
import { ComboTracker } from './combo-system.js';
import { tickGuard } from './guard-system.js';
import { tickSubstitution } from './substitution-system.js';
import { applyFormStats, resolveAbility, tickTransformation } from './transformation-system.js';
import { newModifiers, tickStatuses } from './status-effects.js';

let nextId = 1;

export class Fighter {
  /**
   * @param {string} fighterId roster id
   * @param {{ side: 1|-1, isPlayer: boolean }} opts
   */
  constructor(fighterId, opts = {}) {
    this.id = nextId++;
    this.data = getFighter(fighterId);
    if (!this.data) throw new Error(`Unknown fighter: ${fighterId}`);

    this.side = opts.side ?? 1;
    this.isPlayer = !!opts.isPlayer;
    this.ignoreUnlocks = !!opts.ignoreUnlocks;

    // resources
    this.maxHealth = this.data.baseStats.health * (opts.healthBonus ? 1 + opts.healthBonus : 1);
    this.health = this.maxHealth;
    this.displayHealth = this.maxHealth;   // lagging bar
    this.chakra = COMBAT.chakraMax * 0.5;
    this.guard = COMBAT.guardMax;
    this.awakening = 0;
    this.maxSubStocks = COMBAT.substitutionStocks;
    this.subStocks = this.maxSubStocks;
    this.subRegen = 0;

    // position / motion
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.side === 1 ? 1 : -1;
    this.width = 46 * (this.data.visual.bulk || 1);
    this.height = 158 * (this.data.visual.height || 1);

    // state
    this.state = STATE.INTRO;
    this.stateTime = 0;
    this.stateDuration = 0;
    this.time = 0;
    this.act = null;               // current ability execution
    this.jumpsUsed = 0;
    this.airDashUsed = false;
    this.guardHeld = false;
    this.guardBroken = false;
    this.guardRecoverDelay = 0;
    this.invulnUntil = -1;
    this.hitLock = null;           // ability instance that already hit this target
    this.charging = false;
    this.roundNumber = 1;
    this.isDead = false;
    this.armorLeft = 0;

    // transformation
    this.form = null;
    this.formTime = 0;
    this.formDuration = 0;
    this.usedForms = new Set();
    this.formMods = { attack: 1, defense: 1, speed: 1, chakraRegen: 1, guard: 1 };
    this.auraColor = this.data.colors.aura;
    this.auraEffect = null;

    // statuses
    this.statuses = [];
    this.mods = newModifiers();

    // cooldowns keyed by ability id
    this.cooldowns = new Map();

    // combo tracking (the combo THIS fighter is performing)
    this.combo = new ComboTracker();

    // battle rules
    this.chakraRegenRate = COMBAT.chakraRegen;
    this.substitutionsDisabled = false;
    this.transformDisabled = false;
    this.ultimateDisabled = false;
    this.guardDisabled = false;
    this.damageMultiplier = 1;
    this.infiniteHealth = false;
    this.infiniteChakra = false;
    this.infiniteSubstitution = false;

    // passives derived from the roster entry
    this.passiveGuardRegen = 1;
    this.passiveChakraLow = 1;
    this.passiveMeleeBonus = 1;
    this.passiveRegen = 0;
    this.survivesLethalOnce = false;
    this.survivedLethal = false;
    this._applyPassives();

    // per-round stats
    this.stats = {
      damageDealt: 0, damageTaken: 0, blocks: 0, substitutions: 0,
      transformations: 0, finalFormsReached: 0, hits: 0, maxCombo: 0,
    };

    this.abilities = { slots: [], ultimate: null };
    this.refreshAbilities();

    /** Visual-only clock, used by the procedural fallback renderer. */
    this.animTime = 0;
    this.flash = 0;
    this.lastHitBy = null;

    /* ---- sprite animation ------------------------------------------------
     * The sheet (image + atlas geometry) is shared; the animator (playhead) is
     * per fighter and advances inside the fixed-timestep simulation, so what is
     * drawn and what the engine thinks is happening can never drift apart.
     * `sheet` is null when the assets did not load — the renderer then falls
     * back to the procedural silhouette and nothing else changes.
     */
    /**
     * Which artwork this fighter is wearing. `costumeId` is chosen on the
     * select screen and never changes mid-match; `formSetId` is set by the
     * transformation system while a form with its own art is active.
     */
    this.costumeId = opts.costumeId || 'default';
    this.costumeSetId = costumeSpriteSetId(this.data.id, this.costumeId);
    this.formSetId = null;

    this.sheet = null;
    this.anim = new SpriteAnimator(null);
    this.anim.onEvent = (name) => this._onAnimationEvent(name);
    this._animForce = true;
    this._ctx = null;
    this.refreshSprite();
  }

  /**
   * Re-resolve which sprite set to draw with.
   *
   * Priority is transformation -> costume -> base fighter -> procedural, and
   * anything that falls through is reported once so a missing costume or form
   * sheet is visible in development instead of passing for finished art.
   *
   * The animator is rebuilt around the new metadata but the *playhead is
   * preserved*: transforming mid-attack must not restart the swing, reset the
   * frame or drop a pending hit event.
   */
  refreshSprite() {
    const next = spriteRegistry.resolve(
      {
        fighterId: this.data.spriteId || this.data.id,
        costumeSetId: this.costumeSetId,
        formSetId: this.formSetId,
      },
      (info) => reportSpriteFallback(this.data.id, info),
    );
    if (next === this.sheet) return this.sheet;

    this.sheet = next;
    const meta = next?.meta || null;
    const { name, index, elapsed, finished, eventFired } = this.anim;
    this.anim = new SpriteAnimator(meta);
    this.anim.onEvent = (evt) => this._onAnimationEvent(evt);
    // Carry the playhead across so the swap is a costume change, not a reset.
    if (this.anim.has(name)) {
      this.anim.play(name, { force: true });
      this.anim.elapsed = Math.min(elapsed, this.anim.duration);
      this.anim.index = Math.min(index, this.anim.frameCount(name) - 1);
      this.anim.finished = finished;
      this.anim.eventFired = eventFired;
    }
    return this.sheet;
  }

  /**
   * Point at a transformation's sprite set (or null to go back to the costume).
   * Position, facing, health, chakra, target and combat state are untouched —
   * only the artwork changes.
   */
  setFormSprite(setId) {
    if (this.formSetId === setId) return;
    this.formSetId = setId || null;
    this.refreshSprite();
  }

  get name() { return this.data.displayName; }
  get shortName() { return this.data.shortName; }

  _applyPassives() {
    const id = this.data.id;
    // Hand-authored passives for the complete fighters.
    switch (id) {
      case 'naruto': this.passiveChakraLow = 1.30; break;
      case 'sasuke': this.passiveGuardRegen = 1.25; break;
      case 'sakura': this.healMultiplier = 1.20; break;
      case 'kakashi': this.passiveCooldownOnGuard = 1.15; break;
      case 'lee': this.passiveMeleeBonus = 1.08; this.noRangedJutsu = true; break;
      case 'gaara': this.firstHitReduction = 0.30; break;
      case 'itachi': this.counterChakraRefund = 12; break;
      case 'pain': this.projectileTrackingBonus = 0.15; break;
      case 'madara': this.awakenLowHealthBonus = 1.25; break;
      case 'boruto': this.dashInvulnFrames = 4; break;
      case 'kawaki': this.absorbRefund = 1.4; break;
      case 'momoshiki': this.storedJutsuBonus = 0.40; break;
      case 'minato': this.dashStartupBonus = 2; break;
      case 'hashirama': this.passiveRegen = 4; break;
      case 'guy': this.gateDrainReduction = 0.20; break;
      case 'bee': this.multiHitTrade = true; break;
      case 'obito': this.dashInvulnFrames = 4; break;
      case 'jiraiya': this.statusDurationBonus = 1.25; break;
      case 'orochimaru': this.survivesLethalOnce = true; break;
      case 'tsunade': this.criticalBonus = 1.25; break;
      default: break;
    }
    this.healMultiplier = this.healMultiplier || 1;
    this.statusDurationBonus = this.statusDurationBonus || 1;
  }

  /** Rebuild the ability slot table (called on transform and at round start). */
  refreshAbilities() {
    const d = this.data;
    const slots = [];
    const list = d.abilities || [];
    for (let i = 0; i < 3; i++) {
      const override = resolveAbility(this, i);
      const base = list[i] ? getAbility(list[i]) : null;
      slots[i] = override || base || null;
    }
    this.abilities.slots = slots;

    const ultOverride = this.form ? resolveAbility(this, 'ultimate') : null;
    const formUlt = this._formUltimate();
    this.abilities.ultimate = ultOverride || formUlt || getAbility(d.ultimate);

    this.abilities.heavy = resolveAbility(this, 'heavy') || getAbility(d.heavy);
    this.abilities.launcher = resolveAbility(this, 'launcher') || getAbility(d.launcher);
    this.abilities.dash = resolveAbility(this, 'dash') || getAbility(d.dashAttack);
    this.abilities.throw = getAbility(d.throwAttack);
    this.abilities.guardCounter = getAbility(d.guardCounter);
  }

  _formUltimate() {
    if (!this.form) return null;
    const f = TRANSFORMATIONS[this.form];
    return f?.ultimateOverride ? getAbility(f.ultimateOverride) : null;
  }

  /* ------------------------------------------------------------- lifecycle */

  resetForRound(x, facing, roundNumber) {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = this.maxHealth * (this.startHealthFraction ?? 1);
    this.displayHealth = this.health;
    this.chakra = COMBAT.chakraMax * 0.5;
    this.guard = COMBAT.guardMax;
    this.guardBroken = false;
    this.guardRecoverDelay = 0;
    this.subStocks = this.substitutionsDisabled ? 0 : this.maxSubStocks;
    this.subRegen = 0;
    this.state = STATE.INTRO;
    this.stateTime = 0;
    this.stateDuration = 0.9;
    this.act = null;
    this.statuses.length = 0;
    this.cooldowns.clear();
    this.combo.end();
    this.jumpsUsed = 0;
    this.airDashUsed = false;
    this.isDead = false;
    this.invulnUntil = -1;
    this.roundNumber = roundNumber;
    this.survivedLethal = false;
    this.flash = 0;
    this.formSetId = null;
    this.refreshSprite();
    this.anim.reset();
    this._animForce = true;
    applyFormStats(this);
  }

  /**
   * @param {string} state
   * @param {number} [duration] 0 = until something else changes it
   *
   * Entering a state restarts its animation. Re-entering the same state does
   * not — `walk()` re-states WALK every frame, and restarting there would peg
   * the walk cycle to frame 0 forever. Attacks and hits are the exceptions:
   * a chained attack or a fresh hit must replay from the first frame even
   * though the state name has not changed.
   */
  setState(state, duration = 0) {
    const changed = state !== this.state;
    this.state = state;
    this.stateTime = 0;
    this.stateDuration = duration;
    if (changed || state === STATE.ATTACK || HIT_STATES.has(state)) this._animForce = true;
  }

  /* -------------------------------------------------------------- helpers */

  get airborne() { return isAirborne(this); }
  get canAct() { return canAct(this); }
  get invulnerable() { return this.time < this.invulnUntil || this.mods.phase; }

  get attackPower() {
    return (this.data.baseStats.attack / 100) * this.formMods.attack * this.mods.attack;
  }
  get defensePower() {
    return (this.data.baseStats.defense / 100) * this.formMods.defense * this.mods.defense;
  }
  get speedFactor() {
    return this.formMods.speed * this.mods.speed;
  }

  hurtbox(out) {
    const h = this.height * (this.state === STATE.CROUCH ? 0.62 : 1);
    return setCentred(out, this.x, -(this.y + h / 2), this.width / 2, h / 2);
  }

  /** Hitbox for the currently active ability. */
  attackBox(out, ability) {
    const reach = ability.range;
    const cx = this.x + this.facing * (this.width * 0.3 + reach / 2);
    const cy = -(this.y - ability.hitYOffset);
    if (ability.area > 0) {
      return setCentred(out, this.x, cy, ability.area, ability.area * 0.8);
    }
    return setCentred(out, cx, cy, reach / 2, ability.hitHeight / 2);
  }

  cooldownLeft(abilityId) {
    return Math.max(0, this.cooldowns.get(abilityId) || 0);
  }
  cooldownFrac(ability) {
    if (!ability || !ability.cooldown) return 0;
    return this.cooldownLeft(ability.id) / ability.cooldown;
  }

  /* ------------------------------------------------------ ability usage -- */

  /**
   * @returns {{ ok: boolean, reason: string }}
   */
  canUse(ability) {
    if (!ability) return { ok: false, reason: 'No ability' };
    if (!this.canAct) return { ok: false, reason: 'Busy' };
    if (ability.category === 'ultimate' && this.ultimateDisabled) {
      return { ok: false, reason: 'Ultimates disabled' };
    }
    if (this.noRangedJutsu && (ability.category === 'ranged-jutsu' || ability.projectile)) {
      return { ok: false, reason: 'Taijutsu specialist' };
    }
    if (this.airborne && !ability.airOk) return { ok: false, reason: 'Grounded only' };
    if (!this.airborne && !ability.groundOk) return { ok: false, reason: 'Air only' };
    if (this.cooldownLeft(ability.id) > 0) return { ok: false, reason: 'On cooldown' };
    if (!this.infiniteChakra && this.chakra < ability.chakraCost) {
      return { ok: false, reason: 'Not enough chakra' };
    }
    const req = ability.requirements;
    if (req) {
      if (req.chakra && this.chakra < req.chakra) return { ok: false, reason: 'Not enough chakra' };
      if (req.form && this.form !== req.form) return { ok: false, reason: 'Requires a specific form' };
      if (req.status && !this.statuses.some((s) => s.id === req.status)
        && !this.opponentHasStatus?.(req.status)) {
        return { ok: false, reason: 'Requires a mark on the opponent' };
      }
    }
    return { ok: true, reason: '' };
  }

  /** Begin an ability. Returns true if it started. */
  use(ability, opts = {}) {
    const check = this.canUse(ability);
    if (!check.ok && !opts.force) return false;

    if (!this.infiniteChakra) this.chakra = Math.max(0, this.chakra - ability.chakraCost);
    if (ability.cooldown > 0) this.cooldowns.set(ability.id, ability.cooldown);

    const slot = this.abilities.slots.indexOf(ability);
    const animName = animationForAbility(ability, slot);
    this.act = {
      ability,
      t: 0,
      hitsDone: 0,
      nextHitAt: ability.startup,
      cancellable: false,
      chained: !!opts.chained,
      connected: false,
      projectilesFired: false,
      slot,
      animName,
      // The clip's contact frame releases the effects only when the animator
      // can actually retime it onto this ability's start-up window; otherwise
      // the drawn frame and the hitbox would disagree and the timer wins.
      animEvent: this._clipDrivesEvents(animName, ability),
    };
    this.setState(STATE.ATTACK, ability.totalTime);
    this.armorLeft = ability.armor + this.mods.armor;
    this.charging = false;

    if (ability.advance) this.vx = this.facing * ability.advance;
    if (ability.rise) { this.vy = ability.rise; this.y = Math.max(this.y, 1); }
    if (ability.invulnerability) {
      this.invulnUntil = Math.max(this.invulnUntil, this.time + ability.invulnerability.end);
    }
    if (ability.tracking > 0 && this.trackTarget) {
      const dir = Math.sign(this.trackTarget.x - this.x);
      if (dir) this.facing = dir;
    }
    return true;
  }

  /**
   * True when `animName`'s authored contact frame can be pinned to this
   * ability's start-up. Mirrors the retiming condition in
   * SpriteAnimator._buildTimeline — if that retiming cannot happen, the drawn
   * contact frame would not coincide with the hitbox, so the animation must
   * not be the thing that fires the effects.
   */
  _clipDrivesEvents(animName, ability) {
    const clip = this.anim.animations[animName];
    if (!clip) return false;
    const hit = Number.isInteger(clip.hitFrame) ? clip.hitFrame : -1;
    return hit > 0 && hit < clip.frames
      && ability.startup > 0 && ability.totalTime > ability.startup;
  }

  /** Chain the current move into a follow-up if the input allows it. */
  tryChain(abilityId) {
    if (!this.act) return false;
    const cur = this.act.ability;
    if (!cur.chainInto?.includes(abilityId)) return false;
    if (!this.act.connected) return false;
    const elapsed = this.act.t;
    const openFrom = cur.startup;
    const openTo = cur.startup + cur.activeFrames * cur.hits + cur.cancelWindow;
    if (elapsed < openFrom || elapsed > openTo) return false;
    const next = getAbility(abilityId);
    if (!next) return false;
    return this.use(next, { chained: true });
  }

  /* ---------------------------------------------------------- resources -- */

  heal(amount) {
    if (amount <= 0) return;
    this.health = Math.min(this.maxHealth, this.health + amount * this.healMultiplier);
  }

  damageOverTime(amount, kind) {
    if (this.infiniteHealth) return;
    this.health = Math.max(kind === 'drain' ? 1 : 0, this.health - amount);
    if (this.health <= 0) this.kill();
  }

  applyRecoil(amount) {
    if (this.infiniteHealth) return;
    this.health = Math.max(1, this.health - amount);
  }

  addAwakening(amount) {
    let a = amount;
    if (this.awakenLowHealthBonus && this.health / this.maxHealth < 0.5) {
      a *= this.awakenLowHealthBonus;
    }
    a *= this.data.baseStats.awakeningRate / 100;
    this.awakening = Math.min(COMBAT.awakeningMax, this.awakening + a);
  }

  kill() {
    if (this.survivesLethalOnce && !this.survivedLethal) {
      this.survivedLethal = true;
      this.health = 1;
      return false;
    }
    this.health = 0;
    this.isDead = true;
    this.setState(STATE.KO, 2.0);
    this.act = null;
    this.vy = 420;
    this.vx = -this.facing * 240;
    return true;
  }

  /* --------------------------------------------------------------- step -- */

  /**
   * @param {number} dt fixed timestep
   * @param {Object} ctx { opponent, effects, arena }
   */
  step(dt, ctx) {
    this._ctx = ctx;
    this.time += dt;
    this.stateTime += dt;
    this.animTime += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);

    tickStatuses(this, dt);
    tickTransformation(this, dt);
    tickGuard(this, dt);
    tickSubstitution(this, dt);

    // cooldowns
    if (this.cooldowns.size) {
      const boost = (this.passiveCooldownOnGuard && this.guardHeld) ? this.passiveCooldownOnGuard : 1;
      for (const [k, v] of this.cooldowns) {
        const n = v - dt * boost;
        if (n <= 0) this.cooldowns.delete(k); else this.cooldowns.set(k, n);
      }
    }

    // passive regeneration
    if (this.passiveRegen) this.heal(this.passiveRegen * dt);

    // chakra regeneration / charging
    if (!this.infiniteChakra) {
      let rate = this.chakraRegenRate * this.formMods.chakraRegen * this.mods.chakraRegen;
      if (this.passiveChakraLow > 1 && this.health / this.maxHealth < 0.5) rate *= this.passiveChakraLow;
      if (this.charging) rate = COMBAT.chakraChargeRate;
      this.chakra = Math.max(0, Math.min(COMBAT.chakraMax, this.chakra + rate * dt));
    } else {
      this.chakra = COMBAT.chakraMax;
    }
    if (this.infiniteSubstitution) this.subStocks = this.maxSubStocks;
    if (this.infiniteHealth && this.health < this.maxHealth) this.health = this.maxHealth;

    // passive awakening gain
    if (this.state !== STATE.KO) this.addAwakening(COMBAT.awakeningPassive * dt);

    // lagging health bar for the HUD
    this.displayHealth += (this.health - this.displayHealth) * Math.min(1, dt * 3.2);

    this._stepAction(dt, ctx);
    this._stepPhysics(dt, ctx);
    this._stepAnimation(dt);
    this.combo.update(dt);
  }

  /* ---------------------------------------------------------- animation -- */

  /**
   * Pick the clip for the current state and advance the playhead.
   *
   * Runs after physics so the airborne/landing state is already settled for
   * this step, and inside the fixed timestep so animation events land on the
   * same simulation step every time, at any frame rate.
   */
  _stepAnimation(dt) {
    const force = this._animForce;
    this._animForce = false;
    if (!this.anim.available) return;

    if (this.state === STATE.ATTACK && this.act) {
      const a = this.act.ability;
      this.anim.play(this.act.animName, {
        force,
        startup: a.startup,
        total: a.totalTime,
      });
    } else {
      let name = animationForState(this.state, this.airborne);
      // The state machine has no separate falling state after a jump, but the
      // sheet does, so switch clips at the apex.
      if (name === 'jump' && this.vy < -30) name = 'fall';
      this.anim.play(name, { force });
    }
    this.anim.update(dt);
  }

  /** Fired by the animator when the playhead reaches a clip's event frame. */
  _onAnimationEvent(kind) {
    if (kind === 'hit' || kind === 'cast') {
      if (this.act && this.act.animEvent && !this.act.effectSpawned) {
        this._spawnAbilityEffects(this._ctx);
      }
    }
  }

  /** Impact/cast visuals + sound for the running ability. */
  _spawnAbilityEffects(ctx) {
    if (!this.act || this.act.effectSpawned) return;
    this.act.effectSpawned = true;
    const a = this.act.ability;
    if (a.effectId && a.category !== 'basic') {
      ctx?.effects?.emit(a.effectId, this.x + this.facing * 70, this.y + 80, {
        facing: this.facing, scale: a.area > 0 ? 1.6 : 1,
      });
    }
    ctx?.playSound?.(a.soundId, this);
  }

  _stepAction(dt, ctx) {
    // Timed states expire on their own.
    if (this.stateDuration > 0 && this.stateTime >= this.stateDuration) {
      if (this.state === STATE.KO) { /* stay dead */ }
      else if (this.state === STATE.KNOCKDOWN) {
        this.setState(STATE.WAKEUP, 0.22);
        this.invulnUntil = this.time + COMBAT.wakeupInvuln;
      } else if (LOCKED_STATES.has(this.state) || this.state === STATE.WAKEUP
        || this.state === STATE.DASH || this.state === STATE.BACKDASH
        || this.state === STATE.LAND || this.state === STATE.AIRDASH) {
        this.setState(this.airborne ? STATE.FALL : STATE.IDLE);
      }
    }

    if (!this.act) return;
    const a = this.act.ability;
    this.act.t += dt;

    const activeStart = a.startup;
    const activeEnd = a.startup + a.activeFrames * a.hits + a.hitInterval * Math.max(0, a.hits - 1);

    // Projectiles spawn at the start of the active window.
    if (!this.act.projectilesFired && a.projectile && this.act.t >= activeStart) {
      this.act.projectilesFired = true;
      ctx.fireProjectile?.(this, a);
    }

    // Effects on activation. With a sprite clip the animation's contact frame
    // owns this moment (see _onAnimationEvent); the timer below is the fallback
    // for fighters drawn procedurally, so behaviour never depends on assets.
    // Both resolve to the same instant, because the clip is retimed so its hit
    // frame lands exactly on `startup`.
    if (!this.act.effectSpawned && !this.act.animEvent && this.act.t >= activeStart) {
      this._spawnAbilityEffects(ctx);
    }

    // Cancel window opens after the active frames.
    this.act.cancellable = this.act.t > activeEnd;

    if (this.act.t >= a.totalTime) {
      this.act = null;
      this.armorLeft = 0;
      this.setState(this.airborne ? STATE.FALL : STATE.IDLE);
    }
  }

  /** True while the current ability's hitbox should be checked. */
  get isActiveFrame() {
    if (!this.act) return false;
    const a = this.act.ability;
    const t = this.act.t;
    if (t < a.startup) return false;
    const perHit = a.activeFrames + a.hitInterval;
    const idx = Math.floor((t - a.startup) / perHit);
    if (idx >= a.hits) return false;
    const local = (t - a.startup) - idx * perHit;
    return local <= a.activeFrames && idx >= this.act.hitsDone;
  }

  consumeHit() {
    if (this.act) {
      this.act.hitsDone++;
      this.act.connected = true;
    }
  }

  _stepPhysics(dt, ctx) {
    const rooted = this.mods.rooted || this.state === STATE.KO;

    if (this.y > 0 || this.vy > 0) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        const wasFalling = this.vy < -200;
        this.y = 0;
        this.vy = 0;
        this.jumpsUsed = 0;
        this.airDashUsed = false;
        if (this.state === STATE.LAUNCHED || this.state === STATE.HITSTUN) {
          this.setState(STATE.KNOCKDOWN, 0.55);
          ctx.effects?.emit('dust_land', this.x, 4, { scale: 1.2 });
        } else if (this.state === STATE.JUMP || this.state === STATE.FALL || this.state === STATE.AIRDASH) {
          this.setState(STATE.LAND, 0.09);
          if (wasFalling) {
            ctx.effects?.emit('dust_land', this.x, 4, { scale: 0.9 });
            ctx.playSound?.('sfx_land', this);
          }
        }
      }
      this.vx *= Math.pow(AIR_FRICTION, dt * 60);
    } else {
      this.vx *= Math.pow(GROUND_FRICTION, dt * 60);
    }

    if (!rooted) this.x += this.vx * dt;
    if (Math.abs(this.vx) < 2) this.vx = 0;

    // Arena walls
    const minX = ARENA.wallPadding;
    const maxX = ARENA.width - ARENA.wallPadding;
    if (this.x < minX) {
      this.x = minX;
      if (this.pendingWallBounce) this._doWallBounce(ctx, 1);
      else this.vx = 0;
    } else if (this.x > maxX) {
      this.x = maxX;
      if (this.pendingWallBounce) this._doWallBounce(ctx, -1);
      else this.vx = 0;
    }
    if (this.y > 900) { this.y = 900; this.vy = Math.min(this.vy, 0); }
  }

  _doWallBounce(ctx, dir) {
    this.pendingWallBounce = false;
    this.vx = dir * Math.abs(this.vx) * 0.55;
    this.vy = Math.max(this.vy, 260);
    ctx.effects?.emit('dust_burst', this.x, this.y + 70, { scale: 1.3 });
    ctx.camera?.shake(10, 0.2);
  }

  /* --------------------------------------------------------- movement --- */

  walk(dirX, run = false) {
    if (!this.canAct || this.mods.rooted) return;
    if (this.airborne) {
      // air control
      const air = this.data.movement.walkSpeed * 0.55 * this.speedFactor;
      this.vx += dirX * air * 3.6 * (1 / 60);
      const cap = this.data.movement.runSpeed * this.speedFactor;
      this.vx = Math.max(-cap, Math.min(cap, this.vx));
      return;
    }
    const speed = (run ? this.data.movement.runSpeed : this.data.movement.walkSpeed) * this.speedFactor;
    this.vx = dirX * speed;
    const groundedFree = this.state === STATE.IDLE || this.state === STATE.WALK
      || this.state === STATE.RUN || this.state === STATE.GUARD || this.state === STATE.CROUCH;
    if (!groundedFree) return;
    if (dirX === 0) {
      // walk(0) is how the input layer says "stop". It has to actually return
      // to idle: leaving the fighter in WALK with no velocity used to be
      // invisible with the vector renderer, but a sprite would march on the
      // spot. Guard and crouch own their own states, so leave those alone.
      if (this.state === STATE.WALK || this.state === STATE.RUN) this.setState(STATE.IDLE);
      return;
    }
    this.setState(run ? STATE.RUN : STATE.WALK);
  }

  jump() {
    if (!this.canAct || this.mods.rooted) return false;
    const maxJumps = this.data.movement.doubleJump ? 2 : 1;
    if (this.jumpsUsed >= maxJumps) return false;
    if (this.jumpsUsed === 0 && this.y > 4) this.jumpsUsed = 1; // fell off, no free ground jump
    this.jumpsUsed++;
    this.vy = this.data.movement.jumpVelocity * (this.jumpsUsed > 1 ? 0.86 : 1);
    this.y = Math.max(this.y, 1);
    this.setState(STATE.JUMP);
    return true;
  }

  dash(dirX, ctx) {
    if (!this.canAct || this.mods.rooted) return false;
    if (this.airborne) {
      if (!this.data.movement.airDash || this.airDashUsed) return false;
      this.airDashUsed = true;
      this.vx = dirX * this.data.movement.dashSpeed * this.speedFactor;
      this.vy = Math.max(this.vy, 60);
      this.setState(STATE.AIRDASH, 0.22);
    } else {
      const back = dirX !== this.facing;
      const speed = (back ? this.data.movement.backDashSpeed : this.data.movement.dashSpeed) * this.speedFactor;
      this.vx = dirX * speed;
      this.setState(back ? STATE.BACKDASH : STATE.DASH, 0.26);
      // Some fighters have invulnerable dash start-up.
      if (this.dashInvulnFrames) {
        this.invulnUntil = Math.max(this.invulnUntil, this.time + this.dashInvulnFrames / 60);
      }
    }
    ctx?.effects?.emit('speed_lines', this.x, this.y + 70, { facing: -dirX, countScale: 0.6 });
    ctx?.playSound?.('sfx_dash', this);
    return true;
  }

  crouch(on) {
    if (!this.canAct) return;
    if (on && !this.airborne) this.setState(STATE.CROUCH);
    else if (this.state === STATE.CROUCH) this.setState(STATE.IDLE);
  }

  setGuard(on) {
    if (this.guardDisabled) { this.guardHeld = false; return; }
    this.guardHeld = on && !this.airborne && this.canAct && !this.guardBroken;
    if (this.guardHeld && (this.state === STATE.IDLE || this.state === STATE.WALK || this.state === STATE.RUN)) {
      this.setState(STATE.GUARD);
      this.vx *= 0.4;
    } else if (!on && this.state === STATE.GUARD) {
      this.setState(STATE.IDLE);
    }
  }

  faceTowards(other) {
    if (!this.canAct && this.state !== STATE.IDLE) return;
    if (this.act) return;
    const dir = Math.sign(other.x - this.x);
    if (dir) this.facing = dir;
  }
}

export default Fighter;
