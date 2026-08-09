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

/**
 * Mobile landscape combat HUD.
 *
 * Checks the control set, the dynamic fighter plate, safe areas across the
 * three iPhone landscape sizes, multi-touch combinations, and that a disabled
 * special cannot be fired.
 */

const SAFE = { t: 8, r: 59, b: 21, l: 59 };
const INSETS = `:root{--sat:${SAFE.t}px!important;--sar:${SAFE.r}px!important;--sab:${SAFE.b}px!important;--sal:${SAFE.l}px!important}`;

const b = await chromium.launch(LAUNCH);
const errors = [];
const step = async (n, fn) => {
  try { await fn(); console.log('  ✓ ' + n); }
  catch (e) { console.log('  ✗ ' + n + ' — ' + e.message); process.exitCode = 1; }
};

/** Boot straight into a match with a named fighter. */
async function match(page, p1, p2 = 'sasuke') {
  await page.goto(`${URL_BASE}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.addStyleTag({ content: INSETS });
  await page.click('.menu__item[data-id="versus"]');
  await page.waitForSelector('#screen-select.is-active');
  await page.waitForTimeout(900);
  await page.evaluate(([a, c]) => {
    const g = globalThis.__NUF_GAME;
    g.select.setP1(a); g.select.setP2(c);
  }, [p1, p2]);
  await page.waitForTimeout(300);
  await page.click('#btn-select-confirm'); await page.waitForSelector('#screen-stage.is-active');
  await page.click('#btn-stage-confirm'); await page.waitForSelector('#screen-combat.is-active');
  await page.waitForTimeout(3200);
}

const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().split('/').slice(-3).join('/')}`); });

await match(page, 'naruto');

console.log('\n== control set ==');

await step('four directional buttons exist, and no Jump button', async () => {
  const r = await page.evaluate(() => {
    const ctrls = [...document.querySelectorAll('#touch-controls .ctrl')].filter((c) => !c.hidden);
    const box = (id) => {
      const el = ctrls.find((c) => c.dataset.ctrl === id);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
    };
    return {
      ids: ctrls.map((c) => c.dataset.ctrl),
      dirs: ctrls.filter((c) => c.dataset.dir).map((c) => c.dataset.dir),
      up: box('up'), down: box('down'), left: box('left'), right: box('right'),
    };
  });
  for (const d of ['up', 'down', 'left', 'right']) {
    if (!r.dirs.includes(d)) throw new Error(`no ${d} button`);
  }
  if (r.ids.includes('jump')) throw new Error('a Jump button exists');
  // Cross shape: up above down, left of right, roughly aligned.
  if (!(r.up.cy < r.left.cy && r.left.cy < r.down.cy)) throw new Error('up/down are not above/below the middle row');
  if (!(r.left.cx < r.right.cx)) throw new Error('left is not left of right');
  if (Math.abs(r.up.cx - r.down.cx) > 3) throw new Error('up and down are not on the same column');
  console.log(`       cross: up(${Math.round(r.up.cx)},${Math.round(r.up.cy)}) left/right rows aligned`);
});

await step('punch, kick, guard, chakra and jutsu all exist', async () => {
  const ids = await page.evaluate(() => [...document.querySelectorAll('#touch-controls .ctrl')]
    .filter((c) => !c.hidden).map((c) => c.dataset.ctrl));
  for (const want of ['light', 'heavy', 'guard', 'chakra', 'jutsu']) {
    if (!ids.includes(want)) throw new Error(`no ${want} button`);
  }
  const labels = await page.evaluate(() => ['light', 'heavy', 'guard', 'chakra']
    .map((id) => document.querySelector(`.ctrl[data-action="${id}"] .ctrl__label`)?.textContent));
  if (labels[0] !== 'PUNCH' || labels[1] !== 'KICK' || labels[2] !== 'GUARD' || labels[3] !== 'CHAKRA') {
    throw new Error('captions are ' + labels.join('/'));
  }
  console.log(`       ${labels.join(' / ')} + JUTSU`);
});

await step('awakening and ultimate exist and sit in the top-right', async () => {
  const r = await page.evaluate(() => {
    const g = (id) => {
      const el = document.querySelector(`.ctrl[data-ctrl="${id}"]`);
      const b = el.getBoundingClientRect();
      return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, label: el.querySelector('.ctrl__label')?.textContent };
    };
    const attack = document.querySelector('.ctrl[data-ctrl="light"]').getBoundingClientRect();
    return { aw: g('awaken'), ult: g('ultimate'), attackTop: attack.top, vw: innerWidth, vh: innerHeight };
  });
  if (r.aw.label !== 'AWAKENING') throw new Error('awakening label: ' + r.aw.label);
  if (r.ult.label !== 'ULTIMATE') throw new Error('ultimate label: ' + r.ult.label);
  for (const [name, o] of [['awakening', r.aw], ['ultimate', r.ult]]) {
    if (o.cy > r.vh * 0.3) throw new Error(`${name} is not in the top band (y=${Math.round(o.cy)})`);
    if (o.cx < r.vw * 0.6) throw new Error(`${name} is not on the right (x=${Math.round(o.cx)})`);
    if (o.cy > r.attackTop) throw new Error(`${name} is not separated from the attack cluster`);
  }
  console.log(`       awakening(${Math.round(r.aw.cx)},${Math.round(r.aw.cy)}) ultimate(${Math.round(r.ult.cx)},${Math.round(r.ult.cy)})`);
});

console.log('\n== fighter plate ==');

await step('the plate shows the fighter actually selected, not a fixed one', async () => {
  const r = await page.evaluate(() => ({
    name: document.getElementById('hud-name-p1').textContent,
    src: document.getElementById('hud-portrait-p1').getAttribute('src'),
    engine: globalThis.__NUF_GAME.engine.player.data.id,
  }));
  if (!/NARUTO/.test(r.name)) throw new Error('name is ' + r.name);
  if (!/naruto/.test(r.src || '')) throw new Error('portrait is ' + r.src);
  if (r.engine !== 'naruto') throw new Error('engine has ' + r.engine);
});

await step('the plate follows a different fighter without a reload', async () => {
  await match(page, 'kakashi', 'gaara');
  const r = await page.evaluate(() => ({
    p1: document.getElementById('hud-name-p1').textContent,
    p1src: document.getElementById('hud-portrait-p1').getAttribute('src'),
    p2: document.getElementById('hud-name-p2').textContent,
    p2src: document.getElementById('hud-portrait-p2').getAttribute('src'),
  }));
  if (!/KAKASHI/.test(r.p1)) throw new Error('p1 name is ' + r.p1);
  if (!/fighters\/kakashi\//.test(r.p1src || '')) throw new Error('p1 portrait is ' + r.p1src);
  if (!/GAARA/.test(r.p2)) throw new Error('p2 name is ' + r.p2);
  if (!/fighters\/gaara\//.test(r.p2src || '')) throw new Error('p2 portrait is ' + r.p2src);
  console.log(`       ${r.p1} vs ${r.p2}, portraits follow`);
});

await step('health and chakra bars are present and health is the bigger one', async () => {
  const r = await page.evaluate(() => {
    const h = document.querySelector('.hud__side--p1 .bar--health').getBoundingClientRect();
    const c = document.querySelector('.hud__side--p1 .bar--chakra').getBoundingClientRect();
    return { h: h.height, c: c.height, hw: h.width };
  });
  if (!(r.h > r.c)) throw new Error(`health ${r.h}px is not taller than chakra ${r.c}px`);
  if (r.hw < 60) throw new Error('health bar is too narrow: ' + r.hw);
  console.log(`       health ${Math.round(r.h)}px over chakra ${Math.round(r.c)}px`);
});

await step('the centre of the screen stays clear of HUD panels', async () => {
  const r = await page.evaluate(() => {
    const vw = innerWidth; const vh = innerHeight;
    // "Mostly clear" middle third. The reference art puts its own CHAKRA
    // button at ~71% of the width, so anything inside 32–68% is a blocker.
    const zone = { x0: vw * 0.32, x1: vw * 0.68, y0: vh * 0.28, y1: vh * 0.92 };
    const hits = [];
    // Only the persistent chrome is judged: the fighter plates, the round
    // stack, and the buttons. Cut-ins and announcements are transient by
    // design and are supposed to cross the middle.
    const persistent = document.querySelectorAll(
      '.hud__side, .fbar, .hud__name, .hud__meters, .hud__centre, .hud__form, #touch-controls .ctrl, #btn-pause',
    );
    for (const el of persistent) {
      if (el.hidden || !el.getClientRects().length) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      if (b.right > zone.x0 && b.left < zone.x1 && b.bottom > zone.y0 && b.top < zone.y1) {
        hits.push(`${el.dataset.ctrl || el.id || el.className}@${Math.round(b.left)},${Math.round(b.top)}`);
      }
    }
    return hits;
  });
  if (r.length) throw new Error('centre is blocked by: ' + r.join(', '));
});

console.log('\n== multi-touch ==');

/** Press a set of buttons with independent pointer ids, then read the state. */
async function combo(page, ids, holdMs = 320) {
  return page.evaluate(async ([list, ms]) => {
    const g = globalThis.__NUF_GAME;
    const el = document.getElementById('touch-controls');
    const f = g.engine.player;
    // Put the opponent out of reach: this test is about the controls, and a
    // launcher landing mid-assertion would hide whether the input worked.
    g.engine.enemy.x = f.x + 1400;
    // Enough chakra to cast, but NOT full — a full gauge correctly disables
    // the CHAKRA button, which would make this a test of the wrong thing.
    f.health = f.maxHealth; f.chakra = 60; f.x = 700; f.cooldowns.clear();
    f.act = null; f.state = 'idle';
    // The disabled classes are refreshed once per frame; this test rewrites
    // the fighter's state synchronously, so refresh them before pressing.
    g.updateTouchFeedback();
    const send = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch',
    }));
    const pts = list.map((id, i) => {
      const r = el.querySelector(`.ctrl[data-action="${id}"]`).getBoundingClientRect();
      return { id, pid: i + 10, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const x0 = f.x;
    for (const p of pts) send('pointerdown', p.pid, p.x, p.y);
    // Sample across the hold: an attack starts and finishes inside the window,
    // so a single reading at the end can miss it entirely.
    let acting = false;
    let charging = false;
    let guard = false;
    let axis = { x: 0, y: 0 };
    const frames = Math.max(1, Math.round(ms / 25));
    for (let i = 0; i < frames; i++) {
      await new Promise((r) => setTimeout(r, 25));
      if (f.act || f.state === 'attack') acting = true;
      if (f.charging) charging = true;
      if (f.guardHeld) guard = true;
      if (Math.abs(g.touch.state.axis.x) > Math.abs(axis.x)) axis = { ...g.touch.state.axis };
    }
    const held = pts.filter((p) => el.querySelector(`.ctrl[data-action="${p.id}"]`).classList.contains('is-down')).map((p) => p.id);
    const out = { held, axis, guard, charging, acting, moved: Math.abs(f.x - x0) };
    for (const p of pts) send('pointerup', p.pid, p.x, p.y);
    return out;
  }, [ids, holdMs]);
}

await step('hold RIGHT + PUNCH', async () => {
  const r = await combo(page, ['right', 'light']);
  if (r.held.length !== 2) throw new Error('buttons held: ' + r.held.join(','));
  if (r.axis.x <= 0) throw new Error('axis lost: ' + JSON.stringify(r.axis));
  if (!r.acting) throw new Error('punch did not come out');
  console.log(`       axis.x ${r.axis.x}, moved ${Math.round(r.moved)}px, attacking`);
});

await step('hold LEFT + GUARD', async () => {
  const r = await combo(page, ['left', 'guard']);
  if (r.held.length !== 2) throw new Error('buttons held: ' + r.held.join(','));
  if (r.axis.x >= 0) throw new Error('axis lost: ' + JSON.stringify(r.axis));
  if (!r.guard) throw new Error('guard is not up');
});

await step('move + JUTSU', async () => {
  const r = await combo(page, ['right', 'jutsu']);
  if (r.held.length !== 2) throw new Error('buttons held: ' + r.held.join(','));
  if (r.axis.x <= 0) throw new Error('axis lost while casting');
});

await step('move + CHAKRA', async () => {
  const r = await combo(page, ['left', 'chakra']);
  if (r.held.length !== 2) throw new Error('buttons held: ' + r.held.join(','));
  if (r.axis.x >= 0) throw new Error('axis lost while charging');
  if (!r.charging) throw new Error('the fighter is not charging chakra');
});

await step('move + KICK', async () => {
  const r = await combo(page, ['right', 'heavy']);
  if (r.held.length !== 2) throw new Error('buttons held: ' + r.held.join(','));
  if (r.axis.x <= 0) throw new Error('axis lost');
  if (!r.acting) throw new Error('kick did not come out');
});

await step('three fingers at once: LEFT + GUARD + KICK', async () => {
  const r = await combo(page, ['left', 'guard', 'heavy']);
  if (r.held.length !== 3) throw new Error('buttons held: ' + r.held.join(','));
});

console.log('\n== gating ==');

await step('a disabled Awakening cannot be activated', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const f = g.engine.player;
    g.engine.enemy.x = f.x + 1400;
    f.airborne = false; f.state = 'idle';
    f.awakening = 0;                       // requirement not met
    g.updateTouchFeedback();
    const el = document.querySelector('.ctrl[data-action="awaken"]');
    const dim = el.classList.contains('is-disabled');
    const b = el.getBoundingClientRect();
    const before = f.form;
    document.getElementById('touch-controls').dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 40, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2,
      bubbles: true, cancelable: true, pointerType: 'touch',
    }));
    await new Promise((r) => setTimeout(r, 260));
    return { dim, before, after: f.form, down: el.classList.contains('is-down') };
  });
  if (!r.dim) throw new Error('awakening is not dimmed with the requirement unmet');
  if (r.down) throw new Error('a disabled awakening still registered the press');
  if (r.after !== r.before) throw new Error(`awakening fired anyway: ${r.before} -> ${r.after}`);
});

await step('a disabled Ultimate cannot be activated', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const f = g.engine.player;
    g.engine.enemy.x = f.x + 1400;
    f.airborne = false; f.state = 'idle';
    f.chakra = 0;                          // not enough for the ultimate
    g.updateTouchFeedback();
    const el = document.querySelector('.ctrl[data-action="ultimate"]');
    const dim = el.classList.contains('is-disabled');
    const b = el.getBoundingClientRect();
    const act0 = f.act?.id ?? null;
    document.getElementById('touch-controls').dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 41, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2,
      bubbles: true, cancelable: true, pointerType: 'touch',
    }));
    await new Promise((r) => setTimeout(r, 260));
    return { dim, act0, act1: f.act?.id ?? null, down: el.classList.contains('is-down') };
  });
  if (!r.dim) throw new Error('ultimate is not dimmed without chakra');
  if (r.down) throw new Error('a disabled ultimate still registered the press');
  if (r.act1 !== r.act0) throw new Error(`ultimate fired anyway: ${r.act1}`);
});

await step('a ready Ultimate does fire', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const f = g.engine.player;
    // The ultimate is grounded-only, so keep the AI from launching us mid-test.
    g.engine.enemy.x = f.x + 1400;
    f.airborne = false; f.y = 0; f.vy = 0;
    f.chakra = 100; f.cooldowns.clear(); f.act = null; f.state = 'idle';
    g.updateTouchFeedback();
    const el = document.querySelector('.ctrl[data-action="ultimate"]');
    const ready = el.classList.contains('is-ready') && !el.classList.contains('is-disabled');
    const b = el.getBoundingClientRect();
    const t = document.getElementById('touch-controls');
    const opts = { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true, cancelable: true, pointerType: 'touch' };
    t.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 42, ...opts }));
    let fired = null;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 25));
      if (f.act) { fired = f.act.ability?.id ?? 'ultimate'; break; }
    }
    t.dispatchEvent(new PointerEvent('pointerup', { pointerId: 42, ...opts }));
    return { ready, act: fired, state: f.state };
  });
  if (!r.ready) throw new Error('a usable ultimate is not marked ready');
  if (!r.act) throw new Error('the ultimate did not fire when it was available');
  console.log(`       fired ${r.act}`);
});

console.log('\n== safe areas and sizing ==');

for (const [w, h] of [[844, 390], [852, 393], [932, 430]]) {
  const c2 = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p2 = await c2.newPage();
  p2.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await match(p2, 'naruto');
  await step(`${w}x${h}: every control is inside the safe area and sized for a thumb`, async () => {
    const r = await p2.evaluate(([safe]) => {
      const out = { unsafe: [], tooSmall: [], tooBig: [], n: 0 };
      for (const el of document.querySelectorAll('#touch-controls .ctrl')) {
        if (el.hidden) continue;
        out.n++;
        const b = el.getBoundingClientRect();
        if (b.left < safe.l - 0.5 || b.right > innerWidth - safe.r + 0.5
          || b.top < safe.t - 0.5 || b.bottom > innerHeight - safe.b + 0.5) out.unsafe.push(el.dataset.ctrl);
        if (b.width < 44) out.tooSmall.push(`${el.dataset.ctrl}:${Math.round(b.width)}`);
        if (b.width > innerHeight * 0.20) out.tooBig.push(`${el.dataset.ctrl}:${Math.round(b.width)}`);
      }
      // The HUD text must clear the insets too.
      const plate = document.querySelector('.hud__side--p1 .fbar').getBoundingClientRect();
      out.plateLeft = plate.left;
      const p2bar = document.querySelector('.hud__side--p2 .fbar').getBoundingClientRect();
      const aw = document.querySelector('.ctrl[data-ctrl="awaken"]').getBoundingClientRect();
      out.barUnderSpecials = p2bar.right > aw.left + 1;
      return out;
    }, [SAFE]);
    if (r.n !== 11) throw new Error(`${r.n} controls`);
    if (r.unsafe.length) throw new Error('outside the safe area: ' + r.unsafe.join(','));
    if (r.tooSmall.length) throw new Error('below a 44px touch target: ' + r.tooSmall.join(','));
    if (r.tooBig.length) throw new Error('oversized for the viewport: ' + r.tooBig.join(','));
    if (r.plateLeft < SAFE.l - 0.5) throw new Error('the fighter plate reaches into the notch');
    if (r.barUnderSpecials) throw new Error('the opponent bar runs under the Awakening button');
  });
  await p2.screenshot({ path: `${OUT}/hud-${w}.png` });
  await c2.close();
}

console.log('\n== gestures ==');

await step('the control layer blocks browser gestures', async () => {
  const r = await page.evaluate(() => {
    const t = document.getElementById('touch-controls');
    const cs = getComputedStyle(t);
    const btn = getComputedStyle(document.querySelector('.ctrl'));
    return {
      touchAction: cs.touchAction,
      btnTouchAction: btn.touchAction,
      select: cs.webkitUserSelect || cs.userSelect,
      callout: cs.webkitTouchCallout,
      // A pointerdown inside the layer must be cancelled (no scroll / zoom).
      prevented: (() => {
        const b = document.querySelector('.ctrl[data-action="right"]').getBoundingClientRect();
        const ev = new PointerEvent('pointerdown', {
          pointerId: 77, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2,
          bubbles: true, cancelable: true, pointerType: 'touch',
        });
        t.dispatchEvent(ev);
        const p = ev.defaultPrevented;
        t.dispatchEvent(new PointerEvent('pointerup', { pointerId: 77, clientX: b.left, clientY: b.top, bubbles: true, cancelable: true, pointerType: 'touch' }));
        return p;
      })(),
    };
  });
  if (r.touchAction !== 'none') throw new Error('layer touch-action is ' + r.touchAction);
  if (r.btnTouchAction !== 'none') throw new Error('button touch-action is ' + r.btnTouchAction);
  if (r.select !== 'none') throw new Error('text selection is not disabled: ' + r.select);
  if (!r.prevented) throw new Error('pointerdown was not preventDefault()ed — the page can still scroll/zoom');
});

await step('navigation outside combat is still scrollable', async () => {
  const r = await page.evaluate(() => {
    const menu = document.getElementById('screen-menu');
    return getComputedStyle(menu).touchAction;
  });
  if (r === 'none') throw new Error('the menu screen also blocks gestures');
});

console.log(errors.length ? '  ✗ console: ' + errors.slice(0, 6).join(' | ') : '  ✓ no console errors');
if (errors.length) process.exitCode = 1;
await b.close();
