/**
 * Transformation definitions.
 *
 * Transformations happen DURING combat — they are never separate roster cards
 * (era variants like "Adult Naruto" are separate fighters, which is different).
 *
 * Every form declares real activation requirements. The transformation system
 * refuses activation unless all of them are satisfied, so pressing the button
 * is never sufficient on its own.
 */

export const TRANSFORMATIONS = Object.create(null);

const DEFAULTS = {
  displayName: '',
  previousForm: null,
  nextForm: null,
  /** All of these must pass. See combat/transformation-system.js. */
  activationRequirement: {
    awakening: 100,      // required awakening meter (0..100)
    chakra: 0,           // required chakra
    healthBelow: null,   // e.g. 0.35 → only under 35% health
    healthAbove: null,
    previousForm: null,  // auto-filled from the chain
    oncePerMatch: false,
    roundAtLeast: 0,
  },
  awakeningCost: 100,
  chakraCost: 0,
  healthRequirement: null,
  unlockRequirement: null, // { type: 'story'|'mastery'|'wins'|'default', value }
  duration: 20,            // seconds; Infinity for permanent
  permanent: false,
  chakraDrain: 0,          // per second while active
  healthDrain: 0,          // per second while active
  statModifiers: {},       // multipliers: attack, defense, speed, chakraRegen, guard
  abilityOverrides: {},    // { slotIndex|'heavy'|'launcher'|... : abilityId }
  ultimateOverride: null,
  passiveOverrides: [],
  auraEffect: 'aura_default',
  auraColor: '#7fd4ff',
  spriteOverride: null,
  activationEffect: 'transform_flash',
  revertEffect: 'transform_revert',
  deactivationRules: { onRoundEnd: true, onKO: true, revertTo: 'previous' },
  description: '',

  /* ---- artwork ---------------------------------------------------------
   * `spriteSetId` names a sprite set of this form's own. When it is null the
   * fighter keeps whatever they were already wearing (their costume, or their
   * base art), which is a deliberate, reported fallback rather than a bug —
   * see FORMS_WITH_ART below and the asset manifest.
   */
  spriteSetId: null,
  portrait: null,
  assetStatus: 'fallback',
};

/**
 * Transformations that have their own generated sprite set.
 *
 * Keeping this as an explicit list (rather than probing the filesystem at
 * runtime) means a form cannot quietly claim finished art: adding art means
 * adding the id here, and a test checks every id against the asset manifest.
 */
export const FORMS_WITH_ART = Object.freeze([
  // Naruto's chakra modes
  'naruto_onetail', 'naruto_fourtail', 'naruto_sage', 'naruto_kcm1',
  'naruto_kcm2', 'naruto_sixpaths', 'naruto_baryon',
  // Sasuke's eye stages and curse mark
  'sasuke_sharingan', 'sasuke_cm1', 'sasuke_cm2', 'sasuke_mangekyo',
  'sasuke_ems', 'sasuke_rinnegan',
  // Sakura
  'sakura_byakugo', 'sakura_hundred',
  // Kakashi's eyes and Susanoo
  'kakashi_sharingan', 'kakashi_mangekyo', 'kakashi_double_mangekyo',
  'kakashi_susanoo',
  // Eight Gates
  'guy_gate1', 'guy_gate4', 'guy_gate6', 'guy_gate8',
  'lee_gate1', 'lee_gate4', 'lee_gate6',
  // Gaara's sand
  'gaara_sand_armor', 'gaara_partial_shukaku',
  // Jinchuriki cloaks
  'bee_v1', 'bee_v2', 'minato_kcm',
  // Susanoo
  'itachi_susanoo',
  // Sage modes
  'jiraiya_sage', 'kabuto_sage',
  // Curse mark line
  'orochimaru_serpent',
  // Karma
  'boruto_karma', 'kawaki_karma',
]);

const FORM_ART = new Set(FORMS_WITH_ART);

function deepMerge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = { ...base[k], ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Register a linked chain of forms for one fighter.
 * @param {string} fighterId
 * @param {Array<Object>} forms in order, each `{ id, ... }`
 * @returns {string[]} the ordered form ids
 */
export function chain(fighterId, forms) {
  const ids = forms.map((f) => `${fighterId}_${f.id}`);
  forms.forEach((f, i) => {
    const id = ids[i];
    if (TRANSFORMATIONS[id]) throw new Error(`Duplicate transformation id: ${id}`);
    const merged = deepMerge(DEFAULTS, f);
    merged.id = id;
    merged.fighterId = fighterId;
    merged.displayName = f.displayName || f.id;
    merged.previousForm = i > 0 ? ids[i - 1] : null;
    merged.nextForm = i < ids.length - 1 ? ids[i + 1] : null;
    merged.activationRequirement = {
      ...DEFAULTS.activationRequirement,
      ...(f.activationRequirement || {}),
      previousForm: merged.previousForm,
    };
    if (merged.permanent) merged.duration = Infinity;

    // Wire the artwork fields from the one list above, so a form's declared
    // status and its actual assets cannot drift apart.
    if (FORM_ART.has(id)) {
      merged.spriteSetId = id;
      merged.portrait = `assets/fighters/${fighterId}/forms/${id}/portrait.png`;
      merged.assetStatus = 'complete';
    } else {
      merged.spriteSetId = null;
      merged.portrait = null;
      merged.assetStatus = 'fallback';
    }

    TRANSFORMATIONS[id] = merged;
  });
  return ids;
}

export function getTransformation(id) {
  return TRANSFORMATIONS[id] || null;
}

/** Walk a chain from a given form id. */
export function chainFrom(id) {
  const out = [];
  let cur = TRANSFORMATIONS[id];
  while (cur) {
    out.push(cur);
    cur = cur.nextForm ? TRANSFORMATIONS[cur.nextForm] : null;
  }
  return out;
}

/* ========================================================================== */
/* NARUTO                                                                     */
/* ========================================================================== */

export const NARUTO_CHAIN = chain('naruto', [
  {
    id: 'onetail', displayName: 'One-Tail Cloak',
    activationRequirement: { awakening: 45 },
    awakeningCost: 45, duration: 16, chakraDrain: 1.2, healthDrain: 0.8,
    statModifiers: { attack: 1.12, speed: 1.14, defense: 0.96, chakraRegen: 1.2 },
    auraColor: '#ff6a3c', auraEffect: 'aura_cloak',
    description: 'Kurama’s chakra leaks out. Faster and stronger, but it burns you.',
  },
  {
    id: 'fourtail', displayName: 'Four-Tail Cloak',
    activationRequirement: { awakening: 70, healthBelow: 0.55 },
    awakeningCost: 70, duration: 14, chakraDrain: 2.4, healthDrain: 2.6,
    statModifiers: { attack: 1.30, speed: 1.20, defense: 0.88, chakraRegen: 1.4 },
    abilityOverrides: { 1: 'naruto_tailed_beast_rasengan' },
    auraColor: '#ff3a1a', auraEffect: 'aura_cloak',
    description: 'Out of control. Huge damage, and your own health drains fast.',
  },
  {
    id: 'sage', displayName: 'Sage Mode',
    activationRequirement: { awakening: 60, chakra: 25 },
    awakeningCost: 60, chakraCost: 25, duration: 22,
    statModifiers: { attack: 1.20, defense: 1.15, speed: 1.06, chakraRegen: 1.3, guard: 1.2 },
    abilityOverrides: { 1: 'naruto_sage_rasengan', 2: 'naruto_frog_kata' },
    unlockRequirement: { type: 'default' },
    auraColor: '#f2c46a', auraEffect: 'aura_sage',
    description: 'Natural energy. Balanced buff with no drain — the reliable pick.',
  },
  {
    id: 'kcm1', displayName: 'Kurama Chakra Mode',
    activationRequirement: { awakening: 75, chakra: 30 },
    awakeningCost: 75, chakraCost: 30, duration: 20, chakraDrain: 1.0,
    statModifiers: { attack: 1.26, defense: 1.10, speed: 1.28, chakraRegen: 1.5 },
    abilityOverrides: { 1: 'naruto_sage_rasengan' },
    unlockRequirement: { type: 'mastery', value: 2 },
    auraColor: '#ffd75a', auraEffect: 'aura_kcm',
    description: 'Cooperative Kurama chakra. Best movement speed of the early forms.',
  },
  {
    id: 'kcm2', displayName: 'Kurama Avatar',
    activationRequirement: { awakening: 90, chakra: 40, previousFormRequired: true },
    awakeningCost: 90, chakraCost: 40, duration: 18, chakraDrain: 2.0,
    statModifiers: { attack: 1.40, defense: 1.22, speed: 1.18, chakraRegen: 1.4 },
    abilityOverrides: { 1: 'naruto_tailed_beast_rasengan', 2: 'naruto_tailed_beast_bomb' },
    unlockRequirement: { type: 'mastery', value: 4 },
    auraColor: '#ffb020', auraEffect: 'aura_avatar',
    description: 'A full chakra avatar forms around you.',
  },
  {
    id: 'sixpaths', displayName: 'Six Paths Sage Mode',
    activationRequirement: { awakening: 100, chakra: 50 },
    awakeningCost: 100, chakraCost: 50, duration: 20, chakraDrain: 1.6,
    statModifiers: { attack: 1.52, defense: 1.30, speed: 1.30, chakraRegen: 1.8, guard: 1.4 },
    abilityOverrides: { 1: 'naruto_planetary_rasenshuriken', 2: 'naruto_tailed_beast_bomb' },
    ultimateOverride: 'naruto_sixpaths_ultimate',
    unlockRequirement: { type: 'story', value: 'chapter_5' },
    auraColor: '#ffe9a8', auraEffect: 'aura_sixpaths',
    description: 'Truth-seeking orbs. Requires story progress to unlock.',
  },
  {
    id: 'baryon', displayName: 'Baryon Mode',
    activationRequirement: { awakening: 100, healthBelow: 0.30, oncePerMatch: true },
    awakeningCost: 100, duration: 12, healthDrain: 6.0,
    statModifiers: { attack: 1.85, defense: 1.15, speed: 1.45, chakraRegen: 2.2 },
    abilityOverrides: { 0: 'naruto_baryon_barrage', 1: 'naruto_baryon_barrage' },
    ultimateOverride: 'naruto_sixpaths_ultimate',
    unlockRequirement: { type: 'story', value: 'chapter_8' },
    auraColor: '#ff5cc0', auraEffect: 'aura_baryon',
    deactivationRules: { onRoundEnd: true, onKO: true, revertTo: 'base' },
    description: 'Last resort. Once per match, below 30% health — and it eats your life.',
  },
]);

/* ========================================================================== */
/* SASUKE                                                                     */
/* ========================================================================== */

export const SASUKE_CHAIN = chain('sasuke', [
  {
    id: 'sharingan', displayName: 'Sharingan',
    activationRequirement: { awakening: 35 }, awakeningCost: 35, duration: 24,
    statModifiers: { attack: 1.08, defense: 1.06, speed: 1.06, guard: 1.15 },
    auraColor: '#ff4a4a', auraEffect: 'aura_eye',
    description: 'Reads attacks: better guard and a small all-round buff.',
  },
  {
    id: 'cm1', displayName: 'Curse Mark Level 1',
    activationRequirement: { awakening: 55, healthBelow: 0.7 },
    awakeningCost: 55, duration: 18, healthDrain: 1.0,
    statModifiers: { attack: 1.22, speed: 1.16, defense: 0.98 },
    abilityOverrides: { 1: 'sasuke_chidori_stream' },
    auraColor: '#8a3ad8', auraEffect: 'aura_curse',
    description: 'Orochimaru’s mark spreads. Aggressive stat trade.',
  },
  {
    id: 'cm2', displayName: 'Curse Mark Level 2',
    activationRequirement: { awakening: 75, healthBelow: 0.5 },
    awakeningCost: 75, duration: 16, healthDrain: 2.4,
    statModifiers: { attack: 1.36, speed: 1.24, defense: 0.94, chakraRegen: 1.3 },
    abilityOverrides: { 1: 'sasuke_chidori_stream', 2: 'sasuke_dragon_flame' },
    auraColor: '#6a1ab8', auraEffect: 'aura_curse',
    description: 'Full transformation. Drains health quickly.',
  },
  {
    id: 'mangekyo', displayName: 'Mangekyo Sharingan',
    activationRequirement: { awakening: 70, chakra: 25 },
    awakeningCost: 70, chakraCost: 25, duration: 22, chakraDrain: 0.8,
    statModifiers: { attack: 1.26, defense: 1.14, speed: 1.10, guard: 1.25 },
    abilityOverrides: { 0: 'sasuke_kagutsuchi', 2: 'sasuke_susanoo_slash' },
    unlockRequirement: { type: 'mastery', value: 2 },
    auraColor: '#d81a3a', auraEffect: 'aura_eye',
    description: 'Unlocks Blaze Release and a Susanoo blade.',
  },
  {
    id: 'ems', displayName: 'Eternal Mangekyo Sharingan',
    activationRequirement: { awakening: 85, chakra: 35 },
    awakeningCost: 85, chakraCost: 35, duration: 22,
    statModifiers: { attack: 1.36, defense: 1.24, speed: 1.14, guard: 1.35, chakraRegen: 1.3 },
    abilityOverrides: { 0: 'sasuke_kagutsuchi', 1: 'sasuke_amenotejikara', 2: 'sasuke_susanoo_slash' },
    unlockRequirement: { type: 'mastery', value: 4 },
    auraColor: '#ff2a5a', auraEffect: 'aura_eye',
    description: 'No blindness drawback. Adds Amenotejikara.',
  },
  {
    id: 'rinnegan', displayName: 'Rinnegan',
    activationRequirement: { awakening: 100, chakra: 50 },
    awakeningCost: 100, chakraCost: 50, duration: 20, chakraDrain: 1.4,
    statModifiers: { attack: 1.50, defense: 1.32, speed: 1.22, guard: 1.45, chakraRegen: 1.6 },
    abilityOverrides: { 0: 'sasuke_kagutsuchi', 1: 'sasuke_amenotejikara', 2: 'sasuke_susanoo_slash' },
    ultimateOverride: 'sasuke_indra_arrow',
    unlockRequirement: { type: 'story', value: 'chapter_6' },
    auraColor: '#9a5aff', auraEffect: 'aura_rinnegan',
    description: 'Perfect Susanoo and Indra’s Arrow.',
  },
]);

/* ========================================================================== */
/* SAKURA / TSUNADE / KAKASHI                                                 */
/* ========================================================================== */

export const SAKURA_CHAIN = chain('sakura', [
  {
    id: 'byakugo', displayName: 'Byakugo Seal',
    activationRequirement: { awakening: 60 }, awakeningCost: 60, duration: 22,
    statModifiers: { attack: 1.24, defense: 1.18, chakraRegen: 1.3 },
    abilityOverrides: { 1: 'sakura_hundred_healings' },
    auraColor: '#ff8ab0', auraEffect: 'aura_seal',
    description: 'Releases the stored chakra of the seal.',
  },
  {
    id: 'hundred', displayName: 'Strength of a Hundred',
    activationRequirement: { awakening: 100, chakra: 40 },
    awakeningCost: 100, chakraCost: 40, duration: 20, chakraDrain: 1.2,
    statModifiers: { attack: 1.44, defense: 1.30, speed: 1.10, chakraRegen: 1.5 },
    abilityOverrides: { 1: 'sakura_hundred_healings', 2: 'sakura_mitotic_regeneration' },
    unlockRequirement: { type: 'mastery', value: 3 },
    auraColor: '#ff5a8a', auraEffect: 'aura_seal',
    description: 'Full Byakugo. Adds Mitotic Regeneration.',
  },
]);

export const TSUNADE_CHAIN = chain('tsunade', [
  {
    id: 'byakugo', displayName: 'Byakugo Seal',
    activationRequirement: { awakening: 55 }, awakeningCost: 55, duration: 24,
    statModifiers: { attack: 1.22, defense: 1.22, chakraRegen: 1.25 },
    abilityOverrides: { 1: 'tsunade_hundred_healings' },
    auraColor: '#ff9ab8', auraEffect: 'aura_seal',
    description: 'The original seal. Better defence than Sakura’s version.',
  },
  {
    id: 'creation_rebirth', displayName: 'Creation Rebirth',
    activationRequirement: { awakening: 95, healthBelow: 0.6 },
    awakeningCost: 95, duration: 18, chakraDrain: 1.6,
    statModifiers: { attack: 1.40, defense: 1.34, chakraRegen: 1.4 },
    abilityOverrides: { 1: 'tsunade_hundred_healings' },
    unlockRequirement: { type: 'mastery', value: 3 },
    auraColor: '#ffd0dc', auraEffect: 'aura_seal',
    description: 'Regenerates continuously — but only from below 60% health.',
  },
]);

export const KAKASHI_CHAIN = chain('kakashi', [
  {
    id: 'sharingan', displayName: 'Sharingan',
    activationRequirement: { awakening: 35 }, awakeningCost: 35, duration: 24,
    statModifiers: { attack: 1.08, defense: 1.08, speed: 1.05, guard: 1.2 },
    auraColor: '#ff4a4a', auraEffect: 'aura_eye',
    description: 'Copy-ninja reading. Improves guard significantly.',
  },
  {
    id: 'mangekyo', displayName: 'Mangekyo Sharingan',
    activationRequirement: { awakening: 65, chakra: 25 },
    awakeningCost: 65, chakraCost: 25, duration: 20, chakraDrain: 1.4,
    statModifiers: { attack: 1.22, defense: 1.12, speed: 1.10 },
    abilityOverrides: { 2: 'kakashi_kamui_shuriken' },
    auraColor: '#b57bff', auraEffect: 'aura_eye',
    description: 'Kamui becomes offensive.',
  },
  {
    id: 'double_mangekyo', displayName: 'Double Mangekyo',
    activationRequirement: { awakening: 85, chakra: 35 },
    awakeningCost: 85, chakraCost: 35, duration: 18, chakraDrain: 1.8,
    statModifiers: { attack: 1.34, defense: 1.20, speed: 1.18, chakraRegen: 1.3 },
    abilityOverrides: { 1: 'kakashi_earth_wall', 2: 'kakashi_kamui_shuriken' },
    unlockRequirement: { type: 'mastery', value: 3 },
    auraColor: '#c99bff', auraEffect: 'aura_eye',
    description: 'Both eyes active. Faster warps, stronger Kamui.',
  },
  {
    id: 'susanoo', displayName: 'Perfect Susanoo',
    activationRequirement: { awakening: 100, chakra: 50 },
    awakeningCost: 100, chakraCost: 50, duration: 16, chakraDrain: 2.4,
    statModifiers: { attack: 1.48, defense: 1.40, speed: 0.96, guard: 1.5 },
    abilityOverrides: { 0: 'kakashi_susanoo', 2: 'kakashi_kamui_shuriken' },
    ultimateOverride: 'kakashi_double_kamui_ultimate',
    unlockRequirement: { type: 'story', value: 'chapter_7' },
    auraColor: '#8a5aff', auraEffect: 'aura_susanoo',
    description: 'Six Paths chakra grants Kakashi a full Susanoo.',
  },
]);

/* ========================================================================== */
/* EIGHT GATES — Rock Lee (six) and Might Guy (eight)                          */
/* ========================================================================== */

function gate(n, opts = {}) {
  const names = [
    'Gate of Opening', 'Gate of Healing', 'Gate of Life', 'Gate of Pain',
    'Gate of Limit', 'Gate of View', 'Gate of Wonder', 'Gate of Death',
  ];
  const atk = 1.08 + n * 0.085;
  const spd = 1.06 + n * 0.062;
  return {
    id: `gate${n}`,
    displayName: `${n}. ${names[n - 1]}`,
    activationRequirement: { awakening: 12 + n * 10, healthBelow: n >= 5 ? 0.6 : null },
    awakeningCost: 12 + n * 10,
    duration: Math.max(9, 26 - n * 2),
    healthDrain: n <= 2 ? 0 : (n - 2) * 1.35,
    statModifiers: { attack: atk, speed: spd, defense: 1 + n * 0.02, chakraRegen: 1 + n * 0.05 },
    auraColor: n >= 7 ? '#7fe0ff' : n >= 5 ? '#ff3a2a' : '#ff9a4a',
    auraEffect: n >= 7 ? 'aura_gate_blue' : 'aura_gate',
    unlockRequirement: n <= 2 ? { type: 'default' } : { type: 'mastery', value: Math.min(5, n - 2) },
    description: `Gate ${n} of ${opts.total}. ${n >= 3 ? 'Drains health while active.' : 'No drawback.'}`,
    ...opts.extra,
  };
}

export const LEE_CHAIN = chain('lee', [1, 2, 3, 4, 5, 6].map((n) => gate(n, {
  total: 6,
  extra: n === 5 ? { abilityOverrides: { 2: 'lee_morning_peacock' }, ultimateOverride: 'lee_reverse_lotus' }
    : n === 6 ? { abilityOverrides: { 1: 'lee_leaf_gale', 2: 'lee_morning_peacock' }, ultimateOverride: 'lee_reverse_lotus' }
      : {},
})));

export const GUY_CHAIN = chain('guy', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => gate(n, {
  total: 8,
  extra: n === 8
    ? {
      activationRequirement: { awakening: 100, healthBelow: 0.25, oncePerMatch: true },
      awakeningCost: 100, duration: 10, healthDrain: 9,
      statModifiers: { attack: 2.1, speed: 1.7, defense: 1.1, chakraRegen: 2.0 },
      ultimateOverride: 'guy_night_guy',
      unlockRequirement: { type: 'story', value: 'chapter_7' },
      deactivationRules: { onRoundEnd: true, onKO: true, revertTo: 'base' },
      description: 'Eighth Gate. Once per match, below 25% health. You will not survive it long.',
    }
    : n === 7 ? { abilityOverrides: { 2: 'guy_night_guy' } } : {},
})));

/* ========================================================================== */
/* GAARA / ITACHI / PAIN / MADARA / OBITO                                     */
/* ========================================================================== */

export const GAARA_CHAIN = chain('gaara', [
  {
    id: 'sand_armor', displayName: 'Sand Armour',
    activationRequirement: { awakening: 40 }, awakeningCost: 40, duration: 24,
    statModifiers: { defense: 1.30, guard: 1.30, speed: 0.94 },
    auraColor: '#d8b271', auraEffect: 'aura_sand',
    description: 'Heavy defensive buff at the cost of movement speed.',
  },
  {
    id: 'partial_shukaku', displayName: 'Partial Shukaku',
    activationRequirement: { awakening: 70, healthBelow: 0.75 },
    awakeningCost: 70, duration: 18, chakraDrain: 1.2,
    statModifiers: { attack: 1.34, defense: 1.24, speed: 1.02, guard: 1.2 },
    abilityOverrides: { 0: 'gaara_shukaku_slam', 2: 'gaara_sand_burial' },
    auraColor: '#e0c07a', auraEffect: 'aura_sand',
    description: 'A Shukaku arm and shoulder form from the sand.',
  },
  {
    id: 'full_shukaku', displayName: 'Full Shukaku',
    activationRequirement: { awakening: 100, healthBelow: 0.45, chakra: 40 },
    awakeningCost: 100, chakraCost: 40, duration: 15, chakraDrain: 2.6, healthDrain: 1.2,
    statModifiers: { attack: 1.60, defense: 1.45, speed: 0.92, guard: 1.5 },
    abilityOverrides: { 0: 'gaara_shukaku_slam', 1: 'gaara_sand_clone', 2: 'gaara_sand_burial' },
    unlockRequirement: { type: 'mastery', value: 4 },
    auraColor: '#f0d89a', auraEffect: 'aura_shukaku',
    description: 'The full One-Tail. Slow, colossal, and it costs you health.',
  },
]);

export const ITACHI_CHAIN = chain('itachi', [
  {
    id: 'mangekyo', displayName: 'Mangekyo Sharingan',
    activationRequirement: { awakening: 55, chakra: 20 },
    awakeningCost: 55, chakraCost: 20, duration: 22, healthDrain: 0.9,
    statModifiers: { attack: 1.24, defense: 1.10, speed: 1.10, guard: 1.2 },
    abilityOverrides: { 2: 'itachi_izanami' },
    auraColor: '#d81a3a', auraEffect: 'aura_eye',
    description: 'Itachi’s eyes cost him health while active — as they should.',
  },
  {
    id: 'susanoo', displayName: 'Susanoo',
    activationRequirement: { awakening: 100, chakra: 45 },
    awakeningCost: 100, chakraCost: 45, duration: 18, healthDrain: 2.2, chakraDrain: 1.2,
    statModifiers: { attack: 1.44, defense: 1.48, speed: 0.94, guard: 1.6 },
    abilityOverrides: { 0: 'itachi_totsuka_blade', 1: 'itachi_yata_mirror', 2: 'itachi_izanami' },
    unlockRequirement: { type: 'mastery', value: 3 },
    auraColor: '#ff5a3a', auraEffect: 'aura_susanoo',
    description: 'Totsuka Blade and Yata Mirror — the best defensive form in the game.',
  },
]);

export const PAIN_CHAIN = chain('pain', [
  {
    id: 'six_paths', displayName: 'Six Paths Formation',
    activationRequirement: { awakening: 65, chakra: 25 },
    awakeningCost: 65, chakraCost: 25, duration: 20, chakraDrain: 1.0,
    statModifiers: { attack: 1.26, defense: 1.16, speed: 1.08, chakraRegen: 1.4 },
    abilityOverrides: { 2: 'pain_six_paths_formation' },
    auraColor: '#a08adc', auraEffect: 'aura_rinnegan',
    description: 'All six bodies fight together.',
  },
  {
    id: 'nagato', displayName: 'Nagato Revealed',
    activationRequirement: { awakening: 100, healthBelow: 0.5, chakra: 40 },
    awakeningCost: 100, chakraCost: 40, duration: 18, chakraDrain: 1.8,
    statModifiers: { attack: 1.46, defense: 1.24, speed: 0.98, chakraRegen: 1.8 },
    abilityOverrides: { 0: 'pain_soul_removal', 1: 'pain_king_of_hell', 2: 'pain_six_paths_formation' },
    unlockRequirement: { type: 'story', value: 'chapter_4' },
    auraColor: '#c8a8ff', auraEffect: 'aura_rinnegan',
    description: 'The real body takes over. Adds soul drain and a full heal.',
  },
]);

export const MADARA_CHAIN = chain('madara', [
  {
    id: 'mangekyo', displayName: 'Mangekyo Sharingan',
    activationRequirement: { awakening: 40 }, awakeningCost: 40, duration: 24,
    statModifiers: { attack: 1.14, defense: 1.10, speed: 1.08, guard: 1.2 },
    auraColor: '#ff4a4a', auraEffect: 'aura_eye',
    description: '',
  },
  {
    id: 'ems', displayName: 'Eternal Mangekyo Sharingan',
    activationRequirement: { awakening: 60, chakra: 20 },
    awakeningCost: 60, chakraCost: 20, duration: 22,
    statModifiers: { attack: 1.26, defense: 1.20, speed: 1.12, guard: 1.3 },
    abilityOverrides: { 1: 'madara_wood_style' },
    auraColor: '#ff2a5a', auraEffect: 'aura_eye',
    description: 'Adds Wood Style.',
  },
  {
    id: 'rinnegan', displayName: 'Rinnegan',
    activationRequirement: { awakening: 80, chakra: 35 },
    awakeningCost: 80, chakraCost: 35, duration: 20, chakraDrain: 1.2,
    statModifiers: { attack: 1.38, defense: 1.28, speed: 1.16, guard: 1.4, chakraRegen: 1.4 },
    abilityOverrides: { 1: 'madara_wood_style', 2: 'madara_truth_seeking_orbs' },
    unlockRequirement: { type: 'mastery', value: 3 },
    auraColor: '#9a5aff', auraEffect: 'aura_rinnegan',
    description: 'Limbo clones and truth-seeking orbs.',
  },
  {
    id: 'sixpaths', displayName: 'Six Paths Madara',
    activationRequirement: { awakening: 95, chakra: 45 },
    awakeningCost: 95, chakraCost: 45, duration: 18, chakraDrain: 1.8,
    statModifiers: { attack: 1.52, defense: 1.38, speed: 1.24, guard: 1.5, chakraRegen: 1.6 },
    abilityOverrides: { 0: 'madara_truth_seeking_orbs', 1: 'madara_wood_style' },
    unlockRequirement: { type: 'story', value: 'chapter_6' },
    auraColor: '#ffe9a8', auraEffect: 'aura_sixpaths',
    description: '',
  },
  {
    id: 'obito', displayName: 'Ten-Tails Jinchuriki',
    activationRequirement: { awakening: 100, chakra: 60, healthBelow: 0.6, oncePerMatch: true },
    awakeningCost: 100, chakraCost: 60, duration: 16, chakraDrain: 2.6,
    statModifiers: { attack: 1.72, defense: 1.55, speed: 1.20, guard: 1.7, chakraRegen: 2.0 },
    abilityOverrides: { 0: 'madara_truth_seeking_orbs', 1: 'madara_wood_style', 2: 'madara_infinite_tsukuyomi' },
    ultimateOverride: 'madara_infinite_tsukuyomi',
    unlockRequirement: { type: 'story', value: 'chapter_9' },
    auraColor: '#c8b0ff', auraEffect: 'aura_tentails',
    deactivationRules: { onRoundEnd: true, onKO: true, revertTo: 'base' },
    description: 'Once per match, below 60% health, with 60 chakra. The full monster.',
  },
  {
    id: 'rinne_sharingan', displayName: 'Rinne Sharingan',
    activationRequirement: { awakening: 100, chakra: 70, healthBelow: 0.3, oncePerMatch: true },
    awakeningCost: 100, chakraCost: 70, duration: 12, chakraDrain: 4.0, healthDrain: 1.5,
    statModifiers: { attack: 1.90, defense: 1.60, speed: 1.28, guard: 1.8, chakraRegen: 2.2 },
    ultimateOverride: 'madara_infinite_tsukuyomi',
    unlockRequirement: { type: 'story', value: 'chapter_10' },
    auraColor: '#f0e0ff', auraEffect: 'aura_tentails',
    deactivationRules: { onRoundEnd: true, onKO: true, revertTo: 'base' },
    description: 'The third eye opens. Final form, story-locked.',
  },
]);

export const OBITO_CHAIN = chain('obito', [
  {
    id: 'masked', displayName: 'Masked Obito',
    activationRequirement: { awakening: 45 }, awakeningCost: 45, duration: 22,
    statModifiers: { attack: 1.16, defense: 1.10, speed: 1.16 },
    auraColor: '#ff7a3a', auraEffect: 'aura_eye',
    description: 'The Akatsuki mask goes on. Faster phasing.',
  },
  {
    id: 'white_mask', displayName: 'White Mask Obito',
    activationRequirement: { awakening: 70, chakra: 25 },
    awakeningCost: 70, chakraCost: 25, duration: 20, chakraDrain: 1.0,
    statModifiers: { attack: 1.30, defense: 1.20, speed: 1.22, chakraRegen: 1.3 },
    abilityOverrides: { 2: 'obito_truth_seeking_shield' },
    auraColor: '#e0e6f0', auraEffect: 'aura_eye',
    description: '',
  },
  {
    id: 'obito', displayName: 'Ten-Tails Obito',
    activationRequirement: { awakening: 100, chakra: 50 },
    awakeningCost: 100, chakraCost: 50, duration: 17, chakraDrain: 2.2,
    statModifiers: { attack: 1.60, defense: 1.46, speed: 1.24, guard: 1.6, chakraRegen: 1.8 },
    abilityOverrides: { 0: 'obito_truth_seeking_shield', 2: 'madara_truth_seeking_orbs' },
    unlockRequirement: { type: 'story', value: 'chapter_8' },
    auraColor: '#c8b0ff', auraEffect: 'aura_tentails',
    description: 'Jinchuriki of the Ten-Tails.',
  },
]);

/* ========================================================================== */
/* NEXT GENERATION                                                            */
/* ========================================================================== */

export const BORUTO_CHAIN = chain('boruto', [
  {
    id: 'karma', displayName: 'Karma',
    activationRequirement: { awakening: 50 }, awakeningCost: 50, duration: 20, healthDrain: 0.6,
    statModifiers: { attack: 1.22, defense: 1.10, speed: 1.18, chakraRegen: 1.4 },
    abilityOverrides: { 2: 'boruto_karma_absorption' },
    auraColor: '#7a3adc', auraEffect: 'aura_karma',
    description: 'The mark activates. Small health drain.',
  },
  {
    id: 'karma2', displayName: 'Karma Stage Two',
    activationRequirement: { awakening: 75, healthBelow: 0.65 },
    awakeningCost: 75, duration: 18, healthDrain: 1.8,
    statModifiers: { attack: 1.38, defense: 1.18, speed: 1.28, chakraRegen: 1.6 },
    abilityOverrides: { 1: 'boruto_karma_rift', 2: 'boruto_karma_absorption' },
    unlockRequirement: { type: 'mastery', value: 2 },
    auraColor: '#9a4aff', auraEffect: 'aura_karma',
    description: '',
  },
  {
    id: 'true_essence', displayName: 'True Essence',
    activationRequirement: { awakening: 100, healthBelow: 0.4, oncePerMatch: true },
    awakeningCost: 100, duration: 14, healthDrain: 3.4,
    statModifiers: { attack: 1.62, defense: 1.28, speed: 1.42, chakraRegen: 2.0 },
    abilityOverrides: { 0: 'boruto_karma_rift', 2: 'boruto_karma_absorption' },
    ultimateOverride: 'boruto_true_essence_ultimate',
    unlockRequirement: { type: 'story', value: 'chapter_9' },
    auraColor: '#d0a8ff', auraEffect: 'aura_karma',
    deactivationRules: { onRoundEnd: true, onKO: true, revertTo: 'base' },
    description: 'Momoshiki surfaces. Once per match.',
  },
]);

export const KAWAKI_CHAIN = chain('kawaki', [
  {
    id: 'karma', displayName: 'Karma',
    activationRequirement: { awakening: 50 }, awakeningCost: 50, duration: 20,
    statModifiers: { attack: 1.24, defense: 1.14, speed: 1.12, chakraRegen: 1.3 },
    abilityOverrides: { 0: 'kawaki_scientific_tools' },
    auraColor: '#5a2a8a', auraEffect: 'aura_karma',
    description: '',
  },
  {
    id: 'karma2', displayName: 'Karma Stage Two',
    activationRequirement: { awakening: 78, healthBelow: 0.7 },
    awakeningCost: 78, duration: 18, healthDrain: 1.4,
    statModifiers: { attack: 1.42, defense: 1.24, speed: 1.20, chakraRegen: 1.5 },
    abilityOverrides: { 0: 'kawaki_isshiki_rods' },
    unlockRequirement: { type: 'mastery', value: 2 },
    auraColor: '#8a3add', auraEffect: 'aura_karma',
    description: '',
  },
  {
    id: 'isshiki', displayName: 'Isshiki Power',
    activationRequirement: { awakening: 100, chakra: 45, healthBelow: 0.5 },
    awakeningCost: 100, chakraCost: 45, duration: 15, chakraDrain: 2.4,
    statModifiers: { attack: 1.66, defense: 1.40, speed: 1.30, guard: 1.5, chakraRegen: 1.9 },
    abilityOverrides: { 0: 'kawaki_isshiki_rods', 2: 'kawaki_isshiki_ultimate' },
    ultimateOverride: 'kawaki_isshiki_ultimate',
    unlockRequirement: { type: 'story', value: 'chapter_10' },
    auraColor: '#e8d05a', auraEffect: 'aura_isshiki',
    description: 'Isshiki’s power fully manifests.',
  },
]);

export const MOMOSHIKI_CHAIN = chain('momoshiki', [
  {
    id: 'fused', displayName: 'Fused Momoshiki',
    activationRequirement: { awakening: 80, chakra: 30 },
    awakeningCost: 80, chakraCost: 30, duration: 20, chakraDrain: 1.4,
    statModifiers: { attack: 1.52, defense: 1.34, speed: 1.24, guard: 1.4, chakraRegen: 1.7 },
    abilityOverrides: { 0: 'momoshiki_shadow_possession', 2: 'momoshiki_fused_crush' },
    ultimateOverride: 'momoshiki_fused_ultimate',
    auraColor: '#ff5aa0', auraEffect: 'aura_otsutsuki',
    description: 'Consumes Kinshiki and takes his true form.',
  },
]);

export const MINATO_CHAIN = chain('minato', [
  {
    id: 'kcm', displayName: 'Kurama Chakra Mode',
    activationRequirement: { awakening: 70, chakra: 30 },
    awakeningCost: 70, chakraCost: 30, duration: 20, chakraDrain: 1.2,
    statModifiers: { attack: 1.34, defense: 1.16, speed: 1.36, chakraRegen: 1.6 },
    abilityOverrides: { 1: 'minato_kcm_barrage', 2: 'minato_raijin_lv2' },
    ultimateOverride: 'minato_reaper_death_seal',
    unlockRequirement: { type: 'mastery', value: 2 },
    auraColor: '#ffd75a', auraEffect: 'aura_kcm',
    description: 'Half of Kurama’s chakra. The fastest form in the game.',
  },
]);

export const HASHIRAMA_CHAIN = chain('hashirama', [
  {
    id: 'sage', displayName: 'Sage Mode',
    activationRequirement: { awakening: 60, chakra: 25 },
    awakeningCost: 60, chakraCost: 25, duration: 24,
    statModifiers: { attack: 1.28, defense: 1.30, speed: 1.06, guard: 1.3, chakraRegen: 1.5 },
    abilityOverrides: { 2: 'hashirama_sage_regeneration' },
    auraColor: '#a8e07a', auraEffect: 'aura_sage',
    description: 'Senju sage chakra. Enormous sustain.',
  },
  {
    id: 'thousand_hands', displayName: 'True Several Thousand Hands',
    activationRequirement: { awakening: 100, chakra: 50 },
    awakeningCost: 100, chakraCost: 50, duration: 16, chakraDrain: 2.2,
    statModifiers: { attack: 1.58, defense: 1.52, speed: 0.98, guard: 1.7, chakraRegen: 1.6 },
    abilityOverrides: { 2: 'hashirama_sage_regeneration' },
    ultimateOverride: 'hashirama_thousand_hands',
    unlockRequirement: { type: 'mastery', value: 4 },
    auraColor: '#d0f0a0', auraEffect: 'aura_sage',
    description: 'The wood titan rises.',
  },
]);

export const BEE_CHAIN = chain('bee', [
  {
    id: 'v1', displayName: 'Version One Cloak',
    activationRequirement: { awakening: 45 }, awakeningCost: 45, duration: 22,
    statModifiers: { attack: 1.18, defense: 1.14, speed: 1.20, chakraRegen: 1.3 },
    auraColor: '#c8b0ff', auraEffect: 'aura_cloak',
    description: '',
  },
  {
    id: 'v2', displayName: 'Version Two Cloak',
    activationRequirement: { awakening: 72, chakra: 25 },
    awakeningCost: 72, chakraCost: 25, duration: 19, chakraDrain: 1.2,
    statModifiers: { attack: 1.36, defense: 1.26, speed: 1.24, chakraRegen: 1.4 },
    abilityOverrides: { 2: 'bee_full_gyuki_slam' },
    auraColor: '#8a6ad8', auraEffect: 'aura_cloak',
    description: '',
  },
  {
    id: 'full_gyuki', displayName: 'Full Gyuki',
    activationRequirement: { awakening: 100, chakra: 45 },
    awakeningCost: 100, chakraCost: 45, duration: 16, chakraDrain: 2.4,
    statModifiers: { attack: 1.60, defense: 1.50, speed: 1.02, guard: 1.6, chakraRegen: 1.7 },
    abilityOverrides: { 0: 'bee_full_gyuki_slam', 2: 'bee_full_gyuki_slam' },
    unlockRequirement: { type: 'mastery', value: 3 },
    auraColor: '#6a5ab0', auraEffect: 'aura_beast',
    description: 'Full Eight-Tails transformation.',
  },
]);

export const JIRAIYA_CHAIN = chain('jiraiya', [
  {
    id: 'sage', displayName: 'Imperfect Sage Mode',
    activationRequirement: { awakening: 60, chakra: 25 },
    awakeningCost: 60, chakraCost: 25, duration: 20, chakraDrain: 0.8,
    statModifiers: { attack: 1.30, defense: 1.22, speed: 1.06, guard: 1.2, chakraRegen: 1.4 },
    abilityOverrides: { 0: 'jiraiya_sage_rasengan', 2: 'jiraiya_frog_song' },
    auraColor: '#f2c46a', auraEffect: 'aura_sage',
    description: 'Not quite perfect — but it adds Frog Song and the Big Ball Rasengan.',
  },
]);

export const OROCHIMARU_CHAIN = chain('orochimaru', [
  {
    id: 'serpent', displayName: 'White Serpent Form',
    activationRequirement: { awakening: 55 }, awakeningCost: 55, duration: 20,
    statModifiers: { attack: 1.22, defense: 1.26, speed: 1.10, chakraRegen: 1.3 },
    abilityOverrides: { 2: 'orochimaru_edo_tensei' },
    auraColor: '#c8e0a0', auraEffect: 'aura_snake',
    description: '',
  },
  {
    id: 'eight_headed', displayName: 'Eight-Headed Serpent',
    activationRequirement: { awakening: 100, chakra: 45 },
    awakeningCost: 100, chakraCost: 45, duration: 16, chakraDrain: 2.0,
    statModifiers: { attack: 1.54, defense: 1.44, speed: 0.98, guard: 1.5, chakraRegen: 1.6 },
    abilityOverrides: { 0: 'orochimaru_edo_tensei' },
    unlockRequirement: { type: 'mastery', value: 3 },
    auraColor: '#9ac070', auraEffect: 'aura_snake',
    description: 'Yamata no Orochi.',
  },
]);

/* ========================================================================== */
/* Prototype-fighter forms                                                    */
/* ========================================================================== */

export const KABUTO_CHAIN = chain('kabuto', [
  {
    id: 'sage', displayName: 'Sage Kabuto',
    activationRequirement: { awakening: 70, chakra: 30 },
    awakeningCost: 70, chakraCost: 30, duration: 20, chakraDrain: 1.2,
    statModifiers: { attack: 1.40, defense: 1.32, speed: 1.16, chakraRegen: 1.6 },
    auraColor: '#c8e0a0', auraEffect: 'aura_snake',
    description: 'Snake Sage Mode. [Prototype ability set]',
  },
]);

export const MITSUKI_CHAIN = chain('mitsuki', [
  {
    id: 'sage_transformation', displayName: 'Sage Transformation',
    activationRequirement: { awakening: 65, healthBelow: 0.7 },
    awakeningCost: 65, duration: 18, healthDrain: 1.0,
    statModifiers: { attack: 1.44, defense: 1.14, speed: 1.26, chakraRegen: 1.4 },
    auraColor: '#8ad8ff', auraEffect: 'aura_snake',
    description: 'Sage Transformation. [Prototype ability set]',
  },
]);

/** Generic single-stage awakening for prototype fighters. */
export function genericAwakening(fighterId, opts = {}) {
  return chain(fighterId, [{
    id: 'awakening',
    displayName: opts.displayName || 'Awakening',
    activationRequirement: { awakening: opts.awakening ?? 70, chakra: opts.chakra ?? 20 },
    awakeningCost: opts.awakening ?? 70,
    chakraCost: opts.chakra ?? 20,
    duration: opts.duration ?? 18,
    statModifiers: opts.statModifiers || { attack: 1.28, defense: 1.18, speed: 1.12, chakraRegen: 1.4 },
    auraColor: opts.auraColor || '#7fd4ff',
    auraEffect: 'aura_default',
    description: `${opts.description || 'Generic awakening.'} [Prototype template]`,
  }]);
}

export function transformationCount() {
  return Object.keys(TRANSFORMATIONS).length;
}
