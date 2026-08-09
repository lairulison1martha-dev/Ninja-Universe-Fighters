import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.NUF_TEST_PORT || 8099;
const URL_BASE = `http://127.0.0.1:${PORT}/Ninja-Universe-Fighters/`;
/** Screenshots land here; the directory is git-ignored. */
const OUT = process.env.NUF_TEST_OUT || path.join(HERE, 'output');
fs.mkdirSync(OUT, { recursive: true });
/** Honour PLAYWRIGHT_BROWSERS_PATH when it is set; otherwise let Playwright resolve. */
const LAUNCH = process.env.NUF_CHROMIUM ? { executablePath: process.env.NUF_CHROMIUM } : {};

const b = await chromium.launch(LAUNCH);
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().split('/').slice(-4).join('/')}`); });
const step = async (n, fn) => { try { await fn(); console.log('  ✓ ' + n); } catch (e) { console.log('  ✗ ' + n + ' — ' + e.message); process.exitCode = 1; } };

await page.goto(`${URL_BASE}`, { waitUntil: 'networkidle' });
await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
await page.click('.menu__item[data-id="versus"]');
await page.waitForSelector('#screen-select.is-active');
await page.waitForTimeout(1200);

await step('the Costume button appears for a fighter with a choice', async () => {
  const r = await page.evaluate(() => {
    const g = globalThis.__NUF_GAME;
    g.select.setP1('naruto');
    return { hidden: document.getElementById('btn-costume').hidden, label: document.getElementById('btn-costume').textContent.trim() };
  });
  if (r.hidden) throw new Error('costume button hidden for Naruto');
  if (r.label !== 'Costume') throw new Error(`label is "${r.label}"`);
});

await step('the Costume button is hidden for a fighter with none', async () => {
  const hidden = await page.evaluate(() => {
    globalThis.__NUF_GAME.select.setP1('haku');
    return document.getElementById('btn-costume').hidden;
  });
  if (!hidden) throw new Error('costume button shown for a fighter with no costumes');
  await page.evaluate(() => globalThis.__NUF_GAME.select.setP1('naruto'));
});

await step('the picker lists every costume with lock state', async () => {
  await page.click('#btn-costume');
  await page.waitForSelector('#costume-sheet:not([hidden])');
  const r = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.costume')];
    return {
      title: document.getElementById('costume-title').textContent,
      n: items.length,
      rows: items.map((el) => ({
        id: el.dataset.costume, locked: el.dataset.locked === 'true',
        state: el.querySelector('.costume__state').textContent.trim(),
        hasArt: !!el.querySelector('img'),
      })),
    };
  });
  if (!/Choose Costume/.test(r.title)) throw new Error('title: ' + r.title);
  if (r.n !== 6) throw new Error(`expected 6 costumes for Naruto, got ${r.n}`);
  const equipped = r.rows.filter((x) => /Equipped/.test(x.state));
  if (equipped.length !== 1) throw new Error(`${equipped.length} equipped`);
  const locked = r.rows.filter((x) => x.locked);
  if (!locked.length) throw new Error('no locked costume shown');
  if (!locked.every((x) => /^Locked — /.test(x.state))) {
    throw new Error('locked rows must show the unlock requirement: ' + JSON.stringify(locked));
  }
  console.log(`       ${r.n} costumes, ${locked.length} locked, previews: ${r.rows.filter((x) => x.hasArt).length}`);
});

await step('selecting a costume equips it and updates the preview', async () => {
  const before = await page.evaluate(() => globalThis.__NUF_GAME.select.p1Costume);
  await page.click('.costume[data-costume="shippuden"]');
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({
    equipped: globalThis.__NUF_GAME.select.p1Costume,
    saved: globalThis.__NUF_GAME.select.p1Costume,
    sheet: globalThis.__NUF_GAME.select.preview.sheet?.meta?.id ?? null,
    marked: document.querySelector('.costume.is-equipped')?.dataset.costume,
  }));
  if (r.equipped !== 'shippuden') throw new Error(`equipped ${r.equipped} (was ${before})`);
  if (r.sheet !== 'naruto__shippuden') throw new Error(`preview shows ${r.sheet}`);
  if (r.marked !== 'shippuden') throw new Error('the picker did not mark it equipped');
  console.log(`       equipped ${r.equipped}, preview set ${r.sheet}`);
});

await step('a locked costume cannot be equipped from the picker', async () => {
  const r = await page.evaluate(async () => {
    const el = document.querySelector('.costume[data-locked="true"]');
    const id = el.dataset.costume;
    el.click();
    await new Promise((res) => setTimeout(res, 250));
    return { id, equipped: globalThis.__NUF_GAME.select.p1Costume };
  });
  if (r.equipped === r.id) throw new Error(`locked costume ${r.id} got equipped`);
});
await page.screenshot({ path: `${OUT}/costume-sheet.png` });
await page.evaluate(() => { document.getElementById('costume-sheet').hidden = true; });

await step('the preview animates and can be flipped', async () => {
  const frames = new Set();
  for (let i = 0; i < 20; i++) {
    frames.add(await page.evaluate(() => globalThis.__NUF_GAME.select.preview.animator?.index));
    await page.waitForTimeout(60);
  }
  if (frames.size < 3) throw new Error(`preview idle stuck on ${[...frames].join(',')}`);
  const before = await page.evaluate(() => globalThis.__NUF_GAME.select.preview.facing);
  await page.click('#btn-preview-flip');
  const after = await page.evaluate(() => globalThis.__NUF_GAME.select.preview.facing);
  if (after === before) throw new Error('flip did nothing');
  console.log(`       ${frames.size} idle frames, facing ${before} -> ${after}`);
});

await step('prev/next arrows walk the unlocked costumes', async () => {
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    await page.click('#btn-costume-next');
    await page.waitForTimeout(150);
    seen.add(await page.evaluate(() => globalThis.__NUF_GAME.select.p1Costume));
  }
  if (seen.size < 2) throw new Error(`next only reached ${[...seen].join(',')}`);
  const unlocked = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const sm = (await import('./js/save-manager.js')).default;
    return sm.isCostumeUnlocked('naruto', g.select.p1Costume);
  });
  if (!unlocked) throw new Error('arrows landed on a locked costume');
  console.log(`       cycled ${seen.size}: ${[...seen].join(', ')}`);
});

await step('Random AI Opponent leaves the player costume alone', async () => {
  const before = await page.evaluate(() => globalThis.__NUF_GAME.select.p1Costume);
  for (let i = 0; i < 5; i++) { await page.click('#btn-random'); await page.waitForTimeout(80); }
  const after = await page.evaluate(() => ({ c: globalThis.__NUF_GAME.select.p1Costume, p: globalThis.__NUF_GAME.select.p1 }));
  if (after.c !== before) throw new Error(`player costume changed ${before} -> ${after.c}`);
});

await page.evaluate(() => { globalThis.__NUF_GAME.select.setP2('naruto'); });
await page.waitForTimeout(200);
await page.click('#btn-select-confirm'); await page.waitForSelector('#screen-stage.is-active');
await page.click('#btn-stage-confirm'); await page.waitForSelector('#screen-combat.is-active');
await page.waitForTimeout(3200);

await step('the chosen costume reached the match', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine;
    return {
      p: e.player.data.id, pc: e.player.costumeId, ps: e.player.sheet?.meta?.id,
      o: e.enemy.data.id, oc: e.enemy.costumeId, os: e.enemy.sheet?.meta?.id,
      pve: e.assertPvE(),
    };
  });
  // The drawn set must match the equipped costume: the base set for the
  // default outfit, the costume's own set otherwise.
  const wantSet = r.pc === 'default' ? 'naruto' : `naruto__${r.pc}`;
  if (r.ps !== wantSet) throw new Error(`wearing ${r.pc} but drawing ${r.ps}, expected ${wantSet}`);
  if (r.pve.human !== 1 || r.pve.ai !== 1) throw new Error('not PvE');
  console.log(`       ${r.p}/${r.pc} (${r.ps}) vs ${r.o}/${r.oc} (${r.os})`);
});

await step('mirror match renders two different costumes', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine;
    return { same: e.player.data.id === e.enemy.data.id, ps: e.player.sheet?.meta?.id, os: e.enemy.sheet?.meta?.id };
  });
  if (!r.same) throw new Error('not a mirror match');
  console.log(`       ${r.ps} vs ${r.os}${r.ps === r.os ? ' (same costume rolled)' : ''}`);
});

await step('transforming swaps the sprite and keeps the fight intact', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine;
    const f = e.player;
    f.x = 700; f.facing = -1; f.health = 555; f.awakening = 100; f.chakra = 100;
    const before = { sheet: f.sheet?.meta?.id, x: f.x, facing: f.facing, health: f.health, target: f.trackTarget === e.enemy };
    const form = e.requestTransform(f);
    const during = { form: f.form, sheet: f.sheet?.meta?.id, x: f.x, facing: f.facing, health: f.health, target: f.trackTarget === e.enemy };
    // Run the form out and check we land back on the costume.
    f.formTime = f.formDuration + 1;
    for (let i = 0; i < 4; i++) f.step(1 / 60, e.ctx(f));
    const after = { form: f.form, sheet: f.sheet?.meta?.id };
    return { before, during, after, ok: !!form };
  });
  if (!r.ok) throw new Error('transformation refused');
  if (r.during.sheet === r.before.sheet) throw new Error(`sprite did not change (${r.during.sheet})`);
  if (r.during.x !== r.before.x || r.during.facing !== r.before.facing
      || r.during.health !== r.before.health || !r.during.target) {
    throw new Error('combat state changed: ' + JSON.stringify(r));
  }
  if (r.after.sheet !== r.before.sheet) throw new Error(`did not revert to the costume: ${r.after.sheet} vs ${r.before.sheet}`);
  console.log(`       ${r.before.sheet} -> ${r.during.sheet} (${r.during.form}) -> ${r.after.sheet}`);
});

await page.evaluate(() => {
  document.getElementById('touch-controls').hidden = true;
  const e = globalThis.__NUF_GAME.engine; e.player.x = 800; e.enemy.x = 1080; e.camera.focus = null; e.camera.focusTime = 0;
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/costume-combat.png` });

console.log(errors.length ? '  ✗ console: ' + errors.slice(0, 5).join(' | ') : '  ✓ no console errors');
if (errors.length) process.exitCode = 1;
await b.close();
