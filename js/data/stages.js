/**
 * Stages.
 *
 * Backgrounds are drawn procedurally from these layer descriptions — there are
 * no downloaded images anywhere in this project. Each layer is a named shape
 * generator plus a parallax factor; combat/stage-renderer.js interprets them.
 */

export const STAGES = Object.create(null);
export const STAGE_ORDER = [];

function stage(id, displayName, o) {
  const s = {
    id,
    displayName,
    description: o.description || '',
    /** sky gradient stops for day and night */
    day: o.day,
    night: o.night,
    /** Parallax layers, back to front. `kind` maps to a procedural painter. */
    layers: o.layers || [],
    groundColor: o.groundColor || '#2a2f3c',
    groundAccent: o.groundAccent || '#3a4152',
    /** Ambient particle system */
    ambient: o.ambient || null,       // { kind, count, color, speed }
    hazard: o.hazard || null,         // optional stage hazard descriptor
    musicId: o.musicId || 'bgm_battle_a',
    unlockRequirement: o.unlockRequirement || { type: 'default' },
    /** Which of the two variants is the default. Settings can force one. */
    defaultVariant: o.defaultVariant || 'day',
    tags: o.tags || [],
  };
  STAGES[id] = s;
  STAGE_ORDER.push(id);
  return s;
}

/* Layer helpers ------------------------------------------------------------ */
const mountains = (p, color, height, seed, jag = 0.5) => ({ kind: 'mountains', parallax: p, color, height, seed, jag });
const clouds = (p, color, count, speed) => ({ kind: 'clouds', parallax: p, color, count, speed });
const buildings = (p, color, count, seed) => ({ kind: 'buildings', parallax: p, color, count, seed });
const trees = (p, color, count, seed) => ({ kind: 'trees', parallax: p, color, count, seed });
const dunes = (p, color, height, seed) => ({ kind: 'dunes', parallax: p, color, height, seed });
const water = (p, color, height) => ({ kind: 'water', parallax: p, color, height });
const pillars = (p, color, count, seed) => ({ kind: 'pillars', parallax: p, color, count, seed });
const moon = (p, color, size, x, y) => ({ kind: 'moon', parallax: p, color, size, x, y });
const rifts = (p, color, count, seed) => ({ kind: 'rifts', parallax: p, color, count, seed });

stage('leaf_village', 'Hidden Leaf Rooftops', {
  description: 'Tiled rooftops above a sprawling village, with the great forest beyond.',
  day: ['#8fc6ee', '#cfe6f5', '#f6e9c8'],
  night: ['#0a1428', '#152340', '#2a3358'],
  layers: [
    moon(0.02, '#f6f1d8', 0.10, 0.78, 0.16),
    mountains(0.08, '#5a7a95', 0.34, 11, 0.4),
    trees(0.18, '#3f6a48', 26, 7),
    buildings(0.34, '#6a5240', 18, 3),
    buildings(0.55, '#4a3a2e', 12, 9),
  ],
  groundColor: '#5c4433', groundAccent: '#7a5a42',
  ambient: { kind: 'leaves', count: 22, color: '#7fbf5f', speed: 34 },
  musicId: 'bgm_battle_a',
  tags: ['leaf', 'starter'],
});

stage('forest_training', 'Forest Training Ground', {
  description: 'Three posts, packed earth, and a canopy that never quite lets the light in.',
  day: ['#7db6d8', '#bcd9e6', '#e8f0d0'],
  night: ['#08111f', '#122032', '#1e3048'],
  layers: [
    mountains(0.06, '#4a6a7a', 0.28, 21, 0.3),
    trees(0.14, '#2f5a3a', 34, 13),
    trees(0.30, '#264a30', 24, 5),
    trees(0.52, '#1c3a26', 14, 19),
  ],
  groundColor: '#4a3d2c', groundAccent: '#63523a',
  ambient: { kind: 'leaves', count: 30, color: '#8fd06f', speed: 28 },
  musicId: 'bgm_battle_b',
  tags: ['leaf', 'training', 'starter'],
});

stage('final_valley', 'Valley of Statues', {
  description: 'A canyon split by a waterfall, flanked by two enormous carved figures.',
  day: ['#6ea6cc', '#a8c8dc', '#d8e4e8'],
  night: ['#060d1c', '#0e1a30', '#1a2a44'],
  layers: [
    moon(0.02, '#e8f0ff', 0.09, 0.22, 0.14),
    mountains(0.07, '#3f5a72', 0.42, 31, 0.7),
    pillars(0.22, '#4a5566', 2, 3),
    water(0.40, '#3a6a8a', 0.16),
  ],
  groundColor: '#3a4452', groundAccent: '#4f5c6e',
  ambient: { kind: 'spray', count: 26, color: '#cfe8f5', speed: 60 },
  musicId: 'bgm_battle_c',
  unlockRequirement: { type: 'story', value: 'chapter_2' },
  tags: ['iconic'],
});

stage('desert_arena', 'Endless Dune', {
  description: 'Shifting sand under a bleached sky. Nothing to hide behind.',
  day: ['#e8c98a', '#f2ddb0', '#f8eed0'],
  night: ['#141020', '#241c34', '#3a2c48'],
  layers: [
    mountains(0.06, '#c2a070', 0.26, 41, 0.25),
    dunes(0.16, '#d8b880', 0.22, 7),
    dunes(0.34, '#c4a068', 0.16, 17),
  ],
  groundColor: '#c8a468', groundAccent: '#e0bc84',
  ambient: { kind: 'sand', count: 40, color: '#f0dcae', speed: 90 },
  musicId: 'bgm_battle_b',
  tags: ['sand'],
});

stage('rain_rooftops', 'Rain Village Rooftops', {
  description: 'Steel pipes and permanent rain. Everything here is wet and grey.',
  day: ['#4a5a6a', '#6a7a8a', '#8a98a4'],
  night: ['#0a1018', '#141c26', '#1e2836'],
  layers: [
    buildings(0.08, '#2a3440', 26, 3),
    buildings(0.20, '#222c38', 18, 11),
    buildings(0.42, '#1a2430', 12, 23),
  ],
  groundColor: '#2a3038', groundAccent: '#3a424c',
  ambient: { kind: 'rain', count: 90, color: '#a8c0d0', speed: 620 },
  musicId: 'bgm_battle_c',
  defaultVariant: 'night',
  tags: ['rain', 'akatsuki'],
});

stage('akatsuki_hideout', 'Hidden Cave Sanctum', {
  description: 'A carved chamber lit only by the ring-glow of a statue that should not be here.',
  day: ['#1a1620', '#241c2c', '#2e2438'],
  night: ['#0c0a12', '#161020', '#1e1628'],
  layers: [
    pillars(0.10, '#2a2438', 6, 5),
    pillars(0.26, '#221c2e', 4, 15),
    rifts(0.40, '#6a3a8a', 5, 9),
  ],
  groundColor: '#241e30', groundAccent: '#342a44',
  ambient: { kind: 'embers', count: 24, color: '#b06ad8', speed: 26 },
  musicId: 'bgm_battle_d',
  defaultVariant: 'night',
  unlockRequirement: { type: 'story', value: 'chapter_4' },
  tags: ['akatsuki'],
});

stage('exam_arena', 'Exam Arena', {
  description: 'Stone tiers packed with spectators you can only see as silhouettes.',
  day: ['#9ac4e0', '#c2dcea', '#e6eef0'],
  night: ['#0e1626', '#1a2438', '#28344c'],
  layers: [
    buildings(0.06, '#5a6272', 14, 3),
    pillars(0.18, '#6a7080', 8, 7),
    buildings(0.36, '#4a5060', 20, 13),
  ],
  groundColor: '#6a6656', groundAccent: '#847e68',
  ambient: { kind: 'dust', count: 18, color: '#d8d0b8', speed: 20 },
  musicId: 'bgm_battle_a',
  tags: ['exam', 'starter'],
});

stage('snow_bridge', 'Snow Bridge', {
  description: 'A long span over a frozen gorge. The wind never stops.',
  day: ['#b8d4e8', '#d8e8f2', '#f0f6fa'],
  night: ['#101c30', '#1c2c46', '#2c3e5c'],
  layers: [
    mountains(0.05, '#8aa4bc', 0.40, 51, 0.8),
    mountains(0.14, '#6a86a0', 0.28, 61, 0.6),
    pillars(0.32, '#5a6a80', 5, 21),
  ],
  groundColor: '#c8d8e4', groundAccent: '#e4eef4',
  ambient: { kind: 'snow', count: 60, color: '#ffffff', speed: 70 },
  musicId: 'bgm_battle_b',
  tags: ['ice'],
});

stage('cloud_mountain', 'Cloud Peak', {
  description: 'Above the weather. Lightning walks the horizon.',
  day: ['#5a8ac0', '#8ab0d8', '#c8dcec'],
  night: ['#0a1020', '#141c34', '#22304c'],
  layers: [
    mountains(0.05, '#44607c', 0.46, 71, 0.85),
    clouds(0.14, '#e8f0f8', 8, 12),
    mountains(0.28, '#33506a', 0.30, 81, 0.7),
  ],
  groundColor: '#4a5464', groundAccent: '#637082',
  ambient: { kind: 'sparks', count: 20, color: '#c8e8ff', speed: 40 },
  musicId: 'bgm_battle_c',
  tags: ['cloud'],
});

stage('stone_canyon', 'Stone Canyon', {
  description: 'Sheer rock walls and floating platforms held up by nothing obvious.',
  day: ['#c8a888', '#dcc0a0', '#eeddc4'],
  night: ['#181420', '#241e30', '#322842'],
  layers: [
    mountains(0.06, '#8a6c54', 0.44, 91, 0.9),
    pillars(0.20, '#6f5844', 7, 33),
    mountains(0.38, '#5a4636', 0.24, 101, 0.6),
  ],
  groundColor: '#6a5442', groundAccent: '#8a6c54',
  ambient: { kind: 'dust', count: 26, color: '#e0c8a8', speed: 30 },
  musicId: 'bgm_battle_b',
  tags: ['stone'],
});

stage('otsutsuki_dimension', 'Fractured Dimension', {
  description: 'Broken geometry over a sky that is the wrong colour in every direction.',
  day: ['#3a2050', '#5a2a64', '#8a3a70'],
  night: ['#100820', '#20103a', '#341a50'],
  layers: [
    moon(0.02, '#ffd0e8', 0.14, 0.30, 0.18),
    rifts(0.10, '#c85aa0', 7, 5),
    pillars(0.24, '#3a2450', 6, 45),
    rifts(0.44, '#ff6ac0', 4, 25),
  ],
  groundColor: '#2a1840', groundAccent: '#3e2458',
  ambient: { kind: 'chakra', count: 34, color: '#ff8ad0', speed: 24 },
  musicId: 'bgm_battle_d',
  unlockRequirement: { type: 'story', value: 'chapter_8' },
  defaultVariant: 'night',
  tags: ['otsutsuki', 'boss'],
});

stage('war_battlefield', 'Scorched Battlefield', {
  description: 'Craters, splintered weapons and smoke that has not lifted in days.',
  day: ['#8a6a5a', '#a88474', '#c4a08c'],
  night: ['#140e12', '#20161c', '#2e2028'],
  layers: [
    mountains(0.06, '#5a4448', 0.30, 111, 0.5),
    pillars(0.18, '#443238', 9, 55),
    trees(0.34, '#3a2c2c', 16, 65),
  ],
  groundColor: '#4a3a34', groundAccent: '#63504a',
  ambient: { kind: 'embers', count: 30, color: '#ff9a4a', speed: 34 },
  musicId: 'bgm_battle_d',
  unlockRequirement: { type: 'story', value: 'chapter_6' },
  tags: ['war'],
});

stage('moonlit_river', 'Moonlit River', {
  description: 'Still water, reflected light, and absolutely no cover.',
  day: ['#7ab0d0', '#a8cce0', '#d8e8f0'],
  night: ['#060c1a', '#0e1830', '#182a4a'],
  layers: [
    moon(0.02, '#f4f8ff', 0.16, 0.62, 0.20),
    mountains(0.08, '#324a64', 0.26, 121, 0.4),
    trees(0.20, '#223a30', 20, 75),
    water(0.42, '#2a5a80', 0.20),
  ],
  groundColor: '#2e3c4a', groundAccent: '#40525f',
  ambient: { kind: 'fireflies', count: 26, color: '#c8ffb0', speed: 18 },
  musicId: 'bgm_battle_a',
  defaultVariant: 'night',
  tags: ['calm'],
});

stage('training_dojo', 'Training Dojo', {
  description: 'Flat floor, clear sightlines, no distractions. Built for practice.',
  day: ['#c8b498', '#dcc8ac', '#eee0c8'],
  night: ['#1a1610', '#262018', '#342c22'],
  layers: [
    buildings(0.10, '#7a6248', 6, 3),
    pillars(0.28, '#5f4c38', 4, 13),
  ],
  groundColor: '#8a7050', groundAccent: '#a88a64',
  ambient: { kind: 'dust', count: 12, color: '#e8dcc0', speed: 12 },
  musicId: 'bgm_menu',
  tags: ['training', 'starter'],
});

export function getStage(id) {
  return STAGES[id] || null;
}

export function allStages() {
  return STAGE_ORDER.map((id) => STAGES[id]);
}

export const STAGE_COUNT = STAGE_ORDER.length;
