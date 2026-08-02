/**
 * Procedural stage renderer.
 *
 * Every background is generated from the layer descriptions in data/stages.js —
 * there are no downloaded images. Layer geometry is generated ONCE per stage
 * into a cached path list, then drawn with a parallax offset each frame.
 */

import settings from '../settings-manager.js';
import { ARENA } from '../constants.js';
import { withAlpha } from './fighter-renderer.js';

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Build the static geometry for one layer. */
function buildLayer(layer, w, h) {
  const r = rng((layer.seed || 1) * 7919 + (layer.count || 3) * 104729);
  const out = { kind: layer.kind, parallax: layer.parallax, color: layer.color, items: [] };

  switch (layer.kind) {
    case 'mountains': {
      const pts = [];
      const steps = 26;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const jag = (layer.jag ?? 0.5);
        const base = Math.sin(t * Math.PI * 1.6 + r() * 0.3) * 0.5 + 0.5;
        const noise = (r() - 0.5) * jag;
        pts.push({ x: t, y: Math.max(0.05, base * (1 - jag * 0.3) + noise) });
      }
      out.items = pts;
      out.height = layer.height;
      break;
    }
    case 'dunes': {
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push({ x: t, y: 0.4 + Math.sin(t * 6.2 + r() * 2) * 0.35 + r() * 0.12 });
      }
      out.items = pts;
      out.height = layer.height;
      break;
    }
    case 'buildings': {
      for (let i = 0; i < layer.count; i++) {
        out.items.push({
          x: r(), w: 0.03 + r() * 0.055, h: 0.10 + r() * 0.30,
          roof: r() > 0.5 ? 'peak' : 'flat', lights: r() > 0.4,
        });
      }
      break;
    }
    case 'trees': {
      for (let i = 0; i < layer.count; i++) {
        out.items.push({ x: r(), h: 0.12 + r() * 0.22, w: 0.018 + r() * 0.028, lean: (r() - 0.5) * 0.3 });
      }
      break;
    }
    case 'pillars': {
      for (let i = 0; i < layer.count; i++) {
        out.items.push({ x: (i + 0.5) / layer.count + (r() - 0.5) * 0.08, h: 0.25 + r() * 0.4, w: 0.03 + r() * 0.05 });
      }
      break;
    }
    case 'clouds': {
      for (let i = 0; i < layer.count; i++) {
        out.items.push({ x: r(), y: 0.08 + r() * 0.28, s: 0.5 + r() * 1.2, drift: 6 + r() * 14 });
      }
      break;
    }
    case 'rifts': {
      for (let i = 0; i < layer.count; i++) {
        out.items.push({ x: r(), y: 0.1 + r() * 0.5, len: 0.08 + r() * 0.22, a: r() * Math.PI });
      }
      break;
    }
    case 'water': {
      out.height = layer.height;
      break;
    }
    case 'moon': {
      out.items.push({ x: layer.x, y: layer.y, size: layer.size });
      break;
    }
    default: break;
  }
  return out;
}

export class StageRenderer {
  constructor() {
    this.stage = null;
    this.variant = 'day';
    this.layers = [];
    this.ambient = [];
    this.time = 0;
    this.w = 1280;
    this.h = 720;
  }

  /** @param {Object} stage @param {'day'|'night'} variant */
  setStage(stage, variant = 'day') {
    this.stage = stage;
    this.variant = variant;
    const maxLayers = settings.tuning.parallaxLayers;
    const layers = stage.layers.slice(0, Math.max(2, maxLayers));
    this.layers = layers.map((l) => buildLayer(l, this.w, this.h));
    this._initAmbient();
  }

  _initAmbient() {
    this.ambient.length = 0;
    const a = this.stage?.ambient;
    if (!a) return;
    const budget = Math.round(a.count * settings.values.effects * (settings.tuning.maxParticles / 380));
    const r = rng(1337);
    for (let i = 0; i < budget; i++) {
      this.ambient.push({
        x: r() * ARENA.width,
        y: r() * 700,
        p: r(),
        s: 0.5 + r() * 1.2,
        v: 0.6 + r() * 0.8,
      });
    }
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  /** Sky is drawn in SCREEN space (no camera transform). */
  drawSky(ctx, w, h) {
    const stops = this.variant === 'night' ? this.stage.night : this.stage.day;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.55, stops[1]);
    g.addColorStop(1, stops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /** Parallax layers + ground, drawn in WORLD space. */
  draw(ctx, camera, dt) {
    this.time += dt;
    const w = ARENA.width;
    const horizon = 0;         // world y of the floor
    const skyTop = -900;

    for (const layer of this.layers) {
      const px = camera.x * layer.parallax;
      ctx.save();
      ctx.translate(px, 0);
      ctx.fillStyle = layer.color;
      ctx.strokeStyle = layer.color;

      switch (layer.kind) {
        case 'moon': {
          const it = layer.items[0];
          const cx = it.x * w;
          const cy = skyTop + (1 - it.y) * -skyTop * 0.1 - 520;
          const r0 = it.size * 300;
          const grad = ctx.createRadialGradient(cx, cy, r0 * 0.2, cx, cy, r0 * 2.2);
          grad.addColorStop(0, layer.color);
          grad.addColorStop(0.35, withAlpha(layer.color, 0.40));
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, r0 * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = layer.color;
          ctx.beginPath();
          ctx.arc(cx, cy, r0 * 0.55, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'mountains':
        case 'dunes': {
          const height = (layer.height || 0.3) * 900;
          ctx.beginPath();
          ctx.moveTo(-w, horizon + 40);
          for (const p of layer.items) {
            ctx.lineTo(p.x * w * 1.6 - w * 0.3, horizon - p.y * height);
          }
          ctx.lineTo(w * 1.4, horizon + 40);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'buildings': {
          for (const b of layer.items) {
            const bx = b.x * w * 1.4 - w * 0.2;
            const bw = b.w * w;
            const bh = b.h * 900;
            ctx.fillRect(bx, horizon - bh, bw, bh + 40);
            if (b.roof === 'peak') {
              ctx.beginPath();
              ctx.moveTo(bx - bw * 0.14, horizon - bh);
              ctx.lineTo(bx + bw / 2, horizon - bh - bw * 0.45);
              ctx.lineTo(bx + bw * 1.14, horizon - bh);
              ctx.closePath();
              ctx.fill();
            }
            if (b.lights && this.variant === 'night') {
              ctx.fillStyle = 'rgba(255, 214, 130, .55)';
              for (let i = 0; i < 3; i++) {
                ctx.fillRect(bx + bw * 0.22, horizon - bh + 24 + i * 34, bw * 0.2, 12);
              }
              ctx.fillStyle = layer.color;
            }
          }
          break;
        }
        case 'trees': {
          for (const t of layer.items) {
            const tx = t.x * w * 1.4 - w * 0.2;
            const th = t.h * 900;
            const tw = t.w * w;
            ctx.beginPath();
            ctx.moveTo(tx, horizon + 20);
            ctx.lineTo(tx + t.lean * tw * 2, horizon - th);
            ctx.lineTo(tx + tw, horizon + 20);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(tx + tw / 2 + t.lean * tw, horizon - th, tw * 1.9, th * 0.30, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'pillars': {
          for (const p of layer.items) {
            const bx = p.x * w * 1.3 - w * 0.15;
            ctx.fillRect(bx, horizon - p.h * 900, p.w * w, p.h * 900 + 40);
          }
          break;
        }
        case 'clouds': {
          ctx.globalAlpha = 0.55;
          for (const c of layer.items) {
            const cx = ((c.x * w * 1.6 + this.time * c.drift) % (w * 1.9)) - w * 0.3;
            const cy = -520 - c.y * 400;
            const s = c.s * 90;
            ctx.beginPath();
            ctx.ellipse(cx, cy, s * 2.2, s * 0.62, 0, 0, Math.PI * 2);
            ctx.ellipse(cx + s, cy - s * 0.3, s * 1.4, s * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'rifts': {
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 8;
          for (const rf of layer.items) {
            const cx = rf.x * w * 1.3 - w * 0.15;
            const cy = -200 - rf.y * 600;
            const len = rf.len * 700;
            const wob = Math.sin(this.time * 1.4 + rf.x * 10) * 20;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(rf.a) * len, cy - Math.sin(rf.a) * len + wob);
            ctx.lineTo(cx + Math.cos(rf.a) * len, cy + Math.sin(rf.a) * len - wob);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'water': {
          const wh = (layer.height || 0.2) * 500;
          ctx.fillRect(-w, horizon - wh, w * 3, wh + 60);
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 12; i++) {
            const yy = horizon - wh + i * (wh / 12);
            const off = Math.sin(this.time * 1.2 + i) * 30;
            ctx.fillRect(-w + off, yy, w * 3, 2);
          }
          ctx.globalAlpha = 1;
          break;
        }
        default: break;
      }
      ctx.restore();
    }

    this._drawGround(ctx);
    this._drawAmbient(ctx, dt, camera);
  }

  _drawGround(ctx) {
    const s = this.stage;
    const w = ARENA.width;
    const g = ctx.createLinearGradient(0, 0, 0, 400);
    g.addColorStop(0, s.groundAccent);
    g.addColorStop(1, s.groundColor);
    ctx.fillStyle = g;
    ctx.fillRect(-400, 0, w + 800, 500);

    // Ground detail lines so motion is readable.
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = -400; x < w + 800; x += 120) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 60, 500);
    }
    ctx.stroke();

    // Arena edge markers
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(-400, 0, 400 + ARENA.wallPadding, 500);
    ctx.fillRect(ARENA.width - ARENA.wallPadding, 0, 800, 500);
  }

  _drawAmbient(ctx, dt, camera) {
    const a = this.stage?.ambient;
    if (!a || this.ambient.length === 0) return;
    ctx.fillStyle = a.color;
    ctx.globalAlpha = 0.65;
    const speed = a.speed;

    for (const p of this.ambient) {
      switch (a.kind) {
        case 'rain':
          p.y -= speed * dt;
          p.x -= speed * 0.2 * dt;
          if (p.y < 0) { p.y = 700; p.x = Math.random() * ARENA.width; }
          ctx.fillRect(p.x, -p.y, 2, 16 * p.s);
          break;
        case 'snow':
          p.y -= speed * dt * p.v;
          p.x += Math.sin(this.time + p.p * 10) * 18 * dt;
          if (p.y < 0) { p.y = 700; p.x = Math.random() * ARENA.width; }
          ctx.beginPath();
          ctx.arc(p.x, -p.y, 2.4 * p.s, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'leaves':
          p.y -= speed * dt * 0.5 * p.v;
          p.x += Math.sin(this.time * 1.4 + p.p * 8) * 34 * dt;
          if (p.y < 0) { p.y = 700; p.x = Math.random() * ARENA.width; }
          ctx.save();
          ctx.translate(p.x, -p.y);
          ctx.rotate(this.time * p.v + p.p * 6);
          ctx.fillRect(-4 * p.s, -2 * p.s, 8 * p.s, 4 * p.s);
          ctx.restore();
          break;
        case 'sand':
        case 'dust':
        case 'spray':
          p.x += speed * dt * p.v;
          p.y += Math.sin(this.time * 2 + p.p * 9) * 12 * dt;
          if (p.x > ARENA.width) p.x = 0;
          ctx.fillRect(p.x, -p.y, 3 * p.s, 2 * p.s);
          break;
        case 'embers':
        case 'chakra':
        case 'fireflies':
        case 'sparks':
        default:
          p.y += speed * dt * p.v * 0.6;
          p.x += Math.sin(this.time * 1.1 + p.p * 7) * 22 * dt;
          if (p.y > 700) { p.y = 0; p.x = Math.random() * ARENA.width; }
          ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(this.time * 2 + p.p * 6));
          ctx.beginPath();
          ctx.arc(p.x, -p.y, 2.6 * p.s, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Small preview used by the stage-select cards. */
  static drawPreview(canvas, stage, variant = 'day') {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const stops = variant === 'night' ? stage.night : stage.day;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.6, stops[1]);
    g.addColorStop(1, stops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    stage.layers.forEach((layer, i) => {
      const built = buildLayer(layer, w, h);
      ctx.fillStyle = layer.color;
      const base = h * (0.72 + i * 0.04);
      if (built.kind === 'mountains' || built.kind === 'dunes') {
        ctx.beginPath();
        ctx.moveTo(0, base);
        for (const p of built.items) ctx.lineTo(p.x * w, base - p.y * h * (layer.height || 0.3) * 1.4);
        ctx.lineTo(w, base);
        ctx.closePath();
        ctx.fill();
      } else if (built.kind === 'buildings' || built.kind === 'pillars') {
        for (const b of built.items) {
          const bh = (b.h || 0.3) * h * 0.8;
          ctx.fillRect(b.x * w, base - bh, Math.max(3, (b.w || 0.04) * w), bh);
        }
      } else if (built.kind === 'trees') {
        for (const t of built.items) {
          ctx.beginPath();
          ctx.ellipse(t.x * w, base - t.h * h * 0.5, Math.max(3, t.w * w * 2), t.h * h * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (built.kind === 'moon') {
        const it = built.items[0];
        ctx.beginPath();
        ctx.arc(it.x * w, it.y * h, it.size * h * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const gg = ctx.createLinearGradient(0, h * 0.76, 0, h);
    gg.addColorStop(0, stage.groundAccent);
    gg.addColorStop(1, stage.groundColor);
    ctx.fillStyle = gg;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
  }
}

export default StageRenderer;
