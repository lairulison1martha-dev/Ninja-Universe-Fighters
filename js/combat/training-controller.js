/**
 * Training mode controller.
 *
 * Wraps the engine with dummy behaviour, resource overrides, reset controls and
 * the on-screen readout (damage, combo, frame data, input display).
 */

import saveManager from '../save-manager.js';
import { STATE } from './fighter-state.js';

export const DUMMY_MODES = [
  { id: 'stationary', label: 'Stationary' },
  { id: 'guard', label: 'Guarding' },
  { id: 'counter', label: 'Counter-attacking' },
  { id: 'jump', label: 'Jumping' },
  { id: 'ai', label: 'Full AI' },
];

export class TrainingController {
  /** @param {import('./combat-engine.js').CombatEngine} engine */
  constructor(engine) {
    this.engine = engine;
    this.settings = { ...saveManager.data.training };
    this.elapsed = 0;
    this.lastCombo = 0;
    this.history = [];
    this.apply();
  }

  apply() {
    const e = this.engine;
    e.trainingSettings = {
      infiniteHealth: this.settings.infiniteHealth,
      infiniteChakra: this.settings.infiniteChakra,
      infiniteSubstitution: this.settings.infiniteSubstitution,
      dummyInfiniteHealth: true,
      dummy: this.settings.dummy,
    };
    e.applyTrainingSettings();
  }

  set(key, value) {
    this.settings[key] = value;
    saveManager.update((d) => { d.training[key] = value; });
    this.apply();
  }

  reset() {
    this.engine.resetPositions();
    this.history.length = 0;
    this.lastCombo = 0;
  }

  update(dt) {
    this.elapsed += dt;
    // Track total training time for the achievement.
    if (this.elapsed >= 1) {
      const secs = Math.floor(this.elapsed);
      this.elapsed -= secs;
      saveManager.update((d) => { d.stats.trainingSeconds = (d.stats.trainingSeconds || 0) + secs; });
    }

    // Record each completed combo so the readout shows the last one.
    const p = this.engine.player;
    if (p.combo.hits === 0 && this.lastCombo > 0) {
      this.history.unshift({ hits: this.lastCombo, damage: Math.round(this.lastComboDamage || 0) });
      if (this.history.length > 5) this.history.pop();
      this.lastCombo = 0;
    } else if (p.combo.hits > 0) {
      this.lastCombo = p.combo.hits;
      this.lastComboDamage = p.combo.damage;
    }

    // Keep the dummy alive and standing.
    const e = this.engine.enemy;
    if (e.isDead) {
      e.isDead = false;
      e.health = e.maxHealth;
      e.setState(STATE.IDLE);
    }
  }

  /** Text block for the on-screen readout. */
  readout(inputState) {
    const p = this.engine.player;
    const e = this.engine.enemy;
    const t = this.engine.trainingData || {};
    const lines = [];
    lines.push(`Combo <b>${p.combo.hits}</b> · Damage <b>${Math.round(p.combo.damage)}</b>`);
    if (this.history.length) {
      lines.push(`Last: ${this.history.map((h) => `${h.hits}h/${h.damage}`).join('  ')}`);
    }
    if (this.settings.showFrameData) {
      lines.push(`Move: <b>${t.lastMove || '-'}</b>  (s/a/r ${t.frameData || '-'})`);
    }
    lines.push(`Chakra <b>${Math.round(p.chakra)}</b> · Guard <b>${Math.round(p.guard)}</b> · Sub <b>${p.subStocks}</b>`);
    lines.push(`Awakening <b>${Math.round(p.awakening)}%</b> · Dummy HP <b>${Math.round(e.health)}</b>`);
    if (this.settings.showInputs && inputState) {
      const recent = inputState.log.slice(-6).map((l) => (l.type === 'press' ? l.action : '')).filter(Boolean);
      lines.push(`Inputs: ${recent.join(' ') || '-'}`);
    }
    return lines.join('<br>');
  }
}

export default TrainingController;
