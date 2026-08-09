/**
 * .cns / .st — constants and state logic.
 *
 * MUGEN state files are a small scripting language. The importer reads them as
 * DATA ONLY: it extracts StateDef headers and the HitDef / VelSet / Projectile
 * controllers inside them, and it never evaluates a trigger expression or runs
 * anything. Expressions are kept verbatim as strings for the reports.
 *
 *   [Statedef 200]
 *   type = S
 *   movetype = A
 *   physics = S
 *   anim = 200
 *   ctrl = 0
 *
 *   [State 200, 1]
 *   type = HitDef
 *   trigger1 = AnimElem = 3
 *   damage = 45, 5
 *   pausetime = 8, 8
 *   animtype = Light
 *   guardflag = MA
 *   velocity = -4, 0
 *
 * What the importer wants out of this is timing and numbers: which animation
 * the state plays, on which animation element the hit becomes active (startup),
 * how long the state runs (recovery), damage, guard damage, knockback, and
 * whether the state spawns a projectile or a helper.
 */

import { parseIni, toInt, toFloat, splitTuple } from './ini.mjs';
import { readText, LIMITS } from './limits.mjs';

/** Controllers the importer understands. Everything else is counted only. */
const INTERESTING = new Set([
  'hitdef', 'projectile', 'helper', 'velset', 'veladd', 'changeanim',
  'changestate', 'posadd', 'posset', 'playsnd', 'explod', 'afterimage',
  'targetbind', 'throw', 'hitoverride', 'statetypeset', 'powerAdd'.toLowerCase(),
]);

/** `damage = 45, 5` → { hit: 45, guard: 5 }. */
function pair(value, fallbackA = 0, fallbackB = 0) {
  const p = splitTuple(value);
  return { a: toFloat(p[0], fallbackA), b: toFloat(p[1], fallbackB) };
}

/**
 * Read the animation element a trigger fires on.
 *
 * `trigger1 = AnimElem = 3` means "when the animation reaches its 3rd frame",
 * which is exactly the startup information the importer is after. MUGEN
 * numbers animation elements from 1.
 */
export function animElemFromTriggers(triggers) {
  for (const t of triggers) {
    const m = /animelem\s*=\s*(\d+)/i.exec(t);
    if (m) return toInt(m[1], 0);
    const m2 = /time\s*[>=]+\s*(\d+)/i.exec(t);
    if (m2) return null;   // a Time trigger is ticks, handled by the caller
  }
  return null;
}

/** Read a `time >= N` trigger, in ticks. */
export function timeFromTriggers(triggers) {
  for (const t of triggers) {
    const m = /\btime\s*(>=|=|>)\s*(\d+)/i.exec(t);
    if (m) return toInt(m[2], 0);
  }
  return null;
}

/**
 * Parse a CNS/ST file.
 * @returns {{ states: Object[], constants: Object, byNumber: Map, errors, warnings }}
 */
export function parseCns(root, relPath) {
  return parseCnsText(readText(root, relPath), relPath);
}

/** Same, from a string. */
export function parseCnsText(text, label = '<cns>') {
  const { sections } = parseIni(text);
  const states = [];
  const errors = [];
  const warnings = [];
  const constants = {};

  let current = null;

  for (const sec of sections) {
    const name = sec.name.trim();
    const lower = sec.nameLower;

    // Constant blocks: [Data], [Size], [Velocity], [Movement].
    if (['data', 'size', 'velocity', 'movement'].includes(lower)) {
      const bucket = {};
      for (const e of sec.entries) bucket[e.key.toLowerCase()] = e.value;
      constants[lower] = bucket;
      continue;
    }

    const sd = /^statedef\s+(-?\d+)/i.exec(name);
    if (sd) {
      if (states.length >= LIMITS.maxStates) {
        warnings.push(`${label}: stopped at ${LIMITS.maxStates} states`);
        break;
      }
      current = {
        number: toInt(sd[1]),
        type: (sec.get('type') || '').trim().toUpperCase() || null,
        moveType: (sec.get('movetype') || '').trim().toUpperCase() || null,
        physics: (sec.get('physics') || '').trim().toUpperCase() || null,
        anim: sec.has('anim') ? toInt(sec.get('anim'), -1) : null,
        ctrl: sec.has('ctrl') ? toInt(sec.get('ctrl'), 1) : null,
        poweradd: sec.has('poweradd') ? toInt(sec.get('poweradd'), 0) : 0,
        juggle: sec.has('juggle') ? toInt(sec.get('juggle'), 0) : 0,
        velset: sec.has('velset') ? splitTuple(sec.get('velset')).map((v) => toFloat(v)) : null,
        controllers: [],
        hitDefs: [],
        projectiles: [],
        helpers: [],
        changeAnims: [],
        /** Variable writes — how a MUGEN character remembers which mode it is in. */
        varSets: [],
        /** Where this state can send the character next. */
        changeStates: [],
        /** Palette and colour effects, which is how modes usually recolour. */
        palFx: [],
        line: sec.line,
      };
      states.push(current);
      continue;
    }

    // [State 200, 1] — a controller inside the current state.
    const st = /^state\s+(-?\d+)\s*(?:,\s*(.*))?$/i.exec(name);
    if (!st) continue;
    const type = (sec.get('type') || '').trim();
    const typeLower = type.toLowerCase();
    /*
     * The number in `[State 3000, VarSet]` is documentation, not ownership.
     * MUGEN binds a controller to the StateDef it appears under, and authors
     * routinely leave a stale number there after copying a block between
     * states — this package has VarSets labelled 3000 sitting inside
     * Statedef 2190. Binding by the label instead of the enclosing StateDef
     * scatters controllers across unrelated states and silently drops the
     * ones whose label matches nothing.
     */
    const target = current;
    // A `[State -1]` block belongs to the .cmd; parse-cmd.mjs owns those.
    if (!target) continue;
    const labelNumber = toInt(st[1]);

    const triggers = sec.entries
      .filter((e) => /^trigger(all|\d+)$/i.test(e.key))
      .map((e) => e.value);

    /*
     * Keep every non-trigger parameter verbatim. Nothing here is evaluated —
     * these are strings for the reports — but a mode scan needs to see the
     * VarSet, PalFX and ChangeState values, not just the controller's type.
     */
    const params = {};
    let kept = 0;
    for (const e of sec.entries) {
      if (/^trigger(all|\d+)$/i.test(e.key)) continue;
      if (kept++ >= 40) break;
      params[e.key.toLowerCase()] = e.value;
    }

    const controller = {
      type,
      typeLower,
      label: (st[2] || '').trim(),
      labelNumber,
      triggers,
      params,
      line: sec.line,
    };
    target.controllers.push(controller);

    if (typeLower === 'hitdef' || typeLower === 'projectile') {
      const dmg = pair(sec.get('damage'), 0, 0);
      const pause = pair(sec.get('pausetime'), 0, 0);
      const ground = pair(sec.get('ground.velocity'), 0, 0);
      const air = pair(sec.get('air.velocity'), 0, 0);
      const hit = {
        kind: typeLower,
        damage: dmg.a,
        guardDamage: dmg.b,
        animType: (sec.get('animtype') || '').trim() || null,
        guardFlag: (sec.get('guardflag') || '').trim() || null,
        attr: (sec.get('attr') || '').trim() || null,
        hitFlag: (sec.get('hitflag') || '').trim() || null,
        pauseTicks: pause.a,
        shakeTicks: pause.b,
        groundVelX: ground.a,
        groundVelY: ground.b,
        airVelX: air.a,
        airVelY: air.b,
        groundSlideTime: toInt(sec.get('ground.slidetime'), 0),
        groundHitTime: toInt(sec.get('ground.hittime'), 0),
        guardSlideTime: toInt(sec.get('guard.slidetime'), 0),
        guardHitTime: toInt(sec.get('guard.hittime'), 0),
        fall: /^1$|^true$/i.test((sec.get('fall') || '').trim()),
        getPower: sec.get('getpower') || null,
        givePower: sec.get('givepower') || null,
        priority: sec.get('priority') || null,
        sparkNo: sec.get('sparkno') || null,
        hitSound: sec.get('hitsound') || null,
        guardSound: sec.get('guardsound') || null,
        /** Which animation element this becomes active on — the startup. */
        animElem: animElemFromTriggers(triggers),
        timeTrigger: timeFromTriggers(triggers),
        triggers,
        line: sec.line,
      };
      if (typeLower === 'projectile') {
        hit.projAnim = sec.has('projanim') ? toInt(sec.get('projanim'), -1) : null;
        hit.projVel = splitTuple(sec.get('velocity')).map((v) => toFloat(v));
        hit.projRemoveTime = toInt(sec.get('projremovetime'), -1);
        hit.projHits = toInt(sec.get('projhits'), 1);
        target.projectiles.push(hit);
      }
      target.hitDefs.push(hit);
    } else if (typeLower === 'helper') {
      target.helpers.push({
        name: (sec.get('name') || '').replace(/^"|"$/g, '') || null,
        stateNo: sec.has('stateno') ? toInt(sec.get('stateno'), -1) : null,
        helperType: (sec.get('helpertype') || '').trim() || null,
        postype: (sec.get('postype') || '').trim() || null,
        line: sec.line,
      });
    } else if (typeLower === 'changeanim') {
      target.changeAnims.push(toInt(sec.get('value'), -1));
    } else if (typeLower === 'varset' || typeLower === 'varadd') {
      // Two spellings exist: `v = 5 / value = 1`, and `var(5) = 1` as a
      // single parameter. Both mean the same thing.
      let index = sec.has('v') ? toInt(sec.get('v'), null) : null;
      let value = sec.has('value') ? sec.get('value') : null;
      if (index === null) {
        for (const [k, v] of Object.entries(params)) {
          const m = /^(?:var|fvar|sysvar)\((\d+)\)$/i.exec(k);
          if (m) { index = toInt(m[1], null); value = v; break; }
        }
      }
      if (index !== null) {
        target.varSets.push({
          index, value, add: typeLower === 'varadd', triggers, line: sec.line,
        });
      }
    } else if (typeLower === 'changestate' || typeLower === 'selfstate') {
      target.changeStates.push({
        value: sec.get('value') ?? null,
        self: typeLower === 'selfstate',
        ctrl: sec.has('ctrl') ? sec.get('ctrl') : null,
        triggers,
        line: sec.line,
      });
    } else if (typeLower === 'palfx' || typeLower === 'allpalfx' || typeLower === 'remappal'
      || typeLower === 'bgpalfx') {
      target.palFx.push({ kind: typeLower, params, triggers, line: sec.line });
    }
  }

  const byNumber = new Map();
  for (const s of states) if (!byNumber.has(s.number)) byNumber.set(s.number, s);

  return { states, constants, byNumber, errors, warnings, valid: true };
}

/**
 * Merge several parsed CNS/ST files into one view. MUGEN characters routinely
 * split their states across `char.cns`, `char.st`, `st1`, `st2`…
 */
export function mergeCns(parsed) {
  const states = [];
  const constants = {};
  const errors = [];
  const warnings = [];
  for (const p of parsed) {
    if (!p) continue;
    states.push(...p.states);
    Object.assign(constants, p.constants);
    errors.push(...(p.errors || []));
    warnings.push(...(p.warnings || []));
  }
  const byNumber = new Map();
  for (const s of states) {
    if (byNumber.has(s.number)) {
      warnings.push(`State ${s.number} is defined more than once; the first wins`);
      continue;
    }
    byNumber.set(s.number, s);
  }
  return { states, constants, byNumber, errors, warnings, valid: true };
}

export default parseCns;
