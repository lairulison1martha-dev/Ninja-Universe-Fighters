/**
 * Per-fighter assist actions.
 *
 * Every one of the 110 playable fighters can be called as an assist, so this
 * is a record per fighter rather than a second roster. The assist reuses that
 * fighter's own art, own costume and one of their own abilities out of the
 * ability registry — nothing here invents a move.
 *
 * Record shape (the fields the brief asked for, plus the two the combat code
 * needs to run it):
 *
 *   abilityId    an ability in the registry, used for damage, reach, hitbox,
 *                effect and sound. Signature techniques for the twenty
 *                hand-authored fighters; the archetype template for the rest.
 *   cooldown     seconds before the assist can be called again
 *   duration     total seconds on screen: entry + action + exit
 *   entryStyle   how they arrive   — dash | leap | shunshin | rise | drop
 *   exitStyle    how they leave    — dash | leap | shunshin | sink
 *   aiBehavior   what the call is for — strike | zone | trap | support
 *   chakraCost   what calling them costs the main fighter
 *
 * `entryStyle` / `exitStyle` drive the assist's movement and which animation
 * clip plays; `aiBehavior` drives where they are placed relative to the
 * opponent. None of them add a new sprite architecture.
 */

import { FIGHTERS, FIGHTER_ORDER } from './fighters.js';
import { getAbility } from './abilities.js';

const ENTRY_STYLES = ['dash', 'leap', 'shunshin', 'rise', 'drop'];
const EXIT_STYLES = ['dash', 'leap', 'shunshin', 'sink'];
const AI_BEHAVIORS = ['strike', 'zone', 'trap', 'support'];

/**
 * Hand-authored assists for the twenty fighters with complete kits.
 * Each names one of that fighter's own signature techniques.
 */
const SIGNATURE = {
  naruto: { abilityId: 'naruto_rasengan', entryStyle: 'dash', exitStyle: 'shunshin', aiBehavior: 'strike', cooldown: 12 },
  sasuke: { abilityId: 'sasuke_chidori', entryStyle: 'shunshin', exitStyle: 'shunshin', aiBehavior: 'strike', cooldown: 12 },
  sakura: { abilityId: 'sakura_ground_smash', entryStyle: 'drop', exitStyle: 'leap', aiBehavior: 'strike', cooldown: 13 },
  kakashi: { abilityId: 'kakashi_heavy', entryStyle: 'dash', exitStyle: 'shunshin', aiBehavior: 'strike', cooldown: 12 },
  lee: { abilityId: 'lee_heavy', entryStyle: 'leap', exitStyle: 'leap', aiBehavior: 'strike', cooldown: 11 },
  gaara: { abilityId: 'gaara_sand_tsunami', entryStyle: 'rise', exitStyle: 'sink', aiBehavior: 'zone', cooldown: 14 },
  itachi: { abilityId: 'itachi_fireball', entryStyle: 'shunshin', exitStyle: 'shunshin', aiBehavior: 'zone', cooldown: 13 },
  pain: { abilityId: 'pain_heavy', entryStyle: 'drop', exitStyle: 'leap', aiBehavior: 'strike', cooldown: 14 },
  madara: { abilityId: 'madara_majestic_destroyer_flame', entryStyle: 'leap', exitStyle: 'leap', aiBehavior: 'zone', cooldown: 15 },
  boruto: { abilityId: 'boruto_vanishing_rasengan', entryStyle: 'dash', exitStyle: 'dash', aiBehavior: 'strike', cooldown: 11 },
  kawaki: { abilityId: 'kawaki_body_blade', entryStyle: 'dash', exitStyle: 'dash', aiBehavior: 'strike', cooldown: 12 },
  momoshiki: { abilityId: 'momoshiki_elemental_barrage', entryStyle: 'rise', exitStyle: 'leap', aiBehavior: 'zone', cooldown: 15 },
  minato: { abilityId: 'minato_flying_raijin', entryStyle: 'shunshin', exitStyle: 'shunshin', aiBehavior: 'strike', cooldown: 11 },
  hashirama: { abilityId: 'hashirama_wood_dragon', entryStyle: 'rise', exitStyle: 'sink', aiBehavior: 'zone', cooldown: 15 },
  guy: { abilityId: 'guy_dash', entryStyle: 'dash', exitStyle: 'leap', aiBehavior: 'strike', cooldown: 12 },
  bee: { abilityId: 'bee_heavy', entryStyle: 'dash', exitStyle: 'dash', aiBehavior: 'strike', cooldown: 13 },
  obito: { abilityId: 'obito_fireball', entryStyle: 'shunshin', exitStyle: 'shunshin', aiBehavior: 'zone', cooldown: 13 },
  jiraiya: { abilityId: 'jiraiya_toad_oil_flame', entryStyle: 'leap', exitStyle: 'leap', aiBehavior: 'zone', cooldown: 14 },
  orochimaru: { abilityId: 'orochimaru_hidden_shadow_snakes', entryStyle: 'rise', exitStyle: 'sink', aiBehavior: 'trap', cooldown: 13 },
  tsunade: { abilityId: 'tsunade_ground_shatter', entryStyle: 'drop', exitStyle: 'leap', aiBehavior: 'strike', cooldown: 14 },
};

/**
 * How a prototype fighter's archetype becomes an assist. They use their own
 * archetype template ability, so a prototype assist is still that fighter
 * doing that fighter's kind of thing — it is simply not individually authored.
 */
const BY_ARCHETYPE = {
  balanced: { slot: 'jutsu1', entryStyle: 'dash', exitStyle: 'shunshin', aiBehavior: 'strike' },
  rushdown: { slot: 'jutsu1', entryStyle: 'dash', exitStyle: 'dash', aiBehavior: 'strike' },
  ranged: { slot: 'jutsu2', entryStyle: 'shunshin', exitStyle: 'shunshin', aiBehavior: 'zone' },
  zoning: { slot: 'jutsu2', entryStyle: 'rise', exitStyle: 'sink', aiBehavior: 'zone' },
  defensive: { slot: 'jutsu1', entryStyle: 'rise', exitStyle: 'sink', aiBehavior: 'trap' },
  grappler: { slot: 'jutsu1', entryStyle: 'drop', exitStyle: 'leap', aiBehavior: 'strike' },
  support: { slot: 'jutsu1', entryStyle: 'shunshin', exitStyle: 'shunshin', aiBehavior: 'support' },
  healer: { slot: 'jutsu1', entryStyle: 'shunshin', exitStyle: 'shunshin', aiBehavior: 'support' },
  summoner: { slot: 'jutsu2', entryStyle: 'rise', exitStyle: 'sink', aiBehavior: 'zone' },
  transformation: { slot: 'jutsu1', entryStyle: 'leap', exitStyle: 'leap', aiBehavior: 'strike' },
  puppet: { slot: 'jutsu2', entryStyle: 'rise', exitStyle: 'sink', aiBehavior: 'trap' },
  weapon: { slot: 'jutsu2', entryStyle: 'dash', exitStyle: 'dash', aiBehavior: 'zone' },
  counter: { slot: 'jutsu1', entryStyle: 'shunshin', exitStyle: 'shunshin', aiBehavior: 'trap' },
  aerial: { slot: 'jutsu1', entryStyle: 'leap', exitStyle: 'leap', aiBehavior: 'strike' },
};

/** Stable per-fighter jitter so two prototypes of one archetype still differ. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function build(fighterId) {
  const f = FIGHTERS[fighterId];
  const sig = SIGNATURE[fighterId];
  const arch = BY_ARCHETYPE[f.archetype] || BY_ARCHETYPE.balanced;

  let abilityId = sig?.abilityId;
  if (!abilityId) {
    // The fighter's own jutsu slot, which for a prototype is their archetype
    // template. Fall back down the kit so every fighter resolves to something.
    const slots = f.abilities || [];
    abilityId = (arch.slot === 'jutsu2' ? slots[1] : slots[0]) || slots[0] || f.heavy || f.ultimate;
  }
  if (!getAbility(abilityId)) abilityId = f.heavy || f.ultimate;

  const h = hash(fighterId);
  // 10–15 s, as specified, nudged by the fighter's own power so a heavy hitter
  // waits longer than a quick striker.
  const power = (f.baseStats.attack + f.baseStats.chakraControl) / 200;
  const base = sig?.cooldown ?? Math.round((10 + power * 4 + (h % 3)) * 10) / 10;
  const cooldown = Math.max(10, Math.min(15, base));

  const ability = getAbility(abilityId);
  return Object.freeze({
    fighterId,
    abilityId,
    displayName: ability?.displayName || 'Assist',
    cooldown,
    duration: sig?.duration ?? 1.5,
    entryStyle: sig?.entryStyle ?? arch.entryStyle,
    exitStyle: sig?.exitStyle ?? arch.exitStyle,
    aiBehavior: sig?.aiBehavior ?? arch.aiBehavior,
    chakraCost: sig?.chakraCost ?? 18,
    authored: !!sig,
  });
}

/** fighterId -> assist record. Every playable fighter has exactly one. */
export const FIGHTER_ASSISTS = Object.create(null);
for (const id of FIGHTER_ORDER) FIGHTER_ASSISTS[id] = build(id);

/** The assist record for a fighter, or null for an unknown id. */
export function assistFor(fighterId) {
  return FIGHTER_ASSISTS[fighterId] || null;
}

/**
 * Who may be picked as the assist for a given main fighter.
 *
 * The whole roster is eligible — there is no separate assist-only cast. The
 * main fighter is excluded from their own assist slot unless duplicates are
 * explicitly allowed, which is the hook the brief asked to leave open.
 */
export function eligibleAssists(mainFighterId, { allowDuplicate = false } = {}) {
  return FIGHTER_ORDER.filter((id) => allowDuplicate || id !== mainFighterId);
}

/** True when this pairing is legal. */
export function canAssist(mainFighterId, assistId, { allowDuplicate = false } = {}) {
  if (!assistId) return true;               // "no assist" is always valid
  if (!FIGHTER_ASSISTS[assistId]) return false;
  if (!allowDuplicate && assistId === mainFighterId) return false;
  return true;
}

export { ENTRY_STYLES, EXIT_STYLES, AI_BEHAVIORS };
