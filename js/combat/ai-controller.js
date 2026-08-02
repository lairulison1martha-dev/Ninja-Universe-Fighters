/**
 * AI controller.
 *
 * FAIRNESS RULE: the AI only reads state a human player could see on screen —
 * positions, health, chakra, guard, whether the opponent is currently in an
 * attack's start-up/active frames, and which projectiles exist. It never looks
 * at the opponent's input buffer or at pending (not yet started) actions, and
 * every decision passes through a per-difficulty reaction delay before it can
 * change behaviour.
 */

import { DIFFICULTY_TUNING } from '../constants.js';
import { getAIProfile } from '../data/ai-profiles.js';
import { getAbility } from '../data/abilities.js';
import { STATE, HIT_STATES } from './fighter-state.js';
import { canTransform } from './transformation-system.js';
import { canSubstitute } from './substitution-system.js';

const PLAN = {
  APPROACH: 'approach',
  RETREAT: 'retreat',
  HOLD: 'hold',
  ATTACK: 'attack',
  ZONE: 'zone',
  DEFEND: 'defend',
  PUNISH: 'punish',
};

export class AIController {
  /**
   * @param {import('./fighter.js').Fighter} fighter
   * @param {string} difficulty
   */
  constructor(fighter, difficulty = 'normal') {
    this.fighter = fighter;
    this.setDifficulty(difficulty);
    this.profile = getAIProfile(fighter.data.aiProfile);
    this.plan = PLAN.APPROACH;
    this.planTimer = 0;
    this.reactionTimer = 0;
    /** Snapshot of what the AI currently "believes" — updated after the delay. */
    this.belief = {
      oppX: 0, oppY: 0, oppState: STATE.IDLE, oppHealth: 1, oppChakra: 0,
      oppAttacking: false, oppRecovering: false, oppAirborne: false, dist: 400,
    };
    this.actionCooldown = 0;
    this.comboStep = 0;
    this.comboTimer = 0;
    this.rangedOnly = false;
    this.dummyMode = null;   // set by training mode
    this._rng = 1;
  }

  setDifficulty(d) {
    this.difficulty = d;
    this.tuning = DIFFICULTY_TUNING[d] || DIFFICULTY_TUNING.normal;
  }

  rand() {
    // xorshift so behaviour is varied but reproducible per-instance
    this._rng ^= this._rng << 13; this._rng >>>= 0;
    this._rng ^= this._rng >> 17;
    this._rng ^= this._rng << 5; this._rng >>>= 0;
    return this._rng / 4294967296;
  }

  /**
   * @param {number} dt
   * @param {Object} ctx { opponent, projectiles, engine }
   */
  update(dt, ctx) {
    const me = this.fighter;
    const opp = ctx.opponent;
    if (!opp || me.isDead || me.state === STATE.INTRO || me.state === STATE.KO) return;

    // ---- perception, gated by the reaction delay -------------------------
    this.reactionTimer -= dt;
    if (this.reactionTimer <= 0) {
      this.reactionTimer = this.tuning.reaction;
      this._perceive(opp, ctx);
    }

    if (this.dummyMode) { this._dummy(dt, ctx); return; }

    this.actionCooldown -= dt;
    this.planTimer -= dt;
    if (this.planTimer <= 0) {
      this.planTimer = 0.24 + this.rand() * 0.4;
      this._choosePlan(ctx);
    }

    me.faceTowards(opp);
    this._executePlan(dt, ctx);
    this._reactiveDefence(dt, ctx);
  }

  _perceive(opp, ctx) {
    const b = this.belief;
    b.oppX = opp.x;
    b.oppY = opp.y;
    b.oppState = opp.state;
    b.oppHealth = opp.health / opp.maxHealth;
    b.oppChakra = opp.chakra;
    b.oppAirborne = opp.airborne;
    // "Attacking" = an ability is already running (visible on screen).
    b.oppAttacking = !!opp.act && opp.act.t < opp.act.ability.startup + opp.act.ability.activeFrames;
    b.oppRecovering = !!opp.act && opp.act.t > opp.act.ability.startup + opp.act.ability.activeFrames;
    b.oppAbility = opp.act?.ability || null;
    b.dist = Math.abs(opp.x - this.fighter.x);
    // Nearest incoming projectile, if any.
    b.threat = null;
    if (ctx.projectiles) {
      for (const p of ctx.projectiles.live()) {
        if (p.owner === this.fighter) continue;
        const d = Math.abs(p.x - this.fighter.x);
        const closing = Math.sign(p.vx) === Math.sign(this.fighter.x - p.x);
        if (closing && d < 480 && (!b.threat || d < b.threat.d)) b.threat = { d, p };
      }
    }
  }

  _choosePlan(ctx) {
    const me = this.fighter;
    const p = this.profile;
    const t = this.tuning;
    const b = this.belief;
    const hp = me.health / me.maxHealth;
    const [near, far] = p.idealRange;

    // Low health → play safer (unless the profile says otherwise).
    if (hp < p.retreatBelow && this.rand() > t.aggression * 0.6) {
      this.plan = b.dist < near ? PLAN.RETREAT : PLAN.ZONE;
      return;
    }
    // Punish a whiffed/recovering attack — this is reacting to visible recovery
    // frames, which is exactly what a good human player does.
    if (b.oppRecovering && b.dist < 260 && this.rand() < t.comboSkill) {
      this.plan = PLAN.PUNISH;
      return;
    }
    // Block incoming pressure.
    if (b.oppAttacking && b.dist < 220 && this.rand() < t.blockChance) {
      this.plan = PLAN.DEFEND;
      return;
    }
    if (b.threat && this.rand() < t.blockChance * 0.9) {
      this.plan = PLAN.DEFEND;
      return;
    }

    if (b.dist > far) {
      this.plan = this.rand() < p.zoning ? PLAN.ZONE : PLAN.APPROACH;
    } else if (b.dist < near * 0.7) {
      this.plan = this.rand() < p.aggression ? PLAN.ATTACK : PLAN.RETREAT;
    } else {
      this.plan = this.rand() < p.aggression * t.aggression ? PLAN.ATTACK : PLAN.HOLD;
    }
  }

  _executePlan(dt, ctx) {
    const me = this.fighter;
    const opp = ctx.opponent;
    const b = this.belief;
    const p = this.profile;
    const t = this.tuning;
    const dir = Math.sign(opp.x - me.x) || 1;

    // Transformations: transform when legal and the profile wants to.
    if (me.awakening >= p.transformAt && !me.act && this.rand() < 0.05) {
      const check = canTransform(me);
      if (check.ok) { ctx.engine?.requestTransform(me); return; }
    }

    // Ultimate: only when it will land — close, and they are not blocking, or
    // they are in hit-stun (guaranteed).
    const ult = me.abilities.ultimate;
    if (ult && me.canUse(ult).ok) {
      const guaranteed = HIT_STATES.has(b.oppState);
      const inRange = b.dist < ult.range + 80;
      const patience = p.ultimatePatience * (1 - t.comboSkill * 0.4);
      if (inRange && (guaranteed || this.rand() > patience)) {
        if (me.use(ult)) { ctx.engine?.onUltimateStarted(me, ult); return; }
      }
    }

    switch (this.plan) {
      case PLAN.APPROACH: {
        if (this.rand() < p.dashiness * 0.06) me.dash(dir, ctx);
        else me.walk(dir, b.dist > 320);
        if (p.airiness > 0.4 && b.dist > 200 && this.rand() < p.airiness * 0.02) me.jump();
        break;
      }
      case PLAN.RETREAT: {
        me.walk(-dir, true);
        if (this.rand() < 0.03) me.dash(-dir, ctx);
        break;
      }
      case PLAN.HOLD: {
        if (b.dist < p.idealRange[0]) me.walk(-dir);
        else if (b.dist > p.idealRange[1]) me.walk(dir);
        break;
      }
      case PLAN.DEFEND: {
        me.setGuard(true);
        if (b.dist < 120 && this.rand() < 0.02) me.dash(-dir, ctx);
        break;
      }
      case PLAN.ZONE: {
        me.setGuard(false);
        this._tryRanged(ctx);
        if (b.dist < p.idealRange[0]) me.walk(-dir);
        break;
      }
      case PLAN.PUNISH:
      case PLAN.ATTACK: {
        me.setGuard(false);
        if (b.dist > 150) {
          if (this.rand() < p.dashiness * 0.12) {
            const dashA = me.abilities.dash;
            if (dashA && me.canUse(dashA).ok && b.dist < dashA.range + 220) me.use(dashA);
            else me.dash(dir, ctx);
          } else me.walk(dir, true);
        } else {
          this._melee(ctx);
        }
        break;
      }
      default: break;
    }
  }

  _tryRanged(ctx) {
    if (this.actionCooldown > 0) return;
    const me = this.fighter;
    const p = this.profile;
    if (this.rand() > p.jutsuUse) return;
    for (const a of me.abilities.slots) {
      if (!a) continue;
      if (!a.projectile && a.category !== 'area-jutsu' && a.category !== 'ranged-jutsu') continue;
      if (!me.canUse(a).ok) continue;
      if (this.belief.dist > (a.projectile ? 900 : a.range + a.area)) continue;
      if (me.use(a)) { this.actionCooldown = 0.35 + this.rand() * 0.5; return; }
    }
  }

  _melee(ctx) {
    const me = this.fighter;
    const t = this.tuning;
    if (this.actionCooldown > 0) return;
    if (me.act) {
      // Continue an existing string, skill permitting.
      if (this.rand() < t.comboSkill && me.act.connected) {
        const chain = me.act.ability.chainInto;
        if (chain && chain.length) {
          const pick = chain[Math.floor(this.rand() * chain.length)];
          if (me.tryChain(pick)) return;
        }
      }
      return;
    }

    const b = this.belief;
    const p = this.profile;

    // Launch into an air combo occasionally.
    if (!b.oppAirborne && this.rand() < t.comboSkill * 0.25) {
      const l = me.abilities.launcher;
      if (l && me.canUse(l).ok && b.dist < l.range + 40) {
        if (me.use(l)) { this.actionCooldown = 0.2; return; }
      }
    }
    // Throw a guarding opponent.
    if (b.oppState === STATE.GUARD && this.rand() < 0.35 + t.comboSkill * 0.3) {
      const th = me.abilities.throw;
      if (th && me.canUse(th).ok && b.dist < th.range) {
        if (me.use(th)) { this.actionCooldown = 0.4; return; }
      }
    }
    // Close-range jutsu.
    if (this.rand() < p.jutsuUse * 0.5) {
      for (const a of me.abilities.slots) {
        if (!a || a.projectile) continue;
        if (a.category !== 'melee-jutsu') continue;
        if (!me.canUse(a).ok) continue;
        if (b.dist > a.range + 60) continue;
        if (me.use(a)) { this.actionCooldown = 0.35; return; }
      }
    }
    // Heavy vs light.
    const useHeavy = this.rand() < 0.25 + t.comboSkill * 0.2;
    const move = useHeavy ? me.abilities.heavy : null;
    if (move && me.canUse(move).ok && b.dist < move.range + 30) {
      if (me.use(move)) { this.actionCooldown = 0.25; return; }
    }
    const opener = getAbility(me.data.basicCombos[0]);
    if (opener && me.canUse(opener).ok && b.dist < opener.range + 30) {
      if (me.use(opener)) this.actionCooldown = 0.12;
    }
  }

  /** Guard / substitution reactions that run independently of the plan. */
  _reactiveDefence(dt, ctx) {
    const me = this.fighter;
    const b = this.belief;
    const t = this.tuning;

    // Substitute out of a combo.
    if (HIT_STATES.has(me.state) && canSubstitute(me)) {
      const bias = this.profile.substitutionBias * t.subChance;
      if (this.rand() < bias * dt * 12) ctx.engine?.requestSubstitution(me);
    }

    // Guard counter on block.
    if (me.state === STATE.BLOCKSTUN && this.rand() < this.profile.counterBias * t.comboSkill * dt * 10) {
      const gc = me.abilities.guardCounter;
      if (gc && me.chakra >= gc.chakraCost) me.use(gc, { force: true });
    }

    // Release guard when nothing is threatening.
    if (me.guardHeld && !b.oppAttacking && !b.threat && this.plan !== PLAN.DEFEND) {
      me.setGuard(false);
    }
  }

  /** Training-mode dummy behaviours. */
  _dummy(dt, ctx) {
    const me = this.fighter;
    const opp = ctx.opponent;
    me.faceTowards(opp);
    switch (this.dummyMode) {
      case 'stationary':
        me.setGuard(false);
        break;
      case 'guard':
        me.setGuard(true);
        break;
      case 'counter':
        me.setGuard(!HIT_STATES.has(me.state));
        if (me.state === STATE.BLOCKSTUN) {
          const gc = me.abilities.guardCounter;
          if (gc && me.chakra >= gc.chakraCost) me.use(gc, { force: true });
        }
        break;
      case 'jump':
        me.setGuard(false);
        if (!me.airborne && this.rand() < dt * 2) me.jump();
        break;
      case 'ai':
        this.dummyMode = null;   // hand back to the full AI
        break;
      default:
        break;
    }
  }
}

export { PLAN };
