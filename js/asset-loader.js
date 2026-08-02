/**
 * Asset loader.
 *
 * This project deliberately ships almost no binary assets — fighters, stages
 * and effects are all drawn procedurally, and audio is synthesised. What is
 * left is the icon set, which we warm so the loading screen and menu do not
 * pop, plus a small cache of pre-rendered roster portraits.
 *
 * Everything here uses RELATIVE paths so the game works from a GitHub Pages
 * project subdirectory.
 */

const ICONS = [
  './assets/icons/icon-96.png',
  './assets/icons/icon-192.png',
];

class AssetLoader {
  constructor() {
    this.images = new Map();
    this.portraits = new Map();
    this.loaded = 0;
    this.total = 0;
  }

  /** Resolve a relative asset path against the document, never the domain root. */
  url(path) {
    return new URL(path, document.baseURI).toString();
  }

  loadImage(path) {
    if (this.images.has(path)) return Promise.resolve(this.images.get(path));
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { this.images.set(path, img); resolve(img); };
      // A missing optional image must never break the boot sequence.
      img.onerror = () => { this.images.set(path, null); resolve(null); };
      img.src = this.url(path);
    });
  }

  /** Warm the images the shell needs. Resolves even if some fail. */
  async preloadShell(onProgress) {
    this.total = ICONS.length;
    this.loaded = 0;
    for (const p of ICONS) {
      await this.loadImage(p);
      this.loaded++;
      onProgress?.(this.loaded / this.total);
    }
    return true;
  }

  /**
   * Cache a rendered portrait canvas per fighter so the select screen does not
   * repaint the same art while scrolling back and forth.
   */
  portrait(fighterId, factory) {
    let c = this.portraits.get(fighterId);
    if (!c) {
      c = factory();
      this.portraits.set(fighterId, c);
      // Bound the cache: a 190-fighter roster would otherwise hold a lot of
      // canvases alive on a phone.
      if (this.portraits.size > 60) {
        const first = this.portraits.keys().next().value;
        this.portraits.delete(first);
      }
    }
    return c;
  }

  clearPortraits() { this.portraits.clear(); }
}

export const assets = new AssetLoader();
export default assets;
