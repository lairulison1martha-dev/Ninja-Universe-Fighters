/**
 * Sprite atlas + animation tests.
 *
 * Two halves:
 *
 *   ASSET   the atlas is decoded here, in the test, and inspected pixel by
 *           pixel — transparent background, every declared frame actually
 *           drawn, one shared ground line, nothing spilling out of its cell.
 *           A metadata-only check would pass on a broken image.
 *   RUNTIME the animator's playhead, and its wiring into the fighter: the
 *           drawn frame at the moment a hitbox goes live must be the frame the
 *           artist marked as contact, and effects must fire exactly once.
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
const SET_DIR = path.join(ROOT, 'assets', 'fighters', 'base-ninja');

const {
  SpriteSheet, SpriteAnimator, spriteRegistry, ANIMATIONS,
  animationForState, animationForAbility,
} = await import('../js/combat/sprite-animator.js');
const { STATE } = await import('../js/combat/fighter-state.js');
const { SIM_DT } = await import('../js/constants.js');
const { getAbility } = await import('../js/data/abilities.js');

const meta = JSON.parse(fs.readFileSync(path.join(SET_DIR, 'fighter.json'), 'utf8'));

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
  assertEqual(colorType, 6, `${file}: expected RGBA (colour type 6) — the atlas must carry real alpha`);

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
    alpha: (x, y) => px[(y * width + x) * 4 + 3],
  };
}

const atlas = decodePng(path.join(SET_DIR, 'sprite-sheet.png'));

/** Bounding box of the opaque pixels in one atlas cell, or null. */
function cellBounds(anim, index) {
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

  /* ------------------------------------------------------------- assets -- */

  test('the sprite set ships all three required files', () => {
    for (const f of ['sprite-sheet.png', 'fighter.json', 'portrait.png']) {
      assert(fs.existsSync(path.join(SET_DIR, f)), `assets/fighters/base-ninja/${f} is missing`);
    }
  });

  test('every animation state the combat code can ask for exists in the atlas', () => {
    const missing = ANIMATIONS.filter((n) => !meta.animations[n]);
    assertEmpty(missing, 'Animations declared by the engine but absent from fighter.json');
  });

  test('frame cells are a uniform 64x64 and the atlas is exactly that grid', () => {
    assertEqual(meta.frameWidth, 64, 'frameWidth');
    assertEqual(meta.frameHeight, 64, 'frameHeight');
    const rows = Object.values(meta.animations);
    const maxFrames = Math.max(...rows.map((a) => a.frames));
    const maxRow = Math.max(...rows.map((a) => a.row));
    assertEqual(atlas.width, maxFrames * meta.frameWidth, 'Atlas width must be the widest row');
    assertEqual(atlas.height, (maxRow + 1) * meta.frameHeight, 'Atlas height must cover every row');
  });

  test('each animation occupies its own row, in range, with at least one frame', () => {
    const problems = [];
    const rows = new Set();
    for (const [name, a] of Object.entries(meta.animations)) {
      if (rows.has(a.row)) problems.push(`${name}: row ${a.row} is used twice`);
      rows.add(a.row);
      if (a.frames < 1) problems.push(`${name}: no frames`);
      if (a.fps < 1) problems.push(`${name}: fps ${a.fps}`);
      if ((a.row + 1) * meta.frameHeight > atlas.height) problems.push(`${name}: row past the atlas`);
      if (a.frames * meta.frameWidth > atlas.width) problems.push(`${name}: more frames than the atlas holds`);
    }
    assertEmpty(problems, 'Atlas layout problems');
  });

  test('the keyed-out background is genuinely transparent', () => {
    // Cell corners are background in every pose. If the key failed, or the PNG
    // were written opaque, these would be solid.
    const problems = [];
    for (const [name, a] of Object.entries(meta.animations)) {
      const oy = a.row * meta.frameHeight;
      for (let i = 0; i < a.frames; i++) {
        const ox = i * meta.frameWidth;
        for (const [cx, cy] of [[0, 0], [meta.frameWidth - 1, 0], [0, meta.frameHeight - 1]]) {
          const av = atlas.alpha(ox + cx, oy + cy);
          if (av !== 0) problems.push(`${name}[${i}] corner (${cx},${cy}) alpha ${av}`);
        }
      }
    }
    assertEmpty(problems, 'Opaque background pixels found');
  });

  test('every declared frame actually contains a character', () => {
    // The source mockup printed frame counts that did not match its artwork,
    // so an empty cell is a real risk: the fighter would blink out mid-move.
    const problems = [];
    for (const [name, a] of Object.entries(meta.animations)) {
      for (let i = 0; i < a.frames; i++) {
        const b = cellBounds(a, i);
        if (!b) problems.push(`${name}[${i}] is empty`);
        else if (b.count < 120) problems.push(`${name}[${i}] holds only ${b.count} pixels`);
      }
    }
    assertEmpty(problems, 'Empty or near-empty frames');
  });

  test('unused cells past the declared frame count are empty', () => {
    const perRow = Math.floor(atlas.width / meta.frameWidth);
    const problems = [];
    for (const [name, a] of Object.entries(meta.animations)) {
      for (let i = a.frames; i < perRow; i++) {
        if (cellBounds(a, i)) problems.push(`${name}: cell ${i} has content but frames is ${a.frames}`);
      }
    }
    assertEmpty(problems, 'Stray artwork outside the declared frames');
  });

  test('every frame stands on the same ground line', () => {
    // This is the alignment check that matters in combat: the anchor row must
    // carry the character's feet in every frame of every animation, or the
    // fighter bobs up and down as the animation changes.
    const anchorY = meta.anchor.y;
    const problems = [];
    for (const [name, a] of Object.entries(meta.animations)) {
      for (let i = 0; i < a.frames; i++) {
        let solid = false;
        for (let y = anchorY - 2; y <= anchorY && !solid; y++) {
          for (let x = 0; x < meta.frameWidth; x++) {
            if (atlas.alpha(i * meta.frameWidth + x, a.row * meta.frameHeight + y) > 60) {
              solid = true;
              break;
            }
          }
        }
        if (!solid) problems.push(`${name}[${i}] has nothing on the ground line (y=${anchorY})`);
      }
    }
    assertEmpty(problems, 'Frames off the ground anchor');
  });

  test('the anchor and body height are inside the frame', () => {
    assert(meta.anchor.x > 0 && meta.anchor.x < meta.frameWidth, 'anchor.x out of frame');
    assert(meta.anchor.y > 0 && meta.anchor.y <= meta.frameHeight, 'anchor.y out of frame');
    assertAtLeast(meta.bodyHeight, 16, 'bodyHeight is implausibly small');
    assert(meta.bodyHeight <= meta.anchor.y, 'bodyHeight must fit above the ground line');
  });

  test('fighter.json reports the frames that were really extracted', () => {
    // The source is a mockup whose printed counts are decorative. The metadata
    // must record what the extractor found, not what the picture claimed.
    assert(meta.source && meta.source.kind === 'reference-mockup',
      'The temporary set must declare its provenance');
    const mismatches = [];
    for (const [name, a] of Object.entries(meta.animations)) {
      const got = meta.source.extractedFrames?.[name];
      if (got !== a.frames) mismatches.push(`${name}: animation says ${a.frames}, report says ${got}`);
    }
    assertEmpty(mismatches, 'fighter.json contradicts its own extraction report');
  });

  test('animations with an event point at a frame that exists', () => {
    const problems = [];
    for (const [name, a] of Object.entries(meta.animations)) {
      if (a.hitFrame === undefined) continue;
      if (!Number.isInteger(a.hitFrame)) problems.push(`${name}: hitFrame is not an integer`);
      else if (a.hitFrame < 0 || a.hitFrame >= a.frames) problems.push(`${name}: hitFrame ${a.hitFrame} of ${a.frames} frames`);
      if (!a.event) problems.push(`${name}: hitFrame without an event name`);
    }
    assertEmpty(problems, 'Bad animation events');
  });

  /* ------------------------------------------------------------ animator -- */

  test('the animator holds the last frame of a one-shot clip', () => {
    const an = new SpriteAnimator(meta);
    an.play('lightAttack', { force: true });
    for (let i = 0; i < 200; i++) an.update(SIM_DT);
    assert(an.finished, 'A non-looping clip must finish');
    assertEqual(an.index, meta.animations.lightAttack.frames - 1, 'It must hold on its last frame');
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
    let indexAtStartup = -1;
    while (t < 0.18 - 1e-9) {
      an.update(SIM_DT);
      t += SIM_DT;
    }
    indexAtStartup = an.index;
    assertEqual(indexAtStartup, clip.hitFrame,
      'At the ability start-up the drawn frame must be the authored contact frame');
    assertEqual(Math.round(an.duration * 1000), 620, 'The clip must span the ability, not its own fps');
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

  test('every fighter state maps to an animation the atlas provides', () => {
    const missing = [];
    for (const state of Object.values(STATE)) {
      for (const air of [false, true]) {
        const name = animationForState(state, air);
        if (!meta.animations[name]) missing.push(`${state} (airborne=${air}) -> ${name}`);
      }
    }
    assertEmpty(missing, 'States with no animation');
  });

  test('every ability category maps to an animation the atlas provides', () => {
    const { ABILITIES } = ABILITY_MODULE;
    const missing = [];
    for (const ability of Object.values(ABILITIES)) {
      for (const slot of [-1, 0, 1, 2]) {
        const name = animationForAbility(ability, slot);
        if (!meta.animations[name]) missing.push(`${ability.id} (${ability.category}) -> ${name}`);
      }
    }
    assertEmpty(missing, 'Abilities with no animation');
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

    f.setState(STATE.HITSTUN, 0.3);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'hurt', 'Being hit plays the hurt clip');

    f.setState(STATE.KNOCKDOWN, 0.5);
    f.step(SIM_DT, ctx);
    assertEqual(f.anim.name, 'knockdown', 'A knockdown plays the knockdown clip');
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

  test('the hitbox goes live on the animation frame the artist marked', () => {
    // Requirement: attack hitboxes are connected to the correct animation
    // frames. The animator retimes the clip onto the ability, so this must
    // hold for every basic and heavy attack in the game, not just one.
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
        problems.push(`${id}: hitbox live on frame ${frameAtContact}, clip contact frame is ${clip.hitFrame}`);
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
    assertEqual(frameAtEmit, clip.hitFrame, 'The effect must appear on the clip\'s contact frame');
  });

  test('a fighter with no sprite set still runs (procedural fallback)', () => {
    // Assets can fail to fetch offline on a first run; combat must not care.
    spriteRegistry.clear();
    const f = makeFighter();
    const ctx = stubCtx();
    assert(f.sheet === null, 'No sheet should be registered');
    assert(!f.anim.available, 'The animator reports itself unavailable');
    for (let i = 0; i < 60; i++) f.step(SIM_DT, ctx);
    assert(f.time > 0, 'The fighter still simulates without sprites');
    registerSheet();
  });
}

/* -------------------------------------------------------------------------- */
/* fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const ABILITY_MODULE = await import('../js/data/abilities.js');
const { Fighter } = await import('../js/combat/fighter.js');

function registerSheet() {
  // Metadata-only sheet: no image, which is all the animator needs.
  spriteRegistry.clear();
  spriteRegistry.add('base-ninja', new SpriteSheet(meta, null));
}
registerSheet();

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
