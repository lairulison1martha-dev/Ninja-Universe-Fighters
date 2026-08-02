/**
 * Procedural fighter renderer.
 *
 * Fighters are drawn from their `colors` + `visual` data: silhouette shape,
 * hairstyle, weapon, cape, markings and aura. That gives every roster entry a
 * visually distinct placeholder without a single downloaded sprite, and the
 * same code renders the roster portraits.
 */

import settings from '../settings-manager.js';
import { STATE } from './fighter-state.js';

/**
 * Build a translucent version of a colour that is always valid for
 * `addColorStop`. Appending a hex alpha suffix only works on #rrggbb, so any
 * other notation falls back to a wrapped colour-mix-free rgba approximation.
 */
export function withAlpha(color, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
    const hex = Math.round(a * 255).toString(16).padStart(2, '0');
    return color + hex;
  }
  if (typeof color === 'string' && /^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1] + color[1];
    const g = color[2] + color[2];
    const b = color[3] + color[3];
    return `#${r}${g}${b}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
  }
  // rgb()/rgba()/hsl()/named — let the browser parse it, then fade with globalAlpha
  // semantics by returning a transparent black stop when fully faded.
  if (a <= 0.001) return 'rgba(0,0,0,0)';
  return color;
}

/** Simple limb pose per state. Angles in radians. */
function pose(f, t) {
  const s = f.state;
  const swing = Math.sin(t * 9);
  const idle = Math.sin(t * 2.2);
  const p = {
    lean: 0, bob: idle * 2.5,
    armF: -0.5, armB: 0.5, legF: 0.15, legB: -0.15,
    head: 0, crouch: 0, weapon: -0.4,
  };

  switch (s) {
    case STATE.WALK:
      p.legF = swing * 0.55; p.legB = -swing * 0.55;
      p.armF = -swing * 0.5; p.armB = swing * 0.5;
      p.lean = 0.06;
      break;
    case STATE.RUN:
      p.legF = swing * 0.9; p.legB = -swing * 0.9;
      p.armF = -swing * 0.8; p.armB = swing * 0.8;
      p.lean = 0.20; p.bob = Math.abs(swing) * 4;
      break;
    case STATE.JUMP:
      p.legF = -0.7; p.legB = -0.3; p.armF = -1.6; p.armB = -1.2; p.lean = -0.1;
      break;
    case STATE.FALL:
      p.legF = 0.5; p.legB = -0.2; p.armF = -1.9; p.armB = -1.4;
      break;
    case STATE.DASH:
    case STATE.AIRDASH:
      p.lean = 0.42; p.armF = -1.2; p.armB = 1.0; p.legF = 0.8; p.legB = -0.7;
      break;
    case STATE.BACKDASH:
      p.lean = -0.3; p.armF = 0.6; p.armB = -0.6;
      break;
    case STATE.CROUCH:
      p.crouch = 0.42; p.armF = -0.2; p.armB = 0.2;
      break;
    case STATE.GUARD:
      p.armF = -1.5; p.armB = -1.2; p.lean = -0.12; p.crouch = 0.10;
      break;
    case STATE.BLOCKSTUN:
      p.armF = -1.6; p.armB = -1.3; p.lean = -0.26;
      break;
    case STATE.GUARDBREAK:
      p.armF = 1.4; p.armB = 1.2; p.lean = -0.4; p.head = -0.3;
      break;
    case STATE.HITSTUN:
      p.lean = -0.35; p.armF = 0.9; p.armB = 1.1; p.head = -0.25;
      break;
    case STATE.LAUNCHED:
      p.lean = -0.7; p.armF = 1.6; p.armB = 1.9; p.legF = -0.6; p.legB = -0.9;
      break;
    case STATE.KNOCKDOWN:
      p.lean = -1.45; p.crouch = 0.7; p.armF = 1.2; p.armB = 1.4;
      break;
    case STATE.KO:
      p.lean = -1.5; p.crouch = 0.82; p.armF = 1.9; p.armB = 1.6;
      break;
    case STATE.VICTORY:
      p.armF = -2.2; p.armB = -1.0; p.bob = idle * 5;
      break;
    case STATE.SUBSTITUTE:
      p.lean = 0.1; p.armF = -1.0; p.armB = 1.0;
      break;
    case STATE.TRANSFORM:
      p.armF = -2.4; p.armB = 2.4; p.lean = -0.2; p.bob = Math.sin(t * 22) * 4;
      break;
    case STATE.ATTACK: {
      const a = f.act;
      if (a) {
        const prog = a.t / Math.max(0.001, a.ability.totalTime);
        const startFrac = a.ability.startup / a.ability.totalTime;
        const punch = prog < startFrac
          ? -(prog / Math.max(0.001, startFrac)) * 0.9
          : 2.0 - Math.min(1, (prog - startFrac) / 0.35) * 1.2;
        const cat = a.ability.category;
        if (cat === 'launcher') { p.armF = -2.4 + punch * 0.4; p.legF = -0.4; p.lean = -0.15; }
        else if (cat === 'aerial') { p.armF = -1.2 - punch * 0.6; p.legF = 0.7; }
        else if (cat === 'throw') { p.armF = -1.5; p.armB = -1.2; p.lean = 0.2; }
        else if (cat === 'ultimate') { p.armF = -1.6 - punch * 0.4; p.armB = -1.4; p.lean = 0.22; }
        else { p.armF = punch; p.lean = 0.20; p.legF = 0.4; p.legB = -0.35; }
        p.weapon = punch;
      }
      break;
    }
    default:
      p.armF = -0.5 + idle * 0.06;
      p.armB = 0.5 - idle * 0.06;
      break;
  }
  return p;
}

function limb(ctx, x, y, angle, len, width, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-width / 2, 0, width, len, width / 2);
  ctx.fill();
  ctx.restore();
}

// roundRect polyfill for older Safari
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.beginPath();
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
    return this;
  };
}

export class FighterRenderer {
  /**
   * Draw a fighter in WORLD space (y up; caller has already flipped y).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./fighter.js').Fighter} f
   */
  static draw(ctx, f, dt) {
    const c = f.data.colors;
    const v = f.data.visual;
    const t = f.animTime;
    const p = pose(f, t);
    const scaleY = v.height || 1;
    const bulk = v.bulk || 1;

    const H = 158 * scaleY;
    const torsoH = H * 0.34;
    const legH = H * 0.40;
    const headR = H * 0.115 * bulk;

    ctx.save();
    ctx.translate(f.x, -f.y);
    ctx.scale(f.facing, 1);

    // ---- shadow ---------------------------------------------------------
    if (settings.tuning.shadows) {
      const sh = Math.max(0.25, 1 - f.y / 500);
      ctx.save();
      ctx.globalAlpha = 0.34 * sh;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, f.y, 34 * bulk * sh, 9 * sh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- aura -----------------------------------------------------------
    if (f.form && settings.values.effects > 0.2) {
      const pulse = 0.6 + Math.sin(t * 6) * 0.18;
      const g = ctx.createRadialGradient(0, -H * 0.5, H * 0.1, 0, -H * 0.5, H * 0.95);
      g.addColorStop(0, withAlpha(f.auraColor, 0));
      g.addColorStop(0.55, withAlpha(f.auraColor, 0.33));
      g.addColorStop(1, withAlpha(f.auraColor, 0));
      ctx.globalAlpha = pulse;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -H * 0.5, H * 0.55, H * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ---- guard shimmer --------------------------------------------------
    if (f.guardHeld || f.mods.autoGuard) {
      ctx.strokeStyle = 'rgba(140, 240, 200, .55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -H * 0.5, 46 * bulk, H * 0.58, 0, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
    }

    ctx.translate(0, -p.crouch * H * 0.22);
    ctx.rotate(-p.lean * 0.5);

    const hipY = -legH;
    const shoulderY = hipY - torsoH;

    // ---- cape (behind) --------------------------------------------------
    if (v.cape) {
      ctx.fillStyle = c.secondary;
      ctx.beginPath();
      ctx.moveTo(-6, shoulderY + 4);
      ctx.quadraticCurveTo(-42 - p.lean * 40, hipY + 10, -18, hipY + legH * 0.55);
      ctx.lineTo(10, hipY + legH * 0.5);
      ctx.quadraticCurveTo(14, hipY - 6, 8, shoulderY + 4);
      ctx.closePath();
      ctx.fill();
    }

    // ---- back limbs -----------------------------------------------------
    const dark = c.secondary;
    limb(ctx, -5, hipY, Math.PI + p.legB, legH, 15 * bulk, dark);
    limb(ctx, -8, shoulderY + 8, Math.PI * 0.5 + p.armB, torsoH * 0.95, 12 * bulk, dark);

    // ---- torso ----------------------------------------------------------
    ctx.fillStyle = c.primary;
    ctx.beginPath();
    ctx.roundRect(-19 * bulk, shoulderY, 38 * bulk, torsoH + 10, 12);
    ctx.fill();
    // trim
    ctx.fillStyle = c.accent;
    ctx.fillRect(-19 * bulk, shoulderY + torsoH * 0.62, 38 * bulk, 5);
    if (v.markings === 'stripes') {
      ctx.globalAlpha = 0.7;
      ctx.fillRect(-19 * bulk, shoulderY + torsoH * 0.25, 38 * bulk, 3);
      ctx.globalAlpha = 1;
    } else if (v.markings === 'seal') {
      ctx.beginPath();
      ctx.arc(0, shoulderY + torsoH * 0.35, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- front leg / arm -------------------------------------------------
    limb(ctx, 5, hipY, Math.PI + p.legF, legH, 16 * bulk, c.primary);
    limb(ctx, 8, shoulderY + 8, Math.PI * 0.5 + p.armF, torsoH * 0.95, 13 * bulk, c.skin);

    // ---- weapon ----------------------------------------------------------
    if (v.weapon && v.weapon !== 'none') {
      ctx.save();
      ctx.translate(8, shoulderY + 8);
      ctx.rotate(Math.PI * 0.5 + p.armF);
      ctx.translate(0, torsoH * 0.95);
      ctx.rotate(-Math.PI * 0.5);
      FighterRenderer._weapon(ctx, v.weapon, c);
      ctx.restore();
    }

    // ---- head ------------------------------------------------------------
    const headY = shoulderY - headR * 0.9;
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate(p.head);
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fill();

    // hair
    ctx.fillStyle = c.hair;
    FighterRenderer._hair(ctx, v.hairStyle, headR);

    // eye glow
    ctx.fillStyle = f.form ? f.auraColor : c.accent;
    ctx.beginPath();
    ctx.ellipse(headR * 0.42, -headR * 0.08, headR * 0.22, headR * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ---- hit flash --------------------------------------------------------
    if (f.flash > 0 && settings.values.hitFlash) {
      ctx.globalAlpha = f.flash * 0.65;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-24 * bulk, shoulderY - headR * 2, 48 * bulk, H, 14);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // ---- invulnerability shimmer ------------------------------------------
    if (f.invulnerable) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 30) * 0.2;
      ctx.strokeStyle = '#a8dcff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-24 * bulk, shoulderY - headR * 2, 48 * bulk, H, 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  static _hair(ctx, style, r) {
    switch (style) {
      case 'spiky':
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.28, -r * 0.5);
          ctx.lineTo(i * r * 0.30 - r * 0.12, -r * 1.75);
          ctx.lineTo(i * r * 0.32 + r * 0.16, -r * 0.55);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'long':
        ctx.beginPath();
        ctx.ellipse(-r * 0.15, -r * 0.15, r * 1.05, r * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(-r * 1.0, -r * 0.3, r * 0.7, r * 2.6, r * 0.3);
        ctx.fill();
        break;
      case 'ponytail':
        ctx.beginPath();
        ctx.arc(0, -r * 0.28, r * 1.0, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(-r * 1.25, -r * 0.4, r * 0.45, r * 2.2, r * 0.22);
        ctx.fill();
        break;
      case 'bowl':
        ctx.beginPath();
        ctx.arc(0, -r * 0.12, r * 1.1, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-r * 1.1, -r * 0.2, r * 2.2, r * 0.34);
        break;
      case 'wild':
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.24, -r * 0.35);
          ctx.lineTo(i * r * 0.42, -r * (1.5 + Math.abs(i) * 0.12));
          ctx.lineTo(i * r * 0.26 + r * 0.2, -r * 0.4);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'braided':
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, r * 1.0, Math.PI, 0);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(-r * 1.05, -r * 0.1 + i * r * 0.55, r * 0.26, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'hooded':
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 1.25, Math.PI * 0.92, Math.PI * 0.08);
        ctx.fill();
        break;
      case 'bald':
        break;
      case 'short':
      default:
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, r * 1.02, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-r * 1.02, -r * 0.28, r * 2.04, r * 0.3);
        break;
    }
  }

  static _weapon(ctx, kind, c) {
    ctx.fillStyle = '#cfd8e6';
    switch (kind) {
      case 'sword':
        ctx.fillRect(-3, -6, 6, 78);
        ctx.fillStyle = c.secondary;
        ctx.fillRect(-6, -14, 12, 12);
        break;
      case 'kunai':
        ctx.beginPath();
        ctx.moveTo(0, 26); ctx.lineTo(-5, 4); ctx.lineTo(5, 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.secondary;
        ctx.fillRect(-3, -10, 6, 14);
        break;
      case 'fan':
        ctx.fillStyle = c.secondary;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.arc(0, 0, 42, -0.5, 0.9); ctx.closePath();
        ctx.fill();
        break;
      case 'scythe':
        ctx.fillRect(-2, -4, 4, 74);
        ctx.beginPath();
        ctx.arc(0, 70, 26, Math.PI * 0.9, Math.PI * 1.7);
        ctx.lineWidth = 6; ctx.strokeStyle = '#cfd8e6'; ctx.stroke();
        break;
      case 'staff':
        ctx.fillStyle = c.secondary;
        ctx.fillRect(-3, -30, 6, 110);
        break;
      case 'puppet':
        ctx.fillStyle = c.secondary;
        ctx.beginPath(); ctx.roundRect(-14, 10, 28, 46, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke();
        break;
      case 'claws':
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 6, 4); ctx.lineTo(i * 8, 30); ctx.lineTo(i * 6 + 4, 6);
          ctx.closePath(); ctx.fill();
        }
        break;
      case 'blades':
        ctx.fillRect(-2, 2, 4, 52);
        ctx.fillRect(-9, 2, 4, 40);
        break;
      default: break;
    }
  }

  /** Portrait render used by the character-select cards. */
  static drawPortrait(canvas, fighterData, opts = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const c = fighterData.colors;
    const v = fighterData.visual;
    ctx.clearRect(0, 0, w, h);

    // background wash
    const g = ctx.createRadialGradient(w / 2, h * 0.34, 4, w / 2, h * 0.34, h * 0.8);
    g.addColorStop(0, withAlpha(c.aura, 0.27));
    g.addColorStop(1, 'rgba(4,8,16,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const H = h * 0.86;
    const bulk = (v.bulk || 1) * (w / 96);
    ctx.save();
    ctx.translate(w / 2, h * 0.98);

    const torsoH = H * 0.34;
    const legH = H * 0.40;
    const headR = H * 0.115 * (v.bulk || 1);
    const hipY = -legH;
    const shoulderY = hipY - torsoH;

    if (v.cape) {
      ctx.fillStyle = c.secondary;
      ctx.beginPath();
      ctx.moveTo(-6 * bulk, shoulderY);
      ctx.quadraticCurveTo(-40 * bulk, hipY, -16 * bulk, hipY + legH * 0.6);
      ctx.lineTo(12 * bulk, hipY + legH * 0.55);
      ctx.closePath();
      ctx.fill();
    }
    limb(ctx, -5 * bulk, hipY, Math.PI - 0.12, legH, 15 * bulk, c.secondary);
    limb(ctx, -8 * bulk, shoulderY + 8, Math.PI * 0.5 + 0.5, torsoH, 12 * bulk, c.secondary);

    ctx.fillStyle = c.primary;
    ctx.beginPath();
    ctx.roundRect(-19 * bulk, shoulderY, 38 * bulk, torsoH + 10, 12);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.fillRect(-19 * bulk, shoulderY + torsoH * 0.62, 38 * bulk, 4);

    limb(ctx, 5 * bulk, hipY, Math.PI + 0.15, legH, 16 * bulk, c.primary);
    limb(ctx, 8 * bulk, shoulderY + 8, Math.PI * 0.5 - 0.45, torsoH, 13 * bulk, c.skin);

    ctx.save();
    ctx.translate(0, shoulderY - headR * 0.9);
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.hair;
    FighterRenderer._hair(ctx, v.hairStyle, headR);
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.ellipse(headR * 0.38, -headR * 0.05, headR * 0.2, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    if (opts.locked) {
      ctx.fillStyle = 'rgba(4,8,16,.55)';
      ctx.fillRect(0, 0, w, h);
    }
  }
}

export default FighterRenderer;
