/**
 * Guard: proximity blocking, guard meter, chip damage and guard break.
 */

import { COMBAT } from '../constants.js';
import { STATE } from './fighter-state.js';

/**
 * Can this fighter block the incoming attack right now?
 * Blocking requires: holding guard (or auto-guard), being able to act, and
 * facing roughly toward the attack.
 */
export function canBlock(defender, attackerX, ability) {
  if (ability.unblockable) return false;
  if (defender.state === STATE.KO) return false;
  if (defender.mods.autoGuard) return true;
  if (!defender.guardHeld) return false;
  if (defender.guardBroken) return false;
  // Must be facing the attack.
  const dir = Math.sign(attackerX - defender.x) || defender.facing;
  return dir === defender.facing;
}

/**
 * Apply a blocked hit.
 * @returns {{ chip: number, broke: boolean, blockStun: number, pushback: number }}
 */
export function applyBlock(defender, ability, attacker) {
  const guardStat = defender.data.baseStats.guard / 100;
  const mods = defender.mods;
  let guardDamage = ability.guardDamage / (guardStat * mods.guard);

  // Guard-pierce lets a fraction of the damage through the block.
  const pierce = attacker?.mods.guardPierce || 0;
  const chipRatio = ability.guardBreak ? 0.14 : 0.06;
  const chip = ability.damage * (chipRatio + pierce * 0.6);

  defender.guard = Math.max(0, defender.guard - guardDamage);
  const broke = defender.guard <= 0 || ability.guardBreak;
  if (broke) breakGuard(defender);

  const blockStun = broke ? COMBAT.guardBreakStun : ability.blockStun;
  const pushback = ability.knockbackX * 0.42;
  defender.stats.blocks++;
  return { chip, broke, blockStun, pushback };
}

export function breakGuard(defender) {
  defender.guard = 0;
  defender.guardBroken = true;
  defender.guardRecoverDelay = 1.6;
  defender.setState(STATE.GUARDBREAK, COMBAT.guardBreakStun);
}

/** Per-step guard meter regeneration. */
export function tickGuard(fighter, dt) {
  if (fighter.state === STATE.BLOCKSTUN || fighter.state === STATE.GUARDBREAK) return;
  if (fighter.guardRecoverDelay > 0) {
    fighter.guardRecoverDelay -= dt;
    return;
  }
  if (fighter.guard < COMBAT.guardMax) {
    const rate = COMBAT.guardRegen * (fighter.guardHeld ? 0.35 : 1) * fighter.passiveGuardRegen;
    fighter.guard = Math.min(COMBAT.guardMax, fighter.guard + rate * dt);
    if (fighter.guard > COMBAT.guardMax * 0.25) fighter.guardBroken = false;
  }
}
