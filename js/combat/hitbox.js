/**
 * Axis-aligned boxes for hit detection.
 *
 * Boxes are pooled: combat allocates none per frame, it reuses scratch objects.
 * (Creating hundreds of temporary objects every frame is exactly what the
 * performance rules forbid.)
 */

export function box(x = 0, y = 0, w = 0, h = 0) {
  return { x, y, w, h };
}

/** Set a box from a centre point + half extents. */
export function setCentred(out, cx, cy, halfW, halfH) {
  out.x = cx - halfW;
  out.y = cy - halfH;
  out.w = halfW * 2;
  out.h = halfH * 2;
  return out;
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function centreX(b) { return b.x + b.w / 2; }
export function centreY(b) { return b.y + b.h / 2; }

/** Overlap area, used to pick the "most solid" contact when several match. */
export function overlapArea(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

export function pointIn(b, x, y) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/** Distance between two boxes along x (0 if they overlap). */
export function gapX(a, b) {
  if (a.x + a.w < b.x) return b.x - (a.x + a.w);
  if (b.x + b.w < a.x) return a.x - (b.x + b.w);
  return 0;
}

/** Scratch boxes reused by the engine — never store references to these. */
export const SCRATCH = {
  a: box(), b: box(), c: box(), d: box(),
};
