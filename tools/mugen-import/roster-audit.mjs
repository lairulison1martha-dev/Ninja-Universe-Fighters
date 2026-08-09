/**
 * The 110-fighter MUGEN audit.
 *
 * For every fighter in the cleaned roster this records what was actually
 * established about reusable MUGEN packages — including, prominently, what
 * could NOT be established and why. An audit that quietly omits its own
 * blind spots is worse than no audit.
 *
 * Two sources of truth feed it:
 *   1. `imports/mugen/<id>/` — packages a human downloaded and placed there.
 *      These are inspected properly: files, .def, rights documents.
 *   2. Research findings recorded in `findings.mjs`, which hold what was
 *      learned from public sources and, crucially, what was unreachable.
 *
 * It never guesses. A fighter with no package and no finding is NOT_FOUND.
 */

import fs from 'node:fs';
import path from 'node:path';
import { inspectPackage } from './package-inspector.mjs';
import { parseDef } from './parse-def.mjs';
import { checkLicense, readDeclaredRights, STATUS } from './license-check.mjs';
import { rosterAuditMarkdown, summarise } from './audit-report.mjs';
import {
  FINDINGS, SEARCH_NOTES, METHOD, CATEGORY_ASSESSMENT, NOTABLE_LICENSED_PACKAGE, RESEARCHED_AT,
} from './findings.mjs';

const IMPORTS_DIR = 'imports/mugen';
const REPORTS_DIR = 'reports';

/** Inspect a locally-provided package, if the fighter has one. */
function localCandidate(repoRoot, fighterId) {
  const dir = path.join(repoRoot, IMPORTS_DIR, fighterId);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  try {
    const inspection = inspectPackage(dir);
    const declared = readDeclaredRights(dir, inspection.files);
    let def = null;
    if (inspection.def) {
      try { def = parseDef(dir, inspection.def, inspection.files); } catch { /* reported below */ }
    }
    const license = checkLicense(dir, { defInfo: def, allFiles: inspection.files, declared });
    return {
      kind: 'local',
      path: `${IMPORTS_DIR}/${fighterId}`,
      name: def?.displayName || def?.name || fighterId,
      creator: def?.author || declared?.creator || null,
      version: def?.versionDate || null,
      engineVersion: def?.mugenVersion || null,
      sourceUrl: declared?.source || null,
      license,
      inspection: {
        files: inspection.fileCount,
        bytes: inspection.totalBytes,
        def: inspection.def,
        sff: inspection.sffFiles.length,
        air: inspection.airFiles.length,
        cmd: inspection.cmdFiles.length,
        cns: inspection.cnsFiles.length,
        snd: inspection.sndFiles.length,
        executables: inspection.executables.length,
      },
      errors: [...inspection.errors, ...(def?.errors || [])],
    };
  } catch (err) {
    return {
      kind: 'local', path: `${IMPORTS_DIR}/${fighterId}`, name: fighterId,
      creator: null, license: null, errors: [err.message],
    };
  }
}

/** Build the audit for every roster fighter. */
export async function runRosterAudit(repoRoot) {
  const { installBrowserStubs } = await import('../../tests/helpers.js');
  installBrowserStubs();
  const { FIGHTERS, FIGHTER_ORDER } = await import('../../js/data/fighters.js');

  const fighters = [];

  for (const id of FIGHTER_ORDER) {
    const f = FIGHTERS[id];
    const finding = FINDINGS[id] || null;
    const local = localCandidate(repoRoot, id);

    const candidates = [];
    if (local) candidates.push(local);
    for (const c of finding?.candidates || []) candidates.push({ kind: 'researched', ...c });

    // Status. A locally-inspected package's own rights check wins; otherwise
    // the researched finding; otherwise nothing was found.
    let importStatus;
    let recommendation;
    const notes = [];

    if (local?.license) {
      importStatus = local.license.status;
      notes.push(`Local package inspected: ${local.inspection.files} files, `
        + `${local.inspection.sff} SFF / ${local.inspection.air} AIR / ${local.inspection.cns} CNS.`);
      notes.push(...local.license.reasons.slice(0, 6));
      recommendation = importStatus === STATUS.APPROVED ? 'IMPORT_MULTIPLE'
        : importStatus === STATUS.REJECTED ? 'REJECT' : 'MANUAL_REVIEW';
    } else if (finding) {
      importStatus = finding.status;
      notes.push(...(finding.notes || []));
      recommendation = finding.recommendation
        || (finding.status === STATUS.REJECTED ? 'REJECT' : 'MANUAL_REVIEW');
    } else {
      importStatus = STATUS.NOT_FOUND;
      recommendation = 'MANUAL_REVIEW';
      notes.push(CATEGORY_ASSESSMENT.perFighterNote);
    }

    fighters.push({
      fighterId: id,
      name: f.displayName,
      playableStatus: f.playableStatus,
      candidates: candidates.map((c) => ({
        kind: c.kind,
        name: c.name || null,
        creator: c.creator || null,
        version: c.version || null,
        engineVersion: c.engineVersion || null,
        sourceUrl: c.sourceUrl || null,
        licenseTerms: c.license?.license || c.licenseTerms || null,
        rightsStatus: c.license?.status || c.rightsStatus || null,
      })),
      sourceUrls: candidates.map((c) => c.sourceUrl).filter(Boolean),
      creator: candidates.find((c) => c.creator)?.creator || null,
      packageVersion: candidates.find((c) => c.version)?.version || null,
      engineVersion: candidates.find((c) => c.engineVersion)?.engineVersion || null,
      licenseTerms: local?.license?.license || finding?.licenseTerms || null,
      rightsConfidence: local?.license?.confidence || finding?.rightsConfidence || 'none',
      spriteOrigin: local?.license?.spriteOrigin || finding?.spriteOrigin || 'unknown',
      audioOrigin: local?.license?.audioOrigin || finding?.audioOrigin || 'unknown',
      animationCompleteness: local ? 'see staging report' : 'not assessed — no package obtained',
      hitboxCompleteness: local ? 'see staging report' : 'not assessed — no package obtained',
      importStatus,
      recommendation,
      notes,
    });
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    generator: 'tools/mugen-import/roster-audit.mjs',
    rosterSize: fighters.length,
    rosterSource: 'js/data/fighters.js — the cleaned 110-fighter roster',
    summary: summarise(fighters),
    researchedAt: RESEARCHED_AT,
    categoryAssessment: CATEGORY_ASSESSMENT,
    notableLicensedPackage: NOTABLE_LICENSED_PACKAGE,
    searchNotes: SEARCH_NOTES,
    method: METHOD,
    fighters,
  };

  fs.mkdirSync(path.join(repoRoot, REPORTS_DIR), { recursive: true });
  const jsonPath = path.join(repoRoot, REPORTS_DIR, 'mugen-roster-audit.json');
  const mdPath = path.join(repoRoot, REPORTS_DIR, 'mugen-roster-audit.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 1)}\n`);
  fs.writeFileSync(mdPath, rosterAuditMarkdown(audit));

  console.log('\nMUGEN roster audit');
  console.log('='.repeat(52));
  console.log(`fighters audited   ${audit.summary.fighters}`);
  console.log(`local packages     ${audit.summary.localPackages}`);
  console.log(`APPROVED           ${audit.summary.approved}`);
  console.log(`MANUAL_REVIEW      ${audit.summary.manualReview}`);
  console.log(`REJECTED           ${audit.summary.rejected}`);
  console.log(`NOT_FOUND          ${audit.summary.notFound}`);

  return { audit, jsonPath, mdPath };
}

export default runRosterAudit;
