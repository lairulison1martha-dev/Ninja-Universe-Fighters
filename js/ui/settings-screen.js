/**
 * Settings screen.
 *
 * Every control here is wired to settings-manager and takes effect immediately.
 */

import settings from '../settings-manager.js';
import saveManager from '../save-manager.js';
import audio from '../audio-manager.js';
import { QUALITY_LEVELS, FPS_TARGETS, DIFFICULTIES, DIFFICULTY_LABELS, LANGUAGES, APP_VERSION } from '../constants.js';
import { toast, confirmDialog } from './overlays.js';

const $ = (id) => document.getElementById(id);

const TABS = [
  { id: 'graphics', label: 'Graphics' },
  { id: 'audio', label: 'Audio' },
  { id: 'controls', label: 'Controls' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'access', label: 'Accessibility' },
  { id: 'data', label: 'Save data' },
];

export class SettingsScreen {
  constructor(hooks = {}) {
    this.hooks = hooks;   // { openLayoutEditor, clearCache }
    this.tab = 'graphics';
    this.tabsEl = $('settings-tabs');
    this.body = $('settings-body');
    this._buildTabs();
  }

  _buildTabs() {
    this.tabsEl.innerHTML = '';
    for (const t of TABS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `chip${this.tab === t.id ? ' is-on' : ''}`;
      b.textContent = t.label;
      b.addEventListener('click', () => {
        audio.play('sfx_ui_move');
        this.tab = t.id;
        this._buildTabs();
        this.render();
      });
      this.tabsEl.appendChild(b);
    }
  }

  /* ------------------------------------------------------------ widgets -- */

  _group(title) {
    const g = document.createElement('div');
    g.className = 'settings__group';
    if (title) {
      const h = document.createElement('h3');
      h.textContent = title;
      g.appendChild(h);
    }
    this.body.appendChild(g);
    return g;
  }

  _row(group, label, description) {
    const row = document.createElement('div');
    row.className = 'setting';
    row.innerHTML = `<div class="setting__label"><strong>${label}</strong>${description ? `<span>${description}</span>` : ''}</div>`;
    const control = document.createElement('div');
    control.className = 'setting__control';
    row.appendChild(control);
    group.appendChild(row);
    return control;
  }

  _toggle(group, label, description, key, onChange) {
    const c = this._row(group, label, description);
    const t = document.createElement('button');
    t.type = 'button';
    t.className = `toggle${settings.values[key] ? ' is-on' : ''}`;
    t.setAttribute('role', 'switch');
    t.setAttribute('aria-checked', String(!!settings.values[key]));
    t.addEventListener('click', () => {
      const v = !settings.values[key];
      settings.set(key, v);
      t.classList.toggle('is-on', v);
      t.setAttribute('aria-checked', String(v));
      audio.play('sfx_ui_move');
      onChange?.(v);
    });
    c.appendChild(t);
  }

  _segmented(group, label, description, key, options, onChange) {
    const c = this._row(group, label, description);
    const seg = document.createElement('div');
    seg.className = 'segmented';
    for (const o of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.className = settings.values[key] === o.value ? 'is-on' : '';
      b.addEventListener('click', () => {
        settings.set(key, o.value);
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('is-on'));
        b.classList.add('is-on');
        audio.play('sfx_ui_move');
        onChange?.(o.value);
      });
      seg.appendChild(b);
    }
    c.appendChild(seg);
  }

  _slider(group, label, description, key, { min = 0, max = 1, step = 0.05, format } = {}, onChange) {
    const c = this._row(group, label, description);
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step;
    input.value = settings.values[key];
    const out = document.createElement('output');
    const fmt = format || ((v) => `${Math.round(v * 100)}%`);
    out.textContent = fmt(Number(input.value));
    const paint = () => {
      const pct = ((Number(input.value) - min) / (max - min)) * 100;
      input.style.setProperty('--fill', `${pct}%`);
    };
    paint();
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = fmt(v);
      paint();
      settings.set(key, v);
      onChange?.(v);
    });
    wrap.append(input, out);
    c.appendChild(wrap);
  }

  _button(group, label, description, text, onClick, className = 'btn--ghost') {
    const c = this._row(group, label, description);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${className}`;
    b.textContent = text;
    b.addEventListener('click', () => { audio.play('sfx_ui_select'); onClick(b); });
    c.appendChild(b);
    return b;
  }

  /* ------------------------------------------------------------- render -- */

  render() {
    this.body.innerHTML = '';
    switch (this.tab) {
      case 'graphics': this._graphics(); break;
      case 'audio': this._audio(); break;
      case 'controls': this._controls(); break;
      case 'gameplay': this._gameplay(); break;
      case 'access': this._access(); break;
      case 'data': this._data(); break;
      default: break;
    }
  }

  _graphics() {
    const g = this._group('Performance');
    this._segmented(g, 'Graphics quality', 'Lower settings reduce particles and resolution.', 'quality',
      QUALITY_LEVELS.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })));
    this._segmented(g, 'Frame-rate target', 'Cap the frame rate to save battery.', 'fpsTarget',
      FPS_TARGETS.map((v) => ({ value: v, label: `${v}` })));

    const e = this._group('Effects');
    this._slider(e, 'Effects amount', 'How many particles combat spawns.', 'effects', { min: 0, max: 1, step: 0.1 });
    this._slider(e, 'Screen shake', '', 'screenShake', { min: 0, max: 1.5, step: 0.1 });
    this._slider(e, 'Menu background', 'Set to 0 to freeze the animated menu background.', 'backgroundEffects', { min: 0, max: 1, step: 0.1 });
    this._toggle(e, 'Hit flash', 'Flash fighters white when they are hit.', 'hitFlash');
    this._toggle(e, 'Damage numbers', '', 'damageNumbers');
    this._segmented(e, 'Time of day', 'Menu and stage lighting.', 'dayNight', [
      { value: 'auto', label: 'Auto' }, { value: 'day', label: 'Day' }, { value: 'night', label: 'Night' },
    ]);
  }

  _audio() {
    const g = this._group('Volume');
    const apply = () => audio.applyVolumes();
    this._slider(g, 'Master', '', 'masterVolume', {}, apply);
    this._slider(g, 'Music', '', 'musicVolume', {}, apply);
    this._slider(g, 'Sound effects', '', 'sfxVolume', {}, () => { apply(); audio.play('sfx_hit_light'); });
    this._slider(g, 'Voice', 'Reserved for future voice placeholders.', 'voiceVolume', {}, apply);
    this._toggle(g, 'Mute everything', '', 'muted', apply);

    const n = this._group('About the audio');
    const note = document.createElement('div');
    note.className = 'settings__note';
    note.textContent = 'All music and sound effects in this game are generated at runtime with the Web Audio API. No copyrighted anime music or voice lines are used or downloaded.';
    n.appendChild(note);
  }

  _controls() {
    const g = this._group('On-screen controls');
    this._segmented(g, 'Show touch controls', '', 'showTouchControls', [
      { value: 'auto', label: 'Auto' }, { value: 'always', label: 'Always' }, { value: 'never', label: 'Never' },
    ]);
    this._slider(g, 'Control size', '', 'controlScale', { min: 0.7, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}×` });
    this._slider(g, 'Control opacity', '', 'controlOpacity', { min: 0.25, max: 1, step: 0.05 });
    this._toggle(g, 'Left-handed layout', 'Mirrors the controls horizontally.', 'leftHanded');
    this._toggle(g, 'Vibration', 'Haptic feedback on button presses, where supported.', 'vibration', (v) => { if (v) settings.vibrate(20); });
    this._button(g, 'Button layout', 'Drag each control where you want it.', 'Edit layout',
      () => this.hooks.openLayoutEditor?.(), 'btn--primary');
    this._button(g, 'Reset layout', 'Restore the default button positions.', 'Reset', async () => {
      if (await confirmDialog({ title: 'Reset control layout?', text: 'Buttons return to their default positions.', okLabel: 'Reset' })) {
        settings.resetLayout();
        toast('Control layout reset.');
      }
    });

    const j = this._group('Joystick');
    this._segmented(j, 'Joystick mode', 'Floating places the stick wherever you touch.', 'joystickMode', [
      { value: 'fixed', label: 'Fixed' }, { value: 'floating', label: 'Floating' },
    ]);
    this._slider(j, 'Sensitivity', '', 'joystickSensitivity', { min: 0.5, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}×` });
    this._slider(j, 'Dead zone', 'How far you must move before the fighter walks.', 'joystickDeadzone', { min: 0.02, max: 0.4, step: 0.02 });
    this._slider(j, 'Touch sensitivity', '', 'touchSensitivity', { min: 0.5, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}×` });

    const k = this._group('Keyboard (desktop testing)');
    const note = document.createElement('div');
    note.className = 'settings__note';
    note.innerHTML = 'Move <b>WASD / arrows</b> · Light <b>J</b> · Heavy <b>K</b> · Jutsu <b>U / I / Y</b> · Ultimate <b>O</b> · Guard <b>L</b> · Substitution <b>;</b> · Awaken <b>P</b> · Assist <b>H</b> · Jump <b>Space</b> · Dash <b>Shift</b> · Pause <b>Esc</b>. Gamepads are polled with the standard mapping.';
    k.appendChild(note);
  }

  _gameplay() {
    const g = this._group('Match defaults');
    this._segmented(g, 'Default AI difficulty', '', 'defaultDifficulty',
      DIFFICULTIES.map((v) => ({ value: v, label: DIFFICULTY_LABELS[v] })));
    this._segmented(g, 'Default rounds', '', 'defaultRounds',
      [1, 3, 5].map((v) => ({ value: v, label: String(v) })));
    this._segmented(g, 'Default timer', '', 'defaultTimer',
      [60, 99, 180, 0].map((v) => ({ value: v, label: v === 0 ? '∞' : `${v}s` })));
    this._toggle(g, 'Input buffering', 'Keeps quick presses during recovery instead of dropping them.', 'inputBuffer');
  }

  _access() {
    const g = this._group('Display');
    this._toggle(g, 'Reduced motion', 'Removes UI animation and screen transitions.', 'reducedMotion');
    this._toggle(g, 'High contrast', 'Stronger text and border contrast.', 'highContrast');
    this._segmented(g, 'Text size', '', 'textSize', [
      { value: 'small', label: 'S' }, { value: 'normal', label: 'M' },
      { value: 'large', label: 'L' }, { value: 'xlarge', label: 'XL' },
    ]);
    this._segmented(g, 'Language', 'Only English ships today; the framework is in place.', 'language',
      LANGUAGES.map((l) => ({ value: l.id, label: l.label })));
  }

  _data() {
    const g = this._group('Save slots');
    const slots = saveManager.listSlots();
    for (const s of slots) {
      const c = this._row(g, `Slot ${s.slot + 1}${saveManager.slot === s.slot ? ' (active)' : ''}`,
        s.empty ? 'Empty' : s.corrupt ? 'Unreadable — preserved, not deleted'
          : `Level ${s.level} · ${s.fighters} fighters · ${s.chapters} chapters`);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--ghost btn--sm';
      b.textContent = saveManager.slot === s.slot ? 'Active' : 'Switch';
      b.disabled = saveManager.slot === s.slot;
      b.addEventListener('click', () => {
        saveManager.switchSlot(s.slot);
        settings.load();
        toast(`Switched to slot ${s.slot + 1}`);
        this.render();
      });
      c.appendChild(b);
    }

    const io = this._group('Export / import');
    const wrap = document.createElement('div');
    wrap.className = 'settings__io';
    const ta = document.createElement('textarea');
    ta.placeholder = 'Paste save data here to import, or press Export to fill this box.';
    ta.spellcheck = false;
    wrap.appendChild(ta);
    io.appendChild(wrap);

    this._button(io, 'Export save', 'Copy this text somewhere safe.', 'Export', async () => {
      ta.value = saveManager.exportSave();
      ta.select();
      try {
        await navigator.clipboard.writeText(ta.value);
        toast('Save copied to the clipboard.');
      } catch {
        toast('Save exported into the box below — copy it manually.');
      }
    });
    this._button(io, 'Import save', 'Your current save is backed up first.', 'Import', async () => {
      if (!ta.value.trim()) { toast('Paste save data into the box first.'); return; }
      if (!await confirmDialog({
        title: 'Import save?',
        text: 'This replaces the current slot. Your existing save is backed up automatically.',
        okLabel: 'Import',
      })) return;
      const res = saveManager.importSave(ta.value);
      toast(res.message);
      if (res.ok) { settings.load(); this.render(); }
    });

    const danger = this._group('Reset');
    this._button(danger, 'Reset progress', 'Fighters, story, records and achievements. Settings are kept.', 'Reset save', async () => {
      if (!await confirmDialog({
        title: 'Reset all progress?',
        text: 'Unlocks, story progress, records and achievements are cleared. A backup copy is kept in storage. This cannot be undone from inside the game.',
        okLabel: 'Reset everything',
      })) return;
      saveManager.resetSave({ keepSettings: true });
      toast('Progress reset.');
      this.render();
    }, 'btn--danger');

    const cache = this._group('App');
    const info = document.createElement('div');
    info.className = 'settings__note';
    info.innerHTML = `Version <b>${APP_VERSION}</b>. Offline support is handled by a service worker. If an update does not appear after a new deployment, clear the cache below and reload.`;
    cache.appendChild(info);
    this._button(cache, 'Clear offline cache', 'Forces the next load to fetch fresh files.', 'Clear cache', async () => {
      if (!await confirmDialog({
        title: 'Clear the offline cache?',
        text: 'Your save is not affected. The game will re-download itself the next time it is opened with a connection.',
        okLabel: 'Clear cache',
      })) return;
      await this.hooks.clearCache?.();
      toast('Cache cleared. Reload the app to fetch the latest version.');
    }, 'btn--danger');
  }
}

export default SettingsScreen;
