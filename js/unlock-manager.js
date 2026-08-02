/**
 * Unlock manager.
 *
 * Re-evaluates every fighter and stage against the current save whenever
 * progress changes, and reports what has newly become available.
 */

import saveManager from './save-manager.js';
import { FIGHTERS, FIGHTER_ORDER } from './data/fighters.js';
import { STAGES, STAGE_ORDER } from './data/stages.js';
import { TRANSFORMATIONS } from './data/transformations.js';
import { evaluateUnlock, describeUnlock } from './data/unlocks.js';

class UnlockManager extends EventTarget {
  /** Recompute unlocks. @returns {Array<{type:string,id:string,name:string}>} newly unlocked */
  refresh() {
    const save = saveManager.data;
    const newly = [];

    saveManager.update((d) => {
      for (const id of FIGHTER_ORDER) {
        if (d.unlockedFighters.includes(id)) continue;
        const f = FIGHTERS[id];
        const res = evaluateUnlock(f.unlockRequirement, d, { fighterId: id });
        if (res.unlocked) {
          d.unlockedFighters.push(id);
          newly.push({ type: 'fighter', id, name: f.displayName });
        }
      }
      for (const id of STAGE_ORDER) {
        if (d.unlockedStages.includes(id)) continue;
        const s = STAGES[id];
        const res = evaluateUnlock(s.unlockRequirement, d);
        if (res.unlocked) {
          d.unlockedStages.push(id);
          newly.push({ type: 'stage', id, name: s.displayName });
        }
      }
      // Transformations that have become legal.
      for (const [tid, t] of Object.entries(TRANSFORMATIONS)) {
        if (!t.unlockRequirement) continue;
        if (d.transformationsUnlocked.includes(tid)) continue;
        const res = evaluateUnlock(t.unlockRequirement, d, { fighterId: t.fighterId });
        if (res.unlocked) {
          d.transformationsUnlocked.push(tid);
          newly.push({ type: 'transformation', id: tid, name: t.displayName });
        }
      }
    });

    if (newly.length) {
      saveManager.save();
      this.dispatchEvent(new CustomEvent('unlock', { detail: newly }));
    }
    void save;
    return newly;
  }

  /** Status for the roster UI. */
  fighterStatus(id) {
    const f = FIGHTERS[id];
    if (!f) return null;
    if (saveManager.isFighterUnlocked(id)) {
      return { unlocked: true, text: 'Unlocked', progress: 1 };
    }
    const res = evaluateUnlock(f.unlockRequirement, saveManager.data, { fighterId: id });
    return {
      unlocked: false,
      text: res.text,
      progress: res.progress,
      purchasable: !!res.purchasable,
      price: res.price,
      affordable: res.purchasable ? saveManager.data.coins >= res.price : false,
    };
  }

  stageStatus(id) {
    const s = STAGES[id];
    if (!s) return null;
    if (saveManager.isStageUnlocked(id)) return { unlocked: true, text: 'Unlocked', progress: 1 };
    const res = evaluateUnlock(s.unlockRequirement, saveManager.data);
    return { unlocked: false, text: res.text, progress: res.progress };
  }

  /** Buy a coin-locked fighter. */
  purchase(id) {
    const f = FIGHTERS[id];
    if (!f || f.unlockRequirement.type !== 'coins') return { ok: false, message: 'Not for sale' };
    if (saveManager.isFighterUnlocked(id)) return { ok: false, message: 'Already unlocked' };
    const price = f.unlockRequirement.value;
    if (saveManager.data.coins < price) return { ok: false, message: `Needs ${price} ryo` };
    saveManager.update((d) => {
      d.coins -= price;
      d.unlockedFighters.push(id);
    });
    saveManager.save();
    this.dispatchEvent(new CustomEvent('unlock', { detail: [{ type: 'fighter', id, name: f.displayName }] }));
    return { ok: true, message: `${f.displayName} unlocked` };
  }

  /** Is this transformation legal for the player right now? */
  transformationStatus(tid) {
    const t = TRANSFORMATIONS[tid];
    if (!t) return null;
    if (!t.unlockRequirement) return { unlocked: true, text: 'Available' };
    const res = evaluateUnlock(t.unlockRequirement, saveManager.data, { fighterId: t.fighterId });
    return { unlocked: res.unlocked, text: res.unlocked ? 'Available' : describeUnlock(t.unlockRequirement), progress: res.progress };
  }
}

export const unlocks = new UnlockManager();
export default unlocks;
