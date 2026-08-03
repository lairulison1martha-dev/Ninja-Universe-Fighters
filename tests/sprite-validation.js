/**
 * Sprite atlas + animation tests.
 *
 * Three halves (the maths is fine):
 *
 *   ASSET     the atlases are decoded here, in the test, and inspected pixel by
 *             pixel — transparent background, every declared frame actually
 *             drawn, one shared ground line, nothing spilling out of its cell.
 *             A metadata-only check would pass on a broken image.
 *   IDENTITY  no two fighters share artwork. The whole point of generating a
 *             set per fighter is that they differ, so that gets asserted
 *             rather than assumed.
 *   RUNTIME   the animator's playhead and its wiring into the fighter: the
 *             drawn frame at the moment a hitbox goes live must be the frame
 *             the design marked as contact, and effects must fire exactly once.
 *
 * Decoding every one of the 192 atlases would take minutes, so the pixel checks
 * run over a sample: all twenty hand-authored starters plus a deterministic
 * spread of the derived ones.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  suite, test, assert, assertEqual, assertAtLeast, assertEmpty, installBrowserStubs,
} from './helpers.js';

installBrowserStubs();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIGHTER_DIR = path.join(ROOT, 'assets', 'fighters');

const {
  SpriteSheet, SpriteAnimator, spriteRegistry, ANIMATIONS,
  animationForState, animationForAbility,
} = await import('../js/combat/sprite-animator.js');
const { STATE } = await import('../js/combat/fighter-state.js');
const { SIM_DT } = await import('../js/constants.js');
const { getAbility, ABILITIES } = await import('../js/data/abilities.js');
const { FIGHTER_ORDER } = await import('../js/data/fighters.js');
const { Fighter } = await import('../js/combat/fighter.js');

const manifest = JSON.parse(fs.readFileSync(path.join(FIGHTER_DIR, 'manifest.json'), 'utf8'));

const readMeta = (id) =>
  JSON.parse(fs.readFileSync(path.join(FIGHTER_DIR, id, 'fighter.json'), 'utf8'));

/** Hand-authored starters plus every 9th derived set. */
const SAMPLE = [
  ...manifest.precached,
  ...manifest.fighters.filter((id, i) => !manifest.precached.includes(id) && i % 9 === 0),
];

/* -------------------------------------------------------------------------- */
/* A very small PNG decoder — enough for our own 8-bit RGBA output             */
/* -------------------------------------------------------------------------- */

function decodePng(file) {
  const data = fs.readFileSync(file);
  assert(data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    `${file} is not a PNG`);

  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (pos < data.length) {
    const len = data.readUInt32BE(pos);
    const tag = data.toString('ascii', pos + 4, pos + 8);
    const body = data.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (tag === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
    } else if (tag === 'IDAT') {
      idat.push(body);
    } else if (tag === 'IEND') {
      break;
    }
  }
  assertEqual(bitDepth, 8, `${file}: expected 8-bit samples`);
  assertEqual(colorType, 6, `${file}: expected RGBA — an atlas must carry real alpha`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(height * stride);
  let p = 0;
  const paeth = (a, b, c) => {
    const q = a + b - c;
    const pa = Math.abs(q - a);
    const pb = Math.abs(q - b);
    const pc = Math.abs(q - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const out = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? out[i - 4] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= 4 ? prev[i - 4] : 0;
      switch (filter) {
        case 0: out[i] = row[i]; break;
        case 1: out[i] = (row[i] + a) & 0xff; break;
        case 2: out[i] = (row[i] + b) & 0xff; break;
        case 3: out[i] = (row[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: out[i] = (row[i] + paeth(a, b, c)) & 0xff; break;
        default: throw new Error(`${file}: unknown scanline filter ${filter}`);
      }
    }
  }
  return {
    width,
    height,
    px,
    alpha: (x, y) => px[(y * width + x) * 4 + 3],
  };
}

const atlasCache = new Map();
function atlasOf(id) {
  if (!atlasCache.has(id)) {
    atlasCache.set(id, decodePng(path.join(FIGHTER_DIR, id, 'sprite-sheet.png')));
  }
  return atlasCache.get(id);
}

/** Bounding box + pixel count of the opaque pixels in one atlas cell. */
function cellBounds(atlas, meta, anim, index) {
  const { frameWidth: fw, frameHeight: fh } = meta;
  const ox = index * fw;
  const oy = anim.row * fh;
  let x0 = fw;
  let y0 = fh;
  let x1 = -1;
  let y1 = -1;
  let count = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (atlas.alpha(ox + x, oy + y) <= 60) continue;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, count };
}

/* -------------------------------------------------------------------------- */

export function run() {
  suite('sprite-validation');

  /* ----------------------------------------------------------- coverage -- */

  test('every roster fighter has their own sprite set', () => {
    const missing = FIGHTER_ORDER.filter((id) => !manifest.fighters.includes(id));
    assertEmpty(missing, 'Roster fighters with no sprite set');
    assertEqual(manifest.fighters.length, FIGHTER_ORDER.length,
      'The manifest should list exactly the roster');
  });

  test('every sprite set ships all three required files', () => {
    const missing = [];
    for (const id of manifest.fighters) {
      for (const f of ['sprite-sheet.png', 'fighter.json', 'portrait.png']) {
        if (!fs.existsSync(path.join(FIGHTER_DIR, id, f))) missing.push(`${id}/${f}`);
      }
    }
    assertEmpty(missing, 'Incomplete sprite sets');
  });

  test('every set declares every animation the engine can ask for', () => {
    const problems = [];
    for (const id of manifest.fighters) {
      const meta = readMeta(id);
      for (const name of ANIMATIONS) {
        if (!meta.animations[name]) problems.push(`${id}: no "${name}"`);
      }
    }
    assertEmpty(problems, 'Animations the engine needs but a set does not have');
  });

  test('metadata is consistent across every set', () => {
    const problems = [];
    for (const id of manifest.fighters) {
      const meta = readMeta(id);
      if (meta.frameWidth !== 64 || meta.frameHeight !== 64) {
        problems.push(`${id}: frames are ${meta.frameWidth}x${meta.frameHeight}, expected 64x64`);
      }
      if (!meta.anchor || meta.anchor.x <= 0 || meta.anchor.y <= 0
        || meta.anchor.x >= meta.frameWidth || meta.anchor.y > meta.frameHeight) {
        problems.push(`${id}: anchor out of frame`);
      }
      if (!(meta.bodyHeight > 16 && meta.bodyHeight <= meta.anchor.y)) {
        problems.push(`${id}: implausible bodyHeight ${meta.bodyHeight}`);
      }
      if (meta.pixelArt !== true) problems.push(`${id}: not flagged as pixel art`);
      if (meta.source?.kind !== 'generated') problems.push(`${id}: provenance not declared`);
      const rows = new Set();
      for (const [name, a] of Object.entries(meta.animations)) {
        if (rows.has(a.row)) problems.push(`${id}: row ${a.row} used twice`);
        rows.add(a.row);
        if (a.frames < 1) problems.push(`${id}/${name}: no frames`);
        if (a.fps < 1) problems.push(`${id}/${name}: fps ${a.fps}`);
        if (a.hitFrame !== undefined) {
          if (!Number.isInteger(a.hitFrame) || a.hitFrame < 0 || a.hitFrame >= a.frames) {
            problems.push(`${id}/${name}: hitFrame ${a.hitFrame} of ${a.frames}`);
          }
          if (!a.event) problems.push(`${id}/${name}: hitFrame with no event`);
        }
      }
    }
    assertEmpty(problems, 'Sprite metadata problems');
  });

  /* ------------------------------------------------------------- pixels -- */

  test('atlases are exactly the grid their metadata describes', () => {
    const problems = [];
    for (const id of SAMPLE) {
      const meta = readMeta(id);
      const atlas = atlasOf(id);
      const rows = Object.values(meta.animations);
      const maxFrames = Math.max(...rows.map((a) => a.frames));
      const maxRow = Math.max(...rows.map((a) => a.row));
      if (atlas.width !== maxFrames * meta.frameWidth) {
        problems.push(`${id}: width ${atlas.width}, expected ${maxFrames * meta.frameWidth}`);
      }
      if (atlas.height !== (maxRow + 1) * meta.frameHeight) {
        problems.push(`${id}: height ${atlas.height}, expected ${(maxRow + 1) * meta.frameHeight}`);
      }
    }
    assertEmpty(problems, 'Atlas dimensions disagree with the metadata');
  });

  test('backgrounds are genuinely transparent', () => {
    const problems = [];
    for (const id of SAMPLE) {
      const meta = readMeta(id);
      const atlas = atlasOf(id);
      for (const [name, a] of Object.entries(meta.animations)) {
        const oy = a.row * meta.frameHeight;
        for (let i = 0; i < a.frames; i++) {
          const ox = i * meta.frameWidth;
          for (const [cx, cy] of [[0, 0], [meta.frameWidth - 1, 0], [0, meta.frameHeight - 1]]) {
            if (atlas.alpha(ox + cx, oy + cy) !== 0) {
              problems.push(`${id}/${name}[${i}] corner (${cx},${cy}) is opaque`);
            }
          }
        }
      }
    }
    assertEmpty(problems, 'Opaque background pixels found');
  });

  test('every declared frame actually contains a character', () => {
    const problems = [];
    for (const id of SAMPLE) {
      const meta = readMeta(id);
      const atlas = atlasOf(id);
      for (const [name, a] of Object.entries(meta.animations)) {
        for (let i = 0; i < a.frames; i++) {
          const b = cellBounds(atlas, meta, a, i);
          if (!b) problems.push(`${id}/${name}[${i}] is empty`);
          else if (b.count < 150) problems.push(`${id}/${name}[${i}] holds only ${b.count} pixels`);
        }
      }
    }
    assertEmpty(problems, 'Empty or near-empty frames');
  });

  test('unused cells past the declared frame count are empty', () => {
    const problems = [];
    for (const id of SAMPLE) {
      const meta = readMeta(id);
      const atlas = atlasOf(id);
      const perRow = Math.floor(atlas.width / meta.frameWidth);
      for (const [name, a] of Object.entries(meta.animations)) {
        for (let i = a.frames; i < perRow; i++) {
          if (cellBounds(atlas, meta, a, i)) {
            problems.push(`${id}/${name}: cell ${i} has art but frames is ${a.frames}`);
          }
        }
      }
    }
    assertEmpty(problems, 'Artwork outside the declared frames');
  });

  test('every frame stands on the same ground line', () => {
    // The alignment check that matters in combat: something must be on the
    // anchor row in every frame, or the fighter bobs as the animation changes.
    const problems = [];
    for (const id of SAMPLE) {
      const meta = readMeta(id);
      const atlas = atlasOf(id);
      const anchorY = meta.anchor.y;
      for (const [name, a] of Object.entries(meta.animations)) {
        for (let i = 0; i < a.frames; i++) {
          let solid = false;
          for (let y = anchorY - 3; y <= anchorY && !solid; y++) {
            for (let x = 0; x < meta.frameWidth; x++) {
              if (atlas.alpha(i * meta.frameWidth + x, a.row * meta.frameHeight + y) > 60) {
                solid = true;
                break;
              }
            }
          }
          if (!solid) problems.push(`${id}/${name}[${i}] is off the ground line`);
        }
      }
    }
    assertEmpty(problems, 'Frames off the ground anchor');
  });

  test('nothing is drawn below the ground anchor', () => {
    const problems = [];
    for (const id of SAMPLE) {
      const meta = readMeta(id);
      const atlas = atlasOf(id);
      for (const [name, a] of Object.entries(meta.animations)) {
        for (let i = 0; i < a.frames; i++) {
          for (let y = meta.anchor.y + 2; y < meta.frameHeight; y++) {
            for (let x = 0; x < meta.frameWidth; x++) {
              if (atlas.alpha(i * meta.frameWidth + x, a.row * meta.frameHeight + y) > 60) {
                problems.push(`${id}/${name}[${i}] draws below the anchor at y=${y}`);
                y = meta.frameHeight;
                break;
              }
            }
          }
        }
      }
    }
    assertEmpty(problems, 'Art below the ground line — fighters would sink into the stage');
  });

  /* ----------------------------------------------------------- identity -- */

  test('no two fighters share the same artwork', () => {
    // "No recolors, no shared body" is the requirement these sets exist to
    // meet, so a duplicate atlas is a hard failure rather than a warning.
    const seen = new Map();
    const clashes = [];
    for (const id of manifest.fighters) {
      const bytes = fs.readFileSync(path.join(FIGHTER_DIR, id, 'sprite-sheet.png'));
      const key = `${bytes.length}:${bytes.subarray(0, 4096).toString('base64')}`;
      if (seen.has(key)) clashes.push(`${id} is identical to ${seen.get(key)}`);
      else seen.set(key, id);
    }
    assertEmpty(clashes, 'Fighters sharing one sprite sheet');
  });

  test('sampled fighters differ in silhouette, not only in palette', () => {
    // Compare alpha masks: two fighters recoloured from one body would have
    // the same silhouette. Real per-character art does not.
    const masks = new Map();
    for (const id of SAMPLE.slice(0, 24)) {
      const meta = readMeta(id);
      const atlas = atlasOf(id);
      const idle = meta.animations.idle;
      const bits = [];
      for (let y = 0; y < meta.frameHeight; y++) {
        for (let x = 0; x < meta.frameWidth; x++) {
          bits.push(atlas.alpha(x, idle.row * meta.frameHeight + y) > 60 ? 1 : 0);
        }
      }
      masks.set(id, bits);
    }
    const ids = [...masks.keys()];
    const identical = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = masks.get(ids[i]);
        const b = masks.get(ids[j]);
        let diff = 0;
        for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) diff++;
        if (diff === 0) identical.push(`${ids[i]} and ${ids[j]}`);
      }
    }
    assertEmpty(identical, 'Fighters with an identical idle silhouette');
  });

  /* ------------------------------------------------------------ animator -- */

  const meta = readMeta('naruto');

  test('the animator holds the last frame of a one-shot clip', () => {
    const an = new SpriteAnimator(meta);
    an.play('lightAttack', { force: true });
    for (let i = 0; i < 200; i++) an.update(SIM_DT);
    assert(an.finished, 'A non-looping clip must finish');
    assertEqual(an.index, meta.animations.lightAttack.frames - 1, 'It must hold its last frame');
  });

  test('a looping clip wraps instead of finishing', () => {
    const an = new SpriteAnimator(meta);
    an.play('walk', { force: true });
    for (let i = 0; i < 400; i++) an.update(SIM_DT);
    assert(!an.finished, 'A looping clip must never report finished');
    assert(an.index < meta.animations.walk.frames, 'Frame index stays in range');
  });

  test('re-requesting the animation already playing does not restart it', () => {
    const an = new SpriteAnimator(meta);
    an.play('walk', { force: true });
    for (let i = 0; i < 4; i++) { an.update(SIM_DT); an.play('walk'); }
    assert(an.elapsed > 0, 'The playhead must keep running across repeated play() calls');
  });

  test('retiming lands the contact frame exactly on the ability start-up', () => {
    const clip = meta.animations.heavyAttack;
    const an = new SpriteAnimator(meta);
    an.play('heavyAttack', { force: true, startup: 0.18, total: 0.62 });
    let t = 0;
    while (t < 0.18 - 1e-9) { an.update(SIM_DT); t += SIM_DT; }
    assertEqual(an.index, clip.hitFrame,
      'At the ability start-up the drawn frame must be the authored contact frame');
    assertEqual(Math.round(an.duration * 1000), 620, 'The clip must span the ability');
  });

  test('an animation event fires once per playthrough', () => {
    const an = new SpriteAnimator(meta);
    let fired = 0;
    let kind = null;
    an.onEvent = (name) => { fired++; kind = name; };
    an.play('jutsu1', { force: true, startup: 0.2, total: 0.7 });
    for (let i = 0; i < 200; i++) an.update(SIM_DT);
    assertEqual(fired, 1, 'Exactly one event per one-shot clip');
    assertEqual(kind, 'cast', 'jutsu clips emit a cast event');
  });

  test('every fighter state maps to an animation every set provides', () => {
    const missing = [];
    for (const state of Object.values(STATE)) {
      for (const air of [false, true]) {
        const name = animationForState(state, air);
        if (!meta.animations[name]) missing.push(`${state} (airborne=${air}) -> ${name}`);
      }
    }
    assertEmpty(missing, 'States with no animation');
  });

  test('every ability maps to an animation every set provides', () => {
    const missing = new Set();
    for (const ability of Object.values(ABILITIES)) {
      for (const slot of [-1, 0, 1, 2]) {
        const name = animationForAbility(ability, slot);
        if (!meta.animations[name]) missing.add(`${ability.category} -> ${name}`);
      }
    }
    assertEmpty([...missing], 'Ability categories with no animation');
  });

  test('the three jutsu slots and the ultimate use different clips', () => {
    // Slot-specific casts are the reason jutsu1/2/3 exist as separate rows.
    const jutsu = getAbility('naruto_rasengan') || Object.values(ABILITIES)[0];
    const names = [0, 1, 2].map((slot) => animationForAbility(
      { ...jutsu, category: 'ranged-jutsu' }, slot));
    assertEqual(new Set(names).size, 3, `Expected three distinct clips, got ${names.join()}`);
    assertEqual(animationForAbility({ category: 'ultimate' }, -1), 'ultimate',
      'Ultimates have their own animation row');
    assertEqual(animationForState(STATE.TRANSFORM, false), 'transformation',
      'Transforming has its own animation row');
  });

  /* ------------------------------------------------- fighter integration -- */

  test('a fighter drives its animator from the combat state machine', () => {
    const f = makeFighter();
    const ctx = stubCtx();
    f.setState(STATE.IDLE);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'idle', 'An idle fighter plays the idle clip');

    f.walk(1, false);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'walk', 'Walking plays the walk clip');

    f.walk(1, true);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'run', 'Running plays the run clip');

    f.walk(0);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'idle', 'Releasing the stick returns to idle');

    f.setState(STATE.HITSTUN, 0.3);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'hurt', 'Being hit plays the hurt clip');

    f.setState(STATE.KNOCKDOWN, 0.5);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'knockdown', 'A knockdown plays the knockdown clip');

    f.setState(STATE.TRANSFORM, 0.7);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'transformation', 'Transforming plays the transformation clip');
  });

  test('a fighter returns to idle when a one-shot clip is over', () => {
    const f = makeFighter();
    const ctx = stubCtx();
    f.setState(STATE.IDLE);
    const ability = f.abilities.slots.find(Boolean) || getAbility(f.data.basicCombos[0]);
    f.chakra = 200;
    assert(f.use(ability), 'The ability should start');
    for (let i = 0; i < Math.ceil(ability.totalTime / SIM_DT) + 4; i++) f.step(SIM_DT, ctx);
    assertEqual(f.state, STATE.IDLE, 'The fighter returns to idle');
    assertEqual(f.anim.name, 'idle', 'And so does the animation');
  });

  test('a jump switches to the falling clip at the apex', () => {
    const f = makeFighter();
    const ctx = stubCtx();
    f.setState(STATE.IDLE);
    f.jump();
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'jump', 'Rising plays the jump clip');
    let sawFall = false;
    for (let i = 0; i < 120 && !sawFall; i++) {
      f.step(SIM_DT, ctx);
      if (f.anim.name === 'fall') sawFall = true;
    }
    assert(sawFall, 'The fighter must switch to the fall clip on the way down');
  });

  test('the hitbox goes live on the animation frame the design marked', () => {
    const f = makeFighter();
    const ctx = stubCtx();
    const problems = [];
    for (const id of [f.data.basicCombos[0], f.data.heavy, f.data.launcher]) {
      const ability = getAbility(id);
      if (!ability) continue;
      f.setState(STATE.IDLE);
      f.act = null;
      f.chakra = 200;
      f.cooldowns.clear();
      if (!f.use(ability)) { problems.push(`${id}: could not start`); continue; }
      const clip = meta.animations[f.act.animName];
      let frameAtContact = -1;
      for (let i = 0; i < 400; i++) {
        f.step(SIM_DT, ctx);
        if (f.isActiveFrame) { frameAtContact = f.anim.index; break; }
        if (!f.act) break;
      }
      if (frameAtContact < 0) problems.push(`${id}: never became active`);
      else if (clip.hitFrame !== undefined && frameAtContact !== clip.hitFrame) {
        problems.push(`${id}: hitbox live on frame ${frameAtContact}, contact frame is ${clip.hitFrame}`);
      }
    }
    assertEmpty(problems, 'Hitboxes out of sync with the animation');
  });

  test('jutsu effects are emitted exactly once, on the contact frame', () => {
    const f = makeFighter();
    const emits = [];
    const ctx = stubCtx(emits);
    const ability = f.abilities.slots.find((a) => a && a.effectId && a.category !== 'basic');
    assert(ability, 'The test fighter needs a jutsu with an effect');
    f.setState(STATE.IDLE);
    f.chakra = 200;
    assert(f.use(ability), 'The jutsu should start');
    assert(f.act.animEvent, 'This clip should be driving its own effects');
    const clip = meta.animations[f.act.animName];
    let frameAtEmit = -1;
    for (let i = 0; i < 400 && f.act; i++) {
      const before = emits.length;
      f.step(SIM_DT, ctx);
      if (emits.length > before && frameAtEmit < 0) frameAtEmit = f.anim.index;
    }
    assertEqual(emits.length, 1, 'One emission per use, no double fire');
    assertEqual(frameAtEmit, clip.hitFrame, 'The effect must appear on the contact frame');
  });

  test('a fighter with no sprite set still runs (procedural fallback)', () => {
    // Sets are fetched per match; one that fails must not take combat with it.
    spriteRegistry.clear();
    const f = makeFighter();
    const ctx = stubCtx();
    assert(f.sheet === null, 'No sheet should be registered');
    assert(!f.anim.available, 'The animator reports itself unavailable');
    for (let i = 0; i < 60; i++) f.step(SIM_DT, ctx);
    assert(f.time > 0, 'The fighter still simulates without sprites');
    registerSheets();
  });

  test('a fighter picks up their own set, never another fighter\'s', () => {
    registerSheets();
    const a = new Fighter('naruto', { side: 1 });
    const b = new Fighter('sasuke', { side: -1 });
    assert(a.sheet && b.sheet, 'Both should resolve a sheet');
    assert(a.sheet !== b.sheet, 'Two fighters must not share a sheet object');
    assertEqual(a.sheet.meta.id, 'naruto', 'Naruto uses the naruto set');
    assertEqual(b.sheet.meta.id, 'sasuke', 'Sasuke uses the sasuke set');
    const c = new Fighter(FIGHTER_ORDER.find((id) => id !== 'naruto' && id !== 'sasuke'), {});
    assert(c.sheet === null, 'An unregistered fighter falls back rather than borrowing art');
  });
}

/* -------------------------------------------------------------------------- */
/* fixtures                                                                   */
/* -------------------------------------------------------------------------- */

function registerSheets() {
  // Metadata-only sheets: no image, which is all the animator needs.
  spriteRegistry.clear();
  for (const id of ['naruto', 'sasuke']) {
    spriteRegistry.add(id, new SpriteSheet(readMeta(id), null));
  }
}
registerSheets();

function makeFighter(id = 'naruto') {
  const f = new Fighter(id, { side: 1, isPlayer: true });
  f.setState(STATE.IDLE);
  return f;
}

function stubCtx(emits = []) {
  return {
    effects: { emit: (id, x, y, o) => emits.push({ id, x, y, o }), number() {} },
    playSound() {},
    fireProjectile() {},
    camera: { shake() {} },
  };
}
