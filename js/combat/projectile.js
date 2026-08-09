/**
 * Pooled projectiles.
 *
 * The pool is allocated once and reused; firing a projectile never allocates.
 */

import { setCentred, overlaps, SCRATCH } from './hitbox.js';

const POOL_SIZE = 48;

class Projectile {
  constructor() {
    this.active = false;
    this.reset();
  }

  reset() {
    this.active = false;
    this.owner = null;
    this.ability = null;
    this.spec = null;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.life = 0;
    this.age = 0;
    this.radius = 12;
    this.facing = 1;
    this.pierceLeft = 0;
    this.hitIds = null;
    this.damageScale = 1;
    this.trailTimer = 0;
    /**
     * Visual language, captured at spawn from the owner's current form.
     * A projectile outlives the frame that fired it, and the fighter can
     * transform while it is still in flight — reading the form at draw time
     * would recolour a shot that is already halfway across the arena.
     */
    this.style = 'sphere';
    this.tint = null;
  }

  spawn(owner, ability, spec, opts = {}) {
    this.active = true;
    this.owner = owner;
    this.ability = ability;
    this.spec = spec;
    this.facing = owner.facing;
    const off = spec.spawnOffset;
    this.x = owner.x + this.facing * (off.x + (opts.extraX || 0));
    this.y = owner.y - off.y;   // spawnOffset.y is authored negative-up
    if (spec.groundLevel) this.y = owner.y + this.radius;
    this.radius = spec.radius * (spec.size || 1);

    const angle = opts.angle || 0;
    const speed = spec.speed;
    this.vx = Math.cos(angle) * speed * this.facing;
    this.vy = -Math.sin(angle) * speed - (spec.arc || 0);
    this.life = spec.life;
    this.age = 0;
    this.pierceLeft = spec.pierce;
    this.damageScale = opts.damageScale ?? 1;
    this.style = opts.style || spec.style || 'sphere';
    this.tint = opts.tint || null;
    if (!this.hitIds) this.hitIds = new Set(); else this.hitIds.clear();
    this.trailTimer = 0;
    return this;
  }

  update(dt, arena, target) {
    this.age += dt;
    if (this.age >= this.life) { this.active = false; return; }

    const spec = this.spec;
    if (spec.homing > 0 && target) {
      const tx = target.x;
      const ty = target.y - 70;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = Math.hypot(this.vx, this.vy) || spec.speed;
      const steer = spec.homing * dt * 8;
      this.vx += (dx / d) * speed * steer;
      this.vy += (dy / d) * speed * steer;
      // renormalise so homing does not accelerate the shot
      const m = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / m) * speed;
      this.vy = (this.vy / m) * speed;
    }

    this.vy += (spec.gravity || 0) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (spec.groundLevel) this.y = Math.max(this.y, this.radius * 0.6);
    if (this.y < -1400 || this.x < -400 || this.x > arena.width + 400) this.active = false;
  }

  /** Fill a scratch box with this projectile's hit area. */
  bounds(out) {
    return setCentred(out, this.x, -this.y, this.radius, this.radius);
  }

  onHit() {
    if (this.pierceLeft > 0) { this.pierceLeft--; return; }
    if (this.spec.destroyOnHit) this.active = false;
  }
}

export class ProjectilePool {
  constructor(size = POOL_SIZE) {
    this.items = new Array(size);
    for (let i = 0; i < size; i++) this.items[i] = new Projectile();
  }

  /** @returns {Projectile|null} */
  acquire() {
    for (let i = 0; i < this.items.length; i++) {
      if (!this.items[i].active) return this.items[i];
    }
    // Pool exhausted: recycle the oldest rather than allocating.
    let oldest = this.items[0];
    for (const p of this.items) if (p.age > oldest.age) oldest = p;
    oldest.reset();
    return oldest;
  }

  /**
   * Fire an ability's projectile spec. Multi-shot bursts are queued as pending
   * spawns so `count`/`interval` work without allocating timers.
   */
  fire(owner, ability, pending, look = null) {
    const spec = ability.projectile;
    if (!spec) return;
    if (spec.count > 1 && spec.interval > 0) {
      for (let i = 0; i < spec.count; i++) {
        pending.push({
          at: i * spec.interval,
          owner, ability, spec,
          angle: (i - (spec.count - 1) / 2) * spec.spread,
          style: look?.style, tint: look?.tint,
        });
      }
      return;
    }
    for (let i = 0; i < spec.count; i++) {
      const p = this.acquire();
      p.spawn(owner, ability, spec, {
        angle: (i - (spec.count - 1) / 2) * spec.spread,
        style: look?.style, tint: look?.tint,
      });
    }
  }

  spawnOne(owner, ability, spec, angle, damageScale = 1, look = null) {
    const p = this.acquire();
    p.spawn(owner, ability, spec, {
      angle, damageScale, style: look?.style, tint: look?.tint,
    });
    return p;
  }

  update(dt, arena, fighters) {
    for (const p of this.items) {
      if (!p.active) continue;
      const target = fighters.find((f) => f !== p.owner) || null;
      p.update(dt, arena, target);
    }
  }

  /** Projectile vs projectile clashes: equal-ish shots cancel each other. */
  resolveClashes(onClash) {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (!a.active) continue;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        if (!b.active || b.owner === a.owner) continue;
        a.bounds(SCRATCH.a);
        b.bounds(SCRATCH.b);
        if (!overlaps(SCRATCH.a, SCRATCH.b)) continue;
        const ad = a.ability.damage;
        const bd = b.ability.damage;
        onClash?.((a.x + b.x) / 2, (a.y + b.y) / 2);
        if (ad > bd * 1.4) { b.active = false; a.onHit(); }
        else if (bd > ad * 1.4) { a.active = false; b.onHit(); }
        else { a.active = false; b.active = false; }
      }
    }
  }

  clear() {
    for (const p of this.items) p.reset();
  }

  *live() {
    for (const p of this.items) if (p.active) yield p;
  }

  get activeCount() {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }
}

export { Projectile };
