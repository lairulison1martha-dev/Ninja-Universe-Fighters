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
import { getCostume } from './data/costumes.js';
import { FIGHTERS } from './data/fighters.js';
import { TRANSFORMATIONS } from './data/transformations.js';

const ICONS = [
  './assets/icons/icon-96.png',
  './assets/icons/icon-192.png',
];

class AssetLoader {
  constructor() {
    this.images = new Map();
    this.portraits = new Map();
    this.spriteManifest = null;
    this.spriteIds = null;
    this._spritePending = new Map();
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

  /* ------------------------------------------------------- sprite sets -- */

  /**
   * Read the sprite manifest: which fighters have art, and which of those are
   * precached for a first offline run.
   */
  async loadSpriteManifest() {
    if (this.spriteManifest) return this.spriteManifest;
    try {
      const res = await fetch(this.url('./assets/fighters/manifest.json'), { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.spriteManifest = await res.json();
    } catch (err) {
      console.warn('[assets] sprite manifest unavailable — procedural fighters only', err);
      this.spriteManifest = { fighters: [], precached: [] };
    }
    this.spriteIds = new Set(this.spriteManifest.fighters || []);
    return this.spriteManifest;
  }

  hasSpriteSet(id) {
    return !!this.spriteIds && this.spriteIds.has(id);
  }

  /**
   * Load one fighter's sprite set and register it.
   *
   * Sets are fetched per match rather than all at boot: 192 atlases is several
   * megabytes, and a phone should not download the whole roster to play one
   * fight. The service worker caches each one the first time it is fetched, so
   * a fighter you have used before still works offline.
   *
   * Failure is never fatal — the renderer falls back to the procedural
   * silhouette for that fighter alone.
   */
  async loadSpriteSet(id) {
    if (!id) return null;
    const existing = spriteRegistry.get(id);
    if (existing) return existing;
    const pending = this._spritePending.get(id);
    if (pending) return pending;

    const job = (async () => {
      try {
        const res = await fetch(this.url(`./assets/fighters/${id}/fighter.json`), {
          cache: 'force-cache',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const meta = await res.json();
        // Paths in the metadata are repo-relative; resolve them like every
        // other asset so a Pages subdirectory still works.
        const image = await this.loadImage(`./${meta.spriteSheet.replace(/^\.?\//, '')}`);
        if (!image) throw new Error('sprite sheet image failed to load');
        return spriteRegistry.add(id, new SpriteSheet(meta, image));
      } catch (err) {
        console.warn(`[assets] sprite set "${id}" unavailable — procedural fallback`, err);
        return null;
      } finally {
        this._spritePending.delete(id);
      }
    })();
    this._spritePending.set(id, job);
    return job;
  }

  /**
   * Load a costume or transformation sprite set.
   *
   * Variant sets live beside the fighter they belong to and are registered
   * under `<fighter>__<variant>`, which is exactly what
   * `costume.spriteSetId` / `transformation.spriteSetId` hold. A set that is
   * not there resolves to null and the caller falls back — never an error.
   *
   * @param {string} fighterId
   * @param {'costumes'|'forms'} kind
   * @param {string} variantId
   */
  async loadVariantSet(fighterId, kind, variantId) {
    if (!fighterId || !variantId) return null;
    const setId = kind === 'forms' ? variantId : `${fighterId}__${variantId}`;
    const existing = spriteRegistry.get(setId);
    if (existing) return existing;
    const pending = this._spritePending.get(setId);
    if (pending) return pending;

    const job = (async () => {
      try {
        const base = `./assets/fighters/${fighterId}/${kind}/${variantId}`;
        const res = await fetch(this.url(`${base}/fighter.json`), { cache: 'force-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const meta = await res.json();
        const image = await this.loadImage(`${base}/sprite-sheet.png`);
        if (!image) throw new Error('sprite sheet image failed to load');
        return spriteRegistry.add(setId, new SpriteSheet(meta, image));
      } catch (err) {
        console.warn(`[assets] ${kind === 'forms' ? 'transformation' : 'costume'} set `
          + `"${setId}" unavailable — falling back`, err);
        return null;
      } finally {
        this._spritePending.delete(setId);
      }
    })();
    this._spritePending.set(setId, job);
    return job;
  }

  /**
   * Everything one fighter needs for a match: their base set, the costume they
   * are wearing, and every transformation in their chain that has its own art.
   *
   * Forms are fetched up front because a transformation happens mid-fight and
   * must not stall on a network round trip; they are small, and there are at
   * most a handful per fighter.
   */
  async loadFighterArt(fighterId, costumeId = 'default') {
    const jobs = [this.loadSpriteSet(fighterId)];
    const costume = getCostume(fighterId, costumeId);
    if (costume.spriteSetId) jobs.push(this.loadVariantSet(fighterId, 'costumes', costume.id));
    for (const formId of FIGHTERS[fighterId]?.transformations || []) {
      const form = TRANSFORMATIONS[formId];
      if (form?.spriteSetId) jobs.push(this.loadVariantSet(fighterId, 'forms', form.spriteSetId));
    }
    await Promise.all(jobs);
    return spriteRegistry.get(fighterId);
  }

  /** Load several sets at once — used before a match starts. */
  async loadSpriteSets(ids, onProgress) {
    const wanted = [...new Set(ids.filter(Boolean))];
    const loaded = [];
    const failed = [];
    let done = 0;
    await Promise.all(wanted.map(async (id) => {
      const set = await this.loadSpriteSet(id);
      (set ? loaded : failed).push(id);
      done++;
      onProgress?.(done / wanted.length);
    }));
    return { loaded, failed };
  }

  /** Portrait image path for a fighter, or null when they have no set. */
  portraitPath(id) {
    return this.hasSpriteSet(id) ? `./assets/fighters/${id}/portrait.png` : null;
  }

  /**
   * Any image by repo-relative path, if it is already decoded; else null, and
   * start fetching it. Same lazy contract as `portraitImage`.
   */
  imageAt(path, onReady) {
    if (!path) return null;
    const rel = `./${String(path).replace(/^\.?\//, '')}`;
    if (this.images.has(rel)) return this.images.get(rel);
    this.loadImage(rel).then((img) => { if (img && onReady) onReady(img); });
    return null;
  }

  /**
   * A fighter's portrait image if it is already decoded, else null — and start
   * fetching it, calling `onReady` when it arrives.
   *
   * Portraits are ~1 KB each, so the select screen can pull them in as cards
   * scroll into view without the roster costing a download up front.
   */
  portraitImage(id, onReady) {
    const path = this.portraitPath(id);
    if (!path) return null;
    if (this.images.has(path)) return this.images.get(path);
    this.loadImage(path).then((img) => { if (img && onReady) onReady(img); });
    return null;
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
