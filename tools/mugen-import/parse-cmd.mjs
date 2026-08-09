/**
 * .cmd — command definitions and the state entries that trigger from them.
 *
 *   [Command]
 *   name = "QCF_a"
 *   command = ~D, DF, F, a
 *   time = 15
 *   buffer.time = 1
 *
 *   [State -1, Fireball]
 *   type = ChangeState
 *   value = 1000
 *   triggerall = command = "QCF_a"
 *   trigger1 = statetype = S
 *
 * The [Command] blocks give the motion; the [State -1] blocks say which state
 * number that motion leads to. Together they are what lets move-map.mjs say
 * "state 1000 is a quarter-circle special", which is far more informative than
 * the state number alone.
 */

import { parseIni, toInt, splitTuple } from './ini.mjs';
import { readText } from './limits.mjs';

/** MUGEN button letters. */
const BUTTONS = ['a', 'b', 'c', 'x', 'y', 'z', 's'];

/**
 * Classify a command motion so the mapper can reason about it without
 * re-parsing the notation everywhere.
 */
export function classifyMotion(command) {
  const raw = String(command || '').toLowerCase();
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const dirs = parts.filter((p) => /^[~$/]*[udfb]{1,2}$/.test(p.replace(/[~$/]/g, '') ? p : p));
  const tokens = parts.map((p) => p.replace(/[~$/+]/g, ''));

  const has = (seq) => {
    // Ordered subsequence match, which is how MUGEN motions read.
    let i = 0;
    for (const t of tokens) {
      if (t === seq[i]) i++;
      if (i === seq.length) return true;
    }
    return false;
  };

  const buttons = tokens.filter((t) => BUTTONS.includes(t));
  const motion = has(['d', 'df', 'f']) ? 'qcf'
    : has(['d', 'db', 'b']) ? 'qcb'
      : has(['f', 'd', 'df']) ? 'dp'
        : has(['b', 'd', 'db']) ? 'rdp'
          : has(['b', 'f']) ? 'charge_f'
            : has(['d', 'u']) ? 'charge_u'
              : has(['f', 'f']) ? 'dash_f'
                : has(['b', 'b']) ? 'dash_b'
                  : tokens.length <= 2 && buttons.length ? 'button'
                    : dirs.length ? 'directional' : 'unknown';

  return {
    motion,
    buttons,
    /** Two or more buttons at once usually marks a super or a throw. */
    multiButton: parts.some((p) => /\w\+\w/.test(p)),
    tokenCount: tokens.length,
  };
}

/**
 * Parse a .cmd file.
 * @returns {{ commands: Object[], stateEntries: Object[], defaults: Object, errors: string[] }}
 */
export function parseCmd(root, relPath) {
  return parseCmdText(readText(root, relPath), relPath);
}

/** Same, from a string. */
export function parseCmdText(text, label = '<cmd>') {
  const { sections } = parseIni(text);
  const commands = [];
  const stateEntries = [];
  const errors = [];
  const warnings = [];
  let defaults = {};

  for (const sec of sections) {
    const lower = sec.nameLower;

    if (lower === 'defaults') {
      defaults = {
        commandTime: toInt(sec.get('command.time'), 15),
        commandBufferTime: toInt(sec.get('command.buffer.time'), 1),
      };
      continue;
    }

    if (lower === 'command') {
      const name = (sec.get('name') || '').replace(/^"|"$/g, '');
      const command = sec.get('command');
      if (!name) { warnings.push(`${label}:${sec.line}: [Command] with no name`); continue; }
      if (!command) { warnings.push(`${label}:${sec.line}: command "${name}" has no motion`); continue; }
      commands.push({
        name,
        command,
        time: toInt(sec.get('time'), defaults.commandTime ?? 15),
        bufferTime: toInt(sec.get('buffer.time'), defaults.commandBufferTime ?? 1),
        ...classifyMotion(command),
        line: sec.line,
      });
      continue;
    }

    // [State -1, label] — the command-driven state changes.
    const m = /^state\s+(-?\d+)\s*(?:,\s*(.*))?$/i.exec(sec.name.trim());
    if (!m) continue;
    const stateNo = toInt(m[1]);
    const type = (sec.get('type') || '').trim();
    if (!/^changestate$/i.test(type)) continue;

    const triggers = sec.entries
      .filter((e) => /^trigger(all|\d+)$/i.test(e.key))
      .map((e) => e.value);
    const commandRefs = [];
    for (const t of triggers) {
      const cm = /command\s*=\s*"([^"]+)"/i.exec(t);
      if (cm) commandRefs.push(cm[1]);
    }

    stateEntries.push({
      ownerState: stateNo,
      label: (m[2] || '').trim(),
      targetState: toInt(sec.get('value'), -1),
      commands: commandRefs,
      triggers,
      /** Some entries require meter — a strong hint that it is a super. */
      requiresPower: triggers.some((t) => /\bpower\s*[><=]/i.test(t)),
      requiresAir: triggers.some((t) => /statetype\s*=\s*a\b/i.test(t)),
      requiresCrouch: triggers.some((t) => /statetype\s*=\s*c\b/i.test(t)),
      line: sec.line,
    });
  }

  const byName = new Map(commands.map((c) => [c.name.toLowerCase(), c]));
  return {
    commands, stateEntries, defaults, byName,
    errors, warnings,
    valid: errors.length === 0,
  };
}

export default parseCmd;
