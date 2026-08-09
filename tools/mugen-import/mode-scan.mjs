/**
 * Finding a character's transformation modes.
 *
 * MUGEN has no concept of a "form". A character that changes mode does it by
 * hand, and almost every author does it the same way:
 *
 *   1. a command in the .cmd sends the character to an activation state,
 *   2. that state spawns a long-lived helper as a marker,
 *   3. a global state (`[Statedef -1]`/`-2`/`-3`) watches `numhelper(N)` and
 *      keeps a variable in sync with it,
 *   4. every other command is gated on that variable, so the whole move set
 *      changes while the marker helper is alive.
 *
 * So the reliable way to find the modes is to work backwards from step 3:
 * find the variables that a global state sets from a `numhelper()` trigger,
 * and each one is a mode flag. Everything else — which command turns it on,
 * which states belong to it, which animations it plays — follows from there.
 *
 * This never evaluates a trigger. It reads the expressions as text and
 * reports what it found, including how confident it is.
 */

import { toInt } from './ini.mjs';

/** MUGEN's global states, which run every tick regardless of the current state. */
const GLOBAL_STATES = new Set([-1, -2, -3]);

/** Pull `numhelper(2195)` out of a trigger expression. */
function helperMarker(trigger) {
  const m = /numhelper\s*\(\s*(\d+)\s*\)/i.exec(String(trigger || ''));
  return m ? toInt(m[1], null) : null;
}

/** Pull every `var(N)` referenced by an expression. */
export function referencedVars(expr) {
  const out = new Set();
  const re = /\bvar\s*\(\s*(\d+)\s*\)/gi;
  let m = re.exec(String(expr || ''));
  while (m) { out.add(toInt(m[1], -1)); m = re.exec(String(expr || '')); }
  return [...out];
}

/** Read a numeric requirement like `var(5) >= 250` or `power >= 3000`. */
function requirement(triggers, re) {
  for (const t of triggers) {
    const m = re.exec(String(t));
    if (m) return { expression: String(t).trim(), value: toInt(m[m.length - 1], null) };
  }
  return null;
}

/**
 * Mode flags: variables a global state drives from a marker helper.
 *
 * @returns {Array<{var:number, onHelper:number|null, offHelper:number|null, evidence:string[]}>}
 */
export function findModeFlags(cns) {
  const flags = new Map();
  for (const state of cns.states) {
    if (!GLOBAL_STATES.has(state.number)) continue;
    for (const v of state.varSets) {
      if (v.add) continue;
      const marker = v.triggers.map(helperMarker).find((n) => n !== null);
      if (marker === undefined || marker === null) continue;
      const entry = flags.get(v.index) || {
        var: v.index, onHelper: null, offHelper: null, evidence: [],
      };
      const on = String(v.value).trim() === '1';
      if (on) entry.onHelper = marker; else entry.offHelper = marker;
      entry.evidence.push(
        `[Statedef ${state.number}] var(${v.index}) = ${v.value} when numhelper(${marker})`,
      );
      flags.set(v.index, entry);
    }
  }
  return [...flags.values()].filter((f) => f.onHelper !== null);
}

/** Every animation number a state can put on screen. */
function animsOf(state) {
  const anims = new Set();
  if (state.anim !== null && state.anim >= 0) anims.add(state.anim);
  for (const a of state.changeAnims) if (a >= 0) anims.add(a);
  for (const c of state.controllers) {
    const raw = c.params?.anim ?? c.params?.value;
    if (c.typeLower === 'changeanim' || c.typeLower === 'explod') {
      const n = toInt(String(raw ?? '').split(';')[0], null);
      if (n !== null && n >= 0) anims.add(n);
    }
  }
  return anims;
}

/**
 * Classify what a state actually is.
 *
 * The distinction the brief cares about: a state that flips a persistent mode
 * flag is a transformation; a state that only spawns an Explod is a visual
 * effect; a state full of HitDefs that costs power is a super. Getting these
 * confused is how a screen flash ends up in the game as a form.
 */
export function classifyState(state, { flagStates = new Set() } = {}) {
  if (!state) return 'UNKNOWN';
  const hasHit = state.hitDefs.length > 0;
  const hasHelper = state.helpers.length > 0;
  const hasPal = state.palFx.length > 0;
  const onlyExplod = state.controllers.length > 0
    && state.controllers.every((c) => ['explod', 'removeexplod', 'playsnd', 'envshake', 'null']
      .includes(c.typeLower));
  const power = Number(state.poweradd) || 0;

  if (flagStates.has(state.number)) return 'TRUE TRANSFORMATION';
  if (hasHit && power < 0) return 'SUPER/HYPER ATTACK';
  if (hasHit) return 'ATTACK';
  if (hasHelper && !hasHit) return 'HELPER';
  if (onlyExplod) return 'VISUAL EFFECT';
  if (hasPal && !hasHit && !hasHelper) return 'PALETTE CHANGE';
  return 'TEMPORARY POWER-UP';
}

/**
 * Scan a parsed package for transformation modes.
 *
 * @param {Object} opts
 *   cmd     parse-cmd output
 *   cns     merged parse-cns output
 *   air     parse-air output
 *   fileOf  Map<stateNumber, fileName>, so a mode can be tied to its file
 */
export function scanModes({ cmd, cns, air, fileOf = new Map() }) {
  const flags = findModeFlags(cns);
  const entries = cmd?.stateEntries || [];
  const commandsByName = new Map((cmd?.commands || []).map((c) => [c.name, c]));

  // Which state spawns each marker helper — that is the activation state.
  const spawnerOf = new Map();
  for (const s of cns.states) {
    for (const h of s.helpers) {
      if (h.stateNo !== null && h.stateNo >= 0) {
        if (!spawnerOf.has(h.stateNo)) spawnerOf.set(h.stateNo, []);
        spawnerOf.get(h.stateNo).push(s.number);
      }
    }
  }

  const modes = [];
  for (const flag of flags) {
    const onStates = spawnerOf.get(flag.onHelper) || [];
    const offStates = flag.offHelper !== null ? (spawnerOf.get(flag.offHelper) || []) : [];
    const activationState = onStates[0] ?? null;
    const deactivationState = offStates[0] ?? null;

    // The command that reaches the activation state.
    const activationEntry = entries.find((e) => e.targetState === activationState) || null;
    const deactivationEntry = entries.find((e) => e.targetState === deactivationState) || null;

    // A mode owns the file its activation state lives in — MUGEN authors keep
    // one file per mode, and this package is no exception.
    const file = fileOf.get(activationState) || null;
    const ownedStates = file
      ? cns.states.filter((s) => fileOf.get(s.number) === file)
      : [];

    const anims = new Set();
    for (const s of ownedStates) for (const a of animsOf(s)) anims.add(a);
    const airActions = [...anims].filter((a) => air?.byNumber?.has(a)).sort((a, b) => a - b);

    const hitDefs = ownedStates.flatMap((s) => s.hitDefs);
    const helpers = ownedStates.flatMap((s) => s.helpers);
    const activation = cns.byNumber.get(activationState) || null;

    // Every other command gated on this flag — the mode's own move set.
    const gatedEntries = entries.filter(
      (e) => e.triggers.some((t) => referencedVars(t).includes(flag.var)),
    );

    modes.push({
      flagVar: flag.var,
      markerHelperOn: flag.onHelper,
      markerHelperOff: flag.offHelper,
      evidence: flag.evidence,
      activationState,
      deactivationState,
      file,
      activationCommand: activationEntry
        ? {
          label: activationEntry.label,
          commands: activationEntry.commands,
          keys: activationEntry.commands
            .map((c) => commandsByName.get(c)?.command || c)
            .join(' + '),
          triggers: activationEntry.triggers,
          meterRequirement: requirement(activationEntry.triggers, /var\s*\(\s*\d+\s*\)\s*>=\s*(\d+)/i),
          powerRequirement: requirement(activationEntry.triggers, /\bpower\s*>=\s*(\d+)/i),
          lifeRequirement: requirement(activationEntry.triggers, /\blife\s*[<>=]+\s*(\d+)/i),
        }
        : null,
      deactivationCommand: deactivationEntry
        ? { label: deactivationEntry.label, commands: deactivationEntry.commands }
        : null,
      classification: classifyState(activation, {
        flagStates: new Set(onStates),
      }),
      stateCount: ownedStates.length,
      stateRange: ownedStates.length
        ? [Math.min(...ownedStates.map((s) => s.number)), Math.max(...ownedStates.map((s) => s.number))]
        : null,
      airActions,
      airActionCount: airActions.length,
      attacks: hitDefs.length,
      helpers: helpers.length,
      helperNames: [...new Set(helpers.map((h) => h.name).filter(Boolean))].slice(0, 20),
      palFx: ownedStates.reduce((n, s) => n + s.palFx.length, 0),
      gatedCommands: gatedEntries.map((e) => ({
        label: e.label, target: e.targetState, commands: e.commands,
      })),
      confidence: activationState !== null && activationEntry ? 'high'
        : activationState !== null ? 'medium' : 'low',
    });
  }

  /*
   * Sub-modes: a command gated on an already-active mode flag. "Kurama Mode"
   * in this package needs Bijuu or Ashura to be running first, so it is a
   * second stage rather than a mode of its own.
   */
  const modeVars = new Set(modes.map((m) => m.flagVar));
  const knownTargets = new Set(modes.flatMap((m) => [m.activationState, m.deactivationState]));
  const subModes = entries
    .filter((e) => !knownTargets.has(e.targetState))
    .filter((e) => e.triggers.some((t) => referencedVars(t).some((v) => modeVars.has(v))))
    .filter((e) => /mode|form|modo/i.test(e.label || ''))
    .map((e) => {
      const state = cns.byNumber.get(e.targetState) || null;
      return {
        label: e.label,
        targetState: e.targetState,
        file: fileOf.get(e.targetState) || null,
        commands: e.commands,
        triggers: e.triggers,
        requiresModeVars: [...new Set(e.triggers.flatMap(referencedVars))].filter((v) => modeVars.has(v)),
        classification: classifyState(state),
        anim: state?.anim ?? null,
        helpers: state?.helpers.length ?? 0,
        confidence: state ? 'high' : 'low',
      };
    });

  return { modes, subModes, flags };
}

export default scanModes;
