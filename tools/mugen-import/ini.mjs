/**
 * MUGEN's INI-ish text format.
 *
 * .def, .air, .cmd, .cns, .st and .snd are all sections in square brackets
 * followed by `key = value` lines, but each one bends the rules:
 *
 *   - section names repeat (`[State 200]` appears many times),
 *   - values are comma-separated tuples as often as scalars,
 *   - comments start with `;` and can follow a value,
 *   - keys are case-insensitive and inconsistently spaced,
 *   - AIR puts bare data rows inside a section with no key at all.
 *
 * So this returns sections **in order**, each keeping both its `key => value`
 * map and its raw lines, and never collapses duplicates. Parsers on top pick
 * whichever view they need.
 */

/** Strip a trailing comment, honouring nothing else — MUGEN has no escapes. */
export function stripComment(line) {
  const i = line.indexOf(';');
  return i === -1 ? line : line.slice(0, i);
}

/**
 * @typedef {{
 *   name: string, nameLower: string, line: number,
 *   entries: Array<{ key: string, value: string, line: number }>,
 *   rows: Array<{ text: string, line: number }>,
 *   get(key: string): string|null,
 *   has(key: string): boolean,
 * }} IniSection
 */

function makeSection(name, line) {
  const map = new Map();
  const section = {
    name,
    nameLower: name.toLowerCase(),
    line,
    entries: [],
    rows: [],
    get(key) {
      const v = map.get(String(key).toLowerCase());
      return v === undefined ? null : v;
    },
    has(key) { return map.has(String(key).toLowerCase()); },
  };
  section._set = (k, v) => { if (!map.has(k)) map.set(k, v); };
  return section;
}

/**
 * Parse MUGEN text into ordered sections.
 * @param {string} text
 * @returns {{ sections: IniSection[], preamble: string[] }}
 */
export function parseIni(text) {
  const sections = [];
  const preamble = [];
  let current = null;
  const lines = String(text).split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = stripComment(raw).trim();
    if (!line) continue;

    const header = /^\[([^\]]*)\]/.exec(line);
    if (header) {
      current = makeSection(header[1].trim(), i + 1);
      sections.push(current);
      continue;
    }
    if (!current) { preamble.push(line); continue; }

    const eq = line.indexOf('=');
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      current.entries.push({ key, value, line: i + 1 });
      current._set(key.toLowerCase(), value);
      // AIR's collision boxes are `key = value` AND meaningful as rows, so a
      // line can legitimately be both. Recording both is what lets the AIR
      // parser read Clsn headers and frame rows from the same stream.
      current.rows.push({ text: line, line: i + 1 });
    } else {
      current.rows.push({ text: line, line: i + 1 });
    }
  }

  return { sections, preamble };
}

/** Split a MUGEN comma tuple: `1, 0, 5, -1` → ['1','0','5','-1']. */
export function splitTuple(value) {
  if (value === null || value === undefined) return [];
  return String(value).split(',').map((s) => s.trim());
}

/** Parse an integer, returning `fallback` for anything MUGEN considers blank. */
export function toInt(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  if (!s) return fallback;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse a float the same way. */
export function toFloat(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  if (!s) return fallback;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

/** First section whose name matches (case-insensitive). */
export function findSection(sections, name) {
  const want = String(name).toLowerCase();
  return sections.find((s) => s.nameLower === want) || null;
}

/** Every section whose name starts with `prefix` (case-insensitive). */
export function findSections(sections, prefix) {
  const want = String(prefix).toLowerCase();
  return sections.filter((s) => s.nameLower.startsWith(want));
}
