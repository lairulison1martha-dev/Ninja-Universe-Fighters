/**
 * Challenge Tower: 100 floors with special battle rules.
 */

import { TOWER_FLOORS, TOWER_MILESTONES, CONDITIONS } from './data/arcade.js';
import saveManager from './save-manager.js';
import progression from './progression-manager.js';

class TowerManager extends EventTarget {
  constructor() {
    super();
    this.run = null;
  }

  get highestFloor() { return saveManager.data.tower.highestFloor || 0; }

  /** Floors the player may attempt: everything up to highest + 1. */
  floors() {
    const cleared = saveManager.data.tower.cleared || {};
    const reach = this.highestFloor + 1;
    return TOWER_FLOORS.map((f) => ({
      ...f,
      cleared: !!cleared[f.floor],
      unlocked: f.floor <= reach,
      conditionLabels: f.conditions.map((c) => CONDITIONS[c]?.label).filter(Boolean),
      milestone: TOWER_MILESTONES[f.floor] || null,
    }));
  }

  start(floorNumber, playerId) {
    const f = TOWER_FLOORS.find((x) => x.floor === floorNumber);
    if (!f) return null;
    if (floorNumber > this.highestFloor + 1) return null;
    this.run = { playerId, floor: floorNumber };
    return this.matchFor(f, playerId);
  }

  matchFor(f, playerId) {
    return {
      playerId,
      opponentId: f.opponent,
      stageId: f.stage,
      variant: f.variant,
      difficulty: f.difficulty,
      rounds: f.boss ? 3 : 1,
      opponentHealthBonus: f.healthBonus,
      conditions: f.conditions,
      mode: 'tower',
      label: `Floor ${f.floor}`,
      boss: f.boss,
    };
  }

  /** @returns {{ cleared: boolean, next: Object|null, rewards: Object|null, milestone: Object|null }} */
  reportResult(won) {
    const run = this.run;
    if (!run) return { cleared: false, next: null, rewards: null, milestone: null };
    const f = TOWER_FLOORS.find((x) => x.floor === run.floor);

    if (!won) {
      this.run = null;
      return { cleared: false, next: null, rewards: null, milestone: null };
    }

    const firstClear = !saveManager.data.tower.cleared[run.floor];
    saveManager.update((d) => {
      d.tower.cleared[run.floor] = true;
      d.tower.highestFloor = Math.max(d.tower.highestFloor || 0, run.floor);
    });

    let rewards = null;
    if (firstClear) rewards = progression.grantRewards(f.rewards);

    let milestone = null;
    const m = TOWER_MILESTONES[run.floor];
    if (m && firstClear) {
      milestone = progression.grantRewards(m);
    }
    saveManager.save();

    const nextFloor = TOWER_FLOORS.find((x) => x.floor === run.floor + 1);
    const next = nextFloor ? this.matchFor(nextFloor, run.playerId) : null;
    if (next) this.run = { playerId: run.playerId, floor: nextFloor.floor };
    else this.run = null;

    return { cleared: true, next, rewards, milestone };
  }

  abandon() { this.run = null; }
}

export const tower = new TowerManager();
export default tower;
