/**
 * Fighter state machine constants + small helpers.
 *
 * World space convention used everywhere in combat/:
 *   - x grows RIGHT, y grows UP.
 *   - The floor is y = 0; a fighter's (x, y) is the point between their feet.
 *   - Ability `hitYOffset` is authored in screen space (negative = up), so the
 *     world centre of a hitbox is `fighter.y - ability.hitYOffset`.
 */

export const STATE = {
  INTRO: 'intro',
  IDLE: 'idle',
  WALK: 'walk',
  RUN: 'run',
  CROUCH: 'crouch',
  JUMP: 'jump',
  FALL: 'fall',
  LAND: 'land',
  DASH: 'dash',
  BACKDASH: 'backdash',
  AIRDASH: 'airdash',
  ATTACK: 'attack',
  CHARGE: 'charge',
  GUARD: 'guard',
  BLOCKSTUN: 'blockstun',
  GUARDBREAK: 'guardbreak',
  HITSTUN: 'hitstun',
  LAUNCHED: 'launched',
  KNOCKDOWN: 'knockdown',
  WAKEUP: 'wakeup',
  SUBSTITUTE: 'substitute',
  TRANSFORM: 'transform',
  KO: 'ko',
  VICTORY: 'victory',
};

/** States in which the fighter cannot start a new action. */
export const LOCKED_STATES = new Set([
  STATE.HITSTUN, STATE.LAUNCHED, STATE.KNOCKDOWN, STATE.BLOCKSTUN,
  STATE.GUARDBREAK, STATE.KO, STATE.INTRO, STATE.VICTORY,
  STATE.TRANSFORM, STATE.SUBSTITUTE,
]);

/** States that count as "being hit" for combo purposes. */
export const HIT_STATES = new Set([
  STATE.HITSTUN, STATE.LAUNCHED, STATE.KNOCKDOWN,
]);

/** States where a fighter is airborne. */
export const AIR_STATES = new Set([
  STATE.JUMP, STATE.FALL, STATE.AIRDASH,
]);

export function canAct(fighter) {
  if (LOCKED_STATES.has(fighter.state)) return false;
  if (fighter.act && !fighter.act.cancellable) return false;
  return true;
}

export function isAirborne(fighter) {
  return fighter.y > 0.5 || AIR_STATES.has(fighter.state);
}

/** Human-readable label, used by the training overlay. */
export function stateLabel(state) {
  return state.charAt(0).toUpperCase() + state.slice(1);
}
