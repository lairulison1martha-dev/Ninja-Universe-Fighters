/**
 * Naruto — MUGEN package → Ninja Universe Fighters mapping. PASS 1.
 *
 * Source package: "Uzumaki Naruto" / displayname "Naruto",
 * by sage of six path med + Mikel8888, versiondate 12/09/2015.
 *
 * This file is a REVIEWED DECISION RECORD, not runtime data. Nothing in the
 * game imports it. It records what the analysis found and which existing
 * roster slot each finding maps onto, so PASS 2 — which brings the sprites —
 * has a written mapping to work from instead of re-deriving it.
 *
 * Two rules govern every entry:
 *
 *   1. `naruto` stays ONE roster fighter. Every mode below maps onto a
 *      transformation the game already has in js/data/transformations.js. No
 *      entry here creates a fighter, and nothing here is a roster id.
 *   2. Nothing is invented. A form the package does not implement is recorded
 *      as MISSING_FROM_PACKAGE, not filled in from the wish list.
 *
 * How the package implements a mode (established by tools/mugen-import/
 * mode-scan.mjs, not assumed): the activation state spawns a long-lived marker
 * helper; `[Statedef -3]` in IA.cns watches `numhelper(N)` and keeps a
 * variable in sync; every other command is gated on that variable. So the mode
 * flag, its marker helpers and its state file together define the form.
 */

export const PACKAGE = Object.freeze({
  name: 'Uzumaki Naruto',
  displayName: 'Naruto',
  author: 'sage of six path med + Mikel8888',
  versionDate: '12/09/2015',
  defFile: 'Naruto all.def',
  /** The 84 MB Naruto.sff was not in the PASS 1 upload. This is expected. */
  spriteArchivePresent: false,
  soundArchivePresent: false,
  rightsStatus: 'MANUAL_REVIEW',
  rightsNote: 'The package carries no readme, licence or terms of any kind. '
    + 'Missing terms are not permission. Artwork export stays blocked until '
    + 'the rights question is answered — see reports/mugen-naruto-pass1.md.',
});

/**
 * The three true transformation modes the package implements.
 *
 * `gameForm` is an EXISTING transformation id from js/data/transformations.js.
 * None of these is a roster entry and none may become one.
 */
export const MODES = Object.freeze([
  {
    mugenName: 'KCM Mode',
    gameForm: 'naruto_kcm1',
    gameFormName: 'Kurama Chakra Mode',
    kind: 'TRUE TRANSFORMATION',
    flagVar: 2,
    activationState: 2190,
    deactivationState: 2191,
    markerHelperOn: 2195,
    markerHelperOff: 2196,
    stateFile: 'KCM_Mode.cns',
    stateRange: [2060, 2961],
    stateCount: 53,
    airActions: 67,
    attacks: 24,
    helpers: 11,
    gatedCommands: 49,
    activation: {
      keys: 'hold Down + S',
      cmdEntry: 'KCM Mode',
      requires: ['var(5) >= 250', 'var(2) = 0 && var(3) = 0 && var(4) = 0', 'statetype != A', 'ctrl'],
      meter: { variable: 5, threshold: 250, ceiling: 1000 },
      power: null,
      life: null,
    },
    exit: {
      keys: 'hold Down + S',
      cmdEntry: 'KCM Mode Fin',
      state: 2191,
      requires: ['var(2) = 1'],
      drain: 'var(5) decreases by 1 per tick while the mode is active',
    },
    confidence: 'high',
  },
  {
    mugenName: 'Bijuu Mode (marker helper is named "KCM Mode Full")',
    gameForm: 'naruto_kcm2',
    gameFormName: 'Kurama Avatar',
    kind: 'TRUE TRANSFORMATION',
    flagVar: 3,
    activationState: 11190,
    deactivationState: 11191,
    markerHelperOn: 11195,
    markerHelperOff: 11196,
    stateFile: 'Bijuu_Mode.cns',
    stateRange: [11060, 12605],
    stateCount: 61,
    airActions: 84,
    attacks: 28,
    helpers: 19,
    gatedCommands: 51,
    activation: {
      /*
       * Two routes in. The staged one is the interesting one: from KCM with a
       * fuller meter, via state 2550, which hands over to 11190 after 6 ticks.
       * State 11190 then clears var(2) — you leave KCM as you enter Bijuu.
       */
      keys: 'S (from KCM), or Z from base',
      cmdEntry: 'Bijuu Mode (state 2550 → 11190), or IA Bijuu Mode (state 11190)',
      requires: ['var(5) >= 750', 'var(2) = 1', 'power = 9000'],
      alternateRequires: ['var(2) = 0 && var(3) = 0 && var(4) = 0', 'power = 9000'],
      meter: { variable: 5, threshold: 750, ceiling: 1000 },
      power: 9000,
      life: null,
    },
    exit: {
      keys: 'Z',
      cmdEntry: 'IA Bijuu Mode fin',
      state: 11191,
      requires: ['var(3) = 1'],
      drain: 'var(5) decreases by 2 per tick while the mode is active',
    },
    confidence: 'high',
  },
  {
    mugenName: 'Ashura Mode',
    gameForm: 'naruto_sixpaths',
    gameFormName: 'Six Paths Sage Mode',
    kind: 'TRUE TRANSFORMATION',
    flagVar: 4,
    activationState: 13190,
    deactivationState: 13191,
    markerHelperOn: 13195,
    markerHelperOff: 13196,
    stateFile: 'Ashura_Mode.cns',
    stateRange: [13060, 132200],
    stateCount: 65,
    airActions: 84,
    attacks: 28,
    helpers: 38,
    gatedCommands: 47,
    activation: {
      keys: 'S',
      cmdEntry: 'Ashura Mode (state 550 → 13190 after 6 ticks)',
      requires: ['var(2) = 0 && var(3) = 0 && var(4) = 0', 'power = 9000', 'life > 0'],
      meter: null,
      power: 9000,
      life: 'life > lifemax/5000000 — always true in practice; not a real gate',
    },
    exit: {
      keys: 'hold Down + S',
      cmdEntry: '(deactivation state 13191, no direct command entry found)',
      state: 13191,
      requires: ['var(4) = 1'],
      drain: 'var(5) decreases by 1 per tick while the mode is active',
    },
    /*
     * The name is the only weak link: "Ashura Mode" is not one of the game's
     * transformation names. It maps onto `naruto_sixpaths` because that is the
     * game's late-chain Naruto form and the package's Ashura state block is
     * its late-chain move set — Gudodama (truth-seeking orbs), Jinton, Futton.
     * Recorded as a judgement call, not as something the data states.
     */
    mappingConfidence: 'medium — named differently, matched on position and move set',
    confidence: 'high',
  },
]);

/**
 * Kurama Mode is NOT a fourth transformation.
 *
 * It is gated on Bijuu or Ashura already running (`var(3) = 1 || var(4) = 1`),
 * plays a 100-tick activation, applies a PalFX and parks the character in a
 * held state (3401) with its own follow-ups. That makes it a second stage of
 * an already-active form, so it maps onto an enhanced state of `naruto_kcm2`
 * rather than onto a transformation slot of its own.
 */
export const SUB_MODES = Object.freeze([
  {
    mugenName: 'Kurama Mode',
    kind: 'SUPER/HYPER ATTACK with a held stance (not a transformation)',
    activationState: 3400,
    holdState: 3401,
    exitState: 3402,
    stateFile: 'Supers.cns',
    requires: ['var(5) >= 250', 'var(3) = 1 || var(4) = 1'],
    keys: 'hold Down + S',
    mapsTo: { gameForm: 'naruto_kcm2', as: 'enhanced state, not a separate form' },
    confidence: 'high',
  },
]);

/**
 * Forms the game has that this package does NOT implement.
 *
 * These keep their current implementation. Nothing here is removed, and
 * nothing is fabricated to fill the gap.
 */
export const GAME_FORMS_WITHOUT_SOURCE = Object.freeze([
  { gameForm: 'naruto_onetail', reason: 'MISSING_FROM_PACKAGE — no tail-cloak mode flag exists' },
  { gameForm: 'naruto_fourtail', reason: 'MISSING_FROM_PACKAGE — no tail-cloak mode flag exists' },
  { gameForm: 'naruto_sage', reason: 'MISSING_FROM_PACKAGE — Sage Art ("Sempou"/"Senpo") attacks exist, but no sage mode flag, marker helper or state block' },
  { gameForm: 'naruto_baryon', reason: 'MISSING_FROM_PACKAGE — no Baryon state block, animation band or command' },
]);

/**
 * Requested forms that the package does not contain.
 *
 * Kept explicitly so PASS 2 does not quietly invent them.
 */
export const REQUESTED_BUT_MISSING = Object.freeze([
  {
    requested: 'One-Tail through Eight-Tail Cloaks (as player forms)',
    status: 'MISSING FROM PACKAGE',
    note: 'Supers.cns defines helpers named "Clon 1 Cola" … "Clon 8 Colas" — '
      + 'eight clone helpers spawned by the single super "Senpo Cho Bijuu Rasen '
      + 'Shuriken". They are helper NPCs inside one attack, not cloak forms the '
      + 'player transforms into: no mode flag, no marker helper, no state block, '
      + 'no activation command.',
  },
  { requested: 'Sage Mode', status: 'MISSING FROM PACKAGE', note: 'Sage-Art attacks only; no mode.' },
  { requested: 'KCM2 as a distinct mode', status: 'PARTIAL', note: 'The Bijuu Mode marker helper is literally named "KCM Mode Full", which is this package\'s KCM2. Mapped to naruto_kcm2.' },
  { requested: 'Kurama Link Mode', status: 'PRESENT AS Kurama Mode', note: 'A sub-mode of Bijuu/Ashura, not its own form.' },
  { requested: 'Six Paths Sage Mode / Rikudo', status: 'MISSING BY NAME', note: 'Nothing named Rikudo or Six Paths. Ashura Mode occupies that position in the chain.' },
]);

/**
 * The progression the package actually supports.
 *
 * Not the wish list — the wish list has stages this package never implemented.
 * Two entry points exist because the package offers two: a meter route through
 * KCM, and a full-power route straight to Ashura.
 */
export const PROGRESSION = Object.freeze({
  primary: ['base', 'naruto_kcm1', 'naruto_kcm2'],
  primaryNote: 'base → KCM (meter ≥ 250) → Bijuu/"KCM Mode Full" (meter ≥ 750 and full power). '
    + 'Entering Bijuu clears the KCM flag, so these are sequential, not stacked.',
  alternate: ['base', 'naruto_sixpaths'],
  alternateNote: 'base → Ashura Mode, on full power alone, with no mode active. '
    + 'The package treats this as a separate entry point rather than a later stage.',
  gameChainUnchanged: [
    'naruto_onetail', 'naruto_fourtail', 'naruto_sage',
    'naruto_kcm1', 'naruto_kcm2', 'naruto_sixpaths', 'naruto_baryon',
  ],
  gameChainNote: 'The game\'s existing seven-stage chain is NOT changed by this pass. '
    + 'The package supplies new material for three of its stages; the other four keep '
    + 'what they already have.',
});

/**
 * Candidate ultimates per form — the strongest meter-spending super in each
 * mode's own state block. Advisory for PASS 2; the ULTIMATE button and the
 * existing ultimate data are untouched by PASS 1.
 */
export const ULTIMATE_CANDIDATES = Object.freeze([
  { gameForm: null, form: 'base', state: 5535, name: 'Super Chakra Cannon', powerCost: 5000, file: 'Supers.cns' },
  { gameForm: 'naruto_kcm1', form: 'KCM', state: 4200, name: 'Senpo Cho Bijuu Rasen Shuriken', powerCost: 3000, file: 'Supers.cns' },
  { gameForm: 'naruto_kcm2', form: 'Bijuu', state: 40000, name: 'Kurama Tailed Beast Bomb', powerCost: 3000, file: 'Supers.cns' },
  { gameForm: 'naruto_kcm2', form: 'Bijuu (alt)', state: 6573, name: 'kurama susanoo', powerCost: 4000, file: 'Supers.cns' },
  { gameForm: 'naruto_sixpaths', form: 'Ashura', state: 14500, name: 'Cho Bijuudama', powerCost: 1500, file: 'Ashura_Mode.cns' },
]);

/**
 * Jutsu slot candidates per form. Each is a meter-spending command move from
 * that mode's own file, so a form's three slots come from that form's kit.
 */
export const JUTSU_CANDIDATES = Object.freeze({
  base: [
    { slot: 'jutsu1', state: 1100, name: 'Kage Bunshin no Jutsu', powerCost: 1000, motion: '~D,DB,B,a' },
    { slot: 'jutsu2', state: 1400, name: 'Rasenrengan', powerCost: 1000, motion: '~D,DF,F,c' },
    { slot: 'jutsu3', state: 1300, name: 'Kuchiyose Gamakichi', powerCost: 1000, motion: '~D,DB,B,b' },
  ],
  naruto_kcm1: [
    { slot: 'jutsu1', state: 2700, name: 'Bijuu Senkoodan', powerCost: 1000, motion: '~D,DB,B,c' },
    { slot: 'jutsu2', state: 2850, name: 'Rasenkyugan', powerCost: 1000, motion: '~D,DF,F,c' },
    { slot: 'jutsu3', state: 2950, name: 'Wakusey Rasengan', powerCost: 1000, motion: '~D,DF,F,b' },
  ],
  naruto_kcm2: [
    { slot: 'jutsu1', state: 12100, name: 'Cho Mini Bijuudama', powerCost: 1000, motion: '~D,DF,F,a' },
    { slot: 'jutsu2', state: 12300, name: 'Bijuu Wakusey Rasengan', powerCost: 1000, motion: '~D,DF,F,b' },
    { slot: 'jutsu3', state: 12500, name: 'Bijuu Wakusey Rasenkyugan', powerCost: 1000, motion: '~D,DB,B,c' },
  ],
  naruto_sixpaths: [
    { slot: 'jutsu1', state: 14000, name: 'Jinton Rasengan', powerCost: 1000, motion: '~D,DF,F,a' },
    { slot: 'jutsu2', state: 14100, name: 'Gudodama Blast', powerCost: 1000, motion: '~D,DB,B,a' },
    { slot: 'jutsu3', state: 14200, name: 'Futton Kairiki Muso', powerCost: 1000, motion: '~D,DF,F,b' },
  ],
});

/**
 * Shadow clones.
 *
 * KageBunshin.cns is a HELPER state block: states 15000–15210 are a clone's
 * own idle/walk/run/jump/attack states, driven as `Helper` instances named
 * "Kage Bunshin Clon" (15 spawns) and "Kage Bunshin" (4). The clone has two
 * attacking states (15200, 15210) and costs the summoner nothing directly —
 * the power is spent by the summoning state (1100, −1000).
 *
 * This is a Naruto ABILITY, not an Assist and not a Summon. It must not become
 * a selectable Assist entry, and `js/data/fighter-assists.js` is untouched.
 */
export const SHADOW_CLONES = Object.freeze({
  file: 'KageBunshin.cns',
  stateRange: [15000, 15210],
  cloneStates: [15000, 15001, 15002, 15020, 15040, 15105, 15106, 15200, 15210],
  spawnedBy: { state: 1100, name: 'Kage Bunshin no Jutsu', powerCost: 1000 },
  helperNames: ['Kage Bunshin Clon', 'Kage Bunshin', 'Kage Bunshin Revuelta'],
  attackStates: [15200, 15210],
  classification: 'temporary helper — a Naruto ability',
  mapsTo: 'the existing combat engine\'s helper/projectile handling, NOT js/data/fighter-assists.js and NOT js/data/summons.js',
});

/**
 * Other helpers worth classifying, so PASS 2 does not mistake one for another.
 */
export const OTHER_HELPERS = Object.freeze([
  { name: 'Gamakichi', spawnedBy: 1300, classification: 'summon — a toad, called by Kuchiyose Gamakichi' },
  { name: 'Kuchiyose No Jutsu: Fukasaku+Shima', spawnedBy: 10883, classification: 'summon — the toad elders' },
  { name: 'Kurama Helper', count: 6, classification: 'special move component — the fox avatar used by Bijuu/Ashura attacks' },
  { name: 'Agujas', count: 20, classification: 'projectile — the most-spawned helper in the package' },
  { name: 'Camara Lenta', count: 10, classification: 'effect — a slow-motion controller, not a fighter' },
  { name: 'Chakra Bar', count: 1, classification: 'effect — the package draws its own meter UI as a helper' },
  { name: 'sasuke', count: 2, classification: 'special move component — a cameo inside one super, NOT a roster fighter' },
]);

/**
 * The six .act files are alternate colours, not costumes and not forms.
 *
 * Each changes 6–8 palette indices out of 256, and only the ones carrying the
 * jumpsuit and hair: orange → red (4), blue (3), grey (5), green (6), gold (2).
 * Nothing in the CNS selects a palette to signal a mode — modes use PalFX and
 * their own animation bands instead. So these map onto MUGEN's colour-select
 * slots and must NOT become costume entries.
 */
export const PALETTES = Object.freeze({
  files: ['1.act', '2.act', '3.act', '4.act', '5.act', '6.act'],
  declaredIn: 'pal.defaults = 1,2,3,4,5,6',
  changedIndicesPerFile: { '2.act': 7, '3.act': 7, '4.act': 8, '5.act': 6, '6.act': 8 },
  interpretation: 'ALTERNATE COLOURS',
  mapsToCostumes: false,
  mapsToTransformations: false,
  note: 'Naruto already has five costumes in the game with their own artwork. '
    + 'These palettes would recolour, not re-dress, and are not imported as costumes.',
});

/** What PASS 2 needs, and what it is allowed to touch. */
export const PASS2_REQUIREMENTS = Object.freeze({
  needs: ['Naruto.sff (~84 MB)', 'optionally Naruto.snd — audio is never imported without explicit rights'],
  blockedOn: [
    'the rights question: the package states no terms, so artwork export is refused by license-check.mjs',
  ],
  willProduce: [
    'a 64x64 atlas per form, built from the SFF groups each mode\'s AIR actions reference',
    'per-frame hurtboxes and attack boxes converted to world units',
    'startup/active/recovery for the mapped moves',
  ],
  mustNotDo: [
    'create a roster entry for any form',
    'delete the current Naruto artwork before the replacement is imported and tested',
    'import audio without explicit recorded permission',
  ],
});

export default { PACKAGE, MODES, SUB_MODES, PROGRESSION };
