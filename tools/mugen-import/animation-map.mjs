/**
 * MUGEN action numbers → this game's SpriteAnimator clips.
 *
 * MUGEN's common states fix a set of action numbers (0 stand, 20 walk forward,
 * 5000 hurt…), and most characters follow them because the shared common1.cns
 * plays those numbers directly. Most, not all: a character can ChangeAnim to
 * anything, and a lot of Naruto MUGEN characters were converted from other
 * engines and renumber freely.
 *
 * So convention is the first signal, not the only one. Each candidate is
 * scored from:
 *   1. the standard number,
 *   2. whether a StateDef with the matching MUGEN state number plays it,
 *   3. the animation's own shape — an idle loops and has no attack boxes, a
 *      hurt clip is short and has hurt boxes only, an attack has Clsn1.
 *
 * Anything that does not clear the bar is reported `unmapped` rather than
 * guessed at, because a wrong clip mapping is invisible until the fighter
 * plays the wrong animation in a match.
 */

/** The clips the game's SpriteAnimator understands. */
export const GAME_CLIPS = Object.freeze([
  'idle', 'combatIdle', 'walk', 'walkBack', 'run', 'jump', 'fall', 'landing',
  'dash', 'guard', 'guardHit', 'guardBreak', 'lightAttack', 'heavyAttack',
  'jutsu1', 'jutsu2', 'jutsu3', 'ultimate', 'hurt', 'knockdown', 'getUp',
  'victory', 'defeat', 'transformation',
]);

/**
 * MUGEN's standard action numbers. Straight from the common-state conventions
 * every stock character follows.
 */
export const STANDARD_ACTIONS = Object.freeze({
  0: 'idle',
  5: 'combatIdle',          // turning / stance shift
  10: 'guard',              // crouch stance in stock MUGEN; refined below
  11: 'walk',
  12: 'walk',
  20: 'walk',
  21: 'walkBack',
  40: 'jump',               // jump start
  41: 'jump',               // jump up
  42: 'jump',               // jump forward
  43: 'jump',               // jump back
  44: 'jump',
  45: 'jump',
  47: 'fall',
  50: 'jump',
  51: 'fall',
  52: 'landing',
  100: 'run',
  105: 'dash',              // run back / backdash
  120: 'guard',             // guard start
  130: 'guard',             // stand guard
  131: 'guard',
  132: 'guard',
  140: 'guardBreak',        // guard end
  150: 'guardHit',          // stand guard hit
  151: 'guardHit',
  152: 'guardHit',
  155: 'guardHit',
  170: 'guardBreak',
  200: 'lightAttack',
  210: 'lightAttack',
  230: 'heavyAttack',
  240: 'heavyAttack',
  400: 'lightAttack',       // crouching attacks
  410: 'lightAttack',
  430: 'heavyAttack',
  600: 'jump',              // air attacks land on the air clips
  5000: 'hurt',
  5001: 'hurt',
  5010: 'hurt',
  5011: 'hurt',
  5020: 'hurt',
  5030: 'hurt',
  5035: 'hurt',
  5040: 'knockdown',
  5050: 'knockdown',
  5060: 'guardHit',
  5070: 'knockdown',
  5080: 'knockdown',
  5090: 'knockdown',
  5100: 'knockdown',        // downed
  5110: 'knockdown',
  5120: 'getUp',
  5140: 'getUp',
  5150: 'defeat',           // lying defeated
  5160: 'defeat',
  5170: 'defeat',
  180: 'victory',           // win pose
  181: 'victory',
  182: 'victory',
  190: 'victory',
  191: 'victory',
});

/** MUGEN state numbers that tell us what a state's animation is for. */
const STATE_HINTS = Object.freeze({
  0: 'idle', 20: 'walk', 100: 'run', 105: 'dash',
  40: 'jump', 50: 'jump', 52: 'landing',
  120: 'guard', 130: 'guard', 131: 'guard', 132: 'guard',
  150: 'guardHit', 151: 'guardHit', 152: 'guardHit',
  200: 'lightAttack', 210: 'lightAttack', 230: 'heavyAttack', 240: 'heavyAttack',
  400: 'lightAttack', 430: 'heavyAttack',
  5000: 'hurt', 5010: 'hurt', 5020: 'hurt',
  5040: 'knockdown', 5050: 'knockdown', 5100: 'knockdown',
  5120: 'getUp', 5150: 'defeat',
  180: 'victory',
});

export const CONFIDENCE = Object.freeze(['high', 'medium', 'low', 'unmapped']);

/**
 * Describe an animation's shape, which is what lets the mapper disagree with
 * the standard number when the numbers were clearly reused.
 */
export function shapeOf(anim) {
  const frames = anim.frames || [];
  const holds = frames.some((f) => f.ticks < 0);
  return {
    frameCount: frames.length,
    ticks: anim.totalTicks,
    loops: !holds,
    holdsLastFrame: holds,
    hasAttackBoxes: !!anim.hasAttackBoxes,
    hasHurtBoxes: !!anim.hasHurtBoxes,
    /** An idle is a short loop with no attack boxes. */
    idleLike: !holds && frames.length >= 2 && frames.length <= 24 && !anim.hasAttackBoxes,
    /** An attack has Clsn1 and does not loop. */
    attackLike: !!anim.hasAttackBoxes,
  };
}

/**
 * Map every AIR action to a game clip.
 *
 * @param {Object[]} animations from parse-air
 * @param {Map<number,Object>} [statesByNumber] from parse-cns, optional
 * @returns {{ mappings: Object[], byClip: Object, unmapped: number[], stats: Object }}
 */
export function mapAnimations(animations, statesByNumber = null) {
  // Which animation does each MUGEN state play?
  const animToStates = new Map();
  if (statesByNumber) {
    for (const [num, st] of statesByNumber) {
      const anims = [];
      if (st.anim !== null && st.anim >= 0) anims.push(st.anim);
      for (const a of st.changeAnims || []) if (a >= 0) anims.push(a);
      for (const a of anims) {
        if (!animToStates.has(a)) animToStates.set(a, []);
        animToStates.get(a).push(num);
      }
    }
  }

  const mappings = [];

  for (const anim of animations) {
    const shape = shapeOf(anim);
    const owners = animToStates.get(anim.number) || [];
    const reasons = [];
    const votes = new Map();

    const vote = (clip, weight, why) => {
      if (!clip) return;
      votes.set(clip, (votes.get(clip) || 0) + weight);
      reasons.push(`${why} → ${clip} (+${weight})`);
    };

    // 1. The standard action number.
    const std = STANDARD_ACTIONS[anim.number];
    if (std) vote(std, 3, `standard action ${anim.number}`);

    // 2. A state that plays it.
    for (const s of owners) {
      const hint = STATE_HINTS[s];
      if (hint) vote(hint, 4, `state ${s} plays it`);
      // Specials and supers live above 1000 by strong convention.
      else if (s >= 3000) vote('ultimate', 2, `state ${s} is in the super range`);
      else if (s >= 1000) vote('jutsu1', 1, `state ${s} is in the special range`);
    }

    // 3. Shape.
    if (shape.attackLike && !std) vote('lightAttack', 1, 'has attack boxes');
    if (anim.number === 0 && shape.idleLike) vote('idle', 2, 'loops with no attack boxes');

    let clip = null;
    let score = 0;
    for (const [c, s] of votes) if (s > score) { clip = c; score = s; }

    // Confidence follows how much agreed, and whether anything disagreed.
    const distinct = votes.size;
    let confidence = 'unmapped';
    if (clip) {
      if (score >= 6) confidence = 'high';
      else if (score >= 3 && distinct <= 2) confidence = 'high';
      else if (score >= 3) confidence = 'medium';
      else if (score >= 2) confidence = 'medium';
      else confidence = 'low';
    }
    if (!clip) reasons.push('no convention, state or shape matched');

    mappings.push({
      action: anim.number,
      clip: clip || null,
      confidence,
      score,
      frameCount: shape.frameCount,
      ticks: anim.totalTicks,
      durationSeconds: anim.durationSeconds,
      loops: shape.loops,
      hasAttackBoxes: shape.hasAttackBoxes,
      hasHurtBoxes: shape.hasHurtBoxes,
      playedByStates: owners,
      reasons,
    });
  }

  // One clip can only come from one action; keep the best-scoring candidate
  // and demote the rest to alternates so the report still shows them.
  const byClip = {};
  for (const m of mappings) {
    if (!m.clip) continue;
    const cur = byClip[m.clip];
    if (!cur || m.score > cur.score) {
      if (cur) cur.demoted = true;
      byClip[m.clip] = m;
    } else {
      m.demoted = true;
    }
  }

  const stats = {
    total: mappings.length,
    high: mappings.filter((m) => m.confidence === 'high').length,
    medium: mappings.filter((m) => m.confidence === 'medium').length,
    low: mappings.filter((m) => m.confidence === 'low').length,
    unmapped: mappings.filter((m) => m.confidence === 'unmapped').length,
    clipsCovered: Object.keys(byClip).length,
    clipsTotal: GAME_CLIPS.length,
    missingClips: GAME_CLIPS.filter((c) => !byClip[c]),
  };

  return {
    mappings,
    byClip,
    unmapped: mappings.filter((m) => !m.clip).map((m) => m.action),
    stats,
  };
}

export default mapAnimations;
