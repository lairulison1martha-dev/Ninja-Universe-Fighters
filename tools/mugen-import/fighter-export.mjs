/**
 * Staging export.
 *
 * Everything an import produces lands under
 * `assets/import-staging/<fighter-id>/` and nowhere else. Live art in
 * `assets/fighters/` is never touched by this pipeline — a human copies
 * things across after reading the comparison report, or does not.
 *
 *   source/      what came out of the package, unmodified in meaning
 *   converted/   the game-shaped artefacts
 *   reports/     the analysis
 */

import fs from 'node:fs';
import path from 'node:path';
import { safeStagingPath, ImportError } from './limits.mjs';

export const STAGING_ROOT = 'assets/import-staging';

/** Fighter ids are used as directory names, so they are strictly validated. */
export function assertFighterId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9_]{1,40}$/.test(id)) {
    throw new ImportError(
      `Invalid fighter id "${id}" — expected lowercase letters, digits and underscores`,
      'BAD_FIGHTER_ID',
    );
  }
  return id;
}

/**
 * Where one import's output lives, relative to the staging root.
 *
 * A base import goes to `<fighter-id>/`. A transformation goes to
 * `<fighter-id>/forms/<form-id>/` and a costume to
 * `<fighter-id>/costumes/<costume-id>/`, so an alternate form never lands
 * where the base fighter's import would and never looks like a roster entry
 * of its own. A second package for the same target goes under
 * `<fighter-id>/candidates/<package-id>/` rather than overwriting the first.
 *
 * Every segment is validated with the same rules as a fighter id, so a
 * package cannot steer its own output anywhere via a crafted name.
 */
export function stagingSubpath(fighterId, { formId = null, costumeId = null, candidateId = null } = {}) {
  assertFighterId(fighterId);
  const parts = [fighterId];
  if (formId) parts.push('forms', assertFighterId(formId));
  else if (costumeId) parts.push('costumes', assertFighterId(costumeId));
  if (candidateId) parts.push('candidates', assertFighterId(candidateId));
  return parts.join('/');
}

/**
 * Create the staging tree for one import.
 *
 * @param {string} repoRoot
 * @param {string} fighterId
 * @param {string|null} subpath a path under the staging root, from
 *   `stagingSubpath()`. Defaults to the fighter id.
 */
export function prepareStaging(repoRoot, fighterId, subpath = null) {
  assertFighterId(fighterId);
  const rel = subpath || fighterId;
  // Every segment must look like an id, and the result must resolve inside
  // the staging root — belt and braces, because `subpath` can come from a
  // package's own name.
  for (const seg of rel.split('/')) {
    if (!['forms', 'costumes', 'candidates'].includes(seg)) assertFighterId(seg);
  }
  const stagingRoot = path.resolve(repoRoot, STAGING_ROOT);
  const base = safeStagingPath(stagingRoot, rel);
  for (const sub of ['source', 'converted', 'reports']) {
    fs.mkdirSync(path.join(base, sub), { recursive: true });
  }
  return base;
}

/** Write a JSON artefact into staging. */
export function writeJson(stagingBase, relPath, data) {
  const out = safeStagingPath(stagingBase, relPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);
  return out;
}

/** Write a binary artefact into staging. */
export function writeBinary(stagingBase, relPath, buffer) {
  const out = safeStagingPath(stagingBase, relPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buffer);
  return out;
}

/** Write a text artefact into staging. */
export function writeText(stagingBase, relPath, text) {
  const out = safeStagingPath(stagingBase, relPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  return out;
}

/**
 * Build the `fighter.json` the game's sprite loader expects.
 *
 * Deliberately marked as staged: `assetStatus` is `imported-staged`, never
 * `complete`, so nothing downstream can mistake an unapproved import for
 * finished artwork.
 */
export function buildFighterJson({ fighterId, def, sheetMeta, animationMap, license }) {
  const animations = {};
  for (const [clip, info] of Object.entries(sheetMeta.animations)) {
    animations[clip] = {
      row: info.row,
      frames: info.frames,
      durations: info.durations,
      sourceAction: info.sourceAction,
    };
  }
  return {
    id: `${fighterId}__mugen_import`,
    fighterId,
    variant: 'mugen-import',
    assetStatus: 'imported-staged',
    spriteSheet: 'converted/sprite-sheet.png',
    portrait: 'converted/portrait.png',
    cell: sheetMeta.cell,
    anchor: sheetMeta.anchor,
    sheetWidth: sheetMeta.width,
    sheetHeight: sheetMeta.height,
    frames: sheetMeta.drawnFrames,
    animations,
    source: {
      kind: 'mugen',
      characterName: def?.displayName || def?.name || null,
      author: def?.author || null,
      mugenVersion: def?.mugenVersion || null,
      versionDate: def?.versionDate || null,
      localcoord: def?.localcoord || null,
    },
    rights: {
      status: license?.status || 'MANUAL_REVIEW',
      license: license?.license || null,
      creator: license?.creator || null,
      reuseAllowed: license?.reuseAllowed ?? null,
      audioImported: false,
    },
    /** Staged art is never live until a human moves it. */
    approvedForLive: false,
    generatedAt: new Date().toISOString(),
    animationCount: Object.keys(animations).length,
    note: 'Staged MUGEN import. Not used by the game. '
      + 'See reports/ before considering any of this for assets/fighters/.',
  };
}

export default prepareStaging;
