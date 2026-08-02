/**
 * Save system: defaults, migrations, corruption recovery, export/import.
 *
 * The key rule under test: a save is never discarded because the schema
 * changed, and unknown data is preserved rather than dropped.
 */

import { suite, test, assert, assertEqual, assertEmpty } from './helpers.js';
import { installBrowserStubs } from './helpers.js';

installBrowserStubs();

const { defaultSave, migrate, saveManager } = await import('../js/save-manager.js');
const { SAVE_VERSION } = await import('../js/constants.js');
const { levelForXp, xpForLevel, masteryForXp } = await import('../js/data/unlocks.js');

export function run() {
  suite('save-validation');

  test('default save has every top-level key the game reads', () => {
    const s = defaultSave();
    const keys = [
      'version', 'level', 'xp', 'coins', 'unlockedFighters', 'unlockedStages',
      'transformationsUnlocked', 'favorites', 'recent', 'mastery', 'achievements',
      'story', 'arcade', 'survival', 'tower', 'bossRush', 'training', 'stats',
    ];
    const missing = keys.filter((k) => s[k] === undefined);
    assertEmpty(missing, 'Missing default save keys');
  });

  test('a version-1 save migrates without losing data', () => {
    const old = {
      version: 1,
      xp: 4200,
      coins: 999,
      unlockedFighters: ['naruto', 'itachi'],
      favorites: ['itachi'],
      stats: { wins: 17 },
      customFieldFromAnOlderBuild: 'keep me',
    };
    const migrated = migrate(JSON.parse(JSON.stringify(old)));
    assertEqual(migrated.version, SAVE_VERSION, 'Version not bumped');
    assertEqual(migrated.xp, 4200, 'XP lost');
    assertEqual(migrated.coins, 999, 'Coins lost');
    assert(migrated.unlockedFighters.includes('itachi'), 'Unlocked fighter lost');
    assert(migrated.favorites.includes('itachi'), 'Favourite lost');
    assertEqual(migrated.stats.wins, 17, 'Stats lost');
    assertEqual(migrated.customFieldFromAnOlderBuild, 'keep me', 'Unknown field dropped');
  });

  test('migration adds new containers without touching old values', () => {
    const old = { version: 1, xp: 0, coins: 0, arcade: { cleared: { ladder_classic: true } } };
    const m = migrate(old);
    assert(m.arcade.cleared.ladder_classic === true, 'Existing arcade progress lost');
    assert(m.tower && typeof m.tower.highestFloor === 'number', 'Tower container missing');
    assert(m.bossRush && m.bossRush.cleared, 'Boss rush container missing');
    assert(Array.isArray(m.transformationsUnlocked), 'Transformation list missing');
  });

  test('starters are always present after migration', () => {
    const m = migrate({ version: 1, xp: 0, coins: 0, unlockedFighters: [] });
    assert(m.unlockedFighters.includes('naruto'), 'Starter missing');
    assert(m.unlockedStages.length > 0, 'Starter stages missing');
  });

  test('level curve is monotonic and matches xpForLevel', () => {
    let prev = -1;
    for (let l = 1; l <= 40; l++) {
      const need = xpForLevel(l);
      assert(need > prev, `Level ${l} requires less XP than level ${l - 1}`);
      prev = need;
      assertEqual(levelForXp(need), l, `levelForXp(${need}) should be ${l}`);
    }
  });

  test('mastery thresholds increase', () => {
    assertEqual(masteryForXp(0), 0);
    assert(masteryForXp(1000) > masteryForXp(100), 'Mastery not increasing');
    assert(masteryForXp(50000) >= 10, 'Mastery cap not reachable');
  });

  test('save → export → import round-trips', () => {
    saveManager.load();
    saveManager.update((d) => { d.coins = 4242; d.xp = 3000; });
    saveManager.save();
    const exported = saveManager.exportSave();
    saveManager.update((d) => { d.coins = 0; });
    const res = saveManager.importSave(exported);
    assert(res.ok, `Import failed: ${res.message}`);
    assertEqual(saveManager.data.coins, 4242, 'Coins not restored');
  });

  test('importing rubbish is rejected without destroying the save', () => {
    saveManager.update((d) => { d.coins = 777; });
    saveManager.save();
    const bad = saveManager.importSave('this is not json');
    assert(!bad.ok, 'Rubbish should be rejected');
    assertEqual(saveManager.data.coins, 777, 'Save damaged by a failed import');

    const wrongShape = saveManager.importSave('{"hello":"world"}');
    assert(!wrongShape.ok, 'Wrong-shape JSON should be rejected');
    assertEqual(saveManager.data.coins, 777, 'Save damaged by a failed import');
  });

  test('a corrupt stored save is preserved, not silently wiped', () => {
    localStorage.setItem('nuf.save.v1', '{{{ not json');
    const status = saveManager.load();
    assert(status === 'corrupt-preserved' || status === 'recovered',
      `Expected recovery, got "${status}"`);
    const keys = Object.keys(localStorage).length !== undefined ? null : null;
    void keys;
    let foundBackupCopy = false;
    for (let i = 0; i < localStorage.length; i++) {
      if (String(localStorage.key(i)).includes('corrupt')) foundBackupCopy = true;
    }
    assert(foundBackupCopy, 'The corrupt save was not preserved anywhere');
  });

  test('reset keeps settings when asked', () => {
    saveManager.load();
    saveManager.data.settings = { quality: 'low', masterVolume: 0.1 };
    saveManager.save();
    saveManager.resetSave({ keepSettings: true });
    assertEqual(saveManager.data.settings.quality, 'low', 'Settings lost on reset');
    assertEqual(saveManager.data.coins, 500, 'Coins not reset');
  });
}
