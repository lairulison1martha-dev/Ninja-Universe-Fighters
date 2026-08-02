/**
 * Input manager.
 *
 * A single abstract input state that the combat engine reads, fed by three
 * sources: on-screen touch controls (primary), keyboard (desktop testing) and
 * the Gamepad API (structure in place, polled each frame).
 *
 * Presses are BUFFERED: a press stays consumable for COMBAT.inputBufferTime so
 * a tap made a few frames early during recovery still comes out.
 */

import { COMBAT } from './constants.js';

export const ACTIONS = [
  'light', 'heavy', 'jutsu1', 'jutsu2', 'jutsu3', 'ultimate',
  'guard', 'substitution', 'awaken', 'assist',
  'jump', 'dash', 'pause',
];

const KEY_MAP = {
  KeyJ: 'light', KeyK: 'heavy', KeyU: 'jutsu1', KeyI: 'jutsu2', KeyY: 'jutsu3',
  KeyO: 'ultimate', KeyL: 'guard', Semicolon: 'substitution',
  KeyP: 'awaken', KeyH: 'assist', Space: 'jump', ShiftLeft: 'dash',
  ShiftRight: 'dash', Escape: 'pause',
};
const AXIS_KEYS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};

/** One player's input state. */
export class InputState {
  constructor() {
    this.axis = { x: 0, y: 0 };
    this.held = new Set();
    /** action -> timestamp (seconds) of the buffered press */
    this.buffer = new Map();
    /** action -> timestamp when it was pressed, for hold detection */
    this.pressedAt = new Map();
    this.enabled = true;
    this.time = 0;
    /** Rolling log for the training-mode input display. */
    this.log = [];
  }

  press(action) {
    if (!this.enabled || !ACTIONS.includes(action)) return;
    if (!this.held.has(action)) {
      this.held.add(action);
      this.pressedAt.set(action, this.time);
      this.buffer.set(action, this.time);
      this.log.push({ action, t: this.time, type: 'press' });
      if (this.log.length > 24) this.log.shift();
    }
  }

  release(action) {
    this.held.delete(action);
    this.pressedAt.delete(action);
    if (this.enabled) {
      this.log.push({ action, t: this.time, type: 'release' });
      if (this.log.length > 24) this.log.shift();
    }
  }

  setAxis(x, y) {
    if (!this.enabled) return;
    this.axis.x = x;
    this.axis.y = y;
  }

  /** True if the action was pressed recently and has not been consumed. */
  peek(action) {
    const t = this.buffer.get(action);
    return t !== undefined && this.time - t <= COMBAT.inputBufferTime;
  }

  /** Consume a buffered press. */
  consume(action) {
    if (!this.peek(action)) return false;
    this.buffer.delete(action);
    return true;
  }

  isHeld(action) { return this.held.has(action); }

  holdTime(action) {
    const t = this.pressedAt.get(action);
    return t === undefined ? 0 : this.time - t;
  }

  /** Advance the clock and expire stale buffered presses. */
  tick(dt) {
    this.time += dt;
    for (const [action, t] of this.buffer) {
      if (this.time - t > COMBAT.inputBufferTime) this.buffer.delete(action);
    }
  }

  clear() {
    this.axis.x = 0;
    this.axis.y = 0;
    this.held.clear();
    this.buffer.clear();
    this.pressedAt.clear();
  }
}

class InputManager {
  constructor() {
    this.p1 = new InputState();
    this.p2 = new InputState();   // reserved for local versus / debug
    this.keyboardTarget = this.p1;
    this.gamepadIndex = null;
    this._keyAxis = new Set();
    this._bound = false;
    this._gamepadPrev = new Map();
  }

  init() {
    if (this._bound) return;
    this._bound = true;

    globalThis.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const action = KEY_MAP[e.code];
      if (action) { this.keyboardTarget.press(action); e.preventDefault(); }
      if (AXIS_KEYS[e.code]) { this._keyAxis.add(e.code); this._applyKeyAxis(); e.preventDefault(); }
    });

    globalThis.addEventListener('keyup', (e) => {
      const action = KEY_MAP[e.code];
      if (action) this.keyboardTarget.release(action);
      if (AXIS_KEYS[e.code]) { this._keyAxis.delete(e.code); this._applyKeyAxis(); }
    });

    // Losing focus must not leave a key stuck down.
    globalThis.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });

    globalThis.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
    });
    globalThis.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null;
    });
  }

  _applyKeyAxis() {
    let x = 0; let y = 0;
    for (const code of this._keyAxis) {
      const [ax, ay] = AXIS_KEYS[code];
      x += ax; y += ay;
    }
    this.keyboardTarget.setAxis(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
  }

  releaseAll() {
    this._keyAxis.clear();
    this.p1.clear();
    this.p2.clear();
  }

  /**
   * Gamepad polling. Structured so adding full remapping later is a data change
   * rather than a rewrite.
   */
  pollGamepads() {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    const pad = this.gamepadIndex !== null ? pads[this.gamepadIndex] : Array.from(pads).find(Boolean);
    if (!pad) return;

    const state = this.p1;
    const dz = 0.28;
    const ax = Math.abs(pad.axes[0] || 0) > dz ? pad.axes[0] : 0;
    const ay = Math.abs(pad.axes[1] || 0) > dz ? pad.axes[1] : 0;
    // D-pad (standard mapping buttons 12-15) overrides the stick when pressed.
    let dx = 0; let dy = 0;
    if (pad.buttons[14]?.pressed) dx = -1;
    if (pad.buttons[15]?.pressed) dx = 1;
    if (pad.buttons[12]?.pressed) dy = -1;
    if (pad.buttons[13]?.pressed) dy = 1;
    state.setAxis(dx || ax, dy || ay);

    const map = {
      0: 'light', 2: 'heavy', 1: 'jump', 3: 'jutsu1',
      4: 'guard', 5: 'dash', 6: 'substitution', 7: 'ultimate',
      8: 'assist', 9: 'pause', 10: 'awaken', 11: 'jutsu2',
    };
    for (const [idx, action] of Object.entries(map)) {
      const pressed = !!pad.buttons[idx]?.pressed;
      const key = `${pad.index}:${idx}`;
      const was = this._gamepadPrev.get(key) || false;
      if (pressed && !was) state.press(action);
      if (!pressed && was) state.release(action);
      this._gamepadPrev.set(key, pressed);
    }
  }

  tick(dt) {
    this.pollGamepads();
    this.p1.tick(dt);
    this.p2.tick(dt);
  }
}

export const input = new InputManager();
export default input;
