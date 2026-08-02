/**
 * Hand-authored signature kits — part B (Kawaki, Momoshiki, Minato, Hashirama,
 * Might Guy, Killer Bee, Obito, Jiraiya, Orochimaru, Tsunade).
 *
 * Same rules as part A: every number below is individually authored.
 */

import { mk, projectile } from './ability-schema.js';
import { fighterKit } from './abilities-signature-a.js';

/* ========================================================================== */
/* KAWAKI — heavy hitting body-modification bruiser with absorb tools         */
/* ========================================================================== */

export const KAWAKI_KIT = fighterKit('kawaki', {
  basics: [
    { displayName: 'Blade Arm Slash', damage: 30, startup: 0.07, activeFrames: 0.05, recovery: 0.16, range: 110, hitStun: 0.26, knockbackX: 85, guardDamage: 7, effectId: 'karma_glow' },
    { displayName: 'Hammer Arm', damage: 33, startup: 0.085, activeFrames: 0.06, recovery: 0.18, range: 104, hitStun: 0.27, knockbackX: 110, guardDamage: 8, effectId: 'karma_glow' },
    { displayName: 'Spike Kick', damage: 35, startup: 0.10, activeFrames: 0.06, recovery: 0.21, range: 112, hitStun: 0.30, knockbackX: 140, guardDamage: 8 },
    { displayName: 'Body Blade Finish', damage: 58, startup: 0.145, activeFrames: 0.08, recovery: 0.33, range: 124, hitStun: 0.44, knockbackX: 430, guardDamage: 16, wallBounce: true, soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Blade', damage: 31, startup: 0.08, activeFrames: 0.06, recovery: 0.17, range: 106, hitStun: 0.29, knockbackX: 88, knockbackY: -60, effectId: 'karma_glow' },
    { displayName: 'Anchor Drop', damage: 56, startup: 0.12, activeFrames: 0.08, recovery: 0.26, range: 104, hitStun: 0.5, knockbackX: 150, knockbackY: 460, groundBounce: true, soundId: 'sfx_hit_heavy' },
  ],
  heavy: { displayName: 'Piston Punch', damage: 76, guardDamage: 30, startup: 0.215, activeFrames: 0.09, recovery: 0.38, range: 124, hitStun: 0.5, knockbackX: 500, wallBounce: true, armor: 2, effectId: 'karma_glow' },
  launcher: { displayName: 'Rising Blade', damage: 40, guardDamage: 13, startup: 0.14, activeFrames: 0.08, recovery: 0.32, range: 108, hitStun: 0.58, knockbackY: -730, rise: 210 },
  dash: { displayName: 'Piston Charge', damage: 47, guardDamage: 17, startup: 0.095, activeFrames: 0.10, recovery: 0.29, range: 116, advance: 700, hitStun: 0.36, knockbackX: 290, armor: 1 },
  throw: { displayName: 'Karma Slam', damage: 72, startup: 0.09, activeFrames: 0.08, recovery: 0.44, range: 92, hitStun: 0.74, knockbackX: 240, knockbackY: 400, groundBounce: true, effectId: 'karma_glow' },
  gc: { displayName: 'Blade Guard Cut', damage: 46, guardDamage: 32, chakraCost: 18, startup: 0.04, activeFrames: 0.10, recovery: 0.28, range: 124, hitStun: 0.48, knockbackX: 330 },
  jutsu: {
    body_blade: {
      displayName: 'Body Blade', category: 'melee-jutsu', chakraCost: 22, cooldown: 4.0,
      damage: 92, guardDamage: 34, startup: 0.16, activeFrames: 0.14, recovery: 0.36,
      range: 200, hitStun: 0.55, knockbackX: 480, wallBounce: true,
      effectId: 'karma_glow', soundId: 'sfx_jutsu_melee',
      description: 'Extends the arm into a long blade. Very good poke range.',
    },
    chakra_blast: {
      displayName: 'Chakra Blast', category: 'ranged-jutsu', chakraCost: 24, cooldown: 5.0,
      damage: 74, guardDamage: 30, startup: 0.20, activeFrames: 0.10, recovery: 0.36, hitStun: 0.44,
      projectile: projectile({ shape: 'beam', color: '#3a1a5a', color2: '#c78cff', speed: 1000, life: 0.9, radius: 40, pierce: 2, destroyOnHit: false }),
      effectId: 'karma_beam', soundId: 'sfx_jutsu_ranged',
      description: 'Fires stored chakra as a piercing beam.',
    },
    karma_absorb: {
      displayName: 'Karma Absorption', category: 'counter', chakraCost: 10, cooldown: 8.0,
      damage: 0, guardDamage: 0, startup: 0.04, activeFrames: 0.28, recovery: 0.32, range: 130,
      statusEffects: [{ id: 'absorb', duration: 0.30, magnitude: 1.4 }],
      effectId: 'karma_glow', soundId: 'sfx_absorb',
      description: 'Longer absorb window than Boruto’s and refunds more chakra.',
    },
  },
  ultimate: {
    displayName: 'Karma Cannon', chakraCost: 60, cooldown: 20,
    damage: 280, guardDamage: 84, startup: 0.30, activeFrames: 0.30, recovery: 0.82,
    range: 620, hits: 5, hitInterval: 0.07, hitStun: 1.0, knockbackX: 780, knockbackY: -240,
    wallBounce: true, requirements: { chakra: 60 }, effectId: 'karma_beam',
    description: 'Converts absorbed chakra into a full-screen cannon blast.',
  },
});

mk('kawaki_scientific_tools', {
  displayName: 'Scientific Ninja Tool Barrage', category: 'ranged-jutsu', chakraCost: 26, cooldown: 6.0,
  damage: 30, guardDamage: 12, startup: 0.18, activeFrames: 0.08, recovery: 0.34, hitStun: 0.24,
  projectile: projectile({ shape: 'shard', color: '#8ad4ff', speed: 900, life: 1.2, radius: 14, count: 5, spread: 0.08, interval: 0.05, homing: 0.2 }),
  effectId: 'tool_spark', soundId: 'sfx_jutsu_ranged',
  description: 'Fires a spread of stored ninja tools.',
});
mk('kawaki_isshiki_rods', {
  displayName: 'Shrinking Rod Barrage', category: 'ranged-jutsu', chakraCost: 30, cooldown: 6.5,
  damage: 84, guardDamage: 40, startup: 0.14, activeFrames: 0.10, recovery: 0.30, hitStun: 0.5,
  projectile: projectile({ shape: 'shard', color: '#d8c05a', color2: '#fff2c0', speed: 1300, life: 1.0, radius: 18, count: 3, spread: 0.14, interval: 0.06, pierce: 2, destroyOnHit: false }),
  unblockable: true, effectId: 'rod_spark', soundId: 'sfx_jutsu_ranged',
  description: 'Isshiki’s rods materialise at full size mid-flight. Unblockable.',
});
mk('kawaki_isshiki_ultimate', {
  displayName: 'Sukunahikona Crush', category: 'ultimate', chakraCost: 68, cooldown: 24,
  damage: 344, guardDamage: 100, startup: 0.28, activeFrames: 0.30, recovery: 0.92,
  range: 260, hits: 6, hitInterval: 0.07, hitStun: 1.1, knockbackX: 640, knockbackY: 520,
  groundBounce: true, unblockable: true, cutIn: true, slowMoFinish: true,
  soundId: 'sfx_ultimate', effectId: 'karma_rift', invulnerability: { start: 0, end: 0.28 },
  description: 'Shrinks the arena around the opponent and restores it on top of them.',
});

/* ========================================================================== */
/* MOMOSHIKI OTSUTSUKI — absorbs and returns your own jutsu, amplified        */
/* ========================================================================== */

export const MOMOSHIKI_KIT = fighterKit('momoshiki', {
  basics: [
    { displayName: 'Palm Sweep', damage: 29, startup: 0.07, activeFrames: 0.05, recovery: 0.16, range: 104, hitStun: 0.26, knockbackX: 80, guardDamage: 6, effectId: 'rinnegan_swap' },
    { displayName: 'Rotating Palm', damage: 31, startup: 0.08, activeFrames: 0.05, recovery: 0.17, range: 108, hitStun: 0.27, knockbackX: 100, guardDamage: 7 },
    { displayName: 'Gravity Sweep', damage: 34, startup: 0.10, activeFrames: 0.06, recovery: 0.20, range: 130, hitStun: 0.30, knockbackX: 120, guardDamage: 8 },
    { displayName: 'Otsutsuki Repel', damage: 54, startup: 0.14, activeFrames: 0.08, recovery: 0.32, range: 140, hitStun: 0.42, knockbackX: 460, guardDamage: 14, wallBounce: true, soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Palm', damage: 30, startup: 0.075, activeFrames: 0.05, recovery: 0.16, range: 100, hitStun: 0.29, knockbackX: 85, knockbackY: -60 },
    { displayName: 'Gravity Spike', damage: 52, startup: 0.11, activeFrames: 0.08, recovery: 0.25, range: 104, hitStun: 0.48, knockbackX: 160, knockbackY: 440, groundBounce: true },
  ],
  heavy: { displayName: 'Amplified Palm', damage: 70, guardDamage: 30, startup: 0.20, activeFrames: 0.09, recovery: 0.38, range: 150, hitStun: 0.48, knockbackX: 470, wallBounce: true, armor: 1, effectId: 'karma_glow' },
  launcher: { displayName: 'Anti-Gravity Lift', damage: 39, guardDamage: 12, startup: 0.135, activeFrames: 0.08, recovery: 0.32, range: 150, hitStun: 0.58, knockbackY: -770 },
  dash: { displayName: 'Levitation Rush', damage: 44, guardDamage: 15, startup: 0.09, activeFrames: 0.10, recovery: 0.28, range: 118, advance: 760, hitStun: 0.35, knockbackX: 260 },
  throw: { displayName: 'Chakra Fruit Grip', damage: 66, startup: 0.09, activeFrames: 0.08, recovery: 0.42, range: 92, hitStun: 0.75, knockbackX: 300, knockbackY: -260, statusEffects: [{ id: 'chakra_drain', duration: 0, magnitude: 30 }], effectId: 'karma_glow' },
  gc: { displayName: 'Rinnegan Deflect', damage: 44, guardDamage: 30, chakraCost: 16, startup: 0.03, activeFrames: 0.12, recovery: 0.26, range: 130, hitStun: 0.5, knockbackX: 380, effectId: 'rinnegan_swap' },
  jutsu: {
    chakra_absorption: {
      displayName: 'Chakra Absorption', category: 'counter', chakraCost: 8, cooldown: 7.0,
      damage: 0, guardDamage: 0, startup: 0.03, activeFrames: 0.30, recovery: 0.30, range: 150,
      statusEffects: [{ id: 'absorb', duration: 0.32, magnitude: 1.8 }, { id: 'store_jutsu', duration: 12, magnitude: 1 }],
      effectId: 'rinnegan_absorb', soundId: 'sfx_absorb',
      description: 'Absorbs the jutsu AND stores it — your next ranged attack is amplified.',
    },
    crimson_rasengan: {
      displayName: 'Crimson Rasengan', category: 'melee-jutsu', chakraCost: 28, cooldown: 5.0,
      damage: 100, guardDamage: 36, startup: 0.19, activeFrames: 0.13, recovery: 0.38,
      range: 150, advance: 520, hitStun: 0.64, knockbackX: 620, wallBounce: true,
      effectId: 'rasengan_crimson', soundId: 'sfx_jutsu_melee',
      description: 'A stolen Rasengan returned at Otsutsuki scale.',
    },
    elemental_barrage: {
      displayName: 'Amplified Elemental Barrage', category: 'ranged-jutsu', chakraCost: 32, cooldown: 7.0,
      damage: 46, guardDamage: 20, startup: 0.22, activeFrames: 0.10, recovery: 0.40, hitStun: 0.30,
      projectile: projectile({ shape: 'orb', color: '#ff5aa0', color2: '#ffe0f0', speed: 740, life: 1.5, radius: 30, count: 4, spread: 0.16, interval: 0.07, homing: 0.28, explodeRadius: 110 }),
      effectId: 'elemental_orbs', soundId: 'sfx_jutsu_ranged',
      description: 'Four elemental spheres. Damage is boosted if a jutsu is stored.',
    },
  },
  ultimate: {
    displayName: 'Amplified Jutsu Return', chakraCost: 60, cooldown: 21,
    damage: 292, guardDamage: 90, startup: 0.32, activeFrames: 0.30, recovery: 0.86,
    range: 560, hits: 6, hitInterval: 0.07, hitStun: 1.05, knockbackX: 700, knockbackY: -300,
    wallBounce: true, requirements: { chakra: 60 }, effectId: 'elemental_orbs',
    description: 'Everything Momoshiki has absorbed comes back at once.',
  },
});

mk('momoshiki_shadow_possession', {
  displayName: 'Shadow Possession Trap', category: 'area-jutsu', chakraCost: 26, cooldown: 9,
  damage: 44, guardDamage: 24, startup: 0.22, activeFrames: 0.14, recovery: 0.42,
  range: 380, area: 200, tracking: 1, hitStun: 1.2, knockbackX: 0,
  statusEffects: [{ id: 'pin', duration: 1.3, magnitude: 1 }],
  effectId: 'shadow_bind', soundId: 'sfx_jutsu_area',
  description: 'A stolen shadow technique that roots the opponent in place.',
});
mk('momoshiki_fused_crush', {
  displayName: 'Fused Form: Gravity Crush', category: 'area-jutsu', chakraCost: 34, cooldown: 8,
  damage: 118, guardDamage: 48, startup: 0.26, activeFrames: 0.18, recovery: 0.46,
  range: 420, area: 300, hitStun: 0.7, knockbackX: 300, knockbackY: 560, groundBounce: true,
  effectId: 'gravity_crush', soundId: 'sfx_jutsu_area',
  description: 'Slams the arena gravity down onto the opponent.',
});
mk('momoshiki_fused_ultimate', {
  displayName: 'Fused Momoshiki: Chakra Fruit', category: 'ultimate', chakraCost: 68, cooldown: 24,
  damage: 348, guardDamage: 104, startup: 0.34, activeFrames: 0.34, recovery: 0.94,
  range: 700, hits: 7, hitInterval: 0.07, hitStun: 1.1, knockbackX: 760, knockbackY: -360,
  wallBounce: true, cutIn: true, slowMoFinish: true, soundId: 'sfx_ultimate',
  effectId: 'gravity_crush', invulnerability: { start: 0, end: 0.34 },
  statusEffects: [{ id: 'lifesteal', duration: 0, magnitude: 0.3 }],
  description: 'Drains the arena itself. Heals for 30% of the damage dealt.',
});

/* ========================================================================== */
/* MINATO NAMIKAZE — teleport counter fighter, fastest movement in the game   */
/* ========================================================================== */

export const MINATO_KIT = fighterKit('minato', {
  basics: [
    { displayName: 'Kunai Flash', damage: 24, startup: 0.045, activeFrames: 0.04, recovery: 0.12, range: 90, hitStun: 0.24, knockbackX: 60, guardDamage: 5, effectId: 'blade_arc' },
    { displayName: 'Flicker Cut', damage: 26, startup: 0.055, activeFrames: 0.04, recovery: 0.13, range: 94, hitStun: 0.25, knockbackX: 78, guardDamage: 5, effectId: 'flash_step' },
    { displayName: 'Cross Slash', damage: 29, startup: 0.07, activeFrames: 0.05, recovery: 0.15, range: 98, hitStun: 0.27, knockbackX: 100, guardDamage: 6, effectId: 'blade_arc' },
    { displayName: 'Yellow Flash Finish', damage: 48, startup: 0.11, activeFrames: 0.07, recovery: 0.27, range: 104, hitStun: 0.40, knockbackX: 340, guardDamage: 11, effectId: 'flash_step', soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Kunai', damage: 26, startup: 0.055, activeFrames: 0.05, recovery: 0.13, range: 92, hitStun: 0.28, knockbackX: 75, knockbackY: -70, effectId: 'blade_arc' },
    { displayName: 'Flash Dive', damage: 46, startup: 0.09, activeFrames: 0.07, recovery: 0.21, range: 96, hitStun: 0.44, knockbackX: 170, knockbackY: 380, groundBounce: true, effectId: 'flash_step' },
  ],
  heavy: { displayName: 'Rasengan Palm', damage: 66, guardDamage: 24, startup: 0.175, activeFrames: 0.08, recovery: 0.34, range: 116, hitStun: 0.46, knockbackX: 460, wallBounce: true, effectId: 'rasengan' },
  launcher: { displayName: 'Flash Uppercut', damage: 36, guardDamage: 10, startup: 0.105, activeFrames: 0.08, recovery: 0.28, range: 96, hitStun: 0.58, knockbackY: -790, rise: 280, effectId: 'flash_step' },
  dash: { displayName: 'Raijin Step Cut', damage: 42, guardDamage: 13, startup: 0.055, activeFrames: 0.09, recovery: 0.24, range: 104, advance: 1050, hitStun: 0.34, knockbackX: 230, effectId: 'flash_step' },
  throw: { displayName: 'Teleport Slam', damage: 62, startup: 0.075, activeFrames: 0.08, recovery: 0.38, range: 88, hitStun: 0.7, knockbackX: 200, knockbackY: 420, groundBounce: true, effectId: 'flash_step' },
  gc: { displayName: 'Raijin Counter', damage: 46, guardDamage: 28, chakraCost: 16, startup: 0.02, activeFrames: 0.10, recovery: 0.24, range: 120, hitStun: 0.5, knockbackX: 340, invulnerability: { start: 0, end: 0.20 }, effectId: 'flash_step' },
  jutsu: {
    marked_kunai: {
      displayName: 'Marked Kunai', category: 'ranged-jutsu', chakraCost: 12, cooldown: 2.4,
      damage: 34, guardDamage: 12, startup: 0.11, activeFrames: 0.06, recovery: 0.22, hitStun: 0.28,
      projectile: projectile({ shape: 'shard', color: '#ffe58a', speed: 1150, life: 1.4, radius: 12, count: 2, spread: 0.06, interval: 0.05 }),
      statusEffects: [{ id: 'mark', duration: 10, magnitude: 1 }],
      effectId: 'blade_arc', soundId: 'sfx_jutsu_ranged',
      description: 'Marks the opponent for 10 seconds, enabling Flying Raijin.',
    },
    flying_raijin: {
      displayName: 'Flying Raijin', category: 'melee-jutsu', chakraCost: 20, cooldown: 3.0,
      damage: 78, guardDamage: 26, startup: 0.06, activeFrames: 0.10, recovery: 0.30,
      range: 120, hitStun: 0.5, knockbackX: 400, tracking: 1,
      invulnerability: { start: 0, end: 0.06 },
      statusEffects: [{ id: 'teleport_to_target', duration: 0, magnitude: 1 }],
      requirements: { status: 'mark' },
      effectId: 'flash_step', soundId: 'sfx_teleport',
      description: 'Teleports to the marked opponent instantly. Requires an active mark.',
    },
    rasengan: {
      displayName: 'Rasengan', category: 'melee-jutsu', chakraCost: 24, cooldown: 4.4,
      damage: 86, guardDamage: 30, startup: 0.18, activeFrames: 0.12, recovery: 0.38,
      range: 128, advance: 480, hitStun: 0.6, knockbackX: 600, wallBounce: true,
      effectId: 'rasengan', soundId: 'sfx_jutsu_melee',
      description: 'The original. Slightly faster start-up than Naruto’s.',
    },
  },
  ultimate: {
    displayName: 'Flying Raijin: Guillotine Drop', chakraCost: 60, cooldown: 19,
    damage: 262, guardDamage: 76, startup: 0.18, activeFrames: 0.30, recovery: 0.78,
    range: 900, hits: 7, hitInterval: 0.055, hitStun: 1.0, knockbackX: 200, knockbackY: 620,
    groundBounce: true, tracking: 1, requirements: { chakra: 60 }, effectId: 'flash_step',
    description: 'Teleports across the arena striking from every angle before the drop.',
  },
});

mk('minato_raijin_lv2', {
  displayName: 'Flying Raijin Level Two', category: 'area-jutsu', chakraCost: 30, cooldown: 8,
  damage: 96, guardDamage: 38, startup: 0.10, activeFrames: 0.20, recovery: 0.38,
  range: 260, area: 260, hits: 4, hitInterval: 0.05, hitStun: 0.5, knockbackX: 320,
  invulnerability: { start: 0, end: 0.20 },
  effectId: 'flash_step', soundId: 'sfx_teleport',
  description: 'Blinks around the opponent striking from all sides. Invulnerable throughout.',
});
mk('minato_reaper_death_seal', {
  displayName: 'Reaper Death Seal', category: 'ultimate', chakraCost: 70, cooldown: 26,
  damage: 300, guardDamage: 110, startup: 0.34, activeFrames: 0.26, recovery: 1.1,
  range: 200, hits: 2, hitInterval: 0.14, hitStun: 1.4, knockbackX: 260,
  unblockable: true, cutIn: true, slowMoFinish: true, soundId: 'sfx_ultimate',
  effectId: 'reaper_seal', invulnerability: { start: 0, end: 0.34 },
  statusEffects: [{ id: 'recoil', duration: 0, magnitude: 90 }, { id: 'chakra_drain', duration: 0, magnitude: 100 }],
  description: 'Seals the opponent’s chakra completely — at the cost of 90 of your own health.',
});
mk('minato_kcm_barrage', {
  displayName: 'Kurama Mode: Raijin Barrage', category: 'melee-jutsu', chakraCost: 24, cooldown: 4.0,
  damage: 104, guardDamage: 40, startup: 0.06, activeFrames: 0.14, recovery: 0.26,
  range: 160, hits: 3, hitInterval: 0.05, hitStun: 0.52, knockbackX: 420, tracking: 1,
  effectId: 'kurama_flash', soundId: 'sfx_jutsu_melee',
  description: 'Chakra-cloak enhanced teleport strikes.',
});

/* ========================================================================== */
/* HASHIRAMA SENJU — terrain control, sustain, giant wood constructs          */
/* ========================================================================== */

export const HASHIRAMA_KIT = fighterKit('hashirama', {
  basics: [
    { displayName: 'Wood Palm', damage: 30, startup: 0.08, activeFrames: 0.06, recovery: 0.17, range: 116, hitStun: 0.26, knockbackX: 85, guardDamage: 7, effectId: 'wood_spikes' },
    { displayName: 'Branch Sweep', damage: 33, startup: 0.09, activeFrames: 0.06, recovery: 0.19, range: 128, hitStun: 0.28, knockbackX: 110, guardDamage: 8, effectId: 'wood_spikes' },
    { displayName: 'Root Grip', damage: 35, startup: 0.11, activeFrames: 0.07, recovery: 0.22, range: 136, hitStun: 0.32, knockbackX: 120, guardDamage: 8, effectId: 'wood_spikes' },
    { displayName: 'Great Wood Fist', damage: 62, startup: 0.16, activeFrames: 0.08, recovery: 0.34, range: 150, hitStun: 0.46, knockbackX: 470, guardDamage: 18, wallBounce: true, effectId: 'wood_spikes', soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Branch', damage: 31, startup: 0.09, activeFrames: 0.06, recovery: 0.18, range: 118, hitStun: 0.30, knockbackX: 88, knockbackY: -60, effectId: 'wood_spikes' },
    { displayName: 'Wood Pillar Drop', damage: 58, startup: 0.13, activeFrames: 0.08, recovery: 0.27, range: 116, hitStun: 0.5, knockbackX: 150, knockbackY: 460, groundBounce: true, effectId: 'wood_spikes' },
  ],
  heavy: { displayName: 'Wood Golem Fist', damage: 78, guardDamage: 34, startup: 0.235, activeFrames: 0.10, recovery: 0.42, range: 190, hitStun: 0.52, knockbackX: 540, wallBounce: true, armor: 3, effectId: 'wood_spikes' },
  launcher: { displayName: 'Rising Roots', damage: 42, guardDamage: 14, startup: 0.16, activeFrames: 0.09, recovery: 0.34, range: 150, hitStun: 0.58, knockbackY: -700, effectId: 'wood_spikes' },
  dash: { displayName: 'Root Surge', damage: 46, guardDamage: 17, startup: 0.11, activeFrames: 0.10, recovery: 0.30, range: 140, advance: 560, hitStun: 0.36, knockbackX: 280, armor: 1, effectId: 'wood_spikes' },
  throw: { displayName: 'Binding Roots', damage: 66, startup: 0.10, activeFrames: 0.09, recovery: 0.44, range: 110, hitStun: 0.78, knockbackX: 260, knockbackY: -180, statusEffects: [{ id: 'chakra_drain', duration: 0, magnitude: 20 }], effectId: 'wood_spikes' },
  gc: { displayName: 'Wood Wall Counter', damage: 44, guardDamage: 32, chakraCost: 16, startup: 0.04, activeFrames: 0.12, recovery: 0.30, range: 140, hitStun: 0.48, knockbackX: 360, effectId: 'wood_spikes' },
  jutsu: {
    wood_dragon: {
      displayName: 'Wood Style: Wood Dragon', category: 'ranged-jutsu', chakraCost: 30, cooldown: 7.0,
      damage: 92, guardDamage: 38, startup: 0.30, activeFrames: 0.16, recovery: 0.48, hitStun: 0.55,
      projectile: projectile({ shape: 'wave', color: '#5f8a4a', color2: '#c8e6a0', speed: 600, life: 2.0, radius: 60, homing: 0.4, pierce: 2, destroyOnHit: false }),
      statusEffects: [{ id: 'chakra_drain', duration: 0, magnitude: 24 }],
      effectId: 'wood_spikes', soundId: 'sfx_jutsu_ranged',
      description: 'A homing wooden dragon that saps chakra on contact.',
    },
    deep_forest: {
      displayName: 'Deep Forest Emergence', category: 'area-jutsu', chakraCost: 34, cooldown: 10,
      damage: 84, guardDamage: 40, startup: 0.30, activeFrames: 0.20, recovery: 0.50,
      range: 520, area: 420, hitStun: 0.6, knockbackX: 200, knockbackY: -480, launch: true,
      effectId: 'wood_forest', soundId: 'sfx_jutsu_area',
      description: 'A forest erupts across most of the arena, launching anyone caught.',
    },
    wood_clone: {
      displayName: 'Wood Clone', category: 'summon', chakraCost: 22, cooldown: 8.0,
      damage: 42, guardDamage: 18, startup: 0.18, activeFrames: 0.12, recovery: 0.30,
      range: 220, hits: 2, hitInterval: 0.10, hitStun: 0.3, knockbackX: 150,
      statusEffects: [{ id: 'clone_guard', duration: 6, magnitude: 2 }],
      effectId: 'wood_spikes', soundId: 'sfx_summon',
      description: 'A durable wood clone that absorbs two hits for you.',
    },
  },
  ultimate: {
    displayName: 'Gate of the Great God', chakraCost: 60, cooldown: 22,
    damage: 298, guardDamage: 92, startup: 0.40, activeFrames: 0.32, recovery: 0.92,
    range: 560, hits: 5, hitInterval: 0.09, hitStun: 1.05, knockbackX: 400, knockbackY: 580,
    groundBounce: true, requirements: { chakra: 60 }, effectId: 'wood_forest',
    description: 'A titanic wooden gate crashes down across the whole arena.',
  },
});

mk('hashirama_sage_regeneration', {
  displayName: 'Sage Art: Regeneration', category: 'healing', chakraCost: 26, cooldown: 14,
  damage: 0, guardDamage: 0, startup: 0.16, activeFrames: 0, recovery: 0.28, range: 0,
  statusEffects: [{ id: 'regen', duration: 8, magnitude: 30 }, { id: 'armor', duration: 8, magnitude: 1 }],
  effectId: 'sage_impact', soundId: 'sfx_heal',
  description: 'Sage Mode regeneration with light armour while it lasts.',
});
mk('hashirama_thousand_hands', {
  displayName: 'True Several Thousand Hands', category: 'ultimate', chakraCost: 68, cooldown: 25,
  damage: 356, guardDamage: 110, startup: 0.42, activeFrames: 0.40, recovery: 1.0,
  range: 900, hits: 12, hitInterval: 0.05, hitStun: 1.15, knockbackX: 700, knockbackY: -300,
  wallBounce: true, cutIn: true, slowMoFinish: true, soundId: 'sfx_ultimate',
  effectId: 'wood_forest', invulnerability: { start: 0, end: 0.42 },
  description: 'The Sage Mode wood titan strikes a thousand times.',
});

/* ========================================================================== */
/* MIGHT GUY — gate stacking, enormous risk, enormous reward                  */
/* ========================================================================== */

export const GUY_KIT = fighterKit('guy', {
  basics: [
    { displayName: 'Straight Punch', damage: 26, startup: 0.055, activeFrames: 0.04, recovery: 0.125, range: 88, hitStun: 0.24, knockbackX: 70, guardDamage: 6 },
    { displayName: 'Body Hook', damage: 28, startup: 0.065, activeFrames: 0.04, recovery: 0.135, range: 90, hitStun: 0.25, knockbackX: 85, guardDamage: 6 },
    { displayName: 'Roundhouse', damage: 32, startup: 0.08, activeFrames: 0.05, recovery: 0.17, range: 98, hitStun: 0.28, knockbackX: 110, guardDamage: 7 },
    { displayName: 'Dynamic Finish', damage: 54, startup: 0.115, activeFrames: 0.08, recovery: 0.28, range: 104, hitStun: 0.42, knockbackX: 380, guardDamage: 13, soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Heel', damage: 29, startup: 0.065, activeFrames: 0.05, recovery: 0.145, range: 90, hitStun: 0.30, knockbackX: 85, knockbackY: -75 },
    { displayName: 'Falling Hammer', damage: 56, startup: 0.10, activeFrames: 0.07, recovery: 0.23, range: 94, hitStun: 0.5, knockbackX: 140, knockbackY: 440, groundBounce: true, soundId: 'sfx_hit_heavy' },
  ],
  heavy: { displayName: 'Gate Charged Straight', damage: 74, guardDamage: 28, startup: 0.175, activeFrames: 0.09, recovery: 0.35, range: 112, hitStun: 0.48, knockbackX: 480, wallBounce: true, armor: 2, effectId: 'gate_aura' },
  launcher: { displayName: 'Rising Sun Kick', damage: 40, guardDamage: 12, startup: 0.115, activeFrames: 0.08, recovery: 0.29, range: 98, hitStun: 0.60, knockbackY: -800, rise: 300 },
  dash: { displayName: 'Dynamic Entry', damage: 48, guardDamage: 16, startup: 0.075, activeFrames: 0.10, recovery: 0.26, range: 106, advance: 980, hitStun: 0.36, knockbackX: 280 },
  throw: { displayName: 'Iron Fist Suplex', damage: 74, startup: 0.085, activeFrames: 0.08, recovery: 0.42, range: 88, hitStun: 0.74, knockbackX: 180, knockbackY: 460, groundBounce: true },
  gc: { displayName: 'Guarding Fist', damage: 46, guardDamage: 26, chakraCost: 14, startup: 0.035, activeFrames: 0.09, recovery: 0.24, range: 110, hitStun: 0.44, knockbackX: 320 },
  jutsu: {
    leaf_hurricane: {
      displayName: 'Leaf Strong Hurricane', category: 'melee-jutsu', chakraCost: 18, cooldown: 3.4,
      damage: 74, guardDamage: 30, startup: 0.13, activeFrames: 0.14, recovery: 0.30,
      range: 140, hits: 2, hitInterval: 0.06, hitStun: 0.45, knockbackX: 420, wallBounce: true,
      effectId: 'wind_slash', soundId: 'sfx_jutsu_melee',
      description: 'A kick so fast it fires a wind blade past its own reach.',
    },
    morning_peacock: {
      displayName: 'Morning Peacock', category: 'melee-jutsu', chakraCost: 30, cooldown: 8.0,
      damage: 152, guardDamage: 54, startup: 0.17, activeFrames: 0.28, recovery: 0.44,
      range: 136, hits: 8, hitInterval: 0.04, hitStun: 0.6, knockbackX: 220, knockbackY: -320,
      statusEffects: [{ id: 'recoil', duration: 0, magnitude: 24 }],
      effectId: 'fire_fists', soundId: 'sfx_jutsu_melee',
      description: 'Sixth Gate punches that ignite the air. Costs 24 health.',
    },
    evening_elephant: {
      displayName: 'Evening Elephant', category: 'melee-jutsu', chakraCost: 34, cooldown: 10,
      damage: 168, guardDamage: 66, startup: 0.24, activeFrames: 0.24, recovery: 0.54,
      range: 210, hits: 4, hitInterval: 0.08, hitStun: 0.8, knockbackX: 620, wallBounce: true, armor: 3,
      statusEffects: [{ id: 'recoil', duration: 0, magnitude: 36 }],
      effectId: 'gate_aura', soundId: 'sfx_jutsu_melee',
      description: 'Seventh Gate. Three hits of armour, enormous reach, 36 recoil.',
    },
  },
  ultimate: {
    displayName: 'Daytime Tiger', chakraCost: 60, cooldown: 21,
    damage: 316, guardDamage: 96, startup: 0.30, activeFrames: 0.24, recovery: 0.94,
    range: 560, hits: 2, hitInterval: 0.12, hitStun: 1.1, knockbackX: 820, knockbackY: -280,
    wallBounce: true, requirements: { chakra: 60 }, effectId: 'daytime_tiger',
    statusEffects: [{ id: 'recoil', duration: 0, magnitude: 55 }],
    description: 'A tiger-shaped air pressure blast. Costs 55 of your own health.',
  },
});

mk('guy_night_guy', {
  displayName: 'Night Guy', category: 'ultimate', chakraCost: 75, cooldown: 30,
  damage: 480, guardDamage: 150, startup: 0.36, activeFrames: 0.26, recovery: 1.4,
  range: 900, hits: 1, hitStun: 1.6, knockbackX: 1200, wallBounce: true,
  unblockable: true, cutIn: true, slowMoFinish: true, soundId: 'sfx_ultimate',
  effectId: 'night_guy', invulnerability: { start: 0, end: 0.36 },
  statusEffects: [{ id: 'recoil', duration: 0, magnitude: 200 }],
  requirements: { form: 'guy_gate8' },
  description: 'Eighth Gate. The single hardest hit in the game — and it may kill you.',
});

/* ========================================================================== */
/* KILLER BEE — unorthodox seven-sword rushdown, hard to predict              */
/* ========================================================================== */

export const BEE_KIT = fighterKit('bee', {
  basics: [
    { displayName: 'Wild Sword 1', damage: 27, startup: 0.06, activeFrames: 0.06, recovery: 0.14, range: 110, hitStun: 0.25, knockbackX: 75, guardDamage: 6, effectId: 'blade_arc' },
    { displayName: 'Wild Sword 2', damage: 29, startup: 0.075, activeFrames: 0.06, recovery: 0.15, range: 114, hitStun: 0.26, knockbackX: 90, guardDamage: 6, effectId: 'blade_arc' },
    { displayName: 'Spin Blades', damage: 34, startup: 0.09, activeFrames: 0.10, recovery: 0.20, range: 126, hitStun: 0.29, knockbackX: 110, guardDamage: 8, hits: 2, hitInterval: 0.05, effectId: 'blade_arc' },
    { displayName: 'Seven Sword Finish', damage: 56, startup: 0.13, activeFrames: 0.10, recovery: 0.31, range: 132, hitStun: 0.42, knockbackX: 400, guardDamage: 14, hits: 3, hitInterval: 0.045, effectId: 'blade_arc', soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Blade Spin', damage: 30, startup: 0.07, activeFrames: 0.08, recovery: 0.16, range: 110, hitStun: 0.29, knockbackX: 85, knockbackY: -60, hits: 2, hitInterval: 0.045, effectId: 'blade_arc' },
    { displayName: 'Blade Drop', damage: 52, startup: 0.11, activeFrames: 0.07, recovery: 0.24, range: 108, hitStun: 0.46, knockbackX: 160, knockbackY: 400, groundBounce: true, effectId: 'blade_arc' },
  ],
  heavy: { displayName: 'Lariat', damage: 76, guardDamage: 30, startup: 0.19, activeFrames: 0.09, recovery: 0.36, range: 120, hitStun: 0.5, knockbackX: 540, wallBounce: true, armor: 2 },
  launcher: { displayName: 'Acrobat Rise', damage: 39, guardDamage: 12, startup: 0.125, activeFrames: 0.09, recovery: 0.30, range: 116, hitStun: 0.58, knockbackY: -740, rise: 230, effectId: 'blade_arc' },
  dash: { displayName: 'Acrobat Rush', damage: 44, guardDamage: 15, startup: 0.08, activeFrames: 0.12, recovery: 0.26, range: 122, advance: 800, hitStun: 0.34, knockbackX: 250, hits: 2, hitInterval: 0.05, effectId: 'blade_arc' },
  throw: { displayName: 'Tentacle Slam', damage: 70, startup: 0.09, activeFrames: 0.09, recovery: 0.42, range: 100, hitStun: 0.74, knockbackX: 300, knockbackY: 400, groundBounce: true, effectId: 'beast_cloak' },
  gc: { displayName: 'Blade Wall', damage: 44, guardDamage: 30, chakraCost: 16, startup: 0.035, activeFrames: 0.12, recovery: 0.26, range: 126, hitStun: 0.46, knockbackX: 330, effectId: 'blade_arc' },
  jutsu: {
    acrobat: {
      displayName: 'Acrobat', category: 'melee-jutsu', chakraCost: 20, cooldown: 4.0,
      damage: 88, guardDamage: 34, startup: 0.12, activeFrames: 0.22, recovery: 0.34,
      range: 150, hits: 5, hitInterval: 0.045, hitStun: 0.5, knockbackX: 320, advance: 380,
      effectId: 'blade_arc', soundId: 'sfx_jutsu_melee',
      description: 'Unpredictable seven-sword flurry that walks forward as it hits.',
    },
    lightning_hop: {
      displayName: 'Lightning Release Armour', category: 'buff', chakraCost: 24, cooldown: 12,
      damage: 0, guardDamage: 0, startup: 0.14, activeFrames: 0, recovery: 0.22, range: 0,
      statusEffects: [{ id: 'speed_up', duration: 8, magnitude: 0.35 }, { id: 'attack_up', duration: 8, magnitude: 0.15 }],
      effectId: 'lightning_armour', soundId: 'sfx_charge',
      description: 'Raises movement speed and damage for eight seconds.',
    },
    gyuki_tentacle: {
      displayName: 'Gyuki Tentacle', category: 'ranged-jutsu', chakraCost: 26, cooldown: 6.0,
      damage: 82, guardDamage: 34, startup: 0.22, activeFrames: 0.16, recovery: 0.40, hitStun: 0.55,
      projectile: projectile({ shape: 'wave', color: '#5a4a8a', color2: '#c0a8ff', speed: 700, life: 1.4, radius: 46, pierce: 2, destroyOnHit: false }),
      effectId: 'beast_cloak', soundId: 'sfx_jutsu_ranged',
      description: 'A tentacle whips out to mid-screen and drags the opponent back.',
    },
  },
  ultimate: {
    displayName: 'Tailed Beast Bomb', chakraCost: 60, cooldown: 21,
    damage: 288, guardDamage: 88, startup: 0.36, activeFrames: 0.26, recovery: 0.88,
    range: 700, hits: 3, hitInterval: 0.10, hitStun: 1.05, knockbackX: 760, knockbackY: -320,
    wallBounce: true, requirements: { chakra: 60 }, effectId: 'beast_bomb',
    description: 'Gyuki charges and fires a compressed chakra sphere down the arena.',
  },
});

mk('bee_full_gyuki_slam', {
  displayName: 'Gyuki: Full Body Slam', category: 'melee-jutsu', chakraCost: 30, cooldown: 6.0,
  damage: 126, guardDamage: 52, startup: 0.24, activeFrames: 0.14, recovery: 0.46,
  range: 300, hitStun: 0.7, knockbackX: 720, wallBounce: true, armor: 3,
  effectId: 'beast_cloak', soundId: 'sfx_jutsu_melee',
  description: 'Full transformation body check. Three hits of armour.',
});

/* ========================================================================== */
/* OBITO UCHIHA — phase pressure, chakra rods, ten-tails scaling              */
/* ========================================================================== */

export const OBITO_KIT = fighterKit('obito', {
  basics: [
    { displayName: 'Rod Jab', damage: 27, startup: 0.065, activeFrames: 0.05, recovery: 0.15, range: 100, hitStun: 0.25, knockbackX: 75, guardDamage: 6, effectId: 'rod_spark' },
    { displayName: 'Phase Elbow', damage: 29, startup: 0.075, activeFrames: 0.05, recovery: 0.16, range: 96, hitStun: 0.26, knockbackX: 90, guardDamage: 6, effectId: 'kamui_warp' },
    { displayName: 'Rod Sweep', damage: 33, startup: 0.095, activeFrames: 0.06, recovery: 0.20, range: 120, hitStun: 0.30, knockbackX: 115, guardDamage: 8, effectId: 'rod_spark' },
    { displayName: 'Phase Through Strike', damage: 52, startup: 0.135, activeFrames: 0.08, recovery: 0.31, range: 116, hitStun: 0.42, knockbackX: 380, guardDamage: 13, effectId: 'kamui_warp', soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Rod Swipe', damage: 28, startup: 0.07, activeFrames: 0.05, recovery: 0.16, range: 98, hitStun: 0.28, knockbackX: 80, knockbackY: -60, effectId: 'rod_spark' },
    { displayName: 'Warp Slam', damage: 50, startup: 0.10, activeFrames: 0.07, recovery: 0.24, range: 100, hitStun: 0.46, knockbackX: 170, knockbackY: 390, groundBounce: true, effectId: 'kamui_warp' },
  ],
  heavy: { displayName: 'Kamui Rod Thrust', damage: 70, guardDamage: 30, startup: 0.20, activeFrames: 0.09, recovery: 0.38, range: 150, hitStun: 0.48, knockbackX: 460, wallBounce: true, unblockable: true, effectId: 'kamui_warp' },
  launcher: { displayName: 'Rod Uppercut', damage: 38, guardDamage: 12, startup: 0.13, activeFrames: 0.08, recovery: 0.31, range: 106, hitStun: 0.57, knockbackY: -740, rise: 210, effectId: 'rod_spark' },
  dash: { displayName: 'Intangible Rush', damage: 44, guardDamage: 15, startup: 0.08, activeFrames: 0.10, recovery: 0.28, range: 112, advance: 800, hitStun: 0.34, knockbackX: 250, invulnerability: { start: 0, end: 0.10 }, effectId: 'kamui_warp' },
  throw: { displayName: 'Kamui Displacement', damage: 64, startup: 0.09, activeFrames: 0.08, recovery: 0.42, range: 92, hitStun: 0.72, knockbackX: 520, knockbackY: -200, wallBounce: true, effectId: 'kamui_warp' },
  gc: { displayName: 'Phase Counter', damage: 44, guardDamage: 30, chakraCost: 16, startup: 0.03, activeFrames: 0.12, recovery: 0.26, range: 122, hitStun: 0.5, knockbackX: 340, invulnerability: { start: 0, end: 0.22 }, effectId: 'kamui_warp' },
  jutsu: {
    kamui_phase: {
      displayName: 'Kamui Phase', category: 'counter', chakraCost: 24, cooldown: 8.0,
      damage: 0, guardDamage: 0, startup: 0.03, activeFrames: 0.34, recovery: 0.30, range: 0,
      invulnerability: { start: 0.02, end: 0.36 },
      statusEffects: [{ id: 'phase', duration: 0.36, magnitude: 1 }],
      effectId: 'kamui_warp', soundId: 'sfx_teleport',
      description: 'Becomes intangible for over a third of a second — the longest phase in the game.',
    },
    fireball: {
      displayName: 'Fire Style: Great Fire Annihilation', category: 'ranged-jutsu', chakraCost: 28, cooldown: 6.0,
      damage: 88, guardDamage: 36, startup: 0.26, activeFrames: 0.18, recovery: 0.44, hitStun: 0.48,
      projectile: projectile({ shape: 'beam', color: '#ff6a20', color2: '#ffd08a', speed: 780, life: 1.2, radius: 66, pierce: 3, destroyOnHit: false }),
      effectId: 'fire_stream', soundId: 'sfx_jutsu_ranged',
      description: 'A broad wall of fire.',
    },
    chakra_chain: {
      displayName: 'Chakra Rod Chain', category: 'ranged-jutsu', chakraCost: 22, cooldown: 5.0,
      damage: 58, guardDamage: 24, startup: 0.16, activeFrames: 0.10, recovery: 0.32, hitStun: 0.7,
      projectile: projectile({ shape: 'shard', color: '#c8a45a', speed: 1000, life: 1.1, radius: 16, count: 2, spread: 0.10, interval: 0.06 }),
      statusEffects: [{ id: 'pull', duration: 0, magnitude: 480 }],
      effectId: 'rod_spark', soundId: 'sfx_jutsu_ranged',
      description: 'Rods hook the opponent and yank them toward you.',
    },
  },
  ultimate: {
    displayName: 'Ten-Tails Staff Barrage', chakraCost: 60, cooldown: 21,
    damage: 290, guardDamage: 90, startup: 0.28, activeFrames: 0.30, recovery: 0.86,
    range: 320, hits: 8, hitInterval: 0.055, hitStun: 1.05, knockbackX: 660, knockbackY: -320,
    wallBounce: true, unblockable: true, requirements: { chakra: 60 }, effectId: 'tso',
    description: 'Ten-Tails chakra shapes a staff that ignores guard entirely.',
  },
});

mk('obito_truth_seeking_shield', {
  displayName: 'Truth-Seeking Shield', category: 'buff', chakraCost: 26, cooldown: 12,
  damage: 0, guardDamage: 0, startup: 0.12, activeFrames: 0, recovery: 0.22, range: 0,
  statusEffects: [{ id: 'armor', duration: 6, magnitude: 4 }, { id: 'reflect', duration: 6, magnitude: 1 }],
  effectId: 'tso', soundId: 'sfx_jutsu_area',
  description: 'Black orbs orbit and delete incoming projectiles.',
});

/* ========================================================================== */
/* JIRAIYA — trap zoner who converts into a sage brawler                      */
/* ========================================================================== */

export const JIRAIYA_KIT = fighterKit('jiraiya', {
  basics: [
    { displayName: 'Palm Jab', damage: 28, startup: 0.07, activeFrames: 0.05, recovery: 0.16, range: 96, hitStun: 0.26, knockbackX: 80, guardDamage: 6 },
    { displayName: 'Toad Fist', damage: 31, startup: 0.085, activeFrames: 0.05, recovery: 0.17, range: 100, hitStun: 0.27, knockbackX: 100, guardDamage: 7 },
    { displayName: 'Sweeping Hair Whip', damage: 33, startup: 0.10, activeFrames: 0.07, recovery: 0.21, range: 138, hitStun: 0.30, knockbackX: 120, guardDamage: 8, effectId: 'hair_needle' },
    { displayName: 'Sannin Finish', damage: 56, startup: 0.145, activeFrames: 0.08, recovery: 0.32, range: 116, hitStun: 0.44, knockbackX: 420, guardDamage: 14, wallBounce: true, soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Toad Kick', damage: 29, startup: 0.08, activeFrames: 0.05, recovery: 0.17, range: 94, hitStun: 0.29, knockbackX: 85, knockbackY: -60 },
    { displayName: 'Toad Body Drop', damage: 54, startup: 0.12, activeFrames: 0.08, recovery: 0.26, range: 100, hitStun: 0.48, knockbackX: 150, knockbackY: 430, groundBounce: true, soundId: 'sfx_hit_heavy' },
  ],
  heavy: { displayName: 'Rasengan Palm', damage: 70, guardDamage: 28, startup: 0.20, activeFrames: 0.09, recovery: 0.38, range: 118, hitStun: 0.48, knockbackX: 470, wallBounce: true, effectId: 'rasengan' },
  launcher: { displayName: 'Toad Rise', damage: 39, guardDamage: 12, startup: 0.14, activeFrames: 0.08, recovery: 0.32, range: 102, hitStun: 0.57, knockbackY: -720, rise: 200 },
  dash: { displayName: 'Toad Roll', damage: 45, guardDamage: 16, startup: 0.10, activeFrames: 0.10, recovery: 0.30, range: 110, advance: 640, hitStun: 0.35, knockbackX: 270, armor: 1 },
  throw: { displayName: 'Hair Bind Slam', damage: 66, startup: 0.09, activeFrames: 0.09, recovery: 0.42, range: 100, hitStun: 0.72, knockbackX: 260, knockbackY: 380, groundBounce: true, effectId: 'hair_needle' },
  gc: { displayName: 'Needle Guard', damage: 44, guardDamage: 30, chakraCost: 16, startup: 0.04, activeFrames: 0.11, recovery: 0.28, range: 120, hitStun: 0.46, knockbackX: 330, effectId: 'hair_needle' },
  jutsu: {
    needle_jizo: {
      displayName: 'Needle Jizo', category: 'buff', chakraCost: 22, cooldown: 10,
      damage: 34, guardDamage: 20, startup: 0.14, activeFrames: 0.10, recovery: 0.26, range: 150,
      statusEffects: [{ id: 'armor', duration: 5, magnitude: 3 }, { id: 'thorns', duration: 5, magnitude: 18 }],
      effectId: 'hair_needle', soundId: 'sfx_jutsu_area',
      description: 'Hair armour: three hits of armour and it damages whoever hits you.',
    },
    hair_needle_barrage: {
      displayName: 'Hair Needle Barrage', category: 'ranged-jutsu', chakraCost: 24, cooldown: 5.0,
      damage: 26, guardDamage: 10, startup: 0.18, activeFrames: 0.08, recovery: 0.34, hitStun: 0.22,
      projectile: projectile({ shape: 'shard', color: '#e8ddc0', speed: 880, life: 1.1, radius: 12, count: 6, spread: 0.10, interval: 0.04 }),
      effectId: 'hair_needle', soundId: 'sfx_jutsu_ranged',
      description: 'A wall of hardened needles.',
    },
    swamp_of_the_underworld: {
      displayName: 'Swamp of the Underworld', category: 'area-jutsu', chakraCost: 28, cooldown: 9.0,
      damage: 44, guardDamage: 22, startup: 0.24, activeFrames: 0.16, recovery: 0.42,
      range: 360, area: 280, hitStun: 0.34, knockbackX: 0,
      statusEffects: [{ id: 'slow', duration: 4, magnitude: 0.45 }, { id: 'pin', duration: 0.5, magnitude: 1 }],
      effectId: 'swamp', soundId: 'sfx_jutsu_area',
      description: 'Floods the ground; the opponent moves at 55% speed for four seconds.',
    },
  },
  ultimate: {
    displayName: 'Summoning: Gamabunta', chakraCost: 60, cooldown: 21,
    damage: 284, guardDamage: 88, startup: 0.34, activeFrames: 0.32, recovery: 0.90,
    range: 520, hits: 5, hitInterval: 0.08, hitStun: 1.05, knockbackX: 560, knockbackY: 520,
    groundBounce: true, requirements: { chakra: 60 }, effectId: 'summon_dust',
    description: 'Gamabunta lands on the arena and follows up with an oil-fire blast.',
  },
});

mk('jiraiya_toad_oil_flame', {
  displayName: 'Toad Oil Flame Bullet', category: 'ranged-jutsu', chakraCost: 30, cooldown: 7.0,
  damage: 96, guardDamage: 40, startup: 0.28, activeFrames: 0.20, recovery: 0.46, hitStun: 0.5,
  projectile: projectile({ shape: 'beam', color: '#ff8a20', color2: '#ffe0a0', speed: 760, life: 1.2, radius: 62, pierce: 3, destroyOnHit: false }),
  statusEffects: [{ id: 'burn', duration: 4, magnitude: 8 }],
  effectId: 'fire_stream', soundId: 'sfx_jutsu_ranged',
  description: 'Sage-oil ignited into a burning stream.',
});
mk('jiraiya_frog_song', {
  displayName: 'Frog Song', category: 'debuff', chakraCost: 34, cooldown: 16,
  damage: 30, guardDamage: 0, startup: 0.26, activeFrames: 0.20, recovery: 0.50,
  range: 700, area: 700, unblockable: true, hitStun: 0.4,
  statusEffects: [{ id: 'slow', duration: 5, magnitude: 0.5 }, { id: 'chakra_drain', duration: 0, magnitude: 30 }],
  effectId: 'genjutsu_wave', soundId: 'sfx_genjutsu',
  description: 'Full-screen sound genjutsu. Unblockable, slows and drains chakra.',
});
mk('jiraiya_sage_rasengan', {
  displayName: 'Sage Art: Big Ball Rasengan', category: 'melee-jutsu', chakraCost: 30, cooldown: 5.0,
  damage: 112, guardDamage: 42, startup: 0.20, activeFrames: 0.14, recovery: 0.40,
  range: 168, advance: 480, hitStun: 0.68, knockbackX: 680, wallBounce: true, armor: 1,
  effectId: 'rasengan_sage', soundId: 'sfx_jutsu_melee',
  description: 'Sage Mode enlarges the sphere considerably.',
});

/* ========================================================================== */
/* OROCHIMARU — snake traps, chip damage, refuses to die                      */
/* ========================================================================== */

export const OROCHIMARU_KIT = fighterKit('orochimaru', {
  basics: [
    { displayName: 'Snake Strike', damage: 26, startup: 0.07, activeFrames: 0.05, recovery: 0.15, range: 120, hitStun: 0.25, knockbackX: 70, guardDamage: 6, effectId: 'snake_coil' },
    { displayName: 'Twin Fang', damage: 29, startup: 0.08, activeFrames: 0.05, recovery: 0.16, range: 126, hitStun: 0.26, knockbackX: 88, guardDamage: 6, effectId: 'snake_coil' },
    { displayName: 'Kusanagi Extension', damage: 33, startup: 0.10, activeFrames: 0.06, recovery: 0.21, range: 168, hitStun: 0.30, knockbackX: 110, guardDamage: 8, effectId: 'blade_arc' },
    { displayName: 'Serpent Finish', damage: 52, startup: 0.14, activeFrames: 0.08, recovery: 0.33, range: 150, hitStun: 0.42, knockbackX: 400, guardDamage: 13, wallBounce: true, effectId: 'snake_coil', soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Fang', damage: 28, startup: 0.08, activeFrames: 0.05, recovery: 0.16, range: 116, hitStun: 0.28, knockbackX: 82, knockbackY: -60, effectId: 'snake_coil' },
    { displayName: 'Coil Drop', damage: 50, startup: 0.11, activeFrames: 0.07, recovery: 0.25, range: 112, hitStun: 0.46, knockbackX: 160, knockbackY: 390, groundBounce: true, effectId: 'snake_coil' },
  ],
  heavy: { displayName: 'Sword of Kusanagi', damage: 68, guardDamage: 30, startup: 0.19, activeFrames: 0.09, recovery: 0.38, range: 220, hitStun: 0.48, knockbackX: 440, wallBounce: true, effectId: 'blade_arc' },
  launcher: { displayName: 'Rising Serpent', damage: 38, guardDamage: 12, startup: 0.135, activeFrames: 0.08, recovery: 0.32, range: 130, hitStun: 0.57, knockbackY: -720, effectId: 'snake_coil' },
  dash: { displayName: 'Serpent Slide', damage: 43, guardDamage: 14, startup: 0.09, activeFrames: 0.10, recovery: 0.28, range: 130, advance: 700, hitStun: 0.34, knockbackX: 250, effectId: 'snake_coil' },
  throw: { displayName: 'Constrict', damage: 62, startup: 0.09, activeFrames: 0.09, recovery: 0.44, range: 100, hitStun: 0.78, knockbackX: 240, knockbackY: -160, statusEffects: [{ id: 'poison', duration: 6, magnitude: 7 }], effectId: 'snake_coil' },
  gc: { displayName: 'Shedding Counter', damage: 42, guardDamage: 28, chakraCost: 16, startup: 0.03, activeFrames: 0.12, recovery: 0.26, range: 124, hitStun: 0.5, knockbackX: 330, invulnerability: { start: 0, end: 0.20 }, effectId: 'snake_coil' },
  jutsu: {
    hidden_shadow_snakes: {
      displayName: 'Hidden Shadow Snake Hands', category: 'ranged-jutsu', chakraCost: 22, cooldown: 4.5,
      damage: 62, guardDamage: 24, startup: 0.18, activeFrames: 0.14, recovery: 0.34, hitStun: 0.42,
      projectile: projectile({ shape: 'wave', color: '#7a9a5a', color2: '#d0e8a0', speed: 820, life: 1.2, radius: 30, pierce: 1, destroyOnHit: false }),
      statusEffects: [{ id: 'poison', duration: 5, magnitude: 6 }],
      effectId: 'snake_coil', soundId: 'sfx_jutsu_ranged',
      description: 'Snakes shoot from the sleeve and poison on contact.',
    },
    rashomon: {
      displayName: 'Summoning: Rashomon', category: 'buff', chakraCost: 26, cooldown: 12,
      damage: 0, guardDamage: 0, startup: 0.18, activeFrames: 0, recovery: 0.30, range: 0,
      statusEffects: [{ id: 'armor', duration: 6, magnitude: 5 }, { id: 'defense_up', duration: 6, magnitude: 0.3 }],
      effectId: 'rashomon', soundId: 'sfx_summon',
      description: 'The strongest defensive buff in the game: five hits of armour.',
    },
    body_replacement: {
      displayName: 'Living Corpse Reincarnation', category: 'healing', chakraCost: 34, cooldown: 22,
      damage: 0, guardDamage: 0, startup: 0.24, activeFrames: 0, recovery: 0.40, range: 0,
      invulnerability: { start: 0, end: 0.26 },
      statusEffects: [{ id: 'heal_instant', duration: 0, magnitude: 140 }, { id: 'cleanse', duration: 0, magnitude: 1 }],
      effectId: 'snake_shed', soundId: 'sfx_heal',
      description: 'Sheds the body: heals heavily and clears every debuff.',
    },
  },
  ultimate: {
    displayName: 'Eight-Headed Serpent', chakraCost: 60, cooldown: 22,
    damage: 286, guardDamage: 88, startup: 0.34, activeFrames: 0.34, recovery: 0.90,
    range: 620, hits: 8, hitInterval: 0.06, hitStun: 1.05, knockbackX: 560, knockbackY: -280,
    wallBounce: true, requirements: { chakra: 60 }, effectId: 'snake_coil',
    statusEffects: [{ id: 'poison', duration: 8, magnitude: 9 }],
    description: 'Eight heads strike in sequence and leave a long poison.',
  },
});

mk('orochimaru_edo_tensei', {
  displayName: 'Impure World Reincarnation (Prototype)', category: 'summon', chakraCost: 40, cooldown: 20,
  damage: 78, guardDamage: 30, startup: 0.36, activeFrames: 0.30, recovery: 0.56,
  range: 420, hits: 4, hitInterval: 0.10, hitStun: 0.5, knockbackX: 260,
  statusEffects: [{ id: 'clone_guard', duration: 8, magnitude: 3 }],
  effectId: 'edo_tensei', soundId: 'sfx_summon',
  description: 'Raises a reincarnated ally who fights beside you and soaks three hits.',
});

/* ========================================================================== */
/* TSUNADE — slow, enormous damage, self-sustain via Byakugo                  */
/* ========================================================================== */

export const TSUNADE_KIT = fighterKit('tsunade', {
  basics: [
    { displayName: 'Straight Palm', damage: 30, startup: 0.08, activeFrames: 0.05, recovery: 0.17, range: 92, hitStun: 0.26, knockbackX: 90, guardDamage: 8 },
    { displayName: 'Body Blow', damage: 34, startup: 0.095, activeFrames: 0.06, recovery: 0.19, range: 94, hitStun: 0.28, knockbackX: 115, guardDamage: 9 },
    { displayName: 'Rising Knee', damage: 37, startup: 0.11, activeFrames: 0.06, recovery: 0.22, range: 96, hitStun: 0.31, knockbackX: 140, guardDamage: 10 },
    { displayName: 'Hundred Strength Finish', damage: 74, startup: 0.185, activeFrames: 0.09, recovery: 0.38, range: 106, hitStun: 0.50, knockbackX: 540, guardDamage: 22, wallBounce: true, effectId: 'earth_crack', soundId: 'sfx_hit_heavy' },
  ],
  air: [
    { displayName: 'Air Hammer', damage: 33, startup: 0.09, activeFrames: 0.06, recovery: 0.19, range: 90, hitStun: 0.30, knockbackX: 90, knockbackY: -60 },
    { displayName: 'Earth Splitter', damage: 64, startup: 0.14, activeFrames: 0.08, recovery: 0.28, range: 98, hitStun: 0.52, knockbackX: 150, knockbackY: 500, groundBounce: true, effectId: 'earth_crack', soundId: 'sfx_hit_heavy' },
  ],
  heavy: { displayName: 'Hundred Strength Smash', damage: 92, guardDamage: 40, startup: 0.27, activeFrames: 0.10, recovery: 0.44, range: 118, hitStun: 0.56, knockbackX: 620, wallBounce: true, armor: 3, effectId: 'earth_crack' },
  launcher: { displayName: 'Ground Uproot', damage: 44, guardDamage: 16, startup: 0.17, activeFrames: 0.09, recovery: 0.36, range: 120, hitStun: 0.60, knockbackY: -680, effectId: 'earth_crack' },
  dash: { displayName: 'Shoulder Charge', damage: 50, guardDamage: 20, startup: 0.12, activeFrames: 0.10, recovery: 0.32, range: 100, advance: 520, hitStun: 0.36, knockbackX: 320, armor: 2 },
  throw: { displayName: 'Sannin Piledriver', damage: 86, startup: 0.10, activeFrames: 0.09, recovery: 0.48, range: 90, hitStun: 0.8, knockbackX: 200, knockbackY: 460, groundBounce: true, effectId: 'earth_crack' },
  gc: { displayName: 'Crushing Counter', damage: 52, guardDamage: 30, chakraCost: 18, startup: 0.05, activeFrames: 0.10, recovery: 0.32, range: 108, hitStun: 0.5, knockbackX: 380 },
  jutsu: {
    ground_shatter: {
      displayName: 'Earth Shatter', category: 'area-jutsu', chakraCost: 26, cooldown: 6.0,
      damage: 90, guardDamage: 40, startup: 0.28, activeFrames: 0.16, recovery: 0.48,
      range: 380, area: 300, hitStun: 0.6, knockbackX: 240, knockbackY: -560, launch: true,
      effectId: 'earth_crack', soundId: 'sfx_jutsu_area',
      description: 'Splits the arena floor. Huge launch on hit.',
    },
    byakugo_release: {
      displayName: 'Byakugo Seal Release', category: 'buff', chakraCost: 30, cooldown: 18,
      damage: 0, guardDamage: 0, startup: 0.20, activeFrames: 0, recovery: 0.32, range: 0,
      statusEffects: [{ id: 'regen', duration: 12, magnitude: 26 }, { id: 'attack_up', duration: 12, magnitude: 0.2 }],
      effectId: 'byakugo_heal', soundId: 'sfx_heal',
      description: 'Long regeneration plus a damage boost.',
    },
    katsuyu_summon: {
      displayName: 'Summoning: Katsuyu', category: 'summon', chakraCost: 30, cooldown: 12,
      damage: 58, guardDamage: 26, startup: 0.28, activeFrames: 0.26, recovery: 0.44, hitStun: 0.34,
      projectile: projectile({ shape: 'wave', color: '#cfe9ff', speed: 400, life: 1.8, radius: 50, groundLevel: true, pierce: 3, destroyOnHit: false }),
      statusEffects: [{ id: 'regen', duration: 6, magnitude: 14 }],
      effectId: 'acid_wave', soundId: 'sfx_summon',
      description: 'Katsuyu covers you, healing while spraying acid forward.',
    },
  },
  ultimate: {
    displayName: 'Strength of a Hundred', chakraCost: 60, cooldown: 21,
    damage: 300, guardDamage: 94, startup: 0.32, activeFrames: 0.28, recovery: 0.90,
    range: 240, hits: 4, hitInterval: 0.09, hitStun: 1.05, knockbackX: 520, knockbackY: 560,
    groundBounce: true, requirements: { chakra: 60 }, effectId: 'earth_crack',
    statusEffects: [{ id: 'heal_instant', duration: 0, magnitude: 60 }],
    description: 'Four full-power blows that also restore 60 health.',
  },
});

mk('tsunade_hundred_healings', {
  displayName: 'Creation Rebirth: Hundred Healings', category: 'healing', chakraCost: 22, cooldown: 10,
  damage: 0, guardDamage: 0, startup: 0.10, activeFrames: 0, recovery: 0.18, range: 0,
  statusEffects: [{ id: 'regen', duration: 12, magnitude: 40 }],
  effectId: 'byakugo_heal', soundId: 'sfx_heal',
  description: 'The strongest sustained heal in the game while the seal is open.',
});
