/**
 * Progression: XP, levels, currency, fighter mastery and match results.
 */

import saveManager from './save-manager.js';
import { levelForXp, xpForLevel, masteryProgress } from './data/unlocks.js';
import unlocks from './unlock-manager.js';
import achievements from './achievements-manager.js';

class ProgressionManager extends EventTarget {
  /**
   * Award the results of a completed match.
   * @param {{
   *   playerId: string, won: boolean, mode: string,
   *   stats: Object, roundWins: number[], difficulty: string,
   *   perfect?: boolean, comeback?: boolean, ultimateFinish?: boolean,
   * }} result
   * @returns {Object} a summary for the results screen
   */
  awardMatch(result) {
    const before = {
      level: saveManager.level,
      xp: saveManager.data.xp,
      coins: saveManager.data.coins,
      mastery: saveManager.masteryLevel(result.playerId),
    };

    const diffMult = { easy: 0.7, normal: 1, hard: 1.3, veryhard: 1.6, legendary: 2.0 }[result.difficulty] || 1;
    const base = result.won ? 220 : 70;
    const damageBonus = Math.round((result.stats?.player?.damageDealt || 0) / 24);
    const comboBonus = Math.round((result.stats?.player?.maxCombo || 0) * 6);
    const perfectBonus = result.perfect ? 120 : 0;
    const comebackBonus = result.comeback ? 90 : 0;

    const xp = Math.round((base + damageBonus + comboBonus + perfectBonus + comebackBonus) * diffMult);
    const coins = Math.round(xp * 0.6);

    saveManager.update((d) => {
      d.xp += xp;
      d.coins += coins;
      d.level = levelForXp(d.xp);

      d.stats.matches++;
      if (result.won) d.stats.wins++; else d.stats.losses++;
      d.stats.rounds += (result.roundWins?.[0] || 0) + (result.roundWins?.[1] || 0);
      d.stats.damageDealt += Math.round(result.stats?.player?.damageDealt || 0);
      d.stats.damageTaken += Math.round(result.stats?.player?.damageTaken || 0);
      d.stats.blocks += result.stats?.player?.blocks || 0;
      d.stats.substitutions += result.stats?.player?.substitutions || 0;
      d.stats.transformations += result.stats?.player?.transformations || 0;
      d.stats.finalFormsReached += result.stats?.player?.finalFormsReached || 0;
      if ((result.stats?.player?.maxCombo || 0) > d.stats.bestCombo) {
        d.stats.bestCombo = result.stats.player.maxCombo;
      }
      if (result.perfect) d.stats.perfectRounds++;
      if (result.comeback) d.stats.comebacks++;
      if (result.ultimateFinish && result.won) d.stats.ultimateFinishes++;

      // Fighter mastery
      const m = d.mastery[result.playerId] || { xp: 0, level: 0, wins: 0, matches: 0 };
      m.xp += Math.round(xp * (result.won ? 1 : 0.5));
      m.matches++;
      if (result.won) m.wins++;
      m.level = masteryProgress(m.xp).level;
      d.mastery[result.playerId] = m;
    });

    saveManager.pushRecent(result.playerId);

    const after = {
      level: saveManager.level,
      xp: saveManager.data.xp,
      coins: saveManager.data.coins,
      mastery: saveManager.masteryLevel(result.playerId),
    };

    // Level-ups can unlock fighters and stages.
    const newlyUnlocked = unlocks.refresh();
    const newAchievements = achievements.check();

    const summary = {
      xp, coins,
      levelUp: after.level > before.level,
      level: after.level,
      masteryUp: after.mastery > before.mastery,
      mastery: after.mastery,
      xpProgress: this.levelProgress(),
      newlyUnlocked,
      newAchievements,
      breakdown: [
        { label: result.won ? 'Victory' : 'Defeat', value: base },
        { label: 'Damage dealt', value: damageBonus },
        { label: 'Best combo', value: comboBonus },
        ...(perfectBonus ? [{ label: 'Perfect round', value: perfectBonus }] : []),
        ...(comebackBonus ? [{ label: 'Comeback', value: comebackBonus }] : []),
        { label: `Difficulty ×${diffMult}`, value: null },
      ],
    };

    saveManager.save();
    this.dispatchEvent(new CustomEvent('award', { detail: summary }));
    return summary;
  }

  /** Grant a reward block (story chapters, ladders, tower milestones). */
  grantRewards(rewards) {
    if (!rewards) return { unlocked: [] };
    const unlocked = [];
    saveManager.update((d) => {
      if (rewards.coins) d.coins += rewards.coins;
      if (rewards.xp) { d.xp += rewards.xp; d.level = levelForXp(d.xp); }
      for (const id of rewards.unlockFighters || []) {
        if (!d.unlockedFighters.includes(id)) { d.unlockedFighters.push(id); unlocked.push({ type: 'fighter', id }); }
      }
      for (const id of rewards.unlockStages || []) {
        if (!d.unlockedStages.includes(id)) { d.unlockedStages.push(id); unlocked.push({ type: 'stage', id }); }
      }
    });
    unlocked.push(...unlocks.refresh());
    saveManager.save();
    return { unlocked };
  }

  levelProgress() {
    const lvl = saveManager.level;
    const cur = saveManager.data.xp - xpForLevel(lvl);
    const need = xpForLevel(lvl + 1) - xpForLevel(lvl);
    return { level: lvl, current: cur, needed: need, fraction: Math.max(0, Math.min(1, cur / need)) };
  }

  spend(amount) {
    if (saveManager.data.coins < amount) return false;
    saveManager.update((d) => { d.coins -= amount; });
    saveManager.save();
    return true;
  }
}

export const progression = new ProgressionManager();
export default progression;
