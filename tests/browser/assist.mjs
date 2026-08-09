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
 * Assist system, in the browser.
 *
 * Pre-match selection, persistence, the CHAKRA tap/hold split, the in-combat
 * behaviour, and the guarantee that none of it turns the assist into Player 2.
 */

const SAFE = { t: 8, r: 59, b: 21, l: 59 };
const INSETS = `:root{--sat:${SAFE.t}px!important;--sar:${SAFE.r}px!important;--sab:${SAFE.b}px!important;--sal:${SAFE.l}px!important}`;

const b = await chromium.launch(LAUNCH);
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().split('/').slice(-3).join('/')}`); });

const step = async (n, fn) => {
  try { await fn(); console.log('  ✓ ' + n); }
  catch (e) { console.log('  ✗ ' + n + ' — ' + e.message); process.exitCode = 1; }
};

async function toSelect() {
  await page.goto(`${URL_BASE}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.addStyleTag({ content: INSETS });
  await page.click('.menu__item[data-id="versus"]');
  await page.waitForSelector('#screen-select.is-active');
  await page.waitForTimeout(1000);
}

async function toCombat() {
  await page.click('#btn-select-confirm'); await page.waitForSelector('#screen-stage.is-active');
  await page.click('#btn-stage-confirm'); await page.waitForSelector('#screen-combat.is-active');
  await page.waitForTimeout(3200);
}

await toSelect();

console.log('\n== pre-match selection ==');

await step('the select screen shows three slots: fighter, assist, opponent', async () => {
  const r = await page.evaluate(() => ({
    fighter: document.querySelector('.select__panel--p1 .select__panel-label')?.textContent.trim(),
    assist: document.querySelector('#btn-assist .select__panel-label')?.textContent.trim(),
    opponent: document.querySelector('.select__panel--p2 .select__panel-label')?.textContent.trim(),
    assistVisible: !document.getElementById('btn-assist').hidden,
  }));
  if (r.fighter !== 'Your Fighter') throw new Error('fighter slot: ' + r.fighter);
  if (r.assist !== 'Assist') throw new Error('assist slot: ' + r.assist);
  if (r.opponent !== 'AI Opponent') throw new Error('opponent slot: ' + r.opponent);
  if (!r.assistVisible) throw new Error('the assist slot is not shown');
  console.log(`       ${r.fighter} / ${r.assist} / ${r.opponent}`);
});

await step('the assist picker offers the whole roster minus your own fighter', async () => {
  await page.evaluate(() => globalThis.__NUF_GAME.select.setP1('naruto'));
  await page.click('#btn-assist');
  await page.waitForSelector('#assist-sheet:not([hidden])');
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.assist')];
    return {
      n: rows.length,
      ids: rows.map((x) => x.dataset.assist),
      title: document.getElementById('assist-title').textContent,
      withMove: rows.filter((x) => x.querySelector('.assist__move')?.textContent.trim()).length,
      withCd: rows.filter((x) => /\d+s/.test(x.querySelector('.assist__cd')?.textContent || '')).length,
    };
  });
  if (r.n !== 109) throw new Error(`expected 109 eligible assists, got ${r.n}`);
  if (r.ids.includes('naruto')) throw new Error('your own fighter is offered as an assist');
  if (r.withMove !== r.n) throw new Error(`${r.n - r.withMove} rows have no assist move named`);
  if (r.withCd !== r.n) throw new Error(`${r.n - r.withCd} rows have no cooldown shown`);
  console.log(`       ${r.n} eligible, all with a named move and cooldown`);
});

await step('every one of the 110 fighters is reachable as an assist', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const { FIGHTER_ORDER } = await import('./js/data/fighters.js');
    const missed = [];
    for (const id of FIGHTER_ORDER) {
      // Pick a main who is not this fighter, then check the roster offers them.
      g.select.setP1(id === 'naruto' ? 'sasuke' : 'naruto');
      g.select.renderAssists();
      if (!document.querySelector(`.assist[data-assist="${id}"]`)) missed.push(id);
    }
    g.select.setP1('naruto');
    g.select.renderAssists();
    return { total: FIGHTER_ORDER.length, missed };
  });
  if (r.missed.length) throw new Error(`${r.missed.length} not selectable: ${r.missed.slice(0, 6).join(',')}`);
  console.log(`       all ${r.total} fighters selectable as an assist`);
});

await step('choosing an assist fills the slot with their portrait and move', async () => {
  await page.click('.assist[data-assist="sasuke"]');
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    id: globalThis.__NUF_GAME.select.assistId,
    name: document.getElementById('assist-name').textContent,
    move: document.getElementById('assist-move').textContent,
    src: document.getElementById('assist-portrait').getAttribute('src'),
    sheetOpen: !document.getElementById('assist-sheet').hidden,
  }));
  if (r.id !== 'sasuke') throw new Error('assist is ' + r.id);
  if (!/Sasuke/.test(r.name)) throw new Error('name is ' + r.name);
  if (!/Chidori/.test(r.move)) throw new Error('move is ' + r.move);
  if (!/fighters\/sasuke\//.test(r.src || '')) throw new Error('portrait is ' + r.src);
  if (r.sheetOpen) throw new Error('the picker stayed open');
  console.log(`       ${r.name} — ${r.move}`);
});

await step('picking your assist as your main clears the illegal pairing', async () => {
  const r = await page.evaluate(() => {
    const g = globalThis.__NUF_GAME;
    g.select.setAssist('kakashi');
    const before = g.select.assistId;
    g.select.setP1('kakashi');            // now the same person on both slots
    return { before, after: g.select.assistId };
  });
  if (r.before !== 'kakashi') throw new Error('setup failed: ' + r.before);
  if (r.after !== null) throw new Error(`assist stayed ${r.after} after becoming the main fighter`);
});

await step('the assist choice survives a reload', async () => {
  await page.evaluate(() => {
    const g = globalThis.__NUF_GAME;
    g.select.setP1('naruto');
    g.select.setAssist('gaara');
  });
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.addStyleTag({ content: INSETS });
  await page.click('.menu__item[data-id="versus"]');
  await page.waitForSelector('#screen-select.is-active');
  await page.waitForTimeout(1000);
  const r = await page.evaluate(async () => {
    const sm = (await import('./js/save-manager.js')).default;
    return {
      saved: sm.data.loadout?.selectedAssistId,
      screen: globalThis.__NUF_GAME.select.assistId,
      shown: document.getElementById('assist-name').textContent,
    };
  });
  if (r.saved !== 'gaara') throw new Error('save has ' + r.saved);
  if (r.screen !== 'gaara') throw new Error('screen has ' + r.screen);
  if (!/Gaara/.test(r.shown)) throw new Error('slot shows ' + r.shown);
  console.log(`       persisted: ${r.shown}`);
});

console.log('\n== combat HUD ==');

await page.evaluate(() => {
  const g = globalThis.__NUF_GAME;
  g.select.setP1('naruto');
  g.select.setAssist('sasuke');
  g.select.setP2('madara');
});
await page.waitForTimeout(300);
await toCombat();

await step('the assist portrait appears on the combat HUD, near CHAKRA', async () => {
  const r = await page.evaluate(() => {
    const el = document.getElementById('ctrl-assist');
    const ch = document.querySelector('.ctrl[data-ctrl="chakra"]');
    const a = el.getBoundingClientRect();
    const c = ch.getBoundingClientRect();
    return {
      hidden: el.hidden,
      src: el.querySelector('img')?.getAttribute('src'),
      dist: Math.hypot((a.left + a.width / 2) - (c.left + c.width / 2), (a.top + a.height / 2) - (c.top + c.height / 2)),
      size: a.width,
      pointer: getComputedStyle(el).pointerEvents,
    };
  });
  if (r.hidden) throw new Error('the assist chip is hidden');
  if (!/fighters\/sasuke\//.test(r.src || '')) throw new Error('chip shows ' + r.src);
  if (r.dist > 90) throw new Error(`chip is ${Math.round(r.dist)}px from CHAKRA`);
  if (r.pointer !== 'none') throw new Error('the chip takes pointer events — it must be a readout');
  console.log(`       ${Math.round(r.size)}px chip, ${Math.round(r.dist)}px from CHAKRA, not tappable`);
});

await step('no extra large button was added to the layout', async () => {
  const r = await page.evaluate(() => {
    const ctrls = [...document.querySelectorAll('#touch-controls .ctrl')].filter((c) => !c.hidden);
    return { n: ctrls.length, ids: ctrls.map((c) => c.dataset.ctrl) };
  });
  if (r.n !== 11) throw new Error(`${r.n} buttons: ${r.ids.join(',')}`);
  if (r.ids.includes('assist')) throw new Error('an Assist button was added');
  console.log(`       still ${r.n} buttons: ${r.ids.join(', ')}`);
});

console.log('\n== chakra: tap vs hold ==');

/** Press CHAKRA for `ms`, then report what the game did. */
async function chakraPress(ms) {
  return page.evaluate(async (hold) => {
    const g = globalThis.__NUF_GAME;
    const f = g.engine.player;
    g.engine.enemy.x = f.x + 1400;
    f.airborne = false; f.state = 'idle'; f.act = null; f.chakra = 60;
    g.engine.assists.reset();
    g.updateTouchFeedback();
    const t = document.getElementById('touch-controls');
    const b = document.querySelector('.ctrl[data-ctrl="chakra"]').getBoundingClientRect();
    const o = { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, bubbles: true, cancelable: true, pointerType: 'touch' };
    let charged = false;
    t.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 60, ...o }));
    const started = performance.now();
    while (performance.now() - started < hold) {
      await new Promise((r) => setTimeout(r, 12));
      if (f.charging) charged = true;
    }
    t.dispatchEvent(new PointerEvent('pointerup', { pointerId: 60, ...o }));
    // Let the next frames settle so an assist call has time to register.
    let called = false;
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 20));
      if (g.engine.assists.slotFor(f)?.active) called = true;
      if (f.charging) charged = true;
    }
    return { called, charged, stillCharging: f.charging };
  }, ms);
}

await step('a quick tap of CHAKRA calls the assist and never starts charging', async () => {
  const r = await chakraPress(90);
  if (!r.called) throw new Error('the assist was not called by a quick tap');
  if (r.charged) throw new Error('a quick tap visibly started chakra charging');
});

await step('holding CHAKRA charges chakra and never calls the assist', async () => {
  const r = await chakraPress(600);
  if (!r.charged) throw new Error('holding did not charge chakra');
  if (r.called) throw new Error('the assist fired after a long hold');
  if (r.stillCharging) throw new Error('charging did not stop on release');
});

await step('a hold right at the threshold resolves one way, never both', async () => {
  for (const ms of [150, 205, 260]) {
    const r = await chakraPress(ms);
    if (r.called && r.charged) throw new Error(`${ms}ms did both`);
    if (!r.called && !r.charged) throw new Error(`${ms}ms did neither`);
  }
});

console.log('\n== assist in battle ==');

await step('the assist enters, attacks, exits, and starts its cooldown', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const e = g.engine;
    const f = e.player;
    e.assists.reset();
    f.chakra = 100; f.airborne = false; f.state = 'idle';
    e.enemy.x = f.x + 220;
    const before = { fighters: e.fighters.length, pve: e.assertPvE() };
    const ok = !!e.assists.call(f, e.enemy);
    const slot = e.assists.slotFor(f);
    const phases = new Set();
    let maxAlpha = 0;
    for (let i = 0; i < 240 && slot.active; i++) {
      await new Promise((r) => setTimeout(r, 8));
      phases.add(slot.phase);
      maxAlpha = Math.max(maxAlpha, slot.alpha);
    }
    return {
      ok,
      phases: [...phases],
      maxAlpha,
      active: slot.active,
      cooldown: slot.cooldown,
      before,
      after: { fighters: e.fighters.length, pve: e.assertPvE() },
      partnerId: slot.partner?.data.id,
    };
  });
  if (!r.ok) throw new Error('the call was refused');
  for (const p of ['entry', 'act', 'exit']) {
    if (!r.phases.includes(p)) throw new Error(`the ${p} phase never ran (saw ${r.phases.join(',')})`);
  }
  if (r.active) throw new Error('the assist is still on the field');
  if (r.cooldown <= 0) throw new Error('the cooldown did not start');
  if (r.partnerId !== 'sasuke') throw new Error('the wrong fighter assisted: ' + r.partnerId);
  console.log(`       ${r.partnerId}: ${r.phases.join(' → ')}, cooldown ${Math.round(r.cooldown)}s`);
});

await step('the assist never joins the match as a third fighter', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine;
    return {
      fighters: e.fighters.length,
      pve: e.assertPvE(),
      controllers: e.controllers.size,
      partnerInList: [...e.assists.slots.values()].some((s) => e.fighters.includes(s.partner)),
    };
  });
  if (r.fighters !== 2) throw new Error(`${r.fighters} fighters in the match`);
  if (r.pve.human !== 1 || r.pve.ai !== 1) throw new Error('not PvE: ' + JSON.stringify(r.pve));
  if (r.controllers !== 1) throw new Error(`${r.controllers} AI controllers`);
  if (r.partnerInList) throw new Error('the assist was added to the fighter list');
  console.log(`       ${r.fighters} fighters, ${r.pve.human} human, ${r.pve.ai} AI`);
});

await step('the assist cannot be called again during its cooldown', async () => {
  const r = await page.evaluate(() => {
    const e = globalThis.__NUF_GAME.engine;
    const f = e.player;
    f.chakra = 100;
    const cd = e.assists.cooldownSeconds(f);
    const second = e.assists.call(f, e.enemy);
    return { cd, refused: second === null, reason: e.assists.reason(f) };
  });
  if (r.cd <= 0) throw new Error('no cooldown was running');
  if (!r.refused) throw new Error('a second call during cooldown was allowed');
  console.log(`       refused: "${r.reason}"`);
});

await step('the cooldown ring is shown on the HUD chip', async () => {
  const r = await page.evaluate(() => {
    const el = document.getElementById('ctrl-assist');
    return {
      cd: el.style.getPropertyValue('--cd'),
      dim: el.classList.contains('is-dim'),
      secs: document.getElementById('ctrl-assist-secs').textContent,
    };
  });
  if (!/turn/.test(r.cd) || parseFloat(r.cd) <= 0) throw new Error('no cooldown sweep: ' + r.cd);
  if (!r.dim) throw new Error('the chip is not dimmed while cooling down');
  if (!/^\d+$/.test(r.secs)) throw new Error('no seconds shown: ' + r.secs);
  console.log(`       sweep ${r.cd}, ${r.secs}s left, dimmed`);
});

await step('the player keeps control of their own fighter while the assist attacks', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const e = g.engine;
    const f = e.player;
    e.assists.reset();
    f.chakra = 100; f.airborne = false; f.state = 'idle'; f.act = null;
    e.enemy.x = f.x + 1400;
    g.updateTouchFeedback();
    e.assists.call(f, e.enemy);

    // Move and attack while the assist is on screen.
    const el = document.getElementById('touch-controls');
    const send = (type, id, sel) => {
      const b = el.querySelector(sel).getBoundingClientRect();
      el.dispatchEvent(new PointerEvent(type, {
        pointerId: id, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2,
        bubbles: true, cancelable: true, pointerType: 'touch',
      }));
    };
    const x0 = f.x;
    send('pointerdown', 71, '.ctrl[data-action="right"]');
    send('pointerdown', 72, '.ctrl[data-action="light"]');
    let attacked = false;
    let assistWasOut = false;
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 20));
      if (f.act || f.state === 'attack') attacked = true;
      if (e.assists.slotFor(f)?.active) assistWasOut = true;
    }
    send('pointerup', 72, '.ctrl[data-action="light"]');
    send('pointerup', 71, '.ctrl[data-action="right"]');
    return { moved: Math.abs(f.x - x0) > 4, attacked, assistWasOut, controlled: f.isPlayer };
  });
  if (!r.assistWasOut) throw new Error('the assist was not on screen during the test');
  if (!r.moved) throw new Error('the player could not move while the assist was out');
  if (!r.attacked) throw new Error('the player could not attack while the assist was out');
  if (!r.controlled) throw new Error('the player fighter stopped being player-controlled');
  console.log('       moved and attacked while the assist was on screen');
});

await step('the AI opponent is still AI-controlled and fights back', async () => {
  const r = await page.evaluate(async () => {
    const e = globalThis.__NUF_GAME.engine;
    e.enemy.x = e.player.x + 260;
    const x0 = e.enemy.x;
    const controlled = e.controllers.has(e.enemy.id);
    let acted = false;
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 16));
      if (e.enemy.act || e.enemy.state === 'attack') acted = true;
    }
    return { controlled, moved: Math.abs(e.enemy.x - x0) > 2, acted, isPlayer: e.enemy.isPlayer };
  });
  if (!r.controlled) throw new Error('the opponent lost its AI controller');
  if (r.isPlayer) throw new Error('the opponent became player-controlled');
  if (!r.moved && !r.acted) throw new Error('the AI did nothing');
  console.log(`       AI moved=${r.moved} acted=${r.acted}`);
});

await step('multi-touch: move while calling the assist', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const e = g.engine;
    const f = e.player;
    // The AI has been hitting us in the previous test: park it well away.
    e.enemy.x = f.x + 1400;
    e.assists.reset();
    f.chakra = 100;
    // Get to a state where the input can actually do something: the AI has
    // been attacking through the previous tests and may have taken the round,
    // and a dead fighter in round-end is correctly refused an assist. Heal
    // both sides, wait for the FIGHT phase, and poll until CHAKRA is pressable
    // — all races, not delays.
    const ready = async () => {
      const el = document.querySelector('.ctrl[data-ctrl="chakra"]');
      for (let i = 0; i < 300; i++) {
        f.health = f.maxHealth; f.displayHealth = f.maxHealth; f.isDead = false;
        e.enemy.health = e.enemy.maxHealth;
        f.airborne = false; f.act = null; f.setState('idle');
        g.updateTouchFeedback();
        if (e.phase === 'fight' && !el.classList.contains('is-disabled')) return true;
        await new Promise((r) => setTimeout(r, 16));
      }
      return false;
    };
    if (!await ready()) return { error: 'CHAKRA never became pressable' };
    const el = document.getElementById('touch-controls');
    const at = (sel) => {
      const b = el.querySelector(sel).getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    };
    const send = (type, id, p) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, pointerType: 'touch',
    }));
    const right = at('.ctrl[data-action="right"]');
    const chak = at('.ctrl[data-ctrl="chakra"]');
    const x0 = f.x;
    send('pointerdown', 81, right);          // hold RIGHT
    await new Promise((r) => setTimeout(r, 60));
    send('pointerdown', 82, chak);           // quick tap CHAKRA with the other thumb
    await new Promise((r) => setTimeout(r, 90));
    send('pointerup', 82, chak);
    let called = false;
    let axis = 0;
    for (let i = 0; i < 14; i++) {
      await new Promise((r) => setTimeout(r, 20));
      if (e.assists.slotFor(f)?.active) called = true;
      axis = Math.max(axis, g.touch.state.axis.x);
    }
    const stillHeld = el.querySelector('.ctrl[data-action="right"]').classList.contains('is-down');
    send('pointerup', 81, right);
    return {
      called, axis, stillHeld, moved: Math.abs(f.x - x0) > 4,
      phase: e.phase, reason: e.assists.reason(f),
    };
  });
  if (r.error) throw new Error('setup: ' + r.error);
  if (!r.called) throw new Error(`the assist was not called while moving (${JSON.stringify(r)})`);
  if (r.axis <= 0) throw new Error('the movement axis was lost');
  if (!r.stillHeld) throw new Error('the movement finger was dropped');
  if (!r.moved) throw new Error('the fighter did not move');
  console.log('       held RIGHT and called the assist together');
});

await step('multi-touch: move while charging chakra', async () => {
  const r = await page.evaluate(async () => {
    const g = globalThis.__NUF_GAME;
    const e = g.engine;
    const f = e.player;
    e.enemy.x = f.x + 1400;
    f.chakra = 30;
    // Get to a state where the input can actually do something: the AI has
    // been attacking through the previous tests and may have taken the round,
    // and a dead fighter in round-end is correctly refused an assist. Heal
    // both sides, wait for the FIGHT phase, and poll until CHAKRA is pressable
    // — all races, not delays.
    const ready = async () => {
      const el = document.querySelector('.ctrl[data-ctrl="chakra"]');
      for (let i = 0; i < 300; i++) {
        f.health = f.maxHealth; f.displayHealth = f.maxHealth; f.isDead = false;
        e.enemy.health = e.enemy.maxHealth;
        f.airborne = false; f.act = null; f.setState('idle');
        g.updateTouchFeedback();
        if (e.phase === 'fight' && !el.classList.contains('is-disabled')) return true;
        await new Promise((r) => setTimeout(r, 16));
      }
      return false;
    };
    if (!await ready()) return { error: 'CHAKRA never became pressable' };
    const el = document.getElementById('touch-controls');
    const at = (sel) => {
      const b = el.querySelector(sel).getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    };
    const send = (type, id, p) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, pointerType: 'touch',
    }));
    const left = at('.ctrl[data-action="left"]');
    const chak = at('.ctrl[data-ctrl="chakra"]');
    send('pointerdown', 91, left);
    send('pointerdown', 92, chak);
    let charged = false;
    let axis = 0;
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 25));
      if (f.charging) charged = true;
      axis = Math.min(axis, g.touch.state.axis.x);
    }
    send('pointerup', 92, chak);
    send('pointerup', 91, left);
    return { charged, axis };
  });
  if (r.error) throw new Error('setup: ' + r.error);
  if (!r.charged) throw new Error('chakra did not charge while moving');
  if (r.axis >= 0) throw new Error('the movement axis was lost while charging');
  console.log('       held LEFT and charged chakra together');
});

await page.evaluate(() => {
  const g = globalThis.__NUF_GAME;
  const e = g.engine;
  e.assists.reset();
  e.player.chakra = 100;
  e.player.x = 760; e.enemy.x = 1120;
  e.camera.focus = null; e.camera.focusTime = 0;
  e.assists.call(e.player, e.enemy);
});
await page.waitForTimeout(260);
await page.screenshot({ path: `${OUT}/assist-combat.png` });

console.log('\n== offline ==');

await step('the app still boots offline with the assist system in place', async () => {
  await page.goto(`${URL_BASE}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 20000 });
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  const ok = await page.evaluate(() => !!globalThis.__NUF_GAME);
  await ctx.setOffline(false);
  if (!ok) throw new Error('the game did not boot offline');
});

console.log(errors.length ? '  ✗ console: ' + errors.slice(0, 6).join(' | ') : '  ✓ no console errors');
if (errors.length) process.exitCode = 1;
await b.close();
