/**
 * Particle / visual-effect pool.
 *
 * One flat pre-allocated array of particle records. Emitters write into free
 * slots; nothing is allocated during a match. The budget comes from the
 * quality setting, so low-end phones simply emit fewer particles rather than
 * running different code.
 */

import settings from '../settings-manager.js';

const MAX = 420;

/** Named emitter recipes. `effectId` on an ability picks one of these. */
export const EFFECT_RECIPES = {
  impact_default:  { count: 8,  speed: 260, life: 0.32, size: 5, color: '#ffe9a8', spread: 2.4, kind: 'spark' },
  impact_throw:    { count: 14, speed: 320, life: 0.4,  size: 6, color: '#ffd08a', spread: 3.1, kind: 'spark' },
  impact_counter:  { count: 12, speed: 300, life: 0.36, size: 5, color: '#a8dcff', spread: 3.1, kind: 'spark' },
  clone_flash:     { count: 10, speed: 200, life: 0.36, size: 6, color: '#ffd85e', spread: 3.1, kind: 'puff' },
  clone_explode:   { count: 20, speed: 380, life: 0.5,  size: 7, color: '#ffb066', spread: 3.14, kind: 'spark' },
  crow_burst:      { count: 16, speed: 300, life: 0.55, size: 6, color: '#2a2a38', spread: 3.14, kind: 'shard' },
  blade_arc:       { count: 6,  speed: 340, life: 0.22, size: 4, color: '#dff0ff', spread: 0.8, kind: 'streak' },
  lightning_impact:{ count: 12, speed: 420, life: 0.26, size: 4, color: '#a8e6ff', spread: 2.6, kind: 'streak' },
  chidori:         { count: 18, speed: 480, life: 0.30, size: 4, color: '#8fd8ff', spread: 3.1, kind: 'streak' },
  chidori_field:   { count: 26, speed: 520, life: 0.38, size: 5, color: '#8fd8ff', spread: 3.14, kind: 'streak' },
  purple_lightning:{ count: 22, speed: 560, life: 0.4,  size: 5, color: '#c08aff', spread: 3.14, kind: 'streak' },
  fire_burst:      { count: 16, speed: 300, life: 0.5,  size: 8, color: '#ff8a3c', spread: 3.14, kind: 'flame' },
  fire_stream:     { count: 22, speed: 420, life: 0.45, size: 9, color: '#ff6a20', spread: 0.7, kind: 'flame' },
  fire_fists:      { count: 20, speed: 380, life: 0.4,  size: 7, color: '#ffa04c', spread: 2.2, kind: 'flame' },
  amaterasu:       { count: 18, speed: 180, life: 0.9,  size: 9, color: '#1a1020', spread: 3.14, kind: 'flame' },
  water_burst:     { count: 16, speed: 320, life: 0.45, size: 7, color: '#4fb0ff', spread: 3.1, kind: 'puff' },
  sand_puff:       { count: 18, speed: 240, life: 0.55, size: 7, color: '#d8b271', spread: 3.14, kind: 'puff' },
  sand_shield:     { count: 22, speed: 160, life: 0.8,  size: 6, color: '#e0c07a', spread: 3.14, kind: 'orbit' },
  sand_coffin:     { count: 26, speed: 280, life: 0.6,  size: 8, color: '#d8b271', spread: 3.14, kind: 'puff' },
  earth_crack:     { count: 20, speed: 300, life: 0.55, size: 8, color: '#a8865a', spread: 2.0, kind: 'shard' },
  earth_wall:      { count: 16, speed: 220, life: 0.6,  size: 9, color: '#8a6c54', spread: 1.6, kind: 'shard' },
  wood_spikes:     { count: 18, speed: 260, life: 0.6,  size: 8, color: '#6a9a4a', spread: 2.0, kind: 'shard' },
  wood_forest:     { count: 30, speed: 220, life: 0.9,  size: 10, color: '#5f8a4a', spread: 3.14, kind: 'shard' },
  rasengan:        { count: 16, speed: 300, life: 0.34, size: 7, color: '#8fd4ff', spread: 3.14, kind: 'orbit' },
  rasengan_sage:   { count: 20, speed: 320, life: 0.4,  size: 8, color: '#f2c46a', spread: 3.14, kind: 'orbit' },
  rasengan_kurama: { count: 24, speed: 360, life: 0.45, size: 9, color: '#ffb020', spread: 3.14, kind: 'orbit' },
  rasengan_crimson:{ count: 22, speed: 340, life: 0.42, size: 9, color: '#ff5a7a', spread: 3.14, kind: 'orbit' },
  rasengan_vanish: { count: 14, speed: 300, life: 0.32, size: 7, color: '#7fd4ff', spread: 3.14, kind: 'orbit' },
  rasenshuriken:   { count: 26, speed: 420, life: 0.5,  size: 6, color: '#bfe9ff', spread: 3.14, kind: 'streak' },
  rasenshuriken_sixpaths: { count: 34, speed: 480, life: 0.6, size: 7, color: '#ffe9a8', spread: 3.14, kind: 'streak' },
  beast_bomb:      { count: 30, speed: 400, life: 0.7,  size: 12, color: '#ff5a2a', spread: 3.14, kind: 'flame' },
  beast_cloak:     { count: 22, speed: 280, life: 0.55, size: 8, color: '#8a6ad8', spread: 3.14, kind: 'puff' },
  baryon:          { count: 26, speed: 440, life: 0.4,  size: 6, color: '#ff5cc0', spread: 3.14, kind: 'streak' },
  kurama_flash:    { count: 20, speed: 400, life: 0.35, size: 6, color: '#ffd75a', spread: 3.14, kind: 'streak' },
  sage_impact:     { count: 14, speed: 300, life: 0.4,  size: 6, color: '#f2c46a', spread: 2.6, kind: 'spark' },
  sharingan_flash: { count: 10, speed: 180, life: 0.4,  size: 6, color: '#ff4a4a', spread: 3.14, kind: 'orbit' },
  rinnegan_swap:   { count: 14, speed: 260, life: 0.4,  size: 6, color: '#9a5aff', spread: 3.14, kind: 'orbit' },
  rinnegan_absorb: { count: 18, speed: -260, life: 0.5, size: 6, color: '#ff5aa0', spread: 3.14, kind: 'orbit' },
  susanoo_arc:     { count: 20, speed: 360, life: 0.45, size: 9, color: '#8a5aff', spread: 1.8, kind: 'streak' },
  indra_arrow:     { count: 34, speed: 620, life: 0.5,  size: 6, color: '#c08aff', spread: 0.5, kind: 'streak' },
  kirin:           { count: 34, speed: 560, life: 0.55, size: 6, color: '#a8e6ff', spread: 1.2, kind: 'streak' },
  tsukuyomi:       { count: 22, speed: 180, life: 0.9,  size: 8, color: '#c02a3a', spread: 3.14, kind: 'orbit' },
  infinite_tsukuyomi: { count: 36, speed: 240, life: 1.1, size: 10, color: '#c8b0ff', spread: 3.14, kind: 'orbit' },
  meteor:          { count: 30, speed: 420, life: 0.8,  size: 12, color: '#ff7a3c', spread: 3.14, kind: 'flame' },
  shinra_ring:     { count: 22, speed: 480, life: 0.4,  size: 7, color: '#c8a8ff', spread: 3.14, kind: 'ring' },
  chibaku_tensei:  { count: 34, speed: -320, life: 0.9, size: 8, color: '#8b6bd8', spread: 3.14, kind: 'orbit' },
  rod_spark:       { count: 10, speed: 300, life: 0.3,  size: 4, color: '#d8c05a', spread: 2.4, kind: 'spark' },
  six_paths:       { count: 26, speed: 340, life: 0.6,  size: 7, color: '#a08adc', spread: 3.14, kind: 'puff' },
  soul_pull:       { count: 18, speed: -240, life: 0.6, size: 6, color: '#a8c8ff', spread: 3.14, kind: 'orbit' },
  naraka:          { count: 20, speed: 200, life: 0.7,  size: 8, color: '#c85a5a', spread: 3.14, kind: 'puff' },
  gunbai_wind:     { count: 14, speed: 380, life: 0.3,  size: 6, color: '#e0e6f0', spread: 1.4, kind: 'streak' },
  limbo:           { count: 16, speed: 240, life: 0.5,  size: 7, color: '#5a5a7a', spread: 3.14, kind: 'puff' },
  tso:             { count: 16, speed: 220, life: 0.6,  size: 7, color: '#7a5bd8', spread: 3.14, kind: 'orbit' },
  karma_glow:      { count: 14, speed: 240, life: 0.45, size: 6, color: '#9a4aff', spread: 3.14, kind: 'orbit' },
  karma_beam:      { count: 22, speed: 500, life: 0.4,  size: 7, color: '#c78cff', spread: 0.6, kind: 'streak' },
  karma_rift:      { count: 26, speed: 300, life: 0.65, size: 9, color: '#b06ad8', spread: 3.14, kind: 'ring' },
  elemental_orbs:  { count: 20, speed: 320, life: 0.5,  size: 8, color: '#ff5aa0', spread: 3.14, kind: 'orbit' },
  gravity_crush:   { count: 30, speed: -360, life: 0.7, size: 9, color: '#ff6ac0', spread: 3.14, kind: 'ring' },
  flash_step:      { count: 12, speed: 420, life: 0.24, size: 5, color: '#ffe58a', spread: 3.14, kind: 'streak' },
  reaper_seal:     { count: 26, speed: 200, life: 1.0,  size: 9, color: '#8a2a4a', spread: 3.14, kind: 'puff' },
  gate_aura:       { count: 22, speed: 300, life: 0.5,  size: 7, color: '#ff3a2a', spread: 3.14, kind: 'flame' },
  daytime_tiger:   { count: 32, speed: 520, life: 0.6,  size: 10, color: '#7fe0ff', spread: 1.0, kind: 'ring' },
  night_guy:       { count: 40, speed: 700, life: 0.7,  size: 10, color: '#7fe0ff', spread: 0.8, kind: 'streak' },
  lotus_spiral:    { count: 24, speed: 380, life: 0.5,  size: 6, color: '#ffd0a0', spread: 3.14, kind: 'streak' },
  speed_lines:     { count: 12, speed: 460, life: 0.22, size: 4, color: '#ffffff', spread: 0.5, kind: 'streak' },
  dust_burst:      { count: 14, speed: 260, life: 0.45, size: 7, color: '#c8b89a', spread: 2.2, kind: 'puff' },
  snake_coil:      { count: 16, speed: 280, life: 0.5,  size: 7, color: '#8aa85a', spread: 3.14, kind: 'puff' },
  snake_shed:      { count: 20, speed: 240, life: 0.6,  size: 7, color: '#d8e0b0', spread: 3.14, kind: 'puff' },
  rashomon:        { count: 18, speed: 200, life: 0.7,  size: 10, color: '#8a5a3a', spread: 1.4, kind: 'shard' },
  edo_tensei:      { count: 24, speed: 220, life: 0.8,  size: 8, color: '#b0a890', spread: 3.14, kind: 'puff' },
  hair_needle:     { count: 18, speed: 420, life: 0.4,  size: 4, color: '#e8ddc0', spread: 1.2, kind: 'streak' },
  swamp:           { count: 22, speed: 160, life: 0.9,  size: 9, color: '#6a5a3a', spread: 3.14, kind: 'puff' },
  genjutsu_wave:   { count: 26, speed: 340, life: 0.7,  size: 8, color: '#a06ad8', spread: 3.14, kind: 'ring' },
  byakugo_heal:    { count: 18, speed: -200, life: 0.7, size: 6, color: '#ff9ab8', spread: 3.14, kind: 'orbit' },
  heal_glow:       { count: 14, speed: -180, life: 0.6, size: 6, color: '#8affc9', spread: 3.14, kind: 'orbit' },
  acid_wave:       { count: 18, speed: 280, life: 0.6,  size: 8, color: '#cfe9ff', spread: 1.6, kind: 'puff' },
  summon_dust:     { count: 20, speed: 300, life: 0.6,  size: 9, color: '#c8b89a', spread: 2.4, kind: 'puff' },
  missile_trail:   { count: 10, speed: 240, life: 0.35, size: 5, color: '#ff9a5a', spread: 1.2, kind: 'flame' },
  tool_spark:      { count: 12, speed: 340, life: 0.3,  size: 4, color: '#8ad4ff', spread: 2.0, kind: 'spark' },
  shadow_bind:     { count: 18, speed: 200, life: 0.7,  size: 7, color: '#2a2a3a', spread: 3.14, kind: 'puff' },
  kamui_warp:      { count: 18, speed: -320, life: 0.4, size: 6, color: '#b57bff', spread: 3.14, kind: 'orbit' },
  yata_shine:      { count: 16, speed: 220, life: 0.6,  size: 7, color: '#ffd88a', spread: 3.14, kind: 'orbit' },
  lightning_armour:{ count: 20, speed: 300, life: 0.5,  size: 5, color: '#c8e8ff', spread: 3.14, kind: 'streak' },
  wind_slash:      { count: 14, speed: 420, life: 0.3,  size: 6, color: '#d0f0ff', spread: 1.0, kind: 'streak' },
  ultimate_burst:  { count: 32, speed: 520, life: 0.6,  size: 9, color: '#ffe9a8', spread: 3.14, kind: 'ring' },
  ultimate_sixpaths: { count: 40, speed: 560, life: 0.7, size: 10, color: '#ffe9a8', spread: 3.14, kind: 'ring' },
  transform_flash: { count: 30, speed: 460, life: 0.6,  size: 8, color: '#ffffff', spread: 3.14, kind: 'ring' },
  // Reverting is the quieter mirror of transforming: it pulls inward rather
  // than bursting out, so the two read as opposite events at a glance.
  transform_revert: { count: 18, speed: 200, life: 0.45, size: 6, color: '#cfe8ff', spread: 3.14, kind: 'ring' },
  aura_charge:     { count: 8,  speed: -160, life: 0.5, size: 5, color: '#7fd4ff', spread: 3.14, kind: 'orbit' },
  guard_spark:     { count: 8,  speed: 240, life: 0.24, size: 4, color: '#8fefc0', spread: 2.0, kind: 'spark' },
  dust_land:       { count: 8,  speed: 180, life: 0.3,  size: 6, color: '#b8b0a0', spread: 1.0, kind: 'puff' },
  substitute_puff: { count: 16, speed: 300, life: 0.4,  size: 7, color: '#c8b89a', spread: 3.14, kind: 'puff' },
};

export class EffectPool {
  constructor() {
    this.p = new Array(MAX);
    for (let i = 0; i < MAX; i++) {
      this.p[i] = {
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, age: 0, size: 0, color: '#fff', kind: 'spark',
        gravity: 0, spin: 0, angle: 0, ox: 0, oy: 0, orbitR: 0,
      };
    }
    this.cursor = 0;
    /** Floating damage numbers use their own tiny pool. */
    this.numbers = new Array(24);
    for (let i = 0; i < 24; i++) {
      this.numbers[i] = { active: false, x: 0, y: 0, vy: 0, age: 0, life: 0, text: '', color: '#fff', size: 1 };
    }
  }

  _next() {
    for (let i = 0; i < MAX; i++) {
      const idx = (this.cursor + i) % MAX;
      if (!this.p[idx].active) { this.cursor = (idx + 1) % MAX; return this.p[idx]; }
    }
    const p = this.p[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    return p;
  }

  /**
   * @param {string} recipeId
   * @param {number} x world x
   * @param {number} y world y (positive up)
   * @param {{ scale?: number, color?: string, facing?: number, countScale?: number }} [opts]
   */
  emit(recipeId, x, y, opts = {}) {
    const rec = EFFECT_RECIPES[recipeId] || EFFECT_RECIPES.impact_default;
    const budget = settings.particleBudget;
    if (budget <= 0) return;
    const scale = opts.scale ?? 1;
    const countScale = (opts.countScale ?? 1) * Math.min(1, budget / 240);
    const count = Math.max(1, Math.round(rec.count * countScale));
    const facing = opts.facing ?? 1;

    for (let i = 0; i < count; i++) {
      const p = this._next();
      const a = (Math.random() - 0.5) * rec.spread + (rec.spread < 1.5 ? 0 : 0);
      const dir = rec.spread < 1.5 ? facing : 1;
      const speed = rec.speed * (0.5 + Math.random() * 0.7);
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 14 * scale;
      p.y = y + (Math.random() - 0.5) * 14 * scale;
      p.kind = rec.kind;
      p.color = opts.color || rec.color;
      p.size = rec.size * scale * (0.7 + Math.random() * 0.6);
      p.life = rec.life * (0.8 + Math.random() * 0.5);
      p.age = 0;
      p.angle = Math.atan2(Math.sin(a), Math.cos(a) * dir);
      p.spin = (Math.random() - 0.5) * 8;
      p.gravity = rec.kind === 'puff' || rec.kind === 'shard' ? 420 : 0;

      if (rec.kind === 'orbit' || rec.kind === 'ring') {
        p.ox = x; p.oy = y;
        p.orbitR = 10 + Math.random() * 30 * scale;
        p.vx = speed > 0 ? 5 + Math.random() * 4 : -(5 + Math.random() * 4);
        p.vy = 0;
      } else {
        p.vx = Math.cos(a) * speed * dir;
        p.vy = Math.sin(a) * speed;
      }
    }
  }

  /** Floating damage number. */
  number(x, y, text, color = '#ffe9a8', size = 1) {
    if (!settings.values.damageNumbers) return;
    const n = this.numbers.find((v) => !v.active) || this.numbers[0];
    n.active = true;
    n.x = x + (Math.random() - 0.5) * 24;
    n.y = y;
    n.vy = 150;
    n.age = 0;
    n.life = 0.85;
    n.text = text;
    n.color = color;
    n.size = size;
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = this.p[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) { p.active = false; continue; }
      if (p.kind === 'orbit' || p.kind === 'ring') {
        p.angle += p.vx * dt;
        p.orbitR += (p.kind === 'ring' ? 220 : 40) * dt;
        p.x = p.ox + Math.cos(p.angle) * p.orbitR;
        p.y = p.oy + Math.sin(p.angle) * p.orbitR * 0.7;
      } else {
        p.vy -= p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
      }
    }
    for (const n of this.numbers) {
      if (!n.active) continue;
      n.age += dt;
      if (n.age >= n.life) { n.active = false; continue; }
      n.y += n.vy * dt;
      n.vy -= 260 * dt;
    }
  }

  clear() {
    for (const p of this.p) p.active = false;
    for (const n of this.numbers) n.active = false;
  }

  get activeCount() {
    let n = 0;
    for (const p of this.p) if (p.active) n++;
    return n;
  }
}
