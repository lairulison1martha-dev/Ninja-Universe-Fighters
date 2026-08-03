/**
 * Arcade ladders, Boss Rush and Challenge Tower definitions.
 */

/* -------------------------------------------------------------------------- */
/* Arcade                                                                     */
/* -------------------------------------------------------------------------- */

export const ARCADE_LADDERS = [
  {
    id: 'ladder_classic',
    displayName: 'Classic Ladder',
    description: 'Seven opponents of rising difficulty, ending with a legend.',
    unlockRequirement: { type: 'default' },
    stages: ['exam_arena', 'forest_training', 'leaf_village', 'desert_arena', 'rain_rooftops', 'final_valley', 'war_battlefield'],
    /** `random` picks from the pool; explicit ids are fixed encounters. */
    opponents: [
      { pick: 'random', pool: ['iruka', 'iruka', 'konohamaru', 'konohamaru', 'konohamaru'], difficulty: 'easy' },
      { pick: 'random', pool: ['kiba', 'choji', 'ino', 'tenten', 'shino'], difficulty: 'easy' },
      { pick: 'random', pool: ['neji', 'shikamaru', 'hinata', 'temari', 'kankuro'], difficulty: 'normal' },
      { pick: 'random', pool: ['zabuza', 'haku', 'kimimaro', 'orochimaru', 'asuma'], difficulty: 'normal' },
      { pick: 'random', pool: ['kakashi', 'guy', 'jiraiya', 'tsunade'], difficulty: 'hard' },
      { pick: 'random', pool: ['itachi', 'kisame', 'sasori', 'deidara', 'orochimaru'], difficulty: 'hard' },
      { pick: 'fixed', id: 'madara', difficulty: 'veryhard', boss: true, healthBonus: 0.35 },
    ],
    rewards: { coins: 1200, xp: 900 },
  },
  {
    id: 'ladder_akatsuki',
    displayName: 'Akatsuki Ladder',
    description: 'Every member, one after another, then the leader.',
    unlockRequirement: { type: 'arcade', value: 1 },
    stages: ['rain_rooftops', 'akatsuki_hideout', 'stone_canyon', 'desert_arena', 'war_battlefield', 'moonlit_river', 'rain_rooftops'],
    opponents: [
      { pick: 'fixed', id: 'hidan', difficulty: 'normal' },
      { pick: 'fixed', id: 'kakuzu', difficulty: 'normal' },
      { pick: 'fixed', id: 'deidara', difficulty: 'hard' },
      { pick: 'fixed', id: 'sasori', difficulty: 'hard' },
      { pick: 'fixed', id: 'kisame', difficulty: 'hard' },
      { pick: 'fixed', id: 'itachi', difficulty: 'veryhard' },
      { pick: 'fixed', id: 'pain', difficulty: 'veryhard', boss: true, healthBonus: 0.35 },
    ],
    rewards: { coins: 1800, xp: 1400, unlockFighters: ['konan'] },
  },
  {
    id: 'ladder_nextgen',
    displayName: 'Next Generation Ladder',
    description: 'The academy classes, then Kara.',
    unlockRequirement: { type: 'arcade', value: 1 },
    stages: ['exam_arena', 'training_dojo', 'leaf_village', 'forest_training', 'stone_canyon', 'otsutsuki_dimension'],
    opponents: [
      { pick: 'random', pool: ['boruto', 'boruto', 'lee', 'sumire', 'sumire', 'boruto'], difficulty: 'easy' },
      { pick: 'random', pool: ['ino', 'shikamaru', 'choji', 'sumire'], difficulty: 'normal' },
      { pick: 'fixed', id: 'mitsuki', difficulty: 'normal' },
      { pick: 'fixed', id: 'sarada', difficulty: 'hard' },
      { pick: 'fixed', id: 'delta', difficulty: 'hard' },
      { pick: 'fixed', id: 'momoshiki', difficulty: 'veryhard', boss: true, healthBonus: 0.35 },
    ],
    rewards: { coins: 1600, xp: 1300 },
  },
  {
    id: 'ladder_kage',
    displayName: 'Kage Ladder',
    description: 'Every village leader, in escalating order.',
    unlockRequirement: { type: 'level', value: 10 },
    stages: ['desert_arena', 'cloud_mountain', 'stone_canyon', 'snow_bridge', 'exam_arena', 'final_valley', 'war_battlefield'],
    opponents: [
      { pick: 'fixed', id: 'gaara', difficulty: 'normal' },
      { pick: 'fixed', id: 'mei', difficulty: 'normal' },
      { pick: 'fixed', id: 'onoki', difficulty: 'hard' },
      { pick: 'fixed', id: 'raikage4', difficulty: 'hard' },
      { pick: 'fixed', id: 'tsunade', difficulty: 'veryhard' },
      { pick: 'fixed', id: 'minato', difficulty: 'veryhard' },
      { pick: 'fixed', id: 'hashirama', difficulty: 'legendary', boss: true, healthBonus: 0.4 },
    ],
    rewards: { coins: 2200, xp: 1800 },
  },
];

/* -------------------------------------------------------------------------- */
/* Boss Rush                                                                  */
/* -------------------------------------------------------------------------- */

export const BOSS_RUSHES = [
  {
    id: 'rush_beasts',
    displayName: 'Tailed Beast Rush',
    description: 'Nine beasts, no healing between fights.',
    unlockRequirement: { type: 'default' },
    healBetween: 0,
    opponents: ['gaara', 'yugito', 'yagura', 'roshi', 'han', 'utakata', 'fu', 'bee', 'naruto'],
    stage: 'war_battlefield',
    difficulty: 'hard',
    healthBonus: 0.5,
    rewards: { coins: 2500, xp: 2000, unlockFighters: ['gaara', 'yugito', 'yagura', 'roshi', 'han', 'utakata', 'fu', 'bee'] },
  },
  {
    id: 'rush_kage',
    displayName: 'Kage Rush',
    description: 'Five leaders back to back. 30% health restored between fights.',
    unlockRequirement: { type: 'level', value: 8 },
    healBetween: 0.30,
    opponents: ['gaara', 'mei', 'onoki', 'raikage4', 'tsunade'],
    stage: 'exam_arena',
    difficulty: 'veryhard',
    healthBonus: 0.35,
    rewards: { coins: 2200, xp: 1700 },
  },
  {
    id: 'rush_akatsuki',
    displayName: 'Akatsuki Rush',
    description: 'The full organisation, no breaks.',
    unlockRequirement: { type: 'arcade', value: 2 },
    healBetween: 0.15,
    opponents: ['hidan', 'kakuzu', 'deidara', 'sasori', 'kisame', 'konan', 'itachi', 'obito', 'pain'],
    stage: 'akatsuki_hideout',
    difficulty: 'veryhard',
    healthBonus: 0.3,
    rewards: { coins: 2800, xp: 2200 },
  },
  {
    id: 'rush_otsutsuki',
    displayName: 'Otsutsuki Rush',
    description: 'The collectors. The hardest content in the game.',
    unlockRequirement: { type: 'story', value: 'chapter_10' },
    healBetween: 0.25,
    opponents: ['kinshiki', 'urashiki', 'toneri', 'momoshiki', 'isshiki', 'kaguya'],
    stage: 'otsutsuki_dimension',
    difficulty: 'legendary',
    healthBonus: 0.5,
    rewards: { coins: 4000, xp: 3200, unlockFighters: ['hagoromo', 'hamura'] },
  },
];

/* -------------------------------------------------------------------------- */
/* Challenge Tower                                                            */
/* -------------------------------------------------------------------------- */

/** Special battle conditions the tower (and story) can apply. */
export const CONDITIONS = {
  no_regen: { label: 'No chakra regeneration', apply: (s) => { s.chakraRegen = 0; } },
  drain_chakra: { label: 'Chakra drains steadily', apply: (s) => { s.chakraRegen = -6; } },
  low_health: { label: 'Both fighters start at 50% health', apply: (s) => { s.startHealth = 0.5; s.startHealthOpponent = 0.5; } },
  player_low_health: { label: 'You start at 40% health', apply: (s) => { s.startHealth = 0.40; } },
  boss_health: { label: 'Opponent has +40% health', apply: (s) => { s.opponentHealthBonus = 0.4; } },
  no_substitution: { label: 'Substitution disabled', apply: (s) => { s.substitutionStocks = 0; } },
  no_guard: { label: 'Guarding disabled', apply: (s) => { s.guardDisabled = true; } },
  no_ultimate: { label: 'Ultimates disabled', apply: (s) => { s.ultimateDisabled = true; } },
  time_attack: { label: 'Only 30 seconds', apply: (s) => { s.roundTime = 30; } },
  ranged_only: { label: 'Opponent only uses ranged attacks', apply: (s) => { s.opponentRangedOnly = true; } },
  double_damage: { label: 'All damage doubled', apply: (s) => { s.damageMultiplier = 2; } },
  no_awakening: { label: 'Transformations disabled', apply: (s) => { s.transformDisabled = true; } },
};

/** Deterministic 100-floor tower. Every 10th floor is a boss floor. */
function buildTower() {
  const pools = [
    ['iruka', 'iruka', 'konohamaru', 'konohamaru', 'konohamaru', 'boruto', 'ebisu'],
    ['kiba', 'choji', 'ino', 'tenten', 'shino', 'lee', 'boruto', 'sumire'],
    ['neji', 'hinata', 'shikamaru', 'temari', 'kankuro', 'sarada', 'mitsuki', 'orochimaru'],
    ['zabuza', 'haku', 'kimimaro', 'asuma', 'kurenai', 'temari', 'jugo', 'suigetsu'],
    ['kakashi', 'guy', 'jiraiya', 'tsunade', 'orochimaru', 'kabuto', 'darui', 'chojuro'],
    ['itachi', 'kisame', 'sasori', 'deidara', 'hidan', 'kakuzu', 'konan', 'white_zetsu'],
    ['mei', 'onoki', 'raikage4', 'gaara', 'kurotsuchi', 'suigetsu', 'hanzo'],
    ['minato', 'hashirama', 'tobirama', 'hiruzen', 'shisui', 'danzo', 'nagato'],
    ['obito', 'madara', 'kawaki', 'code', 'boro', 'delta', 'koji', 'daemon'],
    ['momoshiki', 'kinshiki', 'urashiki', 'toneri', 'jigen', 'isshiki'],
  ];
  const bosses = ['zabuza', 'kimimaro', 'itachi', 'pain', 'orochimaru', 'madara', 'obito', 'naruto', 'momoshiki', 'kaguya'];
  const conditionPool = [
    [], [], ['no_regen'], ['player_low_health'], ['time_attack'],
    ['no_substitution'], ['double_damage'], ['ranged_only'], ['no_guard'], ['no_ultimate'],
    ['no_regen', 'player_low_health'], ['no_substitution', 'double_damage'], ['no_awakening'],
  ];
  const stages = ['training_dojo', 'exam_arena', 'forest_training', 'leaf_village', 'desert_arena',
    'rain_rooftops', 'snow_bridge', 'cloud_mountain', 'stone_canyon', 'final_valley',
    'moonlit_river', 'war_battlefield', 'akatsuki_hideout', 'otsutsuki_dimension'];
  const diffs = ['easy', 'easy', 'normal', 'normal', 'hard', 'hard', 'veryhard', 'veryhard', 'legendary', 'legendary'];

  const floors = [];
  for (let i = 1; i <= 100; i++) {
    const band = Math.min(9, Math.floor((i - 1) / 10));
    const isBoss = i % 10 === 0;
    const pool = pools[band];
    floors.push({
      floor: i,
      boss: isBoss,
      opponent: isBoss ? bosses[band] : pool[(i * 7 + band * 3) % pool.length],
      stage: stages[(i * 5 + band) % stages.length],
      variant: i % 3 === 0 ? 'night' : 'day',
      difficulty: isBoss ? diffs[Math.min(9, band + 1)] : diffs[band],
      healthBonus: isBoss ? 0.35 + band * 0.05 : band * 0.02,
      conditions: i <= 5 ? [] : conditionPool[(i * 3 + band) % conditionPool.length],
      rewards: { coins: 40 + i * 6, xp: 30 + i * 5 },
    });
  }
  return floors;
}

export const TOWER_FLOORS = buildTower();
export const TOWER_HEIGHT = TOWER_FLOORS.length;

/** Milestone rewards for reaching specific floors. */
export const TOWER_MILESTONES = {
  10: { coins: 600, xp: 400 },
  25: { coins: 1200, xp: 900, unlockFighters: ['kimimaro'] },
  50: { coins: 2500, xp: 1800, unlockFighters: ['raikage4'] },
  75: { coins: 4000, xp: 3000, unlockFighters: ['onoki'] },
  100: { coins: 8000, xp: 6000, unlockFighters: ['hagoromo', 'hamura'] },
};

/* -------------------------------------------------------------------------- */
/* Survival                                                                   */
/* -------------------------------------------------------------------------- */

export const SURVIVAL_CONFIG = {
  /** Health restored between opponents, as a fraction of max. */
  healPerWin: 0.12,
  /** Extra health the opponent gains per wave. */
  healthRampPerWave: 0.04,
  /** Difficulty escalation by wave index. */
  difficultyByWave: [
    { from: 0, difficulty: 'easy' },
    { from: 3, difficulty: 'normal' },
    { from: 7, difficulty: 'hard' },
    { from: 12, difficulty: 'veryhard' },
    { from: 20, difficulty: 'legendary' },
  ],
  scorePerWin: 100,
  scorePerHealthPercent: 5,
  stagePool: ['exam_arena', 'forest_training', 'desert_arena', 'rain_rooftops', 'stone_canyon', 'war_battlefield', 'moonlit_river', 'snow_bridge'],
};
