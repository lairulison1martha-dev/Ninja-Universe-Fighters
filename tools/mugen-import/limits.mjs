/**
 * Security limits and safe filesystem access for the MUGEN importer.
 *
 * A downloaded MUGEN package is UNTRUSTED INPUT. It arrives as a zip from a
 * forum, it can name any file it likes in its .def, and nothing stops a
 * malicious one from pointing at `../../../js/main.js` or shipping a 4 GB
 * "sprite". Everything the importer touches goes through this module:
 *
 *   - reads are confined to the package root (path traversal is refused),
 *   - writes are confined to the staging root,
 *   - executables are never opened, let alone run,
 *   - every size, count and dimension is capped before allocation.
 *
 * The importer parses data formats only. It never executes anything from a
 * package: no EXE, BAT, CMD, DLL, VBS, or shell of any kind.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Hard caps. Chosen to be generous for real characters and fatal for bombs. */
export const LIMITS = Object.freeze({
  /** Any single file inside a package. */
  maxFileBytes: 64 * 1024 * 1024,
  /** Whole package on disk. */
  maxPackageBytes: 512 * 1024 * 1024,
  /** Files walked while inspecting a package. */
  maxFiles: 5000,
  /** Directory recursion depth. */
  maxDepth: 12,
  /** Sprites decoded from one SFF. */
  maxSprites: 4000,
  /** Pixels in one decoded sprite (guards a 60000x60000 header). */
  maxSpritePixels: 4096 * 4096,
  /** Either dimension of one sprite. */
  maxSpriteDimension: 4096,
  /** Animations in one AIR file. */
  maxAnimations: 1000,
  /** Frames in one animation. */
  maxFramesPerAnimation: 512,
  /** Collision boxes on one frame. */
  maxBoxesPerFrame: 64,
  /** States parsed from CNS/ST files. */
  maxStates: 4000,
  /** Bytes a decompressor may emit for one sprite. */
  maxDecompressedBytes: 64 * 1024 * 1024,
  /** Lines read from any text file. */
  maxTextLines: 200000,
});

/** File types the importer will open. Everything else is reported, not read. */
export const PARSEABLE_EXTENSIONS = Object.freeze([
  '.def', '.sff', '.air', '.cmd', '.cns', '.st', '.snd', '.txt', '.md', '.act',
]);

/**
 * Extensions that must never be opened or executed. Presence in a package is
 * recorded in the audit as a red flag, not acted on.
 *
 * `.cmd` is deliberately NOT here even though it is a Windows batch extension:
 * in a MUGEN package `.cmd` is the character's command file, and refusing to
 * read it would break every import. That is safe because this importer has no
 * execution path at all — it reads bytes and parses them. The danger of a
 * Windows `.cmd` is running it, and nothing here runs anything.
 */
export const EXECUTABLE_EXTENSIONS = Object.freeze([
  '.exe', '.bat', '.com', '.dll', '.msi', '.scr', '.vbs', '.vbe',
  '.js', '.jse', '.ps1', '.psm1', '.sh', '.bash', '.jar', '.app', '.so',
  '.dylib', '.bin', '.reg', '.lnk', '.pif', '.hta', '.wsf',
]);

export class ImportError extends Error {
  constructor(message, code = 'IMPORT_ERROR') {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

/**
 * Resolve `candidate` inside `root`, refusing anything that escapes.
 *
 * Handles the three ways a package tries to get out: `..` segments, absolute
 * paths, and symlinks pointing outside. Windows-style separators are
 * normalised first, because .def files are written on Windows and say
 * `sprites\char.sff`.
 *
 * @param {string} root absolute directory the path must stay inside
 * @param {string} candidate untrusted relative path from a package
 * @returns {string} absolute, verified path
 */
export function safeResolve(root, candidate) {
  if (typeof candidate !== 'string' || !candidate.length) {
    throw new ImportError('Empty path', 'PATH_EMPTY');
  }
  if (candidate.includes('\0')) {
    throw new ImportError('Path contains a NUL byte', 'PATH_NUL');
  }
  const rel = candidate.replace(/\\/g, '/').replace(/^\/+/, '');
  if (path.isAbsolute(candidate) || /^[a-zA-Z]:/.test(candidate)) {
    throw new ImportError(`Absolute path refused: ${candidate}`, 'PATH_ABSOLUTE');
  }
  const rootAbs = path.resolve(root);
  const full = path.resolve(rootAbs, rel);
  const prefix = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
  if (full !== rootAbs && !full.startsWith(prefix)) {
    throw new ImportError(`Path escapes the package: ${candidate}`, 'PATH_TRAVERSAL');
  }
  // A symlink can point outside even when the textual path does not.
  try {
    const realRoot = fs.realpathSync(rootAbs);
    const realFull = fs.realpathSync(full);
    const realPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
    if (realFull !== realRoot && !realFull.startsWith(realPrefix)) {
      throw new ImportError(`Symlink escapes the package: ${candidate}`, 'PATH_TRAVERSAL');
    }
  } catch (err) {
    if (err instanceof ImportError) throw err;
    // Does not exist yet — the textual check above already passed.
  }
  return full;
}

/** True when this file is one the importer is willing to open. */
export function isParseable(file) {
  return PARSEABLE_EXTENSIONS.includes(path.extname(file).toLowerCase());
}

/** True when this file must never be opened or run. */
export function isExecutable(file) {
  return EXECUTABLE_EXTENSIONS.includes(path.extname(file).toLowerCase());
}

/**
 * Read a file from inside `root`, size-capped.
 * @returns {Buffer}
 */
export function readCapped(root, relPath, maxBytes = LIMITS.maxFileBytes) {
  const full = safeResolve(root, relPath);
  if (isExecutable(full)) {
    throw new ImportError(`Refusing to read an executable: ${relPath}`, 'EXECUTABLE');
  }
  const st = fs.statSync(full);
  if (!st.isFile()) throw new ImportError(`Not a file: ${relPath}`, 'NOT_A_FILE');
  if (st.size > maxBytes) {
    throw new ImportError(
      `File too large: ${relPath} is ${st.size} bytes, limit ${maxBytes}`, 'FILE_TOO_LARGE',
    );
  }
  return fs.readFileSync(full);
}

/** Read a MUGEN text file. They are Windows-encoded and inconsistently cased. */
export function readText(root, relPath) {
  const buf = readCapped(root, relPath, Math.min(LIMITS.maxFileBytes, 16 * 1024 * 1024));
  // MUGEN files are typically CP1252/Shift-JIS. latin1 never throws and keeps
  // byte values intact, which is what the parsers need — they only care about
  // ASCII syntax, and non-ASCII survives round-trip for display.
  const text = buf.toString('latin1');
  const lines = text.split(/\r?\n/);
  if (lines.length > LIMITS.maxTextLines) {
    throw new ImportError(`Too many lines in ${relPath}`, 'TEXT_TOO_LONG');
  }
  return text;
}

/**
 * Walk a package directory, capped in file count and depth.
 * @returns {{ files: string[], truncated: boolean, bytes: number }}
 */
export function walkPackage(root) {
  const rootAbs = path.resolve(root);
  const files = [];
  let bytes = 0;
  let truncated = false;

  const visit = (dir, depth) => {
    if (truncated || depth > LIMITS.maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (files.length >= LIMITS.maxFiles) { truncated = true; return; }
      const full = path.join(dir, e.name);
      // Never follow a symlink out of the package.
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { visit(full, depth + 1); continue; }
      if (!e.isFile()) continue;
      let size = 0;
      try { size = fs.statSync(full).size; } catch { continue; }
      bytes += size;
      files.push(path.relative(rootAbs, full).replace(/\\/g, '/'));
      if (bytes > LIMITS.maxPackageBytes) { truncated = true; return; }
    }
  };

  visit(rootAbs, 0);
  files.sort();
  return { files, truncated, bytes };
}

/** Guard a decoded sprite's dimensions before any allocation happens. */
export function checkSpriteSize(w, h, where = 'sprite') {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0 || h < 0) {
    throw new ImportError(`${where}: bad dimensions ${w}x${h}`, 'BAD_DIMENSIONS');
  }
  if (w > LIMITS.maxSpriteDimension || h > LIMITS.maxSpriteDimension) {
    throw new ImportError(
      `${where}: ${w}x${h} exceeds the ${LIMITS.maxSpriteDimension}px limit`, 'SPRITE_TOO_BIG',
    );
  }
  if (w * h > LIMITS.maxSpritePixels) {
    throw new ImportError(`${where}: ${w * h} pixels exceeds the limit`, 'SPRITE_TOO_BIG');
  }
}

/** Ensure a staging write stays under the staging root. */
export function safeStagingPath(stagingRoot, relPath) {
  return safeResolve(stagingRoot, relPath);
}
