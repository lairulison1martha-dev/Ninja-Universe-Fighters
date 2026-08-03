/**
 * Asset manifest and developer report.
 *
 *   node tools/asset-report.mjs           # print the report
 *   node tools/asset-report.mjs --write   # also write assets/asset-manifest.json
 *
 * Walks every fighter, every costume and every transformation, checks what art
 * is actually on disk, and states plainly which of them are finished, which are
 * running on a fallback, and which animations are missing. It reads the same
 * data the game reads, so the report cannot flatter the build.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Node needs the browser stubs to import the game's data modules.
const { installBrowserStubs } = await import('../tests/helpers.js');
installBrowserStubs();

const { FIGHTERS, FIGHTER_ORDER } = await import('../js/data/fighters.js');
const { TRANSFORMATIONS } = await import('../js/data/transformations.js');
const { costumesFor } = await import('../js/data/costumes.js');
const { REQUIRED_ANIMATIONS, missingAnimations } = await import('../js/combat/sprite-animator.js');

const STATUS = { COMPLETE: 'complete', PLACEHOLDER: 'placeholder', FALLBACK: 'fallback' };

function readMeta(relDir) {
  const p = path.join(ROOT, relDir, 'fighter.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function inspect({ fighterId, costumeId, transformationId, dir, fallbackTo }) {
  const spritePath = `${dir}/sprite-sheet.png`;
  const portraitPath = `${dir}/portrait.png`;
  const meta = readMeta(dir);
  const hasSprite = fs.existsSync(path.join(ROOT, spritePath));
  const hasPortrait = fs.existsSync(path.join(ROOT, portraitPath));

  let status = STATUS.FALLBACK;
  let missing = Object.keys(REQUIRED_ANIMATIONS);
  let fallback = fallbackTo;

  if (meta && hasSprite) {
    missing = missingAnimations(meta);
    // "Complete" means the art is there AND every required animation is in it.
    // Anything short of that is a placeholder, never a completion.
    status = missing.length === 0 ? STATUS.COMPLETE : STATUS.PLACEHOLDER;
    fallback = null;
  }

  return {
    fighterId,
    costumeId: costumeId ?? null,
    transformationId: transformationId ?? null,
    spritePath,
    portraitPath,
    assetStatus: status,
    fallbackTo: fallback,
    hasPortrait,
    missingAnimations: missing,
  };
}

const entries = [];

for (const fighterId of FIGHTER_ORDER) {
  // Base set.
  entries.push(inspect({
    fighterId,
    costumeId: 'default',
    dir: `assets/fighters/${fighterId}`,
    fallbackTo: 'procedural renderer',
  }));

  // Costumes. `default` is the base set, already covered above.
  for (const costume of costumesFor(fighterId)) {
    if (costume.id === 'default') continue;
    entries.push(inspect({
      fighterId,
      costumeId: costume.id,
      dir: `assets/fighters/${fighterId}/costumes/${costume.id}`,
      fallbackTo: `assets/fighters/${fighterId} (base fighter art)`,
    }));
  }

  // Transformations.
  for (const formId of FIGHTERS[fighterId].transformations || []) {
    const form = TRANSFORMATIONS[formId];
    if (!form) continue;
    entries.push(inspect({
      fighterId,
      transformationId: formId,
      dir: `assets/fighters/${fighterId}/forms/${formId}`,
      fallbackTo: 'selected costume, then base fighter art',
    }));
  }
}

const groups = {
  complete: entries.filter((e) => e.assetStatus === STATUS.COMPLETE),
  placeholder: entries.filter((e) => e.assetStatus === STATUS.PLACEHOLDER),
  fallback: entries.filter((e) => e.assetStatus === STATUS.FALLBACK),
};
const missingAnims = entries.filter(
  (e) => e.assetStatus !== STATUS.FALLBACK && e.missingAnimations.length > 0,
);

const manifest = {
  generator: 'tools/asset-report.mjs',
  generatedFrom: 'the game data — js/data/fighters.js, costumes.js, transformations.js',
  requiredAnimations: Object.keys(REQUIRED_ANIMATIONS),
  totals: {
    entries: entries.length,
    fighters: FIGHTER_ORDER.length,
    costumes: entries.filter((e) => e.costumeId && e.costumeId !== 'default').length,
    transformations: entries.filter((e) => e.transformationId).length,
    complete: groups.complete.length,
    functionalWithFallback: groups.fallback.length,
    missingArtwork: groups.fallback.length,
    missingAnimations: missingAnims.length,
  },
  entries,
};

if (process.argv.includes('--write')) {
  const out = path.join(ROOT, 'assets', 'asset-manifest.json');
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`wrote ${path.relative(ROOT, out)}`);
}

/* ------------------------------------------------------------- the report */

const label = (e) => (e.transformationId
  ? `${e.fighterId} / form ${e.transformationId}`
  : `${e.fighterId} / costume ${e.costumeId}`);

console.log('\nNinja Universe Fighters — asset report');
console.log('='.repeat(52));
console.log(`entries          ${entries.length}`);
console.log(`  fighters       ${FIGHTER_ORDER.length}`);
console.log(`  costumes       ${manifest.totals.costumes}`);
console.log(`  transformations${String(manifest.totals.transformations).padStart(4)}`);

console.log(`\nFULLY COMPLETE                    ${groups.complete.length}`);
console.log('  own sprite set, every required animation present');

console.log(`\nFUNCTIONAL WITH FALLBACK          ${groups.fallback.length}`);
console.log('  no art of its own — renders with the next set down, by design');
const byFighter = new Map();
for (const e of groups.fallback) {
  byFighter.set(e.fighterId, (byFighter.get(e.fighterId) || 0) + 1);
}
const worst = [...byFighter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
for (const [fid, n] of worst) console.log(`    ${fid.padEnd(14)} ${n} awaiting art`);

console.log(`\nMISSING ARTWORK                   ${groups.fallback.length}`);
console.log('  (same set: a fallback IS the missing-artwork list)');
if (groups.fallback.length === 0) {
  console.log('  none — every costume and every transformation has its own art');
}

console.log(`\nMISSING ANIMATIONS                ${missingAnims.length}`);
if (missingAnims.length) {
  for (const e of missingAnims.slice(0, 20)) {
    console.log(`    ${label(e)}: ${e.missingAnimations.join(', ')}`);
  }
} else {
  console.log('  none — every set that exists has all 18 required animations');
}

const ownCostumes = groups.complete.filter((x) => x.costumeId && x.costumeId !== 'default');
const ownForms = groups.complete.filter((x) => x.transformationId);
console.log(`\nCOSTUMES WITH THEIR OWN ART       ${ownCostumes.length}`);
console.log(`TRANSFORMATIONS WITH THEIR OWN ART${String(ownForms.length).padStart(4)}`);
console.log(`BASE FIGHTER SETS                 ${groups.complete.filter((x) => x.costumeId === 'default').length}`);

// Two sets must never share a sheet — that would be one body wearing two names.
const paths = new Map();
const shared = [];
for (const e of entries) {
  if (paths.has(e.spritePath)) shared.push(`${e.spritePath} used by two entries`);
  paths.set(e.spritePath, e);
}
console.log(`\nSHARED SPRITE PATHS               ${shared.length}`);
for (const s of shared.slice(0, 10)) console.log(`    ${s}`);
console.log('');
