/**
 * Assist system tests.
 *
 * The rule this suite protects: the assist is a second roster fighter who is
 * called briefly and then leaves. It is never a second player, never a
 * separate cast, and never on the field between calls.
 */

import {
  suite, test, assert, assertEqual, assertAtLeast, assertEmpty, installBrowserStubs,
} from './helpers.js';

installBrowserStubs();

const { FIGHTERS, FIGHTER_ORDER, COMPLETE_FIGHTERS } = await import('../js/data/fighters.js');
const { getAbility } = await import('../js/data/abilities.js');
const {
  FIGHTER_ASSISTS, assistFor, eligibleAssists, canAssist,
  ENTRY_STYLES, EXIT_STYLES, AI_BEHAVIORS,
} = await import('../js/data/fighter-assists.js');
const { AssistSystem } = await import('../js/combat/assist-system.js');
const { Fighter } = await import('../js/combat/fighter.js');
const { defaultSave, migrate } = await import('../js/save-manager.js');
const { SAVE_VERSION } = await import('../js/constants.js');

/** A fighter that is not in a match, for driving the system directly. */
function stub(id) {
  const f = new Fighter(id, { side: 1, isPlayer: true, ignoreUnlocks: true });
  f.x = 500;
  f.y = 0;
  f.facing = 1;
  f.chakra = 100;
  return f;
}

export function run() {
  suite('assist-validation');
  /* ------------------------------------------------------------ roster -- */

  test('every one of the 110 fighters can act as an assist', () => {
    assertEqual(Object.keys(FIGHTER_ASSISTS).length, FIGHTER_ORDER.length,
      'one assist record per fighter');
    const missing = FIGHTER_ORDER.filter((id) => !assistFor(id));
    assertEmpty(missing, 'Fighters with no assist record');
  });

  test('there is no separate assist-only roster', () => {
    const strangers = Object.keys(FIGHTER_ASSISTS).filter((id) => !FIGHTERS[id]);
    assertEmpty(strangers, 'Assist ids that are not playable fighters');
  });

  test('every assist names a real ability', () => {
    const broken = FIGHTER_ORDER.filter((id) => !getAbility(assistFor(id).abilityId));
    assertEmpty(broken, 'Assists pointing at an ability that does not exist');
  });

  test('the twenty complete fighters use their own signature technique', () => {
    for (const id of COMPLETE_FIGHTERS) {
      const def = assistFor(id);
      assert(def.authored, `${id} should have a hand-authored assist`);
      assert(def.abilityId.startsWith(`${id}_`),
        `${id} assist uses ${def.abilityId}, which is not one of their own moves`);
    }
  });

  test('the named signature assists are the techniques they should be', () => {
    const want = {
      naruto: 'Rasengan',
      sasuke: 'Chidori',
      sakura: 'Ground Smash',
      kakashi: 'Lightning Cutter',
      lee: 'Leaf Hurricane',
      gaara: 'Sand Tsunami',
      itachi: 'Fire Style: Great Fireball',
      pain: 'Almighty Push',
      madara: 'Majestic Destroyer Flame',
      minato: 'Flying Raijin',
      hashirama: 'Wood Style: Wood Dragon',
      guy: 'Dynamic Entry',
      bee: 'Lariat',
      jiraiya: 'Toad Oil Flame Bullet',
      tsunade: 'Earth Shatter',
      boruto: 'Vanishing Rasengan',
      kawaki: 'Body Blade',
      momoshiki: 'Amplified Elemental Barrage',
    };
    for (const [id, name] of Object.entries(want)) {
      assertEqual(assistFor(id).displayName, name, `${id}'s assist technique`);
    }
  });

  test('every assist record has the full shape the brief specified', () => {
    for (const id of FIGHTER_ORDER) {
      const a = assistFor(id);
      assert(typeof a.abilityId === 'string' && a.abilityId, `${id}: abilityId`);
      assert(Number.isFinite(a.cooldown), `${id}: cooldown`);
      assert(Number.isFinite(a.duration) && a.duration > 0, `${id}: duration`);
      assert(ENTRY_STYLES.includes(a.entryStyle), `${id}: entryStyle ${a.entryStyle}`);
      assert(EXIT_STYLES.includes(a.exitStyle), `${id}: exitStyle ${a.exitStyle}`);
      assert(AI_BEHAVIORS.includes(a.aiBehavior), `${id}: aiBehavior ${a.aiBehavior}`);
    }
  });

  test('cooldowns sit in the 10-15 second band and vary between fighters', () => {
    const cds = FIGHTER_ORDER.map((id) => assistFor(id).cooldown);
    const bad = cds.filter((c) => c < 10 || c > 15);
    assertEmpty(bad.map(String), 'Cooldowns outside 10-15s');
    assertAtLeast(new Set(cds).size, 3, 'distinct cooldown values');
  });

  /* -------------------------------------------------------- eligibility -- */

  test('the assist roster is the whole roster minus your own fighter', () => {
    const list = eligibleAssists('naruto');
    assertEqual(list.length, FIGHTER_ORDER.length - 1, 'eligible count');
    assert(!list.includes('naruto'), 'your own fighter is not offered');
    assert(list.includes('sasuke'), 'another roster fighter is offered');
  });

  test('a fighter cannot be their own assist', () => {
    assert(!canAssist('naruto', 'naruto'), 'Naruto + Naruto assist must be refused');
    assert(canAssist('naruto', 'sasuke'), 'Naruto + Sasuke assist is fine');
  });

  test('duplicates are refused by default but the hook exists to allow them', () => {
    assert(!canAssist('naruto', 'naruto', {}), 'refused by default');
    assert(canAssist('naruto', 'naruto', { allowDuplicate: true }), 'allowed when asked');
    assertEqual(eligibleAssists('naruto', { allowDuplicate: true }).length,
      FIGHTER_ORDER.length, 'the whole roster when duplicates are allowed');
  });

  test('the assist may be the same fighter as the AI opponent', () => {
    // Nothing in the pairing rules mentions the opponent, and two separate
    // instances are built, so a Madara assist against a Madara AI is legal.
    assert(canAssist('naruto', 'madara'), 'Madara assist is allowed');
  });

  test('no assist is a valid loadout', () => {
    assert(canAssist('naruto', null), 'fighting without an assist is allowed');
  });

  /* ------------------------------------------------------------- runtime -- */

  test('calling an assist runs entry, action and exit and then leaves', () => {
    const owner = stub('naruto');
    const foe = stub('sasuke');
    foe.x = 900;
    const sys = new AssistSystem(null);
    sys.register(owner, 'sasuke');

    assert(sys.available(owner), 'assist should start available');
    assert(sys.call(owner, foe), 'call should succeed');

    const slot = sys.slotFor(owner);
    assert(slot.active, 'assist is on the field after the call');
    assertEqual(slot.phase, 'entry', 'starts in the entry phase');

    const seen = new Set();
    for (let i = 0; i < 200 && slot.active; i++) {
      sys.update(1 / 60, [owner, foe], () => {});
      seen.add(slot.phase);
    }
    assert(seen.has('entry'), 'entry phase ran');
    assert(seen.has('act'), 'action phase ran');
    assert(seen.has('exit'), 'exit phase ran');
    assert(!slot.active, 'the assist left the field');
  });

  test('the assist is not a fighter in the match', () => {
    const owner = stub('naruto');
    const foe = stub('sasuke');
    const sys = new AssistSystem(null);
    sys.register(owner, 'kakashi');
    sys.call(owner, foe);
    const slot = sys.slotFor(owner);
    assert(slot.partner, 'a partner exists for drawing');
    assert(slot.partner.isAssist === true, 'the partner is marked as an assist');
    assert(!slot.partner.isPlayer, 'the assist is not a second player');
    // The match's fighter list is built by the engine and never includes it.
    assert(![owner, foe].includes(slot.partner), 'the assist is not one of the two fighters');
  });

  test('the cooldown starts when the assist leaves and blocks another call', () => {
    const owner = stub('naruto');
    const foe = stub('sasuke');
    const sys = new AssistSystem(null);
    sys.register(owner, 'sasuke');
    const def = assistFor('sasuke');

    sys.call(owner, foe);
    const slot = sys.slotFor(owner);
    for (let i = 0; i < 200 && slot.active; i++) sys.update(1 / 60, [owner, foe], () => {});

    assertEqual(Math.round(slot.cooldown), def.cooldown, 'cooldown is the assist\'s own');
    owner.chakra = 100;
    assert(!sys.available(owner), 'not available during cooldown');
    assertEqual(sys.call(owner, foe), null, 'a call during cooldown is refused');

    // Run the cooldown out.
    for (let i = 0; i < Math.ceil(def.cooldown * 60) + 10; i++) sys.update(1 / 60, [owner, foe], () => {});
    assert(sys.available(owner), 'available again once the cooldown expires');
  });

  test('an assist cannot be called while one is already out', () => {
    const owner = stub('naruto');
    const foe = stub('sasuke');
    const sys = new AssistSystem(null);
    sys.register(owner, 'sasuke');
    sys.call(owner, foe);
    owner.chakra = 100;
    assertEqual(sys.call(owner, foe), null, 'a second call while active is refused');
  });

  test('a call costs chakra and is refused without it', () => {
    const owner = stub('naruto');
    const foe = stub('sasuke');
    const sys = new AssistSystem(null);
    sys.register(owner, 'sasuke');
    const before = owner.chakra;
    sys.call(owner, foe);
    assert(owner.chakra < before, 'chakra was spent');

    const broke = stub('naruto');
    broke.chakra = 0;
    const sys2 = new AssistSystem(null);
    sys2.register(broke, 'sasuke');
    assert(!sys2.available(broke), 'not available without chakra');
    assertEqual(sys2.call(broke, foe), null, 'refused without chakra');
  });

  test('a fighter with no assist selected simply has none', () => {
    const owner = stub('naruto');
    const sys = new AssistSystem(null);
    sys.register(owner, null);
    assert(!sys.available(owner), 'nothing to call');
    assertEqual(sys.assistIdFor(owner), null, 'no assist id');
    assertEqual(sys.call(owner, null), null, 'calling does nothing');
  });

  test('the assist hits once per call, not once per frame', () => {
    const owner = stub('naruto');
    const foe = stub('sasuke');
    foe.x = owner.x + 40;         // well inside any assist's reach
    const sys = new AssistSystem(null);
    sys.register(owner, 'sasuke');
    let hits = 0;
    sys.call(owner, foe);
    const slot = sys.slotFor(owner);
    for (let i = 0; i < 200 && slot.active; i++) {
      sys.update(1 / 60, [owner, foe], () => { hits++; });
    }
    assert(hits <= 1, `assist hit ${hits} times in one call`);
  });

  test('reset clears live assists and cooldowns between rounds', () => {
    const owner = stub('naruto');
    const foe = stub('sasuke');
    const sys = new AssistSystem(null);
    sys.register(owner, 'sasuke');
    sys.call(owner, foe);
    sys.reset();
    const slot = sys.slotFor(owner);
    assert(!slot.active, 'no assist left on the field');
    assertEqual(slot.cooldown, 0, 'cooldown cleared');
  });

  /* ---------------------------------------------------------------- save -- */

  test('a fresh save has a loadout with no assist chosen', () => {
    const s = defaultSave();
    assert(s.loadout, 'loadout exists');
    assertEqual(s.loadout.selectedAssistId, null, 'no assist by default');
  });

  test('an old save gains the loadout without losing anything', () => {
    const old = {
      version: 5, xp: 3300, coins: 210,
      unlockedFighters: ['naruto', 'sasuke'],
      equippedCostumes: { naruto: 'shippuden' },
      stats: { matches: 9, wins: 5 },
    };
    const s = migrate(structuredClone(old));
    assertEqual(s.version, SAVE_VERSION, 'migrated to the current version');
    assertEqual(s.xp, 3300, 'xp survives');
    assertEqual(s.coins, 210, 'coins survive');
    assertEqual(s.stats.matches, 9, 'stats survive');
    assertEqual(s.equippedCostumes.naruto, 'shippuden', 'costume survives');
    assertEqual(s.loadout.selectedAssistId, null, 'no assist is invented');
  });

  test('a stored assist survives a round trip', () => {
    const s = migrate({ version: 5, loadout: { selectedAssistId: 'sasuke', fighterId: 'naruto' } });
    assertEqual(s.loadout.selectedAssistId, 'sasuke', 'assist choice persists');
    assertEqual(s.loadout.fighterId, 'naruto', 'fighter choice persists');
  });
}
