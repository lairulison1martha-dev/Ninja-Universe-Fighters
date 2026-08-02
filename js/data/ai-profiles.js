/**
 * AI personality profiles.
 *
 * These describe *preferences*, not cheats. The AI controller only ever reads
 * the same public battle state a player can see (positions, health, chakra,
 * whether the opponent is currently in an attack's active frames) and always
 * applies a per-difficulty reaction delay before acting on a change. It never
 * inspects the player's pending input buffer.
 */

export const AI_PROFILES = Object.create(null);

const DEFAULT_PROFILE = {
  /** Preferred distance band, in world units. */
  idealRange: [140, 320],
  /** 0..1 — how often it chooses to attack when in range. */
  aggression: 0.55,
  /** 0..1 — willingness to hold guard when threatened. */
  defence: 0.5,
  /** 0..1 — how much it likes throwing projectiles. */
  zoning: 0.4,
  /** 0..1 — chance it dashes in rather than walking. */
  dashiness: 0.4,
  /** 0..1 — how eagerly it jumps. */
  airiness: 0.25,
  /** 0..1 — likelihood of using a jutsu when off cooldown and in range. */
  jutsuUse: 0.5,
  /** 0..1 — how greedy it is about extending combos. */
  comboGreed: 0.5,
  /** Health fraction below which it plays defensively. */
  retreatBelow: 0.28,
  /** Awakening threshold at which it will consider transforming. */
  transformAt: 100,
  /** 0..1 — how tightly it saves the ultimate for a guaranteed punish. */
  ultimatePatience: 0.5,
  /** 0..1 — likelihood of substituting out of a combo (scaled by difficulty). */
  substitutionBias: 0.5,
  /** 0..1 — likelihood of using a guard counter on block. */
  counterBias: 0.35,
  description: '',
};

function profile(id, o) {
  AI_PROFILES[id] = { ...DEFAULT_PROFILE, ...o, id };
  return AI_PROFILES[id];
}

/* Generic archetype fallbacks (used by prototype fighters) ------------------ */
profile('balanced', { description: 'Even mix of pressure and patience.' });
profile('rusher', { idealRange: [60, 160], aggression: 0.86, zoning: 0.10, dashiness: 0.80, jutsuUse: 0.35, comboGreed: 0.75, defence: 0.30, description: 'Closes distance and refuses to leave.' });
profile('zoner', { idealRange: [380, 620], aggression: 0.30, zoning: 0.85, dashiness: 0.20, jutsuUse: 0.80, defence: 0.55, description: 'Keeps the fight at maximum range.' });
profile('turtle', { idealRange: [200, 380], aggression: 0.28, defence: 0.85, counterBias: 0.65, zoning: 0.45, dashiness: 0.15, description: 'Blocks, waits, punishes.' });
profile('bruiser', { idealRange: [80, 200], aggression: 0.72, defence: 0.48, comboGreed: 0.62, dashiness: 0.55, description: 'Trades willingly and wins most trades.' });
profile('counter', { idealRange: [150, 300], aggression: 0.42, defence: 0.72, counterBias: 0.75, substitutionBias: 0.7, description: 'Waits for a mistake.' });
profile('trapper', { idealRange: [300, 520], aggression: 0.34, zoning: 0.70, jutsuUse: 0.85, defence: 0.55, description: 'Sets up, then collects.' });
profile('aerial', { idealRange: [150, 340], airiness: 0.70, dashiness: 0.55, aggression: 0.62, description: 'Fights from above.' });
profile('puppet', { idealRange: [280, 480], zoning: 0.75, jutsuUse: 0.80, aggression: 0.35, description: 'Attacks from behind its constructs.' });
profile('summoner', { idealRange: [260, 460], zoning: 0.60, jutsuUse: 0.85, aggression: 0.42, description: 'Leans on summons for pressure.' });
profile('healer', { idealRange: [220, 400], aggression: 0.35, defence: 0.68, jutsuUse: 0.75, retreatBelow: 0.45, description: 'Disengages to heal, then re-engages.' });
profile('support', { idealRange: [240, 420], aggression: 0.40, jutsuUse: 0.70, defence: 0.58, description: 'Buffs and chips.' });
profile('weapon', { idealRange: [120, 280], aggression: 0.66, dashiness: 0.55, comboGreed: 0.6, description: 'Uses superior reach to poke.' });
profile('grappler', { idealRange: [60, 150], aggression: 0.78, dashiness: 0.62, defence: 0.45, description: 'Wants to be in throw range.' });
profile('defensive', { idealRange: [200, 400], aggression: 0.32, defence: 0.80, counterBias: 0.6, description: 'Holds ground.' });
profile('zoning', { idealRange: [340, 560], zoning: 0.80, aggression: 0.32, jutsuUse: 0.78, description: 'Space control.' });
profile('ranged', { idealRange: [360, 600], zoning: 0.82, aggression: 0.30, jutsuUse: 0.80, description: 'Fires from range.' });
profile('transformation', { idealRange: [140, 320], transformAt: 70, aggression: 0.60, description: 'Rushes to its awakened form.' });
profile('rushdown', { idealRange: [60, 160], aggression: 0.85, zoning: 0.12, dashiness: 0.78, description: 'Pressure first.' });

/* Named personalities for the complete fighters ----------------------------- */
profile('naruto', {
  idealRange: [110, 280], aggression: 0.70, zoning: 0.40, dashiness: 0.62,
  jutsuUse: 0.62, comboGreed: 0.68, transformAt: 75, ultimatePatience: 0.4,
  description: 'Applies constant clone pressure and transforms as soon as he can.',
});
profile('sasuke', {
  idealRange: [160, 340], aggression: 0.62, zoning: 0.55, dashiness: 0.60,
  jutsuUse: 0.70, counterBias: 0.45, ultimatePatience: 0.65,
  description: 'Pokes with the blade, converts with Chidori, saves Kirin for a punish.',
});
profile('sakura', {
  idealRange: [70, 180], aggression: 0.68, dashiness: 0.50, jutsuUse: 0.55,
  retreatBelow: 0.40, comboGreed: 0.45, description: 'Looks for one big opening, heals when it can.',
});
profile('kakashi', {
  idealRange: [180, 380], aggression: 0.50, defence: 0.68, zoning: 0.58,
  jutsuUse: 0.72, counterBias: 0.62, substitutionBias: 0.72, ultimatePatience: 0.7,
  description: 'Reads and answers. Uses Kamui to escape almost any punish.',
});
profile('lee', {
  idealRange: [50, 130], aggression: 0.94, zoning: 0.0, dashiness: 0.88,
  jutsuUse: 0.55, comboGreed: 0.82, defence: 0.24, transformAt: 45, retreatBelow: 0.12,
  description: 'Closes distance immediately and never voluntarily backs off.',
});
profile('gaara', {
  idealRange: [320, 560], aggression: 0.26, defence: 0.86, zoning: 0.80,
  dashiness: 0.12, jutsuUse: 0.84, counterBias: 0.5, retreatBelow: 0.35,
  description: 'Controls space, blocks automatically and punishes every approach.',
});
profile('itachi', {
  idealRange: [190, 380], aggression: 0.40, defence: 0.76, counterBias: 0.86,
  substitutionBias: 0.80, zoning: 0.52, jutsuUse: 0.68, ultimatePatience: 0.8,
  description: 'Counters and deceives. Baits attacks with clones instead of contesting them.',
});
profile('pain', {
  idealRange: [400, 680], aggression: 0.30, zoning: 0.90, dashiness: 0.10,
  airiness: 0.05, jutsuUse: 0.86, defence: 0.60, ultimatePatience: 0.6,
  description: 'Holds long range and punishes jumps with Almighty Push.',
});
profile('madara', {
  idealRange: [130, 320], aggression: 0.82, defence: 0.55, dashiness: 0.66,
  jutsuUse: 0.74, comboGreed: 0.70, transformAt: 60, ultimatePatience: 0.35,
  description: 'Pressures relentlessly and transforms up the chain as soon as each stage is legal.',
});
profile('boruto', {
  idealRange: [100, 320], aggression: 0.76, zoning: 0.52, dashiness: 0.84,
  airiness: 0.45, jutsuUse: 0.66, comboGreed: 0.62,
  description: 'Fast movement, constantly mixing between the Thunderclap Arrow and a dash-in.',
});
profile('kawaki', { idealRange: [90, 240], aggression: 0.74, defence: 0.55, jutsuUse: 0.60, counterBias: 0.60, comboGreed: 0.6, description: 'Absorbs ranged attacks, then walks you down.' });
profile('momoshiki', { idealRange: [200, 420], aggression: 0.52, counterBias: 0.80, jutsuUse: 0.70, zoning: 0.60, ultimatePatience: 0.7, description: 'Baits projectiles specifically so it can absorb them.' });
profile('minato', { idealRange: [160, 500], aggression: 0.60, dashiness: 0.88, counterBias: 0.70, jutsuUse: 0.78, substitutionBias: 0.72, description: 'Marks first, then teleports in and out constantly.' });
profile('hashirama', { idealRange: [220, 460], aggression: 0.48, defence: 0.72, jutsuUse: 0.82, zoning: 0.62, retreatBelow: 0.22, description: 'Outlasts. Uses terrain to force the fight to its preferred range.' });
profile('guy', { idealRange: [60, 160], aggression: 0.90, zoning: 0.0, dashiness: 0.85, transformAt: 40, comboGreed: 0.8, retreatBelow: 0.10, description: 'Opens gates early and commits completely.' });
profile('bee', { idealRange: [90, 240], aggression: 0.80, dashiness: 0.70, comboGreed: 0.78, airiness: 0.40, jutsuUse: 0.58, description: 'Unpredictable multi-hit rushdown that is hard to guard on reaction.' });
profile('obito', { idealRange: [170, 400], aggression: 0.56, counterBias: 0.82, substitutionBias: 0.78, jutsuUse: 0.70, zoning: 0.55, description: 'Phases through punishes, then hooks you back in.' });
profile('jiraiya', { idealRange: [300, 520], aggression: 0.38, zoning: 0.76, jutsuUse: 0.86, defence: 0.60, transformAt: 65, description: 'Sets traps and terrain first, brawls only in Sage Mode.' });
profile('orochimaru', { idealRange: [220, 420], aggression: 0.42, defence: 0.82, jutsuUse: 0.78, retreatBelow: 0.42, counterBias: 0.55, description: 'Chips with poison and refuses to die.' });
profile('tsunade', { idealRange: [70, 180], aggression: 0.70, dashiness: 0.48, comboGreed: 0.42, retreatBelow: 0.38, jutsuUse: 0.58, description: 'Hunts for a single opening; heals when the fight resets.' });

export function getAIProfile(id) {
  return AI_PROFILES[id] || AI_PROFILES.balanced;
}
