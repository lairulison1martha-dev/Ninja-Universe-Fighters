/**
 * Status effects.
 *
 * Abilities declare `statusEffects: [{ id, duration, magnitude }]`. Instant
 * effects (duration 0) resolve immediately; timed effects go on the target's
 * (or the caster's) active list and tick every simulation step.
 */

/**
 * target: who the effect lands on.
 *   'self'   — always the caster
 *   'victim' — the fighter who was hit
 */
export const EFFECTS = {
  // --- instant, on the victim -------------------------------------------
  chakra_drain: { target: 'victim', instant: (f, m) => { f.chakra = Math.max(0, f.chakra - m); } },
  pull:         { target: 'victim', instant: (f, m, ctx) => { f.vx += -ctx.facing * m; } },
  swap_positions: {
    target: 'self',
    instant: (f, m, ctx) => {
      const o = ctx.opponent;
      if (!o) return;
      const fx = f.x; f.x = o.x; o.x = fx;
      f.facing = Math.sign(o.x - f.x) || f.facing;
      o.facing = -f.facing;
    },
  },
  teleport_to_target: {
    target: 'self',
    instant: (f, m, ctx) => {
      const o = ctx.opponent;
      if (!o) return;
      f.x = o.x - Math.sign(o.x - f.x || 1) * 70;
      f.y = o.y;
      f.facing = Math.sign(o.x - f.x) || f.facing;
    },
  },

  // --- instant, on the caster -------------------------------------------
  heal_instant: { target: 'self', instant: (f, m) => { f.heal(m); } },
  recoil:       { target: 'self', instant: (f, m) => { f.applyRecoil(m); } },
  cleanse:      { target: 'self', instant: (f) => { f.statuses.length = 0; } },
  lifesteal:    { target: 'self', instant: (f, m, ctx) => { f.heal((ctx.damage || 0) * m); } },

  // --- timed, on the victim ---------------------------------------------
  burn:   { target: 'victim', tick: (f, m, dt) => { f.damageOverTime(m * dt, 'burn'); } },
  poison: { target: 'victim', tick: (f, m, dt) => { f.damageOverTime(m * dt, 'poison'); } },
  lifedrain_enemy: { target: 'victim', tick: (f, m, dt) => { f.damageOverTime(m * dt, 'drain'); } },
  slow:   { target: 'victim', mod: (mods, m) => { mods.speed *= (1 - m); } },
  pin:    { target: 'victim', mod: (mods) => { mods.speed = 0; mods.rooted = true; } },
  stun_loop: { target: 'victim', mod: (mods) => { mods.speed = 0; mods.rooted = true; mods.stunned = true; } },
  mark:   { target: 'victim', flag: 'marked' },

  // --- timed, on the caster ---------------------------------------------
  regen:       { target: 'self', tick: (f, m, dt) => { f.heal(m * dt); } },
  attack_up:   { target: 'self', mod: (mods, m) => { mods.attack *= (1 + m); } },
  defense_up:  { target: 'self', mod: (mods, m) => { mods.defense *= (1 + m); } },
  speed_up:    { target: 'self', mod: (mods, m) => { mods.speed *= (1 + m); } },
  armor:       { target: 'self', flag: 'armor', mod: (mods, m) => { mods.armor += m; } },
  auto_guard:  { target: 'self', flag: 'autoGuard' },
  clone_guard: { target: 'self', flag: 'cloneGuard', mod: (mods, m) => { mods.cloneHits += m; } },
  reflect:     { target: 'self', flag: 'reflect' },
  reflect_hit: { target: 'self', flag: 'reflect' },
  thorns:      { target: 'self', flag: 'thorns', mod: (mods, m) => { mods.thorns += m; } },
  phase:       { target: 'self', flag: 'phase' },
  absorb:      { target: 'self', flag: 'absorb', mod: (mods, m) => { mods.absorbPower = Math.max(mods.absorbPower, m); } },
  store_jutsu: { target: 'self', flag: 'storedJutsu' },
  counter_stance: { target: 'self', flag: 'counterStance' },
  guard_pierce: { target: 'self', flag: 'guardPierce', mod: (mods, m) => { mods.guardPierce = Math.max(mods.guardPierce, m); } },
};

/** Fresh modifier accumulator. Reused per fighter, never reallocated per frame. */
export function newModifiers() {
  return {
    attack: 1, defense: 1, speed: 1, chakraRegen: 1, guard: 1,
    armor: 0, cloneHits: 0, thorns: 0, absorbPower: 0, guardPierce: 0,
    rooted: false, stunned: false,
    autoGuard: false, reflect: false, phase: false, absorb: false,
    storedJutsu: false, counterStance: false, cloneGuard: false, marked: false,
  };
}

export function resetModifiers(m) {
  m.attack = 1; m.defense = 1; m.speed = 1; m.chakraRegen = 1; m.guard = 1;
  m.armor = 0; m.cloneHits = 0; m.thorns = 0; m.absorbPower = 0; m.guardPierce = 0;
  m.rooted = false; m.stunned = false;
  m.autoGuard = false; m.reflect = false; m.phase = false; m.absorb = false;
  m.storedJutsu = false; m.counterStance = false; m.cloneGuard = false; m.marked = false;
  return m;
}

/**
 * Apply an ability's statusEffects.
 * @param {Object} caster
 * @param {Object|null} victim
 * @param {Array} effects
 * @param {Object} ctx extra context: { damage, facing, opponent, durationScale }
 */
export function applyStatusEffects(caster, victim, effects, ctx = {}) {
  if (!effects || effects.length === 0) return;
  for (const e of effects) {
    const def = EFFECTS[e.id];
    if (!def) continue;
    const who = def.target === 'self' ? caster : victim;
    if (!who) continue;

    if (def.instant && (!e.duration || e.duration <= 0)) {
      def.instant(who, e.magnitude, { ...ctx, opponent: who === caster ? victim : caster });
      continue;
    }
    if (e.duration > 0) {
      const dur = e.duration * (ctx.durationScale || 1);
      // Refresh rather than stack duplicates of the same id.
      const existing = who.statuses.find((s) => s.id === e.id);
      if (existing) {
        existing.remaining = Math.max(existing.remaining, dur);
        existing.magnitude = Math.max(existing.magnitude, e.magnitude);
      } else {
        who.statuses.push({ id: e.id, remaining: dur, magnitude: e.magnitude, total: dur });
      }
    }
  }
}

/** Advance timers and fold every active status into the fighter's modifiers. */
export function tickStatuses(fighter, dt) {
  const mods = fighter.mods;
  resetModifiers(mods);
  const list = fighter.statuses;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    s.remaining -= dt;
    if (s.remaining <= 0) { list.splice(i, 1); continue; }
    const def = EFFECTS[s.id];
    if (!def) { list.splice(i, 1); continue; }
    if (def.tick) def.tick(fighter, s.magnitude, dt);
    if (def.mod) def.mod(mods, s.magnitude);
    if (def.flag) mods[def.flag] = true;
  }
}

export function hasStatus(fighter, id) {
  return fighter.statuses.some((s) => s.id === id);
}

export function removeStatus(fighter, id) {
  const i = fighter.statuses.findIndex((s) => s.id === id);
  if (i >= 0) fighter.statuses.splice(i, 1);
}
