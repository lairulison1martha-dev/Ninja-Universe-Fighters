/**
 * Audio manager.
 *
 * All audio is SYNTHESISED at runtime with the Web Audio API — nothing is
 * downloaded, so there is no third-party music or voice anywhere in the
 * project, and the offline cache stays tiny.
 *
 *   - Sound effects are short procedural one-shots rendered into AudioBuffers
 *     once and then played from a pool of buffer sources.
 *   - Music is a lightweight generative loop (bass + pad + arpeggio) driven by
 *     a scheduler, so each stage gets its own mood without any audio files.
 *   - iOS requires a user gesture before audio can start: `unlock()` is wired
 *     to the first pointerdown/keydown anywhere in the app.
 */

import settings from './settings-manager.js';

const SEMITONE = 2 ** (1 / 12);

/** Deterministic noise so a given effect always sounds the same. */
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/* Procedural SFX definitions                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Each recipe renders one mono buffer.
 * kind: 'noise' | 'tone' | 'sweep' | 'impact'
 */
const SFX = {
  sfx_ui_move:    { dur: 0.06, kind: 'tone',   freq: 620,  decay: 26, gain: 0.16, wave: 'triangle' },
  sfx_ui_select:  { dur: 0.14, kind: 'sweep',  from: 420,  to: 880,  decay: 14, gain: 0.22, wave: 'triangle' },
  sfx_ui_back:    { dur: 0.12, kind: 'sweep',  from: 660,  to: 320,  decay: 16, gain: 0.18, wave: 'triangle' },
  sfx_ui_error:   { dur: 0.20, kind: 'sweep',  from: 300,  to: 150,  decay: 10, gain: 0.24, wave: 'square' },
  sfx_hit_light:  { dur: 0.13, kind: 'impact', freq: 240,  decay: 34, gain: 0.42, noise: 0.7 },
  sfx_hit_heavy:  { dur: 0.28, kind: 'impact', freq: 110,  decay: 15, gain: 0.62, noise: 0.85 },
  sfx_block:      { dur: 0.14, kind: 'impact', freq: 900,  decay: 40, gain: 0.34, noise: 0.5 },
  sfx_guard_break:{ dur: 0.42, kind: 'sweep',  from: 900,  to: 120,  decay: 8,  gain: 0.5,  wave: 'sawtooth', noise: 0.4 },
  sfx_launch:     { dur: 0.30, kind: 'sweep',  from: 260,  to: 900,  decay: 9,  gain: 0.4,  wave: 'triangle' },
  sfx_jump:       { dur: 0.16, kind: 'sweep',  from: 300,  to: 620,  decay: 18, gain: 0.20, wave: 'sine' },
  sfx_dash:       { dur: 0.18, kind: 'noise',  decay: 22, gain: 0.28, tilt: 2400 },
  sfx_land:       { dur: 0.16, kind: 'impact', freq: 90,   decay: 28, gain: 0.3, noise: 0.6 },
  sfx_charge:     { dur: 0.60, kind: 'sweep',  from: 160,  to: 520,  decay: 3,  gain: 0.24, wave: 'sawtooth' },
  sfx_jutsu_melee:{ dur: 0.36, kind: 'impact', freq: 180,  decay: 11, gain: 0.55, noise: 0.6 },
  sfx_jutsu_ranged:{dur: 0.34, kind: 'sweep',  from: 780,  to: 220,  decay: 10, gain: 0.45, wave: 'sawtooth', noise: 0.3 },
  sfx_jutsu_area: { dur: 0.55, kind: 'noise',  decay: 6,  gain: 0.5,  tilt: 900 },
  sfx_ultimate:   { dur: 1.10, kind: 'sweep',  from: 90,   to: 720,  decay: 2.4, gain: 0.62, wave: 'sawtooth', noise: 0.35 },
  sfx_transform:  { dur: 0.90, kind: 'sweep',  from: 200,  to: 1400, decay: 3,  gain: 0.5,  wave: 'triangle', noise: 0.2 },
  sfx_substitute: { dur: 0.26, kind: 'noise',  decay: 16, gain: 0.34, tilt: 3200 },
  sfx_teleport:   { dur: 0.22, kind: 'sweep',  from: 1400, to: 300,  decay: 18, gain: 0.30, wave: 'sine' },
  sfx_summon:     { dur: 0.55, kind: 'impact', freq: 70,   decay: 8,  gain: 0.55, noise: 0.75 },
  sfx_heal:       { dur: 0.60, kind: 'sweep',  from: 520,  to: 1040, decay: 5,  gain: 0.26, wave: 'sine' },
  sfx_absorb:     { dur: 0.40, kind: 'sweep',  from: 900,  to: 180,  decay: 7,  gain: 0.30, wave: 'sine' },
  sfx_genjutsu:   { dur: 0.80, kind: 'sweep',  from: 340,  to: 90,   decay: 3,  gain: 0.32, wave: 'sine' },
  sfx_ko:         { dur: 0.90, kind: 'impact', freq: 60,   decay: 4,  gain: 0.7,  noise: 0.9 },
  sfx_round_start:{ dur: 0.50, kind: 'sweep',  from: 440,  to: 880,  decay: 6,  gain: 0.35, wave: 'square' },
  sfx_victory:    { dur: 1.00, kind: 'chord',  root: 392,  gain: 0.30 },
  sfx_defeat:     { dur: 1.20, kind: 'chord',  root: 196,  minor: true, gain: 0.28 },
  sfx_unlock:     { dur: 0.70, kind: 'chord',  root: 523,  gain: 0.30 },
};

/** Music moods — a few notes and a tempo, combined generatively. */
const MUSIC = {
  bgm_menu:      { bpm: 84,  root: 55.00, scale: [0, 3, 5, 7, 10], pad: 0.30, arp: 0.16, drums: 0.0 },
  bgm_battle_a:  { bpm: 132, root: 61.74, scale: [0, 2, 3, 7, 8],  pad: 0.20, arp: 0.22, drums: 0.28 },
  bgm_battle_b:  { bpm: 124, root: 55.00, scale: [0, 2, 5, 7, 9],  pad: 0.24, arp: 0.20, drums: 0.26 },
  bgm_battle_c:  { bpm: 142, root: 51.91, scale: [0, 1, 5, 7, 10], pad: 0.18, arp: 0.24, drums: 0.32 },
  bgm_battle_d:  { bpm: 150, root: 46.25, scale: [0, 1, 3, 6, 8],  pad: 0.22, arp: 0.26, drums: 0.34 },
  bgm_results:   { bpm: 96,  root: 65.41, scale: [0, 4, 7, 9, 11], pad: 0.32, arp: 0.18, drums: 0.10 },
};

/* -------------------------------------------------------------------------- */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.unlocked = false;
    this.buffers = new Map();
    this.buses = null;
    this.currentMusic = null;
    this._musicNodes = [];
    this._schedulerId = null;
    this._nextNoteTime = 0;
    this._step = 0;
    this._lastPlayed = new Map();
    this.failed = false;
  }

  /** Create the context lazily; safe to call before any gesture. */
  init() {
    if (this.ctx || this.failed) return this.ready;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) { this.failed = true; return false; }
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      this.failed = true;
      return false;
    }

    const master = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(this.ctx.destination);
    master.connect(comp);

    const mk = () => { const g = this.ctx.createGain(); g.connect(master); return g; };
    this.buses = { master, music: mk(), sfx: mk(), voice: mk() };
    this.applyVolumes();
    this.ready = true;
    return true;
  }

  /** Must be called from a user gesture on iOS. */
  async unlock() {
    if (!this.init()) return false;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* ignore */ }
    }
    if (!this.unlocked) {
      // A one-sample silent buffer satisfies Safari's gesture requirement.
      const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      s.connect(this.ctx.destination);
      s.start(0);
      this.unlocked = true;
      this._renderAll();
    }
    return this.ctx.state === 'running';
  }

  applyVolumes() {
    if (!this.buses) return;
    const s = settings.values;
    const m = s.muted ? 0 : s.masterVolume;
    const t = this.ctx.currentTime;
    this.buses.master.gain.setTargetAtTime(m, t, 0.02);
    this.buses.music.gain.setTargetAtTime(s.musicVolume, t, 0.02);
    this.buses.sfx.gain.setTargetAtTime(s.sfxVolume, t, 0.02);
    this.buses.voice.gain.setTargetAtTime(s.voiceVolume, t, 0.02);
  }

  /* --------------------------------------------------------- SFX render -- */

  _renderAll() {
    for (const id of Object.keys(SFX)) {
      if (!this.buffers.has(id)) {
        try { this.buffers.set(id, this._render(id, SFX[id])); } catch (err) {
          console.warn('[audio] failed to render', id, err);
        }
      }
    }
  }

  _render(id, rec) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rec.dur * sr));
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const rng = makeRng(id.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 7));

    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * (rec.decay ?? 12));
      let v = 0;

      switch (rec.kind) {
        case 'tone':
          v = osc(rec.wave, rec.freq * t);
          break;
        case 'sweep': {
          const p = t / rec.dur;
          const f = rec.from * Math.pow(rec.to / rec.from, p);
          v = osc(rec.wave, f * t);
          if (rec.noise) v = v * (1 - rec.noise) + (rng() * 2 - 1) * rec.noise;
          break;
        }
        case 'noise': {
          const n = rng() * 2 - 1;
          const a = Math.min(1, (rec.tilt || 1200) / (sr * 0.5));
          lp += a * (n - lp);
          v = lp * 2.2;
          break;
        }
        case 'impact': {
          const f = rec.freq * (1 + 4 * Math.exp(-t * 40));
          const body = Math.sin(2 * Math.PI * f * t);
          const n = rng() * 2 - 1;
          lp += 0.35 * (n - lp);
          v = body * (1 - (rec.noise || 0)) + lp * (rec.noise || 0) * 2;
          break;
        }
        case 'chord': {
          const r = rec.root;
          const third = rec.minor ? r * Math.pow(SEMITONE, 3) : r * Math.pow(SEMITONE, 4);
          const fifth = r * Math.pow(SEMITONE, 7);
          const oct = r * 2;
          // simple arpeggio-in, then sustain
          const stagger = (f, delay) => (t < delay ? 0 : Math.sin(2 * Math.PI * f * (t - delay)) * Math.exp(-(t - delay) * 3.2));
          v = 0.32 * (stagger(r, 0) + stagger(third, 0.09) + stagger(fifth, 0.18) + stagger(oct, 0.27));
          break;
        }
        default:
          v = 0;
      }

      // short fade-in/out to avoid clicks
      const fade = Math.min(1, i / 64) * Math.min(1, (len - i) / 128);
      out[i] = clamp(v * env * (rec.gain ?? 0.4) * fade);
    }
    return buf;
  }

  /* ------------------------------------------------------------- playback -- */

  /**
   * @param {string} id
   * @param {{ volume?: number, rate?: number, pan?: number, bus?: 'sfx'|'voice'|'music', throttle?: number }} [opts]
   */
  play(id, opts = {}) {
    if (!this.ready || !this.unlocked || this.ctx.state !== 'running') return null;

    // Missing-audio fallback: never throw, just use a neutral hit.
    let buf = this.buffers.get(id);
    if (!buf) {
      buf = this.buffers.get('sfx_hit_light');
      if (!buf) return null;
    }

    // Pooling guard: don't stack more than one of the same sound per few ms.
    const now = this.ctx.currentTime;
    const throttle = opts.throttle ?? 0.022;
    if (now - (this._lastPlayed.get(id) || -1) < throttle) return null;
    this._lastPlayed.set(id, now);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;

    const gain = this.ctx.createGain();
    gain.gain.value = opts.volume ?? 1;

    let node = gain;
    if (opts.pan !== undefined && this.ctx.createStereoPanner) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, opts.pan));
      gain.connect(pan);
      node = pan;
    }

    src.connect(gain);
    node.connect(this.buses[opts.bus || 'sfx']);
    src.start();
    src.onended = () => { try { src.disconnect(); gain.disconnect(); } catch { /* already gone */ } };
    return src;
  }

  /* --------------------------------------------------------------- music -- */

  playMusic(id) {
    if (!this.ready || !this.unlocked) { this.currentMusic = id; return; }
    if (this.currentMusic === id && this._schedulerId) return;
    this.stopMusic();
    const rec = MUSIC[id] || MUSIC.bgm_menu;
    this.currentMusic = id;
    this._music = rec;
    this._step = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.08;
    this._schedulerId = setInterval(() => this._scheduleMusic(), 60);
  }

  stopMusic() {
    if (this._schedulerId) { clearInterval(this._schedulerId); this._schedulerId = null; }
    for (const n of this._musicNodes) { try { n.stop?.(); n.disconnect?.(); } catch { /* gone */ } }
    this._musicNodes = [];
    this.currentMusic = null;
  }

  _scheduleMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const rec = this._music;
    const spb = 60 / rec.bpm / 2; // eighth notes
    const horizon = this.ctx.currentTime + 0.35;
    let guard = 0;
    while (this._nextNoteTime < horizon && guard++ < 32) {
      this._emitStep(this._step, this._nextNoteTime, rec, spb);
      this._nextNoteTime += spb;
      this._step++;
    }
  }

  _emitStep(step, when, rec, spb) {
    const bar = Math.floor(step / 16);
    const beat = step % 16;
    const scale = rec.scale;
    const rng = makeRng(step * 2654435761 + bar * 40503);

    // Bass on beats 0, 6, 10
    if (beat === 0 || beat === 6 || beat === 10) {
      const deg = scale[(bar + (beat === 6 ? 2 : 0)) % scale.length];
      this._note(rec.root * Math.pow(SEMITONE, deg), when, spb * 1.6, 0.24, 'sawtooth', 220);
    }
    // Pad every bar
    if (beat === 0 && rec.pad > 0) {
      const deg = scale[bar % scale.length];
      const f = rec.root * 4 * Math.pow(SEMITONE, deg);
      this._note(f, when, spb * 14, rec.pad * 0.16, 'sine', 900);
      this._note(f * Math.pow(SEMITONE, 7), when, spb * 14, rec.pad * 0.11, 'sine', 900);
    }
    // Arpeggio
    if (rec.arp > 0 && beat % 2 === 0) {
      const deg = scale[(step + bar) % scale.length];
      const f = rec.root * 8 * Math.pow(SEMITONE, deg);
      this._note(f, when, spb * 0.9, rec.arp * 0.10, 'triangle', 3200);
    }
    // Percussion
    if (rec.drums > 0) {
      if (beat % 8 === 0) this._perc(when, 0.05, rec.drums * 0.55, 70);
      if (beat % 8 === 4) this._perc(when, 0.09, rec.drums * 0.38, 1800);
      if (beat % 2 === 1 && rng() > 0.55) this._perc(when, 0.03, rec.drums * 0.16, 6000);
    }
  }

  _note(freq, when, dur, gain, wave, cutoff) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = wave;
    osc.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(f); f.connect(g); g.connect(this.buses.music);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    osc.onended = () => { try { osc.disconnect(); f.disconnect(); g.disconnect(); } catch { /* gone */ } };
    this._musicNodes.push(osc);
    if (this._musicNodes.length > 64) this._musicNodes.splice(0, 32);
  }

  _perc(when, dur, gain, cutoff) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(dur * ctx.sampleRate));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const rng = makeRng(Math.floor(when * 1000) + cutoff);
    for (let i = 0; i < len; i++) d[i] = (rng() * 2 - 1) * Math.exp(-i / len * 6);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = cutoff < 200 ? 'lowpass' : 'bandpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.buses.music);
    src.start(when);
    src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch { /* gone */ } };
  }

  /** Duck the music briefly (used for ultimates). */
  duck(amount = 0.35, seconds = 1.2) {
    if (!this.ready) return;
    const g = this.buses.music.gain;
    const t = this.ctx.currentTime;
    const target = settings.values.musicVolume;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target * amount, t + 0.06);
    g.linearRampToValueAtTime(target, t + seconds);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  /** Preload: rendering all buffers up front so combat never stutters. */
  async preload(onProgress) {
    this.init();
    if (!this.ctx) return false;
    const ids = Object.keys(SFX);
    for (let i = 0; i < ids.length; i++) {
      if (!this.buffers.has(ids[i])) {
        try { this.buffers.set(ids[i], this._render(ids[i], SFX[ids[i]])); } catch { /* skip */ }
      }
      onProgress?.((i + 1) / ids.length);
    }
    return true;
  }

  get sfxIds() { return Object.keys(SFX); }
  get musicIds() { return Object.keys(MUSIC); }
}

function osc(wave, phase) {
  const p = phase % 1;
  switch (wave) {
    case 'square': return p < 0.5 ? 1 : -1;
    case 'sawtooth': return p * 2 - 1;
    case 'triangle': return 1 - 4 * Math.abs(p - 0.5);
    default: return Math.sin(2 * Math.PI * phase);
  }
}
function clamp(v) { return v > 1 ? 1 : v < -1 ? -1 : v; }

export const audio = new AudioManager();
export default audio;
