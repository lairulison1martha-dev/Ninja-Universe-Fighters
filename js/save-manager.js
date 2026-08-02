/**
 * Save manager.
 *
 * Storage: localStorage (synchronous, tiny payload, works in Safari standalone
 * mode and in private browsing well enough to degrade gracefully).
 *
 * Rules honoured here:
 *   - A save is NEVER discarded because the schema changed. Unknown/old saves
 *     run through migrations; anything unrecognised is preserved verbatim under
 *     `_legacy` so a future version can still read it.
 *   - Every write also refreshes a backup copy, and a corrupt primary save
 *     falls back to that backup instead of resetting.
 *   - Three slots plus autosave.
 */

import {
  SAVE_KEY, SAVE_BACKUP_KEY, SAVE_SLOT_KEY, SAVE_SLOT_COUNT, SAVE_VERSION,
  STORAGE_PREFIX, APP_VERSION,
} from './constants.js';
import { STARTER_FIGHTERS, STARTER_STAGES, levelForXp, xpForLevel, masteryForXp } from './data/unlocks.js';

const ACTIVE_SLOT_KEY = `${STORAGE_PREFIX}.activeSlot`;

let storageOk = true;
try {
  const probe = `${STORAGE_PREFIX}.probe`;
  localStorage.setItem(probe, '1');
  localStorage.removeItem(probe);
} catch {
  storageOk = false;
}

function read(key) {
  if (!storageOk) return null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  if (!storageOk) return false;
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

/* -------------------------------------------------------------------------- */

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    appVersion: APP_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),

    level: 1,
    xp: 0,
    coins: 500,

    unlockedFighters: [...STARTER_FIGHTERS],
    unlockedStages: [...STARTER_STAGES],
    transformationsUnlocked: [],

    favorites: [],
    recent: [],

    /** { [fighterId]: { xp, level, wins, matches } } */
    mastery: {},

    achievements: [],
    activeTitle: null,

    story: { completedChapters: [], completedNodes: {}, current: null },
    arcade: { cleared: {}, bestScore: {} },
    survival: { bestWave: 0, bestScore: 0, runs: 0 },
    tower: { highestFloor: 0, cleared: {} },
    bossRush: { cleared: {} },

    training: {
      infiniteHealth: true,
      infiniteChakra: true,
      infiniteSubstitution: true,
      dummy: 'stationary',
      showFrameData: true,
      showHitboxes: false,
      showInputs: true,
    },

    stats: {
      matches: 0, wins: 0, losses: 0, rounds: 0,
      damageDealt: 0, damageTaken: 0,
      bestCombo: 0, blocks: 0, substitutions: 0,
      perfectRounds: 0, comebacks: 0, ultimateFinishes: 0,
      transformations: 0, finalFormsReached: 0,
      trainingSeconds: 0, playSeconds: 0,
    },

    settings: null, // filled in by settings-manager on first boot
    _legacy: null,
  };
}

/* ------------------------------------------------------------ migrations -- */

/**
 * Migrations are additive: each one upgrades from `n` to `n + 1` and must never
 * delete data it does not understand.
 */
const MIGRATIONS = {
  1: (s) => {
    // v1 → v2: split combined "progress" blob into per-mode objects.
    s.arcade = s.arcade || { cleared: {}, bestScore: {} };
    s.survival = s.survival || { bestWave: 0, bestScore: 0, runs: 0 };
    s.tower = s.tower || { highestFloor: 0, cleared: {} };
    return s;
  },
  2: (s) => {
    // v2 → v3: fighter mastery + boss rush.
    s.mastery = s.mastery || {};
    s.bossRush = s.bossRush || { cleared: {} };
    return s;
  },
  3: (s) => {
    // v3 → v4: transformation unlocks tracked separately from fighters.
    s.transformationsUnlocked = s.transformationsUnlocked || [];
    s.activeTitle = s.activeTitle ?? null;
    return s;
  },
};

/** Fill in any key added since the save was written, without touching existing values. */
function reconcile(save) {
  const base = defaultSave();
  const out = { ...base, ...save };

  // Deep-merge the nested containers so new sub-keys appear but old values win.
  for (const key of ['story', 'arcade', 'survival', 'tower', 'bossRush', 'training', 'stats']) {
    out[key] = { ...base[key], ...(save[key] || {}) };
  }
  out.mastery = save.mastery || {};

  // Arrays: keep the player's, but guarantee the starters are present.
  out.unlockedFighters = Array.from(new Set([...(save.unlockedFighters || []), ...STARTER_FIGHTERS]));
  out.unlockedStages = Array.from(new Set([...(save.unlockedStages || []), ...STARTER_STAGES]));
  out.transformationsUnlocked = Array.from(new Set(save.transformationsUnlocked || []));
  out.favorites = Array.from(new Set(save.favorites || []));
  out.recent = (save.recent || []).slice(0, 12);
  out.achievements = Array.from(new Set(save.achievements || []));

  out.level = levelForXp(out.xp || 0);
  return out;
}

export function migrate(raw) {
  let s = raw;
  const from = Number(s.version) || 1;
  for (let v = from; v < SAVE_VERSION; v++) {
    const fn = MIGRATIONS[v];
    if (fn) {
      try { s = fn(s) || s; } catch (err) { console.warn('[save] migration', v, 'failed', err); }
    }
  }
  s.version = SAVE_VERSION;
  s.appVersion = APP_VERSION;
  return reconcile(s);
}

/* -------------------------------------------------------------- manager --- */

class SaveManager extends EventTarget {
  constructor() {
    super();
    this.data = defaultSave();
    this.slot = Number(read(ACTIVE_SLOT_KEY)) || 0;
    this.storageAvailable = storageOk;
    this.recoveredFromBackup = false;
    this._dirty = false;
    this._flushTimer = null;
  }

  keyForSlot(slot = this.slot) {
    return slot === 0 ? SAVE_KEY : SAVE_SLOT_KEY(slot);
  }

  /** Load the active slot. Returns a short status string for the boot log. */
  load() {
    if (!storageOk) {
      this.data = defaultSave();
      return 'no-storage';
    }
    const key = this.keyForSlot();
    const raw = read(key);
    if (!raw) {
      const backup = read(SAVE_BACKUP_KEY);
      if (backup && this.slot === 0) {
        try {
          this.data = migrate(JSON.parse(backup));
          this.recoveredFromBackup = true;
          this.save();
          return 'recovered';
        } catch { /* fall through */ }
      }
      this.data = defaultSave();
      this.save();
      return 'new';
    }
    try {
      const parsed = JSON.parse(raw);
      const before = Number(parsed.version) || 1;
      this.data = migrate(parsed);
      if (before !== SAVE_VERSION) {
        this.save();
        return `migrated:${before}->${SAVE_VERSION}`;
      }
      return 'loaded';
    } catch (err) {
      console.error('[save] primary save is corrupt', err);
      const backup = read(SAVE_BACKUP_KEY);
      if (backup) {
        try {
          this.data = migrate(JSON.parse(backup));
          this.recoveredFromBackup = true;
          // Keep the corrupt copy so nothing is lost outright.
          write(`${SAVE_KEY}.corrupt.${Date.now()}`, raw);
          this.save();
          return 'recovered';
        } catch { /* fall through */ }
      }
      write(`${SAVE_KEY}.corrupt.${Date.now()}`, raw);
      this.data = defaultSave();
      this.data._legacy = raw.slice(0, 20000);
      this.save();
      return 'corrupt-preserved';
    }
  }

  save() {
    if (!storageOk) return false;
    this.data.updatedAt = Date.now();
    this.data.version = SAVE_VERSION;
    this.data.appVersion = APP_VERSION;
    const json = JSON.stringify(this.data);
    const ok = write(this.keyForSlot(), json);
    if (ok && this.slot === 0) write(SAVE_BACKUP_KEY, json);
    this._dirty = false;
    this.dispatchEvent(new CustomEvent('save', { detail: this.data }));
    return ok;
  }

  /** Coalesced autosave — call freely, it writes at most every 800 ms. */
  autosave() {
    this._dirty = true;
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      if (this._dirty) this.save();
    }, 800);
  }

  /** Immediately persist if anything is pending (used on pagehide). */
  flush() {
    if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
    if (this._dirty) this.save();
  }

  /** Mutate the save and schedule a write. */
  update(fn) {
    fn(this.data);
    this.autosave();
    this.dispatchEvent(new CustomEvent('change', { detail: this.data }));
    return this.data;
  }

  /* ------------------------------------------------------------- slots -- */

  listSlots() {
    const out = [];
    for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
      const raw = read(i === 0 ? SAVE_KEY : SAVE_SLOT_KEY(i));
      if (!raw) { out.push({ slot: i, empty: true }); continue; }
      try {
        const d = JSON.parse(raw);
        out.push({
          slot: i,
          empty: false,
          level: levelForXp(d.xp || 0),
          coins: d.coins || 0,
          fighters: (d.unlockedFighters || []).length,
          chapters: (d.story?.completedChapters || []).length,
          updatedAt: d.updatedAt || 0,
        });
      } catch {
        out.push({ slot: i, empty: false, corrupt: true });
      }
    }
    return out;
  }

  switchSlot(slot) {
    this.flush();
    this.slot = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, slot | 0));
    write(ACTIVE_SLOT_KEY, String(this.slot));
    const status = this.load();
    this.dispatchEvent(new CustomEvent('change', { detail: this.data }));
    return status;
  }

  /* ---------------------------------------------------- export / import -- */

  exportSave() {
    return JSON.stringify({
      _format: 'ninja-universe-fighters-save',
      _appVersion: APP_VERSION,
      _exportedAt: new Date().toISOString(),
      data: this.data,
    }, null, 2);
  }

  /**
   * @returns {{ ok: boolean, message: string }}
   */
  importSave(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, message: 'That is not valid save data (JSON could not be parsed).' };
    }
    const payload = parsed && parsed.data ? parsed.data : parsed;
    if (!payload || typeof payload !== 'object' || payload.xp === undefined) {
      return { ok: false, message: 'That file does not look like a Ninja Universe Fighters save.' };
    }
    // Back up whatever is currently stored before overwriting anything.
    write(`${SAVE_KEY}.preimport.${Date.now()}`, JSON.stringify(this.data));
    this.data = migrate(payload);
    this.save();
    this.dispatchEvent(new CustomEvent('change', { detail: this.data }));
    return { ok: true, message: 'Save imported.' };
  }

  resetSave({ keepSettings = true } = {}) {
    const settings = keepSettings ? this.data.settings : null;
    write(`${SAVE_KEY}.prereset.${Date.now()}`, JSON.stringify(this.data));
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
    this.dispatchEvent(new CustomEvent('change', { detail: this.data }));
  }

  /* --------------------------------------------------------- shortcuts -- */

  get level() { return levelForXp(this.data.xp); }
  get xpToNext() {
    const l = this.level;
    return { current: this.data.xp - xpForLevel(l), needed: xpForLevel(l + 1) - xpForLevel(l) };
  }
  masteryLevel(fighterId) {
    return masteryForXp(this.data.mastery?.[fighterId]?.xp || 0);
  }
  isFighterUnlocked(id) { return this.data.unlockedFighters.includes(id); }
  isStageUnlocked(id) { return this.data.unlockedStages.includes(id); }
  isFavorite(id) { return this.data.favorites.includes(id); }

  toggleFavorite(id) {
    this.update((d) => {
      const i = d.favorites.indexOf(id);
      if (i >= 0) d.favorites.splice(i, 1); else d.favorites.push(id);
    });
    return this.isFavorite(id);
  }

  pushRecent(id) {
    this.update((d) => {
      const i = d.recent.indexOf(id);
      if (i >= 0) d.recent.splice(i, 1);
      d.recent.unshift(id);
      d.recent.length = Math.min(d.recent.length, 12);
    });
  }
}

export const saveManager = new SaveManager();
export default saveManager;
