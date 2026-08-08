/**
 * The roster.
 *
 * 20 fighters have hand-authored, genuinely unique kits (playableStatus
 * "complete"). Everyone else is registered with full metadata, transformations,
 * unlock conditions and roster position, but uses a clearly-labelled archetype
 * PROTOTYPE template for their moves — the character-select screen shows this
 * explicitly so nothing is oversold.
 *
 * Names reference well-known characters for a private prototype. All artwork,
 * effects and audio in this project are original placeholders; the `colors` /
 * `visual` fields drive procedurally drawn fighters so no third-party sprite is
 * ever required.
 */

import { defineFighter, FIGHTERS, FIGHTER_ORDER, getFighter, allFighters } from './fighter-schema.js';
import { PLAYABLE_STATUS } from '../constants.js';
import { SIGNATURE_KITS } from './abilities.js';
import * as TF from './transformations.js';

const COMPLETE = PLAYABLE_STATUS.COMPLETE;

/* -------------------------------------------------------------------------- */
/* Complete fighters                                                          */
/* -------------------------------------------------------------------------- */

function complete(id, name, o) {
  return defineFighter(id, name, {
    ...o,
    playableStatus: COMPLETE,
    kit: SIGNATURE_KITS[id],
  });
}

complete('naruto', 'Naruto Uzumaki', {
  era: 'shippuden', village: 'leaf', clan: 'uzumaki', organization: 'team-seven',
  rank: 'genin', archetype: 'balanced', difficulty: 1,
  chakraNatures: ['wind', 'yang'],
  description: 'Relentless clone pressure and the Rasengan. Forgiving on the ground, and his transformation chain is the deepest in the game.',
  passiveAbilities: ['Kurama Reserve — regenerates 30% more chakra below half health.'],
  transformations: TF.NARUTO_CHAIN,
  summons: ['summon_gamakichi', 'summon_shadow_clones'],
  aiProfile: 'naruto',
  unlockRequirement: { type: 'default' },
  stats: { health: 1080, chakra: 118, attack: 102, defense: 100, speed: 104, chakraControl: 96, guard: 100, substitution: 104, awakeningRate: 118 },
  colors: { primary: '#f5a623', secondary: '#2d4b8e', accent: '#ff7a1a', hair: '#ffd85e', aura: '#ffb020', skin: '#e8b98d' },
  visual: { height: 1.0, bulk: 1.0, hairStyle: 'spiky', weapon: 'none', cape: false, markings: 'stripes' },
  tags: ['starter', 'jinchuriki', 'sage', 'protagonist'],
});

complete('sasuke', 'Sasuke Uchiha', {
  era: 'shippuden', village: 'leaf', clan: 'uchiha', organization: 'team-seven',
  rank: 'rogue', archetype: 'balanced', difficulty: 2,
  chakraNatures: ['lightning', 'fire', 'blaze', 'yin'],
  description: 'Blade poke into Chidori. Excellent mid-range mix-ups and the only fighter with a position swap.',
  passiveAbilities: ['Sharingan Read — guard meter recovers 25% faster.'],
  transformations: TF.SASUKE_CHAIN,
  summons: ['summon_aoda', 'summon_taka'],
  aiProfile: 'sasuke',
  unlockRequirement: { type: 'default' },
  stats: { health: 1000, chakra: 112, attack: 106, defense: 98, speed: 108, chakraControl: 110, guard: 104, substitution: 106, awakeningRate: 108 },
  colors: { primary: '#2b2f45', secondary: '#5a1a2a', accent: '#7fd4ff', hair: '#23283a', aura: '#8a5aff', skin: '#f0d6bc' },
  visual: { height: 1.01, bulk: 0.96, hairStyle: 'spiky', weapon: 'sword', cape: false, markings: 'none' },
  tags: ['starter', 'uchiha', 'sharingan', 'rival'],
});

complete('sakura', 'Sakura Haruno', {
  era: 'shippuden', village: 'leaf', clan: 'haruno', organization: 'team-seven',
  rank: 'jonin', archetype: 'grappler', difficulty: 2,
  chakraNatures: ['earth', 'water', 'yin'],
  description: 'Slow but colossal single hits, terrain smashes and the only reliable self-heal among the starters.',
  passiveAbilities: ['Medical Training — healing effects on Sakura are 20% stronger.'],
  transformations: TF.SAKURA_CHAIN,
  summons: ['summon_katsuyu'],
  aiProfile: 'sakura',
  unlockRequirement: { type: 'default' },
  stats: { health: 1100, chakra: 106, attack: 118, defense: 108, speed: 92, chakraControl: 116, guard: 106, substitution: 96, awakeningRate: 100 },
  colors: { primary: '#e04a7a', secondary: '#b8365e', accent: '#8affc9', hair: '#ff9ec4', aura: '#ff5a8a', skin: '#f4d8c0' },
  visual: { height: 0.97, bulk: 0.94, hairStyle: 'short', weapon: 'none', cape: false, markings: 'seal' },
  tags: ['starter', 'medic', 'byakugo'],
});

complete('kakashi', 'Kakashi Hatake', {
  era: 'shippuden', village: 'leaf', clan: 'hatake', organization: 'team-seven',
  rank: 'jonin', archetype: 'counter', difficulty: 3,
  chakraNatures: ['lightning', 'fire', 'water', 'earth', 'wind', 'yin', 'yang'],
  description: 'A toolkit fighter with an answer to everything: hounds to pin, a water dragon to zone, and Kamui to phase straight through your punish.',
  passiveAbilities: ['Copy Ninja — cooldowns tick 15% faster while guarding.'],
  transformations: TF.KAKASHI_CHAIN,
  summons: ['summon_ninja_hounds'],
  aiProfile: 'kakashi',
  unlockRequirement: { type: 'default' },
  stats: { health: 1000, chakra: 110, attack: 102, defense: 104, speed: 106, chakraControl: 116, guard: 114, substitution: 112, awakeningRate: 100 },
  colors: { primary: '#33507a', secondary: '#1f2a3d', accent: '#7fd4ff', hair: '#c9cdd6', aura: '#b57bff', skin: '#e8c6a6' },
  visual: { height: 1.05, bulk: 0.98, hairStyle: 'spiky', weapon: 'kunai', cape: false, markings: 'none' },
  tags: ['starter', 'sharingan', 'kamui', 'jonin'],
});

complete('lee', 'Rock Lee', {
  era: 'shippuden', village: 'leaf', clan: 'none', organization: 'team-guy',
  rank: 'chunin', archetype: 'rushdown', difficulty: 2,
  chakraNatures: ['none'],
  description: 'Zero projectiles, zero excuses. Lee has the fastest normals in the game and six gates of escalating self-harm.',
  passiveAbilities: ['Taijutsu Specialist — cannot use ranged jutsu, but all melee damage is +8%.'],
  transformations: TF.LEE_CHAIN,
  summons: ['summon_guy'],
  aiProfile: 'lee',
  unlockRequirement: { type: 'default' },
  stats: { health: 990, chakra: 78, attack: 108, defense: 94, speed: 124, chakraControl: 60, guard: 96, substitution: 108, awakeningRate: 120 },
  colors: { primary: '#2fa85a', secondary: '#1c6b3a', accent: '#ff8a3c', hair: '#1a1a20', aura: '#ff5a2a', skin: '#e8c09a' },
  visual: { height: 1.0, bulk: 1.04, hairStyle: 'bowl', weapon: 'none', cape: false, markings: 'none' },
  tags: ['starter', 'taijutsu', 'eight-gates'],
});

complete('gaara', 'Gaara', {
  era: 'shippuden', village: 'sand', clan: 'none', organization: 'sand-village',
  rank: 'jonin', archetype: 'zoning', difficulty: 3,
  chakraNatures: ['wind', 'earth', 'magnet'],
  description: 'Controls the whole arena with sand and blocks automatically. Terrible dash game — if you get opened up, you stay opened up.',
  passiveAbilities: ['Automatic Defence — the first hit of any combo does 30% less damage.'],
  transformations: TF.GAARA_CHAIN,
  summons: ['summon_temari'],
  aiProfile: 'gaara',
  unlockRequirement: { type: 'default' },
  stats: { health: 1050, chakra: 116, attack: 96, defense: 120, speed: 86, chakraControl: 118, guard: 126, substitution: 92, awakeningRate: 98 },
  colors: { primary: '#8b1f2e', secondary: '#3a2a1a', accent: '#e8c07a', hair: '#c4362f', aura: '#e8c07a', skin: '#f2ddc4' },
  visual: { height: 0.98, bulk: 1.0, hairStyle: 'short', weapon: 'none', cape: true, markings: 'seal' },
  tags: ['starter', 'jinchuriki', 'kage', 'sand'],
});

complete('itachi', 'Itachi Uchiha', {
  era: 'shippuden', village: 'leaf', clan: 'uchiha', organization: 'akatsuki',
  rank: 'rogue', archetype: 'counter', difficulty: 5,
  chakraNatures: ['fire', 'water', 'wind', 'yin'],
  description: 'Built entirely around counters, clones and unblockable genjutsu. Punishing to play, devastating when read correctly.',
  passiveAbilities: ['Deception — successful counters restore 12 chakra.'],
  transformations: TF.ITACHI_CHAIN,
  summons: ['summon_kisame'],
  aiProfile: 'itachi',
  unlockRequirement: { type: 'story', value: 'chapter_3' },
  stats: { health: 940, chakra: 118, attack: 104, defense: 96, speed: 110, chakraControl: 124, guard: 110, substitution: 118, awakeningRate: 104 },
  colors: { primary: '#1b1e2b', secondary: '#7a1a2a', accent: '#ff4a4a', hair: '#2a2a35', aura: '#ff5a3a', skin: '#e6cdb4' },
  visual: { height: 1.03, bulk: 0.94, hairStyle: 'ponytail', weapon: 'kunai', cape: true, markings: 'none' },
  tags: ['akatsuki', 'uchiha', 'genjutsu', 'susanoo'],
});

complete('pain', 'Pain', {
  era: 'shippuden', village: 'rain', clan: 'uzumaki', organization: 'akatsuki',
  rank: 'leader', archetype: 'ranged', difficulty: 4,
  chakraNatures: ['yin', 'yang', 'yinyang'],
  description: 'Owns the space you want to stand in. Almighty Push clears the screen, Universal Pull drags you back, and jumping is a mistake.',
  passiveAbilities: ['Six Paths Vision — projectiles gain 15% extra tracking.'],
  transformations: TF.PAIN_CHAIN,
  summons: ['summon_konan'],
  aiProfile: 'pain',
  unlockRequirement: { type: 'story', value: 'chapter_4' },
  stats: { health: 1000, chakra: 122, attack: 100, defense: 102, speed: 92, chakraControl: 126, guard: 108, substitution: 96, awakeningRate: 100 },
  colors: { primary: '#3a2a3f', secondary: '#1a1620', accent: '#c8a8ff', hair: '#d8683a', aura: '#a08adc', skin: '#e0d0c4' },
  visual: { height: 1.04, bulk: 1.02, hairStyle: 'spiky', weapon: 'none', cape: true, markings: 'none' },
  tags: ['akatsuki', 'rinnegan', 'boss'],
});

complete('madara', 'Madara Uchiha', {
  era: 'war', village: 'leaf', clan: 'uchiha', organization: 'akatsuki',
  rank: 'legend', archetype: 'transformation', difficulty: 5,
  chakraNatures: ['fire', 'wind', 'lightning', 'earth', 'water', 'wood', 'yin', 'yang', 'yinyang'],
  description: 'Six transformation stages, armour on nearly everything, and enormous reach. The game\'s benchmark boss character.',
  passiveAbilities: ['Uchiha Pride — awakening builds 25% faster while below 50% health.'],
  transformations: TF.MADARA_CHAIN,
  summons: ['summon_susanoo'],
  aiProfile: 'madara',
  unlockRequirement: { type: 'story', value: 'chapter_6' },
  stats: { health: 1080, chakra: 118, attack: 110, defense: 108, speed: 100, chakraControl: 114, guard: 112, substitution: 96, awakeningRate: 130 },
  colors: { primary: '#2a2230', secondary: '#6a1a2a', accent: '#ff2a5a', hair: '#171720', aura: '#9a5aff', skin: '#e6cdb4' },
  visual: { height: 1.08, bulk: 1.08, hairStyle: 'wild', weapon: 'fan', cape: true, markings: 'none' },
  tags: ['uchiha', 'boss', 'legend', 'ten-tails'],
});

complete('boruto', 'Boruto Uzumaki', {
  era: 'boruto', village: 'leaf', clan: 'uzumaki', organization: 'team-seven-next',
  rank: 'genin', archetype: 'rushdown', difficulty: 2,
  chakraNatures: ['wind', 'lightning', 'water'],
  description: 'The fastest ultimate start-up in the roster, an invisible Rasengan and the quickest projectile in the game.',
  passiveAbilities: ['Jougan Flicker — dashes have 4 extra invulnerable frames.'],
  transformations: TF.BORUTO_CHAIN,
  summons: ['summon_sarada', 'summon_mitsuki'],
  aiProfile: 'boruto',
  unlockRequirement: { type: 'default' },
  stats: { health: 950, chakra: 108, attack: 98, defense: 92, speed: 120, chakraControl: 108, guard: 96, substitution: 110, awakeningRate: 114 },
  colors: { primary: '#2f4f8f', secondary: '#1a2c50', accent: '#7fd4ff', hair: '#ffdf7a', aura: '#9a4aff', skin: '#f0cfae' },
  visual: { height: 0.94, bulk: 0.90, hairStyle: 'spiky', weapon: 'kunai', cape: false, markings: 'none' },
  tags: ['starter', 'karma', 'next-gen', 'protagonist'],
});

complete('kawaki', 'Kawaki', {
  era: 'boruto', village: 'leaf', clan: 'none', organization: 'kara',
  rank: 'vessel', archetype: 'grappler', difficulty: 3,
  chakraNatures: ['none'],
  description: 'Body-modification bruiser. Long blade pokes, armoured pistons and the best absorb window in the game.',
  passiveAbilities: ['Vessel Body — absorbing a jutsu refunds 1.4× its chakra cost.'],
  transformations: TF.KAWAKI_CHAIN,
  summons: ['summon_delta'],
  aiProfile: 'kawaki',
  unlockRequirement: { type: 'story', value: 'chapter_7' },
  stats: { health: 1090, chakra: 96, attack: 114, defense: 110, speed: 96, chakraControl: 92, guard: 110, substitution: 92, awakeningRate: 112 },
  colors: { primary: '#4a4a52', secondary: '#26262e', accent: '#c78cff', hair: '#1d1d24', aura: '#8a3add', skin: '#dcc4ae' },
  visual: { height: 1.03, bulk: 1.06, hairStyle: 'short', weapon: 'blades', cape: false, markings: 'seal' },
  tags: ['karma', 'next-gen', 'kara'],
});

complete('momoshiki', 'Momoshiki Otsutsuki', {
  era: 'boruto', village: 'none', clan: 'otsutsuki', organization: 'otsutsuki',
  rank: 'boss', archetype: 'counter', difficulty: 5,
  chakraNatures: ['fire', 'water', 'earth', 'wind', 'lightning', 'yinyang'],
  description: 'Absorbs your jutsu and gives it back amplified. Playing ranged against him is a losing plan.',
  passiveAbilities: ['Rinnegan Palms — a stored jutsu boosts the next ranged attack by 40%.'],
  transformations: TF.MOMOSHIKI_CHAIN,
  summons: ['summon_kinshiki'],
  aiProfile: 'momoshiki',
  unlockRequirement: { type: 'arcade', value: 1 },
  stats: { health: 1020, chakra: 126, attack: 106, defense: 104, speed: 104, chakraControl: 128, guard: 110, substitution: 100, awakeningRate: 106 },
  colors: { primary: '#e8e2ee', secondary: '#7a2a5a', accent: '#ff5aa0', hair: '#f2eef8', aura: '#ff5aa0', skin: '#efe6f2' },
  visual: { height: 1.06, bulk: 0.96, hairStyle: 'long', weapon: 'none', cape: true, markings: 'stripes' },
  tags: ['otsutsuki', 'boss', 'absorb'],
});

complete('minato', 'Minato Namikaze', {
  era: 'classic', village: 'leaf', clan: 'namikaze', organization: 'leaf-village',
  rank: 'kage', archetype: 'counter', difficulty: 4,
  chakraNatures: ['wind', 'lightning', 'yin', 'yang'],
  description: 'Mark them, then teleport on top of them. The fastest movement in the roster and a counter for almost anything.',
  passiveAbilities: ['Yellow Flash — dash start-up is 2 frames faster than anyone else.'],
  transformations: TF.MINATO_CHAIN,
  summons: ['summon_gamabunta'],
  aiProfile: 'minato',
  unlockRequirement: { type: 'level', value: 8 },
  stats: { health: 970, chakra: 114, attack: 102, defense: 96, speed: 126, chakraControl: 120, guard: 102, substitution: 116, awakeningRate: 104 },
  colors: { primary: '#e8e0cc', secondary: '#2f4f8f', accent: '#ffe58a', hair: '#ffd85e', aura: '#ffd75a', skin: '#f0cfae' },
  visual: { height: 1.04, bulk: 0.98, hairStyle: 'spiky', weapon: 'kunai', cape: true, markings: 'none' },
  tags: ['hokage', 'teleport', 'legend'],
});

complete('hashirama', 'Hashirama Senju', {
  era: 'ancient', village: 'leaf', clan: 'senju', organization: 'leaf-village',
  rank: 'kage', archetype: 'summoner', difficulty: 4,
  chakraNatures: ['wood', 'water', 'earth', 'yang'],
  description: 'Reshapes the arena with wood and outlasts anyone. The best sustain and the largest area attacks in the game.',
  passiveAbilities: ['Senju Vitality — regenerates 4 health per second at all times.'],
  transformations: TF.HASHIRAMA_CHAIN,
  summons: ['summon_wood_clone'],
  aiProfile: 'hashirama',
  unlockRequirement: { type: 'level', value: 12 },
  stats: { health: 1140, chakra: 124, attack: 104, defense: 118, speed: 92, chakraControl: 122, guard: 118, substitution: 94, awakeningRate: 100 },
  colors: { primary: '#8a2f2f', secondary: '#3f2a1a', accent: '#a8e07a', hair: '#2a2018', aura: '#a8e07a', skin: '#e8c6a0' },
  visual: { height: 1.07, bulk: 1.10, hairStyle: 'long', weapon: 'none', cape: true, markings: 'none' },
  tags: ['hokage', 'wood-style', 'legend', 'sage'],
});

complete('guy', 'Might Guy', {
  era: 'shippuden', village: 'leaf', clan: 'none', organization: 'team-guy',
  rank: 'jonin', archetype: 'rushdown', difficulty: 4,
  chakraNatures: ['none'],
  description: 'Eight gates. Every one past the third costs health, and the eighth may well kill you — but Night Guy hits harder than anything else in the game.',
  passiveAbilities: ['Gate Discipline — health drain from gates is 20% lower than Lee\'s.'],
  transformations: TF.GUY_CHAIN,
  summons: ['summon_lee'],
  aiProfile: 'guy',
  unlockRequirement: { type: 'level', value: 6 },
  stats: { health: 1060, chakra: 82, attack: 114, defense: 100, speed: 118, chakraControl: 62, guard: 102, substitution: 104, awakeningRate: 124 },
  colors: { primary: '#2fa85a', secondary: '#1c6b3a', accent: '#7fe0ff', hair: '#1a1a20', aura: '#ff3a2a', skin: '#e0b890' },
  visual: { height: 1.05, bulk: 1.12, hairStyle: 'bowl', weapon: 'none', cape: false, markings: 'none' },
  tags: ['taijutsu', 'eight-gates', 'jonin'],
});

complete('bee', 'Killer Bee', {
  era: 'shippuden', village: 'cloud', clan: 'none', organization: 'cloud-village',
  rank: 'jonin', archetype: 'weapon', difficulty: 4,
  chakraNatures: ['lightning', 'water'],
  description: 'Seven swords held in places swords should not be held. Unpredictable multi-hit strings that are very hard to guard on reaction.',
  passiveAbilities: ['Acrobat Stance — multi-hit strings do 10% less guard damage but 15% more on hit.'],
  transformations: TF.BEE_CHAIN,
  summons: ['summon_gyuki'],
  aiProfile: 'bee',
  unlockRequirement: { type: 'level', value: 10 },
  stats: { health: 1070, chakra: 104, attack: 108, defense: 106, speed: 108, chakraControl: 98, guard: 104, substitution: 100, awakeningRate: 112 },
  colors: { primary: '#e8e4d8', secondary: '#3a3f4a', accent: '#c0a8ff', hair: '#f0f0f0', aura: '#8a6ad8', skin: '#7a5a42' },
  visual: { height: 1.09, bulk: 1.14, hairStyle: 'braided', weapon: 'sword', cape: false, markings: 'stripes' },
  tags: ['jinchuriki', 'cloud', 'swordsman'],
});

complete('obito', 'Obito Uchiha', {
  era: 'war', village: 'leaf', clan: 'uchiha', organization: 'akatsuki',
  rank: 'rogue', archetype: 'counter', difficulty: 5,
  chakraNatures: ['fire', 'water', 'wind', 'earth', 'lightning', 'yin', 'yang'],
  description: 'The longest intangibility window in the game. Phase through the punish, hook them back with rods, repeat.',
  passiveAbilities: ['Intangible — the first 4 frames of every dash are invulnerable.'],
  transformations: TF.OBITO_CHAIN,
  summons: ['summon_zetsu'],
  aiProfile: 'obito',
  unlockRequirement: { type: 'story', value: 'chapter_8' },
  stats: { health: 1010, chakra: 116, attack: 104, defense: 100, speed: 110, chakraControl: 118, guard: 106, substitution: 120, awakeningRate: 108 },
  colors: { primary: '#2a2230', secondary: '#5a1a2a', accent: '#b57bff', hair: '#2a2a35', aura: '#c8b0ff', skin: '#dcc0a4' },
  visual: { height: 1.04, bulk: 1.02, hairStyle: 'spiky', weapon: 'staff', cape: true, markings: 'none' },
  tags: ['akatsuki', 'uchiha', 'kamui', 'boss'],
});

complete('jiraiya', 'Jiraiya', {
  era: 'shippuden', village: 'leaf', clan: 'none', organization: 'leaf-village',
  rank: 'sannin', archetype: 'zoning', difficulty: 3,
  chakraNatures: ['fire', 'earth', 'water', 'wind', 'yin', 'yang'],
  description: 'Traps and terrain first, sage brawling second. The Swamp slows you to a crawl and Frog Song is unblockable across the whole arena.',
  passiveAbilities: ['Toad Sage — status effects Jiraiya applies last 25% longer.'],
  transformations: TF.JIRAIYA_CHAIN,
  summons: ['summon_gamabunta'],
  aiProfile: 'jiraiya',
  unlockRequirement: { type: 'level', value: 4 },
  stats: { health: 1060, chakra: 118, attack: 102, defense: 106, speed: 94, chakraControl: 118, guard: 108, substitution: 98, awakeningRate: 100 },
  colors: { primary: '#c8362f', secondary: '#3a5a2a', accent: '#f2c46a', hair: '#e8e4d8', aura: '#f2c46a', skin: '#e8c6a0' },
  visual: { height: 1.08, bulk: 1.12, hairStyle: 'wild', weapon: 'none', cape: false, markings: 'stripes' },
  tags: ['sannin', 'sage', 'legend'],
});

complete('orochimaru', 'Orochimaru', {
  era: 'shippuden', village: 'sound', clan: 'none', organization: 'otogakure',
  rank: 'sannin', archetype: 'defensive', difficulty: 4,
  chakraNatures: ['fire', 'wind', 'lightning', 'earth', 'water', 'yin', 'yang'],
  description: 'Poison chip, the strongest armour buff in the game, and a full heal that clears every debuff. Very hard to actually finish off.',
  passiveAbilities: ['Immortality — the first time Orochimaru would drop below 1 health each round, he survives at 1.'],
  transformations: TF.OROCHIMARU_CHAIN,
  summons: ['summon_manda'],
  aiProfile: 'orochimaru',
  unlockRequirement: { type: 'level', value: 9 },
  stats: { health: 1060, chakra: 120, attack: 100, defense: 116, speed: 100, chakraControl: 124, guard: 118, substitution: 112, awakeningRate: 98 },
  colors: { primary: '#c8c0a8', secondary: '#4a2a5a', accent: '#9ac070', hair: '#2a2a35', aura: '#c8e0a0', skin: '#eae4d0' },
  visual: { height: 1.05, bulk: 0.94, hairStyle: 'long', weapon: 'sword', cape: false, markings: 'none' },
  tags: ['sannin', 'sound', 'poison'],
});

complete('tsunade', 'Tsunade', {
  era: 'shippuden', village: 'leaf', clan: 'senju', organization: 'leaf-village',
  rank: 'kage', archetype: 'grappler', difficulty: 3,
  chakraNatures: ['earth', 'water', 'yin', 'yang'],
  description: 'The heaviest hitter in the roster with the strongest sustained heal. Slow — every whiff is a full punish.',
  passiveAbilities: ['Hundred Strength — critical hits (heavy attacks on a launched opponent) do +25%.'],
  transformations: TF.TSUNADE_CHAIN,
  summons: ['summon_katsuyu'],
  aiProfile: 'tsunade',
  unlockRequirement: { type: 'level', value: 7 },
  stats: { health: 1150, chakra: 110, attack: 122, defense: 112, speed: 86, chakraControl: 120, guard: 108, substitution: 92, awakeningRate: 98 },
  colors: { primary: '#3a8a6a', secondary: '#e8e0cc', accent: '#ff9ab8', hair: '#f0e08a', aura: '#ff9ab8', skin: '#f4d8c0' },
  visual: { height: 1.02, bulk: 1.0, hairStyle: 'ponytail', weapon: 'none', cape: true, markings: 'seal' },
  tags: ['sannin', 'hokage', 'medic', 'byakugo'],
});

/* -------------------------------------------------------------------------- */
/* Prototype roster                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Register a prototype fighter. Full metadata + a generic single-stage
 * awakening; moves come from the archetype template and the UI labels it.
 */
function proto(id, name, c) {
  const forms = c.transformations
    || TF.genericAwakening(id, { displayName: c.awakeningName, ...(c.awakeningOpts || {}) });
  return defineFighter(id, name, {
    era: c.e, village: c.v || 'unaffiliated', clan: c.c || 'none',
    organization: c.o || 'none', rank: c.rank || 'jonin', archetype: c.a,
    difficulty: c.d ?? 3,
    chakraNatures: c.n || ['none'],
    description: c.desc || '',
    passiveAbilities: c.passive ? [c.passive] : [],
    transformations: forms,
    summons: c.summons || [],
    aiProfile: c.ai || c.a,
    unlockRequirement: c.unlock || { type: 'level', value: 2 },
    stats: c.stats,
    colors: c.colors,
    visual: c.visual,
    tags: c.tags || [],
  });
}

/* --- Team Seven support --------------------------------------------------- */
proto('sai', 'Sai', { e: 'shippuden', v: 'leaf', o: 'root', a: 'ranged', d: 3, n: ['yin'], ai: 'zoner', unlock: { type: 'level', value: 3 }, desc: 'Ink constructs and aerial harassment.', tags: ['root', 'ink'] });
proto('yamato', 'Yamato', { e: 'shippuden', v: 'leaf', o: 'anbu', a: 'defensive', d: 3, n: ['wood', 'water', 'earth'], ai: 'turtle', unlock: { type: 'level', value: 3 }, desc: 'Wood-style walls and suppression.', tags: ['wood-style', 'anbu'] });

/* --- Leaf ----------------------------------------------------------------- */
proto('shikamaru', 'Shikamaru Nara', { e: 'shippuden', v: 'leaf', c: 'nara', a: 'zoning', d: 4, n: ['yin'], ai: 'trapper', desc: 'Shadow traps and setups.', tags: ['nara', 'strategist'] });
proto('choji', 'Choji Akimichi', { e: 'shippuden', v: 'leaf', c: 'akimichi', a: 'grappler', d: 2, n: ['earth', 'yang'], ai: 'bruiser', desc: 'Expansion jutsu and rolling pressure.', tags: ['akimichi'] });
proto('ino', 'Ino Yamanaka', { e: 'shippuden', v: 'leaf', c: 'yamanaka', a: 'support', d: 3, n: ['yin'], ai: 'zoner', desc: 'Mind transfer disruption.', tags: ['yamanaka'] });
proto('kiba', 'Kiba Inuzuka', { e: 'shippuden', v: 'leaf', c: 'inuzuka', a: 'rushdown', d: 2, n: ['none'], ai: 'rusher', summons: ['summon_akamaru'], desc: 'Fang Over Fang with Akamaru.', tags: ['inuzuka'] });
proto('hinata', 'Hinata Hyuga', { e: 'shippuden', v: 'leaf', c: 'hyuga', a: 'counter', d: 3, n: ['none'], ai: 'counter', desc: 'Gentle Fist chakra denial.', tags: ['hyuga', 'byakugan'] });
proto('neji', 'Neji Hyuga', { e: 'shippuden', v: 'leaf', c: 'hyuga', a: 'counter', d: 4, n: ['none'], ai: 'counter', desc: 'Eight Trigrams rotation and palm strings.', tags: ['hyuga', 'byakugan'] });
proto('tenten', 'Tenten', { e: 'shippuden', v: 'leaf', o: 'team-guy', a: 'weapon', d: 3, n: ['none'], ai: 'zoner', desc: 'Scroll-summoned weapon barrages.', tags: ['weapons'] });
proto('shino', 'Shino Aburame', { e: 'shippuden', v: 'leaf', c: 'aburame', a: 'zoning', d: 4, n: ['none'], ai: 'trapper', desc: 'Insect swarms that drain chakra.', tags: ['aburame'] });
proto('iruka', 'Iruka Umino', { e: 'classic', v: 'leaf', a: 'balanced', d: 1, n: ['water'], rank: 'chunin', unlock: { type: 'default' }, desc: 'Academy fundamentals — a good place to learn the system.', tags: ['academy', 'starter'] });
proto('asuma', 'Asuma Sarutobi', { e: 'shippuden', v: 'leaf', c: 'sarutobi', a: 'weapon', d: 3, n: ['wind', 'fire'], desc: 'Wind-charged trench knives.', tags: ['sarutobi'] });
proto('kurenai', 'Kurenai Yuhi', { e: 'shippuden', v: 'leaf', a: 'zoning', d: 3, n: ['yin'], desc: 'Genjutsu illusions and misdirection.', tags: ['genjutsu'] });
proto('konohamaru', 'Konohamaru Sarutobi', { e: 'boruto', v: 'leaf', c: 'sarutobi', a: 'balanced', d: 2, n: ['fire', 'wind'], desc: 'A Rasengan of his own.', tags: ['sarutobi', 'next-gen'] });
proto('ebisu', 'Ebisu', { e: 'classic', v: 'leaf', a: 'support', d: 1, n: ['earth'], desc: 'Elite tutor. Solid fundamentals, no flash.', tags: ['academy'] });

/* --- Hokage and Leaf legends ---------------------------------------------- */
proto('tobirama', 'Tobirama Senju', { e: 'ancient', v: 'leaf', c: 'senju', a: 'ranged', d: 4, n: ['water', 'lightning', 'yin', 'yang'], rank: 'kage', ai: 'zoner', unlock: { type: 'level', value: 11 }, desc: 'Water walls, flying-raijin markers and reanimation.', tags: ['hokage', 'senju', 'legend'] });
proto('hiruzen', 'Hiruzen Sarutobi', { e: 'classic', v: 'leaf', c: 'sarutobi', a: 'summoner', d: 4, n: ['fire', 'wind', 'lightning', 'earth', 'water', 'yin', 'yang'], rank: 'kage', unlock: { type: 'level', value: 10 }, desc: 'The Professor. Every nature, plus Enma.', summons: ['summon_enma'], tags: ['hokage', 'legend'] });
proto('shisui', 'Shisui Uchiha', { e: 'classic', v: 'leaf', c: 'uchiha', a: 'rushdown', d: 4, n: ['fire', 'lightning', 'yin'], unlock: { type: 'level', value: 13 }, desc: 'Body-flicker rushdown and Kotoamatsukami.', tags: ['uchiha', 'sharingan'] });
proto('fugaku', 'Fugaku Uchiha', { e: 'classic', v: 'leaf', c: 'uchiha', a: 'balanced', d: 3, n: ['fire', 'yin'], desc: 'Uchiha clan head.', tags: ['uchiha'] });
proto('izuna', 'Izuna Uchiha', { e: 'ancient', v: 'leaf', c: 'uchiha', a: 'weapon', d: 4, n: ['fire', 'yin'], unlock: { type: 'level', value: 14 }, desc: 'Madara\'s brother. Blade-first Sharingan duellist.', tags: ['uchiha', 'ancient'] });
proto('danzo', 'Danzo Shimura', { e: 'shippuden', v: 'leaf', o: 'root', a: 'transformation', d: 5, n: ['wind', 'fire', 'water', 'yin', 'yang'], unlock: { type: 'story', value: 'chapter_5' }, desc: 'Izanagi rewrites his mistakes — for a price.', tags: ['root', 'sharingan'] });

/* --- Akatsuki -------------------------------------------------------------- */
proto('nagato', 'Nagato', { e: 'shippuden', v: 'rain', c: 'uzumaki', o: 'akatsuki', a: 'summoner', d: 5, n: ['yin', 'yang', 'yinyang'], unlock: { type: 'story', value: 'chapter_4' }, desc: 'The true body behind Pain. Frail, enormous range.', tags: ['akatsuki', 'rinnegan'] });
proto('konan', 'Konan', { e: 'shippuden', v: 'rain', o: 'akatsuki', a: 'aerial', d: 3, n: ['wind', 'yang'], desc: 'Paper wings, paper blades, paper bombs.', tags: ['akatsuki'] });
proto('kisame', 'Kisame Hoshigaki', { e: 'shippuden', v: 'mist', o: 'akatsuki', a: 'weapon', d: 3, n: ['water'], desc: 'Samehada drains chakra on contact.', tags: ['akatsuki', 'swordsman', 'mist'] });
proto('deidara', 'Deidara', { e: 'shippuden', v: 'stone', o: 'akatsuki', a: 'aerial', d: 3, n: ['earth', 'explosion'], desc: 'Explosive clay from above.', tags: ['akatsuki', 'explosion'] });
proto('sasori', 'Sasori', { e: 'shippuden', v: 'sand', o: 'akatsuki', a: 'puppet', d: 4, n: ['none'], desc: 'Poisoned puppets at every range.', tags: ['akatsuki', 'puppet', 'sand'] });
proto('hidan', 'Hidan', { e: 'shippuden', v: 'hotsprings', o: 'akatsuki', a: 'grappler', d: 4, n: ['none'], desc: 'Curse ritual: damage he takes is damage you take.', tags: ['akatsuki', 'immortal'] });
proto('kakuzu', 'Kakuzu', { e: 'shippuden', v: 'waterfall', o: 'akatsuki', a: 'transformation', d: 4, n: ['fire', 'wind', 'lightning', 'earth', 'water'], desc: 'Five hearts, five masks, five elements.', tags: ['akatsuki', 'immortal'] });

/* --- Early / Shippuden villains -------------------------------------------- */
proto('zabuza', 'Zabuza Momochi', { e: 'classic', v: 'mist', a: 'weapon', d: 2, n: ['water'], unlock: { type: 'default' }, desc: 'Hidden Mist and a very large sword.', tags: ['swordsman', 'mist', 'starter'] });
proto('haku', 'Haku', { e: 'classic', v: 'mist', a: 'aerial', d: 3, n: ['ice', 'water', 'wind'], unlock: { type: 'default' }, desc: 'Demonic ice mirrors and needle mix-ups.', tags: ['ice', 'mist', 'starter'] });
proto('kimimaro', 'Kimimaro', { e: 'classic', v: 'sound', c: 'kaguya', o: 'otogakure', a: 'weapon', d: 4, n: ['none'], desc: 'Bone Release. Weapons grow out of him.', tags: ['sound', 'bone'] });
proto('kabuto', 'Kabuto Yakushi', { e: 'shippuden', v: 'sound', o: 'otogakure', a: 'healer', d: 4, n: ['yin', 'yang'], transformations: TF.KABUTO_CHAIN, desc: 'Chakra scalpels and Snake Sage Mode.', tags: ['medic', 'sound', 'sage'] });
proto('jugo', 'Jugo', { e: 'shippuden', v: 'sound', o: 'taka', a: 'transformation', d: 3, n: ['none'], desc: 'Sage transformation berserker.', tags: ['taka', 'sound'] });
proto('suigetsu', 'Suigetsu Hozuki', { e: 'shippuden', v: 'mist', c: 'hozuki', o: 'taka', a: 'weapon', d: 3, n: ['water'], desc: 'Liquefies to avoid damage.', tags: ['taka', 'mist', 'swordsman'] });
proto('karin', 'Karin Uzumaki', { e: 'shippuden', v: 'sound', c: 'uzumaki', o: 'taka', a: 'healer', d: 2, n: ['none'], desc: 'Sensory support and bite healing.', tags: ['taka', 'uzumaki'] });
proto('hanzo', 'Hanzo', { e: 'classic', v: 'rain', a: 'weapon', d: 4, n: ['fire', 'water'], desc: 'Salamander poison and a kusarigama.', tags: ['rain', 'legend'] });

/* --- Sound Four ------------------------------------------------------------ */
proto('jirobo', 'Jirobo', { e: 'classic', v: 'sound', o: 'sound-four', a: 'grappler', d: 2, n: ['earth'], desc: 'Earth Release absorption tank.', tags: ['sound-four'] });
proto('kidomaru', 'Kidomaru', { e: 'classic', v: 'sound', o: 'sound-four', a: 'ranged', d: 3, n: ['none'], desc: 'Spider webs and armour-piercing arrows.', tags: ['sound-four'] });
proto('tayuya', 'Tayuya', { e: 'classic', v: 'sound', o: 'sound-four', a: 'summoner', d: 3, n: ['yin'], desc: 'Flute genjutsu and three summoned giants.', tags: ['sound-four'] });
proto('sakon', 'Sakon and Ukon', { e: 'classic', v: 'sound', o: 'sound-four', a: 'counter', d: 3, n: ['none'], desc: 'Two bodies sharing one form.', tags: ['sound-four'] });

/* --- Jinchuriki ------------------------------------------------------------ */
proto('yugito', 'Yugito Nii', { e: 'shippuden', v: 'cloud', a: 'transformation', d: 3, n: ['fire', 'lightning'], desc: 'Two-Tails blue flame claws.', tags: ['jinchuriki', 'cloud'] });
proto('yagura', 'Yagura Karatachi', { e: 'shippuden', v: 'mist', a: 'transformation', d: 4, n: ['water'], rank: 'kage', desc: 'Three-Tails jinchuriki and Fourth Mizukage.', tags: ['jinchuriki', 'kage', 'mist'] });
proto('roshi', 'Roshi', { e: 'shippuden', v: 'stone', a: 'transformation', d: 3, n: ['lava', 'fire', 'earth'], desc: 'Four-Tails Lava Release.', tags: ['jinchuriki', 'stone'] });
proto('han', 'Han', { e: 'shippuden', v: 'stone', a: 'grappler', d: 3, n: ['boil', 'fire', 'water'], desc: 'Five-Tails steam armour.', tags: ['jinchuriki', 'stone'] });
proto('utakata', 'Utakata', { e: 'shippuden', v: 'mist', a: 'zoning', d: 3, n: ['water'], desc: 'Six-Tails bubble techniques.', tags: ['jinchuriki', 'mist'] });
proto('fu', 'Fu', { e: 'shippuden', v: 'waterfall', a: 'aerial', d: 3, n: ['yang'], desc: 'Seven-Tails flight and scale dust.', tags: ['jinchuriki', 'waterfall'] });

/* --- Tailed beasts (boss entries) ------------------------------------------ */
const BEAST_UNLOCK = { type: 'bossrush', value: 1 };

/* --- Kage ------------------------------------------------------------------ */
proto('rasa', 'Rasa', { e: 'classic', v: 'sand', a: 'zoning', d: 3, n: ['magnet', 'earth'], rank: 'kage', desc: 'Fourth Kazekage. Gold Dust control.', tags: ['kage', 'sand'] });
proto('raikage4', 'Fourth Raikage', { e: 'shippuden', v: 'cloud', a: 'rushdown', d: 4, n: ['lightning'], rank: 'kage', desc: 'Lightning armour. The fastest raw movement of the Kage.', tags: ['kage', 'cloud'] });
proto('darui', 'Darui', { e: 'shippuden', v: 'cloud', a: 'weapon', d: 3, n: ['lightning', 'water', 'storm'], rank: 'kage', desc: 'Storm Release beams.', tags: ['kage', 'cloud'] });
proto('mei', 'Mei Terumi', { e: 'shippuden', v: 'mist', a: 'ranged', d: 3, n: ['lava', 'boil', 'water', 'fire', 'earth'], rank: 'kage', desc: 'Fifth Mizukage. Lava and corrosive mist.', tags: ['kage', 'mist'] });
proto('chojuro', 'Chojuro', { e: 'boruto', v: 'mist', a: 'weapon', d: 3, n: ['water', 'lightning'], rank: 'kage', desc: 'Hiramekarei twin hammers.', tags: ['kage', 'mist', 'swordsman'] });
proto('onoki', 'Onoki', { e: 'shippuden', v: 'stone', a: 'ranged', d: 4, n: ['dust', 'earth', 'wind', 'lightning'], rank: 'kage', desc: 'Third Tsuchikage. Weight manipulation and Dust Release.', tags: ['kage', 'stone'] });
proto('kurotsuchi', 'Kurotsuchi', { e: 'boruto', v: 'stone', a: 'ranged', d: 3, n: ['lava', 'earth', 'water'], rank: 'kage', desc: 'Fourth Tsuchikage. Quicklime and lava.', tags: ['kage', 'stone'] });

/* --- Sand ------------------------------------------------------------------ */
proto('temari', 'Temari', { e: 'shippuden', v: 'sand', a: 'zoning', d: 2, n: ['wind'], unlock: { type: 'default' }, desc: 'Giant fan wind walls. Excellent starter zoner.', summons: ['summon_kamatari'], tags: ['sand', 'starter'] });
proto('kankuro', 'Kankuro', { e: 'shippuden', v: 'sand', a: 'puppet', d: 3, n: ['none'], desc: 'Three puppets, all poisoned.', tags: ['sand', 'puppet'] });
proto('chiyo', 'Chiyo', { e: 'shippuden', v: 'sand', a: 'puppet', d: 4, n: ['none'], desc: 'Ten-puppet control and the transmutation seal.', tags: ['sand', 'puppet', 'elder'] });

/* --- Mist / Seven Swordsmen ------------------------------------------------ */

/* --- Cloud ----------------------------------------------------------------- */
proto('omoi', 'Omoi', { e: 'boruto', v: 'cloud', a: 'weapon', d: 3, n: ['lightning'], desc: 'Overthinks everything, cuts anyway.', tags: ['cloud'] });
proto('samui', 'Samui', { e: 'shippuden', v: 'cloud', a: 'weapon', d: 2, n: ['water'], desc: 'Calm, efficient swordplay.', tags: ['cloud'] });

/* --- Stone ----------------------------------------------------------------- */

/* --- Next generation -------------------------------------------------------- */
proto('sarada', 'Sarada Uchiha', { e: 'boruto', v: 'leaf', c: 'uchiha', o: 'team-seven-next', a: 'balanced', d: 2, n: ['fire', 'lightning'], rank: 'genin', unlock: { type: 'default' }, desc: 'Sharingan plus Tsunade-style strength.', tags: ['next-gen', 'uchiha', 'starter'] });
proto('mitsuki', 'Mitsuki', { e: 'boruto', v: 'leaf', o: 'team-seven-next', a: 'transformation', d: 3, n: ['wind', 'lightning'], rank: 'genin', transformations: TF.MITSUKI_CHAIN, unlock: { type: 'default' }, desc: 'Synthetic human with a sage transformation.', tags: ['next-gen', 'starter'] });
proto('sumire', 'Sumire Kakei', { e: 'boruto', v: 'leaf', a: 'support', d: 3, n: ['water'], rank: 'genin', desc: 'Nue summoning and support.', tags: ['next-gen'] });

/* --- Adult era variants ----------------------------------------------------- */
const ADULT_UNLOCK = { type: 'story', value: 'chapter_9' };

/* --- Kara ------------------------------------------------------------------- */
proto('jigen', 'Jigen', { e: 'boruto', o: 'kara', a: 'counter', d: 5, n: ['none'], rank: 'boss', unlock: { type: 'story', value: 'chapter_10' }, desc: 'Kara\'s leader. Shrinks anything he touches.', tags: ['kara', 'boss'] });
proto('isshiki', 'Isshiki Otsutsuki', { e: 'boruto', c: 'otsutsuki', o: 'kara', a: 'counter', d: 5, n: ['none'], rank: 'boss', unlock: { type: 'story', value: 'chapter_10' }, desc: 'Rod manipulation and size shifting. Final-boss statline.', tags: ['kara', 'otsutsuki', 'boss', 'final'] });
proto('delta', 'Delta', { e: 'boruto', o: 'kara', a: 'ranged', d: 3, n: ['none'], desc: 'Cyborg eyes that absorb and return jutsu.', tags: ['kara'] });
proto('boro', 'Boro', { e: 'boruto', o: 'kara', a: 'grappler', d: 3, n: ['none'], desc: 'Regenerating tank with a virus mist.', tags: ['kara'] });
proto('koji', 'Koji Kashin', { e: 'boruto', o: 'kara', a: 'summoner', d: 4, n: ['fire'], desc: 'Toad summons and Sage-style flame.', tags: ['kara'] });
proto('code', 'Code', { e: 'boruto', o: 'kara', a: 'rushdown', d: 4, n: ['none'], desc: 'Claw marks that open portals.', tags: ['kara'] });
proto('daemon', 'Daemon', { e: 'boruto', o: 'kara', a: 'counter', d: 4, n: ['none'], desc: 'Reflects any attack made with intent to harm.', tags: ['kara'] });
proto('eida', 'Eida', { e: 'boruto', o: 'kara', a: 'support', d: 3, n: ['none'], desc: 'Omniscience and enchantment.', tags: ['kara'] });
proto('victor', 'Victor', { e: 'boruto', o: 'kara', a: 'grappler', d: 2, n: ['none'], desc: 'Kara inner with modified strength.', tags: ['kara'] });
proto('deepa', 'Deepa', { e: 'boruto', o: 'kara', a: 'defensive', d: 3, n: ['none'], desc: 'Carbon body — nearly unbreakable defence.', tags: ['kara'] });

/* --- Otsutsuki -------------------------------------------------------------- */
proto('kaguya', 'Kaguya Otsutsuki', { e: 'ancient', c: 'otsutsuki', o: 'otsutsuki', a: 'transformation', d: 5, n: ['yinyang'], rank: 'boss', unlock: { type: 'story', value: 'chapter_10' }, desc: 'Dimension shifting and expansive truth-seeking control. Final-boss statline.', tags: ['otsutsuki', 'boss', 'final'] });
proto('hagoromo', 'Hagoromo Otsutsuki', { e: 'ancient', c: 'otsutsuki', a: 'summoner', d: 5, n: ['yinyang'], rank: 'legend', unlock: { type: 'level', value: 20 }, desc: 'The Sage of Six Paths.', tags: ['otsutsuki', 'legend'] });
proto('hamura', 'Hamura Otsutsuki', { e: 'ancient', c: 'otsutsuki', a: 'counter', d: 5, n: ['yinyang'], rank: 'legend', unlock: { type: 'level', value: 20 }, desc: 'Tenseigan gentle fist.', tags: ['otsutsuki', 'legend'] });
proto('toneri', 'Toneri Otsutsuki', { e: 'blank-period', c: 'otsutsuki', a: 'counter', d: 4, n: ['yinyang'], desc: 'Tenseigan and golem control.', tags: ['otsutsuki'] });
proto('kinshiki', 'Kinshiki Otsutsuki', { e: 'boruto', c: 'otsutsuki', o: 'otsutsuki', a: 'weapon', d: 4, n: ['yinyang'], desc: 'Converts chakra into an enormous blade.', tags: ['otsutsuki'] });
proto('urashiki', 'Urashiki Otsutsuki', { e: 'boruto', c: 'otsutsuki', o: 'otsutsuki', a: 'zoning', d: 4, n: ['yinyang'], desc: 'Time-shifting fishing rod. Steals chakra at range.', tags: ['otsutsuki'] });

/* --- Movie and bonus -------------------------------------------------------- */
const BONUS_UNLOCK = { type: 'coins', value: 4000 };
proto('menma', 'Menma Uzumaki', { e: 'blank-period', v: 'leaf', c: 'uzumaki', a: 'transformation', d: 4, n: ['wind', 'yin'], unlock: BONUS_UNLOCK, desc: 'Alternate-world Naruto. Dark Nine-Tails chakra.', tags: ['bonus', 'alternate'] });

/* --- Hyuga main house ------------------------------------------------------ */
proto('hanabi', 'Hanabi Hyuga', { e: 'boruto', v: 'leaf', c: 'hyuga', a: 'counter', d: 3, n: ['none'], ai: 'counter', desc: 'Gentle Fist heir. Faster palm strings than her sister, less reach.', tags: ['hyuga', 'byakugan'] });
proto('hiashi', 'Hiashi Hyuga', { e: 'shippuden', v: 'leaf', c: 'hyuga', a: 'counter', d: 4, n: ['none'], ai: 'counter', desc: 'Head of the main house. Textbook Eight Trigrams pressure.', tags: ['hyuga', 'byakugan'] });
proto('hizashi', 'Hizashi Hyuga', { e: 'classic', v: 'leaf', c: 'hyuga', a: 'counter', d: 4, n: ['none'], ai: 'counter', desc: 'Branch-house twin. Trades defence for reach.', tags: ['hyuga', 'byakugan'] });

/* --- Uzumaki --------------------------------------------------------------- */
proto('kushina', 'Kushina Uzumaki', { e: 'classic', v: 'leaf', c: 'uzumaki', a: 'zoning', d: 4, n: ['wind', 'yin'], ai: 'trapper', desc: 'Adamantine sealing chains. Locks a fighter down and punishes the struggle.', tags: ['uzumaki', 'jinchuriki'] });

/* --- Sand ------------------------------------------------------------------ */
proto('pakura', 'Pakura', { e: 'classic', v: 'sand', a: 'ranged', d: 3, n: ['scorch'], ai: 'zoner', desc: 'Scorch Release. Drains a target dry at mid range.', tags: ['sand', 'scorch'] });

/* --- Zetsu ----------------------------------------------------------------- */
proto('white_zetsu', 'White Zetsu', { e: 'war', o: 'akatsuki', a: 'support', d: 3, n: ['wood'], ai: 'trapper', desc: 'Clones, burrows and copies. Attrition rather than damage.', tags: ['akatsuki', 'zetsu'] });
proto('black_zetsu', 'Black Zetsu', { e: 'war', o: 'akatsuki', a: 'counter', d: 4, n: ['yin'], ai: 'counter', desc: 'Latches on, steers the fight and turns your own move against you.', tags: ['akatsuki', 'zetsu'] });

/* --- Boruto generation ------------------------------------------------------ */
proto('shinki', 'Shinki', { e: 'boruto', v: 'sand', a: 'zoning', d: 4, n: ['magnet'], ai: 'trapper', desc: 'Iron Sand. Gaara\u2019s successor, with a harder edge.', tags: ['sand', 'magnet'] });
proto('mirai', 'Mirai Sarutobi', { e: 'boruto', v: 'leaf', c: 'sarutobi', a: 'weapon', d: 3, n: ['fire', 'yin'], ai: 'zoner', desc: 'Chakra blades and genjutsu. Asuma\u2019s daughter.', tags: ['sarutobi'] });
proto('kagura', 'Kagura Karatachi', { e: 'boruto', v: 'mist', a: 'weapon', d: 4, n: ['water'], ai: 'counter', desc: 'Hiramekarei. Precise, defensive swordwork.', tags: ['mist', 'swordsman'] });
proto('buntan', 'Buntan Kurosuki', { e: 'boruto', v: 'mist', a: 'weapon', d: 3, n: ['lightning'], ai: 'rusher', desc: 'Kiba blades. All offence, no patience.', tags: ['mist', 'swordsman'] });

/* --- Special ---------------------------------------------------------------- */
proto('shin', 'Shin Uchiha', { e: 'blank-period', c: 'uchiha', a: 'weapon', d: 4, n: ['yin'], ai: 'zoner', unlock: BONUS_UNLOCK, desc: 'Grafted Sharingan and a swarm of blades.', tags: ['uchiha', 'bonus'] });

/**
 * The canonical roster order.
 *
 * Exactly these 110 people, once each. Alternate ages, costumes, titles,
 * masked and Edo versions, awakenings and tailed beasts are NOT roster cards —
 * they hang off their main fighter as costumes and transformations (see
 * js/data/costumes.js and js/data/transformations.js), and old save ids for
 * them are redirected by js/data/roster-migration.js.
 *
 * Declaring the order here rather than relying on definition order means the
 * select screen groups by village, and a fighter added or dropped without
 * updating this list fails a test instead of quietly changing the roster.
 */
export const ROSTER_ORDER = Object.freeze([
  // Leaf Village
  "naruto", "sasuke", "sakura", "kakashi", "sai", "yamato", "shikamaru",
  "choji", "ino", "hinata", "kiba", "shino", "neji", "lee", "tenten",
  "guy", "asuma", "kurenai", "ebisu", "iruka", "konohamaru", "hanabi",
  "hiashi", "hizashi",
  // Hokage, Sannin and Leaf legends
  "hashirama", "tobirama", "hiruzen", "minato", "tsunade", "jiraiya",
  "orochimaru", "kushina", "shisui", "fugaku", "izuna",
  // Sand
  "gaara", "temari", "kankuro", "chiyo", "pakura", "rasa",
  // Mist
  "zabuza", "haku", "chojuro", "mei", "kisame", "yagura", "suigetsu",
  // Cloud
  "bee", "raikage4", "darui", "omoi", "samui", "yugito",
  // Stone
  "onoki", "kurotsuchi", "deidara", "roshi", "han",
  // Akatsuki and major villains
  "itachi", "sasori", "kakuzu", "hidan", "konan", "pain", "nagato",
  "obito", "white_zetsu", "black_zetsu", "madara", "kabuto", "kimimaro",
  "jugo", "karin", "danzo", "hanzo",
  // Sound Four
  "jirobo", "kidomaru", "tayuya", "sakon",
  // Other jinchuriki
  "utakata", "fu",
  // Boruto generation
  "boruto", "sarada", "mitsuki", "kawaki", "sumire", "shinki", "mirai",
  "kagura", "buntan",
  // Kara
  "jigen", "isshiki", "delta", "code", "boro", "koji", "victor", "deepa",
  "eida", "daemon",
  // Otsutsuki and ancient
  "momoshiki", "kinshiki", "urashiki", "kaguya", "hagoromo", "hamura",
  "toneri",
  // Special
  "shin", "menma",
]);

// Put FIGHTER_ORDER into roster order, and refuse to start if the two
// disagree — a mismatch means a fighter was defined or removed without the
// roster being updated.
{
  const defined = new Set(FIGHTER_ORDER);
  const missing = ROSTER_ORDER.filter((id) => !defined.has(id));
  const extra = FIGHTER_ORDER.filter((id) => !ROSTER_ORDER.includes(id));
  if (missing.length || extra.length) {
    throw new Error(
      `Roster mismatch. Missing: ${missing.join(', ') || 'none'}. `
      + `Not in ROSTER_ORDER: ${extra.join(', ') || 'none'}.`,
    );
  }
  FIGHTER_ORDER.length = 0;
  FIGHTER_ORDER.push(...ROSTER_ORDER);
}

/* -------------------------------------------------------------------------- */

export { FIGHTERS, FIGHTER_ORDER, getFighter, allFighters };

export const ROSTER_SIZE = FIGHTER_ORDER.length;
export const COMPLETE_FIGHTERS = FIGHTER_ORDER.filter(
  (id) => FIGHTERS[id].playableStatus === COMPLETE,
);
