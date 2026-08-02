/**
 * Survival: continuous waves, limited healing, escalating difficulty.
 */

import { SURVIVAL_CONFIG } from './data/arcade.js';
import { FIGHTER_ORDER, FIGHTERS } from './data/fighters.js';
import saveManager from './save-manager.js';
import progression from './progression-manager.js';

class SurvivalManager extends EventTarget {
  constructor() {
    super();
    this.run = null;
  }

  start(playerId) {
    this.run = {
      playerId,
      wave: 0,
      score: 0,
      healthCarry: 1,
      pool: FIGHTER_ORDER.filter((id) => FIGHTERS[id].rank !== 'beast'),
    };
    saveManager.update((d) => { d.survival.runs = (d.survival.runs || 0) + 1; });
    return this.currentMatch();
  }

  difficultyForWave(wave) {
    let d = 'easy';
    for (const step of SURVIVAL_CONFIG.difficultyByWave) {
      if (wave >= step.from) d = step.difficulty;
    }
    return d;
  }

  currentMatch() {
    const run = this.run;
    if (!run) return null;
    const idx = (run.wave * 2654435761) >>> 0;
    const opponentId = run.pool[idx % run.pool.length];
    const stages = SURVIVAL_CONFIG.stagePool;
    return {
      playerId: run.playerId,
      opponentId,
      stageId: stages[run.wave % stages.length],
      difficulty: this.difficultyForWave(run.wave),
      rounds: 1,
      opponentHealthBonus: run.wave * SURVIVAL_CONFIG.healthRampPerWave,
      startHealth: run.healthCarry,
      mode: 'survival',
      label: `Wave ${run.wave + 1}`,
    };
  }

  /** @returns {{ done: boolean, next: Object|null, wave: number, score: number, record: boolean }} */
  reportResult(won, playerHealthFraction) {
    const run = this.run;
    if (!run) return { done: true, next: null, wave: 0, score: 0, record: false };

    if (!won) {
      const record = run.wave > (saveManager.data.survival.bestWave || 0);
      saveManager.update((d) => {
        d.survival.bestWave = Math.max(d.survival.bestWave || 0, run.wave);
        d.survival.bestScore = Math.max(d.survival.bestScore || 0, run.score);
      });
      progression.grantRewards({ coins: Math.round(run.score * 0.5), xp: Math.round(run.score * 0.4) });
      saveManager.save();
      const out = { done: true, next: null, wave: run.wave, score: run.score, record };
      this.run = null;
      return out;
    }

    run.wave++;
    run.score += SURVIVAL_CONFIG.scorePerWin
      + Math.round(playerHealthFraction * 100 * (SURVIVAL_CONFIG.scorePerHealthPercent / 100) * 100) / 100;
    run.healthCarry = Math.min(1, playerHealthFraction + SURVIVAL_CONFIG.healPerWin);
    return { done: false, next: this.currentMatch(), wave: run.wave, score: run.score, record: false };
  }

  abandon() { this.run = null; }

  get records() {
    return {
      bestWave: saveManager.data.survival.bestWave || 0,
      bestScore: Math.round(saveManager.data.survival.bestScore || 0),
      runs: saveManager.data.survival.runs || 0,
    };
  }
}

export const survival = new SurvivalManager();
export default survival;
