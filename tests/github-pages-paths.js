/**
 * GitHub Pages compatibility.
 *
 * The game is served from a project subdirectory (https://user.github.io/REPO/),
 * so ANY absolute root path ("/css/main.css") would 404. These tests scan the
 * real files for that mistake, and check the service worker precache list
 * against what is actually on disk.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { suite, test, assert, assertEmpty } from './helpers.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const ALL_FILES = walk(ROOT);
const TEXT_EXT = new Set(['.html', '.css', '.js', '.webmanifest', '.json', '.md', '.svg']);

export function run() {
  suite('github-pages-paths');

  test('no HTML/CSS/JS references an absolute root path', () => {
    const bad = [];
    // src="/…", href="/…", url(/…), import from '/…'  — but allow "//" (protocol-relative is separately banned below)
    const patterns = [
      /(?:src|href)\s*=\s*["']\/(?!\/)/g,
      /url\(\s*["']?\/(?!\/)/g,
      /from\s+["']\/(?!\/)/g,
      /import\(\s*["']\/(?!\/)/g,
    ];
    for (const file of ALL_FILES) {
      const ext = extname(file);
      if (!['.html', '.css', '.js', '.webmanifest'].includes(ext)) continue;
      const rel = relative(ROOT, file);
      if (rel.startsWith('tests' + '/')) continue;
      const text = readFileSync(file, 'utf8');
      for (const re of patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
          const line = text.slice(0, m.index).split('\n').length;
          bad.push(`${rel}:${line} — ${m[0].trim()}`);
        }
      }
    }
    assertEmpty(bad, 'Absolute root paths break GitHub Pages project sites');
  });

  test('the manifest uses relative start_url, scope and icon paths', () => {
    const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
    assert(m.start_url === './', `start_url should be "./", got "${m.start_url}"`);
    assert(m.scope === './', `scope should be "./", got "${m.scope}"`);
    const bad = m.icons.filter((i) => !i.src.startsWith('./')).map((i) => i.src);
    assertEmpty(bad, 'Manifest icons must use relative paths');
    for (const s of m.shortcuts || []) {
      assert(s.url.startsWith('./'), `Shortcut url must be relative: ${s.url}`);
    }
  });

  test('the manifest declares the fields a high-quality install needs', () => {
    const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
    for (const key of ['name', 'short_name', 'description', 'display', 'orientation',
      'background_color', 'theme_color', 'icons', 'id', 'lang']) {
      assert(m[key] !== undefined, `Manifest is missing "${key}"`);
    }
    assert(m.display === 'standalone', 'display must be standalone');
    assert(m.orientation === 'landscape', 'orientation must be landscape');
    const maskable = m.icons.filter((i) => (i.purpose || '').includes('maskable'));
    assert(maskable.length >= 1, 'A maskable icon is required for Android');
    const has512 = m.icons.some((i) => i.sizes === '512x512');
    const has192 = m.icons.some((i) => i.sizes === '192x192');
    assert(has192 && has512, 'Both 192 and 512 icons are required');
  });

  test('every icon the manifest and HTML reference exists on disk', () => {
    const missing = [];
    const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
    for (const i of m.icons) {
      const p = join(ROOT, i.src.replace(/^\.\//, ''));
      if (!existsSync(p)) missing.push(`manifest: ${i.src}`);
    }
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const re = /(?:href|src)\s*=\s*["'](\.\/[^"']+)["']/g;
    let match;
    while ((match = re.exec(html)) !== null) {
      const p = join(ROOT, match[1].replace(/^\.\//, ''));
      if (!existsSync(p)) missing.push(`index.html: ${match[1]}`);
    }
    assertEmpty(missing, 'Referenced files are missing');
  });

  test('the Apple touch icon is present and 180x180', () => {
    const p = join(ROOT, 'assets/icons/apple-touch-icon.png');
    assert(existsSync(p), 'apple-touch-icon.png is missing');
    // PNG header: width/height are big-endian uint32 at bytes 16 and 20.
    const buf = readFileSync(p);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    assert(w === 180 && h === 180, `Apple touch icon must be 180x180, got ${w}x${h}`);
  });

  test('the icon source SVG exists', () => {
    assert(existsSync(join(ROOT, 'assets/icons/icon-source.svg')), 'icon-source.svg is missing');
  });

  test('service worker precache list only names files that exist', () => {
    const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
    const block = sw.slice(sw.indexOf('const PRECACHE'), sw.indexOf('];', sw.indexOf('const PRECACHE')));
    const paths = [...block.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
    assert(paths.length > 20, `Expected a real precache list, found ${paths.length} entries`);
    const missing = paths
      .filter((p) => p !== './')
      .filter((p) => !existsSync(join(ROOT, p.replace(/^\.\//, ''))));
    assertEmpty(missing, 'Service worker precaches files that do not exist');
  });

  test('every precached fighter sprite set exists on disk', () => {
    // The fighter half of the precache list is built by a loop over ids, so it
    // is not in the literal array the check above scans.
    const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
    const block = sw.slice(sw.indexOf('const PRECACHE_FIGHTERS'),
      sw.indexOf('];', sw.indexOf('const PRECACHE_FIGHTERS')));
    const ids = [...block.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    assert(ids.length >= 20, `Expected the starter roster, found ${ids.length} ids`);
    const missing = [];
    for (const id of ids) {
      for (const file of ['fighter.json', 'sprite-sheet.png', 'portrait.png']) {
        const p = join(ROOT, 'assets', 'fighters', id, file);
        if (!existsSync(p)) missing.push(`${id}/${file}`);
      }
    }
    assertEmpty(missing, 'Precached fighter sprite files are missing');
  });

  test('the sprite manifest only lists fighters that exist', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'fighters', 'manifest.json'), 'utf8'));
    assert(Array.isArray(manifest.fighters) && manifest.fighters.length > 0,
      'The manifest lists no fighters');
    const missing = manifest.fighters.filter(
      (id) => !existsSync(join(ROOT, 'assets', 'fighters', id, 'sprite-sheet.png')),
    );
    assertEmpty(missing, 'The manifest names sprite sets that are not on disk');
    const notInManifest = (manifest.precached || []).filter((id) => !manifest.fighters.includes(id));
    assertEmpty(notInManifest, 'Precached ids missing from the manifest');
  });

  test('every ES module import in js/ resolves to a real file', () => {
    const missing = [];
    for (const file of ALL_FILES) {
      if (extname(file) !== '.js') continue;
      const rel = relative(ROOT, file);
      if (!rel.startsWith('js/') && !rel.startsWith('tests/')) continue;
      const text = readFileSync(file, 'utf8');
      const re = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const target = join(file, '..', m[1]);
        if (!existsSync(target)) missing.push(`${rel} → ${m[1]}`);
      }
    }
    assertEmpty(missing, 'Broken imports');
  });

  test('no file uses a protocol-relative or external asset URL', () => {
    const bad = [];
    for (const file of ALL_FILES) {
      const ext = extname(file);
      if (!TEXT_EXT.has(ext)) continue;
      const rel = relative(ROOT, file);
      if (rel.startsWith('tests/') || rel === 'README.md') continue;
      const text = readFileSync(file, 'utf8');
      const re = /(?:src|href)\s*=\s*["'](https?:)?\/\//g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const line = text.slice(0, m.index).split('\n').length;
        bad.push(`${rel}:${line}`);
      }
      if (/@import\s+url\(\s*["']?https?:/.test(text)) bad.push(`${rel}: remote @import`);
    }
    assertEmpty(bad, 'External asset URLs would break offline play');
  });

  test('index.html declares the Apple standalone metadata', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    for (const needle of [
      'apple-mobile-web-app-capable',
      'apple-mobile-web-app-status-bar-style',
      'apple-touch-icon',
      'viewport-fit=cover',
      'user-scalable=no',
      'manifest.webmanifest',
      'theme-color',
    ]) {
      assert(html.includes(needle), `index.html is missing "${needle}"`);
    }
  });

  test('the service worker cache version matches the app version', () => {
    const sw = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
    const consts = readFileSync(join(ROOT, 'js/constants.js'), 'utf8');
    const swV = sw.match(/CACHE_VERSION\s*=\s*'v([\d.]+)'/)?.[1];
    const appV = consts.match(/APP_VERSION\s*=\s*'([\d.]+)'/)?.[1];
    assert(swV && appV, 'Could not read the versions');
    assert(swV === appV, `Service worker cache is v${swV} but the app is v${appV} — bump both together`);
  });
}
