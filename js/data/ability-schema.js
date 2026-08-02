/**
 * Ability schema + factory.
 *
 * Every ability in the game is a plain object built by `mk()`. The factory
 * guarantees that each entry has the full field set the combat engine expects,
 * so a sparse definition like `mk('x', { damage: 60 })` is still safe to run.
 *
 * Timings are in SECONDS (the sim runs at a fixed 60 Hz, so 0.1 s = 6 frames).
 * Frame data shown in Training mode is derived from these numbers.
 */

import { ABILITY_CATEGORIES } from '../constants.js';

/** Turn `naruto_rasengan` into `Rasengan`-ish text as a last-resort label. */
function titleize(id) {
  return id
    .split(/[_.]/)
    .slice(1)
    .join(' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || id;
}

/**
 * Projectile descriptor. Consumed by combat/projectile.js.
 * @typedef {Object} ProjectileSpec
 */
export function projectile(o = {}) {
  return {
    speed: o.speed ?? 720,
    gravity: o.gravity ?? 0,
    life: o.life ?? 1.2,
    radius: o.radius ?? 18,
    pierce: o.pierce ?? 0,          // extra targets/projectiles it can pass through
    homing: o.homing ?? 0,          // 0..1 steering strength toward the target
    spawnOffset: o.spawnOffset ?? { x: 60, y: -70 },
    arc: o.arc ?? 0,                // initial upward velocity
    color: o.color ?? '#7fd4ff',
    color2: o.color2 ?? '#ffffff',
    trail: o.trail ?? 'chakra',
    shape: o.shape ?? 'orb',        // orb | shard | wave | beam | ring
    size: o.size ?? 1,
    destroyOnHit: o.destroyOnHit ?? true,
    destroyOnBlock: o.destroyOnBlock ?? true,
    count: o.count ?? 1,            // multi-shot
    spread: o.spread ?? 0,          // radians between shots
    interval: o.interval ?? 0,      // seconds between shots in a burst
    explodeRadius: o.explodeRadius ?? 0,
    groundLevel: o.groundLevel ?? false, // travels along the floor
  };
}

const DEFAULTS = {
  category: 'basic',
  chakraCost: 0,
  cooldown: 0,
  damage: 38,
  guardDamage: 7,
  startup: 0.10,
  activeFrames: 0.07,
  recovery: 0.20,
  range: 96,          // forward reach of the hitbox, world units
  hitHeight: 110,     // vertical half-extent of the hitbox
  hitYOffset: -70,    // hitbox centre relative to the fighter's feet
  hitStun: 0.30,
  blockStun: 0.16,
  knockbackX: 200,
  knockbackY: 0,
  launch: false,
  groundBounce: false,
  wallBounce: false,
  invulnerability: null,   // { start, end } in seconds from move start
  armor: 0,                // hits absorbed during startup+active
  projectile: null,
  tracking: 0,             // how strongly the move turns toward the target
  area: 0,                 // radius for area attacks (0 = use range box)
  advance: 0,              // forward velocity applied on startup
  rise: 0,                 // upward velocity applied on startup
  airOk: false,            // usable in the air
  groundOk: true,
  unblockable: false,
  guardBreak: false,
  hits: 1,                 // multi-hit melee
  hitInterval: 0.06,
  effectId: 'impact_default',
  soundId: 'sfx_hit_light',
  animationId: 'attack',
  statusEffects: [],       // [{ id, duration, magnitude }]
  requirements: null,      // { health, chakra, form, awakening }
  chainInto: [],           // ability ids this move can cancel into on hit
  cancelWindow: 0.26,      // how long after the active frames a chain is allowed
  hitStop: null,           // override hit-stop; null = derived from category
  cutIn: false,            // show the ultimate cut-in panel
  slowMoFinish: false,
  description: '',
  prototype: false,        // true = generic archetype template (surfaced in UI)
};

/** Registry filled by all ability modules. */
export const ABILITY_REGISTRY = Object.create(null);

/**
 * Define an ability and add it to the registry.
 * @param {string} id
 * @param {Object} [o]
 */
export function mk(id, o = {}) {
  if (ABILITY_REGISTRY[id]) {
    throw new Error(`Duplicate ability id: ${id}`);
  }
  const a = { ...DEFAULTS, ...o, id };
  a.displayName = o.displayName || titleize(id);
  if (!ABILITY_CATEGORIES.includes(a.category)) {
    throw new Error(`Ability ${id} has unknown category "${a.category}"`);
  }
  // total animation length, handy for the AI and for frame data display
  a.totalTime = a.startup + a.activeFrames * a.hits +
    a.hitInterval * Math.max(0, a.hits - 1) + a.recovery;
  ABILITY_REGISTRY[id] = a;
  return a;
}

/** Build a whole family of ids from a prefix + shared options. */
export function mkAll(defs) {
  for (const [id, opts] of Object.entries(defs)) mk(id, opts);
}

export function getAbility(id) {
  return ABILITY_REGISTRY[id] || null;
}

export { titleize };
