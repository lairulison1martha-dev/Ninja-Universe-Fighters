/**
 * Package inspection — what is in this folder, and is it safe to parse?
 *
 * Runs before anything is decoded. It classifies every file, flags the ones
 * that must never be opened, and refuses a package that is too big or too
 * deep before the parsers allocate anything.
 */

import path from 'node:path';
import fs from 'node:fs';
import {
  walkPackage, isExecutable, isParseable, LIMITS, ImportError,
} from './limits.mjs';
import { findCharacterDef } from './parse-def.mjs';

const IMAGE_EXT = ['.pcx', '.png', '.bmp', '.gif', '.jpg', '.jpeg', '.act'];
const AUDIO_EXT = ['.wav', '.mp3', '.ogg', '.snd'];
const ARCHIVE_EXT = ['.zip', '.rar', '.7z', '.gz', '.tar', '.lzh'];

/**
 * @param {string} root package directory
 * @returns {Object} inspection report
 */
export function inspectPackage(root) {
  const rootAbs = path.resolve(root);
  if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) {
    throw new ImportError(`Not a directory: ${root}`, 'NO_PACKAGE');
  }

  const { files, truncated, bytes } = walkPackage(rootAbs);
  const byExt = {};
  const executables = [];
  const archives = [];
  const images = [];
  const audio = [];
  const parseable = [];
  const oversized = [];

  for (const f of files) {
    const ext = path.extname(f).toLowerCase() || '(none)';
    byExt[ext] = (byExt[ext] || 0) + 1;
    if (isExecutable(f)) executables.push(f);
    else if (ARCHIVE_EXT.includes(ext)) archives.push(f);
    else if (IMAGE_EXT.includes(ext)) images.push(f);
    else if (AUDIO_EXT.includes(ext)) audio.push(f);
    if (isParseable(f)) parseable.push(f);
    try {
      const size = fs.statSync(path.join(rootAbs, f)).size;
      if (size > LIMITS.maxFileBytes) oversized.push({ path: f, bytes: size });
    } catch { /* unreadable; already excluded from the walk */ }
  }

  const { chosen, candidates } = findCharacterDef(rootAbs, files);

  const warnings = [];
  if (truncated) warnings.push(`Package walk stopped early: over ${LIMITS.maxFiles} files or ${LIMITS.maxPackageBytes} bytes`);
  if (executables.length) {
    warnings.push(`${executables.length} executable file(s) present. They were NOT opened or run.`);
  }
  if (archives.length) {
    warnings.push(`${archives.length} nested archive(s) present. They were not extracted — unpack them yourself first.`);
  }
  for (const o of oversized) warnings.push(`${o.path} is ${o.bytes} bytes, over the per-file limit`);

  const errors = [];
  if (!files.length) errors.push('The package is empty');
  if (!chosen) errors.push('No character .def found (a .def with a [Files] block naming a sprite)');

  return {
    root: rootAbs,
    fileCount: files.length,
    totalBytes: bytes,
    truncated,
    files,
    byExtension: byExt,
    executables,
    archives,
    images,
    audio,
    parseable,
    oversized,
    defCandidates: candidates,
    def: chosen,
    sffFiles: files.filter((f) => f.toLowerCase().endsWith('.sff')),
    airFiles: files.filter((f) => f.toLowerCase().endsWith('.air')),
    cmdFiles: files.filter((f) => f.toLowerCase().endsWith('.cmd')),
    cnsFiles: files.filter((f) => /\.(cns|st\d?)$/i.test(f)),
    sndFiles: files.filter((f) => f.toLowerCase().endsWith('.snd')),
    errors,
    warnings,
    safeToParse: errors.length === 0,
  };
}

export default inspectPackage;
