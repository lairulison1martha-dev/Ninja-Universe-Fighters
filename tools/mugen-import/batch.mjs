/**
 * Batch import — drop many packages in one folder, run one command.
 *
 * The point is that a run never stops. A corrupt package, a package whose
 * rights say no, a package that matches two fighters: each is recorded and the
 * run continues to the next one. Only the summary at the end says how it went.
 *
 * What gets imported is unchanged from the single-package path, and so are the
 * rules:
 *   - READY_TO_IMPORT   rights are clear → analysis and artwork stage
 *   - ANALYSIS_ONLY     rights unclear   → analysis stages, artwork does not
 *   - NEEDS_FIGHTER_ID  ambiguous or unmatched → skipped, both candidates named
 *   - REJECTED          ripped or restricted   → skipped
 *   - BLOCKED           unreadable package     → skipped
 *
 * Nothing is written to `assets/fighters/`, ever, by any path through here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { listLocalPackages, LOCAL_DIR } from './list-local.mjs';
import { stagingSubpath } from './fighter-export.mjs';
import { STATUS } from './license-check.mjs';

const REPORTS_DIR = 'reports';

/** Readiness values the batch will actually import. */
const IMPORTABLE = new Set(['READY_TO_IMPORT', 'ANALYSIS_ONLY']);

/**
 * Turn a package folder name into an id safe to use as a directory.
 *
 * Used only for the `candidates/<package-id>/` layout, where two packages
 * target the same fighter and both need somewhere of their own to live.
 */
export function packageId(folderName) {
  const id = String(folderName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return id || 'package';
}

/**
 * Score one imported candidate, so two packages for the same fighter can be
 * compared on something other than which one was listed first.
 *
 * Weighted towards what this engine can actually use: per-frame hitboxes and
 * move timing are the things the game has no equivalent of, so they count for
 * more than raw sprite count. Rights are a gate, not a tie-breaker — a
 * package whose artwork cannot be exported can still win on analysis, and the
 * recommendation says so.
 */
export function scoreCandidate(result) {
  const sff = result.sff || {};
  const air = result.air || {};
  const anim = result.animMap?.stats || {};
  const hit = result.hitboxes?.stats || {};
  const moves = result.moves?.stats || {};

  const decoded = sff.decodedCount || 0;
  const declared = sff.spriteCount || 0;
  const decodeRatio = declared ? decoded / declared : 0;
  const resolution = (result.sff?.sprites || []).reduce(
    (n, s) => Math.max(n, (s.width || 0) * (s.height || 0)), 0,
  );

  const parts = {
    animations: Math.min(30, (air.animations?.length || 0) * 1.5),
    clips: Math.min(20, (anim.clipsCovered || 0) * 1.2),
    sprites: Math.min(15, decoded / 20),
    resolution: Math.min(10, Math.sqrt(resolution) / 12),
    hurtboxes: (hit.hurtCoverage || 0) * 15,
    attackboxes: (hit.attackCoverage || 0) * 10,
    moves: Math.min(15, (moves.withTiming || 0) * 1.5),
    parserConfidence: decodeRatio * 10 - Math.min(10, (result.errors?.length || 0) * 2),
    rights: result.license?.status === STATUS.APPROVED ? 10
      : result.license?.status === STATUS.MANUAL_REVIEW ? 3 : 0,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total: Number(total.toFixed(2)), parts, decodeRatio, resolution };
}

/** Human-readable line for one candidate in the comparison. */
function candidateRow(c) {
  return `| \`${c.packageFolder}\` | ${c.score.total} | ${c.animations} | ${c.sprites} `
    + `| ${Math.round(c.hurtCoverage * 100)}% | ${c.movesWithTiming} | ${c.rights} | ${c.artExported ? 'yes' : 'no'} |`;
}

/**
 * Run the batch.
 *
 * @param {string} repoRoot
 * @param {{ dir?: string, dryRun?: boolean, force?: boolean, onProgress?: Function }} opts
 */
export async function runBatch(repoRoot, {
  dir = LOCAL_DIR, dryRun = false, force = false, onProgress = null,
} = {}) {
  const { importPackage } = await import('./index.mjs');
  const listing = await listLocalPackages(repoRoot, { dir });

  /*
   * Work out where each package would go BEFORE importing anything, because
   * duplicates change the answer: two packages aimed at the same target both
   * move under `candidates/`, so neither silently overwrites the other.
   */
  const byTarget = new Map();
  for (const p of listing.packages) {
    if (!IMPORTABLE.has(p.readiness)) continue;
    const key = p.stagingSubpath;
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push(p);
  }
  const duplicateTargets = [...byTarget.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ target: key, packages: list.map((p) => p.folder) }));

  const results = [];
  const stagingPaths = [];

  for (const p of listing.packages) {
    const row = {
      package: p.folder,
      packagePath: p.path,
      characterName: p.characterName,
      author: p.author,
      fighterId: p.target?.fighterId || null,
      fighterName: p.target?.displayName || null,
      matchConfidence: p.target?.confidence || 'none',
      matchReason: p.target?.reason || null,
      candidates: p.target?.candidates || [],
      type: p.variantType,
      formId: p.transformationId,
      costumeId: p.costumeId,
      rights: p.rights?.status || STATUS.NOT_FOUND,
      rightsConfidence: p.rights?.confidence || 'none',
      readiness: p.readiness,
      result: 'SKIPPED',
      reason: null,
      staged: null,
      artExported: false,
      score: null,
      stats: null,
      errors: [...(p.errors || [])],
    };

    if (!IMPORTABLE.has(p.readiness)) {
      row.reason = p.readiness === 'NEEDS_FIGHTER_ID'
        ? `no single roster fighter matches${row.candidates.length ? ` (possible: ${row.candidates.join(', ')})` : ''}`
        : p.readiness === 'REJECTED' ? 'rights say no'
          : (p.blockers[0] || 'unreadable package');
      results.push(row);
      if (onProgress) onProgress(row);
      continue;
    }

    // Duplicates get their own folder under the target rather than one
    // overwriting the other.
    const isDuplicate = (byTarget.get(p.stagingSubpath) || []).length > 1;
    row.isDuplicate = isDuplicate;
    const sub = stagingSubpath(p.target.fighterId, {
      formId: p.transformationId,
      costumeId: p.costumeId,
      candidateId: isDuplicate ? packageId(p.folder) : null,
    });
    row.stagingSubpath = sub;

    if (dryRun) {
      row.result = 'DRY_RUN';
      row.reason = 'dry run — mapped and reported, nothing written';
      results.push(row);
      if (onProgress) onProgress(row);
      continue;
    }

    // One package failing must never take the batch down with it.
    try {
      const r = await importPackage(path.resolve(repoRoot, p.path), p.target.fighterId, {
        repoRoot, force, stagingPath: sub,
      });
      row.staged = path.relative(repoRoot, r.staged);
      stagingPaths.push(row.staged);
      row.artExported = !!r.sheetMeta;
      row.recommendation = r.comparison?.recommendation || null;
      row.score = scoreCandidate(r);
      row.stats = {
        sffVersion: r.sff?.version ?? null,
        sprites: r.sff?.spriteCount ?? 0,
        spritesDecoded: r.sff?.decodedCount ?? 0,
        animations: r.air?.animations.length ?? 0,
        clipsCovered: r.animMap?.stats.clipsCovered ?? 0,
        commands: r.cmd?.commands.length ?? 0,
        states: r.cns?.states.length ?? 0,
        hurtCoverage: r.hitboxes?.stats.hurtCoverage ?? 0,
        attackCoverage: r.hitboxes?.stats.attackCoverage ?? 0,
        movesWithTiming: r.moves?.stats.withTiming ?? 0,
        soundsIndexed: r.snd?.sounds.length ?? 0,
      };
      row.errors.push(...(r.errors || []));
      row.result = row.artExported ? 'IMPORTED' : 'ANALYSIS_STAGED';
      row.reason = row.artExported ? null
        : 'rights are not clear enough to export artwork; analysis staged';
    } catch (err) {
      row.result = 'FAILED';
      row.reason = err.message;
      row.errors.push(err.message);
    }

    results.push(row);
    if (onProgress) onProgress(row);
  }

  /* ---- duplicate comparison ---------------------------------------------- */
  const duplicates = [];
  for (const { target, packages } of duplicateTargets) {
    const rows = results.filter((r) => packages.includes(r.package) && r.score);
    if (rows.length < 2) continue;
    const ranked = [...rows].sort((a, b) => b.score.total - a.score.total);
    // Two packages can genuinely score the same. Saying one is strongest when
    // nothing separates them would be inventing a result.
    const tied = ranked.filter((r) => r.score.total === ranked[0].score.total);
    duplicates.push({
      target,
      fighterId: ranked[0].fighterId,
      packages: packages.slice(),
      tie: tied.length > 1 ? tied.map((r) => r.package) : null,
      ranked: ranked.map((r) => ({
        packageFolder: r.package,
        score: r.score,
        animations: r.stats.animations,
        sprites: r.stats.spritesDecoded,
        hurtCoverage: r.stats.hurtCoverage,
        movesWithTiming: r.stats.movesWithTiming,
        rights: r.rights,
        artExported: r.artExported,
        staged: r.staged,
      })),
      recommended: tied.length > 1 ? null : ranked[0].package,
      /** Advisory. Nothing is promoted, here or anywhere else. */
      promoted: false,
      note: tied.length > 1
        ? 'These candidates score identically, so no recommendation is made. '
          + 'Compare the staged folders yourself.'
        : 'Strongest candidate by the batch score. Nothing was promoted — '
          + 'compare the staged folders yourself before moving anything.',
    });
  }

  /* ---- summary ------------------------------------------------------------ */
  const count = (fn) => results.filter(fn).length;
  const matchedFighters = new Set(results.filter((r) => r.fighterId).map((r) => r.fighterId));
  const index = await (await import('./list-local.mjs')).loadMatchIndex();
  const withoutCandidate = index.fighters
    .map((f) => f.fighterId)
    .filter((id) => !matchedFighters.has(id));

  const summary = {
    packagesScanned: results.length,
    packagesImported: count((r) => r.result === 'IMPORTED'),
    analysisOnly: count((r) => r.result === 'ANALYSIS_STAGED'),
    dryRun: count((r) => r.result === 'DRY_RUN'),
    failed: count((r) => r.result === 'FAILED'),
    skipped: count((r) => r.result === 'SKIPPED'),
    rejected: count((r) => r.readiness === 'REJECTED'),
    blocked: count((r) => r.readiness === 'BLOCKED'),
    ambiguous: count((r) => r.matchConfidence === 'ambiguous'),
    unmatched: count((r) => r.matchConfidence === 'none'),
    baseFightersMatched: count((r) => r.type === 'base'),
    transformationsMatched: count((r) => r.type === 'transformation'),
    costumesMatched: count((r) => r.type === 'costume'),
    distinctFightersMatched: matchedFighters.size,
    rosterFightersWithoutCandidate: withoutCandidate.length,
    duplicateTargets: duplicateTargets.length,
    stagingPathsCreated: stagingPaths.length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    generator: 'tools/mugen-import/batch.mjs',
    dir,
    dryRun,
    force,
    rosterSize: index.fighters.length,
    summary,
    packages: results,
    duplicates,
    stagingPaths,
    rosterFightersWithoutCandidate: withoutCandidate,
    rules: [
      'Live art in assets/fighters/ is never written to by this pipeline.',
      'Artwork is exported only when the rights check returns APPROVED.',
      'A package matching two fighters is reported, never assigned by guessing.',
      'Alternate forms map onto existing transformations; no roster entry is created.',
      'One failing package does not stop the batch.',
    ],
  };

  // The report is written even for a dry run — that is the point of a dry run.
  fs.mkdirSync(path.join(repoRoot, REPORTS_DIR), { recursive: true });
  const jsonPath = path.join(repoRoot, REPORTS_DIR, 'mugen-batch-import.json');
  const mdPath = path.join(repoRoot, REPORTS_DIR, 'mugen-batch-import.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 1)}\n`);
  fs.writeFileSync(mdPath, batchMarkdown(report));

  return { report, jsonPath, mdPath };
}

/** The batch summary as markdown. */
export function batchMarkdown(report) {
  const s = report.summary;
  const L = [];
  L.push('# MUGEN batch import');
  L.push('');
  L.push(`Generated ${report.generatedAt} from \`${report.dir}\``);
  if (report.dryRun) {
    L.push('');
    L.push('**Dry run.** Everything below was worked out without writing a single');
    L.push('staging file. Re-run without `--dry-run` to import.');
  }
  L.push('');
  L.push('## Summary');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| Packages scanned | ${s.packagesScanned} |`);
  L.push(`| Imported (artwork + analysis) | ${s.packagesImported} |`);
  L.push(`| Analysis only (no artwork) | ${s.analysisOnly} |`);
  if (report.dryRun) L.push(`| Would import (dry run) | ${s.dryRun} |`);
  L.push(`| Rejected | ${s.rejected} |`);
  L.push(`| Blocked | ${s.blocked} |`);
  L.push(`| Ambiguous | ${s.ambiguous} |`);
  L.push(`| Unmatched | ${s.unmatched} |`);
  L.push(`| Failed mid-import | ${s.failed} |`);
  L.push(`| Base fighters matched | ${s.baseFightersMatched} |`);
  L.push(`| Transformations matched | ${s.transformationsMatched} |`);
  L.push(`| Costumes matched | ${s.costumesMatched} |`);
  L.push(`| Distinct roster fighters matched | ${s.distinctFightersMatched} |`);
  L.push(`| Roster fighters with no candidate | ${s.rosterFightersWithoutCandidate} |`);
  L.push(`| Targets with more than one package | ${s.duplicateTargets} |`);
  L.push(`| Staging paths created | ${s.stagingPathsCreated} |`);
  L.push('');

  L.push('## Packages');
  L.push('');
  L.push('| Package | Fighter | Type | Rights | Readiness | Result |');
  L.push('|---|---|---|---|---|---|');
  for (const p of report.packages) {
    const target = p.fighterId
      ? `${p.fighterId}${p.formId ? ` → ${p.formId}` : ''}${p.costumeId ? ` → ${p.costumeId}` : ''}`
      : (p.candidates.length ? `? ${p.candidates.join(' / ')}` : '—');
    L.push(`| \`${p.package}\` | ${target} | ${p.type} | ${p.rights} | ${p.readiness} | ${p.result} |`);
  }
  L.push('');

  const notes = report.packages.filter((p) => p.reason);
  if (notes.length) {
    L.push('## Why a package was not imported');
    L.push('');
    for (const p of notes) L.push(`- \`${p.package}\` — ${p.reason}`);
    L.push('');
  }

  if (report.duplicates.length) {
    L.push('## More than one package for the same target');
    L.push('');
    L.push('Each candidate is staged separately. Nothing is promoted.');
    L.push('');
    for (const d of report.duplicates) {
      L.push(`### ${d.target}`);
      L.push('');
      L.push('| Package | Score | Anims | Sprites | Hurtboxes | Moves w/ timing | Rights | Art |');
      L.push('|---|---|---|---|---|---|---|---|');
      for (const c of d.ranked) L.push(candidateRow(c));
      L.push('');
      L.push(d.recommended
        ? `Strongest by score: \`${d.recommended}\`. ${d.note}`
        : `Tied: ${d.tie.map((t) => `\`${t}\``).join(', ')}. ${d.note}`);
      L.push('');
    }
  }

  if (report.stagingPaths.length) {
    L.push('## Staging paths created');
    L.push('');
    for (const p of report.stagingPaths) L.push(`- \`${p}/\``);
    L.push('');
  }

  L.push('## Roster fighters with no candidate package');
  L.push('');
  L.push(report.rosterFightersWithoutCandidate.length
    ? `${report.rosterFightersWithoutCandidate.length} of ${report.rosterSize}: `
      + report.rosterFightersWithoutCandidate.map((f) => `\`${f}\``).join(', ')
    : 'None — every roster fighter has at least one candidate.');
  L.push('');

  L.push('## Rules this run followed');
  L.push('');
  for (const r of report.rules) L.push(`- ${r}`);
  L.push('');
  return L.join('\n');
}

/** Console output for a finished batch. */
export function formatBatch(report) {
  const s = report.summary;
  const L = [];
  L.push('');
  L.push(`MUGEN batch import — ${report.dir}${report.dryRun ? '  (dry run)' : ''}`);
  L.push('='.repeat(72));
  const w = [26, 22, 15, 8];
  L.push(`${'package'.padEnd(w[0])}${'target'.padEnd(w[1])}${'type'.padEnd(w[2])}result`);
  L.push('-'.repeat(72));
  for (const p of report.packages) {
    const target = p.fighterId
      ? `${p.fighterId}${p.formId ? `/${p.formId}` : ''}${p.costumeId ? `/${p.costumeId}` : ''}`
      : (p.candidates.length ? `? ${p.candidates.join('|')}` : '—');
    L.push(
      p.package.slice(0, w[0] - 1).padEnd(w[0])
      + target.slice(0, w[1] - 1).padEnd(w[1])
      + p.type.padEnd(w[2])
      + p.result,
    );
    if (p.reason) L.push(`${' '.repeat(w[0])}└ ${p.reason}`);
  }
  L.push('-'.repeat(72));
  L.push(`scanned ${s.packagesScanned} · imported ${s.packagesImported} · analysis-only ${s.analysisOnly}`
    + `${report.dryRun ? ` · would import ${s.dryRun}` : ''} · rejected ${s.rejected}`
    + ` · blocked ${s.blocked} · ambiguous ${s.ambiguous} · failed ${s.failed}`);
  L.push(`base ${s.baseFightersMatched} · transformations ${s.transformationsMatched}`
    + ` · costumes ${s.costumesMatched} · duplicate targets ${s.duplicateTargets}`);
  L.push(`${s.rosterFightersWithoutCandidate} of ${report.rosterSize} roster fighters still have no candidate`);
  if (report.duplicates.length) {
    L.push('');
    for (const d of report.duplicates) {
      L.push(`${d.target}: ${d.ranked.length} candidates, `
        + (d.recommended
          ? `strongest is "${d.recommended}" (${d.ranked[0].score.total})`
          : `tied at ${d.ranked[0].score.total} — no recommendation`)
        + ' — staged separately, nothing promoted');
    }
  }
  L.push('');
  L.push('assets/fighters/ was not touched. Promotion into the live game is manual.');
  return L.join('\n');
}

export default runBatch;
