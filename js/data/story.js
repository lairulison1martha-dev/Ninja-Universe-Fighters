/**
 * Story mode — "The Severed Accord".
 *
 * An ORIGINAL parallel ninja-world campaign. It deliberately does not retell
 * any published episode: the settlements, the organisation, the war and the
 * ancient beast are written for this project. Existing fighter names are used
 * as prototype casting only.
 *
 * The structure is fully data-driven: add a chapter object and it appears in
 * the menu, with unlocks and rewards wired automatically.
 */

export const STORY = { chapters: [] };

function chapter(id, title, o) {
  const c = {
    id,
    title,
    subtitle: o.subtitle || '',
    unlockAfter: o.unlockAfter || null,   // previous chapter id
    summary: o.summary,
    nodes: o.nodes,
    rewards: o.rewards || { coins: 400, xp: 300 },
  };
  STORY.chapters.push(c);
  return c;
}

/** Dialogue node. `lines` is [{ speaker, portrait, text }] */
const talk = (id, lines, o = {}) => ({ type: 'dialogue', id, lines, stage: o.stage || 'leaf_village', variant: o.variant || 'day' });

/** Battle node. */
const fight = (id, o) => ({
  type: 'battle',
  id,
  player: o.player,
  opponent: o.opponent,
  stage: o.stage,
  variant: o.variant || 'day',
  difficulty: o.difficulty || 'normal',
  rounds: o.rounds || 1,
  timer: o.timer ?? 99,
  /** Optional special rules, same shape as the Challenge Tower conditions. */
  conditions: o.conditions || [],
  title: o.title || '',
  loseMessage: o.loseMessage || 'The accord holds a little longer. Try again.',
});

/* -------------------------------------------------------------------------- */

chapter('chapter_1', 'The Severed Accord', {
  subtitle: 'Five settlements, one broken treaty.',
  summary: 'The Accord of Five has held for forty years. This morning the seal stone at the border of the Leaf cracked from the inside, and nobody will say why.',
  nodes: [
    talk('c1_open', [
      { speaker: 'Narrator', text: 'For forty years the Accord of Five kept the settlements from each other\'s throats. It was carved into a single stone at the border of the Leaf.' },
      { speaker: 'Narrator', text: 'This morning the stone cracked. From the inside.' },
      { speaker: 'Iruka', text: 'Nobody crossed the border. Nobody touched it. And it still broke.' },
      { speaker: 'Naruto', text: 'Then something was already here.' },
    ], { stage: 'leaf_village' }),
    fight('c1_b1', { player: 'naruto', opponent: 'mizuki', stage: 'forest_training', difficulty: 'easy', title: 'Sparring: fundamentals' }),
    talk('c1_mid', [
      { speaker: 'Sakura', text: 'The crack runs downward. Whatever did it was under the stone.' },
      { speaker: 'Kakashi', text: 'Then we are not looking for an invader. We are looking for something that was sealed.' },
    ], { stage: 'forest_training' }),
    fight('c1_b2', { player: 'naruto', opponent: 'sasuke', stage: 'exam_arena', difficulty: 'easy', rounds: 2, title: 'Evaluation: Team Seven' }),
  ],
  rewards: { coins: 500, xp: 400, unlockFighters: ['iruka'] },
});

chapter('chapter_2', 'What the Stone Held', {
  subtitle: 'The first descent.',
  unlockAfter: 'chapter_1',
  summary: 'Beneath the seal stone is a chamber older than the Accord — and older than the settlements that signed it.',
  nodes: [
    talk('c2_open', [
      { speaker: 'Kakashi', text: 'The chamber below is older than the Accord. Older than the village.' },
      { speaker: 'Sakura', text: 'Older than the village. So who built it?' },
      { speaker: 'Kakashi', text: 'That is the wrong question. Ask who it was built to keep in.' },
    ], { stage: 'akatsuki_hideout', variant: 'night' }),
    fight('c2_b1', { player: 'sakura', opponent: 'kabuto', stage: 'akatsuki_hideout', variant: 'night', difficulty: 'normal', title: 'The chamber is not empty' }),
    talk('c2_mid', [
      { speaker: 'Kabuto', text: 'You were never meant to open it. You were meant to guard it. There is a difference, and your grandparents forgot it.' },
    ], { stage: 'akatsuki_hideout', variant: 'night' }),
    fight('c2_b2', { player: 'kakashi', opponent: 'zabuza', stage: 'final_valley', difficulty: 'normal', rounds: 2, title: 'Interception at the valley' }),
  ],
  rewards: { coins: 600, xp: 500, unlockStages: ['final_valley'] },
});

chapter('chapter_3', 'The Sand Runs First', {
  subtitle: 'An alliance nobody asked for.',
  unlockAfter: 'chapter_2',
  summary: 'The Sand breaks from the Accord — not out of hostility, but because their own seal cracked three days earlier and they said nothing.',
  nodes: [
    talk('c3_open', [
      { speaker: 'Gaara', text: 'Our stone cracked three days before yours. We did not report it.' },
      { speaker: 'Naruto', text: 'Three days? Why hide it?' },
      { speaker: 'Gaara', text: 'Because the last settlement that reported a crack no longer exists. It is not on your maps. That is not an accident.' },
    ], { stage: 'desert_arena' }),
    fight('c3_b1', { player: 'gaara', opponent: 'temari', stage: 'desert_arena', difficulty: 'normal', title: 'Sand duel: proving the claim' }),
    fight('c3_b2', { player: 'naruto', opponent: 'itachi', stage: 'rain_rooftops', variant: 'night', difficulty: 'hard', rounds: 2, title: 'The watcher in the rain', conditions: [{ id: 'no_regen', label: 'Chakra does not regenerate' }] }),
  ],
  rewards: { coins: 700, xp: 600, unlockFighters: ['itachi', 'gaara_kazekage'] },
});

chapter('chapter_4', 'Six Bodies, One Voice', {
  subtitle: 'The organisation reveals itself.',
  unlockAfter: 'chapter_3',
  summary: 'A group calling itself the Concordance claims the seals were never meant to last, and that they are simply keeping a promise the settlements broke.',
  nodes: [
    talk('c4_open', [
      { speaker: 'Pain', text: 'You call us an organisation. We are a correction.' },
      { speaker: 'Pain', text: 'Your ancestors signed the Accord and then buried what the Accord was signed about. We are simply keeping the older promise.' },
      { speaker: 'Naruto', text: 'And the settlement that got erased from the maps?' },
      { speaker: 'Pain', text: 'It kept the promise too. That is why nothing of it remains.' },
    ], { stage: 'rain_rooftops', variant: 'night' }),
    fight('c4_b1', { player: 'naruto', opponent: 'pain', stage: 'rain_rooftops', variant: 'night', difficulty: 'hard', rounds: 3, title: 'The Concordance' }),
  ],
  rewards: { coins: 900, xp: 800, unlockFighters: ['pain', 'nagato'], unlockStages: ['akatsuki_hideout'] },
});

chapter('chapter_5', 'The Root Beneath the Root', {
  subtitle: 'Betrayal at home.',
  unlockAfter: 'chapter_4',
  summary: 'The Leaf\'s own intelligence division knew about the chamber. They have known for two generations.',
  nodes: [
    talk('c5_open', [
      { speaker: 'Danzo', text: 'Two generations of my department have known. Two generations decided you should not.' },
      { speaker: 'Sakura', text: 'That was not your decision to make.' },
      { speaker: 'Danzo', text: 'It was made. That is the only part that matters now.' },
    ], { stage: 'leaf_village', variant: 'night' }),
    fight('c5_b1', { player: 'sakura', opponent: 'danzo', stage: 'leaf_village', variant: 'night', difficulty: 'hard', rounds: 2, title: 'The department answers' }),
    fight('c5_b2', { player: 'naruto', opponent: 'kakashi', stage: 'training_dojo', difficulty: 'hard', title: 'Test of resolve', conditions: [{ id: 'low_health', label: 'Both fighters start at 50% health' }] }),
  ],
  rewards: { coins: 1000, xp: 900, unlockFighters: ['danzo'] },
});

chapter('chapter_6', 'The War of the Second Accord', {
  subtitle: 'Five settlements, one battlefield.',
  unlockAfter: 'chapter_5',
  summary: 'The settlements march — not against each other, but against the thing that has been slowly waking beneath all five seal stones at once.',
  nodes: [
    talk('c6_open', [
      { speaker: 'Narrator', text: 'For the first time in forty years, five banners stood on the same field. Not facing each other.' },
      { speaker: 'Madara', text: 'You brought an army to a problem that predates armies.' },
      { speaker: 'Guy', text: 'Then we will be the first army it has ever had to deal with.' },
    ], { stage: 'war_battlefield' }),
    fight('c6_b1', { player: 'guy', opponent: 'madara', stage: 'war_battlefield', difficulty: 'veryhard', rounds: 2, title: 'The first line' }),
    fight('c6_b2', { player: 'naruto', opponent: 'madara', stage: 'war_battlefield', difficulty: 'veryhard', rounds: 3, title: 'The second line', conditions: [{ id: 'boss_health', label: 'Opponent has +40% health' }] }),
  ],
  rewards: { coins: 1400, xp: 1200, unlockFighters: ['madara', 'madara_edo'], unlockStages: ['war_battlefield'] },
});

chapter('chapter_7', 'What Was Sealed', {
  subtitle: 'The beast beneath the Accord.',
  unlockAfter: 'chapter_6',
  summary: 'The thing under the stones is not a demon and not a god. It is older energy — and it has been feeding on the seals themselves.',
  nodes: [
    talk('c7_open', [
      { speaker: 'Hashirama', text: 'It is not a demon. It is not a god. It is the energy the first shinobi took, and it has been drawing it back one seal at a time.' },
      { speaker: 'Kawaki', text: 'So the Accord was never a treaty.' },
      { speaker: 'Hashirama', text: 'It was a feeding schedule. Signed by people who did not read it.' },
    ], { stage: 'stone_canyon' }),
    fight('c7_b1', { player: 'kawaki', opponent: 'kurama', stage: 'stone_canyon', difficulty: 'veryhard', rounds: 2, title: 'The ancient beast stirs', conditions: [{ id: 'boss_health', label: 'Opponent has +40% health' }] }),
  ],
  rewards: { coins: 1500, xp: 1300, unlockFighters: ['kawaki', 'kakashi_hokage'] },
});

chapter('chapter_8', 'The Ones Who Wrote It', {
  subtitle: 'Outside the world.',
  unlockAfter: 'chapter_7',
  summary: 'The Accord was not written by any of the five settlements. It was written by something that visits, collects, and leaves.',
  nodes: [
    talk('c8_open', [
      { speaker: 'Momoshiki', text: 'You assume the document was yours. It was a receipt.' },
      { speaker: 'Boruto', text: 'A receipt for what?' },
      { speaker: 'Momoshiki', text: 'For the harvest. You are early, but not by much.' },
    ], { stage: 'otsutsuki_dimension', variant: 'night' }),
    fight('c8_b1', { player: 'boruto', opponent: 'momoshiki', stage: 'otsutsuki_dimension', variant: 'night', difficulty: 'veryhard', rounds: 2, title: 'The collector' }),
    fight('c8_b2', { player: 'naruto', opponent: 'obito', stage: 'otsutsuki_dimension', variant: 'night', difficulty: 'veryhard', rounds: 2, title: 'The one who signed first' }),
  ],
  rewards: { coins: 1700, xp: 1500, unlockFighters: ['obito'], unlockStages: ['otsutsuki_dimension'] },
});

chapter('chapter_9', 'The Third Accord', {
  subtitle: 'Writing it properly this time.',
  unlockAfter: 'chapter_8',
  summary: 'The surviving settlements draft a new agreement — this time with everyone in the room, and the terms read aloud.',
  nodes: [
    talk('c9_open', [
      { speaker: 'Naruto', text: 'New rule. Everything gets read out loud. All of it. Even the boring parts.' },
      { speaker: 'Gaara', text: 'Especially the boring parts.' },
      { speaker: 'Sasuke', text: 'And someone stays awake at the border. Permanently.' },
    ], { stage: 'exam_arena' }),
    fight('c9_b1', { player: 'sasuke', opponent: 'naruto_adult', stage: 'final_valley', difficulty: 'legendary', rounds: 3, title: 'The last disagreement' }),
  ],
  rewards: { coins: 2000, xp: 1800, unlockFighters: ['naruto_adult', 'sasuke_adult', 'kakashi_hokage'] },
});

chapter('chapter_10', 'The Harvest Refused', {
  subtitle: 'Finale.',
  unlockAfter: 'chapter_9',
  summary: 'The collector returns for what the first Accord promised. This time the settlements know what they are being asked to give up.',
  nodes: [
    talk('c10_open', [
      { speaker: 'Isshiki', text: 'The terms were agreed before your grandparents were named.' },
      { speaker: 'Kawaki', text: 'Then the terms are older than anyone who can consent to them. That makes them nothing.' },
      { speaker: 'Boruto', text: 'We\'re not signing. Not this time, not ever.' },
    ], { stage: 'otsutsuki_dimension', variant: 'night' }),
    fight('c10_b1', { player: 'boruto', opponent: 'isshiki', stage: 'otsutsuki_dimension', variant: 'night', difficulty: 'legendary', rounds: 3, title: 'The collector returns', conditions: [{ id: 'boss_health', label: 'Opponent has +40% health' }] }),
    fight('c10_b2', { player: 'naruto', opponent: 'kaguya', stage: 'otsutsuki_dimension', variant: 'night', difficulty: 'legendary', rounds: 3, title: 'The Harvest Refused', conditions: [{ id: 'boss_health', label: 'Opponent has +40% health' }, { id: 'no_substitution', label: 'Substitution disabled' }] }),
    talk('c10_end', [
      { speaker: 'Narrator', text: 'The Third Accord was four pages long and took eleven days to read aloud. Every settlement sent someone. Nobody left early.' },
      { speaker: 'Narrator', text: 'The border stone was left cracked, on purpose, where everyone could see it.' },
    ], { stage: 'leaf_village' }),
  ],
  rewards: { coins: 3000, xp: 2500, unlockFighters: ['kaguya', 'isshiki', 'naruto_hokage', 'jigen'] },
});

export function getChapter(id) {
  return STORY.chapters.find((c) => c.id === id) || null;
}

export const CHAPTER_COUNT = STORY.chapters.length;
export const CHAPTER_IDS = STORY.chapters.map((c) => c.id);
