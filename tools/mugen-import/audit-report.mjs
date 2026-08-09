/**
 * Audit reporting.
 *
 * Two shapes: a per-package audit written into that fighter's staging folder,
 * and the roster-wide audit written to reports/.
 */

import { STATUS } from './license-check.mjs';

/** Per-package audit record. */
export function buildAudit({ fighterId, packagePath, inspection, def, license, result }) {
  return {
    fighterId,
    packagePath,
    generatedAt: new Date().toISOString(),
    package: {
      files: inspection.fileCount,
      bytes: inspection.totalBytes,
      byExtension: inspection.byExtension,
      executablesPresent: inspection.executables,
      archivesPresent: inspection.archives,
      truncated: inspection.truncated,
      warnings: inspection.warnings,
    },
    character: def ? {
      name: def.name,
      displayName: def.displayName,
      author: def.author,
      versionDate: def.versionDate,
      mugenVersion: def.mugenVersion,
      localcoord: def.localcoord,
      sprite: def.sprite?.path || null,
      anim: def.anim?.path || null,
      cmd: def.cmd?.path || null,
      cns: def.cns?.path || null,
      sound: def.sound?.path || null,
      stateFiles: def.stateFiles.map((s) => s.path).filter(Boolean),
      palettes: def.palettes.length,
      referenceErrors: def.errors,
    } : null,
    rights: {
      status: license.status,
      confidence: license.confidence,
      creator: license.creator,
      license: license.license,
      source: license.source,
      redistributionAllowed: license.redistributionAllowed,
      reuseAllowed: license.reuseAllowed,
      spriteOrigin: license.spriteOrigin,
      audioOrigin: license.audioOrigin,
      audioImportAllowed: license.audioImportAllowed,
      documents: license.documents,
      reasons: license.reasons,
    },
    parsed: result ? {
      sffVersion: result.sff?.version ?? null,
      sprites: result.sff?.spriteCount ?? 0,
      spritesDecoded: result.sff?.decodedCount ?? 0,
      animations: result.air?.animations.length ?? 0,
      commands: result.cmd?.commands.length ?? 0,
      states: result.cns?.states.length ?? 0,
      soundGroups: result.snd?.groups.length ?? 0,
      soundsIndexed: result.snd?.sounds.length ?? 0,
      audioImported: false,
    } : null,
    errors: [
      ...(inspection.errors || []),
      ...(def?.errors || []),
      ...(result?.errors || []),
    ],
  };
}

/** Roster-wide audit → markdown. */
export function rosterAuditMarkdown(audit) {
  const s = audit.summary;
  const lines = [];
  lines.push('# MUGEN roster audit');
  lines.push('');
  lines.push(`Generated ${audit.generatedAt}`);
  lines.push('');
  lines.push('This audits all 110 fighters in the cleaned roster for legally reusable MUGEN');
  lines.push('character packages. It records what was actually established, and nothing more.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| | |');
  lines.push('|---|---|');
  lines.push(`| Fighters audited | ${s.fighters} |`);
  lines.push(`| Local packages found | ${s.localPackages} |`);
  lines.push(`| APPROVED | ${s.approved} |`);
  lines.push(`| MANUAL_REVIEW | ${s.manualReview} |`);
  lines.push(`| REJECTED | ${s.rejected} |`);
  lines.push(`| NOT_FOUND | ${s.notFound} |`);
  lines.push('');
  if (audit.searchNotes?.length) {
    lines.push('## Search notes');
    lines.push('');
    for (const n of audit.searchNotes) lines.push(`- ${n}`);
    lines.push('');
  }
  if (audit.categoryAssessment) {
    const c = audit.categoryAssessment;
    lines.push(`## Provenance assessment — ${c.category}`);
    lines.push('');
    lines.push(`**${c.assessment}** (${c.confidence} confidence)`);
    lines.push('');
    for (const b of c.basis) lines.push(`- ${b}`);
    lines.push('');
  }
  if (audit.notableLicensedPackage) {
    const n = audit.notableLicensedPackage;
    lines.push('## The one package found with verifiable terms');
    lines.push('');
    lines.push(`**${n.name}** by ${n.creator} — ${n.license}`);
    lines.push('');
    lines.push(`Source: ${n.sourceUrl}`);
    lines.push('');
    lines.push(`Primary source: ${n.primarySourceQuote}`);
    lines.push('');
    lines.push(`Status: **${n.status}**. Why not APPROVED:`);
    for (const w of n.whyNotApproved) lines.push(`- ${w}`);
    lines.push('');
    lines.push(n.usefulFor);
    lines.push('');
  }
  lines.push('## Method');
  lines.push('');
  for (const m of audit.method || []) lines.push(`- ${m}`);
  lines.push('');
  lines.push('## Per-fighter');
  lines.push('');
  lines.push('| Fighter | ID | Candidates | Status | Sprite origin | Recommendation |');
  lines.push('|---|---|---|---|---|---|');
  for (const f of audit.fighters) {
    lines.push(
      `| ${f.name} | \`${f.fighterId}\` | ${f.candidates.length} | ${f.importStatus} `
      + `| ${f.spriteOrigin} | ${f.recommendation} |`,
    );
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  for (const f of audit.fighters) {
    if (!f.notes?.length) continue;
    lines.push(`### ${f.name} (\`${f.fighterId}\`)`);
    for (const n of f.notes) lines.push(`- ${n}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Count statuses for the summary block. */
export function summarise(fighters) {
  const count = (st) => fighters.filter((f) => f.importStatus === st).length;
  return {
    fighters: fighters.length,
    localPackages: fighters.filter((f) => f.candidates.some((c) => c.kind === 'local')).length,
    approved: count(STATUS.APPROVED),
    manualReview: count(STATUS.MANUAL_REVIEW),
    rejected: count(STATUS.REJECTED),
    notFound: count(STATUS.NOT_FOUND),
  };
}

export default buildAudit;
