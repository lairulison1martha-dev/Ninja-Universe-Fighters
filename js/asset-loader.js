/**
 * Asset loader.
 *
 * Stages, effects and roster portraits are still drawn procedurally and audio
 * is synthesised, so the binary payload is small: the icon set, and the fighter
 * sprite atlases under assets/fighters/.
 *
 * Everything here uses RELATIVE paths so the game works from a GitHub Pages
 * project subdirectory.
 */

import { SpriteSheet, spriteRegistry } from './combat/sprite-animator.js';

const ICONS = [
  './assets/icons/icon-96.png',
  './assets/icons/icon-192.png',
];

/**
 * Sprite sets to load at boot. Adding a new one is a data change: drop the
 * folder in, add its id here, and any fighter with a matching `spriteId` picks
 * it up — everyone else falls back to `base-ninja`.
 */
const SPRITE_SETS = ['base-ninja'];

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
   * Load the fighter sprite atlases and register them.
   *
   * A missing or broken set is never fatal: the fighter renderer falls back to
   * the procedural silhouette, so the game still runs (just without sprites)
   * if the assets fail to fetch.
   *
   * @returns {Promise<{ loaded: string[], failed: string[] }>}
   */
  async loadSpriteSets(onProgress) {
    const loaded = [];
    const failed = [];
    for (let i = 0; i < SPRITE_SETS.length; i++) {
      const id = SPRITE_SETS[i];
      try {
        const res = await fetch(this.url(`./assets/fighters/${id}/fighter.json`), {
          cache: 'force-cache',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const meta = await res.json();
        // The path in the metadata is repo-relative; resolve it the same way as
        // every other asset so a Pages subdirectory still works.
        const image = await this.loadImage(`./${meta.spriteSheet.replace(/^\.?\//, '')}`);
        if (!image) throw new Error('sprite sheet image failed to load');
        spriteRegistry.add(id, new SpriteSheet(meta, image));
        loaded.push(id);
      } catch (err) {
        console.warn(`[assets] sprite set "${id}" unavailable — using procedural fighters`, err);
        failed.push(id);
      }
      onProgress?.((i + 1) / SPRITE_SETS.length);
    }
    return { loaded, failed };
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
