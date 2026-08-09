/**
 * Minimal PNG read/write, on node:zlib only.
 *
 * Reading exists because SFF v2 can store sprites as PNG8/24/32 rather than
 * one of its own compressed formats. Writing exists because the staging
 * exporter has to emit a sprite sheet and a portrait.
 *
 * Scope is deliberately narrow: 8-bit channels, non-interlaced, colour types
 * 0/2/3/4/6. Anything else is refused with a clear message rather than
 * decoded incorrectly — a silently wrong sprite is worse than a skipped one.
 */

import zlib from 'node:zlib';
import { LIMITS, checkSpriteSize, ImportError } from './limits.mjs';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** True when this buffer starts with the PNG signature. */
export function isPng(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 8 && buf.subarray(0, 8).equals(SIG);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decode a PNG into RGBA.
 * @returns {{ width: number, height: number, data: Buffer }} data is RGBA8
 */
export function decodePng(buf) {
  if (!isPng(buf)) throw new ImportError('Not a PNG', 'PNG_BAD_SIGNATURE');

  let pos = 8;
  let ihdr = null;
  let palette = null;
  let trns = null;
  const idat = [];

  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const dataStart = pos + 8;
    if (len > LIMITS.maxDecompressedBytes || dataStart + len + 4 > buf.length) {
      throw new ImportError(`Corrupt PNG chunk ${type}`, 'PNG_CORRUPT');
    }
    const data = buf.subarray(dataStart, dataStart + len);

    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
      checkSpriteSize(ihdr.width, ihdr.height, 'PNG');
      if (ihdr.depth !== 8) {
        throw new ImportError(`Unsupported PNG bit depth ${ihdr.depth}`, 'PNG_UNSUPPORTED');
      }
      if (ihdr.interlace !== 0) {
        throw new ImportError('Interlaced PNG is not supported', 'PNG_UNSUPPORTED');
      }
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'tRNS') {
      trns = Buffer.from(data);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    pos = dataStart + len + 4;
  }

  if (!ihdr) throw new ImportError('PNG has no IHDR', 'PNG_CORRUPT');

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.colorType];
  if (!channels) {
    throw new ImportError(`Unsupported PNG colour type ${ihdr.colorType}`, 'PNG_UNSUPPORTED');
  }

  const raw = zlib.inflateSync(Buffer.concat(idat), {
    maxOutputLength: LIMITS.maxDecompressedBytes,
  });
  const { width, height } = ihdr;
  const stride = width * channels;
  const expect = (stride + 1) * height;
  if (raw.length < expect) throw new ImportError('PNG data truncated', 'PNG_CORRUPT');

  // Undo the per-scanline filters.
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    line.copy(cur);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      switch (filter) {
        case 0: break;
        case 1: cur[x] = (cur[x] + a) & 0xff; break;
        case 2: cur[x] = (cur[x] + b) & 0xff; break;
        case 3: cur[x] = (cur[x] + ((a + b) >> 1)) & 0xff; break;
        case 4: cur[x] = (cur[x] + paeth(a, b, c)) & 0xff; break;
        default: throw new ImportError(`Unknown PNG filter ${filter}`, 'PNG_CORRUPT');
      }
    }
    prev = cur;
  }

  // Expand to RGBA.
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    const s = i * channels;
    switch (ihdr.colorType) {
      case 0: rgba[p] = rgba[p + 1] = rgba[p + 2] = out[s]; rgba[p + 3] = 255; break;
      case 2: rgba[p] = out[s]; rgba[p + 1] = out[s + 1]; rgba[p + 2] = out[s + 2]; rgba[p + 3] = 255; break;
      case 3: {
        const idx = out[s];
        if (!palette || idx * 3 + 2 >= palette.length) {
          rgba[p] = rgba[p + 1] = rgba[p + 2] = 0;
        } else {
          rgba[p] = palette[idx * 3];
          rgba[p + 1] = palette[idx * 3 + 1];
          rgba[p + 2] = palette[idx * 3 + 2];
        }
        rgba[p + 3] = trns && idx < trns.length ? trns[idx] : 255;
        break;
      }
      case 4: rgba[p] = rgba[p + 1] = rgba[p + 2] = out[s]; rgba[p + 3] = out[s + 1]; break;
      case 6: rgba[p] = out[s]; rgba[p + 1] = out[s + 1]; rgba[p + 2] = out[s + 2]; rgba[p + 3] = out[s + 3]; break;
      default: break;
    }
  }

  return { width, height, data: rgba };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

/**
 * Encode RGBA8 pixels as a PNG (colour type 6, filter 0).
 * @param {number} width
 * @param {number} height
 * @param {Buffer|Uint8Array} rgba
 */
export function encodePng(width, height, rgba) {
  checkSpriteSize(width, height, 'PNG output');
  if (rgba.length !== width * height * 4) {
    throw new ImportError(
      `PNG output: expected ${width * height * 4} bytes, got ${rgba.length}`, 'PNG_BAD_SIZE',
    );
  }
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer || rgba, rgba.byteOffset || 0, rgba.length)
      .copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;     // bit depth
  ihdr[9] = 6;     // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
