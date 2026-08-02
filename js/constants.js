/**
 * Ninja Universe Fighters — global constants.
 *
 * Everything here is plain data. No imports, so this module can be pulled in
 * from anywhere (including the service worker registration path) without
 * creating cycles.
 */

export const APP_NAME = 'Ninja Universe Fighters';
export const APP_SHORT_NAME = 'Ninja Fighters';

/** Bump on every deploy. Also drives the service-worker cache name. */
export const APP_VERSION = '0.6.0';

/** Storage keys (namespaced so we never collide with other projects). */
export const STORAGE_PREFIX = 'nuf';
export const SAVE_KEY = `${STORAGE_PREFIX}.save.v1`;
export const SAVE_BACKUP_KEY = `${STORAGE_PREFIX}.save.backup`;
export const SAVE_SLOT_KEY = (slot) => `${STORAGE_PREFIX}.save.slot${slot}`;
export const SAVE_SLOT_COUNT = 3;

/** Save schema version. Migrations live in save-manager.js. */
export const SAVE_VERSION = 4;

/* -------------------------------------------------------------------------- */
/* Combat tuning                                                              */
/* -------------------------------------------------------------------------- */

/** Fixed-timestep simulation rate. Rendering is decoupled via rAF. */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
/** Never simulate more than this many steps in one frame (spiral-of-death guard). */
export const MAX_SIM_STEPS = 5;

/** Arena is described in world units; the camera maps world → screen. */
export const ARENA = {
  width: 1900,
  floorY: 0,
  wallPadding: 60,
  ceiling: -900,
};

export const GRAVITY = 2600;
export const AIR_FRICTION = 0.86;
export const GROUND_FRICTION = 0.80;

export const COMBAT = {
  roundTimeDefault: 99,
  chakraMax: 100,
  chakraRegen: 6.5,          // per second, idle
  chakraChargeRate: 26,      // per second while charging
  guardMax: 100,
  guardRegen: 11,            // per second, out of block-stun
  guardBreakStun: 1.05,      // seconds
  awakeningMax: 100,
  awakeningOnDamageDealt: 0.36,
  awakeningOnDamageTaken: 0.52,
  awakeningPassive: 1.6,     // per second
  substitutionStocks: 3,
  substitutionRegenTime: 12, // seconds per stock
  substitutionCost: 22,      // chakra
  comboScalingStart: 4,      // hits before damage scaling kicks in
  comboScalingStep: 0.09,
  comboScalingMin: 0.22,
  hitStunDecay: 0.965,       // multiplied per hit in a combo
  maxHitsPerCombo: 24,       // hard cap; forces a knockdown afterwards
  wallBounceLimit: 1,
  groundBounceLimit: 1,
  wakeupInvuln: 0.55,        // seconds of i-frames after getting up
  hitStopBase: 0.055,
  hitStopHeavy: 0.10,
  hitStopUltimate: 0.22,
  inputBufferTime: 0.22,     // seconds an unconsumed input stays queued
  throwRange: 96,
  proximityBlockAngle: 0.65,
  /** Maximum horizontal separation, in world units. Beyond this the camera
   *  cannot frame both fighters, so the arena "leashes" them back together —
   *  the same trick 2D fighters use to stop a runaway leaving the screen. */
  maxSeparation: 1180,
};

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'veryhard', 'legendary'];
export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  veryhard: 'Very Hard',
  legendary: 'Legendary',
};

/** Per-difficulty AI knobs. `reaction` is in seconds — never zero, so the AI
 *  can't act on the same frame the player presses a button. */
export const DIFFICULTY_TUNING = {
  easy:      { reaction: 0.42, aggression: 0.35, blockChance: 0.20, subChance: 0.05, comboSkill: 0.20, damageOut: 0.80, damageIn: 1.00 },
  normal:    { reaction: 0.30, aggression: 0.52, blockChance: 0.42, subChance: 0.18, comboSkill: 0.45, damageOut: 0.92, damageIn: 1.00 },
  hard:      { reaction: 0.22, aggression: 0.66, blockChance: 0.60, subChance: 0.32, comboSkill: 0.68, damageOut: 1.00, damageIn: 1.00 },
  veryhard:  { reaction: 0.16, aggression: 0.78, blockChance: 0.72, subChance: 0.46, comboSkill: 0.84, damageOut: 1.08, damageIn: 0.94 },
  legendary: { reaction: 0.11, aggression: 0.88, blockChance: 0.82, subChance: 0.60, comboSkill: 0.96, damageOut: 1.16, damageIn: 0.88 },
};

/* -------------------------------------------------------------------------- */
/* Presentation                                                               */
/* -------------------------------------------------------------------------- */

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

export const QUALITY_TUNING = {
  low:    { maxParticles: 60,  dprCap: 1.25, trails: false, shadows: false, parallaxLayers: 2, bloom: false },
  medium: { maxParticles: 180, dprCap: 1.75, trails: true,  shadows: true,  parallaxLayers: 3, bloom: false },
  high:   { maxParticles: 380, dprCap: 2.25, trails: true,  shadows: true,  parallaxLayers: 4, bloom: true  },
};

export const FPS_TARGETS = [30, 60, 120];

/** Canonical archetypes. Used by filters, AI defaults and prototype templates. */
export const ARCHETYPES = [
  'balanced', 'rushdown', 'ranged', 'defensive', 'grappler', 'support',
  'summoner', 'transformation', 'puppet', 'weapon', 'healer', 'zoning',
  'counter', 'aerial',
];

export const ERAS = ['academy', 'classic', 'shippuden', 'war', 'blank-period', 'boruto', 'ancient'];
export const ERA_LABELS = {
  academy: 'Academy',
  classic: 'Classic',
  shippuden: 'Shippuden',
  war: 'Great War',
  'blank-period': 'Blank Period',
  boruto: 'Next Generation',
  ancient: 'Ancient Age',
};

export const CHAKRA_NATURES = [
  'fire', 'water', 'earth', 'wind', 'lightning', 'wood', 'ice', 'lava',
  'boil', 'magnet', 'explosion', 'scorch', 'storm', 'dust', 'crystal',
  'blaze', 'yin', 'yang', 'yinyang', 'none',
];

/** Ability categories accepted by the validator. */
export const ABILITY_CATEGORIES = [
  'basic', 'heavy', 'launcher', 'aerial', 'throw', 'dash', 'counter',
  'guard-break', 'projectile', 'melee-jutsu', 'ranged-jutsu', 'area-jutsu',
  'healing', 'buff', 'debuff', 'summon', 'ultimate', 'transformation',
];

/** Playable status for a roster entry. */
export const PLAYABLE_STATUS = {
  COMPLETE: 'complete',    // hand-authored unique kit
  PROTOTYPE: 'prototype',  // archetype template, clearly labelled in UI
};

export const GAME_MODES = [
  'story', 'versus', 'arcade', 'survival', 'training', 'tower', 'bossrush',
];

export const DEFAULT_ROUND_COUNT = 3;
export const ROUND_COUNT_OPTIONS = [1, 3, 5];
export const TIMER_OPTIONS = [60, 99, 180, 0]; // 0 = infinite

/** Localisation framework: only English shipped, but the plumbing exists. */
export const LANGUAGES = [
  { id: 'en', label: 'English' },
];

export const TIPS = [
  'Hold GUARD just before an attack lands to reduce chip damage.',
  'Substitution costs chakra — escaping every combo will leave you empty.',
  'Launchers open the door to air combos. Follow up quickly.',
  'Awakening builds faster when you take damage. Comebacks are possible.',
  'Transformations have real requirements. Check the Collection screen.',
  'Damage scales down during long combos, so a short punish can be smarter.',
  'Dash-cancel a blocked heavy attack to stay safe.',
  'Ranged fighters lose to pressure. Close the gap and stay there.',
  'You can move the on-screen buttons in Settings → Controls.',
  'Guard meter breaks if you block forever. Mix in substitutions.',
  'Ultimates are unblockable at close range but very punishable on whiff.',
  'Training mode shows frame data and combo damage.',
];
