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
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().split('/').slice(-3).join('/')}`); });
const step = async (n, fn) => { try { await fn(); console.log('  ✓ ' + n); } catch (e) { console.log('  ✗ ' + n + ' — ' + e.message); process.exitCode = 1; } };

await page.goto(`${URL_BASE}`, { waitUntil: 'networkidle' });
await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });

await step('boot reports the 110-fighter roster', async () => {
  const r = await page.evaluate(() => globalThis.__NUF_REPORT?.stats);
  if (r.fighters !== 110) throw new Error(`roster is ${r.fighters}`);
  console.log(`       ${JSON.stringify(r)}`);
});

await step('the menu entry says Player vs AI', async () => {
  const t = await page.$eval('.menu__item[data-id="versus"]', (e) => e.textContent);
  if (!/Player vs AI/i.test(t)) throw new Error(t.trim().slice(0, 60));
});

await page.click('.menu__item[data-id="versus"]');
await page.waitForSelector('#screen-select.is-active');
await page.waitForTimeout(900);

await step('select screen uses the PvE labels', async () => {
  const r = await page.evaluate(() => ({
    title: document.getElementById('select-title').textContent.trim(),
    left: document.querySelector('.select__panel--p1 .select__panel-label').textContent.trim(),
    right: document.querySelector('.select__panel--p2 .select__panel-label').textContent.trim(),
    random: document.getElementById('btn-random').textContent.trim(),
    confirm: document.getElementById('btn-select-confirm').textContent.trim(),
    body: document.getElementById('screen-select').textContent,
  }));
  const want = { title: 'Player vs AI', left: 'Your Fighter', right: 'AI Opponent', random: 'Random AI Opponent' };
  for (const [k, v] of Object.entries(want)) if (r[k] !== v) throw new Error(`${k} = "${r[k]}", want "${v}"`);
  if (!/Start Player vs AI Match/.test(r.confirm)) throw new Error('confirm = ' + r.confirm);
  for (const bad of ['Player 2', 'PvP', 'Multiplayer', 'Matchmaking', 'Online Match', 'Local Versus']) {
    if (r.body.includes(bad)) throw new Error(`forbidden label on screen: ${bad}`);
  }
  console.log(`       "${r.title}" | ${r.left} / ${r.right} | ${r.confirm}`);
});

await step('all 110 cards render and are all selectable', async () => {
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.fcard')];
    return { n: cards.length, ids: cards.map((c) => c.dataset.id) };
  });
  if (r.n !== 110) throw new Error(`${r.n} cards`);
  if (new Set(r.ids).size !== 110) throw new Error('duplicate cards');
  console.log(`       ${r.n} unique cards`);
});

await step('AI Difficulty stepper offers five levels', async () => {
  const txt = await page.$eval('#select-options', (e) => e.textContent);
  if (!/AI Difficulty/.test(txt)) throw new Error('no AI Difficulty label: ' + txt.slice(0, 80));
  const levels = await page.evaluate(async () => {
    const { DIFFICULTIES, DIFFICULTY_LABELS } = await import('./js/constants.js');
    return DIFFICULTIES.map((d) => DIFFICULTY_LABELS[d]);
  });
  const want = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Legendary'];
  if (JSON.stringify(levels) !== JSON.stringify(want)) throw new Error(levels.join(','));
  console.log('       ' + levels.join(' / '));
});

await step('Random AI Opponent rerolls only the opponent', async () => {
  const before = await page.evaluate(() => ({ p1: globalThis.__NUF_GAME.select.p1, p2: globalThis.__NUF_GAME.select.p2 }));
  let changed = false;
  for (let i = 0; i < 8 && !changed; i++) {
    await page.click('#btn-random'); await page.waitForTimeout(80);
    const after = await page.evaluate(() => ({ p1: globalThis.__NUF_GAME.select.p1, p2: globalThis.__NUF_GAME.select.p2 }));
    if (after.p1 !== before.p1) throw new Error('it changed the player fighter');
    if (after.p2 !== before.p2) changed = true;
  }
  if (!changed) throw new Error('opponent never changed');
});

await page.click('#btn-select-confirm'); await page.waitForSelector('#screen-stage.is-active');
await page.click('#btn-stage-confirm'); await page.waitForSelector('#screen-combat.is-active');
await page.waitForTimeout(3000);

await step('the match is one human and one AI', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine;
    return {
      counts: e.assertPvE(), human: e.fighters.filter((f) => f.isPlayer).length,
      ai: e.controllers.size, p: e.player.data.id, o: e.enemy.data.id,
      aiOwnsOpponent: e.controllers.has(e.enemy.id), aiOwnsPlayer: e.controllers.has(e.player.id),
    };
  });
  if (r.human !== 1 || r.ai !== 1) throw new Error(JSON.stringify(r));
  if (!r.aiOwnsOpponent || r.aiOwnsPlayer) throw new Error('wrong side is AI-controlled');
  console.log(`       ${r.p} (you) vs ${r.o} (AI)`);
});

await step('the AI opponent fights back on its own', async () => {
  const acted = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine;
    const x0 = e.enemy.x; let moved = false; let attacked = false;
    for (let i = 0; i < 480; i++) { e.step(1 / 60); if (Math.abs(e.enemy.x - x0) > 8) moved = true; if (e.enemy.act) attacked = true; }
    return { moved, attacked };
  });
  if (!acted.moved && !acted.attacked) throw new Error('AI was inert');
  console.log(`       moved=${acted.moved} attacked=${acted.attacked}`);
});

await step('touch controls still build for the one human', async () => {
  const r = await page.evaluate(() => {
    const t = document.getElementById('touch-controls');
    const ctrls = [...t.querySelectorAll('.ctrl')].filter((c) => !c.hidden);
    return { hidden: t.hidden, buttons: ctrls.length, stick: !!t.querySelector('.stick'),
             dirs: ctrls.filter((c) => c.dataset.dir).length };
  });
  if (r.hidden || r.buttons !== 11 || r.stick || r.dirs !== 4) throw new Error(JSON.stringify(r));
  console.log(`       ${r.buttons} buttons (${r.dirs} directional), no joystick`);
});

await page.evaluate(() => {
  document.getElementById('touch-controls').hidden = true;
  const e = globalThis.__NUF_GAME.engine; e.player.x = 800; e.enemy.x = 1080; e.camera.focus = null; e.camera.focusTime = 0;
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/pve-combat.png` });

console.log(errors.length ? '  ✗ console: ' + errors.slice(0, 5).join(' | ') : '  ✓ no console errors');
if (errors.length) process.exitCode = 1;
await b.close();
