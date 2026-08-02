/**
 * Shared overlays: toast, confirm dialog, dialogue panel, pause and results.
 */

import audio from '../audio-manager.js';

const $ = (id) => document.getElementById(id);

let toastTimer = 0;

export function toast(message, ms = 2200) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/**
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, text, okLabel = 'Confirm', danger = true }) {
  return new Promise((resolve) => {
    const overlay = $('overlay-confirm');
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text || '';
    const ok = $('confirm-ok');
    const cancel = $('confirm-cancel');
    ok.textContent = okLabel;
    ok.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
    overlay.hidden = false;

    const finish = (value) => {
      overlay.hidden = true;
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      resolve(value);
    };
    const onOk = () => { audio.play('sfx_ui_select'); finish(true); };
    const onCancel = () => { audio.play('sfx_ui_back'); finish(false); };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}

/**
 * Play a sequence of dialogue lines. Resolves when the player taps past the last.
 * @param {Array<{speaker:string,text:string}>} lines
 */
export function playDialogue(lines) {
  return new Promise((resolve) => {
    const overlay = $('overlay-dialogue');
    const speakerEl = $('dialogue-speaker');
    const textEl = $('dialogue-text');
    let index = 0;
    let typing = null;

    const show = () => {
      const line = lines[index];
      speakerEl.textContent = line.speaker || '';
      textEl.textContent = '';
      let i = 0;
      clearInterval(typing);
      typing = setInterval(() => {
        i += 2;
        textEl.textContent = line.text.slice(0, i);
        if (i >= line.text.length) clearInterval(typing);
      }, 16);
    };

    const advance = () => {
      const line = lines[index];
      if (textEl.textContent.length < line.text.length) {
        clearInterval(typing);
        textEl.textContent = line.text;
        return;
      }
      index++;
      audio.play('sfx_ui_move');
      if (index >= lines.length) {
        overlay.hidden = true;
        overlay.removeEventListener('pointerdown', advance);
        clearInterval(typing);
        resolve();
        return;
      }
      show();
    };

    overlay.hidden = false;
    overlay.addEventListener('pointerdown', advance);
    show();
  });
}

/** Build a row of buttons into a container. */
export function buildActions(container, actions) {
  container.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${a.className || ''}`.trim();
    b.textContent = a.label;
    if (a.disabled) b.disabled = true;
    b.addEventListener('click', () => { audio.play('sfx_ui_select'); a.onClick?.(); });
    container.appendChild(b);
  }
}

export function showPause(actions) {
  const overlay = $('overlay-pause');
  buildActions($('pause-actions'), actions);
  overlay.hidden = false;
}

export function hidePause() {
  $('overlay-pause').hidden = true;
}

/**
 * @param {{ title: string, rows: Array<{label:string,value:string|number}>,
 *           level?: Object, unlocks?: Array, actions: Array }} opts
 */
export function showResults(opts) {
  const overlay = $('overlay-results');
  $('results-title').textContent = opts.title;
  const body = $('results-body');
  body.innerHTML = '';

  for (const r of opts.rows || []) {
    const row = document.createElement('div');
    row.className = 'results__row';
    row.innerHTML = `<span>${r.label}</span><strong>${r.value ?? ''}</strong>`;
    body.appendChild(row);
  }

  if (opts.level) {
    const wrap = document.createElement('div');
    wrap.className = 'results__level';
    wrap.innerHTML = `
      <div class="results__row"><span>Level ${opts.level.level}</span><strong>${opts.level.current} / ${opts.level.needed} XP</strong></div>
      <div class="bar bar--xp"><i style="transform:scaleX(${opts.level.fraction})"></i></div>`;
    body.appendChild(wrap);
  }

  if (opts.unlocks?.length) {
    const wrap = document.createElement('div');
    wrap.className = 'results__row';
    wrap.innerHTML = `<span>Unlocked</span><strong>${opts.unlocks.map((u) => u.name || u.id).join(', ')}</strong>`;
    body.appendChild(wrap);
  }

  if (opts.achievements?.length) {
    const wrap = document.createElement('div');
    wrap.className = 'results__row';
    wrap.innerHTML = `<span>Achievements</span><strong>${opts.achievements.map((a) => a.name).join(', ')}</strong>`;
    body.appendChild(wrap);
  }

  buildActions($('results-actions'), opts.actions || []);
  overlay.hidden = false;
}

export function hideResults() {
  $('overlay-results').hidden = true;
}

/** Ultimate cut-in panel. */
export function showCutIn(fighter, ability) {
  const el = document.getElementById('hud-cutin');
  const panel = document.getElementById('cutin-panel');
  if (!el || !panel) return;
  panel.innerHTML = `<span>${fighter.data.shortName}</span><strong>${ability.displayName}</strong>`;
  el.hidden = false;
  clearTimeout(el._timer);
  // restart the animation
  panel.style.animation = 'none';
  void panel.offsetWidth;
  panel.style.animation = '';
  el._timer = setTimeout(() => { el.hidden = true; }, 1100);
}

export function announce(text, seconds = 1.1) {
  const el = document.getElementById('hud-announce');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, seconds * 1000);
}

export { $ };
