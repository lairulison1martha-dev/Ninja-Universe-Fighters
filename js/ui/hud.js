/**
 * Combat HUD.
 *
 * DOM updates during a match are kept minimal: values are cached and only
 * written when they actually change, so there is no layout thrash per frame.
 */

import { COMBAT } from '../constants.js';
import { formLabel, formProgress } from '../combat/transformation-system.js';
import { substitutionProgress } from '../combat/substitution-system.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      root: $('hud'),
      timer: $('hud-timer'),
      round: $('hud-round'),
      combo: $('hud-combo'),
      comboN: $('hud-combo-n'),
      comboDmg: $('hud-combo-dmg'),
      training: $('hud-training'),
      conditions: $('hud-conditions'),
    };
    this.sides = [1, 2].map((n) => ({
      name: $(`hud-name-p${n}`),
      health: $(`hud-health-p${n}`),
      healthLag: $(`hud-healthlag-p${n}`),
      chakra: $(`hud-chakra-p${n}`),
      guard: $(`hud-guard-p${n}`),
      awaken: $(`hud-awaken-p${n}`),
      subs: $(`hud-subs-p${n}`),
      rounds: $(`hud-rounds-p${n}`),
      form: $(`hud-form-p${n}`),
    }));
    this.cache = [{}, {}];
    this.lastTimer = -1;
    this.lastCombo = -1;
  }

  bind(engine) {
    this.engine = engine;
    const [a, b] = engine.fighters;
    this.sides[0].name.textContent = a.name;
    this.sides[1].name.textContent = b.name;
    this.cache = [{}, {}];
    this.lastTimer = -1;
    this.lastCombo = -1;

    this.el.round.textContent = engine.maxRounds > 1 ? `Round ${engine.round}` : 'Single round';
    this.el.conditions.innerHTML = '';
    for (const c of engine.conditions) {
      const s = document.createElement('span');
      s.textContent = c.label;
      this.el.conditions.appendChild(s);
    }
    this.el.training.hidden = !engine.isTraining;
  }

  setScale(el, value) {
    el.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
  }

  update() {
    const e = this.engine;
    if (!e) return;

    // Timer
    if (e.roundTime > 0) {
      const t = Math.ceil(e.roundClock);
      if (t !== this.lastTimer) {
        this.lastTimer = t;
        this.el.timer.textContent = String(t);
        this.el.timer.classList.toggle('is-low', t <= 10);
      }
    } else if (this.lastTimer !== -2) {
      this.lastTimer = -2;
      this.el.timer.textContent = '∞';
    }

    const roundLabel = e.maxRounds > 1 ? `Round ${e.round}` : 'Single round';
    if (this.el.round.textContent !== roundLabel) this.el.round.textContent = roundLabel;

    e.fighters.forEach((f, i) => {
      const s = this.sides[i];
      const c = this.cache[i];

      const hp = f.health / f.maxHealth;
      if (Math.abs((c.hp ?? -1) - hp) > 0.002) { c.hp = hp; this.setScale(s.health, hp); }
      const lag = f.displayHealth / f.maxHealth;
      if (Math.abs((c.lag ?? -1) - lag) > 0.004) { c.lag = lag; this.setScale(s.healthLag, lag); }

      const ck = f.chakra / COMBAT.chakraMax;
      if (Math.abs((c.ck ?? -1) - ck) > 0.004) { c.ck = ck; this.setScale(s.chakra, ck); }

      const gd = f.guard / COMBAT.guardMax;
      if (Math.abs((c.gd ?? -1) - gd) > 0.004) { c.gd = gd; this.setScale(s.guard, gd); }

      const aw = Math.round(f.awakening);
      if (c.aw !== aw) {
        c.aw = aw;
        s.awaken.textContent = `${aw}%`;
        s.awaken.classList.toggle('is-ready', aw >= 100);
      }

      const subText = '◆'.repeat(f.subStocks) + '◇'.repeat(Math.max(0, f.maxSubStocks - f.subStocks));
      if (c.sub !== subText) { c.sub = subText; s.subs.textContent = subText; }

      const wins = e.roundWins[i] || 0;
      const winText = '●'.repeat(wins);
      if (c.win !== winText) { c.win = winText; s.rounds.textContent = winText; }

      const form = f.form ? `${formLabel(f)} ${Math.round(formProgress(f) * 100)}%` : '';
      if (c.form !== form) { c.form = form; s.form.textContent = form; }
      void substitutionProgress;
    });

    // Combo counter (player only)
    const combo = e.player.combo.hits;
    if (combo !== this.lastCombo) {
      this.lastCombo = combo;
      if (combo >= 2) {
        this.el.combo.hidden = false;
        this.el.comboN.textContent = String(combo);
        this.el.comboDmg.textContent = `${Math.round(e.player.combo.damage)} dmg`;
      } else {
        this.el.combo.hidden = true;
      }
    }
  }

  setTraining(html) {
    if (!this.el.training) return;
    this.el.training.hidden = !html;
    if (html) this.el.training.innerHTML = html;
  }

  show() { this.el.root.hidden = false; }
  hide() { this.el.root.hidden = true; }
}

export default HUD;
