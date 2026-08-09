/**
 * MUGEN states → this game's ability categories.
 *
 * A MUGEN state number plus its command motion plus its HitDef is enough to
 * say what a move IS, and that is the whole job here. What it deliberately
 * does NOT do is assume every special is a jutsu: a quarter-circle punch with
 * no meter cost is a special, a two-button motion that spends 1000 power is an
 * ultimate, and a close-range motion with `attr = S, NT` is a throw.
 *
 * Timing translates directly. MUGEN runs at 60 ticks per second and so does
 * this game's fixed timestep, so ticks / 60 gives the seconds the ability
 * schema wants for startup, active and recovery.
 *
 * Anything the rules cannot place confidently comes out as
 * MANUAL_MAPPING_REQUIRED rather than being forced into a slot.
 */

import { getAbility } from '../../js/data/abilities.js';

/** Ability categories this game already has. */
export const GAME_CATEGORIES = Object.freeze([
  'light attack', 'heavy attack', 'launcher', 'air attack', 'dash attack',
  'throw', 'jutsu1', 'jutsu2', 'jutsu3', 'ultimate', 'counter', 'projectile',
  'guard break', 'special',
]);

export const MANUAL = 'MANUAL_MAPPING_REQUIRED';

/** MUGEN's standard attack state numbers. */
const STANDARD_MOVES = Object.freeze({
  200: { category: 'light attack', label: 'standing light' },
  210: { category: 'light attack', label: 'standing light 2' },
  230: { category: 'heavy attack', label: 'standing heavy' },
  240: { category: 'launcher', label: 'standing launcher' },
  400: { category: 'light attack', label: 'crouching light' },
  410: { category: 'light attack', label: 'crouching light 2' },
  430: { category: 'heavy attack', label: 'crouching heavy' },
  440: { category: 'launcher', label: 'crouching launcher' },
  600: { category: 'air attack', label: 'jumping light' },
  610: { category: 'air attack', label: 'jumping light 2' },
  630: { category: 'air attack', label: 'jumping heavy' },
  640: { category: 'air attack', label: 'jumping heavy 2' },
  100: { category: 'dash attack', label: 'run attack' },
  800: { category: 'throw', label: 'throw' },
  810: { category: 'throw', label: 'throw follow-up' },
});

/** Ticks → seconds at MUGEN's 60 ticks per second. */
export const ticksToSeconds = (t) => Number(((t || 0) / 60).toFixed(4));

/**
 * Work out startup / active / recovery for a state.
 *
 * MUGEN does not declare these. They are derived from where the HitDef fires
 * inside the animation: everything before it is startup, the frames carrying
 * attack boxes are active, and the remainder is recovery.
 */
export function deriveTiming(state, anim) {
  if (!anim || !anim.frames || !anim.frames.length) {
    return { startup: null, active: null, recovery: null, total: null, source: 'no animation' };
  }
  const frames = anim.frames;
  const cum = [];
  let t = 0;
  for (const f of frames) { cum.push(t); if (f.ticks > 0) t += f.ticks; }
  const total = t;

  // Preferred: the HitDef's AnimElem trigger (1-based).
  const hit = (state?.hitDefs || [])[0];
  let startTick = null;
  if (hit?.animElem != null && hit.animElem >= 1 && hit.animElem <= frames.length) {
    startTick = cum[hit.animElem - 1];
  } else if (hit?.timeTrigger != null) {
    startTick = hit.timeTrigger;
  } else {
    // Fall back to the animation's own first attack box.
    const idx = frames.findIndex((f) => (f.clsn1 || []).length);
    if (idx >= 0) startTick = cum[idx];
  }

  if (startTick === null) {
    return {
      startup: null, active: null, recovery: null,
      total: ticksToSeconds(total), source: 'no hit timing found',
    };
  }

  // Active window: consecutive frames with attack boxes from the start frame.
  let activeTicks = 0;
  let seen = false;
  for (let i = 0; i < frames.length; i++) {
    const hasBox = (frames[i].clsn1 || []).length > 0;
    if (cum[i] < startTick) continue;
    if (hasBox) { activeTicks += frames[i].ticks > 0 ? frames[i].ticks : 0; seen = true; }
    else if (seen) break;
  }
  if (!activeTicks) activeTicks = frames[0]?.ticks > 0 ? frames[0].ticks : 3;

  const recovery = Math.max(0, total - startTick - activeTicks);
  return {
    startup: ticksToSeconds(startTick),
    active: ticksToSeconds(activeTicks),
    recovery: ticksToSeconds(recovery),
    total: ticksToSeconds(total),
    startupTicks: startTick,
    activeTicks,
    recoveryTicks: recovery,
    source: hit?.animElem != null ? 'HitDef AnimElem'
      : hit?.timeTrigger != null ? 'HitDef Time trigger' : 'first Clsn1 frame',
  };
}

/**
 * Classify one state.
 *
 * @param {Object} state parsed StateDef
 * @param {Object} ctx { commandFor, animFor }
 */
export function classifyState(state, ctx = {}) {
  const { commandFor = () => null, animFor = () => null } = ctx;
  const n = state.number;
  const hit = (state.hitDefs || [])[0] || null;
  const reasons = [];

  // Not an attack at all.
  if (!state.hitDefs?.length && !state.projectiles?.length) {
    return { category: null, confidence: 'unmapped', reasons: ['no HitDef or Projectile'] };
  }

  const cmd = commandFor(n);
  const attr = (hit?.attr || '').toUpperCase();
  const isThrow = /\bNT\b|\bST\b|\bHT\b/.test(attr);
  const power = state.poweradd || 0;
  const cmdRequiresPower = !!cmd?.requiresPower;

  let category = null;
  let confidence = 'low';

  // 1. A throw is unambiguous in the HitDef attributes.
  if (isThrow) {
    category = 'throw';
    confidence = 'high';
    reasons.push(`HitDef attr "${attr}" marks a throw`);
  } else if (state.projectiles?.length) {
    category = 'projectile';
    confidence = 'high';
    reasons.push(`state spawns ${state.projectiles.length} projectile(s)`);
  } else if (STANDARD_MOVES[n]) {
    category = STANDARD_MOVES[n].category;
    confidence = 'high';
    reasons.push(`standard MUGEN state ${n} (${STANDARD_MOVES[n].label})`);
  } else if (n >= 3000) {
    /*
     * A high state number is a hint, not proof. Characters with several
     * transformation modes park each mode's ordinary attacks in its own high
     * band — this package puts Bijuu Mode's light punch at state 11200 — so
     * treating "≥ 3000" as a super on its own turns a whole move set into
     * ultimates. Meter is the real evidence: MUGEN supers cost power.
     */
    if (cmdRequiresPower || power < 0) {
      category = 'ultimate';
      confidence = 'high';
      reasons.push(`state ${n} is in the super range and spends meter`);
      if (cmdRequiresPower) reasons.push('its command requires power');
    } else {
      category = 'special';
      confidence = 'low';
      reasons.push(`state ${n} is in the super range but spends no meter — `
        + 'reads as a mode-specific normal, not a super');
    }
  } else if (n >= 1000) {
    // A special. Whether it is a jutsu slot or an ultimate depends on meter.
    if (cmdRequiresPower || power <= -1000) {
      category = 'ultimate';
      confidence = 'medium';
      reasons.push(`state ${n} spends meter, so it reads as a super`);
    } else {
      category = 'special';
      confidence = 'medium';
      reasons.push(`state ${n} is in the special range`);
    }
  }

  // 2. The command motion refines it.
  if (cmd) {
    reasons.push(`command "${cmd.name}" (${cmd.motion})`);
    if (cmd.motion === 'dp' && category === 'special') {
      category = 'launcher';
      confidence = 'medium';
      reasons.push('a dragon-punch motion usually launches');
    }
    if (cmd.multiButton && category === 'special') {
      category = 'ultimate';
      confidence = 'medium';
      reasons.push('multi-button motion');
    }
  }

  // 3. A counter is a state whose HitDef never fires but which changes state
  //    on being hit — detected from a HitOverride controller.
  if ((state.controllers || []).some((c) => c.typeLower === 'hitoverride')) {
    category = 'counter';
    confidence = 'medium';
    reasons.push('HitOverride present');
  }

  // 4. Guard break: crushes guard outright.
  if (hit && /^\s*(no|)\s*$/i.test(hit.guardFlag || '') === false
    && /HIGH|LOW|MID/i.test(hit.guardFlag || '') === false && hit.guardFlag) {
    // guardflag is present but names no guardable heights → unblockable.
    if (!/[MAHL]/i.test(hit.guardFlag)) {
      category = 'guard break';
      confidence = 'medium';
      reasons.push(`guardflag "${hit.guardFlag}" is unblockable`);
    }
  }

  if (!category) {
    return { category: null, confidence: 'unmapped', reasons: [...reasons, 'no rule matched'] };
  }
  return { category, confidence, reasons, command: cmd?.name || null };
}

/**
 * Map every attacking state to a game ability shape.
 *
 * @returns {{ moves: Object[], stats: Object, manual: Object[] }}
 */
export function mapMoves(states, { commands = [], stateEntries = [], animsByNumber = new Map() } = {}) {
  // state number → the command that reaches it
  const cmdByState = new Map();
  const cmdByName = new Map(commands.map((c) => [c.name.toLowerCase(), c]));
  for (const e of stateEntries) {
    if (e.targetState < 0) continue;
    const c = e.commands.map((n) => cmdByName.get(n.toLowerCase())).find(Boolean);
    if (!cmdByState.has(e.targetState)) {
      cmdByState.set(e.targetState, {
        ...(c || {}),
        name: c?.name || e.commands[0] || null,
        motion: c?.motion || 'unknown',
        requiresPower: e.requiresPower,
        requiresAir: e.requiresAir,
        requiresCrouch: e.requiresCrouch,
      });
    }
  }

  const moves = [];
  for (const state of states) {
    if (!state.hitDefs?.length && !state.projectiles?.length) continue;
    const anim = state.anim != null && state.anim >= 0 ? animsByNumber.get(state.anim) : null;
    const cls = classifyState(state, { commandFor: (n) => cmdByState.get(n) || null });
    const timing = deriveTiming(state, anim);
    const hit = (state.hitDefs || [])[0] || null;

    moves.push({
      state: state.number,
      animation: state.anim,
      category: cls.category,
      confidence: cls.confidence,
      status: cls.category && cls.confidence !== 'low' ? 'MAPPED' : MANUAL,
      command: cls.command || null,
      reasons: cls.reasons,
      /** In the shape js/data/ability-schema.js uses. */
      ability: hit ? {
        damage: hit.damage,
        guardDamage: hit.guardDamage,
        startup: timing.startup,
        activeFrames: timing.active,
        recovery: timing.recovery,
        hitStun: ticksToSeconds(hit.groundHitTime || hit.groundSlideTime),
        blockStun: ticksToSeconds(hit.guardHitTime || hit.guardSlideTime),
        knockbackX: Math.round(Math.abs(hit.groundVelX) * 60),
        knockbackY: Math.round(hit.airVelY * 60),
        launch: !!hit.fall,
        hits: 1,
        chakraCost: state.poweradd < 0 ? Math.round(Math.abs(state.poweradd) / 10) : 0,
      } : null,
      projectiles: (state.projectiles || []).map((p) => ({
        anim: p.projAnim,
        velocity: p.projVel,
        removeTicks: p.projRemoveTime,
        removeSeconds: p.projRemoveTime > 0 ? ticksToSeconds(p.projRemoveTime) : null,
        hits: p.projHits,
        damage: p.damage,
      })),
      helpers: (state.helpers || []).map((h) => ({
        name: h.name,
        stateNo: h.stateNo,
        helperType: h.helperType,
        /**
         * A MUGEN helper is NOT this game's selectable assist. It is analysed
         * as one of these and never turned into a roster assist.
         */
        classification: h.helperType === 'player' ? 'temporary helper'
          : h.stateNo != null ? 'special move component' : 'effect',
      })),
      timing,
    });
  }

  const manual = moves.filter((m) => m.status === MANUAL);
  const byCategory = {};
  for (const m of moves) {
    if (!m.category) continue;
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
  }

  return {
    moves,
    manual,
    stats: {
      total: moves.length,
      mapped: moves.length - manual.length,
      manualRequired: manual.length,
      byCategory,
      projectiles: moves.reduce((n, m) => n + m.projectiles.length, 0),
      helpers: moves.reduce((n, m) => n + m.helpers.length, 0),
      withTiming: moves.filter((m) => m.timing.startup !== null).length,
    },
  };
}

/**
 * Compare imported timing against a fighter's existing ability, so a human can
 * see what would actually change before anything is replaced.
 */
export function compareToExisting(move, abilityId) {
  const a = getAbility(abilityId);
  if (!a || !move.ability) return null;
  const d = (x, y) => (x == null || y == null ? null : Number((x - y).toFixed(4)));
  return {
    abilityId,
    current: {
      damage: a.damage, startup: a.startup, activeFrames: a.activeFrames,
      recovery: a.recovery, knockbackX: a.knockbackX,
    },
    imported: {
      damage: move.ability.damage, startup: move.ability.startup,
      activeFrames: move.ability.activeFrames, recovery: move.ability.recovery,
      knockbackX: move.ability.knockbackX,
    },
    delta: {
      damage: d(move.ability.damage, a.damage),
      startup: d(move.ability.startup, a.startup),
      recovery: d(move.ability.recovery, a.recovery),
    },
  };
}

export default mapMoves;
