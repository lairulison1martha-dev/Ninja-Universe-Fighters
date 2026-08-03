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

import { FIGHTERS } from './data/fighters.js';
import { resolveFighterId, LEGACY_FIGHTER_IDS } from './data/roster-migration.js';
import { COSTUME_BY_LEGACY_ID, getCostume, costumesFor } from './data/costumes.js';
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

    /** { [fighterId]: string[] } — costume ids the player has unlocked. */
    costumes: {},
    /** { [fighterId]: costumeId } — what each fighter is currently wearing. */
    equippedCostumes: {},

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
  4: (s) => {
    s.equippedCostumes = s.equippedCostumes || {};
    // v4 → v5: the roster collapsed from 192 cards to 110 unique people.
    //
    // Alternate ages, Edo versions, masked versions, tailed beasts and the
    // original characters stopped being fighters and became costumes,
    // transformations and summons. Every id a v4 save can hold is redirected
    // to the fighter that absorbed it, and an unlock that corresponds to a
    // costume is recorded as that costume rather than thrown away.
    //
    // Nothing is deleted here: mastery is merged, not replaced, and progress
    // keyed by a removed fighter lands on the fighter you now play instead.
    s.costumes = s.costumes || {};

    const remap = (id) => resolveFighterId(id) || id;
    const known = (id) => !!FIGHTERS[id];

    const unlockCostume = (legacyId) => {
      const entry = COSTUME_BY_LEGACY_ID[legacyId];
      if (!entry) return;
      const list = s.costumes[entry.fighterId] || (s.costumes[entry.fighterId] = []);
      if (!list.includes(entry.costumeId)) list.push(entry.costumeId);
    };

    // Unlocked fighters: redirect, de-duplicate, and keep the costume.
    const fighters = new Set();
    for (const id of s.unlockedFighters || []) {
      unlockCostume(id);
      const to = remap(id);
      if (known(to)) fighters.add(to);
    }
    s.unlockedFighters = [...fighters];

    // Favourites and recents: same redirect, order preserved, no duplicates.
    const dedupe = (list) => {
      const out = [];
      for (const id of list || []) {
        const to = remap(id);
        if (known(to) && !out.includes(to)) out.push(to);
      }
      return out;
    };
    s.favorites = dedupe(s.favorites);
    s.recent = dedupe(s.recent);

    // Mastery: two old cards can land on one fighter, so merge rather than
    // overwrite — a player does not lose the xp they earned on either.
    const mastery = {};
    for (const [id, m] of Object.entries(s.mastery || {})) {
      const to = remap(id);
      if (!known(to)) continue;
      const cur = mastery[to];
      if (!cur) {
        mastery[to] = { ...m };
        continue;
      }
      mastery[to] = {
        ...cur,
        xp: (cur.xp || 0) + (m.xp || 0),
        wins: (cur.wins || 0) + (m.wins || 0),
        matches: (cur.matches || 0) + (m.matches || 0),
        level: Math.max(cur.level || 1, m.level || 1),
      };
    }
    s.mastery = mastery;

    // Transformation unlock ids are `<fighter>_<form>`. Fighter ids contain
    // underscores themselves (`madara_edo_rinnegan`), so match the longest
    // legacy id that prefixes the key rather than splitting on the first `_`.
    const legacyByLength = Object.keys(LEGACY_FIGHTER_IDS)
      .sort((a, b) => b.length - a.length);
    const forms = new Set();
    for (const key of s.transformationsUnlocked || []) {
      const owner = legacyByLength.find((id) => key.startsWith(`${id}_`));
      forms.add(owner ? `${LEGACY_FIGHTER_IDS[owner]}${key.slice(owner.length)}` : key);
    }
    s.transformationsUnlocked = [...forms];

    // Story / arcade / boss-rush progress keyed by fighter id.
    const remapKeys = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        const to = remap(k);
        out[known(to) ? to : k] = v;
      }
      return out;
    };
    if (s.arcade) {
      s.arcade.cleared = remapKeys(s.arcade.cleared);
      s.arcade.bestScore = remapKeys(s.arcade.bestScore);
    }
    if (s.bossRush) s.bossRush.cleared = remapKeys(s.bossRush.cleared);
    if (s.story) s.story.completedNodes = remapKeys(s.story.completedNodes);

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

  /* ------------------------------------------------------------ costumes -- */

  /**
   * Is this costume available to wear?
   *
   * The default outfit and anything with a `default` unlock rule are always
   * available — a fighter can never be left with nothing to wear. Everything
   * else has to be either explicitly unlocked in the save or satisfied by the
   * player's mastery of that fighter.
   */
  isCostumeUnlocked(fighterId, costumeId) {
    if (!costumeId || costumeId === 'default') return true;
    const costume = getCostume(fighterId, costumeId);
    if (!costume || costume.id !== costumeId) return false;
    const rule = costume.unlockRule || { type: 'default' };
    if (rule.type === 'default') return true;
    if ((this.data.costumes?.[fighterId] || []).includes(costumeId)) return true;
    if (rule.type === 'mastery') {
      return (this.data.mastery?.[fighterId]?.level || 0) >= (rule.value || 0);
    }
    return false;
  }

  /** Mark a costume unlocked. Returns true when this call changed anything. */
  unlockCostume(fighterId, costumeId) {
    if (this.isCostumeUnlocked(fighterId, costumeId)) return false;
    this.update((d) => {
      const list = d.costumes[fighterId] || (d.costumes[fighterId] = []);
      if (!list.includes(costumeId)) list.push(costumeId);
    });
    return true;
  }

  /** The costume a fighter is wearing, falling back to the default outfit. */
  equippedCostume(fighterId) {
    const id = this.data.equippedCostumes?.[fighterId] || 'default';
    // A costume that was equipped and later became invalid (data changed, or a
    // save edited by hand) must not leave the fighter unrenderable.
    return this.isCostumeUnlocked(fighterId, id) ? id : 'default';
  }

  /**
   * Equip a costume. Refuses locked ones and returns what is now equipped, so
   * the caller always knows the real state rather than assuming success.
   */
  equipCostume(fighterId, costumeId) {
    if (!this.isCostumeUnlocked(fighterId, costumeId)) return this.equippedCostume(fighterId);
    this.update((d) => { d.equippedCostumes[fighterId] = costumeId; });
    return costumeId;
  }

  /** Costume ids this fighter can currently wear. */
  unlockedCostumes(fighterId) {
    return costumesFor(fighterId)
      .filter((c) => this.isCostumeUnlocked(fighterId, c.id))
      .map((c) => c.id);
  }
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
