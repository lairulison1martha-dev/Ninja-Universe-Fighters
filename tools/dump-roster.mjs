/**
 * Print the roster as JSON so the Python sprite tools can read the same data
 * the game does. Keeps one source of truth: fighter colours and proportions
 * live in js/data/fighters.js and nowhere else.
 *
 *   node tools/dump-roster.mjs > tools/roster.json
 */

import { FIGHTERS, FIGHTER_ORDER } from '../js/data/fighters.js';

const out = FIGHTER_ORDER.map((id) => {
  const f = FIGHTERS[id];
  return {
    id: f.id,
    displayName: f.displayName,
    shortName: f.shortName,
    complete: f.playableStatus === 'complete',
    archetype: f.archetype,
    era: f.era,
    village: f.village,
    colors: f.colors,
    visual: f.visual,
    transformations: f.transformations || [],
  };
});

process.stdout.write(JSON.stringify(out, null, 1));
