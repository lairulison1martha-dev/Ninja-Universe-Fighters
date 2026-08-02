/**
 * Fighter schema + factory.
 *
 * A roster entry is pure data. Combat reads it, the character-select screen
 * reads it, the validator checks it. Portrait / sprite / audio fields are
 * PATHS ONLY — nothing is fetched at start-up, and the renderer falls back to
 * the procedural placeholder design described by `visual`.
 */

import { PLAYABLE_STATUS, ARCHETYPES } from '../constants.js';
import { templateKit } from './abilities-core.js';

export const FIGHTERS = Object.create(null);
export const FIGHTER_ORDER = [];

/** Baseline stats per archetype. Individual fighters tweak these. */
const ARCHETYPE_STATS = {
  balanced:       { health: 1000, chakra: 100, attack: 100, defense: 100, speed: 100, chakraControl: 100, guard: 100, substitution: 100, awakeningRate: 100 },
  rushdown:       { health: 950,  chakra: 95,  attack: 104, defense: 92,  speed: 118, chakraControl: 92,  guard: 94,  substitution: 105, awakeningRate: 108 },
  ranged:         { health: 930,  chakra: 112, attack: 96,  defense: 94,  speed: 96,  chakraControl: 114, guard: 98,  substitution: 100, awakeningRate: 100 },
  defensive:      { health: 1080, chakra: 104, attack: 94,  defense: 118, speed: 88,  chakraControl: 104, guard: 122, substitution: 96,  awakeningRate: 94 },
  grappler:       { health: 1120, chakra: 88,  attack: 116, defense: 110, speed: 84,  chakraControl: 86,  guard: 108, substitution: 88,  awakeningRate: 96 },
  support:        { health: 980,  chakra: 116, attack: 90,  defense: 100, speed: 100, chakraControl: 118, guard: 102, substitution: 106, awakeningRate: 104 },
  summoner:       { health: 990,  chakra: 118, attack: 98,  defense: 98,  speed: 94,  chakraControl: 116, guard: 100, substitution: 98,  awakeningRate: 100 },
  transformation: { health: 1020, chakra: 106, attack: 102, defense: 102, speed: 102, chakraControl: 102, guard: 100, substitution: 100, awakeningRate: 126 },
  puppet:         { health: 950,  chakra: 110, attack: 96,  defense: 96,  speed: 92,  chakraControl: 118, guard: 98,  substitution: 102, awakeningRate: 98 },
  weapon:         { health: 980,  chakra: 94,  attack: 108, defense: 98,  speed: 108, chakraControl: 92,  guard: 104, substitution: 100, awakeningRate: 102 },
  healer:         { health: 1040, chakra: 114, attack: 88,  defense: 106, speed: 96,  chakraControl: 120, guard: 104, substitution: 104, awakeningRate: 98 },
  zoning:         { health: 940,  chakra: 112, attack: 94,  defense: 96,  speed: 92,  chakraControl: 116, guard: 106, substitution: 100, awakeningRate: 96 },
  counter:        { health: 990,  chakra: 102, attack: 104, defense: 104, speed: 104, chakraControl: 104, guard: 112, substitution: 110, awakeningRate: 102 },
  aerial:         { health: 920,  chakra: 100, attack: 96,  defense: 90,  speed: 122, chakraControl: 102, guard: 92,  substitution: 104, awakeningRate: 106 },
};

/** Deterministic 32-bit hash so unspecified colours stay stable across runs. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * HSL → #rrggbb. Colours are stored as hex everywhere so the renderers can
 * append an alpha suffix (`${color}44`) when building canvas gradients.
 */
function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => {
    const v = lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * v).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function autoColors(id) {
  const h = hash(id);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h >> 8) % 90) % 360;
  return {
    primary: hslToHex(hue, 52, 42),
    secondary: hslToHex(hue2, 46, 30),
    accent: hslToHex((hue + 180) % 360, 82, 62),
    hair: hslToHex((hue + 20) % 360, 30, 18 + (h >> 16) % 40),
    aura: hslToHex(hue2, 90, 62),
    skin: hslToHex(28 + (h >> 4) % 14, 42, 58 + (h >> 12) % 18),
  };
}

const HAIR_STYLES = ['spiky', 'long', 'ponytail', 'short', 'bowl', 'wild', 'bald', 'braided', 'hooded'];
const WEAPONS = ['none', 'kunai', 'sword', 'fan', 'scythe', 'staff', 'puppet', 'claws', 'blades'];

function autoVisual(id, archetype) {
  const h = hash(`${id}:v`);
  return {
    height: 0.9 + ((h >> 3) % 24) / 100,          // 0.90 .. 1.13
    bulk: 0.85 + ((h >> 7) % 34) / 100,           // 0.85 .. 1.18
    hairStyle: HAIR_STYLES[h % HAIR_STYLES.length],
    weapon: archetype === 'weapon' ? 'sword'
      : archetype === 'puppet' ? 'puppet'
        : WEAPONS[(h >> 11) % WEAPONS.length],
    cape: ((h >> 5) % 3) === 0,
    markings: ((h >> 9) % 4) === 0 ? 'stripes' : ((h >> 9) % 4) === 1 ? 'seal' : 'none',
  };
}

const DEFAULT_STAT_KEYS = Object.keys(ARCHETYPE_STATS.balanced);

/**
 * Register a fighter.
 *
 * @param {string} id unique slug
 * @param {string} displayName
 * @param {Object} o
 */
export function defineFighter(id, displayName, o = {}) {
  if (FIGHTERS[id]) throw new Error(`Duplicate fighter id: ${id}`);
  const archetype = o.archetype || 'balanced';
  if (!ARCHETYPES.includes(archetype)) {
    throw new Error(`Fighter ${id} has unknown archetype "${archetype}"`);
  }

  const base = ARCHETYPE_STATS[archetype];
  const baseStats = { ...base };
  for (const k of DEFAULT_STAT_KEYS) {
    if (o.stats && o.stats[k] != null) baseStats[k] = o.stats[k];
  }

  const status = o.playableStatus || PLAYABLE_STATUS.PROTOTYPE;
  const kit = status === PLAYABLE_STATUS.COMPLETE && o.kit ? o.kit : templateKit(archetype);

  const entry = {
    id,
    displayName,
    shortName: o.shortName || displayName.split(' ')[0],
    era: o.era || 'shippuden',
    village: o.village || 'unaffiliated',
    clan: o.clan || 'none',
    organization: o.organization || 'none',
    rank: o.rank || 'jonin',
    archetype,
    description: o.description || '',
    difficulty: o.difficulty ?? 3,          // 1..5
    playableStatus: status,
    unlockRequirement: o.unlockRequirement || { type: 'default' },
    baseStats,
    chakraNatures: o.chakraNatures || ['none'],
    passiveAbilities: o.passiveAbilities || [],

    basicCombos: kit.basicCombos,
    airCombos: kit.airCombos,
    heavy: kit.heavy,
    launcher: kit.launcher,
    dashAttack: kit.dashAttack,
    throwAttack: kit.throwAttack,
    guardCounter: kit.guardCounter,
    abilities: kit.abilities,
    ultimate: kit.ultimate,

    assists: o.assists || [],
    transformations: o.transformations || [],

    portrait: `assets/fighters/${id}/portrait.png`,
    spriteSet: `assets/fighters/${id}/`,
    effectSet: o.effectSet || 'default',
    audioSet: `assets/audio/voice/${id}/`,
    aiProfile: o.aiProfile || 'balanced',
    colors: { ...autoColors(id), ...(o.colors || {}) },
    visual: { ...autoVisual(id, archetype), ...(o.visual || {}) },
    tags: o.tags || [],
  };

  // Movement feel is derived from stats so prototype fighters still differ.
  entry.movement = {
    walkSpeed: 210 * (baseStats.speed / 100),
    runSpeed: 400 * (baseStats.speed / 100),
    dashSpeed: 760 * (baseStats.speed / 100),
    backDashSpeed: 620 * (baseStats.speed / 100),
    jumpVelocity: 940 * (0.94 + (baseStats.speed / 100) * 0.06),
    doubleJump: o.doubleJump ?? (archetype === 'aerial' || baseStats.speed >= 112),
    airDash: o.airDash ?? (archetype === 'aerial'),
    ...(o.movement || {}),
  };

  FIGHTERS[id] = entry;
  FIGHTER_ORDER.push(id);
  return entry;
}

export function getFighter(id) {
  return FIGHTERS[id] || null;
}

export function allFighters() {
  return FIGHTER_ORDER.map((id) => FIGHTERS[id]);
}

export { ARCHETYPE_STATS, hash, hslToHex };
