/**
 * Transformation system.
 *
 * Enforces the rule that transformations must NOT activate just because the
 * button was pressed. Every declared requirement is checked, and the reason a
 * form is unavailable is reported back so the UI can say why.
 */

import { TRANSFORMATIONS } from '../data/transformations.js';
import { getAbility } from '../data/abilities.js';
import saveManager from '../save-manager.js';
import { evaluateUnlock } from '../data/unlocks.js';

/**
 * Which form would this fighter transform into next?
 * @returns {string|null} transformation id
 */
export function nextFormFor(fighter) {
  const options = nextFormOptions(fighter);
  return options.length ? options[0] : null;
}

/**
 * Every form that follows this fighter's current one in the graph.
 *
 * A chain is usually a line, but a form can branch — Naruto's Baryon Mode
 * hangs off both Kurama stages without sitting between them and Six Paths.
 * This returns the raw outgoing edges; legality is a separate question.
 *
 * @returns {string[]} transformation ids, in declaration order
 */
export function nextFormOptions(fighter) {
  const chain = fighter.data.transformations;
  if (!chain || chain.length === 0) return [];
  if (!fighter.form) {
    // From base, the entry points are the forms nothing else leads to.
    const entries = chain.filter((id) => {
      const t = TRANSFORMATIONS[id];
      return t && (t.previousForms ? t.previousForms.length === 0 : !t.previousForm);
    });
    return entries.length ? entries : [chain[0]];
  }
  const cur = TRANSFORMATIONS[fighter.form];
  if (!cur) return [];
  if (cur.nextForms && cur.nextForms.length) return cur.nextForms.slice();
  return cur.nextForm ? [cur.nextForm] : [];
}

/**
 * The forms this fighter could legally transform into right now.
 *
 * What the Awakening button acts on: one option means transform, several mean
 * ask. Each carries its own reason so the UI can show why a branch is greyed
 * out rather than silently omitting it.
 *
 * @returns {Array<{id, form, ok, reason}>}
 */
export function legalNextForms(fighter, { includeBlocked = false } = {}) {
  const out = [];
  for (const id of nextFormOptions(fighter)) {
    const check = canTransform(fighter, id);
    if (check.ok || includeBlocked) {
      out.push({ id, form: check.form, ok: check.ok, reason: check.reason });
    }
  }
  return out;
}

/**
 * Check every requirement.
 * @returns {{ ok: boolean, reason: string, form: Object|null }}
 */
export function canTransform(fighter, formId = null) {
  const id = formId || nextFormFor(fighter);
  if (!id) return { ok: false, reason: 'No further form', form: null };
  const form = TRANSFORMATIONS[id];
  if (!form) return { ok: false, reason: 'Unknown form', form: null };

  if (fighter.transformDisabled) return { ok: false, reason: 'Transformations disabled by battle rules', form };

  const req = form.activationRequirement;

  // Chain order: you cannot skip a stage. A branching form lists several
  // valid predecessors, and standing in any one of them is enough.
  const prevList = (req.previousForms && req.previousForms.length)
    ? req.previousForms
    : (req.previousForm ? [req.previousForm] : []);
  if (prevList.length && !prevList.includes(fighter.form)) {
    const names = prevList
      .map((p) => TRANSFORMATIONS[p]?.displayName || p)
      .join(' or ');
    return { ok: false, reason: `Requires ${names} first`, form };
  }
  if (!prevList.length && fighter.form) {
    // Already transformed past the first stage; only the chain path is valid.
    return { ok: false, reason: 'Already transformed', form };
  }

  if (req.oncePerMatch && fighter.usedForms.has(id)) {
    return { ok: false, reason: 'Once per match only', form };
  }
  if (fighter.awakening < (req.awakening ?? 0)) {
    return { ok: false, reason: `Needs ${Math.round(req.awakening)}% awakening`, form };
  }
  if (fighter.chakra < (req.chakra ?? 0)) {
    return { ok: false, reason: `Needs ${req.chakra} chakra`, form };
  }
  const hpFrac = fighter.health / fighter.maxHealth;
  if (req.healthBelow != null && hpFrac > req.healthBelow) {
    return { ok: false, reason: `Only below ${Math.round(req.healthBelow * 100)}% health`, form };
  }
  if (req.healthAbove != null && hpFrac < req.healthAbove) {
    return { ok: false, reason: `Only above ${Math.round(req.healthAbove * 100)}% health`, form };
  }
  if (req.roundAtLeast && fighter.roundNumber < req.roundAtLeast) {
    return { ok: false, reason: `Round ${req.roundAtLeast} or later`, form };
  }

  // Progression lock (story / mastery). Training mode ignores this so players
  // can try every form, and the UI says so.
  if (form.unlockRequirement && !fighter.ignoreUnlocks) {
    const res = evaluateUnlock(form.unlockRequirement, saveManager.data, { fighterId: fighter.data.id });
    if (!res.unlocked) return { ok: false, reason: res.text, form };
  }

  return { ok: true, reason: '', form };
}

/** Perform the transformation. Returns the form object or null. */
export function transform(fighter, formId = null, effects = null) {
  const check = canTransform(fighter, formId);
  if (!check.ok) return null;
  const form = check.form;

  fighter.awakening = Math.max(0, fighter.awakening - form.awakeningCost);
  fighter.chakra = Math.max(0, fighter.chakra - form.chakraCost);
  fighter.form = form.id;
  fighter.formTime = 0;
  fighter.formDuration = form.permanent ? Infinity : form.duration;
  fighter.usedForms.add(form.id);
  fighter.invulnUntil = fighter.time + 0.6;
  fighter.stats.transformations++;
  if (!form.nextForm) fighter.stats.finalFormsReached++;

  applyFormStats(fighter);
  effects?.emit(form.activationEffect || 'transform_flash', fighter.x, fighter.y + 80, {
    scale: 1.4, color: form.auraColor,
  });
  return form;
}

/** Recompute the fighter's derived stats for the current form. */
export function applyFormStats(fighter) {
  const form = fighter.form ? TRANSFORMATIONS[fighter.form] : null;
  const m = form?.statModifiers || {};
  fighter.formMods = {
    attack: m.attack ?? 1,
    defense: m.defense ?? 1,
    speed: m.speed ?? 1,
    chakraRegen: m.chakraRegen ?? 1,
    guard: m.guard ?? 1,
  };
  fighter.auraColor = form?.auraColor || fighter.data.colors.aura;
  fighter.auraEffect = form?.auraEffect || null;

  // Artwork follows the form. Every path that changes `fighter.form` — activate,
  // revert, end of round — funnels through here, so this one line is what keeps
  // the drawn body and the active transformation in step. Position, facing,
  // health, chakra, target and combat state are all untouched: only the sheet
  // the animator reads from changes.
  fighter.setFormSprite?.(form?.spriteSetId || null);

  fighter.refreshAbilities();
}

/** Resolve the ability for a slot, honouring form overrides. */
export function resolveAbility(fighter, slotKey) {
  const form = fighter.form ? TRANSFORMATIONS[fighter.form] : null;
  if (form) {
    const ov = form.abilityOverrides?.[slotKey];
    if (ov) {
      const a = getAbility(ov);
      if (a) return a;
    }
  }
  return null;
}

/** Tick duration + drains. Returns true if the form ended this step. */
export function tickTransformation(fighter, dt) {
  if (!fighter.form) return false;
  const form = TRANSFORMATIONS[fighter.form];
  if (!form) { fighter.form = null; return true; }

  if (form.chakraDrain) fighter.chakra = Math.max(0, fighter.chakra - form.chakraDrain * dt);
  if (form.healthDrain) {
    // Drain never kills outright — it leaves the fighter at 1 health.
    fighter.health = Math.max(1, fighter.health - form.healthDrain * dt);
  }

  if (form.permanent) return false;

  fighter.formTime += dt;
  if (fighter.formTime >= fighter.formDuration) {
    revert(fighter, form, fighter._ctx?.effects || null);
    return true;
  }
  return false;
}

export function revert(fighter, form = null, effects = null) {
  const f = form || (fighter.form ? TRANSFORMATIONS[fighter.form] : null);
  const rule = f?.deactivationRules || { revertTo: 'previous' };
  fighter.form = rule.revertTo === 'base' ? null : (f?.previousForm || null);
  fighter.formTime = 0;
  fighter.formDuration = fighter.form ? (TRANSFORMATIONS[fighter.form]?.duration ?? 0) : 0;
  // applyFormStats puts the sprite back to whichever costume the fighter chose,
  // because that is what `form.spriteSetId` resolves to once the form is gone.
  applyFormStats(fighter);
  if (f && effects) {
    effects.emit(f.revertEffect || 'transform_revert', fighter.x, fighter.y + 80, {
      scale: 1.1, color: f.auraColor,
    });
  }
}

export function endOfRoundReset(fighter) {
  const f = fighter.form ? TRANSFORMATIONS[fighter.form] : null;
  if (!f || f.deactivationRules?.onRoundEnd !== false) {
    fighter.form = null;
    fighter.formTime = 0;
    applyFormStats(fighter);
  }
}

/** Display name of the current form, for the HUD. */
export function formLabel(fighter) {
  if (!fighter.form) return '';
  return TRANSFORMATIONS[fighter.form]?.displayName || '';
}

/** Remaining fraction of the current form's duration. */
export function formProgress(fighter) {
  if (!fighter.form || !Number.isFinite(fighter.formDuration) || fighter.formDuration <= 0) return 1;
  return Math.max(0, 1 - fighter.formTime / fighter.formDuration);
}
