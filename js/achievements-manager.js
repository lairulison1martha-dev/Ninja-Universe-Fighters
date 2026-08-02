/**
 * Achievements manager: evaluates predicates and grants rewards once each.
 */

import saveManager from './save-manager.js';
import { ACHIEVEMENTS, getAchievement } from './data/achievements.js';

class AchievementsManager extends EventTarget {
  /** @returns {Array} newly earned achievements */
  check() {
    const save = saveManager.data;
    const earned = [];
    for (const a of ACHIEVEMENTS) {
      if (save.achievements.includes(a.id)) continue;
      let ok = false;
      try { ok = !!a.check(save); } catch { ok = false; }
      if (!ok) continue;
      earned.push(a);
      saveManager.update((d) => {
        d.achievements.push(a.id);
        if (a.reward?.coins) d.coins += a.reward.coins;
        if (a.reward?.xp) d.xp += a.reward.xp;
      });
    }
    if (earned.length) {
      saveManager.save();
      this.dispatchEvent(new CustomEvent('earned', { detail: earned }));
    }
    return earned;
  }

  list() {
    const save = saveManager.data;
    return ACHIEVEMENTS.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.hidden && !save.achievements.includes(a.id) ? 'Hidden achievement' : a.description,
      hidden: a.hidden,
      earned: save.achievements.includes(a.id),
      reward: a.reward,
      title: a.title,
    }));
  }

  get earnedCount() { return saveManager.data.achievements.length; }
  get total() { return ACHIEVEMENTS.length; }

  /** Titles the player has earned. */
  titles() {
    return saveManager.data.achievements
      .map((id) => getAchievement(id))
      .filter((a) => a && a.title)
      .map((a) => ({ id: a.id, title: a.title }));
  }

  setActiveTitle(id) {
    saveManager.update((d) => { d.activeTitle = id; });
    saveManager.save();
  }
}

export const achievements = new AchievementsManager();
export default achievements;
