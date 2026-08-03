/**
 * Camera: follows the midpoint between fighters, zooms to keep both in frame,
 * and owns screen shake + hit-stop-driven zoom punches.
 */

import settings from '../settings-manager.js';
import { ARENA } from '../constants.js';

export class CameraController {
  constructor() {
    this.x = ARENA.width / 2;
    this.y = -180;
    this.zoom = 1;
    this.targetZoom = 1;
    this.shakeAmount = 0;
    this.shakeTime = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.viewW = 1280;
    this.viewH = 720;
    this.minZoom = 0.62;
    this.maxZoom = 1.55;
    this.focus = null;      // temporary focus target during ultimates
    this.focusTime = 0;
  }

  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  /** Snap to the starting framing (used at round start). */
  snap(a, b) {
    this.update(0.5, a, b, true);
    this.zoom = this.targetZoom;
  }

  update(dt, a, b, instant = false) {
    const midX = (a.x + b.x) / 2;
    const topY = Math.max(a.y, b.y);
    const spread = Math.abs(a.x - b.x);

    // Zoom so both fighters stay comfortably inside the frame.
    const wanted = this.viewW / Math.max(560, spread + 460);
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, wanted));

    let tx = midX;
    let ty = -(topY * 0.45 + 210);

    if (this.focusTime > 0) {
      this.focusTime -= dt;
      if (this.focus) {
        tx = this.focus.x;
        ty = -(this.focus.y * 0.6 + 220);
        this.targetZoom = Math.min(this.maxZoom, this.targetZoom * 1.35);
      }
      if (this.focusTime <= 0) this.focus = null;
    }

    // Keep the camera inside the arena bounds.
    const halfW = (this.viewW / 2) / this.targetZoom;
    tx = Math.max(halfW - 120, Math.min(ARENA.width - halfW + 120, tx));

    // …and keep the floor inside the frame. `ty` is a screen-space offset, so
    // the bottom edge of the view sits at `ty + halfH` and the floor is 0.
    // Without this clamp the camera rides above the ground at close range and
    // crops the fighters off at the knees — which is where a fight spends most
    // of its time. FLOOR_MARGIN is how much ground stays visible under a
    // standing fighter's feet.
    const FLOOR_MARGIN = 26;
    const halfH = (this.viewH / 2) / this.targetZoom;
    ty = Math.max(ty, FLOOR_MARGIN - halfH);

    const k = instant ? 1 : Math.min(1, dt * 7.5);
    const kz = instant ? 1 : Math.min(1, dt * 5.5);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * kz;

    // Shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeAmount * Math.max(0, this.shakeTime / this.shakeDuration) * settings.values.screenShake;
      this.offsetX = (Math.random() - 0.5) * s;
      this.offsetY = (Math.random() - 0.5) * s;
      if (this.shakeTime <= 0) { this.offsetX = 0; this.offsetY = 0; }
    } else {
      this.offsetX *= 0.8;
      this.offsetY *= 0.8;
    }
  }

  shake(amount, duration = 0.22) {
    if (settings.values.screenShake <= 0) return;
    if (amount * settings.values.screenShake < this.shakeAmount * Math.max(0, this.shakeTime)) return;
    this.shakeAmount = amount;
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  focusOn(fighter, seconds = 0.8) {
    this.focus = fighter;
    this.focusTime = seconds;
  }

  /** Apply the camera transform to a 2D context. */
  applyTo(ctx) {
    ctx.translate(this.viewW / 2 + this.offsetX, this.viewH / 2 + this.offsetY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** World → screen, used for HUD-ish overlays drawn on the canvas. */
  worldToScreen(wx, wy, out = { x: 0, y: 0 }) {
    out.x = (wx - this.x) * this.zoom + this.viewW / 2 + this.offsetX;
    out.y = (wy - this.y) * this.zoom + this.viewH / 2 + this.offsetY;
    return out;
  }
}
