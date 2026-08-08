/**
 * Roster cleanup and Player-vs-AI tests.
 *
 * The roster went from 192 cards to 110 unique people. Everything that made
 * that shrink safe is asserted here: the exact roster, that no removed id is a
 * dead end, that a save written against the old roster still carries its
 * progress forward, and that a match is always exactly one human against
 * exactly one AI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  suite, test, assert, assertEqual, assertAtLeast, assertEmpty, installBrowserStubs,
} from './helpers.js';

installBrowserStubs();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { FIGHTERS, FIGHTER_ORDER, ROSTER_ORDER, ROSTER_SIZE } = await import('../js/data/fighters.js');
const { LEGACY_FIGHTER_IDS, resolveFighterId, isLegacyFighterId } = await import('../js/data/roster-migration.js');
const { COSTUMES, costumesFor, COSTUME_BY_LEGACY_ID } = await import('../js/data/costumes.js');
const { TRANSFORMATIONS } = await import('../js/data/transformations.js');
const { AI_PROFILES } = await import('../js/data/ai-profiles.js');
const { CombatEngine } = await import('../js/combat/combat-engine.js');
const { migrate, defaultSave } = await import('../js/save-manager.js');
const { SIM_DT } = await import('../js/constants.js');
const { levelForXp } = await import('../js/data/unlocks.js');
const { SAVE_VERSION } = await import('../js/constants.js');

/** The 110 the game is specified to have, by name. */
const EXPECTED_NAMES = [
  'Naruto Uzumaki', 'Sasuke Uchiha', 'Sakura Haruno', 'Kakashi Hatake', 'Sai',
  'Yamato', 'Shikamaru Nara', 'Choji Akimichi', 'Ino Yamanaka', 'Hinata Hyuga',
  'Kiba Inuzuka', 'Shino Aburame', 'Neji Hyuga', 'Rock Lee', 'Tenten',
  'Might Guy', 'Asuma Sarutobi', 'Kurenai Yuhi', 'Ebisu', 'Iruka Umino',
  'Konohamaru Sarutobi', 'Hanabi Hyuga', 'Hiashi Hyuga', 'Hizashi Hyuga',
  'Hashirama Senju', 'Tobirama Senju', 'Hiruzen Sarutobi', 'Minato Namikaze',
  'Tsunade', 'Jiraiya', 'Orochimaru', 'Kushina Uzumaki', 'Shisui Uchiha',
  'Fugaku Uchiha', 'Izuna Uchiha', 'Gaara', 'Temari', 'Kankuro', 'Chiyo',
  'Pakura', 'Rasa', 'Zabuza Momochi', 'Haku', 'Chojuro', 'Mei Terumi',
  'Kisame Hoshigaki', 'Yagura Karatachi', 'Suigetsu Hozuki', 'Killer Bee',
  'Fourth Raikage', 'Darui', 'Omoi', 'Samui', 'Yugito Nii', 'Onoki',
  'Kurotsuchi', 'Deidara', 'Roshi', 'Han', 'Itachi Uchiha', 'Sasori',
  'Kakuzu', 'Hidan', 'Konan', 'Pain', 'Nagato', 'Obito Uchiha', 'White Zetsu',
  'Black Zetsu', 'Madara Uchiha', 'Kabuto Yakushi', 'Kimimaro', 'Jugo',
  'Karin Uzumaki', 'Danzo Shimura', 'Hanzo', 'Jirobo', 'Kidomaru', 'Tayuya',
  'Sakon and Ukon', 'Utakata', 'Fu', 'Boruto Uzumaki', 'Sarada Uchiha',
  'Mitsuki', 'Kawaki', 'Sumire Kakei', 'Shinki', 'Mirai Sarutobi',
  'Kagura Karatachi', 'Buntan Kurosuki', 'Jigen', 'Isshiki Otsutsuki',
  'Delta', 'Code', 'Boro', 'Koji Kashin', 'Victor', 'Deepa', 'Eida',
  'Daemon', 'Momoshiki Otsutsuki', 'Kinshiki Otsutsuki', 'Urashiki Otsutsuki',
  'Kaguya Otsutsuki', 'Hagoromo Otsutsuki', 'Hamura Otsutsuki',
  'Toneri Otsutsuki', 'Shin Uchiha', 'Menma Uzumaki',
];

/** Words that must not appear as a roster card's own name. */
const BANNED_NAME_PATTERNS = [
  /^Kid /i, /^Adult /i, /^Young /i, /^Hokage /i, /^Edo /i, /^Kazekage /i,
  /^Road to Ninja/i, /Custom/i, /Academy Student/i, /Rogue Ninja/i,
  /Missing-nin/i, /ANBU Captain/i, /Jonin Elite/i, /Soldier/i,
  /Six Paths (Naruto|Sasuke|Madara)/i, /Baryon/i, /Sage Mode/i, /Susanoo/i,
  /Eight Gates/i, /Karma/i, /Ten-Tails/i, /Mangekyo/i, /Rinnegan/i,
];

const BOSS_IDS = [
  'shukaku', 'matatabi', 'isobu', 'songoku', 'kokuo', 'saiken', 'chomei',
  'gyuki', 'kurama', 'tentails', 'perfect_susanoo', 'gedo_statue', 'akamaru',
];

export function run() {
  suite('roster-cleanup');

  /* --------------------------------------------------------- the roster -- */

  test('the roster contains exactly 110 fighters', () => {
    assertEqual(FIGHTER_ORDER.length, 110, 'FIGHTER_ORDER length');
    assertEqual(ROSTER_SIZE, 110, 'ROSTER_SIZE');
    assertEqual(ROSTER_ORDER.length, 110, 'ROSTER_ORDER length');
  });

  test('every fighter id is unique', () => {
    const seen = new Set();
    const dupes = [];
    for (const id of FIGHTER_ORDER) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    assertEmpty(dupes, 'Duplicate fighter ids');
    assertEqual(Object.keys(FIGHTERS).length, 110, 'FIGHTERS map size');
  });

  test('the roster is exactly the specified 110 people', () => {
    const actual = FIGHTER_ORDER.map((id) => FIGHTERS[id].displayName);
    const missing = EXPECTED_NAMES.filter((n) => !actual.includes(n));
    const extra = actual.filter((n) => !EXPECTED_NAMES.includes(n));
    assertEmpty(missing, 'Specified fighters missing from the roster');
    assertEmpty(extra, 'Fighters on the roster that are not in the specification');
  });

  test('no two roster cards are the same person', () => {
    // Two entries whose display names collapse to the same surname+given name
    // would be a duplicate person sneaking back in.
    const byName = new Map();
    const clashes = [];
    for (const id of FIGHTER_ORDER) {
      const key = FIGHTERS[id].displayName.toLowerCase();
      if (byName.has(key)) clashes.push(`${id} and ${byName.get(key)} share a name`);
      byName.set(key, id);
    }
    assertEmpty(clashes, 'Duplicate people on the roster');
  });

  test('no roster card is an alternate age, costume, title or awakening', () => {
    const bad = [];
    for (const id of FIGHTER_ORDER) {
      const name = FIGHTERS[id].displayName;
      for (const pattern of BANNED_NAME_PATTERNS) {
        if (pattern.test(name)) bad.push(`${id} ("${name}") matches ${pattern}`);
      }
    }
    assertEmpty(bad, 'Alternate forms used as roster cards');
  });

  test('original and custom characters are gone', () => {
    const banned = [
      'custom_male', 'custom_female', 'male_custom', 'female_custom',
      'academy_male', 'academy_female', 'rogue_ninja', 'missing_nin',
      'anbu_captain', 'jonin_elite', 'kara_soldier', 'otsutsuki_soldier',
      'original_boss', 'final_boss', 'gato', 'mizuki', 'guren', 'rin', 'dai',
    ];
    const present = banned.filter((id) => FIGHTERS[id]);
    assertEmpty(present, 'Original/custom fighters still selectable');
  });

  test('boss-only characters are not selectable', () => {
    const present = BOSS_IDS.filter((id) => FIGHTERS[id]);
    assertEmpty(present, 'Boss entries still on the roster');
  });

  test('Akamaru is not a fighter but is still in Kiba\'s kit', () => {
    assert(!FIGHTERS.akamaru, 'Akamaru must not be selectable');
    const kiba = FIGHTERS.kiba;
    const mentionsAkamaru = (kiba.summons || []).some((a) => /akamaru/i.test(a))
      || /akamaru/i.test(kiba.description || '');
    assert(mentionsAkamaru, 'Akamaru should survive as one of Kiba\'s summons');
  });

  test('tailed beasts survive as transformations, not as roster cards', () => {
    const beastForms = Object.values(TRANSFORMATIONS)
      .filter((t) => /tail|kurama|shukaku|gyuki|cloak|beast/i.test(`${t.id} ${t.displayName}`));
    assertAtLeast(beastForms.length, 1,
      'Tailed-beast power should still exist as transformations');
    const asFighters = BOSS_IDS.filter((id) => FIGHTER_ORDER.includes(id));
    assertEmpty(asFighters, 'Tailed beasts must not be roster cards');
  });

  test('the Sound Four appear as four separate fighters', () => {
    for (const id of ['jirobo', 'kidomaru', 'tayuya', 'sakon']) {
      assert(FIGHTERS[id], `${id} should be on the roster`);
    }
    assert(!FIGHTERS.sound_four, 'The Sound Four must not be one group card');
    assertEqual(FIGHTERS.sakon.displayName, 'Sakon and Ukon',
      'Sakon and Ukon stay one combined fighter');
  });

  test('Pain and Nagato remain separate fighters', () => {
    assert(FIGHTERS.pain && FIGHTERS.nagato, 'Both should be on the roster');
    assert(FIGHTERS.pain.displayName !== FIGHTERS.nagato.displayName, 'Distinct names');
    assert(FIGHTERS.pain.archetype !== undefined && FIGHTERS.nagato.archetype !== undefined,
      'Both should be fully defined fighters');
  });

  /* ------------------------------------------------------- alternate forms */

  test('removed alternates resolve to a real fighter', () => {
    const problems = [];
    for (const [old, target] of Object.entries(LEGACY_FIGHTER_IDS)) {
      if (FIGHTERS[old]) problems.push(`${old} is still a roster card`);
      if (!FIGHTERS[target]) problems.push(`${old} -> ${target}, which does not exist`);
      if (resolveFighterId(old) !== target) problems.push(`resolveFighterId(${old}) is wrong`);
    }
    assertEmpty(problems, 'Broken legacy mappings');
    assertAtLeast(Object.keys(LEGACY_FIGHTER_IDS).length, 80,
      'The 192 -> 110 cleanup should map a lot of ids');
  });

  test('the named example mappings all hold', () => {
    const expected = {
      naruto_hokage: 'naruto', naruto_adult: 'naruto', rtn_naruto: 'naruto',
      kurama: 'naruto',
      sasuke_adult: 'sasuke', rtn_sasuke: 'sasuke',
      kakashi_hokage: 'kakashi', kakashi_young: 'kakashi', sakumo: 'kakashi',
      madara_edo: 'madara', madara_young: 'madara',
      obito_young: 'obito', rin: 'obito', tentails: 'obito',
      minato_young: 'minato', hashirama_young: 'hashirama',
      gaara_kazekage: 'gaara', shukaku: 'gaara',
      gyuki: 'bee', dai: 'guy', lee_adult: 'lee',
      zetsu: 'white_zetsu',
    };
    const wrong = Object.entries(expected)
      .filter(([old, want]) => resolveFighterId(old) !== want)
      .map(([old, want]) => `${old} -> ${resolveFighterId(old)}, expected ${want}`);
    assertEmpty(wrong, 'Specified migration mappings that do not hold');
  });

  test('a current fighter id resolves to itself', () => {
    const wrong = FIGHTER_ORDER.filter((id) => resolveFighterId(id) !== id);
    assertEmpty(wrong, 'Roster ids must not be remapped');
    assert(!isLegacyFighterId('naruto'), 'A live id is not a legacy id');
    assert(isLegacyFighterId('naruto_hokage'), 'A removed id is a legacy id');
  });

  test('alternate forms resolve through costumes or transformations', () => {
    // Every legacy id has to land somewhere real: either it became a costume,
    // or its power became a transformation, or it was a boss/original that
    // maps onto a related fighter. What it must not be is a dangling id.
    const unresolved = [];
    for (const old of Object.keys(LEGACY_FIGHTER_IDS)) {
      const target = LEGACY_FIGHTER_IDS[old];
      const asCostume = COSTUME_BY_LEGACY_ID[old];
      const hasForms = (FIGHTERS[target].transformations || []).length > 0;
      if (!asCostume && !hasForms) unresolved.push(`${old} -> ${target}: no costume, no forms`);
    }
    assertEmpty(unresolved, 'Legacy ids with nowhere to live');
  });

  test('costumes attach to fighters that exist and never duplicate the roster', () => {
    const problems = [];
    for (const [fighterId, list] of Object.entries(COSTUMES)) {
      if (!FIGHTERS[fighterId]) problems.push(`costumes for unknown fighter ${fighterId}`);
      const ids = new Set();
      for (const c of list) {
        if (ids.has(c.id)) problems.push(`${fighterId}: duplicate costume ${c.id}`);
        ids.add(c.id);
        if (c.legacyId && FIGHTERS[c.legacyId]) {
          problems.push(`${fighterId}/${c.id}: legacyId ${c.legacyId} is still a roster card`);
        }
      }
    }
    assertEmpty(problems, 'Costume problems');
    assert(costumesFor('naruto').some((c) => c.id === 'hokage'),
      'Naruto should carry a Hokage costume');
    assert(costumesFor('obito').some((c) => c.id === 'masked'),
      'Obito should carry a masked costume');
  });

  test('the headline fighters keep their transformation chains', () => {
    const wanted = {
      naruto: 3, sasuke: 3, madara: 2, obito: 2, guy: 2, gaara: 2,
      boruto: 2, kawaki: 2, bee: 2, momoshiki: 1,
    };
    const thin = Object.entries(wanted)
      .filter(([id, n]) => (FIGHTERS[id].transformations || []).length < n)
      .map(([id, n]) => `${id} has ${FIGHTERS[id].transformations.length} forms, expected >= ${n}`);
    assertEmpty(thin, 'Fighters whose awakenings were lost in the cleanup');
  });

  /* ------------------------------------------------------------- PvE flow */

  test('every fighter can be the player and every fighter can be the AI', () => {
    // Spot-check across the whole roster rather than running 110 full matches:
    // both roles are constructed for each fighter, which is what the select
    // screen and the engine actually do.
    const problems = [];
    for (const id of FIGHTER_ORDER) {
      try {
        const e = new CombatEngine();
        e.setup({
          playerId: id,
          opponentId: id === 'naruto' ? 'sasuke' : 'naruto',
          stageId: 'training_dojo', difficulty: 'normal', rounds: 1, timer: 99,
        });
        const counts = e.assertPvE();
        if (counts.human !== 1 || counts.ai !== 1) problems.push(`${id}: ${JSON.stringify(counts)}`);
        e.destroy();
      } catch (err) {
        problems.push(`${id} as player: ${err.message}`);
      }
      try {
        const e = new CombatEngine();
        e.setup({
          playerId: id === 'naruto' ? 'sasuke' : 'naruto',
          opponentId: id,
          stageId: 'training_dojo', difficulty: 'normal', rounds: 1, timer: 99,
        });
        e.assertPvE();
        e.destroy();
      } catch (err) {
        problems.push(`${id} as AI opponent: ${err.message}`);
      }
    }
    assertEmpty(problems, 'Fighters that cannot fill both roles');
  });

  test('a match has exactly one human controller and one AI controller', () => {
    const e = new CombatEngine();
    e.setup({
      playerId: 'naruto', opponentId: 'sasuke', stageId: 'training_dojo',
      difficulty: 'hard', rounds: 1, timer: 99,
    });
    assertEqual(e.fighters.filter((f) => f.isPlayer).length, 1, 'human-controlled fighters');
    assertEqual(e.controllers.size, 1, 'AI controllers');
    assertEqual(e.controllers.has(e.enemy.id), true, 'the AI controls the opponent');
    assertEqual(e.controllers.has(e.player.id), false, 'the player is not AI-driven');
    e.destroy();
  });

  test('the AI actually drives the opponent during a match', () => {
    const e = new CombatEngine();
    e.setup({
      playerId: 'naruto', opponentId: 'sasuke', stageId: 'training_dojo',
      difficulty: 'hard', rounds: 1, timer: 99,
    });
    const start = { x: e.enemy.x, state: e.enemy.state };
    let acted = false;
    for (let i = 0; i < 600 && !acted; i++) {
      e.step(SIM_DT);
      if (e.enemy.x !== start.x || e.enemy.act || e.enemy.state !== start.state) acted = true;
    }
    assert(acted, 'The AI opponent never moved or attacked');
    e.destroy();
  });

  test('a mirror match is still one human against one AI', () => {
    const e = new CombatEngine();
    e.setup({
      playerId: 'gaara', opponentId: 'gaara', stageId: 'training_dojo',
      difficulty: 'normal', rounds: 1, timer: 99,
    });
    const counts = e.assertPvE();
    assertEqual(counts.human, 1, 'one human');
    assertEqual(counts.ai, 1, 'one AI');
    assert(e.player !== e.enemy, 'Two distinct fighter instances');
    e.destroy();
  });

  test('every fighter has an AI profile the controller can use', () => {
    const missing = FIGHTER_ORDER.filter((id) => !AI_PROFILES[FIGHTERS[id].aiProfile]);
    assertEmpty(missing.map((id) => `${id} -> ${FIGHTERS[id].aiProfile}`),
      'Fighters with no usable AI profile');
  });

  test('no second human controller exists anywhere in the source', () => {
    // A grep-level guard: the game is single-player PvE, so the vocabulary of
    // local multiplayer and networking must not appear in shipped code.
    const banned = [
      /\bplayer\s*2\b/i, /\bp2\s*(controls|bindings|keys|input)\b/i,
      /\bmultiplayer\b/i, /\bmatchmaking\b/i, /\bwebsocket\b/i, /\bwebrtc\b/i,
      /\bnetplay\b/i, /\bpvp\b/i,
    ];
    const files = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git') continue;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.(js|html)$/.test(name)) files.push(full);
      }
    };
    walk(path.join(ROOT, 'js'));
    files.push(path.join(ROOT, 'index.html'));

    const hits = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const [i, line] of text.split('\n').entries()) {
        // Comments are allowed to say what the game is NOT.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        for (const pattern of banned) {
          if (pattern.test(line)) {
            hits.push(`${path.relative(ROOT, file)}:${i + 1} ${line.trim().slice(0, 70)}`);
          }
        }
      }
    }
    assertEmpty(hits, 'Local-multiplayer or networking vocabulary in shipped code');
  });

  test('nothing in the game fetches a remote host', () => {
    const files = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git') continue;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.(js|html|webmanifest)$/.test(name)) files.push(full);
      }
    };
    walk(path.join(ROOT, 'js'));
    files.push(path.join(ROOT, 'index.html'), path.join(ROOT, 'service-worker.js'));
    const hits = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      const m = text.match(/https?:\/\/(?!localhost|127\.0\.0\.1)[^\s'"`)]+/g) || [];
      for (const url of m) {
        if (/w3\.org|schema\.org|claude\.ai|example\.test/.test(url)) continue;
        hits.push(`${path.relative(ROOT, file)}: ${url}`);
      }
    }
    assertEmpty(hits, 'Remote URLs in shipped code — the game must run offline');
  });

  /* ------------------------------------------------------- save migration */

  test('an old save migrates without losing progress', () => {
    const legacy = {
      version: 4,
      level: 12,
      xp: 4200,
      coins: 3100,
      unlockedFighters: ['naruto', 'naruto_hokage', 'madara_edo', 'shukaku', 'lee_adult'],
      favorites: ['lee_adult', 'naruto', 'gyuki'],
      recent: ['madara_edo', 'kurama'],
      mastery: {
        naruto: { xp: 100, level: 3, wins: 2, matches: 5 },
        naruto_hokage: { xp: 50, level: 2, wins: 1, matches: 3 },
        madara_edo: { xp: 80, level: 2, wins: 1, matches: 2 },
      },
      transformationsUnlocked: ['naruto_hokage_sage', 'madara_edo_rinnegan'],
      story: { completedChapters: ['chapter_1'], completedNodes: { c1_b1: true }, current: null },
      arcade: { cleared: { madara_edo: true }, bestScore: { naruto_hokage: 900 } },
      survival: { bestWave: 14, bestScore: 8800, runs: 3 },
      tower: { highestFloor: 22, cleared: { 1: true } },
      bossRush: { cleared: { rush_beasts: true } },
      stats: { matches: 40, wins: 25, losses: 15 },
    };
    const s = migrate(structuredClone(legacy));

    assertEqual(s.version, SAVE_VERSION, 'save version');
    assertEqual(s.xp, 4200, 'xp survives');
    // `level` is derived from xp on load, so it is normalised rather than
    // carried across verbatim — that is the save manager's existing rule.
    assertEqual(s.level, levelForXp(4200), 'level is recomputed from surviving xp');
    assertEqual(s.coins, 3100, 'coins survive');
    assertEqual(s.survival.bestWave, 14, 'survival record survives');
    assertEqual(s.tower.highestFloor, 22, 'tower progress survives');
    assertEqual(s.stats.matches, 40, 'lifetime stats survive');
    assertEqual(s.story.completedChapters[0], 'chapter_1', 'story progress survives');
    assert(s.bossRush.cleared.rush_beasts, 'boss rush progress survives');

    // Everything the save referenced now points at a live fighter.
    const dangling = [
      ...s.unlockedFighters, ...s.favorites, ...s.recent, ...Object.keys(s.mastery),
    ].filter((id) => !FIGHTERS[id]);
    assertEmpty(dangling, 'Migrated save still references removed fighters');

    // Mastery merges rather than overwriting: 100 + 50 across two old cards.
    assertEqual(s.mastery.naruto.xp, 150, 'mastery xp is merged, not dropped');
    assertEqual(s.mastery.naruto.matches, 8, 'mastery matches are merged');
    assertEqual(s.mastery.madara.xp, 80, 'mastery moves to the surviving fighter');

    // Old unlocks became costumes.
    assert(s.costumes.naruto?.includes('hokage'), 'Hokage Naruto became a costume');
    assert(s.costumes.madara?.includes('edo'), 'Edo Madara became a costume');

    // Transformation unlock keys follow their owner.
    assert(s.transformationsUnlocked.includes('naruto_sage'),
      `Expected naruto_sage, got ${s.transformationsUnlocked.join(', ')}`);
    assert(s.transformationsUnlocked.includes('madara_rinnegan'),
      'Edo Madara\'s Rinnegan unlock moves to Madara');

    // Arcade progress keyed by fighter id follows too.
    assert(s.arcade.cleared.madara, 'arcade clear moved to the surviving fighter');
    assertEqual(s.arcade.bestScore.naruto, 900, 'arcade best score moved too');

    // No duplicates anywhere.
    for (const key of ['unlockedFighters', 'favorites', 'recent']) {
      assertEqual(new Set(s[key]).size, s[key].length, `${key} has duplicates`);
    }

    // A save written before assists existed gains an empty loadout rather
    // than having one guessed for it.
    assert(s.loadout && typeof s.loadout === 'object', 'loadout container exists');
    assertEqual(s.loadout.selectedAssistId, null, 'no assist is invented for an old save');
    assertEqual(s.loadout.fighterId, null, 'no fighter is invented for an old save');
  });

  test('a fresh save is already on the current version', () => {
    const s = defaultSave();
    assertEqual(s.version, SAVE_VERSION, 'default save version');
    assert(Array.isArray(s.unlockedFighters) && s.unlockedFighters.length > 0,
      'starters unlocked');
    const bad = s.unlockedFighters.filter((id) => !FIGHTERS[id]);
    assertEmpty(bad, 'Default save unlocks a fighter that does not exist');
    assert(s.costumes && typeof s.costumes === 'object', 'costume store exists');
    assert(s.loadout && typeof s.loadout === 'object', 'loadout store exists');
    assertEqual(s.loadout.selectedAssistId, null, 'a fresh save starts with no assist');
  });

  test('migrating twice is a no-op', () => {
    const once = migrate({ version: 4, unlockedFighters: ['naruto_hokage'], mastery: {} });
    const twice = migrate(structuredClone(once));
    assertEqual(JSON.stringify(twice.unlockedFighters), JSON.stringify(once.unlockedFighters),
      'A migrated save must not change again');
  });

  /* ----------------------------------------------------------- sprite art */

  test('every roster fighter still has their own sprite set', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'assets', 'fighters', 'manifest.json'), 'utf8'),
    );
    const missing = FIGHTER_ORDER.filter((id) => !manifest.fighters.includes(id));
    assertEmpty(missing, 'Roster fighters with no sprite set');
    const orphans = manifest.fighters.filter((id) => !FIGHTERS[id]);
    assertEmpty(orphans, 'Sprite sets for fighters that no longer exist');
    const onDisk = fs.readdirSync(path.join(ROOT, 'assets', 'fighters'))
      .filter((n) => fs.statSync(path.join(ROOT, 'assets', 'fighters', n)).isDirectory());
    const strays = onDisk.filter((id) => !FIGHTERS[id]);
    assertEmpty(strays, 'Sprite folders left behind by the roster cleanup');
  });
}
