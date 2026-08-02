/**
 * On-screen touch controls.
 *
 * Uses Pointer Events with explicit pointerId tracking so multiple fingers work
 * simultaneously — moving with the left thumb while attacking and guarding with
 * the right is the normal case, not an edge case.
 *
 * Notes on mobile correctness:
 *   - `touch-action: none` on the container + preventDefault on pointerdown
 *     stops scrolling, pull-to-refresh, double-tap zoom and long-press menus.
 *   - Buttons are positioned from a NORMALISED layout so they scale across
 *     phone sizes, and the layout editor writes back into the same structure.
 *   - Left-handed mode mirrors x at read time; the stored layout never changes.
 */

import settings from './settings-manager.js';
import input from './input-manager.js';

/** Pointer capture is best-effort: a fast tap can end before we ask for it. */
function capture(el, pointerId) {
  try { el.setPointerCapture?.(pointerId); } catch { /* pointer already released */ }
}

const BUTTONS = [
  { id: 'jump', label: 'JUMP', side: 'left' },
  { id: 'dash', label: 'DASH', side: 'left' },
  { id: 'light', label: 'A', side: 'right' },
  { id: 'heavy', label: 'B', side: 'right' },
  { id: 'jutsu1', label: 'J1', side: 'right' },
  { id: 'jutsu2', label: 'J2', side: 'right' },
  { id: 'jutsu3', label: 'J3', side: 'right' },
  { id: 'guard', label: 'GRD', side: 'right' },
  { id: 'substitution', label: 'SUB', side: 'right' },
  { id: 'ultimate', label: 'ULT', side: 'right' },
  { id: 'awaken', label: 'AWK', side: 'right' },
  { id: 'assist', label: 'AST', side: 'right' },
];

export class MobileControls {
  /**
   * @param {HTMLElement} container
   * @param {{ editable?: boolean }} [opts]
   */
  constructor(container, opts = {}) {
    this.el = container;
    this.editable = !!opts.editable;
    this.state = input.p1;
    this.buttons = new Map();
    this.stick = null;
    this.stickKnob = null;
    this.pointers = new Map();     // pointerId -> { kind, id, startX, startY }
    this.enabled = true;
    this.disabledActions = new Set();
    this.onLayoutChange = null;
    this._rect = { w: 1, h: 1 };
    this._built = false;
    this._boundResize = () => this.layout();
  }

  build() {
    if (this._built) return;
    this.el.innerHTML = '';

    // Joystick
    const stick = document.createElement('div');
    stick.className = 'stick';
    stick.dataset.ctrl = 'stick';
    const knob = document.createElement('div');
    knob.className = 'stick__knob';
    stick.appendChild(knob);
    this.el.appendChild(stick);
    this.stick = stick;
    this.stickKnob = knob;

    // Buttons
    for (const def of BUTTONS) {
      const b = document.createElement('div');
      b.className = 'ctrl';
      b.dataset.action = def.id;
      b.dataset.ctrl = def.id;
      b.innerHTML = `<span class="ctrl__ready"></span><span class="ctrl__cd"></span><span class="ctrl__label">${def.label}</span>`;
      this.el.appendChild(b);
      this.buttons.set(def.id, b);
    }

    this.el.addEventListener('pointerdown', this._onDown, { passive: false });
    this.el.addEventListener('pointermove', this._onMove, { passive: false });
    this.el.addEventListener('pointerup', this._onUp, { passive: false });
    this.el.addEventListener('pointercancel', this._onUp, { passive: false });
    this.el.addEventListener('lostpointercapture', this._onUp, { passive: false });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());

    globalThis.addEventListener('resize', this._boundResize, { passive: true });
    globalThis.visualViewport?.addEventListener('resize', this._boundResize, { passive: true });

    this._built = true;
    this.layout();
  }

  destroy() {
    globalThis.removeEventListener('resize', this._boundResize);
    globalThis.visualViewport?.removeEventListener('resize', this._boundResize);
    this.el.innerHTML = '';
    this._built = false;
  }

  /** Position everything from the normalised layout. */
  layout() {
    if (!this._built) return;
    const r = this.el.getBoundingClientRect();
    this._rect = { w: r.width || globalThis.innerWidth, h: r.height || globalThis.innerHeight };
    const { w, h } = this._rect;
    const cfg = settings.values.layout;
    const scale = settings.values.controlScale;
    const mirror = settings.values.leftHanded;
    const mx = (x) => (mirror ? 1 - x : x);

    const s = cfg.stick;
    const stickSize = Math.max(80, s.size * h * scale);
    Object.assign(this.stick.style, {
      width: `${stickSize}px`,
      height: `${stickSize}px`,
      left: `${mx(s.x) * w}px`,
      top: `${s.y * h}px`,
    });
    this.stick.classList.toggle('is-floating', settings.values.joystickMode === 'floating' && !this.editable);

    for (const [id, el] of this.buttons) {
      const b = cfg.buttons[id];
      if (!b) continue;
      const size = Math.max(42, b.size * h * scale);
      Object.assign(el.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${mx(b.x) * w}px`,
        top: `${b.y * h}px`,
        fontSize: `${Math.max(9, size * 0.24)}px`,
      });
    }

    this.el.dataset.hand = mirror ? 'left' : 'right';
    this.el.style.setProperty('--ctrl-opacity', String(settings.values.controlOpacity));
  }

  /** Grey out an action (e.g. Lee has no ranged jutsu slot 2). */
  setDisabled(action, disabled) {
    const el = this.buttons.get(action);
    if (!el) return;
    el.classList.toggle('is-disabled', !!disabled);
    if (disabled) this.disabledActions.add(action);
    else this.disabledActions.delete(action);
  }

  /** Cooldown ring: 0 = ready, 1 = just used. */
  setCooldown(action, frac) {
    const el = this.buttons.get(action);
    if (!el) return;
    el.style.setProperty('--cd', `${Math.max(0, Math.min(1, frac))}turn`);
  }

  setReady(action, ready) {
    const el = this.buttons.get(action);
    if (el) el.classList.toggle('is-ready', !!ready);
  }

  setLabel(action, text) {
    const el = this.buttons.get(action);
    const label = el?.querySelector('.ctrl__label');
    if (label) label.textContent = text;
  }

  /* ------------------------------------------------------------ pointers -- */

  _hitButton(x, y) {
    // Manual hit-testing (rather than event.target) so a finger that slides
    // between buttons still registers on the one under it.
    let best = null;
    let bestD = Infinity;
    for (const [id, el] of this.buttons) {
      if (el.classList.contains('is-disabled')) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const rad = r.width / 2 + 6;   // slight forgiveness ring
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rad && d < bestD) { best = id; bestD = d; }
    }
    return best;
  }

  _stickArea(x, y) {
    const mirror = settings.values.leftHanded;
    const r = this.el.getBoundingClientRect();
    const relX = (x - r.left) / (r.width || 1);
    // The whole lower half of the movement side activates a floating stick.
    if (settings.values.joystickMode === 'floating') {
      return mirror ? relX > 0.5 : relX < 0.5;
    }
    const sr = this.stick.getBoundingClientRect();
    const cx = sr.left + sr.width / 2;
    const cy = sr.top + sr.height / 2;
    return Math.hypot(x - cx, y - cy) <= sr.width / 2 + 22;
  }

  _onDown = (e) => {
    if (!this.enabled) return;
    e.preventDefault();
    if (this.editable) return;   // the layout editor installs its own handlers

    const { clientX: x, clientY: y } = e;
    const btn = this._hitButton(x, y);
    if (btn) {
      this.pointers.set(e.pointerId, { kind: 'button', id: btn });
      this.buttons.get(btn).classList.add('is-down');
      this.state.press(btn);
      settings.vibrate(btn === 'ultimate' || btn === 'awaken' ? 22 : 9);
      capture(this.el, e.pointerId);
      return;
    }

    if (this._stickArea(x, y)) {
      if (settings.values.joystickMode === 'floating') {
        const r = this.el.getBoundingClientRect();
        this.stick.style.left = `${x - r.left}px`;
        this.stick.style.top = `${y - r.top}px`;
        this.stick.classList.add('is-active');
      }
      const sr = this.stick.getBoundingClientRect();
      this.pointers.set(e.pointerId, {
        kind: 'stick',
        cx: sr.left + sr.width / 2,
        cy: sr.top + sr.height / 2,
        radius: sr.width / 2,
      });
      this._updateStick(e.pointerId, x, y);
      capture(this.el, e.pointerId);
    }
  };

  _onMove = (e) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.kind === 'stick') {
      this._updateStick(e.pointerId, e.clientX, e.clientY);
      return;
    }
    // Sliding off a button releases it; sliding onto another presses it.
    const over = this._hitButton(e.clientX, e.clientY);
    if (over !== p.id) {
      this.buttons.get(p.id)?.classList.remove('is-down');
      this.state.release(p.id);
      if (over) {
        p.id = over;
        this.buttons.get(over).classList.add('is-down');
        this.state.press(over);
        settings.vibrate(7);
      } else {
        this.pointers.delete(e.pointerId);
      }
    }
  };

  _onUp = (e) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault?.();
    this.pointers.delete(e.pointerId);
    if (p.kind === 'button') {
      this.buttons.get(p.id)?.classList.remove('is-down');
      this.state.release(p.id);
    } else {
      this._resetStick();
    }
    try { this.el.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
  };

  _updateStick(pointerId, x, y) {
    const p = this.pointers.get(pointerId);
    if (!p) return;
    const dz = settings.values.joystickDeadzone;
    const sens = settings.values.joystickSensitivity;
    let dx = (x - p.cx) / p.radius;
    let dy = (y - p.cy) / p.radius;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }

    const knobX = dx * p.radius * 0.52;
    const knobY = dy * p.radius * 0.52;
    this.stickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

    if (mag < dz) {
      this.state.setAxis(0, 0);
      return;
    }
    // Re-scale past the dead zone so the first movement is not a jump.
    const scaled = Math.min(1, ((mag - dz) / (1 - dz)) * sens);
    const nx = (dx / (mag || 1)) * scaled;
    const ny = (dy / (mag || 1)) * scaled;
    this.state.setAxis(
      settings.values.leftHanded ? nx : nx,   // stick is mirrored positionally, not directionally
      ny,
    );
  }

  _resetStick() {
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
    this.state.setAxis(0, 0);
    if (settings.values.joystickMode === 'floating') {
      this.stick.classList.remove('is-active');
      this.layout();
    }
  }

  /** Release everything (pause, round end, screen change). */
  releaseAll() {
    for (const [, p] of this.pointers) {
      if (p.kind === 'button') {
        this.buttons.get(p.id)?.classList.remove('is-down');
        this.state.release(p.id);
      }
    }
    this.pointers.clear();
    this._resetStick();
  }

  show() { this.el.hidden = false; this.layout(); }
  hide() { this.releaseAll(); this.el.hidden = true; }
}

export { BUTTONS };
