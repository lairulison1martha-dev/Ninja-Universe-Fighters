/**
 * Universal abilities + archetype prototype templates.
 *
 * Anything defined here with `prototype: true` is a CLEARLY LABELLED generic
 * template. Fighters that use these are shown as "Prototype" in the roster UI
 * — they are placeholders until a hand-authored kit replaces them.
 */

import { mk, projectile } from './ability-schema.js';
import { ARCHETYPES } from '../constants.js';

/* -------------------------------------------------------------------------- */
/* Universal moves every fighter can perform                                  */
/* -------------------------------------------------------------------------- */

mk('universal_throw', {
  displayName: 'Grapple Throw',
  category: 'throw',
  damage: 62,
  guardDamage: 0,
  startup: 0.09,
  activeFrames: 0.08,
  recovery: 0.42,
  range: 92,
  hitStun: 0.65,
  knockbackX: 420,
  knockbackY: -260,
  unblockable: true,
  groundBounce: true,
  effectId: 'impact_throw',
  soundId: 'sfx_hit_heavy',
  animationId: 'throw',
  description: 'Unblockable close-range throw. Whiffs badly if the opponent is not grounded.',
});

mk('universal_guard_counter', {
  displayName: 'Guard Counter',
  category: 'counter',
  damage: 44,
  guardDamage: 26,
  chakraCost: 18,
  startup: 0.05,
  activeFrames: 0.10,
  recovery: 0.30,
  range: 118,
  hitStun: 0.42,
  knockbackX: 320,
  invulnerability: { start: 0, end: 0.16 },
  effectId: 'impact_counter',
  soundId: 'sfx_guard_break',
  description: 'Cancel block-stun into a short invulnerable strike.',
});

mk('universal_chakra_charge', {
  displayName: 'Chakra Charge',
  category: 'buff',
  damage: 0,
  guardDamage: 0,
  startup: 0.08,
  activeFrames: 0,
  recovery: 0.10,
  range: 0,
  effectId: 'aura_charge',
  soundId: 'sfx_charge',
  animationId: 'charge',
  description: 'Channel chakra. Interruptible.',
});

/* -------------------------------------------------------------------------- */
/* Archetype prototype templates                                              */
/* -------------------------------------------------------------------------- */

/**
 * Per-archetype tuning for the generated template kit. These differ enough that
 * a prototype rushdown fighter genuinely does not play like a prototype zoner,
 * but they are still templates — not hand-authored kits.
 */
const ARCHETYPE_TUNING = {
  balanced:       { spd: 1.00, dmg: 1.00, reach: 1.00, proj: 'orb',   hue: '#7fd4ff', jutsuKind: 'ranged-jutsu' },
  rushdown:       { spd: 1.22, dmg: 0.90, reach: 0.88, proj: null,    hue: '#ff8a4c', jutsuKind: 'melee-jutsu' },
  ranged:         { spd: 0.90, dmg: 0.95, reach: 1.10, proj: 'shard', hue: '#9effa8', jutsuKind: 'ranged-jutsu' },
  defensive:      { spd: 0.86, dmg: 1.05, reach: 1.02, proj: 'wave',  hue: '#c7a06a', jutsuKind: 'area-jutsu' },
  grappler:       { spd: 0.82, dmg: 1.24, reach: 0.94, proj: null,    hue: '#e2705a', jutsuKind: 'melee-jutsu' },
  support:        { spd: 0.98, dmg: 0.86, reach: 1.00, proj: 'orb',   hue: '#8fd0c8', jutsuKind: 'buff' },
  summoner:       { spd: 0.92, dmg: 1.00, reach: 1.06, proj: 'orb',   hue: '#b58bff', jutsuKind: 'summon' },
  transformation: { spd: 1.02, dmg: 1.08, reach: 1.00, proj: 'orb',   hue: '#ff6bd6', jutsuKind: 'buff' },
  puppet:         { spd: 0.94, dmg: 0.96, reach: 1.16, proj: 'shard', hue: '#d8c08a', jutsuKind: 'ranged-jutsu' },
  weapon:         { spd: 1.06, dmg: 1.02, reach: 1.14, proj: 'shard', hue: '#cfd8e6', jutsuKind: 'melee-jutsu' },
  healer:         { spd: 0.96, dmg: 0.84, reach: 0.96, proj: 'orb',   hue: '#8affc9', jutsuKind: 'healing' },
  zoning:         { spd: 0.88, dmg: 0.92, reach: 1.22, proj: 'wave',  hue: '#7ea8ff', jutsuKind: 'area-jutsu' },
  counter:        { spd: 1.00, dmg: 1.06, reach: 0.98, proj: null,    hue: '#ff5f7a', jutsuKind: 'melee-jutsu' },
  aerial:         { spd: 1.14, dmg: 0.92, reach: 0.92, proj: 'shard', hue: '#a5f0ff', jutsuKind: 'ranged-jutsu' },
};

/** Ids of the generated template kit for a given archetype. */
export function templateKit(archetype) {
  const a = ARCHETYPE_TUNING[archetype] ? archetype : 'balanced';
  return {
    basicCombos: [`tpl_${a}_jab1`, `tpl_${a}_jab2`, `tpl_${a}_jab3`, `tpl_${a}_jab4`],
    airCombos: [`tpl_${a}_air1`, `tpl_${a}_air2`],
    heavy: `tpl_${a}_heavy`,
    launcher: `tpl_${a}_launcher`,
    dashAttack: `tpl_${a}_dash`,
    throwAttack: 'universal_throw',
    guardCounter: 'universal_guard_counter',
    abilities: [`tpl_${a}_jutsu1`, `tpl_${a}_jutsu2`],
    ultimate: `tpl_${a}_ultimate`,
  };
}

function buildTemplate(arch) {
  const t = ARCHETYPE_TUNING[arch];
  const P = `tpl_${arch}`;
  const label = arch.charAt(0).toUpperCase() + arch.slice(1);
  const common = { prototype: true, effectId: 'impact_default' };
  const proto = ' [Prototype template]';

  const dmg = (n) => Math.round(n * t.dmg);
  const rch = (n) => Math.round(n * t.reach);
  const spd = (n) => +(n / t.spd).toFixed(3);

  mk(`${P}_jab1`, {
    ...common, displayName: `${label} Strike 1`, category: 'basic',
    damage: dmg(30), startup: spd(0.07), activeFrames: 0.05, recovery: spd(0.16),
    range: rch(88), hitStun: 0.26, knockbackX: 90, guardDamage: 5,
    chainInto: [`${P}_jab2`, `${P}_heavy`, `${P}_launcher`],
    description: `Fast opener.${proto}`,
  });
  mk(`${P}_jab2`, {
    ...common, displayName: `${label} Strike 2`, category: 'basic',
    damage: dmg(32), startup: spd(0.08), activeFrames: 0.05, recovery: spd(0.17),
    range: rch(92), hitStun: 0.27, knockbackX: 110, guardDamage: 6,
    chainInto: [`${P}_jab3`, `${P}_heavy`, `${P}_launcher`],
    description: `Chain follow-up.${proto}`,
  });
  mk(`${P}_jab3`, {
    ...common, displayName: `${label} Strike 3`, category: 'basic',
    damage: dmg(36), startup: spd(0.09), activeFrames: 0.06, recovery: spd(0.20),
    range: rch(96), hitStun: 0.29, knockbackX: 150, guardDamage: 7,
    chainInto: [`${P}_jab4`, `${P}_launcher`],
    description: `Chain follow-up.${proto}`,
  });
  mk(`${P}_jab4`, {
    ...common, displayName: `${label} Finisher`, category: 'basic',
    damage: dmg(48), startup: spd(0.12), activeFrames: 0.07, recovery: spd(0.30),
    range: rch(104), hitStun: 0.38, knockbackX: 340, knockbackY: -120,
    guardDamage: 12, soundId: 'sfx_hit_heavy',
    description: `Ends the ground chain.${proto}`,
  });
  mk(`${P}_air1`, {
    ...common, displayName: `${label} Air Strike`, category: 'aerial',
    damage: dmg(30), startup: spd(0.08), activeFrames: 0.06, recovery: spd(0.18),
    range: rch(86), airOk: true, groundOk: false, hitStun: 0.30, knockbackX: 80,
    knockbackY: -60, chainInto: [`${P}_air2`],
    description: `Air chain opener.${proto}`,
  });
  mk(`${P}_air2`, {
    ...common, displayName: `${label} Air Slam`, category: 'aerial',
    damage: dmg(46), startup: spd(0.10), activeFrames: 0.07, recovery: spd(0.24),
    range: rch(92), airOk: true, groundOk: false, hitStun: 0.44, knockbackX: 200,
    knockbackY: 340, groundBounce: true, soundId: 'sfx_hit_heavy',
    description: `Spikes the opponent into the floor.${proto}`,
  });
  mk(`${P}_heavy`, {
    ...common, displayName: `${label} Heavy Blow`, category: 'heavy',
    damage: dmg(62), guardDamage: 20, startup: spd(0.20), activeFrames: 0.08,
    recovery: spd(0.36), range: rch(116), hitStun: 0.46, knockbackX: 420,
    knockbackY: -60, wallBounce: true, armor: 1, soundId: 'sfx_hit_heavy',
    description: `Slow, one hit of armour, wall-bounces.${proto}`,
  });
  mk(`${P}_launcher`, {
    ...common, displayName: `${label} Launcher`, category: 'launcher',
    damage: dmg(40), guardDamage: 12, startup: spd(0.14), activeFrames: 0.08,
    recovery: spd(0.34), range: rch(100), hitStun: 0.55, knockbackX: 60,
    knockbackY: -720, launch: true, soundId: 'sfx_launch',
    description: `Launches into air-combo range.${proto}`,
  });
  mk(`${P}_dash`, {
    ...common, displayName: `${label} Dash Attack`, category: 'dash',
    damage: dmg(44), guardDamage: 14, startup: spd(0.10), activeFrames: 0.10,
    recovery: spd(0.30), range: rch(104), advance: 620, hitStun: 0.36,
    knockbackX: 260, description: `Closes distance.${proto}`,
  });

  const j1 = t.proj
    ? {
      category: 'ranged-jutsu', range: 0, chakraCost: 20, cooldown: 3.2,
      damage: dmg(52), startup: 0.18, recovery: 0.32,
      projectile: projectile({ shape: t.proj, color: t.hue, speed: 700, life: 1.3 }),
      effectId: 'cast_ranged', soundId: 'sfx_jutsu_ranged',
    }
    : {
      category: 'melee-jutsu', chakraCost: 22, cooldown: 3.4, damage: dmg(74),
      startup: 0.16, activeFrames: 0.12, recovery: 0.38, range: rch(140),
      advance: 460, knockbackX: 380, hitStun: 0.5,
      effectId: 'cast_melee', soundId: 'sfx_jutsu_melee',
    };

  mk(`${P}_jutsu1`, {
    ...common, ...j1, displayName: `${label} Jutsu`, guardDamage: 22,
    description: `Signature-slot placeholder.${proto}`,
  });

  mk(`${P}_jutsu2`, {
    ...common, displayName: `${label} Pressure Jutsu`,
    category: t.jutsuKind === 'buff' || t.jutsuKind === 'healing' ? t.jutsuKind : 'area-jutsu',
    chakraCost: 30, cooldown: 7.5,
    damage: t.jutsuKind === 'healing' ? 0 : dmg(66),
    guardDamage: 26, startup: 0.24, activeFrames: 0.14, recovery: 0.46,
    range: rch(170), area: 190, knockbackX: 300, knockbackY: -200,
    statusEffects: t.jutsuKind === 'healing'
      ? [{ id: 'regen', duration: 6, magnitude: 26 }]
      : t.jutsuKind === 'buff'
        ? [{ id: 'attack_up', duration: 8, magnitude: 0.18 }]
        : [],
    effectId: 'cast_area', soundId: 'sfx_jutsu_area',
    description: `Second signature slot placeholder.${proto}`,
  });

  mk(`${P}_ultimate`, {
    ...common, displayName: `${label} Ultimate`, category: 'ultimate',
    chakraCost: 60, cooldown: 18, damage: dmg(230), guardDamage: 60,
    startup: 0.26, activeFrames: 0.30, recovery: 0.75, range: rch(220),
    hits: 5, hitInterval: 0.07, hitStun: 0.9, knockbackX: 620, knockbackY: -320,
    wallBounce: true, cutIn: true, slowMoFinish: true,
    invulnerability: { start: 0, end: 0.26 },
    effectId: 'ultimate_burst', soundId: 'sfx_ultimate',
    requirements: { chakra: 60 },
    description: `Placeholder ultimate.${proto}`,
  });
}

for (const arch of ARCHETYPES) buildTemplate(arch);
