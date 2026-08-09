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
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 },          // iPhone 14 landscape
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();

const errors = [];
const warnings = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url() + ' — ' + r.failure()?.errorText));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

const step = async (name, fn) => {
  try { await fn(); console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); process.exitCode = 1; }
};

console.log('\n== boot ==');
await page.goto(URL_BASE, { waitUntil: 'networkidle' });

await step('loading screen finishes and app appears', async () => {
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => {
    const l = document.getElementById('loading-screen');
    return l && l.classList.contains('is-done');
  }, { timeout: 15000 });
});

await step('no loading error box', async () => {
  const hidden = await page.$eval('#loading-error', (e) => e.hidden);
  if (!hidden) {
    const t = await page.$eval('#loading-error-text', (e) => e.textContent);
    throw new Error(t.slice(0, 500));
  }
});

await step('main menu is visible with all 12 entries', async () => {
  await page.waitForSelector('#screen-menu.is-active', { timeout: 5000 });
  const n = await page.$$eval('.menu__item', (els) => els.length);
  if (n !== 12) throw new Error(`expected 12 menu items, got ${n}`);
});

await step('rotate overlay is hidden in landscape', async () => {
  const hidden = await page.$eval('#rotate-overlay', (e) => e.hidden);
  if (!hidden) throw new Error('rotate overlay showing in landscape');
});

await step('boot report shows the expected data scale', async () => {
  const r = await page.evaluate(() => globalThis.__NUF_REPORT);
  if (!r || !r.ok) throw new Error('validator not ok: ' + JSON.stringify(r?.errors?.slice(0, 3)));
  console.log('      ', JSON.stringify(r.stats));
});

await page.screenshot({ path: `${OUT}/shot-menu.png` });

console.log('\n== portrait rotation ==');
await step('rotate overlay appears in portrait', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const hidden = await page.$eval('#rotate-overlay', (e) => e.hidden);
  if (hidden) throw new Error('rotate overlay did not appear in portrait');
});
await page.screenshot({ path: `${OUT}/shot-rotate.png` });
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(400);

console.log('\n== character select ==');
await step('versus opens the select screen with a populated roster', async () => {
  await page.click('.menu__item[data-id="versus"]');
  await page.waitForSelector('#screen-select.is-active', { timeout: 5000 });
  await page.waitForTimeout(500);
  const n = await page.$$eval('.fcard', (e) => e.length);
  if (n < 100) throw new Error(`only ${n} roster cards rendered`);
  console.log(`       ${n} cards`);
});

await step('search filters the roster', async () => {
  await page.fill('#select-search', 'itachi');
  await page.waitForTimeout(300);
  const n = await page.$$eval('.fcard', (e) => e.length);
  if (n === 0 || n > 5) throw new Error(`search returned ${n} cards`);
  await page.fill('#select-search', '');
  await page.waitForTimeout(300);
});

await step('lazy portraits actually paint', async () => {
  const painted = await page.$$eval('.fcard[data-painted="1"]', (e) => e.length);
  if (painted < 5) throw new Error(`only ${painted} portraits painted`);
});

await step('the detail sheet opens with move and transformation data', async () => {
  await page.evaluate(() => {
    const g = globalThis.__NUF_GAME;
    g.select.openSheet('naruto');
  });
  await page.waitForSelector('#fighter-sheet:not([hidden])', { timeout: 3000 });
  const text = await page.$eval('#sheet-content', (e) => e.textContent);
  for (const needle of ['Rasengan', 'Sage Mode', 'Baryon', 'Full move set', 'Mastery']) {
    if (!text.includes(needle)) throw new Error(`detail sheet missing "${needle}"`);
  }
});
await page.screenshot({ path: `${OUT}/shot-select.png` });
await page.click('#fighter-sheet .sheet__close');

console.log('\n== stage select ==');
await step('confirming a fighter opens stage select', async () => {
  await page.click('#btn-select-confirm');
  await page.waitForSelector('#screen-stage.is-active', { timeout: 5000 });
  const n = await page.$$eval('.stage-card', (e) => e.length);
  if (n < 10) throw new Error(`only ${n} stages`);
});
await page.screenshot({ path: `${OUT}/shot-stage.png` });

console.log('\n== combat ==');
await step('a match starts and the HUD binds', async () => {
  await page.click('#btn-stage-confirm');
  await page.waitForSelector('#screen-combat.is-active', { timeout: 5000 });
  await page.waitForTimeout(2500);
  const names = await page.evaluate(() => [
    document.getElementById('hud-name-p1').textContent,
    document.getElementById('hud-name-p2').textContent,
  ]);
  if (!names[0] || names[0] === '—') throw new Error('HUD did not bind');
  console.log(`       ${names[0]} vs ${names[1]}`);
});

await step('touch controls are present and positioned', async () => {
  const info = await page.evaluate(() => {
    const t = document.getElementById('touch-controls');
    const ctrls = [...t.querySelectorAll('.ctrl')].filter((c) => !c.hidden);
    return {
      hidden: t.hidden,
      ids: ctrls.map((c) => c.dataset.ctrl),
      stick: !!t.querySelector('.stick'),
      offscreen: ctrls.filter((c) => {
        const r = c.getBoundingClientRect();
        return r.width === 0 || r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight;
      }).map((c) => c.dataset.action),
      // No two controls may overlap, or a thumb press would be ambiguous.
      overlaps: (() => {
        const boxes = ctrls.map((c) => {
          const r = c.getBoundingClientRect();
          return { id: c.dataset.ctrl, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
        });
        const bad = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]; const b = boxes[j];
            if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < (a.r + b.r) * 0.92) bad.push(`${a.id}/${b.id}`);
          }
        }
        return bad;
      })(),
    };
  });
  if (info.hidden) throw new Error('touch controls hidden');
  const want = ['up', 'down', 'left', 'right', 'jutsu', 'guard', 'chakra', 'light', 'heavy', 'awaken', 'ultimate'];
  const missing = want.filter((id) => !info.ids.includes(id));
  if (missing.length) throw new Error('missing controls: ' + missing.join(','));
  if (info.ids.length !== want.length) throw new Error(`expected ${want.length} buttons, got ${info.ids.length}: ${info.ids.join(',')}`);
  if (info.stick) throw new Error('the joystick should be gone — movement is four buttons now');
  if (info.ids.includes('jump')) throw new Error('there must be no Jump button; UP is upward movement');
  if (info.offscreen.length) throw new Error('offscreen controls: ' + info.offscreen.join(','));
  if (info.overlaps.length) throw new Error('overlapping controls: ' + info.overlaps.join(', '));
  console.log(`       ${info.ids.length} buttons: ${info.ids.join(', ')}`);
});

await step('all three jutsu slots are reachable through the one JUTSU button', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const slots = g.engine.player.abilities.slots.filter(Boolean);
    const seen = [];
    for (let i = 0; i < slots.length; i++) {
      seen.push({
        slot: g.jutsuSlot,
        label: document.querySelector('.ctrl[data-action="jutsu"] .ctrl__label')?.textContent,
      });
      g.cycleJutsuSlot();
      await new Promise((res) => setTimeout(res, 30));
    }
    return { slots: slots.length, seen, chip: !document.getElementById('ctrl-jutsu-cycle').hidden };
  });
  if (r.slots < 3) throw new Error(`fighter has only ${r.slots} jutsu`);
  if (!r.chip) throw new Error('the cycle chip is hidden for a fighter with several jutsu');
  const slotsSeen = new Set(r.seen.map((x) => x.slot));
  if (slotsSeen.size !== r.slots) throw new Error(`cycling reached ${slotsSeen.size} of ${r.slots} slots`);
  const labels = new Set(r.seen.map((x) => x.label));
  if (labels.size !== r.slots) throw new Error('the caption does not follow the selected jutsu: ' + [...labels].join('/'));
  console.log(`       cycled ${r.slots} slots: ${r.seen.map((x) => x.label).join(' / ')}`);
});


/**
 * Put the engine into a steady FIGHT phase before asserting on it.
 *
 * The AI fights for real through the whole suite, so by the time these later
 * tests run a round may have been taken and the match may be sitting in a
 * round transition or the next round's intro. During those phases the engine
 * deliberately does not advance a fighter's action and re-centres the camera,
 * so a test that assumes a steady fight is asserting on a transient.
 *
 * Heals both sides and polls for the fight phase — a race, not a delay.
 */
async function readyForFight(page) {
  const ok = await page.evaluate(async () => {
    const e = globalThis.__NUF_GAME.engine;
    for (let i = 0; i < 400; i++) {
      for (const f of [e.player, e.enemy]) {
        f.health = f.maxHealth;
        f.displayHealth = f.maxHealth;
        f.isDead = false;
        f.act = null;
        f.airborne = false;
        f.vy = 0;
        f.y = 0;
        if (f.setState) f.setState('idle');
      }
      if (e.phase === 'fight' && !e.isPaused) return true;
      await new Promise((r) => setTimeout(r, 16));
    }
    return false;
  });
  if (!ok) throw new Error('the engine never reached a steady fight phase');
}

await step('fighters cannot be separated beyond the camera frame', async () => {
  await readyForFight(page);
  const r = await page.evaluate(async () => {
    const e = globalThis.__NUF_GAME.engine;
    e.player.x = 80; e.enemy.x = 1840;
    // The camera lerps at dt * 7.5, so it needs ~40-60 frames to close a large
    // gap — and how large the gap is depends on where the previous test left
    // it. Stepping a fixed 20 frames asserts on a camera still in flight.
    // Step until it settles instead, with a budget, and fail if it never does.
    const inFrame = () => {
      const halfView = (e.camera.viewW / 2) / e.camera.zoom;
      return [e.player.x, e.enemy.x].every((x) => Math.abs(x - e.camera.x) <= halfView + 80);
    };
    let frames = 0;
    let settled = false;
    for (; frames < 240; frames++) {
      e.step(1 / 60);
      if (inFrame()) { settled = true; break; }
    }
    return {
      spread: Math.abs(e.enemy.x - e.player.x),
      inFrame: settled,
      frames,
      zoom: +e.camera.zoom.toFixed(3),
    };
  });
  if (r.spread > 1200) throw new Error(`fighters drifted ${Math.round(r.spread)} units apart`);
  if (!r.inFrame) throw new Error('the camera never brought both fighters into frame');
  console.log(`       spread ${Math.round(r.spread)} at zoom ${r.zoom}, framed after ${r.frames} frames`);
});

await step('the game loop is running and the canvas has content', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const before = g.engine.time;
    await new Promise((res) => setTimeout(res, 600));
    const c = document.getElementById('combat-canvas');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return { advanced: g.engine.time > before, fps: g.loop.fps, pixel: [...d].slice(0, 3) };
  });
  if (!r.advanced) throw new Error('simulation did not advance');
  if (r.pixel.every((v) => v === 0)) throw new Error('canvas is blank');
  console.log(`       ~${r.fps.toFixed(0)} fps, centre pixel rgb(${r.pixel.join(',')})`);
});

await step('multi-touch: move and attack at the same time', async () => {
  const res = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const f = g.engine.player;
    const el = document.getElementById('touch-controls');
    const rect = (sel) => {
      const r = el.querySelector(sel).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const right = rect('.ctrl[data-action="right"]');
    const light = rect('.ctrl[data-action="light"]');
    const send = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch',
    }));

    // Park the AI: a launcher landing mid-assertion would hide whether the
    // inputs worked, which is what this test is about.
    const enemyX = g.engine.enemy.x;
    g.engine.enemy.x = f.x + 1400;
    f.act = null; f.state = 'idle'; f.chakra = 60; f.cooldowns.clear();
    g.updateTouchFeedback();

    const x0 = f.x;
    send('pointerdown', 1, right.x, right.y);        // hold RIGHT with one thumb
    send('pointerdown', 2, light.x, light.y);        // PUNCH with the other
    // Sample across the hold: an attack starts and ends inside this window.
    let attacked = false;
    let axisHeldWhileAttacking = 0;
    for (let i = 0; i < 14; i++) {
      await new Promise((r) => setTimeout(r, 25));
      if (f.act || f.state === 'attack') attacked = true;
      axisHeldWhileAttacking = Math.max(axisHeldWhileAttacking, g.touch.state.axis.x);
    }
    const moved = Math.abs(f.x - x0) > 4;
    // Releasing the attack finger must NOT drop the movement finger.
    send('pointerup', 2, light.x, light.y);
    await new Promise((r) => setTimeout(r, 60));
    const stillMoving = el.querySelector('.ctrl[data-action="right"]').classList.contains('is-down');
    send('pointerup', 1, right.x, right.y);
    // Hand the match back the way it was found — later tests read positions.
    g.engine.enemy.x = enemyX;
    f.x = x0;
    return { moved, attacked, stillMoving, axisHeldWhileAttacking, x0, x1: f.x };
  });
  if (!res.moved) throw new Error(`holding RIGHT did not move the fighter (${res.x0} → ${res.x1})`);
  if (!res.attacked) throw new Error('PUNCH did not come out while moving');
  if (!res.stillMoving) throw new Error('releasing the attack finger cancelled the movement finger');
  if (res.axisHeldWhileAttacking <= 0) throw new Error('the movement axis was lost during the attack');
  console.log(`       moved ${Math.round(res.x1 - res.x0)}px while attacking, movement survived the release`);
});

await step('attacks connect and deal damage', async () => {
  const dealt = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const e = g.engine;
    e.player.x = e.enemy.x - 70;
    for (let i = 0; i < 8; i++) {
      e.player.act = null;
      e.player.state = 'idle';
      e.player.use(e.abilityById(e.player.data.basicCombos[0]));
      for (let k = 0; k < 30; k++) e.step(1 / 60);
      e.player.x = e.enemy.x - 70;
    }
    return e.player.stats.damageDealt;
  });
  if (dealt <= 0) throw new Error('no damage was dealt in 8 attacks');
  console.log(`       ${Math.round(dealt)} damage dealt`);
});

await step('transformation is refused without requirements and works with them', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const f = g.engine.player;
    f.awakening = 0;
    const denied = g.engine.requestTransform(f);
    f.awakening = 100; f.chakra = 100;
    const ok = g.engine.requestTransform(f);
    return { denied, ok, form: f.form };
  });
  if (r.denied) throw new Error('transformed with no awakening');
  if (!r.ok || !r.form) throw new Error('could not transform with requirements met');
  console.log(`       form: ${r.form}`);
});

await step('projectiles spawn and are pooled', async () => {
  // A KO earlier in the suite can leave the match in a round intro, where the
  // engine correctly refuses to advance an attack — so the projectile never
  // reaches its spawn frame. Get back to a real fight first.
  await readyForFight(page);
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const e = g.engine;
    const f = e.player;
    // Move well away so the shot does not connect on the first active frame.
    f.x = 200; e.enemy.x = 1600;
    f.act = null; f.state = 'idle'; f.y = 0; f.vy = 0;
    f.chakra = 100; f.cooldowns.clear();
    const a = e.abilityById('naruto_rasenshuriken');
    const used = f.use(a);
    let peak = 0;
    let phase = e.phase;
    for (let k = 0; k < 40; k++) {
      e.step(1 / 60);
      peak = Math.max(peak, e.projectiles.activeCount);
      if (e.phase !== 'fight') phase = e.phase;
    }
    return { used, peak, pool: e.projectiles.items.length, phase };
  });
  if (!r.used) throw new Error('the ability was refused');
  if (r.phase !== 'fight') throw new Error(`the match left the fight phase mid-test (${r.phase})`);
  if (r.peak < 1) throw new Error('no projectile spawned');
  console.log(`       peak ${r.peak} live / ${r.pool} pooled`);
});

await page.screenshot({ path: `${OUT}/shot-combat.png` });

await step('pause menu opens and resumes', async () => {
  await page.click('#btn-pause');
  await page.waitForSelector('#overlay-pause:not([hidden])', { timeout: 3000 });
  const paused = await page.evaluate(() => globalThis.__NUF_GAME.engine.isPaused);
  if (!paused) throw new Error('engine not paused');
  await page.click('#pause-actions .btn--primary');
  await page.waitForTimeout(200);
  const resumed = await page.evaluate(() => !globalThis.__NUF_GAME.engine.isPaused);
  if (!resumed) throw new Error('engine did not resume');
});

console.log('\n== match completion ==');
await step('a match can be driven to a result screen', async () => {
  // The default is best-of-three, so KO the opponent once per round until the
  // match itself resolves.
  const rounds = await page.evaluate(() => globalThis.__NUF_GAME.engine.maxRounds);
  for (let i = 0; i < rounds + 1; i++) {
    const done = await page.evaluate(() => !document.getElementById('overlay-results').hidden);
    if (done) break;
    await page.evaluate(() => {
      const e = globalThis.__NUF_GAME.engine;
      if (!e || e.phase !== 'fight') return;
      e.enemy.health = 1;
      e.enemy.kill();
    });
    await page.waitForTimeout(3200);
  }
  await page.waitForSelector('#overlay-results:not([hidden])', { timeout: 12000 });
  const title = await page.$eval('#results-title', (e) => e.textContent);
  const rows = await page.$eval('#results-body', (e) => e.textContent);
  if (!/XP earned/.test(rows)) throw new Error('results screen has no progression rows');
  console.log(`       result: ${title} (best of ${rounds})`);
});
await page.screenshot({ path: `${OUT}/shot-results.png` });

console.log('\n== other screens ==');
await step('returning to the menu works', async () => {
  await page.evaluate(() => {
    const g = globalThis.__NUF_GAME;
    const btns = [...document.querySelectorAll('#results-actions .btn')];
    (btns.find((b) => /menu/i.test(b.textContent)) || btns[btns.length - 1]).click();
  });
  await page.waitForSelector('#screen-menu.is-active', { timeout: 5000 });
});

for (const [id, sel, check] of [
  ['story', '#screen-list.is-active', 'The Severed Accord'],
  ['arcade', '#screen-list.is-active', 'Classic Ladder'],
  ['tower', '#screen-list.is-active', 'Floor 1'],
  ['bossrush', '#screen-list.is-active', 'Tailed Beast Rush'],
  ['survival', '#screen-list.is-active', 'survival run'],
  ['collection', '#screen-list.is-active', 'Fighters'],
  ['achievements', '#screen-list.is-active', 'First Victory'],
  ['credits', '#screen-list.is-active', 'original'],
]) {
  await step(`menu → ${id} renders real content`, async () => {
    await page.click('.menu__item[data-id="' + id + '"]');
    await page.waitForSelector(sel, { timeout: 4000 });
    const text = await page.$eval('#screen-list', (e) => e.textContent);
    if (!text.toLowerCase().includes(check.toLowerCase())) {
      throw new Error(`"${check}" not found on the ${id} screen`);
    }
    await page.click('#screen-list [data-action="back"]');
    await page.waitForSelector('#screen-menu.is-active', { timeout: 4000 });
  });
}

await step('settings screen renders and controls respond', async () => {
  await page.click('.menu__item[data-id="settings"]');
  await page.waitForSelector('#screen-settings.is-active', { timeout: 4000 });
  const groups = await page.$$eval('.settings__group', (e) => e.length);
  if (groups < 2) throw new Error('settings did not render');
  // Toggle quality to low and confirm it applies to the body.
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.segmented button')];
    btns.find((b) => b.textContent === 'Low')?.click();
  });
  const q = await page.$eval('body', (b) => b.dataset.quality);
  if (q !== 'low') throw new Error('quality setting did not apply, got ' + q);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.segmented button')];
    btns.find((b) => b.textContent === 'High')?.click();
  });
});
await page.screenshot({ path: `${OUT}/shot-settings.png` });

await step('control layout editor opens and controls are draggable', async () => {
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#settings-tabs .chip')];
    tabs.find((t) => t.textContent === 'Controls')?.click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#settings-body .btn')];
    btns.find((b) => b.textContent === 'Edit layout')?.click();
  });
  await page.waitForSelector('#screen-layout.is-active', { timeout: 4000 });
  const n = await page.$$eval('#layout-stage .ctrl', (e) => e.filter((x) => !x.hidden).length);
  if (n !== 11) throw new Error(`layout editor shows ${n} controls`);
});
await page.screenshot({ path: `${OUT}/shot-layout.png` });

console.log('\n== save persistence ==');
await step('progress survives a reload', async () => {
  const before = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('nuf.save.v1'));
    return { xp: s.xp, coins: s.coins, matches: s.stats.matches };
  });
  await page.goto(URL_BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  const after = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('nuf.save.v1'));
    return { xp: s.xp, coins: s.coins, matches: s.stats.matches };
  });
  if (after.xp !== before.xp || after.matches !== before.matches) {
    throw new Error(`save changed across reload: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  }
  if (before.matches < 1) throw new Error('the completed match was not recorded');
  console.log(`       xp ${after.xp}, coins ${after.coins}, matches ${after.matches}`);
});

console.log('\n== PWA ==');
await step('service worker registers and controls the page', async () => {
  const r = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { scope: reg?.scope, active: !!reg?.active };
  });
  if (!r.active) throw new Error('service worker not active');
  if (!r.scope.endsWith('/Ninja-Universe-Fighters/')) throw new Error('bad scope: ' + r.scope);
  console.log('       scope ' + r.scope);
});

await step('the app shell is cached for offline use', async () => {
  const n = await page.evaluate(async () => {
    const names = await caches.keys();
    const c = await caches.open(names.find((x) => x.startsWith('nuf-')));
    return (await c.keys()).length;
  });
  if (n < 40) throw new Error(`only ${n} entries cached`);
  console.log(`       ${n} files cached`);
});

await step('the game still boots with the network offline', async () => {
  await ctx.setOffline(true);
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForSelector('#screen-menu.is-active', { timeout: 8000 });
  const err = await page.$eval('#loading-error', (e) => e.hidden);
  if (!err) throw new Error('offline boot showed an error');
  await ctx.setOffline(false);
});
await page.screenshot({ path: `${OUT}/shot-offline.png` });

console.log('\n== console output ==');
const ignorable = (t) => /favicon|Manifest:|beforeinstallprompt|Download the React/i.test(t);
const realErrors = errors.filter((e) => !ignorable(e));
if (realErrors.length) {
  console.log('  ✗ ' + realErrors.length + ' console/page errors:');
  for (const e of realErrors.slice(0, 15)) console.log('     - ' + e.slice(0, 300));
  process.exitCode = 1;
} else {
  console.log('  ✓ no console errors');
}
if (warnings.length) {
  console.log(`  (${warnings.length} warnings)`);
  for (const w of warnings.slice(0, 5)) console.log('     ~ ' + w.slice(0, 200));
}

await browser.close();
console.log('\ndone.');
