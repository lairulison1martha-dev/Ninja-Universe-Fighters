/**
 * MUGEN collision boxes → this game's fighter-space boxes.
 *
 * Two coordinate systems have to be reconciled.
 *
 * MUGEN: origin is the sprite's axis — the character's feet on the ground.
 *   x grows right, **y grows DOWNWARD**, so a box above the feet has negative
 *   y. A stock standing hurtbox reads `-10, -79, 10, 0`: from the head
 *   (y=-79) down to the floor (y=0).
 *
 * This game: `js/combat/hitbox.js` boxes are centred on the fighter with
 *   `hitYOffset` measured the same way MUGEN does (negative is up — see the
 *   ability defaults, `hitYOffset: -70`), and distances are in world units
 *   where a fighter is ~158 units tall.
 *
 * So the conversion is a scale, not a flip: MUGEN units at the character's
 * localcoord are rescaled to the game's fighter height. Getting this wrong
 * produces hitboxes that look plausible in a report and are wildly wrong in a
 * match, so `validateBoxes` checks the result against the fighter's own size
 * rather than trusting the arithmetic.
 */

/** The game's nominal fighter height in world units (FighterRenderer H). */
export const GAME_FIGHTER_HEIGHT = 158;

/** A stock MUGEN character is about 80 units tall at 320x240 localcoord. */
export const MUGEN_REFERENCE_HEIGHT = 80;

/**
 * Work out the scale from MUGEN units to game units.
 *
 * Prefers the character's own measurements — the tallest hurtbox is a far
 * better height estimate than a constant — and falls back to the convention.
 *
 * @param {Object[]} animations parsed AIR actions
 * @param {number} coordScale 320 / localcoord.width
 */
export function deriveScale(animations, coordScale = 1) {
  let lowest = 0;      // most negative y seen on a hurtbox = top of the head
  for (const a of animations || []) {
    for (const f of a.frames || []) {
      for (const b of f.clsn2 || []) {
        lowest = Math.min(lowest, b.y1, b.y2);
      }
    }
  }
  const measured = Math.abs(lowest);
  const mugenHeight = measured > 10 ? measured : MUGEN_REFERENCE_HEIGHT;
  return {
    mugenHeight,
    measured: measured > 10,
    /** Multiply a MUGEN coordinate by this to get game world units. */
    scale: (GAME_FIGHTER_HEIGHT / mugenHeight) * (coordScale || 1),
    coordScale: coordScale || 1,
  };
}

/**
 * Convert one MUGEN box.
 *
 * MUGEN writes corners in any order, so they are normalised first: a box
 * stored as `10,-20,-10,-80` is the same rectangle as `-10,-80,10,-20`.
 */
export function convertBox(box, scale) {
  const x1 = Math.min(box.x1, box.x2);
  const x2 = Math.max(box.x1, box.x2);
  const y1 = Math.min(box.y1, box.y2);   // more negative = higher up
  const y2 = Math.max(box.y1, box.y2);

  const left = x1 * scale;
  const right = x2 * scale;
  const top = y1 * scale;
  const bottom = y2 * scale;

  return {
    // Game boxes are centre + half-extents, matching hitbox.js setCentred().
    cx: Number(((left + right) / 2).toFixed(2)),
    cy: Number(((top + bottom) / 2).toFixed(2)),
    halfWidth: Number(((right - left) / 2).toFixed(2)),
    halfHeight: Number(((bottom - top) / 2).toFixed(2)),
    width: Number((right - left).toFixed(2)),
    height: Number((bottom - top).toFixed(2)),
    /** Kept so a human can check the conversion against the source. */
    source: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 },
  };
}

/**
 * Build a per-frame hitbox map for every animation.
 *
 * @returns {{ animations: Object[], scale: Object, stats: Object, warnings: string[] }}
 */
export function mapHitboxes(animations, { coordScale = 1, clipFor = null } = {}) {
  const scaleInfo = deriveScale(animations, coordScale);
  const { scale } = scaleInfo;
  const warnings = [];
  const out = [];

  let framesWithAttack = 0;
  let framesWithHurt = 0;
  let totalFrames = 0;

  for (const anim of animations || []) {
    const frames = [];
    let tick = 0;
    for (let i = 0; i < (anim.frames || []).length; i++) {
      const f = anim.frames[i];
      const attack = (f.clsn1 || []).map((b) => convertBox(b, scale));
      const hurt = (f.clsn2 || []).map((b) => convertBox(b, scale));
      if (attack.length) framesWithAttack++;
      if (hurt.length) framesWithHurt++;
      totalFrames++;
      frames.push({
        index: i,
        group: f.group,
        image: f.image,
        /** Start of this frame in seconds, at MUGEN's 60 ticks/second. */
        startSeconds: Number((tick / 60).toFixed(4)),
        durationSeconds: Number(((f.ticks > 0 ? f.ticks : 0) / 60).toFixed(4)),
        ticks: f.ticks,
        attack,
        hurt,
        attackInherited: f.clsn1Inherited,
        hurtInherited: f.clsn2Inherited,
      });
      if (f.ticks > 0) tick += f.ticks;
    }

    out.push({
      action: anim.number,
      clip: clipFor ? clipFor(anim.number) : null,
      frames,
      /** First frame carrying an attack box — the move's startup. */
      firstAttackFrame: frames.findIndex((fr) => fr.attack.length),
      activeFrames: frames.filter((fr) => fr.attack.length).length,
    });
  }

  const stats = {
    animations: out.length,
    frames: totalFrames,
    framesWithAttackBoxes: framesWithAttack,
    framesWithHurtBoxes: framesWithHurt,
    attackCoverage: totalFrames ? Number((framesWithAttack / totalFrames).toFixed(3)) : 0,
    hurtCoverage: totalFrames ? Number((framesWithHurt / totalFrames).toFixed(3)) : 0,
  };

  return { animations: out, scale: scaleInfo, stats, warnings };
}

/**
 * Sanity-check converted boxes.
 *
 * The failure this exists to catch is a scale error: boxes that are plausible
 * numbers but describe a fighter three times too tall, or a hitbox that
 * reaches across the arena. Bounds are generous — a real Susanoo attack IS
 * huge — but a box outside them is reported rather than shipped.
 */
export function validateBoxes(mapped, {
  maxHalfWidth = GAME_FIGHTER_HEIGHT * 4,
  maxHalfHeight = GAME_FIGHTER_HEIGHT * 4,
  maxAbsCentre = GAME_FIGHTER_HEIGHT * 6,
} = {}) {
  const errors = [];
  const warnings = [];
  let checked = 0;

  for (const anim of mapped.animations || []) {
    for (const frame of anim.frames) {
      for (const [kind, boxes] of [['attack', frame.attack], ['hurt', frame.hurt]]) {
        for (const b of boxes) {
          checked++;
          const where = `action ${anim.action} frame ${frame.index} ${kind}`;
          if (!Number.isFinite(b.cx) || !Number.isFinite(b.cy)
            || !Number.isFinite(b.halfWidth) || !Number.isFinite(b.halfHeight)) {
            errors.push(`${where}: non-finite box`);
            continue;
          }
          if (b.halfWidth <= 0 || b.halfHeight <= 0) {
            warnings.push(`${where}: zero-area box ${JSON.stringify(b.source)}`);
            continue;
          }
          if (b.halfWidth > maxHalfWidth || b.halfHeight > maxHalfHeight) {
            errors.push(`${where}: ${b.width}x${b.height} is implausibly large — check the scale`);
          }
          if (Math.abs(b.cx) > maxAbsCentre || Math.abs(b.cy) > maxAbsCentre) {
            errors.push(`${where}: centre (${b.cx}, ${b.cy}) is far outside the fighter`);
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, checked, errors, warnings };
}

/**
 * Check every frame's sprite reference exists in the SFF.
 * A hitbox on a frame whose sprite is missing is a hitbox on nothing.
 */
export function validateFrameReferences(animations, sffByKey) {
  const missing = [];
  for (const a of animations || []) {
    for (let i = 0; i < (a.frames || []).length; i++) {
      const f = a.frames[i];
      if (f.group === -1) continue;            // blank frame, references nothing
      const key = `${f.group},${f.image}`;
      if (!sffByKey.has(key)) {
        missing.push({ action: a.number, frame: i, group: f.group, image: f.image });
      }
    }
  }
  return { ok: missing.length === 0, missing, missingCount: missing.length };
}

export default mapHitboxes;
