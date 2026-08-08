/**
 * On-screen touch controls — arcade layout.
 *
 * Four separate directional buttons (no joystick) on the left, a five-button
 * action cluster on the right, and Awakening / Ultimate held apart in the
 * top-right corner so a special can never be hit while reaching for Punch.
 *
 * Uses Pointer Events with explicit pointerId tracking so multiple fingers work
 * simultaneously — holding RIGHT with the left thumb while tapping PUNCH and
 * holding GUARD with the right is the normal case, not an edge case. Each
 * pointer owns exactly one button and releases only that one.
 *
 * Notes on mobile correctness:
 *   - `touch-action: none` on the container + preventDefault on pointerdown
 *     stops scrolling, pull-to-refresh, double-tap zoom and long-press menus.
 *   - Buttons are laid out inside the SAFE RECT (the container's padding box,
 *     which CSS sets from the safe-area insets) and then clamped into it, so
 *     nothing can reach the notch, Dynamic Island or home indicator.
 *   - Horizontal offsets are stored in units of the safe rect's HEIGHT and
 *     measured from an anchored edge. A cluster therefore keeps its shape on
 *     every phone instead of stretching apart on wider screens.
 *   - Left-handed mode mirrors the anchor at read time; the stored layout
 *     never changes.
 */

import settings from './settings-manager.js';
import input from './input-manager.js';

/** Pointer capture is best-effort: a fast tap can end before we ask for it. */
function capture(el, pointerId) {
  try { el.setPointerCapture?.(pointerId); } catch { /* pointer already released */ }
}

/** Smallest comfortable touch target, and a cap so buttons never bloat. */
const MIN_BUTTON = 44;
const MAX_BUTTON = 92;

/**
 * How long CHAKRA must be held before it counts as a charge rather than a tap.
 * Short enough that charging still feels immediate, long enough that a
 * deliberate assist tap never crosses it.
 */
const HOLD_MS = 200;

/**
 * Every control on screen.
 *
 * `dir` marks the four movement buttons: they feed the analogue axis instead of
 * firing an action. `action` is the input-manager action a press maps to.
 * There is deliberately no Jump button — UP is upward movement, which in this
 * side-view engine means a jump.
 */
const BUTTONS = [
  { id: 'up', label: 'UP', dir: [0, -1], action: 'jump', icon: 'arrow', theme: 'move' },
  { id: 'left', label: 'LEFT', dir: [-1, 0], theme: 'move', icon: 'arrow' },
  { id: 'right', label: 'RIGHT', dir: [1, 0], theme: 'move', icon: 'arrow' },
  { id: 'down', label: 'DOWN', dir: [0, 1], theme: 'move', icon: 'arrow' },

  { id: 'jutsu', label: 'JUTSU', action: 'jutsu', theme: 'jutsu', icon: 'jutsu', caption: true },
  { id: 'guard', label: 'GUARD', action: 'guard', theme: 'guard', icon: 'guard', caption: true },
  // Dual-function, so the assist needs no permanent circle of its own:
  // a quick tap calls the assist, holding past the threshold charges chakra.
  {
    id: 'chakra',
    label: 'CHAKRA',
    theme: 'chakra',
    icon: 'chakra',
    caption: true,
    tapAction: 'assist',
    holdAction: 'chakra',
  },
  { id: 'light', label: 'PUNCH', action: 'light', theme: 'punch', icon: 'punch', caption: true },
  { id: 'heavy', label: 'KICK', action: 'heavy', theme: 'kick', icon: 'kick', caption: true },

  { id: 'awaken', label: 'AWAKENING', action: 'awaken', theme: 'awaken', icon: 'awaken', caption: true },
  { id: 'ultimate', label: 'ULTIMATE', action: 'ultimate', theme: 'ultimate', icon: 'ultimate', caption: true },
];

/** Pixel-art glyphs, drawn as inline SVG so they scale without a sprite fetch. */
const ICONS = {
  arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2h1v1h1v1h1v1h1v1h1v1h1v2h-3v6H6V9H3V7h1V6h1V5h1V4h1V3h1z"/></svg>',
  punch: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 5h2V3h2v2h2V4h2v1h1v2h1v5h-1v2H5v-2H4V9H3V6h1z"/></svg>',
  kick: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h3v2h2v2h5v2h-2v2h-2v2H6v-2H4v-2H3V7h2V5H3z"/></svg>',
  guard: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l6 2v5c0 4-3 6-6 7-3-1-6-3-6-7V3z"/></svg>',
  chakra: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l2 5 3-2-2 4h3l-4 2 2 4-4-3-4 3 2-4-4-2h3L3 4l3 2z"/></svg>',
  jutsu: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8l5-5v3h7v4H7v3z"/></svg>',
  awaken: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1a2 2 0 011 4v1h2v4h-1v5H6v-5H5V6h2V5a2 2 0 011-4z"/></svg>',
  ultimate: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1a2 2 0 011 4v1h2v4h-1v5H6v-5H5V6h2V5a2 2 0 011-4z"/></svg>',
};

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
    this.pointers = new Map();     // pointerId -> { id }
    this.held = new Set();         // currently held direction ids
    this._taps = new Map();        // dual-function buttons mid press
    this.enabled = true;
    this.disabledActions = new Set();
    /** Tapped when the player wants a different jutsu slot. */
    this.onCycleJutsu = null;
    this._safe = { x: 0, y: 0, w: 1, h: 1 };
    this._built = false;
    this._boundResize = () => this.layout();
  }

  build() {
    if (this._built) return;
    this.el.innerHTML = '';

    for (const def of BUTTONS) {
      const b = document.createElement('div');
      b.className = 'ctrl';
      b.dataset.action = def.id;
      b.dataset.ctrl = def.id;
      b.dataset.theme = def.theme;
      if (def.dir) b.dataset.dir = def.id;
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', def.label);
      b.innerHTML =
        `<span class="ctrl__ready"></span>`
        + `<span class="ctrl__face"><span class="ctrl__icon">${ICONS[def.icon] || ''}</span></span>`
        + `<span class="ctrl__cd"></span>`
        + (def.caption ? `<span class="ctrl__label">${def.label}</span>` : '');
      this.el.appendChild(b);
      this.buttons.set(def.id, b);
    }

    // Cycling the jutsu slot lives on the Jutsu button itself rather than as a
    // sixth circle, so the five-button cluster stays as designed while all
    // three of a fighter's jutsu remain reachable.
    const cyc = document.createElement('button');
    cyc.type = 'button';
    cyc.className = 'ctrl__cycle';
    cyc.id = 'ctrl-jutsu-cycle';
    cyc.setAttribute('aria-label', 'Next jutsu');
    cyc.textContent = '‹›';
    cyc.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.editable || !this.enabled) return;
      settings.vibrate(8);
      this.onCycleJutsu?.();
    });
    this.el.appendChild(cyc);
    this.cycleEl = cyc;

    // The assist indicator: a small portrait with a cooldown sweep, parked
    // beside CHAKRA because that is the button that calls it. It is a readout,
    // not a control — no sixth circle was added to the layout.
    const assist = document.createElement('div');
    assist.className = 'ctrl__assist';
    assist.id = 'ctrl-assist';
    assist.hidden = true;
    assist.innerHTML =
      '<img class="ctrl__assist-face" id="ctrl-assist-face" alt="" width="48" height="48">'
      + '<span class="ctrl__assist-cd"></span>'
      + '<span class="ctrl__assist-secs" id="ctrl-assist-secs"></span>';
    this.el.appendChild(assist);
    this.assistEl = assist;

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

  /**
   * The rect controls may occupy: the container minus its safe-area padding.
   * Reading the resolved padding is what keeps this honest — CSS owns the
   * `env(safe-area-inset-*)` maths, so there is one definition of "safe".
   */
  safeRect() {
    const r = this.el.getBoundingClientRect();
    const w = r.width || globalThis.innerWidth;
    const h = r.height || globalThis.innerHeight;
    const cs = globalThis.getComputedStyle?.(this.el);
    const px = (v) => (Number.parseFloat(v) || 0);
    const l = px(cs?.paddingLeft);
    const t = px(cs?.paddingTop);
    const rr = px(cs?.paddingRight);
    const b = px(cs?.paddingBottom);
    return {
      x: l,
      y: t,
      w: Math.max(1, w - l - rr),
      h: Math.max(1, h - t - b),
      right: Math.max(1, w - l - rr) + l,
      bottom: Math.max(1, h - t - b) + t,
    };
  }

  /** Position everything from the normalised layout, inside the safe rect. */
  layout() {
    if (!this._built) return;
    const safe = this.safeRect();
    this._safe = safe;
    const cfg = settings.values.layout;
    const scale = settings.values.controlScale;
    const mirror = settings.values.leftHanded;

    let topRightReach = 0;

    for (const [id, el] of this.buttons) {
      const b = cfg.buttons[id];
      if (!b) { el.hidden = true; continue; }
      el.hidden = false;
      const size = Math.min(MAX_BUTTON, Math.max(MIN_BUTTON, b.size * safe.h * scale));
      const half = size / 2;

      // Anchor + height-relative offset keeps each cluster's shape intact.
      let anchor = b.anchor || 'left';
      if (mirror) anchor = anchor === 'left' ? 'right' : 'left';
      const off = b.dx * safe.h;
      let cx = anchor === 'left' ? safe.x + off : safe.right - off;
      let cy = safe.y + b.y * safe.h;

      // Hard guarantee: the whole button stays inside the safe rect.
      cx = Math.max(safe.x + half, Math.min(safe.right - half, cx));
      cy = Math.max(safe.y + half, Math.min(safe.bottom - half, cy));

      Object.assign(el.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${cx}px`,
        top: `${cy}px`,
        fontSize: `${Math.max(8, size * 0.2)}px`,
      });

      if ((id === 'awaken' || id === 'ultimate') && !mirror) {
        topRightReach = Math.max(topRightReach, safe.right - (cx - half));
      }
    }

    // The HUD reserves this much of the top edge so the opponent's bar never
    // slides under the Awakening / Ultimate pair.
    this.el.style.setProperty('--ctrl-topright-w', `${Math.ceil(topRightReach)}px`);
    document.documentElement.style.setProperty('--ctrl-topright-w', `${Math.ceil(topRightReach)}px`);

    this._placeCycle();
    this._placeAssist();
    this.el.dataset.hand = mirror ? 'left' : 'right';
    this.el.style.setProperty('--ctrl-opacity', String(settings.values.controlOpacity));
  }

  /** Park the slot-cycle chip on the Jutsu button's upper outer corner. */
  _placeCycle() {
    const jut = this.buttons.get('jutsu');
    if (!this.cycleEl || !jut || jut.hidden) return;
    const size = Number.parseFloat(jut.style.width) || MIN_BUTTON;
    const chip = Math.max(20, size * 0.38);
    const cx = Number.parseFloat(jut.style.left) || 0;
    const cy = Number.parseFloat(jut.style.top) || 0;
    const dir = settings.values.leftHanded ? 1 : -1;
    Object.assign(this.cycleEl.style, {
      width: `${chip}px`,
      height: `${chip}px`,
      left: `${cx + dir * size * 0.42}px`,
      top: `${cy - size * 0.42}px`,
      fontSize: `${Math.max(9, chip * 0.5)}px`,
    });
    this.cycleEl.hidden = this.editable;
  }

  /**
   * These three are called for every button on every frame, so each one writes
   * to the DOM only when the value actually changed. Toggling a class and
   * setting an attribute 11 times per frame is enough to cost frames on a
   * phone, and none of it is work the browser can skip on its own.
   */
  _changed(action, key, value) {
    let seen = this._last || (this._last = new Map());
    const k = `${action}:${key}`;
    if (seen.get(k) === value) return false;
    seen.set(k, value);
    return true;
  }

  /** Park the assist readout above the CHAKRA button that calls it. */
  _placeAssist() {
    const ch = this.buttons.get('chakra');
    if (!this.assistEl || !ch || ch.hidden) return;
    const size = Number.parseFloat(ch.style.width) || MIN_BUTTON;
    const chip = Math.max(26, size * 0.62);
    const cx = Number.parseFloat(ch.style.left) || 0;
    const cy = Number.parseFloat(ch.style.top) || 0;
    Object.assign(this.assistEl.style, {
      width: `${chip}px`,
      height: `${chip}px`,
      left: `${cx}px`,
      top: `${cy - size * 0.78}px`,
      fontSize: `${Math.max(8, chip * 0.34)}px`,
    });
  }

  /**
   * Show which fighter is on assist duty. `null` hides the chip entirely —
   * a loadout with no assist should not leave an empty frame on screen.
   */
  setAssist(fighterId, portraitSrc) {
    if (!this.assistEl) return;
    this.assistId = fighterId || null;
    this.assistEl.hidden = !fighterId;
    const img = this.assistEl.querySelector('.ctrl__assist-face');
    if (!img) return;
    if (!fighterId || !portraitSrc) { img.removeAttribute('src'); return; }
    if (img.dataset.src === portraitSrc) return;
    img.dataset.src = portraitSrc;
    img.onerror = () => { img.removeAttribute('src'); };
    img.src = portraitSrc;
    this._placeAssist();
  }

  /** Ready ring, cooldown sweep, or dimmed — written only when it changes. */
  setAssistState({ ready, cooldown, seconds, active }) {
    const el = this.assistEl;
    if (!el || el.hidden) return;
    const cd = Math.round(Math.max(0, Math.min(1, cooldown || 0)) * 100) / 100;
    if (this._changed('assist', 'cd', cd)) el.style.setProperty('--cd', `${cd}turn`);
    if (this._changed('assist', 'ready', !!ready)) el.classList.toggle('is-ready', !!ready);
    if (this._changed('assist', 'active', !!active)) el.classList.toggle('is-active', !!active);
    if (this._changed('assist', 'dim', !ready && !active)) {
      el.classList.toggle('is-dim', !ready && !active);
    }
    const secs = cd > 0 ? String(Math.ceil(seconds || 0)) : '';
    if (this._changed('assist', 'secs', secs)) {
      const n = el.querySelector('.ctrl__assist-secs');
      if (n) n.textContent = secs;
    }
  }

  /** Grey out an action (e.g. no transformation available yet). */
  setDisabled(action, disabled) {
    const el = this.buttons.get(action);
    if (!el) return;
    const v = !!disabled;
    if (v) this.disabledActions.add(action);
    else this.disabledActions.delete(action);
    if (!this._changed(action, 'dis', v)) return;
    el.classList.toggle('is-disabled', v);
    el.setAttribute('aria-disabled', v ? 'true' : 'false');
  }

  isDisabled(action) { return this.disabledActions.has(action); }

  /** Cooldown ring: 0 = ready, 1 = just used. */
  setCooldown(action, frac) {
    const el = this.buttons.get(action);
    if (!el) return;
    // Quantised: the sweep is a ring a few dozen pixels across, so writing
    // more than a hundred distinct values per second buys nothing visible.
    const v = Math.round(Math.max(0, Math.min(1, frac || 0)) * 100) / 100;
    if (!this._changed(action, 'cd', v)) return;
    el.style.setProperty('--cd', `${v}turn`);
    el.classList.toggle('is-cooling', v > 0.001);
  }

  setReady(action, ready) {
    const el = this.buttons.get(action);
    if (!el) return;
    const v = !!ready;
    if (!this._changed(action, 'ready', v)) return;
    el.classList.toggle('is-ready', v);
  }

  setLabel(action, text) {
    const el = this.buttons.get(action);
    const label = el?.querySelector('.ctrl__label');
    if (label && label.textContent !== text) label.textContent = text;
  }

  /* ------------------------------------------------------------ pointers -- */

  _hitButton(x, y) {
    // Manual hit-testing (rather than event.target) so a finger that slides
    // between buttons still registers on the one under it.
    let best = null;
    let bestD = Infinity;
    for (const [id, el] of this.buttons) {
      if (el.hidden || el.classList.contains('is-disabled')) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const rad = r.width / 2 + 6;   // slight forgiveness ring
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rad && d < bestD) { best = id; bestD = d; }
    }
    return best;
  }

  _press(id) {
    const def = BUTTONS.find((b) => b.id === id);
    if (!def) return;
    this.buttons.get(id)?.classList.add('is-down');
    if (def.dir) {
      this.held.add(id);
      this._applyAxis();
      // UP is upward movement; in a side-view engine that is the jump.
      if (def.action) this.state.press(def.action);
      this._checkDoubleTap(id);
    } else if (def.tapAction) {
      this._startTapHold(id, def);
    } else if (def.action) {
      this.state.press(def.action);
    }
    settings.vibrate(id === 'ultimate' || id === 'awaken' ? 22 : 9);
  }

  /**
   * Tap/hold split for the dual-function CHAKRA button.
   *
   * Nothing happens on the way down. The hold action starts only when the
   * timer fires, and the tap action fires only if the finger lifts before it.
   * That makes the two outcomes mutually exclusive by construction: a quick
   * tap can never visibly start charging, and a long hold can never emit the
   * tap afterwards.
   */
  _startTapHold(id, def) {
    const rec = { def, holding: false, timer: 0 };
    rec.timer = setTimeout(() => {
      rec.holding = true;
      this.buttons.get(id)?.classList.add('is-holding');
      this.state.press(def.holdAction);
    }, HOLD_MS);
    this._taps.set(id, rec);
  }

  _endTapHold(id) {
    const rec = this._taps.get(id);
    if (!rec) return;
    this._taps.delete(id);
    clearTimeout(rec.timer);
    this.buttons.get(id)?.classList.remove('is-holding');
    if (rec.holding) {
      // It was a charge; releasing stops it and never emits the tap.
      this.state.release(rec.def.holdAction);
      return;
    }
    // Released before the threshold: this was a tap.
    this.state.press(rec.def.tapAction);
    this.state.release(rec.def.tapAction);
    settings.vibrate(14);
  }

  /**
   * Dash has no button of its own in this layout, so it keeps the input every
   * fighting game already uses: tap a direction twice, quickly.
   */
  _checkDoubleTap(id) {
    if (id !== 'left' && id !== 'right') return;
    const now = performance.now();
    const last = this._lastDirTap;
    this._lastDirTap = { id, t: now };
    if (last && last.id === id && now - last.t < 280) {
      this.state.press('dash');
      this.state.release('dash');
      this._lastDirTap = null;
      settings.vibrate(12);
    }
  }

  _release(id) {
    const def = BUTTONS.find((b) => b.id === id);
    if (!def) return;
    this.buttons.get(id)?.classList.remove('is-down');
    if (def.dir) {
      this.held.delete(id);
      this._applyAxis();
      if (def.action) this.state.release(def.action);
    } else if (def.tapAction) {
      this._endTapHold(id);
    } else if (def.action) {
      this.state.release(def.action);
    }
  }

  /** Fold the held directions into the analogue axis the engine reads. */
  _applyAxis() {
    let x = 0;
    let y = 0;
    for (const id of this.held) {
      const def = BUTTONS.find((b) => b.id === id);
      if (!def?.dir) continue;
      x += def.dir[0];
      y += def.dir[1];
    }
    const sens = settings.values.touchSensitivity ?? 1;
    const clamp = (v) => Math.max(-1, Math.min(1, v * sens));
    this.state.setAxis(clamp(x), clamp(y));
  }

  _onDown = (e) => {
    if (!this.enabled) return;
    e.preventDefault();
    if (this.editable) return;   // the layout editor installs its own handlers

    const btn = this._hitButton(e.clientX, e.clientY);
    if (!btn) return;
    // One pointer owns one button: a second finger elsewhere cannot steal it.
    this.pointers.set(e.pointerId, { id: btn });
    this._press(btn);
    capture(this.el, e.pointerId);
  };

  _onMove = (e) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    // Sliding off a button releases it; sliding onto another presses it.
    const over = this._hitButton(e.clientX, e.clientY);
    if (over === p.id) return;
    this._release(p.id);
    if (over) {
      p.id = over;
      this._press(over);
    } else {
      this.pointers.delete(e.pointerId);
    }
  };

  _onUp = (e) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault?.();
    this.pointers.delete(e.pointerId);
    this._release(p.id);
    try { this.el.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
  };

  /** Release everything (pause, round end, screen change). */
  releaseAll() {
    for (const [, p] of this.pointers) this._release(p.id);
    this.pointers.clear();
    this.held.clear();
    // A pending hold timer must not fire into a match that has moved on.
    for (const [id, rec] of this._taps) {
      clearTimeout(rec.timer);
      this.buttons.get(id)?.classList.remove('is-holding');
      if (rec.holding) this.state.release(rec.def.holdAction);
    }
    this._taps.clear();
    this.state.setAxis(0, 0);
  }

  show() { this.el.hidden = false; this.layout(); }
  hide() { this.releaseAll(); this.el.hidden = true; }
}

export { BUTTONS };
