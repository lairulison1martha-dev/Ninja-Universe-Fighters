/**
 * Achievements and titles.
 *
 * Each achievement has a `check(save, event)` predicate evaluated by
 * achievements-manager.js after every relevant game event.
 */

export const ACHIEVEMENTS = [];

function ach(id, name, description, o) {
  ACHIEVEMENTS.push({
    id,
    name,
    description,
    hidden: o.hidden || false,
    reward: o.reward || { coins: 200, xp: 150 },
    title: o.title || null,
    check: o.check,
  });
}

/* First steps -------------------------------------------------------------- */
ach('first_blood', 'First Victory', 'Win your first match.', {
  reward: { coins: 150, xp: 100 },
  check: (s) => s.stats.wins >= 1,
});
ach('ten_wins', 'Chunin Level', 'Win 10 matches.', {
  reward: { coins: 300, xp: 250 }, title: 'Chunin',
  check: (s) => s.stats.wins >= 10,
});
ach('fifty_wins', 'Jonin Level', 'Win 50 matches.', {
  reward: { coins: 800, xp: 700 }, title: 'Jonin',
  check: (s) => s.stats.wins >= 50,
});
ach('two_hundred_wins', 'Kage Level', 'Win 200 matches.', {
  reward: { coins: 2500, xp: 2000 }, title: 'Kage',
  check: (s) => s.stats.wins >= 200,
});

/* Combat skill ------------------------------------------------------------- */
ach('combo_10', 'Chain Reaction', 'Land a 10-hit combo.', {
  check: (s) => s.stats.bestCombo >= 10,
});
ach('combo_20', 'Unbroken', 'Land a 20-hit combo.', {
  reward: { coins: 500, xp: 400 }, title: 'Unbroken',
  check: (s) => s.stats.bestCombo >= 20,
});
ach('perfect_round', 'Untouched', 'Win a round without taking damage.', {
  reward: { coins: 400, xp: 300 }, title: 'Untouched',
  check: (s) => s.stats.perfectRounds >= 1,
});
ach('ten_perfects', 'Flawless Record', 'Win 10 perfect rounds.', {
  reward: { coins: 1000, xp: 800 },
  check: (s) => s.stats.perfectRounds >= 10,
});
ach('ultimate_finish', 'Finishing Move', 'Win a match with an ultimate.', {
  check: (s) => s.stats.ultimateFinishes >= 1,
});
ach('comeback', 'Never Out', 'Win a round from below 10% health.', {
  reward: { coins: 600, xp: 500 }, title: 'Comeback King',
  check: (s) => s.stats.comebacks >= 1,
});
ach('guard_master', 'Immovable', 'Block 500 attacks.', {
  check: (s) => s.stats.blocks >= 500,
});
ach('substitution_master', 'Ghost', 'Substitute 100 times.', {
  check: (s) => s.stats.substitutions >= 100,
});

/* Transformations ---------------------------------------------------------- */
ach('first_transform', 'Awakened', 'Transform for the first time.', {
  reward: { coins: 200, xp: 150 },
  check: (s) => s.stats.transformations >= 1,
});
ach('chain_transform', 'Full Chain', 'Reach the final form of any transformation chain.', {
  reward: { coins: 800, xp: 600 }, title: 'Ascended',
  check: (s) => s.stats.finalFormsReached >= 1,
});
ach('all_naruto_forms', 'Nine Tails and Beyond', 'Reach Baryon Mode.', {
  hidden: true, reward: { coins: 1200, xp: 1000 },
  check: (s) => (s.transformationsUnlocked || []).includes('naruto_baryon'),
});
ach('eighth_gate', 'Gate of Death', 'Open the Eighth Gate.', {
  hidden: true, reward: { coins: 1500, xp: 1200 }, title: 'Eternal Genin',
  check: (s) => (s.transformationsUnlocked || []).includes('guy_gate8'),
});

/* Progression -------------------------------------------------------------- */
ach('roster_25', 'Recruiter', 'Unlock 25 fighters.', {
  check: (s) => (s.unlockedFighters || []).length >= 25,
});
ach('roster_60', 'Village Elder', 'Unlock 60 fighters.', {
  reward: { coins: 1200, xp: 900 },
  check: (s) => (s.unlockedFighters || []).length >= 60,
});
ach('roster_120', 'Complete Archive', 'Unlock 120 fighters.', {
  reward: { coins: 3000, xp: 2500 }, title: 'Archivist',
  check: (s) => (s.unlockedFighters || []).length >= 120,
});
ach('story_half', 'Halfway Through', 'Complete story chapter 5.', {
  check: (s) => (s.story.completedChapters || []).includes('chapter_5'),
});
ach('story_done', 'The Third Accord', 'Complete the story.', {
  reward: { coins: 3000, xp: 2500 }, title: 'Accord Keeper',
  check: (s) => (s.story.completedChapters || []).includes('chapter_10'),
});
ach('arcade_clear', 'Arcade Champion', 'Clear an arcade ladder.', {
  reward: { coins: 700, xp: 600 },
  check: (s) => Object.keys(s.arcade.cleared || {}).length >= 1,
});
ach('arcade_all', 'Every Ladder', 'Clear all four arcade ladders.', {
  reward: { coins: 2000, xp: 1600 },
  check: (s) => Object.keys(s.arcade.cleared || {}).length >= 4,
});
ach('survival_20', 'Endurance', 'Reach wave 20 in Survival.', {
  reward: { coins: 1000, xp: 800 }, title: 'Endless',
  check: (s) => (s.survival.bestWave || 0) >= 20,
});
ach('tower_10', 'First Ascent', 'Reach floor 10 of the Challenge Tower.', {
  check: (s) => (s.tower.highestFloor || 0) >= 10,
});
ach('tower_50', 'Halfway Up', 'Reach floor 50 of the Challenge Tower.', {
  reward: { coins: 1800, xp: 1400 },
  check: (s) => (s.tower.highestFloor || 0) >= 50,
});
ach('tower_100', 'Summit', 'Clear the Challenge Tower.', {
  reward: { coins: 6000, xp: 5000 }, title: 'Tower Summit',
  check: (s) => (s.tower.highestFloor || 0) >= 100,
});
ach('bossrush_clear', 'Beast Hunter', 'Clear any Boss Rush.', {
  reward: { coins: 1500, xp: 1200 },
  check: (s) => Object.keys(s.bossRush.cleared || {}).length >= 1,
});

/* Mastery ------------------------------------------------------------------ */
ach('mastery_one', 'Devoted', 'Reach mastery level 5 with any fighter.', {
  reward: { coins: 600, xp: 500 },
  check: (s) => Object.values(s.mastery || {}).some((m) => (m.level || 0) >= 5),
});
ach('mastery_ten', 'Well Rounded', 'Reach mastery level 3 with 10 different fighters.', {
  reward: { coins: 1200, xp: 1000 },
  check: (s) => Object.values(s.mastery || {}).filter((m) => (m.level || 0) >= 3).length >= 10,
});
ach('training_hour', 'Dedicated Student', 'Spend 30 minutes in Training mode.', {
  check: (s) => (s.stats.trainingSeconds || 0) >= 1800,
});

export const TITLES = ACHIEVEMENTS.filter((a) => a.title).map((a) => ({ id: a.id, title: a.title }));
export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}
