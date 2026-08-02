/**
 * Main menu screen.
 */

import saveManager from '../save-manager.js';
import progression from '../progression-manager.js';
import roster from '../roster-manager.js';
import story from '../story-manager.js';
import achievements from '../achievements-manager.js';
import audio from '../audio-manager.js';
import { MenuBackground } from '../menu-background.js';

const $ = (id) => document.getElementById(id);

const ITEMS = [
  { id: 'continue', label: 'Continue', hint: 'Resume the story where you left off.' },
  { id: 'story', label: 'Story', hint: 'The Severed Accord — an original ninja-world campaign.' },
  { id: 'versus', label: 'Versus', hint: 'Pick a fighter, an opponent, a stage and the rules.' },
  { id: 'arcade', label: 'Arcade', hint: 'A ladder of opponents ending with a boss.' },
  { id: 'survival', label: 'Survival', hint: 'Fight until you fall. Healing between waves is limited.' },
  { id: 'training', label: 'Training', hint: 'Dummy settings, frame data, combo damage and input display.' },
  { id: 'tower', label: 'Challenge Tower', hint: '100 floors of escalating special rules.' },
  { id: 'bossrush', label: 'Boss Rush', hint: 'Back-to-back boss fights with almost no recovery.' },
  { id: 'collection', label: 'Collection', hint: 'Every fighter, transformation and stage you have unlocked.' },
  { id: 'achievements', label: 'Achievements', hint: 'Titles and rewards for what you have done.' },
  { id: 'settings', label: 'Settings', hint: 'Graphics, audio, controls and accessibility.' },
  { id: 'credits', label: 'Credits', hint: 'About this project and its original assets.' },
];

export class MenuScreen {
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.nav = $('menu-nav');
    this.panelTitle = $('menu-panel-title');
    this.panelText = $('menu-panel-text');
    this.statsEl = $('menu-stats');
    this.bg = new MenuBackground($('menu-bg'));
    this.buttons = new Map();
    this._build();
  }

  _build() {
    this.nav.innerHTML = '';
    for (const item of ITEMS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu__item';
      b.dataset.id = item.id;
      b.innerHTML = `<span>${item.label}</span>`;
      const focus = () => this._focus(item);
      b.addEventListener('pointerenter', focus);
      b.addEventListener('focus', focus);
      b.addEventListener('click', () => {
        audio.play('sfx_ui_select');
        this._focus(item);
        this.onSelect?.(item.id);
      });
      this.nav.appendChild(b);
      this.buttons.set(item.id, b);
    }
  }

  _focus(item) {
    for (const [, b] of this.buttons) b.classList.remove('is-active');
    this.buttons.get(item.id)?.classList.add('is-active');
    this.panelTitle.textContent = item.label;
    this.panelText.textContent = item.hint;
    audio.play('sfx_ui_move', { volume: 0.5 });
  }

  refresh() {
    const save = saveManager.data;
    const p = progression.levelProgress();
    $('menu-player-line').textContent =
      `Level ${p.level} · ${save.coins.toLocaleString()} ryo${save.activeTitle ? ` · ${save.activeTitle}` : ''}`;

    // Continue is only meaningful when there is story progress to resume.
    const cont = story.continuePoint();
    const contBtn = this.buttons.get('continue');
    if (contBtn) {
      const chapters = story.chapters();
      const info = cont ? chapters.find((c) => c.id === cont.chapterId) : null;
      contBtn.dataset.locked = cont ? 'false' : 'true';
      contBtn.querySelector('small')?.remove();
      if (info) {
        const s = document.createElement('small');
        s.textContent = `Ch. ${info.index}`;
        contBtn.appendChild(s);
      }
    }

    this.statsEl.innerHTML = '';
    const chips = [
      `${roster.unlockedCount} / ${roster.count} fighters`,
      `${story.completedCount} / ${story.total} chapters`,
      `${achievements.earnedCount} / ${achievements.total} achievements`,
      `Tower floor ${save.tower.highestFloor || 0}`,
      `Survival wave ${save.survival.bestWave || 0}`,
    ];
    for (const c of chips) {
      const s = document.createElement('span');
      s.textContent = c;
      this.statsEl.appendChild(s);
    }
  }

  show() {
    this.refresh();
    this.bg.start();
    audio.playMusic('bgm_menu');
  }

  hide() {
    this.bg.stop();
  }
}

export default MenuScreen;
