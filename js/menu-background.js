/**
 * Animated main-menu background.
 *
 * Parallax mountains, drifting clouds, leaves, chakra motes, distant birds and
 * a day/night cycle — all procedural, all on one canvas, and all scaled by the
 * "background effects" setting so weak phones can turn it down or off.
 */

import settings from './settings-manager.js';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const PALETTES = {
  dawn:  { sky: ['#2c3f6b', '#8a6a8c', '#e8a878'], hills: ['#1b2740', '#26314e', '#33405f'], sun: '#ffd6a0', star: 0.25 },
  day:   { sky: ['#4d86c4', '#8ab6dd', '#cfe3ee'], hills: ['#2e4a5e', '#3d5b6e', '#4e6d7e'], sun: '#fff4d0', star: 0 },
  dusk:  { sky: ['#1d2a4e', '#6b3f66', '#d4735a'], hills: ['#141c30', '#1e2740', '#2a3450'], sun: '#ff9a5a', star: 0.4 },
  night: { sky: ['#050a18', '#0d1730', '#1a2748'], hills: ['#080e1c', '#0f1830', '#182444'], sun: '#dfe8ff', star: 1 },
};

export class MenuBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.time = 0;
    this.raf = 0;
    this.running = false;
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this._build();
    this._onResize = () => this.resize();
  }

  _build() {
    const r = rng(20260801);
    this.hills = [0.10, 0.22, 0.40].map((p, i) => {
      const pts = [];
      for (let j = 0; j <= 22; j++) {
        pts.push(0.35 + Math.sin(j * (0.6 + i * 0.25) + i * 2) * 0.22 + r() * 0.16);
      }
      return { parallax: p, pts, height: 0.42 - i * 0.07 };
    });
    this.clouds = Array.from({ length: 5 }, () => ({
      // Kept in the upper band so they never drift behind the menu text.
      x: r(), y: 0.05 + r() * 0.14, s: 0.45 + r() * 0.8, v: 0.004 + r() * 0.010,
    }));
    this.leaves = Array.from({ length: 34 }, () => ({
      x: r(), y: r(), vx: 0.02 + r() * 0.05, vy: 0.012 + r() * 0.03,
      s: 0.5 + r() * 1.0, rot: r() * 6.28, spin: (r() - 0.5) * 2,
    }));
    this.motes = Array.from({ length: 30 }, () => ({
      x: r(), y: r(), v: 0.006 + r() * 0.02, p: r() * 6.28, s: 0.5 + r() * 1.1,
    }));
    this.birds = Array.from({ length: 5 }, () => ({
      x: r(), y: 0.12 + r() * 0.2, v: 0.02 + r() * 0.03, p: r() * 6.28, s: 0.6 + r() * 0.6,
    }));
    this.stars = Array.from({ length: 60 }, () => ({
      x: r(), y: r() * 0.6, s: r(), tw: r() * 6.28,
    }));
  }

  get palette() {
    const mode = settings.values.dayNight;
    if (mode === 'day') return PALETTES.day;
    if (mode === 'night') return PALETTES.night;
    const h = new Date().getHours();
    if (h >= 5 && h < 9) return PALETTES.dawn;
    if (h >= 9 && h < 17) return PALETTES.day;
    if (h >= 17 && h < 20) return PALETTES.dusk;
    return PALETTES.night;
  }

  resize() {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, settings.tuning.dprCap, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    globalThis.addEventListener('resize', this._onResize, { passive: true });
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    globalThis.removeEventListener('resize', this._onResize);
  }

  _tick = (now) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.2) dt = 0.016;

    // Throttle to ~30 fps when effects are dialled down.
    const intensity = settings.values.backgroundEffects;
    if (intensity <= 0) { this._drawStatic(); return; }
    this._acc = (this._acc || 0) + dt;
    if (intensity < 0.5 && this._acc < 1 / 30) return;
    const step = this._acc;
    this._acc = 0;

    this.time += step;
    this.draw(step, intensity);
  };

  _drawStatic() {
    if (this._staticDrawn) return;
    this.draw(0, 0);
    this._staticDrawn = true;
  }

  draw(dt, intensity) {
    const ctx = this.ctx;
    const { w, h } = this;
    if (!w || !h) return;
    const pal = this.palette;

    // sky
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(0.55, pal.sky[1]);
    g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // stars
    if (pal.star > 0) {
      ctx.fillStyle = '#ffffff';
      for (const s of this.stars) {
        const a = pal.star * (0.3 + 0.7 * Math.abs(Math.sin(this.time * 1.5 + s.tw)));
        ctx.globalAlpha = a * 0.8;
        ctx.fillRect(s.x * w, s.y * h, 1.6 * s.s + 0.6, 1.6 * s.s + 0.6);
      }
      ctx.globalAlpha = 1;
    }

    // sun / moon
    const sx = w * 0.76;
    const sy = h * 0.20;
    const sunR = Math.min(w, h) * 0.09;
    const sg = ctx.createRadialGradient(sx, sy, sunR * 0.3, sx, sy, sunR * 3.4);
    sg.addColorStop(0, pal.sun);
    sg.addColorStop(0.3, `${pal.sun}55`);
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, sunR * 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, sunR, 0, Math.PI * 2);
    ctx.fill();

    // clouds
    if (intensity > 0.25) {
      ctx.fillStyle = 'rgba(255,255,255,.075)';
      for (const c of this.clouds) {
        c.x = (c.x + c.v * dt) % 1.3;
        const cx = (c.x - 0.15) * w;
        const cy = c.y * h;
        const s = c.s * w * 0.06;
        ctx.beginPath();
        ctx.ellipse(cx, cy, s * 2.0, s * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + s * 0.8, cy - s * 0.25, s * 1.3, s * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // birds
    if (intensity > 0.6) {
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1.6;
      for (const b of this.birds) {
        b.x = (b.x + b.v * dt) % 1.2;
        const bx = (b.x - 0.1) * w;
        const by = b.y * h + Math.sin(this.time * 1.4 + b.p) * 8;
        const flap = Math.sin(this.time * 8 + b.p) * 4 * b.s;
        ctx.beginPath();
        ctx.moveTo(bx - 6 * b.s, by + flap);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + 6 * b.s, by + flap);
        ctx.stroke();
      }
    }

    // parallax hills
    this.hills.forEach((hill, i) => {
      ctx.fillStyle = pal.hills[i] || pal.hills[pal.hills.length - 1];
      const drift = Math.sin(this.time * 0.05) * 12 * hill.parallax;
      const base = h * (0.66 + i * 0.09);
      ctx.beginPath();
      ctx.moveTo(-40, h);
      hill.pts.forEach((p, j) => {
        const x = (j / (hill.pts.length - 1)) * (w + 80) - 40 + drift;
        ctx.lineTo(x, base - p * h * hill.height);
      });
      ctx.lineTo(w + 40, h);
      ctx.closePath();
      ctx.fill();
    });

    // ground haze
    const hz = ctx.createLinearGradient(0, h * 0.72, 0, h);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(1, 'rgba(3,6,12,.85)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // chakra motes
    if (intensity > 0.35) {
      for (const m of this.motes) {
        m.y -= m.v * dt;
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
        const a = 0.25 + 0.45 * Math.abs(Math.sin(this.time * 1.6 + m.p));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#7fd4ff';
        ctx.beginPath();
        ctx.arc(m.x * w + Math.sin(this.time + m.p) * 14, m.y * h, 2.2 * m.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // drifting leaves
    if (intensity > 0.15) {
      ctx.fillStyle = 'rgba(126, 190, 100, .75)';
      for (const l of this.leaves) {
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        l.rot += l.spin * dt;
        if (l.x > 1.05) { l.x = -0.05; l.y = Math.random(); }
        if (l.y > 1.05) { l.y = -0.05; l.x = Math.random(); }
        ctx.save();
        ctx.translate(l.x * w, l.y * h);
        ctx.rotate(l.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5 * l.s, 2.4 * l.s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

export default MenuBackground;
