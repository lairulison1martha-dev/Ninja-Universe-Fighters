/**
 * What is sitting in `imports/mugen/` right now?
 *
 * A human downloads MUGEN character folders and drops them in there. This
 * looks at each one and answers the questions you need before running an
 * import: what is it, who made it, does it carry any terms, which roster
 * fighter is it for, and can the importer actually do anything with it.
 *
 * It is deliberately cheap. It walks the package, reads the `.def` and any
 * rights documents, and stops — no SFF decoding, no sprite work, nothing
 * written to disk. Listing forty packages should cost about as much as
 * listing one.
 *
 * It never reaches the network. Everything here comes off the local disk.
 */

import fs from 'node:fs';
import path from 'node:path';
import { inspectPackage } from './package-inspector.mjs';
import { parseDef } from './parse-def.mjs';
import { checkLicense, readDeclaredRights, STATUS } from './license-check.mjs';
import { ImportError } from './limits.mjs';

export const LOCAL_DIR = 'imports/mugen';

/**
 * Import readiness, worst first.
 *
 *   BLOCKED           the importer cannot run: no character .def, or nothing
 *                     readable in the folder.
 *   REJECTED          rights say no. The importer will still parse it and
 *                     write its analysis, but it will export no artwork.
 *   NEEDS_FIGHTER_ID  parseable, but no roster fighter is obvious. `--fighter`
 *                     has to be chosen by hand — the pipeline never invents
 *                     a roster entry to hold it.
 *   ANALYSIS_ONLY     parseable and targeted, but the terms are not clear
 *                     enough to approve artwork. Timing, hitboxes and move
 *                     data will be staged; sprites will not.
 *   READY_TO_IMPORT   rights are APPROVED and the target is known.
 */
export const READINESS = Object.freeze([
  'BLOCKED', 'REJECTED', 'NEEDS_FIGHTER_ID', 'ANALYSIS_ONLY', 'READY_TO_IMPORT',
]);

/** Words worth matching on. Drops "the", "of", and initials. */
function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/**
 * Which roster fighter is this package for?
 *
 * Whole-token matching only. Substring matching would have "sai" hit
 * "mosaic" and every folder called `naruto_shippuden_pack` claim four
 * different fighters, so a token has to match a fighter id or a whole word of
 * their display name.
 *
 * Two fighters matching is reported as ambiguous, not resolved by guessing —
 * picking one silently is how the wrong character ends up staged.
 */
export function matchFighter(folderName, characterName, FIGHTERS) {
  const folderTokens = tokens(folderName);
  const nameTokens = tokens(characterName);
  const all = new Set([...folderTokens, ...nameTokens]);

  const hits = [];
  for (const [id, f] of Object.entries(FIGHTERS)) {
    const own = new Set([id, ...tokens(f.displayName)]);
    const matched = [...all].filter((t) => own.has(t));
    if (matched.length) hits.push({ fighterId: id, displayName: f.displayName, matched });
  }

  const folderExact = Object.keys(FIGHTERS).find(
    (id) => id === String(folderName || '').toLowerCase(),
  );
  if (folderExact) {
    return {
      fighterId: folderExact,
      displayName: FIGHTERS[folderExact].displayName,
      confidence: 'exact',
      reason: 'the folder is named after the fighter id',
      candidates: hits.map((h) => h.fighterId),
    };
  }
  if (hits.length === 1) {
    return {
      fighterId: hits[0].fighterId,
      displayName: hits[0].displayName,
      confidence: 'likely',
      reason: `matched on "${hits[0].matched.join('", "')}"`,
      candidates: [hits[0].fighterId],
    };
  }
  if (hits.length > 1) {
    return {
      fighterId: null,
      displayName: null,
      confidence: 'ambiguous',
      reason: `${hits.length} fighters match; choose one with --fighter`,
      candidates: hits.map((h) => h.fighterId),
    };
  }
  return {
    fighterId: null,
    displayName: null,
    confidence: 'none',
    reason: 'no roster fighter matches this name',
    candidates: [],
  };
}

/** Inspect one package folder. Reads only; never writes. */
export function describePackage(rootAbs, folderName, gameData) {
  const { FIGHTERS, TRANSFORMATIONS } = gameData;
  const rel = path.join(LOCAL_DIR, folderName);
  const base = {
    folder: folderName,
    path: rel,
    characterName: null,
    author: null,
    defFile: null,
    mugenVersion: null,
    versionDate: null,
    localcoord: null,
    fileCount: 0,
    bytes: 0,
    contents: {},
    rights: null,
    target: null,
    transformationId: null,
    readiness: 'BLOCKED',
    blockers: [],
    command: null,
    errors: [],
    warnings: [],
  };

  let inspection;
  try {
    inspection = inspectPackage(rootAbs);
  } catch (err) {
    base.errors.push(err instanceof ImportError ? err.message : `Unreadable: ${err.message}`);
    base.blockers.push('the folder could not be inspected');
    return base;
  }

  base.fileCount = inspection.fileCount;
  base.bytes = inspection.totalBytes;
  base.defFile = inspection.def;
  base.errors.push(...inspection.errors);
  base.warnings.push(...inspection.warnings);
  base.contents = {
    sff: inspection.sffFiles.length,
    air: inspection.airFiles.length,
    cmd: inspection.cmdFiles.length,
    cns: inspection.cnsFiles.length,
    snd: inspection.sndFiles.length,
    images: inspection.images.length,
    audio: inspection.audio.length,
    executables: inspection.executables.length,
    archives: inspection.archives.length,
    defCandidates: inspection.defCandidates.length,
  };

  let def = null;
  if (inspection.def) {
    try {
      def = parseDef(rootAbs, inspection.def, inspection.files);
      base.warnings.push(...def.warnings);
      base.errors.push(...def.errors);
    } catch (err) {
      base.errors.push(`DEF: ${err.message}`);
    }
  }
  base.characterName = def?.displayName || def?.name || null;
  base.author = def?.author || null;
  base.mugenVersion = def?.mugenVersion || null;
  base.versionDate = def?.versionDate || null;
  base.localcoord = def?.localcoord || null;

  const declared = readDeclaredRights(rootAbs, inspection.files);
  const license = checkLicense(rootAbs, {
    defInfo: def, allFiles: inspection.files, declared,
  });
  base.rights = {
    status: license.status,
    confidence: license.confidence,
    license: license.license,
    creator: license.creator,
    source: license.source,
    reuseAllowed: license.reuseAllowed,
    spriteOrigin: license.spriteOrigin,
    audioOrigin: license.audioOrigin,
    /** A reviewer's own declaration, if they left one in the folder. */
    declaredByReviewer: !!declared,
    documents: license.documents.map((d) => d.path),
    reasons: license.reasons,
  };

  base.target = matchFighter(folderName, base.characterName, FIGHTERS);
  if (base.target.fighterId) {
    const forms = Object.values(TRANSFORMATIONS)
      .filter((t) => t.fighterId === base.target.fighterId);
    const name = String(base.characterName || folderName).toLowerCase();
    const form = forms.find((t) => tokens(t.displayName)
      .filter((w) => w.length > 3)
      .every((w) => name.includes(w)));
    if (form) base.transformationId = form.id;
  }

  // ---- readiness ---------------------------------------------------------
  if (!inspection.def) base.blockers.push('no character .def found');
  if (!inspection.sffFiles.length) base.blockers.push('no .sff sprite archive found');
  if (!inspection.airFiles.length) base.blockers.push('no .air animation file found');
  if (inspection.archives.length) {
    base.blockers.push(`${inspection.archives.length} archive(s) still packed — unpack them first`);
  }

  if (!inspection.def || inspection.errors.length) {
    base.readiness = 'BLOCKED';
  } else if (license.status === STATUS.REJECTED) {
    base.readiness = 'REJECTED';
  } else if (!base.target.fighterId) {
    base.readiness = 'NEEDS_FIGHTER_ID';
  } else if (license.status !== STATUS.APPROVED) {
    // No stated terms is not permission. Analysis is still useful, artwork is
    // not exported, and that is the correct default rather than a failure.
    base.readiness = 'ANALYSIS_ONLY';
  } else {
    base.readiness = 'READY_TO_IMPORT';
  }

  base.command = base.readiness === 'BLOCKED' ? null
    : `node tools/mugen-import/index.mjs ${rel} --fighter `
      + `${base.target.fighterId || '<fighter-id>'}`;

  return base;
}

/**
 * List every package under `imports/mugen/`.
 *
 * @param {string} repoRoot
 * @param {{ dir?: string }} opts
 * @returns {Promise<{ dir: string, exists: boolean, packages: Object[], summary: Object }>}
 */
export async function listLocalPackages(repoRoot, { dir = LOCAL_DIR } = {}) {
  const root = path.resolve(repoRoot, dir);
  const out = {
    dir,
    root,
    exists: fs.existsSync(root) && fs.statSync(root).isDirectory(),
    packages: [],
    ignored: [],
    summary: { total: 0, readyToImport: 0, analysisOnly: 0, needsFighterId: 0, rejected: 0, blocked: 0 },
  };
  if (!out.exists) return out;

  const { installBrowserStubs } = await import('../../tests/helpers.js');
  installBrowserStubs();
  const { FIGHTERS } = await import('../../js/data/fighters.js');
  const { TRANSFORMATIONS } = await import('../../js/data/transformations.js');

  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    // A loose file in the drop zone is not a package — the README lives here.
    if (!entry.isDirectory()) { out.ignored.push(entry.name); continue; }
    if (entry.name.startsWith('.')) { out.ignored.push(entry.name); continue; }
    out.packages.push(describePackage(
      path.join(root, entry.name), entry.name, { FIGHTERS, TRANSFORMATIONS },
    ));
  }

  const n = (r) => out.packages.filter((p) => p.readiness === r).length;
  out.summary = {
    total: out.packages.length,
    readyToImport: n('READY_TO_IMPORT'),
    analysisOnly: n('ANALYSIS_ONLY'),
    needsFighterId: n('NEEDS_FIGHTER_ID'),
    rejected: n('REJECTED'),
    blocked: n('BLOCKED'),
  };
  return out;
}

/** Human-readable listing. */
export function formatListing(listing) {
  const lines = [];
  lines.push('');
  lines.push(`Local MUGEN packages — ${listing.dir}`);
  lines.push('='.repeat(60));

  if (!listing.exists) {
    lines.push(`${listing.dir}/ does not exist yet. Create it and drop character`);
    lines.push('folders inside, one per package.');
    return lines.join('\n');
  }
  if (!listing.packages.length) {
    lines.push('No packages found. Drop a MUGEN character folder into');
    lines.push(`${listing.dir}/ — one folder per character — and run this again.`);
    return lines.join('\n');
  }

  for (const p of listing.packages) {
    lines.push('');
    lines.push(`${p.folder}/`);
    lines.push(`  character        ${p.characterName || '— (no .def read)'}`);
    lines.push(`  author           ${p.author || '—'}`);
    lines.push(`  def              ${p.defFile || '— none found'}`);
    lines.push(`  contents         ${p.contents.sff ?? 0} sff · ${p.contents.air ?? 0} air · `
      + `${p.contents.cmd ?? 0} cmd · ${p.contents.cns ?? 0} cns · ${p.contents.snd ?? 0} snd`
      + `   (${p.fileCount} files, ${Math.round((p.bytes || 0) / 1024)} KB)`);
    if (p.contents.executables) {
      lines.push(`  executables      ${p.contents.executables} present — never opened, never run`);
    }
    if (p.contents.archives) {
      lines.push(`  archives         ${p.contents.archives} still packed — not extracted`);
    }
    lines.push(`  rights           ${p.rights?.status || 'NOT_FOUND'}`
      + ` (${p.rights?.confidence || 'none'} confidence)`
      + `${p.rights?.license ? ` — ${p.rights.license}` : ''}`);
    lines.push(`  rights docs      ${p.rights?.documents?.length
      ? p.rights.documents.join(', ')
      : 'none — no stated terms is NOT permission'}`);
    lines.push(`  sprite origin    ${p.rights?.spriteOrigin || 'unknown'}`);
    lines.push(`  target fighter   ${p.target?.fighterId
      ? `${p.target.fighterId} (${p.target.displayName}) — ${p.target.confidence}, ${p.target.reason}`
      : `none — ${p.target?.reason || 'unmatched'}`}`);
    if (p.transformationId) {
      lines.push(`  alternate form   ${p.transformationId} — import as a transformation, never a new roster card`);
    }
    lines.push(`  readiness        ${p.readiness}`);
    for (const b of p.blockers) lines.push(`                   · ${b}`);
    if (p.command) lines.push(`  import with      ${p.command}`);
    if (p.errors.length) {
      for (const e of p.errors.slice(0, 4)) lines.push(`  error            ${e}`);
    }
  }

  const s = listing.summary;
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push(`${s.total} package(s): ${s.readyToImport} ready · ${s.analysisOnly} analysis-only · `
    + `${s.needsFighterId} need a target · ${s.rejected} rejected · ${s.blocked} blocked`);
  lines.push('Nothing was written. Live assets in assets/fighters/ are untouched.');
  return lines.join('\n');
}

export default listLocalPackages;
