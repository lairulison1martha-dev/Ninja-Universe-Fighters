/**
 * Assists.
 *
 * The player picks a second roster fighter before the match. Calling them
 * brings that fighter in for one scripted appearance — entry, one ability,
 * exit — and then they leave. They are never controllable, never a second
 * player, and never on the field between calls.
 *
 * The assist is a real `Fighter` instance so it draws with its own sprite set,
 * its own costume and the existing animator. It is deliberately kept OUT of
 * `engine.fighters`: it has no controller, takes no hits, is not a target, and
 * `assertPvE()` still counts exactly one human and one AI.
 */

import { assistFor } from '../data/fighter-assists.js';
import { getAbility } from '../data/abilities.js';
import { Fighter } from './fighter.js';
import { applyStatusEffects } from './status-effects.js';
import { setCentred, overlaps, SCRATCH } from './hitbox.js';

/** Share of `duration` spent arriving, acting and leaving. */
const PHASE = { entry: 0.28, act: 0.44 };

/** How each entry style places and moves the assist as it arrives. */
const ENTRY = {
  dash: { offset: 300, height: 0, fade: false },
  leap: { offset: 260, height: 240, fade: false },
  shunshin: { offset: 120, height: 0, fade: true },
  rise: { offset: 90, height: -110, fade: false },
  drop: { offset: 60, height: 380, fade: false },
};
const EXIT = {
  dash: { offset: 320, height: 0, fade: false },
  leap: { offset: 220, height: 300, fade: false },
  shunshin: { offset: 90, height: 0, fade: true },
  sink: { offset: 60, height: -120, fade: false },
};

export class AssistSystem {
  constructor(effects) {
    this.effects = effects;
    /** One slot per owning fighter, pre-allocated at match setup. */
    this.slots = new Map();
  }

  /**
   * Give a fighter their assist partner. `assistId` null means the player
   * chose to fight without one, which stays a valid loadout.
   */
  register(fighter, assistId = null) {
    const def = assistId ? assistFor(assistId) : null;
    const slot = {
      owner: fighter,
      assistId: def ? assistId : null,
      def,
      ability: def ? getAbility(def.abilityId) : null,
      partner: null,          // the Fighter used for drawing, built lazily
      active: false,
      phase: 'idle',          // idle | entry | act | exit
      time: 0,
      cooldown: 0,
      hasHit: false,
      alpha: 1,
      x: 0, y: 0, facing: 1,
      fromX: 0, fromY: 0, toX: 0, toY: 0,
    };
    this.slots.set(fighter.id, slot);
    return slot;
  }

  slotFor(fighter) { return this.slots.get(fighter?.id) || null; }

  /** The chosen partner's id, or null when this fighter has no assist. */
  assistIdFor(fighter) { return this.slotFor(fighter)?.assistId || null; }

  /** 0 = ready, 1 = just used — the fraction the HUD ring sweeps. */
  cooldownFor(fighter) {
    const s = this.slotFor(fighter);
    if (!s || !s.def) return 0;
    return s.cooldown / s.def.cooldown;
  }

  /** Seconds left, for a readable countdown. */
  cooldownSeconds(fighter) {
    return this.slotFor(fighter)?.cooldown ?? 0;
  }

  /**
   * Whether the assist can be called right now. Deliberately strict: no call
   * while one is already on screen, while cooling down, without the chakra, or
   * once the fighter is out of the fight.
   */
  available(fighter) {
    const s = this.slotFor(fighter);
    if (!s || !s.def || !s.ability) return false;
    if (s.active || s.cooldown > 0) return false;
    if (fighter.isDead) return false;
    return fighter.chakra >= s.def.chakraCost;
  }

  /** Why it is unavailable, for the error toast. */
  reason(fighter) {
    const s = this.slotFor(fighter);
    if (!s || !s.def) return 'No assist selected';
    if (s.active) return 'Assist is already out';
    if (s.cooldown > 0) return `Assist ready in ${Math.ceil(s.cooldown)}s`;
    if (fighter.chakra < s.def.chakraCost) return 'Not enough chakra';
    return 'Assist unavailable';
  }

  /**
   * Build the partner Fighter once and keep it. It is only ever drawn and
   * animated — it never steps combat, never has a controller, and is not in
   * the engine's fighter list.
   */
  _partner(slot) {
    if (slot.partner) return slot.partner;
    const f = new Fighter(slot.assistId, { side: slot.owner.side, ignoreUnlocks: true });
    f.costumeId = 'default';
    f.refreshSprite();
    f.isAssist = true;
    slot.partner = f;
    return f;
  }

  call(fighter, target) {
    if (!this.available(fighter)) return null;
    const s = this.slotFor(fighter);
    const def = s.def;

    fighter.chakra -= def.chakraCost;
    s.active = true;
    s.phase = 'entry';
    s.time = 0;
    s.hasHit = false;
    s.facing = fighter.facing;

    // Where they land: in front of the owner for a strike, beside them when
    // they are zoning or supporting rather than closing distance.
    const reach = def.aiBehavior === 'strike'
      ? Math.min(220, Math.abs((target?.x ?? fighter.x + 200) - fighter.x) * 0.6 + 60)
      : 40;
    s.toX = fighter.x + fighter.facing * reach;
    s.toY = fighter.y;

    const entry = ENTRY[def.entryStyle] || ENTRY.dash;
    s.fromX = s.toX - s.facing * entry.offset;
    s.fromY = s.toY + entry.height;
    s.x = s.fromX;
    s.y = s.fromY;
    s.alpha = entry.fade ? 0 : 1;

    const p = this._partner(s);
    p.facing = s.facing;
    p.x = s.x;
    p.y = s.y;
    p.animTime = 0;
    this._play(p, 'assistEntry');

    this.effects?.emit('summon_dust', s.toX, s.toY + 40, {
      scale: 1.1, color: fighter.data.colors.aura,
    });
    return def;
  }

  /**
   * Play an assist clip, falling back through the sheet's real clips. The
   * brief allows adding assistEntry / assistAttack / assistExit; where a sheet
   * does not carry them the existing clips stand in, so no fighter needs new
   * art to work as an assist.
   */
  _play(partner, clip) {
    const fallback = {
      assistEntry: ['assistEntry', 'dash', 'run', 'jump', 'idle'],
      assistAttack: ['assistAttack', 'heavyAttack', 'lightAttack', 'idle'],
      assistExit: ['assistExit', 'dash', 'jump', 'idle'],
    }[clip] || ['idle'];
    if (!partner.anim?.available) return;
    for (const name of fallback) {
      if (partner.anim.has(name)) { partner.anim.play(name, { force: true }); return; }
    }
  }

  update(dt, fighters, onHit) {
    for (const [, s] of this.slots) {
      if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);
      if (!s.active) continue;

      const def = s.def;
      s.time += dt;
      const t = s.time / def.duration;
      const entryEnd = PHASE.entry;
      const actEnd = PHASE.entry + PHASE.act;

      if (t < entryEnd) {
        if (s.phase !== 'entry') { s.phase = 'entry'; this._play(s.partner, 'assistEntry'); }
        const k = t / entryEnd;
        s.x = s.fromX + (s.toX - s.fromX) * k;
        s.y = s.fromY + (s.toY - s.fromY) * k;
        s.alpha = (ENTRY[def.entryStyle] || ENTRY.dash).fade ? k : 1;
      } else if (t < actEnd) {
        if (s.phase !== 'act') {
          s.phase = 'act';
          this._play(s.partner, 'assistAttack');
          this.effects?.emit(s.ability.effectId, s.x + s.facing * 60, s.y + 70, {
            scale: 1, color: s.owner.data.colors.aura,
          });
        }
        s.x = s.toX;
        s.y = s.toY;
        s.alpha = 1;
        this._checkHit(s, fighters, onHit);
      } else {
        if (s.phase !== 'exit') { s.phase = 'exit'; this._play(s.partner, 'assistExit'); }
        const k = (t - actEnd) / Math.max(0.001, 1 - actEnd);
        const ex = EXIT[def.exitStyle] || EXIT.dash;
        s.x = s.toX + s.facing * ex.offset * k;
        s.y = s.toY + ex.height * k;
        s.alpha = ex.fade ? 1 - k : 1;
      }

      const p = s.partner;
      if (p) {
        p.x = s.x;
        p.y = Math.max(0, s.y);
        p.facing = s.facing;
        p.animTime += dt;
        p.anim?.update(dt);
      }

      if (s.time >= def.duration) this._finish(s);
    }
  }

  /** One hit per call, using the assist ability's own reach and hitbox. */
  _checkHit(s, fighters, onHit) {
    const a = s.ability;
    if (!a || a.damage <= 0 || s.hasHit) return;
    const target = fighters.find((f) => f !== s.owner && !f.isDead);
    if (!target) return;
    setCentred(
      SCRATCH.a,
      s.x + s.facing * (a.range * 0.5),
      -(s.y - a.hitYOffset),
      a.range,
      a.hitHeight * 2,
    );
    target.hurtbox(SCRATCH.b);
    if (!overlaps(SCRATCH.a, SCRATCH.b)) return;
    s.hasHit = true;
    onHit?.(s.owner, target, a, s);
  }

  /** Take them off the field and start the cooldown. */
  _finish(s) {
    s.active = false;
    s.phase = 'idle';
    s.time = 0;
    s.alpha = 1;
    s.cooldown = s.def ? s.def.cooldown : 0;
  }

  /** Pull a live assist off the field without granting the cooldown refund. */
  clearActive() {
    for (const [, s] of this.slots) {
      if (s.active) this._finish(s);
    }
  }

  reset() {
    for (const [, s] of this.slots) {
      s.active = false;
      s.phase = 'idle';
      s.cooldown = 0;
      s.time = 0;
      s.hasHit = false;
      s.alpha = 1;
    }
  }

  /** Iterate live assists for rendering. */
  *live() {
    for (const [, s] of this.slots) if (s.active && s.partner) yield s;
  }
}
