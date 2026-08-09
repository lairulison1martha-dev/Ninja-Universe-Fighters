#!/usr/bin/env node
/**
 * Build an ORIGINAL MUGEN character package, from scratch, for testing.
 *
 *   node tools/mugen-import/make-fixture.mjs <out-dir> [--sff-version 1|2] [--format rle8|lz5|raw|png]
 *
 * Every byte it writes is generated here: the sprites are drawn by this file
 * as coloured rectangles, the .def/.air/.cmd/.cns are written by this file,
 * and the rights document says CC0 because this package is genuinely CC0.
 *
 * That matters for two reasons. It gives the parsers a real, valid package to
 * be tested against without committing anyone else's character to the
 * repository — which the brief forbids and which would be wrong anyway. And
 * it gives the whole pipeline an end-to-end proof that does not depend on
 * finding a legally reusable package on the internet.
 *
 * It is a test fixture. It is not a character, and it is not art.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { encodePng } from './png.mjs';

/* ------------------------------------------------------------ sprite art -- */

/**
 * Draw one indexed-colour sprite: a simple stick figure built from blocks, so
 * different poses are visibly different without being anyone's artwork.
 */
export function drawFigure(w, h, pose) {
  const px = Buffer.alloc(w * h, 0);   // index 0 = transparent
  const rect = (x0, y0, x1, y1, colour) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) px[y * w + x] = colour;
    }
  };
  const cx = Math.floor(w / 2);
  const lean = pose.lean || 0;
  // head (2), body (3), limbs (4)
  rect(cx - 4 + lean, 2, cx + 4 + lean, 10, 2);
  rect(cx - 3 + lean, 10, cx + 3 + lean, h - 10, 3);
  rect(cx - 6 + lean + (pose.armOut || 0), 12, cx - 2 + lean + (pose.armOut || 0), 20, 4);
  rect(cx + 2 + lean + (pose.armOut || 0), 12, cx + 6 + lean + (pose.armOut || 0), 20, 4);
  rect(cx - 3, h - 10, cx - 1, h - 1, 4);
  rect(cx + 1, h - 10, cx + 3, h - 1, 4);
  if (pose.weapon) rect(cx + 6, 13, cx + 6 + pose.weapon, 16, 5);
  return px;
}

/** A five-entry palette. Index 0 is MUGEN's transparent slot. */
export function makePalette() {
  const pal = Buffer.alloc(768, 0);
  const set = (i, r, g, b) => { pal[i * 3] = r; pal[i * 3 + 1] = g; pal[i * 3 + 2] = b; };
  set(0, 0, 0, 0);
  set(1, 20, 20, 30);
  set(2, 240, 200, 160);      // head
  set(3, 60, 140, 220);       // body
  set(4, 40, 90, 160);        // limbs
  set(5, 230, 190, 60);       // held item
  return pal;
}

/* ------------------------------------------------------------------- PCX -- */

/** RLE-encode one scanline the way PCX does. */
function pcxEncodeLine(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    let run = 1;
    while (i + run < line.length && line[i + run] === line[i] && run < 63) run++;
    if (run > 1 || line[i] >= 0xc0) {
      out.push(0xc0 | run, line[i]);
      i += run;
    } else {
      out.push(line[i]);
      i++;
    }
  }
  return out;
}

/** Write an 8-bit PCX with a trailing 256-colour palette. */
export function encodePcx(w, h, pixels, palette) {
  const header = Buffer.alloc(128, 0);
  header[0] = 0x0a;               // manufacturer
  header[1] = 5;                  // version
  header[2] = 1;                  // RLE
  header[3] = 8;                  // bits per pixel
  header.writeUInt16LE(0, 4);     // xMin
  header.writeUInt16LE(0, 6);     // yMin
  header.writeUInt16LE(w - 1, 8);
  header.writeUInt16LE(h - 1, 10);
  header.writeUInt16LE(72, 12);
  header.writeUInt16LE(72, 14);
  header[65] = 1;                 // planes
  header.writeUInt16LE(w % 2 ? w + 1 : w, 66);  // bytesPerLine, even

  const bpl = w % 2 ? w + 1 : w;
  const body = [];
  for (let y = 0; y < h; y++) {
    const line = Buffer.alloc(bpl, 0);
    pixels.copy(line, 0, y * w, (y + 1) * w);
    body.push(...pcxEncodeLine(line));
  }
  return Buffer.concat([
    header, Buffer.from(body), Buffer.from([0x0c]), palette,
  ]);
}

/* ------------------------------------------------------------------- SFF -- */

/** Build an SFF v1: a linked list of headers, each followed by a PCX. */
export function buildSffV1(sprites) {
  const palette = makePalette();
  const header = Buffer.alloc(512, 0);
  header.write('ElecbyteSpr\0', 0, 'latin1');
  header[12] = 0; header[13] = 1; header[14] = 0; header[15] = 1;   // version 1
  header.writeUInt32LE(1, 16);                    // groups
  header.writeUInt32LE(sprites.length, 20);
  header.writeUInt32LE(512, 24);                  // first subheader
  header.writeUInt32LE(32, 28);
  header[32] = 0;                                 // per-sprite palettes

  const chunks = [header];
  let offset = 512;
  sprites.forEach((s, i) => {
    const pcx = encodePcx(s.w, s.h, s.pixels, palette);
    const sub = Buffer.alloc(32, 0);
    const next = i === sprites.length - 1 ? 0 : offset + 32 + pcx.length;
    sub.writeUInt32LE(next, 0);
    sub.writeUInt32LE(pcx.length, 4);
    sub.writeInt16LE(s.axisX, 8);
    sub.writeInt16LE(s.axisY, 10);
    sub.writeUInt16LE(s.group, 12);
    sub.writeUInt16LE(s.image, 14);
    sub.writeUInt16LE(0, 16);
    sub[18] = i === 0 ? 0 : 1;                    // reuse the first palette
    chunks.push(sub, pcx);
    offset += 32 + pcx.length;
  });
  return Buffer.concat(chunks);
}

/** RLE8-encode, matching decodeRle8 in parse-sff.mjs. */
export function encodeRle8(pixels) {
  const out = [];
  let i = 0;
  while (i < pixels.length) {
    let run = 1;
    while (i + run < pixels.length && pixels[i + run] === pixels[i] && run < 63) run++;
    if (run > 1 || (pixels[i] & 0xc0) === 0x40) {
      out.push(0x40 | run, pixels[i]);
      i += run;
    } else {
      out.push(pixels[i]);
      i++;
    }
  }
  return Buffer.from(out);
}

/** Build an SFF v2 with a sprite table, a palette table and two data blobs. */
export function buildSffV2(sprites, format = 'rle8') {
  const palette = makePalette();
  const palQuads = Buffer.alloc(256 * 4, 0);
  for (let c = 0; c < 256; c++) {
    palQuads[c * 4] = palette[c * 3];
    palQuads[c * 4 + 1] = palette[c * 3 + 1];
    palQuads[c * 4 + 2] = palette[c * 3 + 2];
    palQuads[c * 4 + 3] = 255;
  }

  const bodies = sprites.map((s) => {
    if (format === 'raw') return { fmt: 0, data: Buffer.from(s.pixels) };
    if (format === 'png') {
      const rgba = Buffer.alloc(s.w * s.h * 4);
      for (let i = 0; i < s.w * s.h; i++) {
        const idx = s.pixels[i];
        if (!idx) continue;
        rgba[i * 4] = palette[idx * 3];
        rgba[i * 4 + 1] = palette[idx * 3 + 1];
        rgba[i * 4 + 2] = palette[idx * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
      const png = encodePng(s.w, s.h, rgba);
      const len = Buffer.alloc(4);
      len.writeUInt32LE(png.length, 0);
      return { fmt: 12, data: Buffer.concat([len, png]) };
    }
    const body = encodeRle8(s.pixels);
    const len = Buffer.alloc(4);
    len.writeUInt32LE(s.w * s.h, 0);
    return { fmt: 2, data: Buffer.concat([len, body]) };
  });

  const spriteTableOffset = 512;
  const paletteTableOffset = spriteTableOffset + sprites.length * 28;
  const ldataOffset = paletteTableOffset + 16;

  const spriteTable = Buffer.alloc(sprites.length * 28, 0);
  const dataChunks = [palQuads];
  let dataCursor = palQuads.length;

  sprites.forEach((s, i) => {
    const p = i * 28;
    spriteTable.writeUInt16LE(s.group, p);
    spriteTable.writeUInt16LE(s.image, p + 2);
    spriteTable.writeUInt16LE(s.w, p + 4);
    spriteTable.writeUInt16LE(s.h, p + 6);
    spriteTable.writeInt16LE(s.axisX, p + 8);
    spriteTable.writeInt16LE(s.axisY, p + 10);
    spriteTable.writeUInt16LE(0, p + 12);
    spriteTable[p + 14] = bodies[i].fmt;
    spriteTable[p + 15] = 8;
    spriteTable.writeUInt32LE(dataCursor, p + 16);
    spriteTable.writeUInt32LE(bodies[i].data.length, p + 20);
    spriteTable.writeUInt16LE(0, p + 24);
    spriteTable.writeUInt16LE(0, p + 26);
    dataChunks.push(bodies[i].data);
    dataCursor += bodies[i].data.length;
  });

  const palTable = Buffer.alloc(16, 0);
  palTable.writeUInt16LE(0, 0);
  palTable.writeUInt16LE(0, 2);
  palTable.writeUInt16LE(256, 4);
  palTable.writeUInt16LE(0, 6);
  palTable.writeUInt32LE(0, 8);
  palTable.writeUInt32LE(palQuads.length, 12);

  const header = Buffer.alloc(512, 0);
  header.write('ElecbyteSpr\0', 0, 'latin1');
  header[12] = 0; header[13] = 0; header[14] = 0; header[15] = 2;   // version 2
  header.writeUInt32LE(spriteTableOffset, 36);
  header.writeUInt32LE(sprites.length, 40);
  header.writeUInt32LE(paletteTableOffset, 44);
  header.writeUInt32LE(1, 48);
  header.writeUInt32LE(ldataOffset, 52);
  header.writeUInt32LE(dataCursor, 56);
  header.writeUInt32LE(ldataOffset, 60);
  header.writeUInt32LE(0, 64);

  return Buffer.concat([header, spriteTable, palTable, ...dataChunks]);
}

/* -------------------------------------------------------------- text files -- */

const AIR = `; Original test animations. Written by hand for this repository.
[Begin Action 0]
Clsn2Default: 2
 Clsn2[0] = -10, 0, 10, -40
 Clsn2[1] = -6, -40, 6, -56
0, 0, 0, 0, 8
0, 1, 0, 0, 8
0, 2, 0, 0, 8
0, 1, 0, 0, 8

[Begin Action 20]
Clsn2Default: 1
 Clsn2[0] = -9, 0, 9, -54
20, 0, 0, 0, 6
20, 1, 0, 0, 6

[Begin Action 200]
Clsn2Default: 1
 Clsn2[0] = -10, 0, 10, -54
200, 0, 0, 0, 3
Clsn1: 1
 Clsn1[0] = 8, -46, 30, -28
200, 1, 0, 0, 4
200, 2, 0, 0, 6

[Begin Action 230]
Clsn2Default: 1
 Clsn2[0] = -11, 0, 11, -54
230, 0, 0, 0, 6
Clsn1: 2
 Clsn1[0] = 10, -50, 38, -24
 Clsn1[1] = 10, -24, 30, -10
230, 1, 0, 0, 5
230, 2, 0, 0, 10

[Begin Action 1000]
Clsn2Default: 1
 Clsn2[0] = -10, 0, 10, -54
1000, 0, 0, 0, 8
Clsn1: 1
 Clsn1[0] = 12, -44, 44, -20
1000, 1, 0, 0, 6
1000, 2, 0, 0, 12

[Begin Action 5000]
Clsn2Default: 1
 Clsn2[0] = -12, 0, 12, -50
5000, 0, 0, 0, 6
5000, 1, 0, 0, 10
`;

const CMD = `; Original test commands.
[Defaults]
command.time = 15
command.buffer.time = 1

[Command]
name = "QCF_a"
command = ~D, DF, F, a
time = 15

[Command]
name = "a"
command = a
time = 1

[Command]
name = "b"
command = b
time = 1

[State -1, Light]
type = ChangeState
value = 200
triggerall = command = "a"
trigger1 = statetype = S
trigger1 = ctrl

[State -1, Heavy]
type = ChangeState
value = 230
triggerall = command = "b"
trigger1 = statetype = S
trigger1 = ctrl

[State -1, Special]
type = ChangeState
value = 1000
triggerall = command = "QCF_a"
trigger1 = statetype = S
trigger1 = ctrl
`;

const CNS = `; Original test constants and states.
[Data]
life = 1000
power = 3000
attack = 100
defence = 100

[Size]
xscale = 1
yscale = 1
ground.back = 15
ground.front = 16
height = 60

[Velocity]
walk.fwd = 2.4
walk.back = -2.2
run.fwd = 4.6, 0

[Statedef 200]
type = S
movetype = A
physics = S
anim = 200
ctrl = 0

[State 200, 1]
type = HitDef
trigger1 = AnimElem = 2
attr = S, NA
damage = 28, 4
animtype = Light
guardflag = MH
pausetime = 6, 6
ground.velocity = -3.2
ground.hittime = 12
guard.hittime = 9

[Statedef 230]
type = S
movetype = A
physics = S
anim = 230
ctrl = 0

[State 230, 1]
type = HitDef
trigger1 = AnimElem = 2
attr = S, NA
damage = 62, 10
animtype = Hard
guardflag = MH
pausetime = 12, 12
ground.velocity = -7.5
air.velocity = -3, -4
ground.hittime = 18
fall = 1

[Statedef 1000]
type = S
movetype = A
physics = S
anim = 1000
ctrl = 0
poweradd = -300

[State 1000, 1]
type = HitDef
trigger1 = AnimElem = 2
attr = S, SA
damage = 85, 14
animtype = Hard
guardflag = MH
pausetime = 14, 14
ground.velocity = -9
ground.hittime = 20

[Statedef 1100]
type = S
movetype = A
physics = S
anim = 1000
ctrl = 0

[State 1100, 1]
type = Projectile
trigger1 = AnimElem = 2
projanim = 1000
projremovetime = 90
velocity = 6, 0
attr = S, SP
damage = 40, 6
guardflag = MH
pausetime = 4, 4
ground.velocity = -4
`;

/** The rights document. CC0 because this package really is CC0. */
const README = `Ninja Universe Fighters — MUGEN importer test fixture
=====================================================

Creator: generated by tools/mugen-import/make-fixture.mjs in this repository.
Source:  this repository. Nothing here was downloaded from anywhere.

LICENCE
-------
CC0 1.0 Universal (public domain dedication).

To the extent possible under law, the author has waived all copyright and
related rights to this package. You may use, edit, redistribute and reuse it
freely, including in other projects, with no permission needed and no
attribution required.

WHAT THIS IS
------------
An original, synthetic MUGEN character package that exists to exercise the
importer. Every sprite is a coloured block figure drawn programmatically. The
.air, .cmd and .cns files were written by hand for this repository.

It is deliberately NOT a real character and NOT artwork. No sprites, audio or
data from any commercial game, anime, or third-party MUGEN release are present.
No audio of any kind is included.
`;

const RIGHTS_JSON = {
  creator: 'Ninja Universe Fighters repository (tools/mugen-import/make-fixture.mjs)',
  source: 'generated in-repo; not downloaded',
  license: 'CC0-1.0',
  redistributionAllowed: true,
  reuseAllowed: true,
  audioReuseAllowed: false,
  spritesOriginal: true,
  audioPresent: false,
  verifiedBy: 'generated by this repository, so provenance is known with certainty',
  note: 'Synthetic test fixture. Not a real MUGEN character.',
};

/* ------------------------------------------------------------------ build -- */

const SPRITE_PLAN = [
  { group: 0, image: 0, pose: {} },
  { group: 0, image: 1, pose: { lean: 1 } },
  { group: 0, image: 2, pose: { lean: -1 } },
  { group: 20, image: 0, pose: { lean: 2 } },
  { group: 20, image: 1, pose: { lean: -2 } },
  { group: 200, image: 0, pose: {} },
  { group: 200, image: 1, pose: { armOut: 5 } },
  { group: 200, image: 2, pose: { armOut: 2 } },
  { group: 230, image: 0, pose: {} },
  { group: 230, image: 1, pose: { armOut: 8, weapon: 6 } },
  { group: 230, image: 2, pose: { armOut: 3 } },
  { group: 1000, image: 0, pose: {} },
  { group: 1000, image: 1, pose: { armOut: 9, weapon: 10 } },
  { group: 1000, image: 2, pose: { armOut: 4 } },
  { group: 5000, image: 0, pose: { lean: -3 } },
  { group: 5000, image: 1, pose: { lean: -5 } },
];

/**
 * Write the fixture package.
 * @param {string} outDir
 * @param {{ sffVersion?: 1|2, format?: string, name?: string }} opts
 */
export function makeFixture(outDir, { sffVersion = 1, format = 'rle8', name = 'Blockfighter' } = {}) {
  const W = 32;
  const H = 56;
  const sprites = SPRITE_PLAN.map((s) => ({
    group: s.group, image: s.image,
    w: W, h: H,
    axisX: Math.floor(W / 2), axisY: H - 1,     // MUGEN axis: feet, bottom-centre
    pixels: drawFigure(W, H, s.pose),
  }));

  fs.mkdirSync(outDir, { recursive: true });
  const sff = sffVersion === 2 ? buildSffV2(sprites, format) : buildSffV1(sprites);

  fs.writeFileSync(path.join(outDir, 'blockfighter.sff'), sff);
  fs.writeFileSync(path.join(outDir, 'blockfighter.air'), AIR);
  fs.writeFileSync(path.join(outDir, 'blockfighter.cmd'), CMD);
  fs.writeFileSync(path.join(outDir, 'blockfighter.cns'), CNS);
  fs.writeFileSync(path.join(outDir, 'readme.txt'), README);
  fs.writeFileSync(path.join(outDir, 'nuf-rights.json'), `${JSON.stringify(RIGHTS_JSON, null, 1)}\n`);
  fs.writeFileSync(path.join(outDir, 'blockfighter.def'), `; Original test character.
[Info]
name = "${name}"
displayname = "${name}"
versiondate = 1.0
mugenversion = 1.0
author = "Ninja Universe Fighters test fixture"
localcoord = 320, 240

[Files]
sprite = blockfighter.sff
anim = blockfighter.air
cmd = blockfighter.cmd
cns = blockfighter.cns
st = blockfighter.cns
`);

  return {
    dir: outDir,
    sffVersion,
    format,
    sprites: sprites.length,
    files: fs.readdirSync(outDir).sort(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith('--')) || 'imports/mugen/_fixture';
  const vIdx = args.indexOf('--sff-version');
  const fIdx = args.indexOf('--format');
  const r = makeFixture(out, {
    sffVersion: vIdx >= 0 ? Number(args[vIdx + 1]) : 1,
    format: fIdx >= 0 ? args[fIdx + 1] : 'rle8',
  });
  console.log(`Wrote SFF v${r.sffVersion} fixture (${r.sprites} sprites) to ${r.dir}`);
  console.log(r.files.join('\n'));
}

export default makeFixture;
