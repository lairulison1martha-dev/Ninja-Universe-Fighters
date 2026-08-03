/**
 * Sprite animation system.
 *
 * Two small pieces, deliberately separated:
 *
 *   SpriteSheet   owns the decoded image + atlas geometry. Browser only.
 *   SpriteAnimator owns the PLAYHEAD — which frame is showing, when events
 *                  fire, whether the clip has finished. It needs metadata
 *                  only, no image, so it runs inside the fixed-timestep
 *                  simulation and is fully testable headlessly.
 *
 * That split matters: animation events (attack contact, jutsu emission) are
 * gameplay-visible, so they must advance with the simulation and never with
 * the render loop, which can be throttled or paused.
 */

/** Animation names the combat state machine can ask for. */
export const ANIMATIONS = [
  'idle', 'walk', 'run', 'jump', 'fall', 'dash',
  'lightAttack', 'heavyAttack', 'jutsu1', 'jutsu2',
  'hurt', 'knockdown', 'getUp', 'guard', 'victory', 'defeat',
];

/* -------------------------------------------------------------------------- */
/* Sheet                                                                      */
/* -------------------------------------------------------------------------- */

export class SpriteSheet {
  /**
   * @param {Object} meta parsed fighter.json
   * @param {HTMLImageElement|ImageBitmap|null} image
   */
  constructor(meta, image = null) {
    this.meta = meta;
    this.image = image;
    this.frameWidth = meta.frameWidth;
    this.frameHeight = meta.frameHeight;
    this.anchor = meta.anchor || { x: meta.frameWidth / 2, y: meta.frameHeight };
    /**
     * Height of the drawn character in atlas pixels, feet anchor to top of
     * head. The renderer scales by (worldHeight / bodyHeight) so a fighter's
     * on-screen size follows their roster data instead of the cell size.
     */
    this.bodyHeight = meta.bodyHeight || Math.round(meta.frameHeight * 0.8);
    this.animations = meta.animations || {};
    this._tints = new Map();
  }

  has(name) { return !!this.animations[name]; }

  anim(name) { return this.animations[name] || null; }

  /** Source rectangle for one frame. Clamps out-of-range indices. */
  rect(name, index, out = { sx: 0, sy: 0, sw: 0, sh: 0 }) {
    const a = this.animations[name];
    if (!a) return null;
    const i = Math.max(0, Math.min(a.frames - 1, index | 0));
    out.sx = i * this.frameWidth;
    out.sy = a.row * this.frameHeight;
    out.sw = this.frameWidth;
    out.sh = this.frameHeight;
    return out;
  }

  /**
   * A recoloured copy of the sheet.
   *
   * Every fighter currently shares this one temporary sheet, so without this
   * the whole roster would look identical on screen.
   *
   * The source art is very dark — three quarters of its opaque pixels sit
   * below luminance 48 — so a multiply tint just produces mud. Instead the
   * outfit's shading ramp is *remapped* onto the fighter's colour: black stays
   * black (that is the outline), skin and bright highlights are left alone,
   * and everything between is redrawn as a light-to-dark ramp of the target
   * hue. Results are cached per colour.
   */
  tinted(hexColor) {
    if (!this.image || !hexColor) return this.image;
    const cached = this._tints.get(hexColor);
    if (cached) return cached;
    if (typeof document === 'undefined') return this.image;

    const w = this.image.width;
    const h = this.image.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0);

    let data;
    try {
      data = ctx.getImageData(0, 0, w, h);
    } catch {
      return this.image;   // tainted canvas (should not happen, same origin)
    }

    const tr = parseInt(hexColor.slice(1, 3), 16);
    const tg = parseInt(hexColor.slice(3, 5), 16);
    const tb = parseInt(hexColor.slice(5, 7), 16);
    if (!Number.isFinite(tr + tg + tb)) return this.image;

    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const lum = (r * 2 + g * 3 + b) / 6;
      // Leave the outline (near-black), the skin, and bright highlights such
      // as the headband plate and the eyes.
      if (lum < 18 || lum > 150) continue;
      if (r > g + 16 && g > b + 10 && r > 90) continue;
      const shade = 0.40 + 0.95 * Math.min(1, (lum - 18) / 92);
      px[i] = Math.min(255, tr * shade);
      px[i + 1] = Math.min(255, tg * shade);
      px[i + 2] = Math.min(255, tb * shade);
    }
    ctx.putImageData(data, 0, 0);
    // A whole recoloured atlas is ~1.8 MB of canvas memory, so keep only a
    // handful — a match never needs more than the fighters on screen.
    if (this._tints.size >= 6) this._tints.delete(this._tints.keys().next().value);
    this._tints.set(hexColor, canvas);
    return canvas;
  }
}

/* -------------------------------------------------------------------------- */
/* Animator                                                                   */
/* -------------------------------------------------------------------------- */

export class SpriteAnimator {
  /** @param {Object} meta parsed fighter.json (metadata only — no image needed) */
  constructor(meta) {
    this.meta = meta;
    this.animations = meta?.animations || {};
    this.name = 'idle';
    this.index = 0;
    this.elapsed = 0;
    this.finished = false;
    this.loop = true;
    /** Cumulative end time of each frame, in seconds. */
    this.timeline = [];
    this.duration = 0;
    this.eventFrame = -1;
    this.eventName = null;
    this.eventFired = false;
    this.onEvent = null;
    this._pending = null;
    this.play('idle', { force: true });
  }

  get available() { return Object.keys(this.animations).length > 0; }

  has(name) { return !!this.animations[name]; }

  /** Frame count of an animation, or 0. */
  frameCount(name) { return this.animations[name]?.frames || 0; }

  /**
   * Start an animation.
   *
   * @param {string} name
   * @param {{ force?: boolean, startup?: number, total?: number }} [opts]
   *   `startup` + `total` retime the clip so its authored hit frame lands
   *   exactly on the ability's active window — see _buildTimeline.
   * @returns {boolean} true if the playhead actually changed animation
   *
   * Re-asking for the animation already playing is a no-op, even once it has
   * finished: the caller re-states its intent every simulation step, and a
   * one-shot clip such as `hurt` must hold on its last frame rather than
   * restarting for as long as the fighter stays in that state.
   */
  play(name, opts = {}) {
    const anim = this.animations[name];
    if (!anim) return false;
    if (this.name === name && !opts.force) return false;

    this.name = name;
    this.index = 0;
    this.elapsed = 0;
    this.finished = false;
    this.loop = !!anim.loop;
    this.eventFrame = Number.isInteger(anim.hitFrame) ? anim.hitFrame : -1;
    this.eventName = anim.event || null;
    this.eventFired = false;
    this._buildTimeline(anim, opts);
    return true;
  }

  /**
   * Build the per-frame timeline.
   *
   * With no timing hints the clip runs at its authored fps. When an ability
   * supplies `startup` and `total`, the frames before the hit frame are
   * stretched to fill the start-up window and the rest fill the recovery, so
   * the drawn contact frame and the real hitbox activation are the same
   * instant regardless of how the artist paced the sheet.
   */
  _buildTimeline(anim, opts) {
    const n = Math.max(1, anim.frames);
    const per = 1 / Math.max(1, anim.fps);
    const timeline = new Array(n);

    const hit = Number.isInteger(anim.hitFrame) ? anim.hitFrame : -1;
    const startup = opts.startup;
    const total = opts.total;

    if (startup > 0 && total > startup && hit > 0 && hit < n) {
      const aPer = startup / hit;                 // frames [0, hit)
      const bPer = (total - startup) / (n - hit); // frames [hit, n)
      for (let i = 0; i < n; i++) {
        timeline[i] = i < hit
          ? (i + 1) * aPer
          : startup + (i - hit + 1) * bPer;
      }
    } else if (total > 0) {
      const p = total / n;
      for (let i = 0; i < n; i++) timeline[i] = (i + 1) * p;
    } else {
      for (let i = 0; i < n; i++) timeline[i] = (i + 1) * per;
    }

    this.timeline = timeline;
    this.duration = timeline[n - 1];
  }

  /**
   * Advance the playhead. Call once per fixed simulation step.
   * @param {number} dt seconds
   */
  update(dt) {
    if (!this.timeline.length) return;
    this.elapsed += dt;

    if (this.elapsed >= this.duration) {
      if (this.loop) {
        this.elapsed %= this.duration || 1;
        this.eventFired = false;
      } else {
        this.elapsed = this.duration;
        this.finished = true;
      }
    }

    let i = 0;
    while (i < this.timeline.length - 1 && this.elapsed >= this.timeline[i]) i++;
    this.index = i;

    if (!this.eventFired && this.eventFrame >= 0 && this.index >= this.eventFrame) {
      this.eventFired = true;
      if (this.onEvent) this.onEvent(this.eventName || 'hit', this);
    }
  }

  /** Fraction through the current clip, 0..1. */
  get progress() {
    return this.duration > 0 ? Math.min(1, this.elapsed / this.duration) : 1;
  }

  reset() {
    this.elapsed = 0;
    this.index = 0;
    this.finished = false;
    this.eventFired = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Registry                                                                   */
/* -------------------------------------------------------------------------- */

class SpriteRegistry {
  constructor() {
    this.sets = new Map();
    this.defaultId = 'base-ninja';
  }

  add(id, sheet) { this.sets.set(id, sheet); return sheet; }

  get(id) { return this.sets.get(id) || null; }

  /** The sheet a fighter should use: their own if present, else the base. */
  forFighter(fighterData) {
    return this.sets.get(fighterData?.spriteId) || this.sets.get(this.defaultId) || null;
  }

  /** Metadata only — safe outside a browser, so tests can use it. */
  metaFor(fighterData) {
    return this.forFighter(fighterData)?.meta || null;
  }

  get ready() { return this.sets.size > 0; }

  clear() { this.sets.clear(); }
}

export const spriteRegistry = new SpriteRegistry();

/* -------------------------------------------------------------------------- */
/* Combat state → animation                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which animation an ability should play.
 * Kept here so the mapping is one table rather than scattered conditionals.
 */
export function animationForAbility(ability, slotIndex = -1) {
  if (!ability) return 'lightAttack';
  switch (ability.category) {
    case 'basic':
    case 'aerial':
      return 'lightAttack';
    case 'heavy':
    case 'launcher':
    case 'throw':
    case 'guard-break':
      return 'heavyAttack';
    case 'dash':
      return 'dash';
    case 'counter':
      return 'guard';
    case 'healing':
    case 'buff':
    case 'debuff':
      return 'jutsu2';
    case 'ultimate':
      return 'jutsu2';
    default:
      // melee-jutsu / ranged-jutsu / area-jutsu / projectile / summon
      return slotIndex === 1 || slotIndex === 2 ? 'jutsu2' : 'jutsu1';
  }
}

/**
 * Which animation a fighter state should play.
 * `STATE` values are plain strings, so this module stays dependency-free.
 */
export function animationForState(state, airborne) {
  switch (state) {
    case 'walk': return 'walk';
    case 'run': return 'run';
    case 'jump': return 'jump';
    case 'fall':
    case 'airdash': return 'fall';
    case 'dash':
    case 'backdash':
    case 'substitute': return 'dash';
    case 'guard':
    case 'blockstun': return 'guard';
    case 'hitstun':
    case 'guardbreak': return 'hurt';
    case 'launched': return airborne ? 'hurt' : 'knockdown';
    case 'knockdown': return 'knockdown';
    case 'wakeup': return 'getUp';
    case 'ko': return 'defeat';
    case 'victory': return 'victory';
    case 'transform': return 'jutsu2';
    case 'crouch':
    case 'charge':
    case 'land':
    case 'intro':
    case 'idle':
    default: return 'idle';
  }
}

export default SpriteAnimator;
