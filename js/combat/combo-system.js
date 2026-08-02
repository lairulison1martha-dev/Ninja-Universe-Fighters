/**
 * Combo tracking + damage scaling + infinite-combo prevention.
 *
 * Rules enforced here (all listed in the design brief):
 *   - Damage scales down as a combo lengthens.
 *   - Hit-stun decays each hit, so juggles naturally run out.
 *   - A hard cap forces a knockdown, breaking any theoretical infinite.
 *   - Wall bounces and ground bounces are limited to once per combo.
 */

import { COMBAT } from '../constants.js';

export class ComboTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.hits = 0;
    this.damage = 0;
    this.timer = 0;
    this.wallBounces = 0;
    this.groundBounces = 0;
    this.longest = 0;
    this.biggest = 0;
    this.active = false;
  }

  /** Called when a hit connects. Returns the scaled damage. */
  addHit(rawDamage) {
    this.hits++;
    this.active = true;
    this.timer = 1.1;
    const scaled = rawDamage * this.scale();
    this.damage += scaled;
    if (this.hits > this.longest) this.longest = this.hits;
    if (this.damage > this.biggest) this.biggest = this.damage;
    return scaled;
  }

  /** Multiplier applied to the current hit. */
  scale() {
    if (this.hits <= COMBAT.comboScalingStart) return 1;
    const over = this.hits - COMBAT.comboScalingStart;
    return Math.max(COMBAT.comboScalingMin, 1 - over * COMBAT.comboScalingStep);
  }

  /** Hit-stun multiplier — later hits hold the opponent for less time. */
  stunScale() {
    return Math.max(0.35, COMBAT.hitStunDecay ** Math.max(0, this.hits - 1));
  }

  /** True when the combo must be forcibly ended with a knockdown. */
  get atCap() {
    return this.hits >= COMBAT.maxHitsPerCombo;
  }

  canWallBounce() { return this.wallBounces < COMBAT.wallBounceLimit; }
  canGroundBounce() { return this.groundBounces < COMBAT.groundBounceLimit; }
  useWallBounce() { this.wallBounces++; }
  useGroundBounce() { this.groundBounces++; }

  /** Advance the drop timer; returns true on the frame the combo ends. */
  update(dt) {
    if (!this.active) return false;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.end();
      return true;
    }
    return false;
  }

  end() {
    this.hits = 0;
    this.damage = 0;
    this.wallBounces = 0;
    this.groundBounces = 0;
    this.active = false;
    this.timer = 0;
  }
}
