/**
 * Development asset reporting.
 *
 * Costumes and transformations can render with art of their own, or fall back
 * to the fighter's base sheet. The fallback is a legitimate, designed state —
 * it must never crash and must never be visible to a normal player as an error
 * — but it also must never be mistaken for finished work. So every fallback is
 * recorded here once, surfaced to the console in development, and summarised
 * by tools/asset-report.mjs.
 *
 * Nothing in this module affects gameplay. It is observation only.
 */

/** Fallbacks seen this session, keyed so each one is reported once. */
const seen = new Map();

/**
 * Development mode: localhost, a file:// page, or `?devassets=1`.
 * Normal players on GitHub Pages never see the warnings.
 */
function isDev() {
  if (typeof globalThis.location === 'undefined') return false;
  const { hostname, search, protocol } = globalThis.location;
  if (protocol === 'file:') return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') return true;
  return /[?&]devassets=1\b/.test(search || '');
}

/**
 * Record that a sprite set was requested and something less specific was used.
 *
 * @param {string} fighterId
 * @param {{ level: 'costume'|'transformation', want: string, used: string|null }} info
 */
export function reportSpriteFallback(fighterId, info) {
  const key = `${fighterId}:${info.level}:${info.want}`;
  if (seen.has(key)) {
    seen.get(key).count++;
    return;
  }
  const entry = { fighterId, ...info, count: 1 };
  seen.set(key, entry);
  if (isDev()) {
    console.warn(
      `[assets] ${info.level} sprite set "${info.want}" is not loaded — `
      + `rendering ${fighterId} with "${info.used || 'the procedural fallback'}". `
      + 'This is a tracked fallback, not finished artwork.',
    );
  }
}

/** Every fallback recorded so far. */
export function spriteFallbacks() {
  return [...seen.values()];
}

/** True when anything fell back — used by the select screen's dev badge. */
export function hasSpriteFallbacks() {
  return seen.size > 0;
}

export function clearSpriteFallbacks() {
  seen.clear();
}

export const assetDevMode = isDev;

export default { reportSpriteFallback, spriteFallbacks, hasSpriteFallbacks };
