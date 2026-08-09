/**
 * .air — animations.
 *
 * Format, as MUGEN actually writes it:
 *
 *   [Begin Action 0]
 *   Clsn2Default: 2                  ; boxes that apply to every later frame
 *    Clsn2[0] = -10, 0, 10, -70
 *    Clsn2[1] = -6, -70, 6, -90
 *   Clsn1: 1                         ; boxes for the NEXT frame only
 *    Clsn1[0] = 10, -80, 30, -60
 *   0, 0, 0, 0, 4                    ; group, image, xoff, yoff, ticks
 *   0, 1, 0, 0, 4, H                 ; + flip flags
 *   0, 2, 0, 0, 4, , A               ; + blend mode
 *   Loopstart
 *   0, 3, 0, 0, -1                   ; -1 ticks = hold forever
 *
 * Two collision kinds:
 *   Clsn1 = attack boxes  (this frame hits here)
 *   Clsn2 = hurt boxes    (this frame can be hit here)
 * "Default" variants persist until replaced; plain ones apply to the next
 * frame only. Getting that distinction wrong silently gives every frame the
 * first frame's hitbox, so it is handled explicitly below.
 *
 * Coordinates are MUGEN's: x right, **y down-negative** (up is negative),
 * relative to the sprite's axis. Conversion happens in hitbox-map.mjs, not
 * here — this parser reports what the file says.
 */

import { parseIni, toInt, splitTuple } from './ini.mjs';
import { readText, LIMITS, ImportError } from './limits.mjs';

const BOX_RE = /^(clsn1|clsn2)(default)?\s*\[\s*(\d+)\s*\]$/i;
const BOX_COUNT_RE = /^(clsn1|clsn2)(default)?$/i;

/**
 * Parse one AIR file.
 *
 * @param {string} root package root
 * @param {string} relPath .air path relative to root
 * @returns {{ animations: Object[], byNumber: Map<number,Object>, errors: string[], warnings: string[] }}
 */
export function parseAir(root, relPath) {
  const text = readText(root, relPath);
  return parseAirText(text, relPath);
}

/** Same, from a string — this is what the tests drive. */
export function parseAirText(text, label = '<air>') {
  const { sections } = parseIni(text);
  const animations = [];
  const errors = [];
  const warnings = [];

  for (const sec of sections) {
    const m = /^begin\s+action\s+(-?\d+)$/i.exec(sec.nameLower.replace(/\s+/g, ' ').trim());
    if (!m) {
      if (sec.nameLower.startsWith('begin action')) {
        errors.push(`${label}:${sec.line}: unreadable action header "[${sec.name}]"`);
      }
      continue;
    }
    if (animations.length >= LIMITS.maxAnimations) {
      warnings.push(`${label}: stopped at ${LIMITS.maxAnimations} animations`);
      break;
    }

    const number = toInt(m[1], 0);
    const frames = [];
    let loopStart = 0;

    // Boxes that persist across frames until redefined.
    let defaultClsn1 = [];
    let defaultClsn2 = [];
    // Boxes that apply to the next frame only.
    let pendingClsn1 = null;
    let pendingClsn2 = null;
    // Which list the numbered rows currently being read belong to.
    let collecting = null;

    for (const row of sec.rows) {
      const line = row.text;
      const eq = line.indexOf('=');
      const lhs = (eq > 0 ? line.slice(0, eq) : line).trim();
      const rhs = eq > 0 ? line.slice(eq + 1).trim() : '';

      // `Clsn2Default: 2` / `Clsn1: 1` — a count, opening a box block.
      const colon = lhs.indexOf(':');
      if (colon > 0 && eq === -1) {
        const kind = lhs.slice(0, colon).trim();
        const cm = BOX_COUNT_RE.exec(kind);
        if (cm) {
          const isDefault = !!cm[2];
          const which = cm[1].toLowerCase();
          const target = [];
          if (which === 'clsn1') {
            if (isDefault) { defaultClsn1 = target; } else { pendingClsn1 = target; }
          } else if (isDefault) { defaultClsn2 = target; } else { pendingClsn2 = target; }
          collecting = target;
          continue;
        }
      }

      // `Clsn2[0] = -10, 0, 10, -70`
      const bm = BOX_RE.exec(lhs);
      if (bm && eq > 0) {
        const parts = splitTuple(rhs);
        if (parts.length < 4) {
          errors.push(`${label}:${row.line}: collision box needs 4 values`);
          continue;
        }
        const box = {
          x1: toInt(parts[0]), y1: toInt(parts[1]),
          x2: toInt(parts[2]), y2: toInt(parts[3]),
        };
        const isDefault = !!bm[2];
        const which = bm[1].toLowerCase();
        let target = collecting;
        // Some files write the indexed rows without the count line first.
        if (!target) {
          if (which === 'clsn1') target = isDefault ? (defaultClsn1 = []) : (pendingClsn1 = []);
          else target = isDefault ? (defaultClsn2 = []) : (pendingClsn2 = []);
        }
        if (target.length < LIMITS.maxBoxesPerFrame) target.push(box);
        continue;
      }

      if (/^loopstart$/i.test(lhs)) {
        loopStart = frames.length;
        collecting = null;
        continue;
      }
      // MUGEN 1.1 interpolation hints — recorded, not simulated.
      if (/^interpolate\s+(offset|blend|scale|angle)$/i.test(lhs)) {
        if (frames.length) frames[frames.length - 1].interpolate = lhs.toLowerCase();
        continue;
      }

      // Otherwise: a frame row.
      const parts = splitTuple(line);
      if (parts.length < 5) {
        if (parts.length && parts[0] !== '') {
          warnings.push(`${label}:${row.line}: ignored "${line}"`);
        }
        continue;
      }
      if (frames.length >= LIMITS.maxFramesPerAnimation) {
        warnings.push(`${label}: action ${number} truncated at ${LIMITS.maxFramesPerAnimation} frames`);
        break;
      }

      const flags = (parts[5] || '').trim().toUpperCase();
      const frame = {
        group: toInt(parts[0]),
        image: toInt(parts[1]),
        xOffset: toInt(parts[2]),
        yOffset: toInt(parts[3]),
        /** MUGEN ticks at 60 fps. -1 means hold indefinitely. */
        ticks: toInt(parts[4], 1),
        flipH: flags.includes('H'),
        flipV: flags.includes('V'),
        blend: (parts[6] || '').trim().toUpperCase() || null,
        clsn1: pendingClsn1 || defaultClsn1,
        clsn2: pendingClsn2 || defaultClsn2,
        /** True when the boxes came from a Default block rather than this frame. */
        clsn1Inherited: !pendingClsn1,
        clsn2Inherited: !pendingClsn2,
      };
      frames.push(frame);
      pendingClsn1 = null;
      pendingClsn2 = null;
      collecting = null;
    }

    if (!frames.length) {
      warnings.push(`${label}: action ${number} has no frames`);
    }

    const totalTicks = frames.reduce((n, f) => n + (f.ticks > 0 ? f.ticks : 0), 0);
    animations.push({
      number,
      frames,
      loopStart,
      totalTicks,
      /** Total run time in seconds at MUGEN's 60 ticks per second. */
      durationSeconds: Number((totalTicks / 60).toFixed(4)),
      /** A -1 frame means the animation parks on its last frame. */
      loops: !frames.some((f) => f.ticks < 0),
      hasAttackBoxes: frames.some((f) => f.clsn1 && f.clsn1.length),
      hasHurtBoxes: frames.some((f) => f.clsn2 && f.clsn2.length),
      line: sec.line,
    });
  }

  const byNumber = new Map();
  for (const a of animations) {
    if (byNumber.has(a.number)) {
      warnings.push(`${label}: action ${a.number} is defined more than once; the first wins`);
      continue;
    }
    byNumber.set(a.number, a);
  }

  return { animations, byNumber, errors, warnings };
}

/**
 * Every (group, image) pair an AIR file references, so the SFF can be checked
 * for missing sprites before anything is exported.
 */
export function referencedSprites(animations) {
  const set = new Set();
  for (const a of animations) {
    for (const f of a.frames) {
      // group -1 is MUGEN's "blank frame" — it references no sprite.
      if (f.group === -1) continue;
      set.add(`${f.group},${f.image}`);
    }
  }
  return [...set].map((k) => {
    const [g, i] = k.split(',').map(Number);
    return { group: g, image: i };
  });
}

export default parseAir;
