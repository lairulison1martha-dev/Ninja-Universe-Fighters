/**
 * The character preview on the select screen.
 *
 * Not a still portrait: it plays the fighter's idle loop from whatever sprite
 * set they are actually going to fight in, so the costume you picked is the
 * costume you see. It can be flipped to face either way, and when the art it
 * wants is not there it says so — in development only.
 *
 * Falls back, in order: costume set -> base fighter set -> procedural
 * silhouette. Every rung is a valid picture; none of them is an error state.
 */

import { spriteRegistry } from '../combat/sprite-animator.js';
import { SpriteAnimator } from '../combat/sprite-animator.js';
import { FighterRenderer } from '../combat/fighter-renderer.js';
import { FIGHTERS } from '../data/fighters.js';
import { getCostume } from '../data/costumes.js';
import assets from '../asset-loader.js';
import { assetDevMode } from '../asset-report.js';

const W = 150;
const H = 200;

export class CostumePreview {
  /** @param {HTMLElement} host the portrait frame to draw inside */
  constructor(host) {
    this.host = host;
    this.canvas = null;
    this.ctx = null;
    this.animator = null;
    this.sheet = null;
    this.fighterId = null;
    this.costumeId = 'default';
    this.facing = 1;
    this.raf = 0;
    this.last = 0;
  }

  _ensureCanvas() {
    if (this.canvas && this.canvas.isConnected) return;
    // The frame also holds the arrow buttons, so insert rather than replace.
    const existing = this.host.querySelector('canvas.preview__canvas');
    if (existing) { this.canvas = existing; } else {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'preview__canvas';
      this.canvas.width = W;
      this.canvas.height = H;
      this.host.insertBefore(this.canvas, this.host.firstChild);
    }
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Show a fighter wearing a costume. Safe to call on every panel refresh. */
  show(fighterId, costumeId = 'default') {
    this.fighterId = fighterId;
    this.costumeId = costumeId;
    this._ensureCanvas();
    this._resolve();
    // The art may still be in flight; re-resolve when it lands.
    assets.loadFighterArt(fighterId, costumeId).then(() => {
      if (this.fighterId === fighterId && this.costumeId === costumeId) this._resolve();
    });
    this._start();
  }

  _resolve() {
    const costume = getCostume(this.fighterId, this.costumeId);
    const wanted = costume.spriteSetId;
    const sheet = (wanted && spriteRegistry.get(wanted))
      || spriteRegistry.get(this.fighterId)
      || null;

    this.usingFallback = !!wanted && !spriteRegistry.get(wanted);
    this.sheet = sheet;
    if (sheet) {
      if (!this.animator || this.animator.meta !== sheet.meta) {
        this.animator = new SpriteAnimator(sheet.meta);
        this.animator.play('idle', { force: true });
      }
    } else {
      this.animator = null;
    }
    this._updateBadge(costume);
  }

  /**
   * The development badge. Normal players never see it: it appears only on
   * localhost or with ?devassets=1, and it only marks art that is knowingly
   * standing in for something else.
   */
  _updateBadge(costume) {
    const badge = document.getElementById('preview-badge');
    if (!badge) return;
    if (!assetDevMode()) { badge.hidden = true; return; }
    if (this.usingFallback) {
      badge.textContent = 'Fallback art';
      badge.hidden = false;
    } else if (costume && costume.assetStatus === 'placeholder') {
      badge.textContent = 'Placeholder';
      badge.hidden = false;
    } else if (costume && costume.id !== 'default' && costume.assetStatus === 'fallback') {
      badge.textContent = 'Base art';
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  flip() {
    this.facing = -this.facing;
    this._draw();
  }

  clear() {
    this.stop();
    this.fighterId = null;
    if (this.ctx) this.ctx.clearRect(0, 0, W, H);
    const badge = document.getElementById('preview-badge');
    if (badge) badge.hidden = true;
  }

  _start() {
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now) => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.animator) this.animator.update(dt);
      this._draw();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _draw() {
    if (!this.ctx || !this.fighterId) return;
    const ctx = this.ctx;
    const data = FIGHTERS[this.fighterId];
    ctx.clearRect(0, 0, W, H);

    if (!this.sheet || !this.sheet.image || !this.animator) {
      // Last rung: the procedural silhouette, which every fighter always has.
      FighterRenderer.drawPortrait(this.canvas, data, {});
      return;
    }

    const r = this.sheet.rect(this.animator.name, this.animator.index);
    if (!r) return;
    const scale = Math.max(1, Math.floor((H * 0.82) / this.sheet.bodyHeight));
    const dw = this.sheet.frameWidth * scale;
    const dh = this.sheet.frameHeight * scale;
    const dx = W / 2 - this.sheet.anchor.x * scale;
    const dy = H - 10 - this.sheet.anchor.y * scale;

    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (this.facing < 0) {
      // Mirror about the sprite's own centre so it stays in the frame.
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.sheet.image, r.sx, r.sy, r.sw, r.sh, dx, dy, dw, dh);
    ctx.restore();
  }
}

export default CostumePreview;
