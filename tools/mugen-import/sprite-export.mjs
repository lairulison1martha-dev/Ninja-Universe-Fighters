/**
 * Sprite export — into staging, never over live art.
 *
 * Two outputs:
 *   sprite-sheet.png  every mapped clip laid out on the game's 64x64 grid,
 *                     one row per clip, so it drops straight into the existing
 *                     SpriteAnimator without a new atlas format.
 *   portrait.png      a single frame, cropped the way the roster expects.
 *
 * The awkward part is the origin. MUGEN sprites are positioned by an axis at
 * the character's feet; the game's atlas positions by a fixed anchor at
 * (32, 58) in each cell. So each sprite is blitted with its axis placed on the
 * anchor, and anything that falls outside the cell is clipped — reported, not
 * silently dropped.
 */

import fs from 'node:fs';
import path from 'node:path';
import { encodePng } from './png.mjs';
import { spriteToRgba } from './parse-sff.mjs';
import { safeStagingPath, checkSpriteSize, LIMITS } from './limits.mjs';

/** The game's atlas geometry — must match js/combat/sprite-animator.js. */
export const CELL = 64;
export const ANCHOR_X = 32;
export const ANCHOR_Y = 58;

/** Blit one MUGEN sprite into a 64x64 cell, aligning its axis to the anchor. */
export function blitCell(dst, dstW, cellX, cellY, rgba, w, h, axisX, axisY, scale = 1) {
  let clipped = 0;
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));
  // Where the sprite's top-left lands so that its axis sits on the anchor.
  const originX = cellX + ANCHOR_X - Math.round(axisX * scale);
  const originY = cellY + ANCHOR_Y - Math.round(axisY * scale);

  for (let y = 0; y < sh; y++) {
    const srcY = Math.min(h - 1, Math.floor(y / scale));
    const dy = originY + y;
    if (dy < cellY || dy >= cellY + CELL) { clipped += sw; continue; }
    for (let x = 0; x < sw; x++) {
      const srcX = Math.min(w - 1, Math.floor(x / scale));
      const dx = originX + x;
      if (dx < cellX || dx >= cellX + CELL) { clipped++; continue; }
      const s = (srcY * w + srcX) * 4;
      if (rgba[s + 3] === 0) continue;
      const d = (dy * dstW + dx) * 4;
      dst[d] = rgba[s];
      dst[d + 1] = rgba[s + 1];
      dst[d + 2] = rgba[s + 2];
      dst[d + 3] = rgba[s + 3];
    }
  }
  return { clipped, drawn: sw * sh - clipped };
}

/**
 * Build a sprite sheet from mapped clips.
 *
 * @param {Object} opts
 *   clips     { clipName: { action, frames: [{group,image,...}] } }
 *   sff       parsed SFF (for byKey)
 *   order     clip order for the rows
 *   scale     MUGEN-pixel → game-pixel scale
 * @returns {{ png: Buffer, meta: Object, warnings: string[] }}
 */
export function buildSpriteSheet({ clips, sff, order, scale = 1, maxColumns = 8 }) {
  const rows = order.filter((c) => clips[c] && clips[c].frames.length);
  const cols = Math.min(
    maxColumns,
    Math.max(1, ...rows.map((c) => clips[c].frames.length)),
  );
  const width = cols * CELL;
  const height = Math.max(1, rows.length) * CELL;
  checkSpriteSize(width, height, 'sprite sheet');

  const dst = Buffer.alloc(width * height * 4);
  const warnings = [];
  const animations = {};
  let drawnFrames = 0;
  let missingFrames = 0;
  let clippedPixels = 0;

  rows.forEach((clip, r) => {
    const frames = clips[clip].frames.slice(0, cols);
    animations[clip] = {
      row: r,
      frames: frames.length,
      /** Per-frame durations in seconds, straight from the AIR ticks. */
      durations: frames.map((f) => Number(((f.ticks > 0 ? f.ticks : 1) / 60).toFixed(4))),
      sourceAction: clips[clip].action,
    };
    frames.forEach((f, c) => {
      const sprite = sff.byKey.get(`${f.group},${f.image}`);
      if (!sprite) {
        missingFrames++;
        warnings.push(`${clip} frame ${c}: sprite ${f.group},${f.image} is not in the SFF`);
        return;
      }
      const img = spriteToRgba(sprite);
      if (!img) {
        missingFrames++;
        warnings.push(`${clip} frame ${c}: sprite ${f.group},${f.image} did not decode`);
        return;
      }
      const res = blitCell(
        dst, width, c * CELL, r * CELL,
        img.data, img.width, img.height,
        sprite.axisX + (f.xOffset || 0), sprite.axisY + (f.yOffset || 0),
        scale,
      );
      clippedPixels += res.clipped;
      drawnFrames++;
    });
  });

  if (clippedPixels > 0) {
    warnings.push(
      `${clippedPixels} source pixels fell outside the ${CELL}x${CELL} cells — `
      + 'the scale may need lowering, or these sprites are larger than the game\'s grid',
    );
  }

  return {
    png: encodePng(width, height, dst),
    meta: {
      width, height, cell: CELL, columns: cols, rows: rows.length,
      anchor: { x: ANCHOR_X, y: ANCHOR_Y },
      animations,
      drawnFrames, missingFrames, clippedPixels,
    },
    warnings,
  };
}

/** Crop one sprite to a portrait, centred on its upper body. */
export function buildPortrait(sff, group, image, { size = 96, scale = 1 } = {}) {
  const sprite = sff.byKey.get(`${group},${image}`);
  if (!sprite) return null;
  const img = spriteToRgba(sprite);
  if (!img) return null;

  const dst = Buffer.alloc(size * size * 4);
  // Frame the head and shoulders: the axis is at the feet, so shift up.
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const ox = Math.round(size / 2 - sprite.axisX * scale);
  const oy = Math.round(size * 0.92 - sprite.axisY * scale);

  for (let y = 0; y < sh; y++) {
    const dy = oy + y;
    if (dy < 0 || dy >= size) continue;
    const srcY = Math.min(img.height - 1, Math.floor(y / scale));
    for (let x = 0; x < sw; x++) {
      const dx = ox + x;
      if (dx < 0 || dx >= size) continue;
      const srcX = Math.min(img.width - 1, Math.floor(x / scale));
      const s = (srcY * img.width + srcX) * 4;
      if (img.data[s + 3] === 0) continue;
      const d = (dy * size + dx) * 4;
      dst[d] = img.data[s];
      dst[d + 1] = img.data[s + 1];
      dst[d + 2] = img.data[s + 2];
      dst[d + 3] = img.data[s + 3];
    }
  }
  return encodePng(size, size, dst);
}

/**
 * Dump every decoded sprite as a PNG, for inspection.
 * Capped, and written only under the staging root.
 */
export function exportRawSprites(sff, stagingRoot, subdir = 'source/sprites', limit = 400) {
  const outDir = safeStagingPath(stagingRoot, subdir);
  fs.mkdirSync(outDir, { recursive: true });
  let written = 0;
  const failures = [];
  for (const s of sff.sprites) {
    if (written >= limit) break;
    const img = spriteToRgba(s);
    if (!img) { failures.push(`${s.group},${s.image}: ${s.error || 'no pixels'}`); continue; }
    try {
      const file = safeStagingPath(stagingRoot, `${subdir}/${s.group}-${s.image}.png`);
      fs.writeFileSync(file, encodePng(img.width, img.height, img.data));
      written++;
    } catch (err) {
      failures.push(`${s.group},${s.image}: ${err.message}`);
    }
  }
  return { written, failures, dir: outDir };
}

export default buildSpriteSheet;

/**
 * How much to scale MUGEN artwork so a character fits the atlas cell.
 *
 * This is a DIFFERENT scale from hitbox-map's. That one converts MUGEN units
 * into the game's world units, where a fighter stands ~158 tall. This one
 * converts MUGEN pixels into atlas pixels, where a fighter has to fit between
 * the anchor at y=58 and the top of a 64px cell — about 50px of headroom.
 *
 * Conflating the two upscales every sprite by ~2.8x and clips most of it off
 * the cell, which is exactly what the first proof-of-concept run did.
 */
export function deriveSpriteScale(sff, clips, { headroom = ANCHOR_Y - 6, margin = 4 } = {}) {
  let maxH = 0;
  let maxW = 0;
  const seen = new Set();
  for (const clip of Object.values(clips || {})) {
    for (const f of clip.frames || []) {
      const key = `${f.group},${f.image}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = sff.byKey.get(key);
      if (!s || !s.width) continue;
      maxH = Math.max(maxH, s.height);
      maxW = Math.max(maxW, s.width);
    }
  }
  if (!maxH || !maxW) return 1;
  // Never upscale: a MUGEN sprite smaller than the cell keeps its own pixels.
  return Math.min(1, headroom / maxH, (CELL - margin) / maxW);
}
