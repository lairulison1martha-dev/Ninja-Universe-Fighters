/**
 * Screen manager: shows exactly one <section class="screen"> at a time, keeps a
 * navigation stack for the back button, and owns the orientation overlay.
 */

const FADE_MS = 240;

class ScreenManager extends EventTarget {
  constructor() {
    super();
    this.screens = new Map();
    this.current = null;
    this.stack = [];
    this.rotateEl = null;
    this.isPortrait = false;
    this._handlers = new Map();
  }

  init() {
    for (const el of document.querySelectorAll('[data-screen]')) {
      this.screens.set(el.dataset.screen, el);
    }
    this.rotateEl = document.getElementById('rotate-overlay');

    // Delegate every [data-action="back"] button.
    document.addEventListener('click', (e) => {
      const back = e.target.closest?.('[data-action="back"]');
      if (back) { e.preventDefault(); this.back(); }
    });

    // Hardware/browser back button maps to in-game back.
    globalThis.addEventListener('popstate', () => {
      if (this.stack.length > 0) {
        this.back();
        history.pushState({ nuf: true }, '');
      }
    });
    history.replaceState({ nuf: true }, '');
    history.pushState({ nuf: true }, '');

    this._bindOrientation();
  }

  /* --------------------------------------------------------- orientation -- */

  _bindOrientation() {
    const check = () => this.checkOrientation();
    globalThis.addEventListener('resize', check, { passive: true });
    globalThis.addEventListener('orientationchange', check, { passive: true });
    // visualViewport fires on iOS when the URL bar collapses.
    globalThis.visualViewport?.addEventListener('resize', check, { passive: true });
    matchMedia('(orientation: portrait)').addEventListener?.('change', check);
    check();
  }

  /**
   * Deliberately does NOT rely on screen.orientation.lock() — that is refused
   * on iOS Safari. We detect portrait from the actual viewport and show the
   * rotate overlay whenever the combat screen would be unusable.
   */
  checkOrientation() {
    const w = globalThis.innerWidth;
    const h = globalThis.innerHeight;
    const portrait = h > w;
    const wasPortrait = this.isPortrait;
    this.isPortrait = portrait;

    // Tablets are large enough that portrait menus are fine; only combat is
    // hard-locked to landscape.
    const bigScreen = Math.min(w, h) >= 700;
    const needsLandscape = this.current === 'combat' || this.current === 'layout';
    const show = portrait && (needsLandscape || !bigScreen);

    if (this.rotateEl) {
      this.rotateEl.hidden = !show;
      this.rotateEl.setAttribute('aria-hidden', String(!show));
    }
    if (wasPortrait !== portrait || show) {
      this.dispatchEvent(new CustomEvent('orientation', {
        detail: { portrait, blocking: show, width: w, height: h },
      }));
    }
    return show;
  }

  /* -------------------------------------------------------------- routing -- */

  /**
   * @param {string} name
   * @param {{ replace?: boolean, data?: any }} [opts]
   */
  show(name, opts = {}) {
    const el = this.screens.get(name);
    if (!el) {
      console.warn('[screens] unknown screen', name);
      return false;
    }
    if (this.current === name && !opts.force) return true;

    const prev = this.current;
    if (prev && !opts.replace) this.stack.push(prev);
    if (opts.replace && this.stack.length) { /* keep stack as-is */ }

    for (const [key, node] of this.screens) {
      if (key === name) continue;
      if (!node.hidden) {
        node.classList.remove('is-active');
        // Let the fade finish before hiding, unless motion is reduced.
        const hide = () => { if (this.current !== key) node.hidden = true; };
        if (document.body.dataset.motion === 'reduced') hide();
        else setTimeout(hide, FADE_MS);
      }
    }

    el.hidden = false;
    // force reflow so the opacity transition runs
    void el.offsetWidth;
    el.classList.add('is-active');
    this.current = name;

    this.dispatchEvent(new CustomEvent('show', { detail: { name, prev, data: opts.data } }));
    this.checkOrientation();
    return true;
  }

  back() {
    if (this.stack.length === 0) {
      this.dispatchEvent(new CustomEvent('back-root'));
      return false;
    }
    const target = this.stack.pop();
    this.show(target, { replace: true, force: true });
    this.dispatchEvent(new CustomEvent('back', { detail: { name: target } }));
    return true;
  }

  /** Clear the stack (used when entering a match or returning to the menu). */
  resetStack(root = 'menu') {
    this.stack = [];
    this.show(root, { replace: true, force: true });
  }

  is(name) { return this.current === name; }
}

export const screens = new ScreenManager();
export default screens;
