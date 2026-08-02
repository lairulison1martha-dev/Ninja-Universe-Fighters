/**
 * Stage-select screen.
 */

import { STAGES, STAGE_ORDER } from '../data/stages.js';
import saveManager from '../save-manager.js';
import unlocks from '../unlock-manager.js';
import audio from '../audio-manager.js';
import { StageRenderer } from '../combat/stage-renderer.js';
import { toast } from './overlays.js';

const $ = (id) => document.getElementById(id);

export class StageScreen {
  constructor(onConfirm) {
    this.onConfirm = onConfirm;
    this.grid = $('stage-grid');
    this.selected = 'leaf_village';
    this.variant = 'day';
    $('btn-stage-confirm').addEventListener('click', () => {
      audio.play('sfx_ui_select');
      this.onConfirm?.({ stageId: this.selected, variant: this.variant });
    });
  }

  render(preselect) {
    if (preselect && STAGES[preselect]) this.selected = preselect;
    this.grid.innerHTML = '';
    for (const id of STAGE_ORDER) {
      const s = STAGES[id];
      const status = unlocks.stageStatus(id);
      const card = document.createElement('div');
      card.className = 'stage-card';
      card.dataset.id = id;
      card.dataset.locked = String(!status.unlocked);
      card.classList.toggle('is-selected', this.selected === id);
      card.innerHTML = `
        <canvas width="240" height="92"></canvas>
        <div class="stage-card__label">
          <strong>${s.displayName}</strong>
          <span>${status.unlocked ? s.description : status.text}</span>
        </div>`;
      const canvas = card.querySelector('canvas');
      StageRenderer.drawPreview(canvas, s, this.variant === 'night' ? 'night' : (s.defaultVariant || 'day'));
      card.addEventListener('click', () => {
        if (!status.unlocked) { toast(status.text); audio.play('sfx_ui_error'); return; }
        audio.play('sfx_ui_move');
        this.selected = id;
        this.grid.querySelectorAll('.stage-card').forEach((c) => c.classList.toggle('is-selected', c.dataset.id === id));
      });
      this.grid.appendChild(card);
    }
    this.renderOptions();
  }

  renderOptions() {
    const wrap = $('stage-options');
    wrap.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'opt';
    el.innerHTML = '<span>Time of day</span>';
    const value = document.createElement('strong');
    const options = ['day', 'night', 'random'];
    let idx = options.indexOf(this.variant);
    if (idx < 0) idx = 0;
    value.textContent = options[idx];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '›';
    btn.addEventListener('click', () => {
      idx = (idx + 1) % options.length;
      this.variant = options[idx];
      value.textContent = options[idx];
      audio.play('sfx_ui_move');
      this.render(this.selected);
    });
    el.append(value, btn);
    wrap.appendChild(el);

    const random = document.createElement('button');
    random.type = 'button';
    random.className = 'btn btn--ghost btn--sm';
    random.textContent = 'Random stage';
    random.addEventListener('click', () => {
      const pool = saveManager.data.unlockedStages;
      this.selected = pool[Math.floor(Math.random() * pool.length)];
      audio.play('sfx_ui_select');
      this.render(this.selected);
    });
    wrap.appendChild(random);
  }

  resolveVariant() {
    if (this.variant === 'random') return Math.random() > 0.5 ? 'night' : 'day';
    return this.variant;
  }
}

export default StageScreen;
