/**
 * Boot sequence.
 *
 * The loading bar is driven by REAL initialisation stages — there are no
 * artificial delays. Each stage reports when it completes, and any failure is
 * shown on screen instead of leaving a blank page.
 */

import { APP_VERSION, TIPS } from './constants.js';
import saveManager from './save-manager.js';
import settings from './settings-manager.js';
import audio from './audio-manager.js';
import assets from './asset-loader.js';
import input from './input-manager.js';
import unlocks from './unlock-manager.js';
import validateAll from './data-validator.js';
import { game } from './main.js';

const $ = (id) => document.getElementById(id);

/* -------------------------------------------------------------------------- */
/* Loading screen                                                             */
/* -------------------------------------------------------------------------- */

const loading = {
  el: null,
  bar: null,
  status: null,
  progressbar: null,
  particles: null,
  raf: 0,
  tipTimer: 0,

  init() {
    this.el = $('loading-screen');
    this.bar = $('loading-bar');
    this.status = $('loading-status');
    this.progressbar = $('loading-progressbar');
    $('loading-version').textContent = `v${APP_VERSION}`;
    this.startParticles();
    this.rotateTips();
  },

  set(fraction, text) {
    const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    if (this.bar) this.bar.style.width = `${pct}%`;
    if (this.progressbar) this.progressbar.setAttribute('aria-valuenow', String(pct));
    if (text && this.status) this.status.textContent = text;
  },

  rotateTips() {
    const el = $('loading-tip');
    if (!el) return;
    let i = Math.floor(Math.random() * TIPS.length);
    el.textContent = TIPS[i];
    this.tipTimer = setInterval(() => {
      el.classList.add('is-fading');
      setTimeout(() => {
        i = (i + 1) % TIPS.length;
        el.textContent = TIPS[i];
        el.classList.remove('is-fading');
      }, 240);
    }, 3600);
  },

  startParticles() {
    const canvas = $('loading-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    globalThis.addEventListener('resize', resize, { passive: true });

    const motes = Array.from({ length: 46 }, () => ({
      x: Math.random(), y: Math.random(),
      v: 0.02 + Math.random() * 0.05,
      s: 0.6 + Math.random() * 1.6,
      p: Math.random() * 6.28,
      hue: Math.random() > 0.5 ? '#7fd4ff' : '#ff6a6a',
    }));

    let last = performance.now();
    const tick = (now) => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.v * dt;
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
        const x = m.x * w + Math.sin(now / 900 + m.p) * 22;
        const y = m.y * h;
        const a = 0.25 + 0.5 * Math.abs(Math.sin(now / 700 + m.p));
        ctx.globalAlpha = a;
        ctx.fillStyle = m.hue;
        ctx.beginPath();
        ctx.arc(x, y, 2.2 * m.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    this.raf = requestAnimationFrame(tick);
  },

  finish() {
    clearInterval(this.tipTimer);
    cancelAnimationFrame(this.raf);
    this.el?.classList.add('is-done');
    setTimeout(() => { if (this.el) this.el.style.display = 'none'; }, 600);
  },

  fail(err) {
    console.error('[boot]', err);
    clearInterval(this.tipTimer);
    const box = $('loading-error');
    const text = $('loading-error-text');
    if (box && text) {
      text.textContent = `${err?.message || err}\n\n${err?.stack || ''}`.trim();
      box.hidden = false;
    }
    this.set(1, 'Failed to start');
  },
};

/* -------------------------------------------------------------------------- */
/* Service worker                                                             */
/* -------------------------------------------------------------------------- */

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    $('loading-offline').textContent = 'Offline play unavailable';
    return null;
  }
  // Relative path so this works from a project subdirectory on GitHub Pages.
  try {
    const reg = await navigator.serviceWorker.register('./service-worker.js', {
      scope: './',
      updateViaCache: 'none',
    });
    $('loading-offline').textContent = navigator.onLine ? 'Offline play ready' : 'Offline';

    // Update handling: tell the user rather than swapping files mid-match.
    const showUpdate = (worker) => {
      const banner = $('update-banner');
      banner.hidden = false;
      $('btn-update').onclick = () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
        banner.hidden = true;
        setTimeout(() => globalThis.location.reload(), 300);
      };
      $('btn-update-dismiss').onclick = () => { banner.hidden = true; };
    };

    if (reg.waiting) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw);
      });
    });
    return reg;
  } catch (err) {
    console.warn('[boot] service worker registration failed', err);
    $('loading-offline').textContent = 'Offline play unavailable';
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Global input hardening                                                     */
/* -------------------------------------------------------------------------- */

function hardenMobileInput() {
  // Block pinch/double-tap zoom without blocking normal taps.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 320) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // Stop rubber-band scrolling / pull-to-refresh outside scrollable panes.
  document.addEventListener('touchmove', (e) => {
    const scrollable = e.target.closest?.('.scroll-y, .select__grid, .list__body, .stage__grid, .settings__body, .sheet__content, .menu__nav, .overlay__panel, .select__chips, .settings__tabs, .select__opts');
    if (!scrollable) e.preventDefault();
  }, { passive: false });

  // No long-press context menus anywhere in the game UI.
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    e.preventDefault();
  });
}

/** iOS needs a user gesture before audio can start. */
function wireAudioUnlock() {
  const unlock = async () => {
    await audio.unlock();
    audio.applyVolumes();
    if (audio.unlocked) {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      // Start the menu music once the player has interacted.
      if (document.getElementById('screen-menu')?.classList.contains('is-active')) {
        audio.playMusic('bgm_menu');
      }
    }
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}

/** Offer the PWA install prompt where the browser supports it. */
function wireInstallPrompt() {
  let deferred = null;
  const btn = $('btn-install');
  globalThis.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    if (btn) btn.hidden = false;
  });
  btn?.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
  globalThis.addEventListener('appinstalled', () => { if (btn) btn.hidden = true; });
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

const STAGES = [
  {
    label: 'Loading settings',
    run: async () => {
      const status = saveManager.load();
      settings.load();
      return status;
    },
  },
  {
    label: 'Restoring save data',
    run: async () => {
      if (saveManager.recoveredFromBackup) {
        console.warn('[boot] save recovered from backup copy');
      }
      if (!saveManager.storageAvailable) {
        console.warn('[boot] localStorage unavailable — progress will not persist');
      }
      return 'ok';
    },
  },
  {
    label: 'Loading fighter data',
    run: async () => {
      const { FIGHTER_ORDER } = await import('./data/fighters.js');
      return `${FIGHTER_ORDER.length} fighters`;
    },
  },
  {
    label: 'Validating fighter data',
    run: async () => {
      const report = validateAll();
      if (!report.ok) {
        console.error('[boot] data validation failed:', report.errors);
        throw new Error(`Data validation failed:\n${report.errors.slice(0, 8).join('\n')}`);
      }
      if (report.warnings.length) console.warn('[boot] data warnings:', report.warnings);
      globalThis.__NUF_REPORT = report;
      return `${report.stats.abilities} abilities, ${report.stats.transformations} forms`;
    },
  },
  {
    label: 'Loading stages',
    run: async () => {
      const { STAGE_COUNT } = await import('./data/stages.js');
      return `${STAGE_COUNT} stages`;
    },
  },
  {
    label: 'Preparing audio',
    run: async () => {
      audio.init();
      await audio.preload();
      return audio.ready ? 'ready' : 'unavailable';
    },
  },
  {
    label: 'Loading interface assets',
    run: async (report) => {
      await assets.preloadShell(report);
      return 'ok';
    },
  },
  {
    label: 'Preparing combat engine',
    run: async () => {
      // Import (and therefore parse) the combat modules now, so the first match
      // does not stall while the browser fetches them.
      await Promise.all([
        import('./combat/combat-engine.js'),
        import('./combat/fighter.js'),
        import('./combat/ai-controller.js'),
        import('./combat/stage-renderer.js'),
        import('./combat/fighter-renderer.js'),
      ]);
      input.init();
      return 'ok';
    },
  },
  {
    label: 'Checking unlocks',
    run: async () => {
      const newly = unlocks.refresh();
      return `${newly.length} new`;
    },
  },
  {
    label: 'Registering offline support',
    run: async () => {
      await registerServiceWorker();
      return 'ok';
    },
  },
];

async function boot() {
  loading.init();
  hardenMobileInput();
  wireAudioUnlock();
  wireInstallPrompt();
  $('loading-error-reload')?.addEventListener('click', () => globalThis.location.reload());

  const total = STAGES.length;
  for (let i = 0; i < total; i++) {
    const stage = STAGES[i];
    loading.set(i / total, stage.label);
    // Yield to the browser so the bar actually paints between stages.
    await new Promise((r) => requestAnimationFrame(() => r()));
    try {
      const detail = await stage.run((f) => loading.set((i + f) / total, stage.label));
      if (detail) console.info(`[boot] ${stage.label}: ${detail}`);
    } catch (err) {
      loading.fail(err);
      return;
    }
  }

  loading.set(1, 'Ready');
  await new Promise((r) => setTimeout(r, 180));

  try {
    $('app').hidden = false;
    game.init();
    // Exposed for debugging and for the automated browser checks.
    globalThis.__NUF_GAME = game;
  } catch (err) {
    loading.fail(err);
    return;
  }

  loading.finish();

  // Deep links from the manifest shortcuts.
  const mode = new URLSearchParams(globalThis.location.search).get('mode');
  if (mode) {
    setTimeout(() => game.onMenu(mode), 300);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// Surface unexpected errors instead of failing silently.
globalThis.addEventListener('error', (e) => {
  if (!$('app') || $('app').hidden) loading.fail(e.error || new Error(e.message));
});
globalThis.addEventListener('unhandledrejection', (e) => {
  if (!$('app') || $('app').hidden) loading.fail(e.reason || new Error('Unhandled rejection'));
});
