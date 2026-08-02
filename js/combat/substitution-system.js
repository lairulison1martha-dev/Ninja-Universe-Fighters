/**
 * Substitution — the escape mechanic.
 *
 * Costs a stock AND chakra, so escaping every combo empties you. Stocks
 * regenerate slowly over the round.
 */

import { COMBAT } from '../constants.js';
import { STATE, HIT_STATES } from './fighter-state.js';

/** Can this fighter substitute right now? */
export function canSubstitute(fighter) {
  if (fighter.substitutionsDisabled) return false;
  if (fighter.subStocks < 1) return false;
  if (fighter.chakra < COMBAT.substitutionCost) return false;
  if (fighter.state === STATE.KO) return false;
  // Only useful while being hit or in block-stun.
  return HIT_STATES.has(fighter.state) || fighter.state === STATE.BLOCKSTUN;
}

/**
 * Perform the substitution: consume resources, become briefly invulnerable and
 * reposition behind/away from the opponent.
 */
export function substitute(fighter, opponent, effects) {
  if (!canSubstitute(fighter)) return false;

  fighter.subStocks -= 1;
  fighter.chakra -= COMBAT.substitutionCost;
  fighter.stats.substitutions++;
  fighter.combo.end();

  effects?.emit('substitute_puff', fighter.x, fighter.y + 70, { scale: 1.1 });

  // Reappear on the far side of the opponent, at a punish-safe distance.
  const dir = Math.sign(fighter.x - opponent.x) || 1;
  fighter.x = opponent.x + dir * 240;
  fighter.y = 0;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.facing = -dir;
  fighter.setState(STATE.SUBSTITUTE, 0.28);
  fighter.invulnUntil = fighter.time + 0.42;
  fighter.hitLock = null;

  effects?.emit('substitute_puff', fighter.x, fighter.y + 70, { scale: 1.1 });
  return true;
}

/** Regenerate stocks over time. */
export function tickSubstitution(fighter, dt) {
  if (fighter.substitutionsDisabled) return;
  if (fighter.subStocks >= fighter.maxSubStocks) { fighter.subRegen = 0; return; }
  fighter.subRegen += dt;
  const need = COMBAT.substitutionRegenTime * (100 / fighter.data.baseStats.substitution);
  if (fighter.subRegen >= need) {
    fighter.subRegen = 0;
    fighter.subStocks = Math.min(fighter.maxSubStocks, fighter.subStocks + 1);
  }
}

/** Fraction toward the next stock, for the HUD. */
export function substitutionProgress(fighter) {
  const need = COMBAT.substitutionRegenTime * (100 / fighter.data.baseStats.substitution);
  return Math.min(1, fighter.subRegen / need);
}
