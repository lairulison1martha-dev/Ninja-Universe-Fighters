/**
 * Minimal test harness — no dependencies, runs under plain `node`.
 */

let currentFile = '';
const results = [];

export function suite(name) {
  currentFile = name;
}

export function test(name, fn) {
  const entry = { file: currentFile, name, ok: true, error: null };
  try {
    fn();
  } catch (err) {
    entry.ok = false;
    entry.error = err;
  }
  results.push(entry);
  return entry;
}

export function assert(cond, message) {
  if (!cond) throw new Error(message || 'Assertion failed');
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Values differ'}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

export function assertAtLeast(actual, min, message) {
  if (!(actual >= min)) {
    throw new Error(`${message || 'Value too small'}\n  expected >= ${min}\n  actual:     ${actual}`);
  }
}

export function assertEmpty(list, message) {
  if (list.length) {
    throw new Error(`${message || 'Expected empty list'}\n  ${list.slice(0, 12).join('\n  ')}${list.length > 12 ? `\n  … and ${list.length - 12} more` : ''}`);
  }
}

export function report() {
  const failed = results.filter((r) => !r.ok);
  const byFile = new Map();
  for (const r of results) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }
  for (const [file, list] of byFile) {
    const bad = list.filter((r) => !r.ok).length;
    console.log(`\n${bad ? '✗' : '✓'} ${file}  (${list.length - bad}/${list.length})`);
    for (const r of list) {
      console.log(`   ${r.ok ? '·' : '✗'} ${r.name}`);
      if (!r.ok) console.log(`      ${String(r.error.message).split('\n').join('\n      ')}`);
    }
  }
  console.log(`\n${results.length - failed.length}/${results.length} tests passed.`);
  return failed.length === 0;
}

/** Minimal DOM/browser stubs so browser-facing modules can be imported in Node. */
export function installBrowserStubs() {
  if (globalThis.__NUF_STUBS) return;
  globalThis.__NUF_STUBS = true;

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };

  const noopEl = () => ({
    style: { setProperty() {}, removeProperty() {} },
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, removeAttribute() {}, appendChild() {}, append() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 }),
    innerHTML: '', textContent: '', hidden: true,
  });

  globalThis.document = {
    body: noopEl(),
    documentElement: noopEl(),
    readyState: 'complete',
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => noopEl(),
    createDocumentFragment: () => noopEl(),
    addEventListener() {}, removeEventListener() {},
    baseURI: 'https://example.test/Ninja-Universe-Fighters/',
  };

  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (!globalThis.navigator) {
    Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {} }, configurable: true });
  } else if (!globalThis.navigator.vibrate) {
    try { globalThis.navigator.vibrate = () => {}; } catch { /* read-only in this runtime */ }
  }
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.devicePixelRatio = 2;
  globalThis.innerWidth = 844;
  globalThis.innerHeight = 390;
  if (!globalThis.CanvasRenderingContext2D) globalThis.CanvasRenderingContext2D = function () {};
}

export { results };
