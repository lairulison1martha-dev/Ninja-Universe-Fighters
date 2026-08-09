/**
 * .def — the character manifest.
 *
 * Reads the [Info] and [Files] blocks and resolves every referenced file
 * against the package, case-insensitively and across nested folders, because
 * .def files are written on Windows and routinely disagree with the actual
 * filename on a case-sensitive disk.
 *
 * Every reference is validated. A .def that names a file which is not in the
 * package is reported, not guessed at.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseIni, findSection, toInt, toFloat, splitTuple } from './ini.mjs';
import { readText, walkPackage, safeResolve, ImportError } from './limits.mjs';

/**
 * Find a package file by the name a .def used, tolerating case and separator
 * differences and a missing subfolder.
 *
 * @param {string} root package root
 * @param {string[]} allFiles relative paths from walkPackage
 * @param {string} ref the raw reference from the .def
 * @param {string} defDir directory of the .def, refs are relative to it
 * @returns {string|null} relative path, or null when nothing matches
 */
export function resolveReference(root, allFiles, ref, defDir = '') {
  if (!ref) return null;
  const cleaned = String(ref).trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!cleaned) return null;

  const candidates = [
    defDir ? `${defDir}/${cleaned}` : cleaned,
    cleaned,
    path.basename(cleaned),
  ];

  // Exact, then case-insensitive, then basename anywhere in the package.
  for (const c of candidates) {
    const norm = c.replace(/^\/+/, '');
    if (allFiles.includes(norm)) return norm;
  }
  const lowerMap = new Map(allFiles.map((f) => [f.toLowerCase(), f]));
  for (const c of candidates) {
    const hit = lowerMap.get(c.replace(/^\/+/, '').toLowerCase());
    if (hit) return hit;
  }
  const base = path.basename(cleaned).toLowerCase();
  const byBase = allFiles.filter((f) => path.basename(f).toLowerCase() === base);
  if (byBase.length === 1) return byBase[0];
  if (byBase.length > 1) {
    // Prefer one alongside the .def.
    const near = byBase.find((f) => path.dirname(f) === (defDir || '.'));
    return near || byBase[0];
  }
  return null;
}

/**
 * Parse a character .def.
 *
 * @param {string} root package root (absolute)
 * @param {string} defRel path to the .def relative to root
 * @param {string[]} [allFiles] pre-walked file list
 * @returns {Object} the manifest, with `errors` listing anything unresolved
 */
export function parseDef(root, defRel, allFiles = null) {
  const files = allFiles || walkPackage(root).files;
  const text = readText(root, defRel);
  const { sections } = parseIni(text);
  const defDir = path.dirname(defRel) === '.' ? '' : path.dirname(defRel);

  const info = findSection(sections, 'Info');
  const fileSec = findSection(sections, 'Files');
  const arcade = findSection(sections, 'Arcade');
  const errors = [];
  const warnings = [];

  if (!info) warnings.push('No [Info] section');
  if (!fileSec) errors.push('No [Files] section — this is not a character .def');

  const ref = (key) => (fileSec ? fileSec.get(key) : null);

  /** Resolve one reference and record whether it exists. */
  const resolve = (key, { required = false } = {}) => {
    const raw = ref(key);
    if (!raw) {
      if (required) errors.push(`[Files] is missing "${key}"`);
      return null;
    }
    const rel = resolveReference(root, files, raw, defDir);
    if (!rel) {
      errors.push(`[Files] ${key} = "${raw}" — file not found in the package`);
      return { declared: raw, path: null, exists: false };
    }
    return { declared: raw, path: rel, exists: true };
  };

  // MUGEN allows st, st0..st9 plus `cns` for constants.
  const stateFiles = [];
  if (fileSec) {
    for (const e of fileSec.entries) {
      if (!/^st\d*$/i.test(e.key)) continue;
      const rel = resolveReference(root, files, e.value, defDir);
      if (!rel) errors.push(`[Files] ${e.key} = "${e.value}" — file not found`);
      stateFiles.push({ key: e.key, declared: e.value, path: rel, exists: !!rel });
    }
  }

  // Palettes: pal1..pal12.
  const palettes = [];
  if (fileSec) {
    for (const e of fileSec.entries) {
      if (!/^pal\d+$/i.test(e.key)) continue;
      const rel = resolveReference(root, files, e.value, defDir);
      if (!rel) warnings.push(`[Files] ${e.key} = "${e.value}" — palette not found`);
      palettes.push({ key: e.key, declared: e.value, path: rel, exists: !!rel });
    }
  }

  // localcoord defines the coordinate space the sprites were authored in.
  // 320x240 is the MUGEN 1.0 default; widescreen characters use 427x240 etc.
  const localcoordRaw = info?.get('localcoord');
  const lc = splitTuple(localcoordRaw);
  const localcoord = {
    width: toInt(lc[0], 320),
    height: toInt(lc[1], 240),
    declared: !!localcoordRaw,
  };

  return {
    defPath: defRel,
    defDir,
    name: info?.get('name') || null,
    displayName: info?.get('displayname') || info?.get('name') || null,
    author: info?.get('author') || null,
    versionDate: info?.get('versiondate') || null,
    mugenVersion: info?.get('mugenversion') || null,
    pal_defaults: info?.get('pal.defaults') || null,
    localcoord,
    /** Scale from the character's coordinate space to 320x240 MUGEN units. */
    coordScale: localcoord.width ? 320 / localcoord.width : 1,
    sprite: resolve('sprite', { required: true }),
    anim: resolve('anim', { required: true }),
    cmd: resolve('cmd'),
    cns: resolve('cns'),
    sound: resolve('sound'),
    ai: resolve('ai'),
    stateFiles,
    palettes,
    arcadeIntro: arcade?.get('intro.storyboard') || null,
    sections: sections.length,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}

/**
 * Find the character .def in a package.
 *
 * A package can hold several .def files (the character, a stage, a storyboard).
 * The character one is the one with a [Files] block naming a sprite file.
 *
 * @returns {{ chosen: string|null, candidates: string[] }}
 */
export function findCharacterDef(root, allFiles = null) {
  const files = allFiles || walkPackage(root).files;
  const defs = files.filter((f) => f.toLowerCase().endsWith('.def'));
  const candidates = [];

  for (const d of defs) {
    let text;
    try { text = readText(root, d); } catch { continue; }
    const { sections } = parseIni(text);
    const fileSec = findSection(sections, 'Files');
    if (!fileSec) continue;
    if (!fileSec.get('sprite')) continue;
    candidates.push(d);
  }

  if (!candidates.length) return { chosen: null, candidates: defs };

  // Prefer the shallowest .def, then the one whose name matches its folder —
  // `naruto/naruto.def` is the character; `naruto/extra/alt.def` is not.
  candidates.sort((a, b) => {
    const da = a.split('/').length;
    const db = b.split('/').length;
    if (da !== db) return da - db;
    const ma = path.basename(a, '.def').toLowerCase() === path.basename(path.dirname(a)).toLowerCase();
    const mb = path.basename(b, '.def').toLowerCase() === path.basename(path.dirname(b)).toLowerCase();
    if (ma !== mb) return ma ? -1 : 1;
    return a.localeCompare(b);
  });

  return { chosen: candidates[0], candidates };
}

export default parseDef;
