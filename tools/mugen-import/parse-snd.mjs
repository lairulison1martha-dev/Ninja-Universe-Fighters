/**
 * .snd — the sound archive.
 *
 * Header (SFF-like):
 *   0  12  "ElecbyteSnd\0"
 *   12  4  version
 *   16  4  number of sounds
 *   20  4  offset of the first sound subheader
 *   24  4  subheader size
 *   28 ... comments
 *
 * Sound subheader (16 bytes): next offset, length, group, sample number,
 * followed by a WAV payload.
 *
 * The importer READS THE INDEX ONLY. Audio is never extracted or converted by
 * default, because a MUGEN .snd is where ripped voice lines and game rips
 * overwhelmingly live. What comes out of here is a report: which groups exist,
 * how many samples, and which of MUGEN's well-known group numbers they match,
 * so a human can decide.
 */

import { readCapped, LIMITS } from './limits.mjs';

/** Group numbers MUGEN's common states play by convention. */
const KNOWN_GROUPS = {
  0: 'character voice / common',
  1: 'attack voices',
  2: 'hurt / pain voices',
  3: 'special move voices',
  4: 'super / ultimate voices',
  5: 'intro and win quotes',
  10: 'effect sounds',
  11: 'effect sounds',
};

export function parseSnd(root, relPath) {
  const buf = readCapped(root, relPath);
  return parseSndBuffer(buf, relPath);
}

export function parseSndBuffer(buf, label = '<snd>') {
  const errors = [];
  const warnings = [];
  if (buf.length < 32) {
    errors.push(`${label}: too short to be a .snd`);
    return { valid: false, sounds: [], groups: [], errors, warnings };
  }
  if (buf.toString('latin1', 0, 12) !== 'ElecbyteSnd\0') {
    errors.push(`${label}: bad signature`);
    return { valid: false, sounds: [], groups: [], errors, warnings };
  }

  const numSounds = buf.readUInt32LE(16);
  let offset = buf.readUInt32LE(20);
  const sounds = [];
  const cap = Math.min(numSounds, LIMITS.maxSprites);
  if (numSounds > cap) warnings.push(`${label}: ${numSounds} sounds, stopped at ${cap}`);

  for (let n = 0; n < cap; n++) {
    if (offset <= 0 || offset + 16 > buf.length) break;
    const next = buf.readUInt32LE(offset);
    const length = buf.readUInt32LE(offset + 4);
    const group = buf.readUInt32LE(offset + 8);
    const sample = buf.readUInt32LE(offset + 12);
    // The payload is a WAV. It is measured and described, never written out.
    const dataStart = offset + 16;
    const isWav = dataStart + 12 <= buf.length
      && buf.toString('latin1', dataStart, dataStart + 4) === 'RIFF';
    sounds.push({ index: n, group, sample, bytes: length, isWav });
    if (next === 0 || next <= offset) break;
    offset = next;
  }

  const byGroup = new Map();
  for (const s of sounds) {
    const g = byGroup.get(s.group) || { group: s.group, count: 0, bytes: 0 };
    g.count++;
    g.bytes += s.bytes;
    byGroup.set(s.group, g);
  }
  const groups = [...byGroup.values()]
    .sort((a, b) => a.group - b.group)
    .map((g) => ({ ...g, meaning: KNOWN_GROUPS[g.group] || 'character-specific' }));

  return {
    valid: errors.length === 0,
    declaredCount: numSounds,
    sounds,
    groups,
    totalBytes: sounds.reduce((n, s) => n + s.bytes, 0),
    /** Always false by default — audio import needs explicit, per-package rights. */
    importedAudio: false,
    errors,
    warnings,
  };
}

export default parseSnd;
