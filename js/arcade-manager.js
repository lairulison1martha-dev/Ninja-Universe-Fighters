/**
 * Arcade ladders and Boss Rush runs.
 *
 * A run is a small state machine held in memory; only records and clears are
 * persisted.
 */

import { ARCADE_LADDERS, BOSS_RUSHES } from './data/arcade.js';
import saveManager from './save-manager.js';
import progression from './progression-manager.js';
import { evaluateUnlock } from './data/unlocks.js';

function pickOpponent(entry, rng) {
  if (entry.pick === 'fixed') return entry.id;
  const pool = entry.pool;
  return pool[Math.floor(rng() * pool.length)];
}

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

class ArcadeManager extends EventTarget {
  constructor() {
    super();
    this.run = null;
  }

  ladders() {
    return ARCADE_LADDERS.map((l) => {
      const res = evaluateUnlock(l.unlockRequirement, saveManager.data);
      return {
        ...l,
        unlocked: res.unlocked,
        requirement: res.text,
        cleared: !!saveManager.data.arcade.cleared[l.id],
        bestScore: saveManager.data.arcade.bestScore[l.id] || 0,
      };
    });
  }

  bossRushes() {
    return BOSS_RUSHES.map((r) => {
      const res = evaluateUnlock(r.unlockRequirement, saveManager.data);
      return {
        ...r,
        unlocked: res.unlocked,
        requirement: res.text,
        cleared: !!saveManager.data.bossRush.cleared[r.id],
      };
    });
  }

  /** Begin an arcade ladder. */
  startLadder(ladderId, playerId, difficulty) {
    const l = ARCADE_LADDERS.find((x) => x.id === ladderId);
    if (!l) return null;
    const rng = makeRng(Date.now());
    this.run = {
      kind: 'arcade',
      id: ladderId,
      playerId,
      difficulty,
      index: 0,
      score: 0,
      continues: 0,
      healthCarry: 1,
      opponents: l.opponents.map((o) => ({
        id: pickOpponent(o, rng),
        difficulty: o.difficulty || difficulty,
        boss: !!o.boss,
        healthBonus: o.healthBonus || 0,
      })),
      stages: l.stages,
      rewards: l.rewards,
      total: l.opponents.length,
    };
    return this.currentMatch();
  }

  startBossRush(rushId, playerId, difficulty) {
    const r = BOSS_RUSHES.find((x) => x.id === rushId);
    if (!r) return null;
    this.run = {
      kind: 'bossrush',
      id: rushId,
      playerId,
      difficulty: difficulty || r.difficulty,
      index: 0,
      score: 0,
      continues: 0,
      healthCarry: 1,
      healBetween: r.healBetween,
      opponents: r.opponents.map((id) => ({
        id, difficulty: difficulty || r.difficulty, boss: true, healthBonus: r.healthBonus,
      })),
      stages: [r.stage],
      rewards: r.rewards,
      total: r.opponents.length,
    };
    return this.currentMatch();
  }

  currentMatch() {
    const run = this.run;
    if (!run || run.index >= run.opponents.length) return null;
    const o = run.opponents[run.index];
    return {
      playerId: run.playerId,
      opponentId: o.id,
      stageId: run.stages[run.index % run.stages.length],
      difficulty: o.difficulty,
      rounds: o.boss ? 3 : 1,
      opponentHealthBonus: o.healthBonus,
      startHealth: run.healthCarry,
      mode: run.kind,
      label: `${run.index + 1} / ${run.total}`,
      boss: o.boss,
    };
  }

  /**
   * Record the result of the current match.
   * @returns {{ done: boolean, won: boolean, next: Object|null, rewards: Object|null }}
   */
  reportResult(won, playerHealthFraction) {
    const run = this.run;
    if (!run) return { done: true, won: false, next: null, rewards: null };

    if (!won) {
      return { done: true, won: false, next: null, rewards: null, canContinue: true };
    }

    run.score += 100 + Math.round(playerHealthFraction * 100);
    run.index++;

    if (run.index >= run.opponents.length) {
      const rewards = progression.grantRewards(run.rewards);
      saveManager.update((d) => {
        if (run.kind === 'arcade') {
          d.arcade.cleared[run.id] = true;
          d.arcade.bestScore[run.id] = Math.max(d.arcade.bestScore[run.id] || 0, run.score);
        } else {
          d.bossRush.cleared[run.id] = true;
        }
      });
      saveManager.save();
      const finished = { done: true, won: true, next: null, rewards, score: run.score };
      this.run = null;
      return finished;
    }

    // Carry health forward, with an optional heal between fights.
    const heal = run.healBetween ?? 0.35;
    run.healthCarry = Math.min(1, playerHealthFraction + heal);
    return { done: false, won: true, next: this.currentMatch(), rewards: null };
  }

  /** Continue after a loss, restarting the current fight at full health. */
  continueRun() {
    if (!this.run) return null;
    this.run.continues++;
    this.run.score = Math.max(0, this.run.score - 150);
    this.run.healthCarry = 1;
    return this.currentMatch();
  }

  abandon() { this.run = null; }
}

export const arcade = new ArcadeManager();
export default arcade;
