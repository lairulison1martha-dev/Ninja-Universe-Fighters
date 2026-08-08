/**
 * Control-layout editor.
 *
 * Renders a live copy of the touch controls and lets the player drag each one.
 * Positions are stored normalised (0..1), so a layout made on one phone still
 * works on another.
 */

import settings from '../settings-manager.js';
import { MobileControls } from '../mobile-controls.js';
import audio from '../audio-manager.js';
import { toast } from './overlays.js';

const $ = (id) => document.getElementById(id);

/** Pointer capture is best-effort: a fast tap can end before we ask for it. */
function capture(el, pointerId) {
  try { el.setPointerCapture?.(pointerId); } catch { /* pointer already released */ }
}

export class LayoutEditor {
  constructor(onDone) {
    this.onDone = onDone;
    this.stage = $('layout-stage');
    this.controls = new MobileControls(this.stage, { editable: true });
    this.dragging = null;
    this.layout = null;

    $('btn-layout-done').addEventListener('click', () => {
      audio.play('sfx_ui_select');
      settings.setLayout(this.layout);
      toast('Layout saved.');
      this.onDone?.();
    });
    $('btn-layout-reset').addEventListener('click', () => {
      audio.play('sfx_ui_back');
      settings.resetLayout();
      this.open();
      toast('Layout reset to default.');
    });

    this.stage.addEventListener('pointerdown', this._down, { passive: false });
    this.stage.addEventListener('pointermove', this._move, { passive: false });
    this.stage.addEventListener('pointerup', this._up, { passive: false });
    this.stage.addEventListener('pointercancel', this._up, { passive: false });
    this.stage.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  open() {
    // Work on a copy so Cancel-by-leaving does not persist changes.
    this.layout = JSON.parse(JSON.stringify(settings.values.layout));
    this.controls.build();
    this.controls.enabled = false;
    this.controls.layout();
    this._applyLocal();
  }

  close() {
    this.controls.destroy();
  }

  /** Push the working copy into the DOM without touching saved settings. */
  _applyLocal() {
    const safe = this.controls.safeRect();
    const scale = settings.values.controlScale;
    const mirror = settings.values.leftHanded;

    for (const [id, el] of this.controls.buttons) {
      const b = this.layout.buttons[id];
      if (!b) { el.hidden = true; continue; }
      el.hidden = false;
      const bs = Math.min(92, Math.max(44, b.size * safe.h * scale));
      const half = bs / 2;
      let anchor = b.anchor || 'left';
      if (mirror) anchor = anchor === 'left' ? 'right' : 'left';
      const off = b.dx * safe.h;
      const cx = anchor === 'left' ? safe.x + off : safe.right - off;
      Object.assign(el.style, {
        width: `${bs}px`, height: `${bs}px`,
        left: `${Math.max(safe.x + half, Math.min(safe.right - half, cx))}px`,
        top: `${Math.max(safe.y + half, Math.min(safe.bottom - half, safe.y + b.y * safe.h))}px`,
        fontSize: `${Math.max(8, bs * 0.2)}px`,
      });
    }
    this.controls._placeCycle();
  }

  _hit(x, y) {
    const check = (el, key) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (Math.hypot(x - cx, y - cy) <= r.width / 2 + 8) return { el, key };
      return null;
    };
    for (const [id, el] of this.controls.buttons) {
      if (el.hidden) continue;
      const h = check(el, id);
      if (h) return h;
    }
    return null;
  }

  _down = (e) => {
    e.preventDefault();
    const hit = this._hit(e.clientX, e.clientY);
    if (!hit) return;
    const r = hit.el.getBoundingClientRect();
    this.dragging = {
      key: hit.key,
      el: hit.el,
      dx: e.clientX - (r.left + r.width / 2),
      dy: e.clientY - (r.top + r.height / 2),
      pointerId: e.pointerId,
    };
    hit.el.classList.add('is-dragging');
    capture(this.stage, e.pointerId);
    settings.vibrate(10);
  };

  _move = (e) => {
    if (!this.dragging || e.pointerId !== this.dragging.pointerId) return;
    e.preventDefault();
    const r = this.stage.getBoundingClientRect();
    const safe = this.controls.safeRect();
    const mirror = settings.values.leftHanded;
    const target = this.layout.buttons[this.dragging.key];
    if (!target) return;

    // Positions are stored as an offset from an anchored edge in height units,
    // so convert the drop point back into that space rather than into raw
    // fractions of the viewport.
    const px = e.clientX - this.dragging.dx - r.left;
    const py = e.clientY - this.dragging.dy - r.top;
    let anchor = target.anchor || 'left';
    if (mirror) anchor = anchor === 'left' ? 'right' : 'left';
    const off = anchor === 'left' ? px - safe.x : safe.right - px;

    target.dx = Math.max(0.06, Math.min((safe.w / safe.h) - 0.06, off / safe.h));
    target.y = Math.max(0.06, Math.min(0.94, (py - safe.y) / safe.h));
    this._applyLocal();
  };

  _up = (e) => {
    if (!this.dragging) return;
    e.preventDefault?.();
    this.dragging.el.classList.remove('is-dragging');
    this.dragging = null;
    try { this.stage.releasePointerCapture?.(e.pointerId); } catch { /* released */ }
  };
}

export default LayoutEditor;
