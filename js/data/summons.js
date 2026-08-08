/**
 * Summons.
 *
 * The named creatures and partners a fighter can summon — Akamaru, Gamabunta,
 * Katsuyu, Manda, Susanoo's arm. Each is a timed helper with one scripted
 * behaviour, a cooldown and a chakra cost. They are referenced by
 * `fighters[].summons` and listed on the fighter detail sheet.
 *
 * THESE ARE NOT THE SELECTABLE ASSIST. The assist the player picks before a
 * match is a second *roster fighter*, defined in `js/data/fighter-assists.js`
 * and run by `js/combat/assist-system.js`. Nothing in this file is wired to
 * the CHAKRA button or the assist cooldown; it is descriptive roster data.
 */

export const SUMMONS = Object.create(null);

const BEHAVIOURS = ['attack', 'defend', 'heal', 'trap', 'terrain', 'projectile'];

function summon(id, displayName, o) {
  if (!BEHAVIOURS.includes(o.behaviour)) {
    throw new Error(`Summon ${id} has unknown behaviour "${o.behaviour}"`);
  }
  SUMMONS[id] = {
    id,
    displayName,
    behaviour: o.behaviour,
    description: o.description || '',
    cooldown: o.cooldown ?? 18,
    chakraCost: o.chakraCost ?? 20,
    duration: o.duration ?? 1.4,
    damage: o.damage ?? 0,
    guardDamage: o.guardDamage ?? 0,
    healAmount: o.healAmount ?? 0,
    knockbackX: o.knockbackX ?? 200,
    knockbackY: o.knockbackY ?? 0,
    hitStun: o.hitStun ?? 0.4,
    range: o.range ?? 260,
    statusEffects: o.statusEffects || [],
    color: o.color || '#9ad0ff',
    size: o.size ?? 1,
    effectId: o.effectId || 'summon_dust',
    soundId: o.soundId || 'sfx_summon',
  };
  return SUMMONS[id];
}

/* Attack summons ----------------------------------------------------------- */
summon('summon_akamaru', 'Akamaru', { behaviour: 'attack', damage: 58, cooldown: 14, chakraCost: 16, range: 300, knockbackX: 240, color: '#f0ead8', size: 0.8, description: 'Charges forward in a spinning fang attack.' });
summon('summon_gamakichi', 'Gamakichi', { behaviour: 'projectile', damage: 52, cooldown: 16, chakraCost: 18, range: 620, color: '#e8944a', description: 'Spits a compressed water bullet across the arena.' });
summon('summon_gamabunta', 'Gamabunta', { behaviour: 'attack', damage: 96, cooldown: 26, chakraCost: 32, duration: 1.9, range: 380, knockbackY: 380, size: 2.4, color: '#c8543a', description: 'Lands on the opponent, then slashes once.' });
summon('summon_aoda', 'Aoda', { behaviour: 'attack', damage: 82, cooldown: 22, chakraCost: 28, range: 460, knockbackX: 420, size: 2.0, color: '#5a8ad8', description: 'Strikes down the length of the arena.' });
summon('summon_manda', 'Manda', { behaviour: 'attack', damage: 92, cooldown: 26, chakraCost: 32, range: 500, knockbackX: 480, size: 2.2, color: '#8a9a5a', statusEffects: [{ id: 'poison', duration: 5, magnitude: 6 }], description: 'Bites, and leaves poison behind.' });
summon('summon_enma', 'Enma', { behaviour: 'attack', damage: 74, cooldown: 20, chakraCost: 26, range: 420, size: 1.6, color: '#d8c8a8', description: 'Transforms into the Adamantine Staff and extends.' });
summon('summon_ninja_hounds', 'Ninja Hounds', { behaviour: 'trap', damage: 34, cooldown: 15, chakraCost: 18, range: 340, color: '#b9a184', statusEffects: [{ id: 'pin', duration: 1.1, magnitude: 1 }], description: 'Burst from the ground and pin the opponent.' });
summon('summon_shadow_clones', 'Shadow Clones', { behaviour: 'attack', damage: 44, cooldown: 12, chakraCost: 14, range: 280, color: '#ffd85e', description: 'Three clones rush in for a quick barrage.' });
summon('summon_wood_clone', 'Wood Clone', { behaviour: 'defend', cooldown: 18, chakraCost: 22, duration: 5, color: '#8aba6a', statusEffects: [{ id: 'clone_guard', duration: 5, magnitude: 2 }], description: 'Stands guard and absorbs two hits for you.' });
summon('summon_susanoo', 'Susanoo Arm', { behaviour: 'attack', damage: 88, cooldown: 24, chakraCost: 30, range: 320, knockbackX: 520, size: 2.0, color: '#8a5aff', description: 'A spectral arm sweeps the area in front of you.' });
summon('summon_gyuki', 'Gyuki', { behaviour: 'attack', damage: 86, cooldown: 24, chakraCost: 30, range: 400, size: 2.1, color: '#6a5ab0', description: 'A tentacle whips across the arena.' });
summon('summon_kamatari', 'Kamatari', { behaviour: 'projectile', damage: 64, cooldown: 18, chakraCost: 22, range: 700, color: '#a8d0e8', description: 'A wind weasel cuts a path down the stage.' });
summon('summon_kisame', 'Kisame', { behaviour: 'attack', damage: 66, cooldown: 20, chakraCost: 24, range: 280, color: '#4a8ab0', statusEffects: [{ id: 'chakra_drain', duration: 0, magnitude: 18 }], description: 'Samehada bites and eats chakra.' });
summon('summon_lee', 'Rock Lee', { behaviour: 'attack', damage: 62, cooldown: 16, chakraCost: 20, range: 320, color: '#2fa85a', description: 'A Dynamic Entry flying kick.' });
summon('summon_guy', 'Might Guy', { behaviour: 'attack', damage: 72, cooldown: 20, chakraCost: 24, range: 300, color: '#2fa85a', description: 'Leaf Strong Hurricane.' });
summon('summon_taka', 'Taka', { behaviour: 'attack', damage: 58, cooldown: 17, chakraCost: 20, range: 340, color: '#7a9ac8', description: 'Suigetsu and Jugo strike together.' });
summon('summon_sarada', 'Sarada', { behaviour: 'attack', damage: 60, cooldown: 16, chakraCost: 20, range: 260, color: '#c8384a', description: 'A chakra-enhanced punch.' });
summon('summon_mitsuki', 'Mitsuki', { behaviour: 'projectile', damage: 50, cooldown: 15, chakraCost: 18, range: 600, color: '#8ad8ff', description: 'Lightning-charged snake strike.' });
summon('summon_delta', 'Delta', { behaviour: 'projectile', damage: 68, cooldown: 20, chakraCost: 24, range: 700, color: '#e05a9a', description: 'Fires an absorbed chakra beam.' });
summon('summon_kinshiki', 'Kinshiki', { behaviour: 'attack', damage: 84, cooldown: 22, chakraCost: 28, range: 300, knockbackX: 460, color: '#c0a8d8', description: 'A single enormous blade swing.' });
summon('summon_zetsu', 'Zetsu', { behaviour: 'trap', damage: 30, cooldown: 16, chakraCost: 18, range: 300, color: '#7a9a5a', statusEffects: [{ id: 'slow', duration: 3, magnitude: 0.4 }], description: 'Roots erupt and slow the opponent.' });
summon('summon_konan', 'Konan', { behaviour: 'trap', damage: 44, cooldown: 18, chakraCost: 20, range: 380, color: '#6a5ac8', statusEffects: [{ id: 'pin', duration: 0.9, magnitude: 1 }], description: 'Paper wraps and binds.' });

/* Support summons ---------------------------------------------------------- */
summon('summon_katsuyu', 'Katsuyu', { behaviour: 'heal', healAmount: 90, cooldown: 28, chakraCost: 30, duration: 4, color: '#cfe9ff', statusEffects: [{ id: 'regen', duration: 6, magnitude: 15 }], description: 'Divides and heals you over six seconds.' });
summon('summon_temari', 'Temari', { behaviour: 'terrain', damage: 40, cooldown: 20, chakraCost: 22, range: 640, color: '#a8c8e0', knockbackX: 380, description: 'A wind wall sweeps everything backwards.' });

export function getSummon(id) {
  return SUMMONS[id] || null;
}

export const SUMMON_COUNT = Object.keys(SUMMONS).length;
