/**
 * Unlock rules.
 *
 * A single place that answers "is this unlocked, and if not, what does the
 * player have to do?". Used by the roster screen, the shop and the validator.
 */

import { CHAPTER_IDS } from './story.js';

export const UNLOCK_TYPES = ['default', 'story', 'level', 'coins', 'arcade', 'survival', 'tower', 'bossrush', 'mastery', 'achievement'];

/**
 * Human-readable text for an unlock requirement.
 * @param {{type:string, value?:any}} req
 */
export function describeUnlock(req) {
  if (!req || req.type === 'default') return 'Available from the start';
  switch (req.type) {
    case 'story': {
      const n = CHAPTER_IDS.indexOf(req.value) + 1;
      return n > 0 ? `Complete story chapter ${n}` : `Complete story: ${req.value}`;
    }
    case 'level': return `Reach player level ${req.value}`;
    case 'coins': return `Purchase for ${req.value} ryo`;
    case 'arcade': return `Clear ${req.value} arcade ladder${req.value === 1 ? '' : 's'}`;
    case 'survival': return `Reach Survival wave ${req.value}`;
    case 'tower': return `Reach Challenge Tower floor ${req.value}`;
    case 'bossrush': return `Clear ${req.value} Boss Rush${req.value === 1 ? '' : 'es'}`;
    case 'mastery': return `Reach mastery level ${req.value} with this fighter`;
    case 'achievement': return `Earn the achievement: ${req.value}`;
    default: return 'Unknown requirement';
  }
}

/**
 * Evaluate an unlock requirement against a save object.
 * @returns {{ unlocked: boolean, progress: number, text: string }}
 */
export function evaluateUnlock(req, save, ctx = {}) {
  const text = describeUnlock(req);
  if (!req || req.type === 'default') return { unlocked: true, progress: 1, text };

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  switch (req.type) {
    case 'story': {
      const done = (save.story?.completedChapters || []).includes(req.value);
      const idx = CHAPTER_IDS.indexOf(req.value) + 1;
      const doneCount = (save.story?.completedChapters || []).length;
      return { unlocked: done, progress: idx ? clamp01(doneCount / idx) : 0, text };
    }
    case 'level':
      return { unlocked: (save.level || 1) >= req.value, progress: clamp01((save.level || 1) / req.value), text };
    case 'coins':
      // Purchasable: "unlocked" means owned; affordability is handled separately.
      return { unlocked: false, progress: clamp01((save.coins || 0) / req.value), text, purchasable: true, price: req.value };
    case 'arcade': {
      const n = Object.keys(save.arcade?.cleared || {}).length;
      return { unlocked: n >= req.value, progress: clamp01(n / req.value), text };
    }
    case 'survival': {
      const n = save.survival?.bestWave || 0;
      return { unlocked: n >= req.value, progress: clamp01(n / req.value), text };
    }
    case 'tower': {
      const n = save.tower?.highestFloor || 0;
      return { unlocked: n >= req.value, progress: clamp01(n / req.value), text };
    }
    case 'bossrush': {
      const n = Object.keys(save.bossRush?.cleared || {}).length;
      return { unlocked: n >= req.value, progress: clamp01(n / req.value), text };
    }
    case 'mastery': {
      const m = save.mastery?.[ctx.fighterId]?.level || 0;
      return { unlocked: m >= req.value, progress: clamp01(m / req.value), text };
    }
    case 'achievement': {
      const has = (save.achievements || []).includes(req.value);
      return { unlocked: has, progress: has ? 1 : 0, text };
    }
    default:
      return { unlocked: false, progress: 0, text };
  }
}

/** Fighters available before any progression at all. */
export const STARTER_FIGHTERS = [
  'naruto', 'sasuke', 'sakura', 'kakashi', 'lee', 'gaara', 'boruto',
  'iruka', 'iruka', 'zabuza', 'haku', 'temari', 'sarada', 'mitsuki',
];

/** Stages available immediately. */
export const STARTER_STAGES = [
  'leaf_village', 'forest_training', 'exam_arena', 'desert_arena',
  'rain_rooftops', 'snow_bridge', 'cloud_mountain', 'stone_canyon',
  'moonlit_river', 'training_dojo',
];

/** XP curve: total XP needed to reach a level. */
export function xpForLevel(level) {
  return Math.round(180 * Math.pow(level - 1, 1.45));
}

export function levelForXp(xp) {
  let lvl = 1;
  while (lvl < 99 && xp >= xpForLevel(lvl + 1)) lvl++;
  return lvl;
}

/** Fighter mastery: XP earned per match with that fighter. */
export function masteryForXp(xp) {
  const thresholds = [0, 300, 900, 2000, 3800, 6500, 10000, 15000, 22000, 32000, 45000];
  let lvl = 0;
  for (let i = 1; i < thresholds.length; i++) if (xp >= thresholds[i]) lvl = i;
  return lvl;
}

export function masteryProgress(xp) {
  const thresholds = [0, 300, 900, 2000, 3800, 6500, 10000, 15000, 22000, 32000, 45000];
  const lvl = masteryForXp(xp);
  if (lvl >= thresholds.length - 1) return { level: lvl, progress: 1, next: null };
  const cur = thresholds[lvl];
  const next = thresholds[lvl + 1];
  return { level: lvl, progress: (xp - cur) / (next - cur), next };
}
