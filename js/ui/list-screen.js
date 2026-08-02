/**
 * Generic list screen — used for Story, Arcade, Boss Rush, Challenge Tower,
 * Collection, Achievements and Credits.
 *
 * Every entry is a real, working destination: nothing here is a dead button.
 */

import audio from '../audio-manager.js';

const $ = (id) => document.getElementById(id);

export class ListScreen {
  constructor() {
    this.body = $('list-body');
    this.title = $('list-title');
    this.footer = $('list-footer');
    this.searchWrap = $('list-search-wrap');
    this.search = $('list-search');
    this.search.addEventListener('input', () => this._filter());
  }

  /**
   * @param {{
   *   title: string, single?: boolean, search?: boolean,
   *   sections: Array<{ title?: string, items: Array }>,
   *   footer?: Array<{label:string,onClick:Function,className?:string}>,
   *   html?: string
   * }} cfg
   */
  render(cfg) {
    this.title.textContent = cfg.title;
    this.body.classList.toggle('is-single', !!cfg.single);
    this.searchWrap.hidden = !cfg.search;
    if (cfg.search) this.search.value = '';
    this.body.innerHTML = '';

    if (cfg.html) {
      const wrap = document.createElement('div');
      wrap.className = 'credits';
      wrap.style.gridColumn = '1 / -1';
      wrap.innerHTML = cfg.html;
      this.body.appendChild(wrap);
    }

    for (const section of cfg.sections || []) {
      if (section.title) {
        const h = document.createElement('h3');
        h.className = 'section-title';
        h.textContent = section.title;
        this.body.appendChild(h);
      }
      if (!section.items.length) {
        const e = document.createElement('div');
        e.className = 'empty-state';
        e.textContent = section.empty || 'Nothing here yet.';
        this.body.appendChild(e);
        continue;
      }
      for (const item of section.items) this.body.appendChild(this._card(item));
    }

    if (cfg.footer?.length) {
      this.footer.hidden = false;
      this.footer.innerHTML = '';
      const opts = document.createElement('div');
      opts.className = 'select__opts';
      this.footer.appendChild(opts);
      for (const f of cfg.footer) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn ${f.className || ''}`.trim();
        b.textContent = f.label;
        b.addEventListener('click', () => { audio.play('sfx_ui_select'); f.onClick(); });
        this.footer.appendChild(b);
      }
    } else {
      this.footer.hidden = true;
    }
  }

  _card(item) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.dataset.locked = String(!!item.locked);
    card.dataset.search = `${item.title} ${item.subtitle || ''}`.toLowerCase();

    const tags = (item.tags || []).map((t) =>
      `<span class="tag ${t.className || ''}">${t.label || t}</span>`).join('');

    card.innerHTML = `
      <div class="card__title"><span>${item.title}</span>${item.badge ? `<span class="tag ${item.badgeClass || ''}">${item.badge}</span>` : ''}</div>
      ${item.subtitle ? `<div class="card__sub">${item.subtitle}</div>` : ''}
      ${tags ? `<div class="card__meta">${tags}</div>` : ''}
      ${item.progress !== undefined ? `<div class="card__progress"><i style="width:${Math.round(item.progress * 100)}%"></i></div>` : ''}`;

    card.addEventListener('click', () => {
      if (item.locked && !item.onLockedClick) {
        audio.play('sfx_ui_error');
        return;
      }
      audio.play('sfx_ui_select');
      (item.locked ? item.onLockedClick : item.onClick)?.();
    });
    return card;
  }

  _filter() {
    const q = this.search.value.trim().toLowerCase();
    for (const card of this.body.querySelectorAll('.card')) {
      card.style.display = !q || card.dataset.search.includes(q) ? '' : 'none';
    }
  }
}

export default ListScreen;
