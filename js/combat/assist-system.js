/**
 * Assists / summons.
 *
 * A called assist runs a single scripted behaviour over a short window, then
 * leaves. Behaviour is data-driven from js/data/assists.js.
 */

import { getAssist } from '../data/assists.js';
import { applyStatusEffects } from './status-effects.js';
import { setCentred, overlaps, SCRATCH } from './hitbox.js';

export class AssistSystem {
  constructor(effects) {
    this.effects = effects;
    /** One live assist per fighter, pre-allocated. */
    this.slots = new Map();
  }

  register(fighter) {
    this.slots.set(fighter.id, {
      fighter,
      active: false,
      assist: null,
      time: 0,
      cooldown: 0,
      x: 0, y: 0, vx: 0,
      hasHit: false,
      facing: 1,
    });
  }

  cooldownFor(fighter) {
    const s = this.slots.get(fighter.id);
    if (!s) return 0;
    const a = getAssist(fighter.data.assists[0]);
    if (!a) return 0;
    return s.cooldown / a.cooldown;
  }

  available(fighter) {
    const s = this.slots.get(fighter.id);
    if (!s || s.active || s.cooldown > 0) return false;
    const a = getAssist(fighter.data.assists[0]);
    if (!a) return false;
    return fighter.chakra >= a.chakraCost;
  }

  call(fighter) {
    if (!this.available(fighter)) return false;
    const s = this.slots.get(fighter.id);
    const a = getAssist(fighter.data.assists[0]);
    fighter.chakra -= a.chakraCost;
    s.active = true;
    s.assist = a;
    s.time = 0;
    s.cooldown = a.cooldown;
    s.hasHit = false;
    s.facing = fighter.facing;
    s.x = fighter.x - fighter.facing * 80;
    s.y = fighter.y;
    s.vx = a.behaviour === 'attack' || a.behaviour === 'projectile'
      ? fighter.facing * (a.range / Math.max(0.35, a.duration))
      : 0;

    this.effects?.emit(a.effectId, s.x, s.y + 60, { scale: a.size, color: a.color });

    if (a.behaviour === 'heal' || a.behaviour === 'defend') {
      applyStatusEffects(fighter, null, a.statusEffects, {});
      if (a.healAmount) fighter.heal(a.healAmount);
    }
    return a;
  }

  update(dt, fighters, onHit) {
    for (const [, s] of this.slots) {
      if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);
      if (!s.active) continue;

      s.time += dt;
      s.x += s.vx * dt;

      const a = s.assist;
      if (a.damage > 0 && !s.hasHit) {
        const target = fighters.find((f) => f !== s.fighter && !f.isDead);
        if (target) {
          setCentred(SCRATCH.a, s.x, -(s.y + 60), 60 * a.size, 70 * a.size);
          target.hurtbox(SCRATCH.b);
          if (overlaps(SCRATCH.a, SCRATCH.b)) {
            s.hasHit = true;
            onHit?.(s.fighter, target, a, s);
          }
        }
      }

      if (s.time >= a.duration) {
        s.active = false;
        s.assist = null;
      }
    }
  }

  reset() {
    for (const [, s] of this.slots) {
      s.active = false;
      s.assist = null;
      s.cooldown = 0;
      s.time = 0;
    }
  }

  /** Iterate live assists for rendering. */
  *live() {
    for (const [, s] of this.slots) if (s.active) yield s;
  }
}
