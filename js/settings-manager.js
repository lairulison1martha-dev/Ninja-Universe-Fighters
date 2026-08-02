/**
 * Settings manager.
 *
 * Settings live inside the save object (so export/import carries them) but are
 * accessed through this module, which also applies the side effects: body data
 * attributes, quality tuning and the control layout.
 */

import saveManager from './save-manager.js';
import { QUALITY_TUNING, FPS_TARGETS, LANGUAGES } from './constants.js';

/** Normalised default control layout (0..1 of the viewport). */
export function defaultLayout() {
  return {
    stick: { x: 0.135, y: 0.735, size: 0.30 },   // size is a fraction of viewport height
    buttons: {
      jump:         { x: 0.300, y: 0.640, size: 0.155 },
      dash:         { x: 0.285, y: 0.860, size: 0.155 },
      light:        { x: 0.845, y: 0.800, size: 0.175 },
      heavy:        { x: 0.925, y: 0.620, size: 0.175 },
      jutsu1:       { x: 0.740, y: 0.860, size: 0.150 },
      jutsu2:       { x: 0.700, y: 0.660, size: 0.150 },
      jutsu3:       { x: 0.598, y: 0.470, size: 0.140 },
      guard:        { x: 0.640, y: 0.870, size: 0.165 },
      substitution: { x: 0.585, y: 0.680, size: 0.140 },
      ultimate:     { x: 0.945, y: 0.400, size: 0.160 },
      awaken:       { x: 0.828, y: 0.400, size: 0.145 },
      assist:       { x: 0.712, y: 0.420, size: 0.130 },
    },
  };
}

export function defaultSettings() {
  return {
    // graphics
    quality: 'high',
    fpsTarget: 60,
    effects: 1.0,          // 0..1 multiplier on particle counts
    screenShake: 1.0,
    hitFlash: true,
    damageNumbers: true,
    backgroundEffects: 1.0, // menu background intensity, 0 disables
    dayNight: 'auto',       // auto | day | night

    // audio
    masterVolume: 0.9,
    musicVolume: 0.55,
    sfxVolume: 0.85,
    voiceVolume: 0.7,
    muted: false,

    // controls
    layout: defaultLayout(),
    controlOpacity: 0.82,
    controlScale: 1.0,
    joystickMode: 'fixed',  // fixed | floating
    joystickDeadzone: 0.16,
    joystickSensitivity: 1.0,
    touchSensitivity: 1.0,
    vibration: true,
    leftHanded: false,
    showTouchControls: 'auto', // auto | always | never

    // accessibility
    reducedMotion: false,
    highContrast: false,
    textSize: 'normal',     // small | normal | large | xlarge
    language: 'en',

    // gameplay defaults
    defaultRounds: 3,
    defaultTimer: 99,
    defaultDifficulty: 'normal',
    inputBuffer: true,
  };
}

class SettingsManager extends EventTarget {
  constructor() {
    super();
    this.values = defaultSettings();
  }

  load() {
    const stored = saveManager.data.settings;
    const base = defaultSettings();
    if (stored && typeof stored === 'object') {
      this.values = { ...base, ...stored };
      // nested objects need their own merge so new keys appear
      this.values.layout = {
        stick: { ...base.layout.stick, ...(stored.layout?.stick || {}) },
        buttons: { ...base.layout.buttons, ...(stored.layout?.buttons || {}) },
      };
    } else {
      this.values = base;
      // Respect the OS preference the first time only.
      if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        this.values.reducedMotion = true;
      }
    }
    saveManager.data.settings = this.values;
    this.apply();
    return this.values;
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    if (this.values[key] === value) return value;
    this.values[key] = value;
    saveManager.data.settings = this.values;
    saveManager.autosave();
    this.apply();
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
    return value;
  }

  setMany(patch) {
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (this.values[k] !== v) { this.values[k] = v; changed = true; }
    }
    if (!changed) return;
    saveManager.data.settings = this.values;
    saveManager.autosave();
    this.apply();
    this.dispatchEvent(new CustomEvent('change', { detail: patch }));
  }

  /** Persist the control layout (called by the layout editor). */
  setLayout(layout) {
    this.values.layout = layout;
    saveManager.data.settings = this.values;
    saveManager.autosave();
    this.dispatchEvent(new CustomEvent('change', { detail: { key: 'layout' } }));
  }

  resetLayout() {
    this.setLayout(defaultLayout());
  }

  /** Current quality tuning object. */
  get tuning() {
    return QUALITY_TUNING[this.values.quality] || QUALITY_TUNING.high;
  }

  /** Particle budget after the user's effects slider is applied. */
  get particleBudget() {
    return Math.round(this.tuning.maxParticles * this.values.effects);
  }

  /** Device pixel ratio to render at. */
  get renderScale() {
    const dpr = globalThis.devicePixelRatio || 1;
    return Math.min(dpr, this.tuning.dprCap);
  }

  /** Apply everything that lives outside JS state. */
  apply() {
    const b = document.body;
    if (!b) return;
    b.dataset.quality = this.values.quality;
    b.dataset.contrast = this.values.highContrast ? 'high' : 'normal';
    b.dataset.motion = this.values.reducedMotion ? 'reduced' : 'normal';
    b.dataset.textsize = this.values.textSize;
    document.documentElement.style.setProperty('--ctrl-opacity', String(this.values.controlOpacity));
    document.documentElement.lang = this.values.language;
  }

  /** Whether the on-screen controls should be shown right now. */
  shouldShowTouchControls() {
    const mode = this.values.showTouchControls;
    if (mode === 'always') return true;
    if (mode === 'never') return false;
    return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in globalThis;
  }

  vibrate(pattern) {
    if (!this.values.vibration) return;
    try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
  }

  get languages() { return LANGUAGES; }
  get fpsTargets() { return FPS_TARGETS; }
}

export const settings = new SettingsManager();
export default settings;
