/**
 * .sff — the sprite archive.
 *
 * Two incompatible formats share one signature, distinguished by a version
 * byte:
 *
 *   SFF v1 (MUGEN 2002 / WinMUGEN) — a linked list of 32-byte headers, each
 *     followed by a whole PCX file. Palettes are per-sprite or shared with the
 *     previous sprite.
 *
 *   SFF v2 (MUGEN 1.0 / 1.1) — a sprite table and a palette table over two
 *     data blobs, with five payload encodings: raw indexed, RLE8, RLE5, LZ5,
 *     and embedded PNG8/24/32.
 *
 * Both keep what the importer actually needs: group, image number, the axis
 * (MUGEN's origin, which is the character's feet, not the top-left), and the
 * palette. Index 0 of a MUGEN palette is transparent by convention — that is
 * how a character gets a cut-out silhouette — and is honoured here.
 *
 * Every sprite is decoded behind the size caps in limits.mjs. A header
 * claiming 60000x60000 is refused before a single byte is allocated.
 */

import {
  LIMITS, checkSpriteSize, readCapped, ImportError,
} from './limits.mjs';
import { decodePng, isPng } from './png.mjs';

const SIGNATURE = 'ElecbyteSpr\0';

export const SFF_FORMATS = Object.freeze({
  0: 'raw', 1: 'invalid', 2: 'rle8', 3: 'rle5', 4: 'lz5',
  10: 'png8', 11: 'png24', 12: 'png32',
});

/* --------------------------------------------------------------- decoders -- */

/** PCX run-length decoding, as used by every SFF v1 sprite. */
export function decodePcx(buf) {
  if (buf.length < 128) throw new ImportError('PCX too short', 'PCX_CORRUPT');
  if (buf[0] !== 0x0a) throw new ImportError('Not a PCX', 'PCX_BAD_SIGNATURE');
  const encoding = buf[2];
  const bpp = buf[3];
  const xMin = buf.readUInt16LE(4);
  const yMin = buf.readUInt16LE(6);
  const xMax = buf.readUInt16LE(8);
  const yMax = buf.readUInt16LE(10);
  const nPlanes = buf[65];
  const bytesPerLine = buf.readUInt16LE(66);

  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  checkSpriteSize(width, height, 'PCX');
  if (bpp !== 8 || nPlanes !== 1) {
    throw new ImportError(`Unsupported PCX: ${bpp}bpp x${nPlanes} planes`, 'PCX_UNSUPPORTED');
  }

  const total = bytesPerLine * height;
  if (total > LIMITS.maxDecompressedBytes) {
    throw new ImportError('PCX decompresses too large', 'PCX_TOO_BIG');
  }
  const out = Buffer.alloc(total);

  if (encoding === 0) {
    buf.copy(out, 0, 128, Math.min(buf.length, 128 + total));
  } else {
    let i = 128;
    let o = 0;
    while (o < total && i < buf.length) {
      const b = buf[i++];
      if ((b & 0xc0) === 0xc0) {
        const count = b & 0x3f;
        if (i >= buf.length) break;
        const value = buf[i++];
        const end = Math.min(o + count, total);
        out.fill(value, o, end);
        o = end;
      } else {
        out[o++] = b;
      }
    }
  }

  // A PCX scanline is padded to bytesPerLine; the image is only `width` wide.
  const pixels = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    out.copy(pixels, y * width, y * bytesPerLine, y * bytesPerLine + width);
  }

  // 256-colour palette lives in the last 769 bytes, behind a 0x0C marker.
  let palette = null;
  if (buf.length >= 769 && buf[buf.length - 769] === 0x0c) {
    palette = Buffer.from(buf.subarray(buf.length - 768));
  }

  return { width, height, pixels, palette };
}

/** SFF v2 format 2. Top two bits `01` mark a run. */
export function decodeRle8(src, size) {
  const dst = Buffer.alloc(size);
  let i = 0;
  let j = 0;
  while (j < size && i < src.length) {
    const b = src[i++];
    if ((b & 0xc0) === 0x40) {
      const count = b & 0x3f;
      if (i >= src.length) break;
      const value = src[i++];
      const end = Math.min(j + count, size);
      dst.fill(value, j, end);
      j = end;
    } else {
      dst[j++] = b;
    }
  }
  return dst;
}

/**
 * SFF v2 format 3. Alternating run-length / packed-colour stream: a header
 * pair gives the first run, then `dl` packed bytes each carrying a 3-bit run
 * length and a 5-bit colour.
 */
export function decodeRle5(src, size) {
  const dst = Buffer.alloc(size);
  let i = 0;
  let j = 0;
  while (j < size && i < src.length) {
    let rl = src[i++];
    if (i >= src.length) break;
    const flag = src[i];
    let dl = flag & 0x7f;
    let c = 0;
    if (flag & 0x80) {
      i++;
      if (i >= src.length) break;
      c = src[i];
    }
    i++;
    for (;;) {
      if (j < size) dst[j++] = c;
      rl--;
      if (rl < 0) {
        dl--;
        if (dl < 0) break;
        if (i >= src.length) return dst;
        c = src[i] & 0x1f;
        rl = src[i] >> 5;
        i++;
      }
      if (j >= size) break;
    }
  }
  return dst;
}

/**
 * SFF v2 format 4. A control byte supplies eight flag bits; each cleared bit
 * introduces a literal colour run and each set bit a back-reference copy.
 */
export function decodeLz5(src, size) {
  const dst = Buffer.alloc(size);
  if (!src.length) return dst;
  let i = 0;
  let j = 0;
  let ct = src[i++];
  let cts = 0;
  let rb = 0;
  let rbc = 0;

  while (j < size && i < src.length) {
    let d = src[i++];
    if (ct & (1 << cts)) {
      // Back-reference.
      let n;
      if ((d & 0x3f) === 0) {
        if (i + 1 >= src.length) break;
        d = (d << 2) | src[i++];
        n = src[i++] + 3;
      } else {
        rb |= (d & 0xc0) >> rbc;
        rbc += 2;
        n = d & 0x3f;
        if (rbc < 8) {
          if (i >= src.length) break;
          d = src[i++] + 1;
        } else {
          d = rb + 1;
          rb = 0;
          rbc = 0;
        }
      }
      for (;;) {
        if (j < size) {
          dst[j] = j - d >= 0 ? dst[j - d] : 0;
          j++;
        }
        n--;
        if (n < 0) break;
        if (j >= size) break;
      }
    } else {
      // Literal run.
      let n;
      if ((d & 0xe0) === 0) {
        if (i >= src.length) break;
        n = src[i++] + 8;
      } else {
        n = d >> 5;
        d &= 0x1f;
      }
      for (; n > 0 && j < size; n--) dst[j++] = d;
    }
    cts++;
    if (cts >= 8) {
      if (i >= src.length) break;
      ct = src[i++];
      cts = 0;
    }
  }
  return dst;
}

/* ------------------------------------------------------------------ SFF v1 -- */

function parseSffV1(buf, report) {
  const numImages = buf.readUInt32LE(20);
  let offset = buf.readUInt32LE(24);
  const sharedPalette = buf[32] === 1;

  const sprites = [];
  let lastPalette = null;
  const count = Math.min(numImages, LIMITS.maxSprites);
  if (numImages > LIMITS.maxSprites) {
    report.warnings.push(`SFF declares ${numImages} sprites; stopped at ${LIMITS.maxSprites}`);
  }

  for (let n = 0; n < count; n++) {
    if (offset <= 0 || offset + 32 > buf.length) {
      report.warnings.push(`Sprite ${n}: header offset ${offset} is outside the file`);
      break;
    }
    const next = buf.readUInt32LE(offset);
    const length = buf.readUInt32LE(offset + 4);
    const axisX = buf.readInt16LE(offset + 8);
    const axisY = buf.readInt16LE(offset + 10);
    const group = buf.readUInt16LE(offset + 12);
    const image = buf.readUInt16LE(offset + 14);
    const linkIndex = buf.readUInt16LE(offset + 16);
    const paletteSame = buf[offset + 18] !== 0;
    const dataStart = offset + 32;

    const entry = {
      index: n, group, image, axisX, axisY,
      format: 'pcx', linked: length === 0, linkIndex,
      width: 0, height: 0, pixels: null, palette: null,
      error: null,
    };

    if (length === 0) {
      // Linked sprite: reuses another sprite's pixels entirely.
      sprites.push(entry);
      offset = next;
      continue;
    }

    if (dataStart + length > buf.length) {
      entry.error = `data runs past the end of the file`;
      report.warnings.push(`Sprite ${n} (${group},${image}): ${entry.error}`);
      sprites.push(entry);
      offset = next;
      continue;
    }

    try {
      const pcx = decodePcx(buf.subarray(dataStart, dataStart + length));
      entry.width = pcx.width;
      entry.height = pcx.height;
      entry.pixels = pcx.pixels;
      if (pcx.palette && !paletteSame) {
        entry.palette = pcx.palette;
        lastPalette = pcx.palette;
      } else {
        entry.palette = lastPalette;
        if (pcx.palette && !lastPalette) {
          entry.palette = pcx.palette;
          lastPalette = pcx.palette;
        }
      }
    } catch (err) {
      entry.error = err.message;
      report.warnings.push(`Sprite ${n} (${group},${image}): ${err.message}`);
    }

    sprites.push(entry);
    if (next === 0) break;
    if (next <= offset) {
      report.warnings.push('SFF v1 sprite chain does not advance; stopping');
      break;
    }
    offset = next;
  }

  return { version: 1, sharedPalette, sprites };
}

/* ------------------------------------------------------------------ SFF v2 -- */

function parseSffV2(buf, report) {
  const spriteOffset = buf.readUInt32LE(36);
  const numSprites = buf.readUInt32LE(40);
  const paletteOffset = buf.readUInt32LE(44);
  const numPalettes = buf.readUInt32LE(48);
  const ldataOffset = buf.readUInt32LE(52);
  const ldataLength = buf.readUInt32LE(56);
  const tdataOffset = buf.readUInt32LE(60);

  // Palettes first — sprites index into this table.
  const palettes = [];
  const palCount = Math.min(numPalettes, LIMITS.maxSprites);
  for (let n = 0; n < palCount; n++) {
    const p = paletteOffset + n * 16;
    if (p + 16 > buf.length) break;
    const numCols = buf.readUInt16LE(p + 4);
    const linkIndex = buf.readUInt16LE(p + 6);
    const dataOff = buf.readUInt32LE(p + 8);
    const dataLen = buf.readUInt32LE(p + 12);
    let rgb = null;
    if (dataLen > 0) {
      const start = ldataOffset + dataOff;
      if (start + dataLen <= buf.length) {
        // SFF v2 palettes are RGBA quads; the game only uses RGB.
        const quads = buf.subarray(start, start + dataLen);
        rgb = Buffer.alloc(768);
        const n2 = Math.min(256, Math.floor(quads.length / 4));
        for (let c = 0; c < n2; c++) {
          rgb[c * 3] = quads[c * 4];
          rgb[c * 3 + 1] = quads[c * 4 + 1];
          rgb[c * 3 + 2] = quads[c * 4 + 2];
        }
      }
    }
    palettes.push({ index: n, numCols, linkIndex, rgb });
  }
  // Resolve linked palettes after all are read.
  for (const p of palettes) {
    if (!p.rgb && p.linkIndex < palettes.length) p.rgb = palettes[p.linkIndex]?.rgb || null;
  }

  const sprites = [];
  const count = Math.min(numSprites, LIMITS.maxSprites);
  if (numSprites > LIMITS.maxSprites) {
    report.warnings.push(`SFF declares ${numSprites} sprites; stopped at ${LIMITS.maxSprites}`);
  }

  for (let n = 0; n < count; n++) {
    const p = spriteOffset + n * 28;
    if (p + 28 > buf.length) {
      report.warnings.push(`Sprite ${n}: header past the end of the file`);
      break;
    }
    const group = buf.readUInt16LE(p);
    const image = buf.readUInt16LE(p + 2);
    const width = buf.readUInt16LE(p + 4);
    const height = buf.readUInt16LE(p + 6);
    const axisX = buf.readInt16LE(p + 8);
    const axisY = buf.readInt16LE(p + 10);
    const linkIndex = buf.readUInt16LE(p + 12);
    const fmt = buf[p + 14];
    const colorDepth = buf[p + 15];
    const dataOff = buf.readUInt32LE(p + 16);
    const dataLen = buf.readUInt32LE(p + 20);
    const palIndex = buf.readUInt16LE(p + 24);
    const flags = buf.readUInt16LE(p + 26);

    const entry = {
      index: n, group, image, axisX, axisY,
      format: SFF_FORMATS[fmt] || `unknown(${fmt})`,
      colorDepth,
      linked: dataLen === 0, linkIndex, paletteIndex: palIndex,
      width, height, pixels: null, rgba: null,
      palette: palettes[palIndex]?.rgb || null,
      error: null,
    };

    if (dataLen === 0) { sprites.push(entry); continue; }

    try {
      checkSpriteSize(width, height, `sprite ${n} (${group},${image})`);
      const base = (flags & 1) ? tdataOffset : ldataOffset;
      const start = base + dataOff;
      if (start + dataLen > buf.length) {
        throw new ImportError('data runs past the end of the file', 'SFF_CORRUPT');
      }
      const block = buf.subarray(start, start + dataLen);
      const size = width * height;

      if (fmt === 0) {
        entry.pixels = Buffer.from(block.subarray(0, size));
      } else if (fmt === 2 || fmt === 3 || fmt === 4) {
        // Compressed payloads carry a 4-byte uncompressed length first.
        const body = block.subarray(4);
        if (size > LIMITS.maxDecompressedBytes) {
          throw new ImportError('sprite decompresses too large', 'SFF_TOO_BIG');
        }
        entry.pixels = fmt === 2 ? decodeRle8(body, size)
          : fmt === 3 ? decodeRle5(body, size)
            : decodeLz5(body, size);
      } else if (fmt >= 10 && fmt <= 12) {
        // Embedded PNG; also carries the 4-byte length prefix.
        let png = block;
        if (!isPng(png)) png = block.subarray(4);
        if (!isPng(png)) throw new ImportError('PNG payload not found', 'SFF_CORRUPT');
        const decoded = decodePng(png);
        entry.width = decoded.width;
        entry.height = decoded.height;
        entry.rgba = decoded.data;
      } else {
        throw new ImportError(`unsupported sprite format ${fmt}`, 'SFF_UNSUPPORTED');
      }
    } catch (err) {
      entry.error = err.message;
      report.warnings.push(`Sprite ${n} (${group},${image}): ${err.message}`);
    }

    sprites.push(entry);
  }

  return { version: 2, sharedPalette: false, sprites, palettes };
}

/* ------------------------------------------------------------------- entry -- */

/**
 * Parse an .sff.
 *
 * @param {string} root package root
 * @param {string} relPath .sff relative to root
 * @returns {Object} { version, sprites, byKey, errors, warnings, ... }
 */
export function parseSff(root, relPath) {
  const buf = readCapped(root, relPath);
  return parseSffBuffer(buf, relPath);
}

/** Same, from a buffer — this is what the tests drive. */
export function parseSffBuffer(buf, label = '<sff>') {
  const report = { errors: [], warnings: [] };

  if (buf.length < 512) {
    report.errors.push(`${label}: file is too short to be an SFF`);
    return { version: 0, sprites: [], byKey: new Map(), ...report, valid: false };
  }
  const sig = buf.toString('latin1', 0, 12);
  if (sig !== SIGNATURE) {
    report.errors.push(`${label}: bad signature`);
    return { version: 0, sprites: [], byKey: new Map(), ...report, valid: false };
  }

  const verLo = buf[15];
  let parsed;
  try {
    if (verLo === 2) parsed = parseSffV2(buf, report);
    else if (verLo === 1 || verLo === 0) parsed = parseSffV1(buf, report);
    else {
      report.errors.push(`${label}: unsupported SFF version byte ${verLo}`);
      return { version: verLo, sprites: [], byKey: new Map(), ...report, valid: false };
    }
  } catch (err) {
    report.errors.push(`${label}: ${err.message}`);
    return { version: verLo, sprites: [], byKey: new Map(), ...report, valid: false };
  }

  // Resolve linked sprites to the pixels they borrow.
  for (const s of parsed.sprites) {
    if (!s.linked) continue;
    const src = parsed.sprites[s.linkIndex];
    if (src && !src.linked) {
      s.width = src.width;
      s.height = src.height;
      s.pixels = src.pixels;
      s.rgba = src.rgba;
      if (!s.palette) s.palette = src.palette;
      s.resolvedFrom = s.linkIndex;
    } else {
      s.error = s.error || `link to sprite ${s.linkIndex} could not be resolved`;
    }
  }

  const byKey = new Map();
  for (const s of parsed.sprites) {
    const key = `${s.group},${s.image}`;
    if (!byKey.has(key)) byKey.set(key, s);
  }

  const decoded = parsed.sprites.filter((s) => s.pixels || s.rgba).length;
  return {
    ...parsed,
    byKey,
    errors: report.errors,
    warnings: report.warnings,
    spriteCount: parsed.sprites.length,
    decodedCount: decoded,
    failedCount: parsed.sprites.length - decoded,
    valid: report.errors.length === 0,
  };
}

/**
 * Turn one decoded sprite into RGBA.
 *
 * MUGEN palette index 0 is the transparent colour — that convention is what
 * gives a character a cut-out silhouette, so it is applied here rather than
 * left to the exporter.
 */
export function spriteToRgba(sprite) {
  if (sprite.rgba) {
    return { width: sprite.width, height: sprite.height, data: sprite.rgba };
  }
  if (!sprite.pixels) return null;
  const { width, height } = sprite;
  checkSpriteSize(width, height, `sprite ${sprite.group},${sprite.image}`);
  const pal = sprite.palette;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    const idx = sprite.pixels[i];
    if (idx === 0) continue;                       // transparent
    if (pal && idx * 3 + 2 < pal.length) {
      out[p] = pal[idx * 3];
      out[p + 1] = pal[idx * 3 + 1];
      out[p + 2] = pal[idx * 3 + 2];
    } else {
      // No palette: fall back to greyscale so the shape is still inspectable.
      out[p] = out[p + 1] = out[p + 2] = idx;
    }
    out[p + 3] = 255;
  }
  return { width, height, data: out };
}

export default parseSff;
