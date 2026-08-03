/**
 * Print every transformation as JSON so the Python art tools can read the same
 * data the game does — id, owner, display name, aura colour and chain position.
 *
 *   node tools/dump-transformations.mjs > tools/transformations.json
 */

import { FIGHTERS, FIGHTER_ORDER } from '../js/data/fighters.js';
import { TRANSFORMATIONS } from '../js/data/transformations.js';
import { costumesFor } from '../js/data/costumes.js';

const forms = [];
for (const fighterId of FIGHTER_ORDER) {
  const chain = FIGHTERS[fighterId].transformations || [];
  chain.forEach((formId, index) => {
    const t = TRANSFORMATIONS[formId];
    if (!t) return;
    forms.push({
      id: formId,
      fighterId,
      displayName: t.displayName,
      auraColor: t.auraColor,
      index,
      chainLength: chain.length,
      permanent: !!t.permanent,
    });
  });
}

const costumes = [];
for (const fighterId of FIGHTER_ORDER) {
  for (const c of costumesFor(fighterId)) {
    if (c.id === 'default') continue;
    costumes.push({ fighterId, id: c.id, name: c.name });
  }
}

process.stdout.write(JSON.stringify({ forms, costumes }, null, 1));
