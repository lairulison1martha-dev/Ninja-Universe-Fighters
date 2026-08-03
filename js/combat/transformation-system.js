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
  const chain = fighter.data.transformations;
  if (!chain || chain.length === 0) return null;
  if (!fighter.form) return chain[0];
  const cur = TRANSFORMATIONS[fighter.form];
  return cur?.nextForm || null;
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

  // Chain order: you cannot skip a stage.
  if (req.previousForm && fighter.form !== req.previousForm) {
    const prev = TRANSFORMATIONS[req.previousForm];
    return { ok: false, reason: `Requires ${prev?.displayName || req.previousForm} first`, form };
  }
  if (!req.previousForm && fighter.form) {
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
