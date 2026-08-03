/**
 * Character-select screen.
 *
 * Lazy rendering: only the cards inside (or near) the scroll viewport paint
 * their portrait canvas, so a 190-fighter roster scrolls smoothly on a phone.
 */

import roster, { labelize } from '../roster-manager.js';
import saveManager from '../save-manager.js';
import unlocks from '../unlock-manager.js';
import audio from '../audio-manager.js';
import settings from '../settings-manager.js';
import { FIGHTERS } from '../data/fighters.js';
import { FighterRenderer } from '../combat/fighter-renderer.js';
import { DIFFICULTIES, DIFFICULTY_LABELS, ROUND_COUNT_OPTIONS, TIMER_OPTIONS, PLAYABLE_STATUS } from '../constants.js';
import { toast } from './overlays.js';

const $ = (id) => document.getElementById(id);

export class SelectScreen {
  constructor(onConfirm) {
    this.onConfirm = onConfirm;
    this.grid = $('select-grid');
    this.chips = $('select-chips');
    this.p1 = null;
    this.p2 = null;
    this.mode = 'versus';
    this.allowOpponent = true;
    this.options = {
      difficulty: settings.values.defaultDifficulty,
      rounds: settings.values.defaultRounds,
      timer: settings.values.defaultTimer,
    };
    this.cards = new Map();
    this.observer = null;
    this._bind();
  }

  _bind() {
    $('select-search').addEventListener('input', (e) => {
      roster.filters.search = e.target.value;
      this.renderGrid();
    });
    $('btn-filters').addEventListener('click', () => this.openFilters());
    $('btn-random').addEventListener('click', () => {
      audio.play('sfx_ui_select');
      this.setP1(roster.random());
      if (this.allowOpponent) this.setP2(roster.randomAny(this.p1));
    });
    $('btn-select-confirm').addEventListener('click', () => {
      if (!this.p1) return;
      audio.play('sfx_ui_select');
      this.onConfirm?.({
        playerId: this.p1,
        opponentId: this.p2,
        ...this.options,
      });
    });

    for (const sel of ['[data-action="close-sheet"]']) {
      document.querySelectorAll(sel).forEach((el) => {
        el.addEventListener('click', () => { $('fighter-sheet').hidden = true; });
      });
    }
    document.querySelectorAll('[data-action="close-filters"]').forEach((el) => {
      el.addEventListener('click', () => { $('filter-sheet').hidden = true; this.renderChips(); });
    });
    $('btn-filters-clear').addEventListener('click', () => {
      roster.clearFilters();
      $('select-search').value = '';
      this.renderFilters();
      this.renderGrid();
      this.renderChips();
    });
    $('btn-fav').addEventListener('click', () => {
      if (!this.sheetId) return;
      const on = saveManager.toggleFavorite(this.sheetId);
      $('btn-fav').textContent = on ? '★' : '☆';
      this.refreshCard(this.sheetId);
    });
    $('btn-pick-p1').addEventListener('click', () => {
      if (this.sheetId) this.setP1(this.sheetId);
      $('fighter-sheet').hidden = true;
    });
    $('btn-pick-p2').addEventListener('click', () => {
      if (this.sheetId) this.setP2(this.sheetId);
      $('fighter-sheet').hidden = true;
    });

    // Lazy portrait painting.
    this.observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) this._paintCard(e.target);
      }
    }, { root: this.grid, rootMargin: '200px 0px' });
  }

  /**
   * @param {{ title?: string, mode?: string, allowOpponent?: boolean,
   *           lockedPlayer?: string, fixedOpponent?: string,
   *           showOptions?: boolean }} cfg
   */
  configure(cfg = {}) {
    this.mode = cfg.mode || 'versus';
    this.allowOpponent = cfg.allowOpponent !== false;
    this.showOptions = cfg.showOptions !== false;
    $('select-title').textContent = cfg.title || 'Versus';
    $('panel-p2').style.display = this.allowOpponent ? '' : 'none';
    $('btn-pick-p2').style.display = this.allowOpponent ? '' : 'none';

    this.p1 = cfg.lockedPlayer || this.p1 || saveManager.data.recent[0] || 'naruto';
    if (!saveManager.isFighterUnlocked(this.p1)) this.p1 = 'naruto';
    this.p2 = cfg.fixedOpponent || (this.allowOpponent ? (this.p2 || roster.randomAny(this.p1)) : null);

    this.renderChips();
    this.renderGrid();
    this.renderPanels();
    this.renderOptions();
  }

  /* ------------------------------------------------------------- chips --- */

  renderChips() {
    this.chips.innerHTML = '';
    const add = (label, active, onClick) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = `chip${active ? ' is-on' : ''}`;
      c.textContent = label;
      c.addEventListener('click', () => { audio.play('sfx_ui_move'); onClick(); });
      this.chips.appendChild(c);
      return c;
    };

    const n = roster.activeFilterCount;
    add(`All (${roster.count})`, n === 0, () => {
      roster.clearFilters();
      $('select-search').value = '';
      this.renderGrid();
      this.renderChips();
    });
    add('★ Favourites', roster.filters.favoritesOnly, () => {
      roster.filters.favoritesOnly = !roster.filters.favoritesOnly;
      this.renderGrid(); this.renderChips();
    });
    add('Unlocked', roster.filters.unlockedOnly, () => {
      roster.filters.unlockedOnly = !roster.filters.unlockedOnly;
      this.renderGrid(); this.renderChips();
    });
    add('Full move set', roster.filters.completeOnly, () => {
      roster.filters.completeOnly = !roster.filters.completeOnly;
      this.renderGrid(); this.renderChips();
    });

    const recent = roster.recent.slice(0, 5);
    for (const id of recent) {
      add(FIGHTERS[id].shortName, false, () => this.setP1(id));
    }
  }

  /* -------------------------------------------------------------- grid --- */

  renderGrid() {
    const ids = roster.query();
    this.grid.innerHTML = '';
    this.cards.clear();
    this.observer.disconnect();

    if (!ids.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No fighters match those filters.';
      this.grid.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const id of ids) {
      const card = this._makeCard(id);
      frag.appendChild(card);
      this.cards.set(id, card);
    }
    this.grid.appendChild(frag);
    for (const [, card] of this.cards) this.observer.observe(card);
  }

  _makeCard(id) {
    const d = FIGHTERS[id];
    const unlocked = saveManager.isFighterUnlocked(id);
    const card = document.createElement('div');
    card.className = 'fcard';
    card.dataset.id = id;
    card.dataset.locked = String(!unlocked);
    card.setAttribute('role', 'option');
    card.innerHTML = `
      <div class="fcard__flags">
        <span class="fcard__flag fcard__flag--${d.playableStatus === PLAYABLE_STATUS.COMPLETE ? 'complete' : 'proto'}"
              title="${d.playableStatus === PLAYABLE_STATUS.COMPLETE ? 'Full unique move set' : 'Prototype template move set'}"></span>
        ${saveManager.isFavorite(id) ? '<span class="fcard__flag fcard__flag--fav"></span>' : ''}
      </div>
      <div class="fcard__art"><canvas width="96" height="128"></canvas></div>
      ${unlocked ? '' : '<div class="fcard__lock">🔒</div>'}
      <div class="fcard__name">${d.shortName}</div>`;

    let pressTimer = 0;
    let longPressed = false;
    card.addEventListener('pointerdown', () => {
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; this.openSheet(id); }, 420);
    });
    const clear = () => clearTimeout(pressTimer);
    card.addEventListener('pointerup', () => {
      clear();
      if (longPressed) return;
      audio.play('sfx_ui_move');
      if (!unlocked) { this.openSheet(id); return; }
      this.setP1(id);
    });
    card.addEventListener('pointerleave', clear);
    card.addEventListener('pointercancel', clear);
    card.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openSheet(id); });

    this._markCard(card, id);
    return card;
  }

  _paintCard(card) {
    if (card.dataset.painted === '1') return;
    card.dataset.painted = '1';
    const id = card.dataset.id;
    const canvas = card.querySelector('canvas');
    if (!canvas) return;
    FighterRenderer.paintPortrait(canvas, FIGHTERS[id], {
      locked: !saveManager.isFighterUnlocked(id),
    });
  }

  _markCard(card, id) {
    card.classList.toggle('is-p1', this.p1 === id);
    card.classList.toggle('is-p2', this.p2 === id);
  }

  refreshCard(id) {
    const card = this.cards.get(id);
    if (!card) return;
    card.dataset.locked = String(!saveManager.isFighterUnlocked(id));
    card.dataset.painted = '0';
    this._paintCard(card);
    const flags = card.querySelector('.fcard__flags');
    const fav = flags.querySelector('.fcard__flag--fav');
    if (saveManager.isFavorite(id) && !fav) {
      const s = document.createElement('span');
      s.className = 'fcard__flag fcard__flag--fav';
      flags.appendChild(s);
    } else if (!saveManager.isFavorite(id) && fav) {
      fav.remove();
    }
  }

  /* ------------------------------------------------------------ panels --- */

  setP1(id) {
    if (!saveManager.isFighterUnlocked(id)) {
      const st = unlocks.fighterStatus(id);
      toast(st?.purchasable ? `${FIGHTERS[id].displayName}: ${st.text}` : `Locked — ${st?.text}`);
      audio.play('sfx_ui_error');
      this.openSheet(id);
      return;
    }
    const prev = this.p1;
    this.p1 = id;
    if (prev) this._markCard(this.cards.get(prev) || document.createElement('div'), prev);
    for (const [cid, card] of this.cards) this._markCard(card, cid);
    this.renderPanels();
  }

  setP2(id) {
    if (!this.allowOpponent) return;
    this.p2 = id;
    for (const [cid, card] of this.cards) this._markCard(card, cid);
    this.renderPanels();
  }

  renderPanels() {
    this._panel(1, this.p1);
    if (this.allowOpponent) this._panel(2, this.p2);
    const btn = $('btn-select-confirm');
    const ok = !!this.p1 && (!this.allowOpponent || !!this.p2);
    btn.disabled = !ok;
    btn.textContent = ok ? 'Fight' : 'Choose a fighter';
  }

  _panel(n, id) {
    const nameEl = $(`name-p${n}`);
    const metaEl = $(`meta-p${n}`);
    const portrait = $(`portrait-p${n}`);
    if (!id) { nameEl.textContent = '—'; metaEl.textContent = ''; portrait.innerHTML = ''; return; }
    const d = FIGHTERS[id];
    nameEl.textContent = d.displayName;
    metaEl.textContent = `${labelize(d.archetype)} · ${'★'.repeat(d.difficulty)}`;
    portrait.innerHTML = '<canvas width="150" height="200"></canvas>';
    FighterRenderer.paintPortrait(portrait.querySelector('canvas'), d, {});
  }

  /* ----------------------------------------------------------- options --- */

  renderOptions() {
    const wrap = $('select-options');
    wrap.innerHTML = '';
    if (!this.showOptions) return;

    const cycle = (label, values, current, format, onChange) => {
      const el = document.createElement('div');
      el.className = 'opt';
      const value = document.createElement('strong');
      value.textContent = format(current);
      el.innerHTML = `<span>${label}</span>`;
      const prev = document.createElement('button');
      prev.type = 'button'; prev.textContent = '‹';
      const next = document.createElement('button');
      next.type = 'button'; next.textContent = '›';
      let idx = Math.max(0, values.indexOf(current));
      const step = (delta) => {
        idx = (idx + delta + values.length) % values.length;
        value.textContent = format(values[idx]);
        onChange(values[idx]);
        audio.play('sfx_ui_move');
      };
      prev.addEventListener('click', () => step(-1));
      next.addEventListener('click', () => step(1));
      el.append(prev, value, next);
      wrap.appendChild(el);
    };

    cycle('AI', DIFFICULTIES, this.options.difficulty,
      (v) => DIFFICULTY_LABELS[v], (v) => { this.options.difficulty = v; });
    cycle('Rounds', ROUND_COUNT_OPTIONS, this.options.rounds,
      (v) => String(v), (v) => { this.options.rounds = v; });
    cycle('Timer', TIMER_OPTIONS, this.options.timer,
      (v) => (v === 0 ? '∞' : `${v}s`), (v) => { this.options.timer = v; });
  }

  /* ------------------------------------------------------ detail sheet --- */

  openSheet(id) {
    this.sheetId = id;
    const info = roster.details(id);
    if (!info) return;
    const d = info.data;
    const el = $('sheet-content');

    const moveList = (title, list) => {
      if (!list.length) return '';
      return `<h4>${title}</h4><div class="movelist">${list.map((m) => `
        <div class="move${m.category === 'ultimate' ? ' move--ult' : ''}">
          <div class="move__top"><strong>${m.name}</strong><span>${m.damage ? `${m.damage} dmg` : ''}${m.chakraCost ? ` · ${m.chakraCost} ck` : ''}${m.cooldown ? ` · ${m.cooldown}s` : ''}</span></div>
          ${m.description ? `<div class="move__desc">${m.description}</div>` : ''}
        </div>`).join('')}</div>`;
    };

    const statRow = (label, value, max = 130) => `
      <div class="statrow"><span>${label}</span>
        <div class="statbar"><i style="width:${Math.min(100, (value / max) * 100)}%"></i></div>
        <em>${value}</em></div>`;

    const s = d.baseStats;
    el.innerHTML = `
      <div class="sheet__hero">
        <div class="sheet__hero-art"><canvas width="120" height="160"></canvas></div>
        <div class="sheet__hero-info">
          <h3 id="sheet-name">${d.displayName}</h3>
          <div class="row">
            <span class="tag ${info.complete ? 'tag--complete' : 'tag--proto'}">${info.complete ? 'Full move set' : 'Prototype'}</span>
            ${info.status.unlocked ? '' : '<span class="tag tag--locked">Locked</span>'}
            <span class="tag">${labelize(d.archetype)}</span>
          </div>
          <div class="row tiny muted">
            <span>${labelize(d.era)}</span>·<span>${labelize(d.village)}</span>
            ${d.clan !== 'none' ? `·<span>${labelize(d.clan)} clan</span>` : ''}
            ${d.organization !== 'none' ? `·<span>${labelize(d.organization)}</span>` : ''}
          </div>
          <div class="row tiny muted"><span>Difficulty ${'★'.repeat(d.difficulty)}${'☆'.repeat(5 - d.difficulty)}</span></div>
        </div>
      </div>

      ${info.status.unlocked ? '' : `<div class="settings__note">${info.status.text}${info.status.purchasable ? ` — you have ${saveManager.data.coins} ryo` : ''}</div>`}
      ${info.complete ? '' : '<div class="settings__note">This fighter has full metadata, transformations and unlock conditions, but their moves currently use a labelled archetype template rather than a hand-authored kit.</div>'}

      <p class="sheet__desc">${d.description || 'No description yet.'}</p>

      <h4>Mastery</h4>
      <div class="statrow"><span>Level ${info.mastery.level}</span>
        <div class="statbar"><i style="width:${Math.round(info.mastery.progress * 100)}%"></i></div>
        <em>${info.mastery.level}/10</em></div>

      <h4>Stats</h4>
      <div class="statlist">
        ${statRow('Health', s.health, 1200)}
        ${statRow('Attack', s.attack)}
        ${statRow('Defence', s.defense)}
        ${statRow('Speed', s.speed)}
        ${statRow('Chakra', s.chakra)}
        ${statRow('Control', s.chakraControl)}
        ${statRow('Guard', s.guard)}
        ${statRow('Substitution', s.substitution)}
        ${statRow('Awakening', s.awakeningRate)}
      </div>

      ${d.passiveAbilities.length ? `<h4>Passive</h4><p class="small muted">${d.passiveAbilities.join('<br>')}</p>` : ''}
      ${d.chakraNatures.length ? `<h4>Chakra natures</h4><div class="row wrap">${d.chakraNatures.map((n) => `<span class="tag">${labelize(n)}</span>`).join('')}</div>` : ''}

      ${moveList('Jutsu', info.jutsu)}
      ${info.ultimate ? moveList('Ultimate', [info.ultimate]) : ''}
      ${moveList('Ground chain', info.basics)}
      ${moveList('Air chain', info.airs)}
      ${moveList('Specials', info.specials)}

      <h4>Transformation chain</h4>
      ${info.transformations.length ? `
        <div class="chainlist">
          <span class="form">Base</span>
          ${info.transformations.map((t) => `<span class="arrow">→</span><span class="form" data-locked="${!t.unlock.unlocked}">${t.name}</span>`).join('')}
        </div>
        <div class="movelist" style="margin-top:.5rem">
          ${info.transformations.map((t) => `
            <div class="move">
              <div class="move__top"><strong>${t.name}</strong><span>${t.duration}</span></div>
              <div class="move__desc">Requires: ${t.requirement}. Drain: ${t.drain}.${t.unlock.unlocked ? '' : ` <b>${t.unlock.text}</b>`}</div>
              ${t.description ? `<div class="move__desc muted">${t.description}</div>` : ''}
            </div>`).join('')}
        </div>` : '<p class="small muted">No transformations.</p>'}

      ${info.assists.length ? `<h4>Assists</h4><div class="movelist">${info.assists.map((a) => `
        <div class="move"><div class="move__top"><strong>${a.displayName}</strong><span>${a.cooldown}s · ${a.chakraCost} ck</span></div>
        <div class="move__desc">${a.description}</div></div>`).join('')}</div>` : ''}

      <h4>AI personality</h4>
      <p class="small muted">${d.aiProfile} — the CPU plays this fighter accordingly.</p>

      <h4>Sprite set</h4>
      <div class="sheet__sprite">
        <img src="./assets/fighters/${d.id}/portrait.png" alt="${d.displayName} sprite" width="96" height="128" loading="lazy">
        <p class="small muted">
          ${d.displayName} has their own 19-animation sprite set in
          <code>assets/fighters/${d.id}/</code> — original pixel art generated
          from this fighter's design record, not shared with anyone else on the
          roster.
        </p>
      </div>
    `;

    FighterRenderer.paintPortrait(el.querySelector('.sheet__hero-art canvas'), d, {});
    $('btn-fav').textContent = saveManager.isFavorite(id) ? '★' : '☆';

    const pick1 = $('btn-pick-p1');
    pick1.disabled = !info.status.unlocked;
    if (info.status.purchasable && !info.status.unlocked) {
      pick1.disabled = !info.status.affordable;
      pick1.textContent = `Buy (${info.status.price} ryo)`;
      pick1.onclick = () => {
        const res = unlocks.purchase(id);
        toast(res.message);
        if (res.ok) { this.refreshCard(id); this.openSheet(id); }
      };
    } else {
      pick1.textContent = 'Player';
      pick1.onclick = () => { this.setP1(id); $('fighter-sheet').hidden = true; };
    }

    $('fighter-sheet').hidden = false;
  }

  /* ------------------------------------------------------ filter sheet --- */

  openFilters() {
    this.renderFilters();
    $('filter-sheet').hidden = false;
  }

  renderFilters() {
    const el = $('filter-content');
    const groups = [
      ['era', 'Era'],
      ['village', 'Village'],
      ['clan', 'Clan'],
      ['organization', 'Organisation'],
      ['archetype', 'Archetype'],
    ];
    el.innerHTML = groups.map(([key, title]) => `
      <div class="filter-group" data-key="${key}">
        <h4>${title}</h4>
        <div class="row wrap">
          ${roster.options[key].map((o) => `
            <button type="button" class="chip${roster.filters[key].has(o.value) ? ' is-on' : ''}" data-value="${o.value}">${o.label}</button>`).join('')}
        </div>
      </div>`).join('');

    el.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.closest('.filter-group').dataset.key;
        roster.toggleFilter(key, chip.dataset.value);
        chip.classList.toggle('is-on');
        audio.play('sfx_ui_move');
        this.renderGrid();
      });
    });
  }
}

export default SelectScreen;
