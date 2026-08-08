/**
 * Roster manager: search, filters, sorting and the derived metadata the
 * character-select screen needs.
 */

import { FIGHTERS, FIGHTER_ORDER } from './data/fighters.js';
import { getAbility } from './data/abilities.js';
import { TRANSFORMATIONS } from './data/transformations.js';
import { getSummon } from './data/summons.js';
import saveManager from './save-manager.js';
import unlocks from './unlock-manager.js';
import { ERA_LABELS, PLAYABLE_STATUS } from './constants.js';
import { masteryProgress } from './data/unlocks.js';

/** Build the filter option lists from the actual roster data. */
function collect(key) {
  const set = new Set();
  for (const id of FIGHTER_ORDER) {
    const v = FIGHTERS[id][key];
    if (Array.isArray(v)) v.forEach((x) => set.add(x));
    else if (v && v !== 'none' && v !== 'unaffiliated') set.add(v);
  }
  return [...set].sort();
}

function label(value) {
  return String(value)
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

class RosterManager {
  constructor() {
    this.filters = {
      search: '',
      era: new Set(),
      village: new Set(),
      clan: new Set(),
      organization: new Set(),
      archetype: new Set(),
      favoritesOnly: false,
      unlockedOnly: false,
      completeOnly: false,
    };
    this.sort = 'roster';
  }

  get options() {
    if (!this._options) {
      this._options = {
        era: collect('era').map((v) => ({ value: v, label: ERA_LABELS[v] || label(v) })),
        village: collect('village').map((v) => ({ value: v, label: label(v) })),
        clan: collect('clan').map((v) => ({ value: v, label: label(v) })),
        organization: collect('organization').map((v) => ({ value: v, label: label(v) })),
        archetype: collect('archetype').map((v) => ({ value: v, label: label(v) })),
      };
    }
    return this._options;
  }

  toggleFilter(key, value) {
    const set = this.filters[key];
    if (!(set instanceof Set)) return;
    if (set.has(value)) set.delete(value); else set.add(value);
  }

  clearFilters() {
    this.filters.search = '';
    for (const k of ['era', 'village', 'clan', 'organization', 'archetype']) this.filters[k].clear();
    this.filters.favoritesOnly = false;
    this.filters.unlockedOnly = false;
    this.filters.completeOnly = false;
  }

  get activeFilterCount() {
    let n = 0;
    for (const k of ['era', 'village', 'clan', 'organization', 'archetype']) n += this.filters[k].size;
    if (this.filters.favoritesOnly) n++;
    if (this.filters.unlockedOnly) n++;
    if (this.filters.completeOnly) n++;
    return n;
  }

  /** @returns {string[]} filtered, sorted fighter ids */
  query() {
    const f = this.filters;
    const q = f.search.trim().toLowerCase();
    const save = saveManager.data;

    let ids = FIGHTER_ORDER.filter((id) => {
      const d = FIGHTERS[id];
      if (q) {
        const hay = `${d.displayName} ${d.shortName} ${d.village} ${d.clan} ${d.organization} ${d.archetype} ${d.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.era.size && !f.era.has(d.era)) return false;
      if (f.village.size && !f.village.has(d.village)) return false;
      if (f.clan.size && !f.clan.has(d.clan)) return false;
      if (f.organization.size && !f.organization.has(d.organization)) return false;
      if (f.archetype.size && !f.archetype.has(d.archetype)) return false;
      if (f.favoritesOnly && !save.favorites.includes(id)) return false;
      if (f.unlockedOnly && !save.unlockedFighters.includes(id)) return false;
      if (f.completeOnly && d.playableStatus !== PLAYABLE_STATUS.COMPLETE) return false;
      return true;
    });

    switch (this.sort) {
      case 'name':
        ids = ids.sort((a, b) => FIGHTERS[a].displayName.localeCompare(FIGHTERS[b].displayName));
        break;
      case 'difficulty':
        ids = ids.sort((a, b) => FIGHTERS[a].difficulty - FIGHTERS[b].difficulty);
        break;
      case 'unlocked':
        ids = ids.sort((a, b) => {
          const ua = saveManager.isFighterUnlocked(a) ? 0 : 1;
          const ub = saveManager.isFighterUnlocked(b) ? 0 : 1;
          return ua - ub;
        });
        break;
      default: break; // roster order
    }
    return ids;
  }

  get favorites() { return saveManager.data.favorites.filter((id) => FIGHTERS[id]); }
  get recent() { return saveManager.data.recent.filter((id) => FIGHTERS[id]); }

  /** A random unlocked fighter, optionally excluding one. */
  random(exclude = null) {
    const pool = saveManager.data.unlockedFighters.filter((id) => FIGHTERS[id] && id !== exclude);
    if (!pool.length) return 'naruto';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Any fighter (used for CPU opponents, which are not unlock-gated). */
  randomAny(exclude = null) {
    const pool = FIGHTER_ORDER.filter((id) => id !== exclude);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Everything the detail sheet needs, resolved from ids to objects. */
  details(id) {
    const d = FIGHTERS[id];
    if (!d) return null;
    const status = unlocks.fighterStatus(id);
    const mastery = masteryProgress(saveManager.data.mastery?.[id]?.xp || 0);

    const resolve = (aid) => {
      const a = getAbility(aid);
      if (!a) return null;
      return {
        id: a.id,
        name: a.displayName,
        category: a.category,
        damage: a.damage,
        chakraCost: a.chakraCost,
        cooldown: a.cooldown,
        description: a.description,
        prototype: a.prototype,
        frames: `${Math.round(a.startup * 60)}/${Math.round(a.activeFrames * 60)}/${Math.round(a.recovery * 60)}`,
      };
    };

    const chain = d.transformations.map((tid) => {
      const t = TRANSFORMATIONS[tid];
      const st = unlocks.transformationStatus(tid);
      const req = t.activationRequirement;
      const bits = [];
      if (req.awakening) bits.push(`${req.awakening}% awakening`);
      if (req.chakra) bits.push(`${req.chakra} chakra`);
      if (req.healthBelow != null) bits.push(`below ${Math.round(req.healthBelow * 100)}% health`);
      if (req.oncePerMatch) bits.push('once per match');
      return {
        id: tid,
        name: t.displayName,
        description: t.description,
        requirement: bits.join(', ') || 'no requirement',
        unlock: st,
        duration: t.permanent ? 'permanent' : `${t.duration}s`,
        drain: t.healthDrain ? `${t.healthDrain}/s health` : (t.chakraDrain ? `${t.chakraDrain}/s chakra` : 'none'),
      };
    });

    return {
      data: d,
      status,
      mastery,
      isFavorite: saveManager.isFavorite(id),
      complete: d.playableStatus === PLAYABLE_STATUS.COMPLETE,
      basics: d.basicCombos.map(resolve).filter(Boolean),
      airs: d.airCombos.map(resolve).filter(Boolean),
      specials: [d.heavy, d.launcher, d.dashAttack, d.throwAttack, d.guardCounter].map(resolve).filter(Boolean),
      jutsu: d.abilities.map(resolve).filter(Boolean),
      ultimate: resolve(d.ultimate),
      transformations: chain,
      summons: (d.summons || []).map((sid) => getSummon(sid)).filter(Boolean),
    };
  }

  get count() { return FIGHTER_ORDER.length; }
  get unlockedCount() { return saveManager.data.unlockedFighters.length; }
  get completeCount() {
    return FIGHTER_ORDER.filter((id) => FIGHTERS[id].playableStatus === PLAYABLE_STATUS.COMPLETE).length;
  }
}

export const roster = new RosterManager();
export { label as labelize };
export default roster;
