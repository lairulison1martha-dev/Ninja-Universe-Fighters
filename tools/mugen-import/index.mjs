#!/usr/bin/env node
/**
 * MUGEN character import pipeline.
 *
 *   node tools/mugen-import/index.mjs imports/mugen/naruto --fighter naruto
 *   node tools/mugen-import/index.mjs imports/mugen/naruto --fighter naruto --dry-run
 *   node tools/mugen-import/index.mjs --audit          # the 110-fighter audit
 *
 * Runs, in order: inspect → validate → rights → DEF → SFF → AIR → CMD/CNS/ST →
 * map animations → map hitboxes → map moves → export to staging → report →
 * validate the output.
 *
 * It never writes outside `assets/import-staging/<fighter-id>/`, never
 * executes anything from a package, and never imports audio by default.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectPackage } from './package-inspector.mjs';
import { parseDef } from './parse-def.mjs';
import { parseSff } from './parse-sff.mjs';
import { parseAir, referencedSprites } from './parse-air.mjs';
import { parseCmd } from './parse-cmd.mjs';
import { parseCns, mergeCns } from './parse-cns.mjs';
import { parseSnd } from './parse-snd.mjs';
import { mapAnimations, GAME_CLIPS } from './animation-map.mjs';
import { mapHitboxes, validateBoxes, validateFrameReferences } from './hitbox-map.mjs';
import { mapMoves } from './move-map.mjs';
import { checkLicense, readDeclaredRights, STATUS } from './license-check.mjs';
import {
  buildSpriteSheet, buildPortrait, exportRawSprites, deriveSpriteScale,
} from './sprite-export.mjs';
import {
  prepareStaging, writeJson, writeBinary, writeText, buildFighterJson, assertFighterId,
} from './fighter-export.mjs';
import { buildComparison, comparisonMarkdown } from './comparison-report.mjs';
import { buildAudit } from './audit-report.mjs';
import { ImportError } from './limits.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Which existing transformation a package's name corresponds to, if any.
 *
 * A package called "Sage Naruto" is Naruto's sage form, not a new roster
 * entry. This maps it onto the transformation the game already has so nobody
 * is tempted to add a duplicate card.
 */
export function detectTransformation(characterName, fighterId, TRANSFORMATIONS) {
  if (!characterName) return null;
  const name = String(characterName).toLowerCase();
  const owned = Object.values(TRANSFORMATIONS).filter((t) => t.fighterId === fighterId);
  for (const t of owned) {
    const words = String(t.displayName || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.length && words.every((w) => name.includes(w))) return t.id;
  }
  // Common shorthands the display names do not spell out.
  const shorthand = [
    [/\bkcm\b|chakra\s*mode/, 'kcm'], [/\bems\b|eternal/, 'ems'], [/\bsage\b/, 'sage'],
    [/baryon/, 'baryon'], [/rinnegan/, 'rinnegan'], [/susanoo/, 'susanoo'],
    [/ten[- ]?tails|juubi/, 'tentails'], [/karma/, 'karma'], [/gate/, 'gate'],
  ];
  for (const [re, key] of shorthand) {
    if (!re.test(name)) continue;
    const hit = owned.find((t) => t.id.toLowerCase().includes(key));
    if (hit) return hit.id;
  }
  return null;
}

/** Parse a package end to end. No writes. */
export function analysePackage(packagePath, { fighterId = null } = {}) {
  const root = path.resolve(packagePath);
  const errors = [];
  const warnings = [];

  const inspection = inspectPackage(root);
  errors.push(...inspection.errors);
  warnings.push(...inspection.warnings);

  const declared = readDeclaredRights(root, inspection.files);
  let def = null;
  if (inspection.def) {
    try {
      def = parseDef(root, inspection.def, inspection.files);
      errors.push(...def.errors);
      warnings.push(...def.warnings);
    } catch (err) {
      errors.push(`DEF: ${err.message}`);
    }
  }

  const license = checkLicense(root, { defInfo: def, allFiles: inspection.files, declared });

  let sff = null;
  let air = null;
  let cmd = null;
  let cns = null;
  let snd = null;

  if (def?.sprite?.path) {
    try { sff = parseSff(root, def.sprite.path); errors.push(...sff.errors); warnings.push(...sff.warnings); }
    catch (err) { errors.push(`SFF: ${err.message}`); }
  }
  if (def?.anim?.path) {
    try { air = parseAir(root, def.anim.path); errors.push(...air.errors); warnings.push(...air.warnings); }
    catch (err) { errors.push(`AIR: ${err.message}`); }
  }
  if (def?.cmd?.path) {
    try { cmd = parseCmd(root, def.cmd.path); warnings.push(...cmd.warnings); }
    catch (err) { warnings.push(`CMD: ${err.message}`); }
  }

  // A .def routinely names the same file as both `cns` and `st`; parsing it
  // twice would report every state as a duplicate.
  const cnsPaths = [...new Set([
    def?.cns?.path,
    ...(def?.stateFiles || []).map((s) => s.path),
  ].filter(Boolean))];
  if (cnsPaths.length) {
    const parts = [];
    for (const p of cnsPaths) {
      try { parts.push(parseCns(root, p)); }
      catch (err) { warnings.push(`CNS ${p}: ${err.message}`); }
    }
    cns = mergeCns(parts);
    warnings.push(...cns.warnings);
  }
  if (def?.sound?.path) {
    try { snd = parseSnd(root, def.sound.path); warnings.push(...snd.warnings); }
    catch (err) { warnings.push(`SND: ${err.message}`); }
  }

  // Mapping.
  const animMap = air ? mapAnimations(air.animations, cns?.byNumber || null) : null;
  const clipFor = (action) => animMap?.mappings.find((m) => m.action === action)?.clip || null;
  const hitboxes = air
    ? mapHitboxes(air.animations, { coordScale: def?.coordScale ?? 1, clipFor })
    : null;
  const boxValidation = hitboxes ? validateBoxes(hitboxes) : null;
  const frameRefs = air && sff ? validateFrameReferences(air.animations, sff.byKey) : null;
  const moves = cns
    ? mapMoves(cns.states, {
      commands: cmd?.commands || [],
      stateEntries: cmd?.stateEntries || [],
      animsByNumber: air?.byNumber || new Map(),
    })
    : null;

  if (frameRefs && !frameRefs.ok) {
    warnings.push(`${frameRefs.missingCount} animation frame(s) reference a sprite that is not in the SFF`);
  }
  if (boxValidation && !boxValidation.ok) {
    warnings.push(...boxValidation.errors.slice(0, 10));
  }

  return {
    root, fighterId, inspection, def, license,
    sff, air, cmd, cns, snd,
    animMap, hitboxes, boxValidation, frameRefs, moves,
    referencedSprites: air ? referencedSprites(air.animations) : [],
    errors, warnings,
  };
}

/** Run the full import: analyse, then write staging artefacts. */
export async function importPackage(packagePath, fighterId, {
  dryRun = false, force = false, repoRoot = REPO_ROOT,
} = {}) {
  assertFighterId(fighterId);
  const result = analysePackage(packagePath, { fighterId });

  // Game data, for the comparison and the transformation check.
  const { installBrowserStubs } = await import('../../tests/helpers.js');
  installBrowserStubs();
  const { FIGHTERS } = await import('../../js/data/fighters.js');
  const { TRANSFORMATIONS } = await import('../../js/data/transformations.js');
  const { costumesFor } = await import('../../js/data/costumes.js');
  const { getAbility } = await import('../../js/data/abilities.js');

  if (!FIGHTERS[fighterId]) {
    throw new ImportError(
      `"${fighterId}" is not in the 110-fighter roster. This pipeline never creates roster entries.`,
      'UNKNOWN_FIGHTER',
    );
  }

  const formId = detectTransformation(
    result.def?.displayName || result.def?.name, fighterId, TRANSFORMATIONS,
  );
  if (formId) {
    result.warnings.push(
      `This package looks like an alternate form. Mapped to the existing transformation `
      + `"${formId}" — it must NOT become a new roster card.`,
    );
  }

  const comparison = buildComparison(repoRoot, fighterId, result, {
    FIGHTERS, costumesFor, TRANSFORMATIONS, getAbility,
  });

  const audit = buildAudit({
    fighterId,
    packagePath: path.relative(repoRoot, path.resolve(packagePath)),
    inspection: result.inspection,
    def: result.def,
    license: result.license,
    result,
  });
  audit.transformationMapping = formId;

  if (dryRun) return { ...result, comparison, audit, staged: null };

  // ---- staging -----------------------------------------------------------
  const base = prepareStaging(repoRoot, fighterId);
  const written = [];

  written.push(writeJson(base, 'reports/audit.json', audit));
  written.push(writeJson(base, 'reports/comparison.json', comparison));
  written.push(writeText(base, 'reports/comparison.md', comparisonMarkdown(comparison)));
  written.push(writeJson(base, 'reports/package-inspection.json', {
    ...result.inspection, files: result.inspection.files.slice(0, 500),
  }));

  if (result.def) written.push(writeJson(base, 'source/def.json', result.def));
  if (result.air) {
    written.push(writeJson(base, 'source/animations.json', {
      count: result.air.animations.length,
      animations: result.air.animations,
    }));
  }
  if (result.cmd) {
    written.push(writeJson(base, 'source/commands.json', {
      commands: result.cmd.commands, stateEntries: result.cmd.stateEntries,
    }));
  }
  if (result.cns) {
    written.push(writeJson(base, 'source/states.json', {
      count: result.cns.states.length,
      constants: result.cns.constants,
      states: result.cns.states,
    }));
  }
  if (result.snd) {
    written.push(writeJson(base, 'reports/sound-index.json', {
      ...result.snd,
      sounds: result.snd.sounds.slice(0, 500),
      note: 'Index only. No audio was extracted or imported. '
        + 'Importing MUGEN audio requires explicit, verified reuse rights.',
    }));
  }

  if (result.animMap) written.push(writeJson(base, 'converted/animation-map.json', result.animMap));
  if (result.hitboxes) {
    written.push(writeJson(base, 'converted/hitbox-map.json', {
      scale: result.hitboxes.scale,
      stats: result.hitboxes.stats,
      validation: result.boxValidation,
      frameReferences: result.frameRefs,
      animations: result.hitboxes.animations,
    }));
  }
  if (result.moves) written.push(writeJson(base, 'converted/move-map.json', result.moves));

  // Art is only written when rights allow it. Analysis is always written.
  let sheetMeta = null;
  const rightsOk = result.license.status === STATUS.APPROVED || force;
  if (result.sff && result.air && result.animMap && rightsOk) {
    const clips = {};
    for (const [clip, m] of Object.entries(result.animMap.byClip)) {
      const anim = result.air.byNumber.get(m.action);
      if (anim) clips[clip] = { action: m.action, frames: anim.frames };
    }
    // The ART scale is not the hitbox scale. Hitboxes convert MUGEN units to
    // the game's WORLD units (a fighter is ~158 tall there); the sheet has to
    // fit a 64x64 atlas cell, where a fighter is about 46 px. Using the hitbox
    // scale here upscales every sprite ~2.8x and clips most of it away.
    const scale = deriveSpriteScale(result.sff, clips);
    const sheet = buildSpriteSheet({ clips, sff: result.sff, order: GAME_CLIPS, scale });
    sheetMeta = sheet.meta;
    result.warnings.push(...sheet.warnings);
    written.push(writeBinary(base, 'converted/sprite-sheet.png', sheet.png));

    const idle = clips.idle?.frames?.[0];
    if (idle) {
      const portrait = buildPortrait(result.sff, idle.group, idle.image, { scale });
      if (portrait) written.push(writeBinary(base, 'converted/portrait.png', portrait));
    }
    written.push(writeJson(base, 'converted/fighter.json', buildFighterJson({
      fighterId, def: result.def, sheetMeta: sheet.meta,
      animationMap: result.animMap, license: result.license,
    })));
    const raw = exportRawSprites(result.sff, base);
    result.warnings.push(...raw.failures.slice(0, 10));
  } else if (result.sff) {
    written.push(writeText(base, 'converted/ART-NOT-EXPORTED.txt',
      `No artwork was exported.\n\nRights status: ${result.license.status}\n`
      + `${result.license.reasons.map((r) => `  - ${r}`).join('\n')}\n\n`
      + 'Analysis (animation, hitbox and move maps) is in this folder and is\n'
      + 'derived from timing data, not artwork. Sprites are only written when\n'
      + 'the rights check returns APPROVED.\n'));
  }

  // The package folder itself is git-ignored (and may be a temp directory), so
  // the staged README has to name the character on its own terms — a bare path
  // would leave a committed folder whose provenance nobody can check.
  writeText(base, 'README.md',
    `# Staged MUGEN import — ${fighterId}\n\n`
    + `Character: **${result.def?.displayName || result.def?.name || 'unknown'}**`
    + ` by ${result.license.creator || result.def?.author || 'unknown'}\n\n`
    + `Licence: ${result.license.license || 'not stated'}\n\n`
    + `Source package: \`${path.relative(repoRoot, path.resolve(packagePath))}\``
    + ' (not committed — see `imports/mugen/README.md`)\n\n'
    + `Rights status: **${result.license.status}** (${result.license.confidence} confidence)\n\n`
    + `Artwork exported: **${result.license.status === STATUS.APPROVED || force ? 'yes' : 'no'}**\n\n`
    + `Recommendation: **${comparison.recommendation}**\n\n`
    + 'Nothing here is used by the game. `assets/fighters/` is untouched.\n'
    + 'Promoting any of this into the live game is a separate, manual decision.\n');

  return { ...result, comparison, audit, staged: base, written, sheetMeta };
}

/* ------------------------------------------------------------------- CLI -- */

function usage() {
  console.log(`MUGEN import pipeline

  node tools/mugen-import/index.mjs --list-local
  node tools/mugen-import/index.mjs <package-dir> --fighter <id> [--dry-run] [--force]
  node tools/mugen-import/index.mjs --audit

Options
  --list-local    list the packages sitting in imports/mugen/ and say what the
                  importer could do with each. Reads only; writes nothing.
  --fighter <id>  a fighter id from the existing 110-fighter roster (required
                  for an import — this pipeline never creates roster entries)
  --dry-run       analyse and report, write nothing (alias: --analyse)
  --force         export art even when rights are not APPROVED (records why)
  --audit         run the roster-wide audit instead of an import
  --json          machine-readable output, for --list-local
  --dir <path>    where to look for local packages (default imports/mugen)

Typical use

  1. drop a downloaded character folder into imports/mugen/<name>/
  2. node tools/mugen-import/index.mjs --list-local
  3. node tools/mugen-import/index.mjs imports/mugen/<name> --fighter <id>

Staging output: assets/import-staging/<fighter-id>/
Live assets in assets/fighters/ are never modified by this tool.
Nothing here reaches the network — packages are read off local disk only.`);
}

async function main(argv) {
  const args = argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) { usage(); return 0; }

  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };

  if (args.includes('--list-local') || args.includes('--list')) {
    const { listLocalPackages, formatListing } = await import('./list-local.mjs');
    const listing = await listLocalPackages(REPO_ROOT, { dir: flag('--dir') || undefined });
    console.log(args.includes('--json')
      ? JSON.stringify(listing, null, 1)
      : formatListing(listing));
    return 0;
  }

  if (args.includes('--audit') || args.includes('--roster-audit')) {
    const { runRosterAudit } = await import('./roster-audit.mjs');
    const out = await runRosterAudit(REPO_ROOT);
    console.log(`\nWrote ${out.jsonPath}\nWrote ${out.mdPath}`);
    return 0;
  }

  const fighterIdx = args.indexOf('--fighter');
  const fighterId = fighterIdx >= 0 ? args[fighterIdx + 1] : null;
  // Skip flags and any value consumed by a flag — comparing against the
  // fighter id by value would lose a package folder that is simply called
  // `naruto`.
  const consumed = new Set();
  for (const name of ['--fighter', '--dir']) {
    const i = args.indexOf(name);
    if (i >= 0) { consumed.add(i); consumed.add(i + 1); }
  }
  const pkgIdx = args.findIndex((a, i) => !a.startsWith('--') && !consumed.has(i));
  const pkg = pkgIdx >= 0 ? args[pkgIdx] : null;
  if (!pkg || !fighterId) { usage(); return 1; }

  const dryRun = args.includes('--dry-run') || args.includes('--analyse') || args.includes('--analyze');
  const force = args.includes('--force');

  try {
    const r = await importPackage(pkg, fighterId, { dryRun, force });
    console.log(`\nMUGEN import — ${fighterId}`);
    console.log('='.repeat(52));
    console.log(`package            ${pkg}`);
    console.log(`character          ${r.def?.displayName || '—'} by ${r.def?.author || '—'}`);
    console.log(`rights             ${r.license.status} (${r.license.confidence} confidence)`);
    console.log(`sprite origin      ${r.license.spriteOrigin}`);
    console.log(`audio origin       ${r.license.audioOrigin} — never imported by default`);
    console.log(`SFF                v${r.sff?.version ?? '—'}, ${r.sff?.decodedCount ?? 0}/${r.sff?.spriteCount ?? 0} sprites decoded`);
    console.log(`AIR                ${r.air?.animations.length ?? 0} actions`);
    console.log(`CMD                ${r.cmd?.commands.length ?? 0} commands`);
    console.log(`CNS/ST             ${r.cns?.states.length ?? 0} states`);
    console.log(`clips mapped       ${r.animMap?.stats.clipsCovered ?? 0}/${GAME_CLIPS.length}`);
    console.log(`moves discovered   ${r.moves?.stats.total ?? 0} (${r.moves?.stats.manualRequired ?? 0} need manual mapping)`);
    console.log(`recommendation     ${r.comparison.recommendation}`);
    if (r.staged) console.log(`staged to          ${path.relative(REPO_ROOT, r.staged)}`);
    if (r.warnings.length) {
      console.log(`\nwarnings (${r.warnings.length}):`);
      for (const w of r.warnings.slice(0, 12)) console.log(`  - ${w}`);
    }
    if (r.errors.length) {
      console.log(`\nerrors (${r.errors.length}):`);
      for (const e of r.errors.slice(0, 12)) console.log(`  - ${e}`);
      return 1;
    }
    return 0;
  } catch (err) {
    console.error(`\nImport failed: ${err.message}`);
    if (!(err instanceof ImportError)) console.error(err.stack);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).then((code) => { process.exitCode = code; });
}

export default importPackage;
