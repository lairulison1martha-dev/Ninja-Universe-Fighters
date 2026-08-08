/**
 * Settings manager.
 *
 * Settings live inside the save object (so export/import carries them) but are
 * accessed through this module, which also applies the side effects: body data
 * attributes, quality tuning and the control layout.
 */

import saveManager from './save-manager.js';
import { QUALITY_TUNING, FPS_TARGETS, LANGUAGES } from './constants.js';

/**
 * Bump when the control set itself changes shape. A stored layout from an
 * older version is replaced rather than merged: merging would keep stale
 * coordinates for buttons that still exist by name (guard, ultimate…) and
 * scatter the new cluster. Only the layout is reset — the rest of the save is
 * untouched.
 */
export const LAYOUT_VERSION = 2;

/**
 * Default control layout.
 *
 * `y` and `size` are fractions of the SAFE RECT's height. `dx` is an offset
 * from the anchored edge measured in those same height units, so each cluster
 * holds its shape on any aspect ratio instead of stretching across the screen.
 */
export function defaultLayout() {
  const MOVE = 0.150;   // the four directional buttons
  const ACT = 0.160;    // punch / kick / guard / jutsu / chakra
  const SPECIAL = 0.150; // awakening / ultimate
  return {
    v: LAYOUT_VERSION,
    buttons: {
      // Left: a four-way cross, centred at dx 0.300 / y 0.760.
      up:       { anchor: 'left', dx: 0.300, y: 0.603, size: MOVE },
      left:     { anchor: 'left', dx: 0.143, y: 0.760, size: MOVE },
      right:    { anchor: 'left', dx: 0.458, y: 0.760, size: MOVE },
      down:     { anchor: 'left', dx: 0.300, y: 0.918, size: MOVE },

      // Right: jutsu / guard above, chakra / punch / kick below.
      jutsu:    { anchor: 'right', dx: 0.303, y: 0.608, size: ACT },
      guard:    { anchor: 'right', dx: 0.135, y: 0.608, size: ACT },
      chakra:   { anchor: 'right', dx: 0.471, y: 0.800, size: ACT },
      light:    { anchor: 'right', dx: 0.303, y: 0.800, size: ACT },
      heavy:    { anchor: 'right', dx: 0.135, y: 0.800, size: ACT },

      // Top-right corner, deliberately far from the attack cluster.
      awaken:   { anchor: 'right', dx: 0.345, y: 0.115, size: SPECIAL },
      ultimate: { anchor: 'right', dx: 0.125, y: 0.115, size: SPECIAL },
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
      // A layout from an older control set is discarded, not merged: its
      // coordinates describe buttons that no longer exist in those places.
      this.values.layout = stored.layout?.v === LAYOUT_VERSION
        ? { v: LAYOUT_VERSION, buttons: { ...base.layout.buttons, ...(stored.layout.buttons || {}) } }
        : base.layout;
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
