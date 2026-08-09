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

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
page.on('response', r => { if (r.status()>=400) errors.push(`HTTP ${r.status()}: ${r.url().split('/').slice(-3).join('/')}`); });
const step = async (n, fn) => { try { await fn(); console.log('  ✓ '+n); } catch(e){ console.log('  ✗ '+n+' — '+e.message); process.exitCode=1; } };

await page.goto(`${URL_BASE}`, { waitUntil:'networkidle' });
await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });

await step('boot indexes the sprite manifest', async () => {
  const r = await page.evaluate(async () => {
    const a = (await import('./js/asset-loader.js')).default;
    return { n: a.spriteManifest?.fighters?.length, pre: a.spriteManifest?.precached?.length };
  });
  if (!r.n) throw new Error('no manifest');
  console.log(`       ${r.n} sets indexed, ${r.pre} precached`);
});

await step('boot does NOT download the whole roster', async () => {
  const n = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(e => e.name.includes('/assets/fighters/') && e.name.endsWith('sprite-sheet.png')).length);
  if (n > 2) throw new Error(`${n} atlases fetched at boot`);
  console.log(`       ${n} atlases fetched at boot`);
});

await page.click('.menu__item[data-id="versus"]');
await page.waitForSelector('#screen-select.is-active'); await page.waitForTimeout(900);

await step('roster cards paint real per-fighter portraits', async () => {
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.fcard[data-painted="1"]')].slice(0, 12);
    const sigs = cards.map(c => {
      const cv = c.querySelector('canvas');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i+3] > 40) { sum += d[i]*7 + d[i+1]*11 + d[i+2]*13; n++; }
      return `${c.dataset.id}:${n}:${sum % 100000}`;
    });
    return { count: cards.length, sigs, unique: new Set(sigs.map(s => s.split(':').slice(1).join(':'))).size };
  });
  if (r.count < 6) throw new Error(`only ${r.count} cards painted`);
  if (r.unique < r.count) throw new Error(`${r.count} cards but only ${r.unique} distinct images`);
  console.log(`       ${r.count} cards, all distinct`);
});
await page.screenshot({ path: `${OUT}/nu-select.png` });

await page.click('#btn-select-confirm'); await page.waitForSelector('#screen-stage.is-active');
await page.click('#btn-stage-confirm'); await page.waitForSelector('#screen-combat.is-active');
await page.waitForTimeout(3000);

await step('both fighters use their own sheet', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine;
    return e.fighters.map(f => ({ id: f.data.id, sheet: f.sheet?.meta?.id, img: !!f.sheet?.image }));
  });
  for (const f of r) {
    if (!f.img) throw new Error(`${f.id} has no sheet image`);
    if (f.sheet !== f.id) throw new Error(`${f.id} is using ${f.sheet}'s art`);
  }
  console.log('       ' + r.map(f => f.id).join(' vs '));
});

await step('all 19 animation rows are reachable in game', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine, f = e.player;
    const seen = {};
    const run = (setup, steps = 3) => { setup(); for (let i = 0; i < steps; i++) f.step(1/60, e.ctx(f)); return f.anim.name; };
    e.enemy.x = 1800; f.x = 400;
    seen.idle = run(() => { f.state='idle'; f.act=null; });
    seen.walk = run(() => f.walk(1,false));
    seen.run  = run(() => f.walk(1,true));
    seen.guard= run(() => { f.state='idle'; f.setGuard(true); }); f.setGuard(false);
    seen.hurt = run(() => f.setState('hitstun',0.4));
    seen.kd   = run(() => f.setState('knockdown',0.6));
    seen.wake = run(() => f.setState('wakeup',0.3));
    seen.vic  = run(() => f.setState('victory',3));
    seen.def  = run(() => f.setState('ko',2));
    seen.tf   = run(() => f.setState('transform',0.7));
    f.setState('idle'); f.act = null; f.chakra = 300; f.cooldowns.clear();
    seen.light = run(() => f.use(e.abilityById(f.data.basicCombos[0])), 2);
    f.state='idle'; f.act=null; f.cooldowns.clear();
    seen.heavy = run(() => f.use(f.abilities.heavy), 2);
    f.state='idle'; f.act=null; f.cooldowns.clear();
    seen.ult = run(() => f.use(f.abilities.ultimate), 2);
    for (let i = 0; i < 3; i++) {
      f.state='idle'; f.act=null; f.cooldowns.clear(); f.chakra=300;
      const a = f.abilities.slots[i];
      if (a) seen['j'+i] = run(() => f.use(a), 2);
    }
    f.state='idle'; f.act=null;
    seen.jump = run(() => f.jump(), 2);
    return seen;
  });
  const want = { idle:'idle', walk:'walk', run:'run', guard:'guard', hurt:'hurt', kd:'knockdown',
                 wake:'getUp', vic:'victory', def:'defeat', tf:'transformation',
                 light:'lightAttack', heavy:'heavyAttack', ult:'ultimate',
                 j0:'jutsu1', j1:'jutsu2', j2:'jutsu3', jump:'jump' };
  const bad = Object.entries(want).filter(([k,v]) => r[k] !== v).map(([k,v]) => `${k}: got ${r[k]}, want ${v}`);
  if (bad.length) throw new Error(bad.join('; '));
  console.log('       17 state/ability mappings correct');
});

await step('contact frame still matches the hitbox', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine, f = e.player;
    f.state='idle'; f.act=null; f.y=0; f.vy=0; f.chakra=300; f.cooldowns.clear(); f.invulnUntil=-1;
    const a = e.abilityById(f.data.basicCombos[0]);
    f.use(a);
    let contact = -1;
    for (let i = 0; i < 90 && f.act; i++) { f.step(1/60, e.ctx(f)); if (contact < 0 && f.isActiveFrame) contact = f.anim.index; }
    return { contact, want: f.sheet.animations.lightAttack.hitFrame };
  });
  if (r.contact !== r.want) throw new Error(`hitbox on frame ${r.contact}, contact frame ${r.want}`);
  console.log(`       contact on frame ${r.contact}`);
});

await page.evaluate(() => {
  const e = globalThis.__NUF_GAME.engine;
  e.player.x = 800; e.enemy.x = 1080; e.camera.focus = null; e.camera.focusTime = 0;
  document.getElementById('touch-controls').hidden = true;
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/nu-combat.png` });

await step('frame rate holds', async () => {
  const fps = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 1500)); return globalThis.__NUF_GAME.loop.fps; });
  if (fps < 40) throw new Error(`${fps.toFixed(0)} fps`);
  console.log(`       ~${fps.toFixed(0)} fps`);
});

console.log(errors.length ? '  ✗ console: ' + errors.slice(0,6).join(' | ') : '  ✓ no console errors');
if (errors.length) process.exitCode = 1;
await browser.close();
