/**
 * Imported candidate vs the fighter already in the game.
 *
 * The point is to make a replacement decision an informed one. It reads the
 * live fighter's real numbers off disk and out of the game data — not an
 * estimate — and produces a recommendation that is advisory only. Nothing in
 * this pipeline acts on it.
 */

import fs from 'node:fs';
import path from 'node:path';

export const RECOMMENDATIONS = Object.freeze([
  'KEEP_CURRENT', 'IMPORT_SPRITES_ONLY', 'IMPORT_ANIMATIONS_ONLY',
  'IMPORT_HITBOXES_ONLY', 'IMPORT_MOVE_TIMING_ONLY', 'IMPORT_MULTIPLE',
  'MANUAL_REVIEW', 'REJECT',
]);

/**
 * Sheet dimensions off the PNG's IHDR.
 *
 * The game's own fighter.json records the cell size, not the sheet size, so
 * asking it for a resolution just yields "?x?". Read the 25-byte header
 * instead — that is the honest number, and it costs one open.
 */
function readPngSize(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(24);
    if (fs.readSync(fd, head, 0, 24, 0) < 24) return null;
    if (head.toString('latin1', 1, 4) !== 'PNG') return null;
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Read what the game currently ships for this fighter. */
export function currentFighterState(repoRoot, fighterId, gameData) {
  const { FIGHTERS, costumesFor, TRANSFORMATIONS, getAbility } = gameData;
  const f = FIGHTERS[fighterId];
  if (!f) return null;

  const dir = path.join(repoRoot, 'assets', 'fighters', fighterId);
  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'fighter.json'), 'utf8'));
  } catch { /* no art on disk */ }

  const sheetPath = path.join(dir, 'sprite-sheet.png');
  const hasSheet = fs.existsSync(sheetPath);
  const sheetSize = hasSheet ? readPngSize(sheetPath) : null;
  const sheetBytes = hasSheet ? fs.statSync(sheetPath).size : 0;

  const animations = meta?.animations ? Object.keys(meta.animations) : [];
  const frames = meta?.animations
    ? Object.values(meta.animations).reduce((n, a) => n + (a.frames || 0), 0)
    : 0;

  const costumes = costumesFor(fighterId).filter((c) => c.id !== 'default');
  const forms = (f.transformations || []).filter((id) => TRANSFORMATIONS[id]);
  const kit = [
    ...(f.basicCombos || []), ...(f.airCombos || []),
    f.heavy, f.launcher, f.dashAttack, f.throwAttack, f.guardCounter,
    ...(f.abilities || []), f.ultimate,
  ].filter(Boolean);

  return {
    fighterId,
    displayName: f.displayName,
    playableStatus: f.playableStatus,
    hasArt: hasSheet && !!meta,
    assetStatus: meta ? 'complete' : 'missing',
    spriteSheetBytes: sheetBytes,
    resolution: sheetSize ? `${sheetSize.width}x${sheetSize.height}` : null,
    cell: meta?.frameWidth ?? meta?.cell ?? null,
    animationCount: animations.length,
    animations,
    frameCount: frames,
    spriteCount: frames,
    /** The game's hitboxes come from ability data, not per-frame boxes. */
    hitboxModel: 'per-ability (schema range/hitHeight/hitYOffset)',
    hitboxCoverage: kit.length ? 1 : 0,
    moveCount: kit.length,
    jutsuCount: (f.abilities || []).length,
    costumeCount: costumes.length,
    transformationCount: forms.length,
    transformationIds: forms,
    uniqueKit: f.playableStatus === 'complete',
  };
}

/** Summarise what the import produced. */
export function importedState(result) {
  const { def, sff, air, animMap, hitboxes, moves, license } = result;
  return {
    characterName: def?.displayName || def?.name || null,
    author: def?.author || null,
    mugenVersion: def?.mugenVersion || null,
    resolution: def?.localcoord ? `${def.localcoord.width}x${def.localcoord.height}` : null,
    sffVersion: sff?.version ?? null,
    spriteCount: sff?.spriteCount ?? 0,
    spritesDecoded: sff?.decodedCount ?? 0,
    spritesFailed: sff?.failedCount ?? 0,
    animationCount: air?.animations.length ?? 0,
    frameCount: (air?.animations || []).reduce((n, a) => n + a.frames.length, 0),
    mappedClips: animMap?.stats.clipsCovered ?? 0,
    clipConfidence: animMap ? {
      high: animMap.stats.high, medium: animMap.stats.medium,
      low: animMap.stats.low, unmapped: animMap.stats.unmapped,
    } : null,
    missingClips: animMap?.stats.missingClips ?? [],
    hitboxCoverage: hitboxes?.stats.hurtCoverage ?? 0,
    attackBoxCoverage: hitboxes?.stats.attackCoverage ?? 0,
    discoveredMoves: moves?.stats.total ?? 0,
    mappedMoves: moves?.stats.mapped ?? 0,
    manualMoves: moves?.stats.manualRequired ?? 0,
    projectiles: moves?.stats.projectiles ?? 0,
    helpers: moves?.stats.helpers ?? 0,
    movesWithTiming: moves?.stats.withTiming ?? 0,
    licenseStatus: license?.status ?? 'MANUAL_REVIEW',
    spriteOrigin: license?.spriteOrigin ?? 'unknown',
    audioOrigin: license?.audioOrigin ?? 'unknown',
    sourceQuality: (sff?.failedCount ?? 1) === 0 && (air?.errors?.length ?? 1) === 0
      ? 'clean' : 'has decode or parse problems',
  };
}

/**
 * Recommend, advisorily.
 *
 * Rights come first: nothing is recommended for import unless reuse is
 * actually allowed, regardless of how good the data is.
 */
export function recommend(current, imported) {
  const reasons = [];

  if (imported.licenseStatus === 'REJECTED') {
    return {
      recommendation: 'REJECT',
      reasons: ['Reuse rights do not permit importing this package'],
      autoApply: false,
    };
  }
  if (imported.licenseStatus !== 'APPROVED') {
    return {
      recommendation: 'MANUAL_REVIEW',
      reasons: [`Rights are ${imported.licenseStatus} — a human has to clear them before any import`],
      autoApply: false,
    };
  }

  const wants = [];
  // Sprites: only worth taking if the current fighter has none, or the import
  // is materially richer.
  if (!current?.hasArt) {
    wants.push('IMPORT_SPRITES_ONLY');
    reasons.push('the game has no art for this fighter');
  } else if (imported.spritesDecoded > current.spriteCount * 1.5) {
    wants.push('IMPORT_SPRITES_ONLY');
    reasons.push(`${imported.spritesDecoded} imported sprites vs ${current.spriteCount} current frames`);
  } else {
    reasons.push(`current art already covers ${current.animationCount} animations; imported sprites are not clearly better`);
  }

  if (imported.mappedClips > (current?.animationCount || 0)) {
    wants.push('IMPORT_ANIMATIONS_ONLY');
    reasons.push(`${imported.mappedClips} mapped clips vs ${current?.animationCount || 0} current`);
  }
  // The game has no per-frame hitboxes at all, so any are an addition.
  if (imported.hitboxCoverage > 0.5) {
    wants.push('IMPORT_HITBOXES_ONLY');
    reasons.push(`per-frame hurtboxes on ${Math.round(imported.hitboxCoverage * 100)}% of frames — the game currently has none`);
  }
  if (imported.movesWithTiming >= 4) {
    wants.push('IMPORT_MOVE_TIMING_ONLY');
    reasons.push(`${imported.movesWithTiming} moves carry usable startup/active/recovery`);
  }

  if (!wants.length) {
    return { recommendation: 'KEEP_CURRENT', reasons, autoApply: false };
  }
  if (wants.length === 1) {
    return { recommendation: wants[0], reasons, autoApply: false };
  }
  return { recommendation: 'IMPORT_MULTIPLE', wants, reasons, autoApply: false };
}

/** Build the full comparison record. */
export function buildComparison(repoRoot, fighterId, result, gameData) {
  const current = currentFighterState(repoRoot, fighterId, gameData);
  const imported = importedState(result);
  const rec = recommend(current, imported);
  return {
    fighterId,
    generatedAt: new Date().toISOString(),
    current,
    imported,
    ...rec,
    note: 'Advisory only. This pipeline never replaces live assets; '
      + 'assets/fighters/ is untouched by an import.',
  };
}

/** Render the comparison as markdown. */
export function comparisonMarkdown(cmp) {
  const c = cmp.current || {};
  const i = cmp.imported || {};
  const row = (label, a, b) => `| ${label} | ${a ?? '—'} | ${b ?? '—'} |`;
  return `# MUGEN import comparison — ${cmp.fighterId}

Generated ${cmp.generatedAt}

**Recommendation: ${cmp.recommendation}**${cmp.wants ? ` (${cmp.wants.join(', ')})` : ''}

${cmp.reasons.map((r) => `- ${r}`).join('\n')}

> ${cmp.note}

| | Current game version | MUGEN candidate |
|---|---|---|
${row('Display name', c.displayName, i.characterName)}
${row('Author / source', 'generated by tools/build-fighters.py', i.author)}
${row('Asset status', c.assetStatus, 'imported-staged')}
${row('Resolution', c.resolution ? `${c.resolution} sheet, ${c.cell}px cells` : null,
    i.resolution ? `${i.resolution} localcoord` : null)}
${row('Sprite count', c.spriteCount, `${i.spritesDecoded} decoded / ${i.spriteCount} declared`)}
${row('Animation count', c.animationCount, i.animationCount)}
${row('Frame count', c.frameCount, i.frameCount)}
${row('Unique animations', (c.animations || []).length, i.mappedClips)}
${row('Hitbox model', c.hitboxModel, 'per-frame Clsn1/Clsn2')}
${row('Hitbox coverage', `${Math.round((c.hitboxCoverage || 0) * 100)}% of abilities`, `${Math.round((i.hitboxCoverage || 0) * 100)}% of frames`)}
${row('Move count', c.moveCount, i.discoveredMoves)}
${row('Jutsu count', c.jutsuCount, i.mappedMoves)}
${row('Projectiles', '—', i.projectiles)}
${row('Helpers', '—', i.helpers)}
${row('Costumes', c.costumeCount, '—')}
${row('Transformations', c.transformationCount, '—')}
${row('Source quality', 'clean', i.sourceQuality)}
${row('Licence status', 'original generated art', i.licenseStatus)}
${row('Sprite origin', 'original (procedural rig)', i.spriteOrigin)}
${row('Audio origin', 'runtime-synthesised', i.audioOrigin)}

## Clip mapping confidence

${i.clipConfidence
    ? `high ${i.clipConfidence.high} · medium ${i.clipConfidence.medium} · low ${i.clipConfidence.low} · unmapped ${i.clipConfidence.unmapped}`
    : 'no animations were mapped'}

${i.missingClips?.length ? `Clips with no candidate: ${i.missingClips.join(', ')}` : 'Every game clip found a candidate.'}
`;
}

export default buildComparison;
