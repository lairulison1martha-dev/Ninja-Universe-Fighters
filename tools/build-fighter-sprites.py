#!/usr/bin/env python3
"""
Build the base-ninja sprite atlas from the supplied reference sheet.

    python3 tools/build-fighter-sprites.py [source.png]

WHAT THE SOURCE ACTUALLY IS
---------------------------
The supplied artwork is a *presentation mockup* of a sprite sheet, not a
production atlas:

  * it is an opaque RGB PNG (colour type 2) with no alpha channel — the
    "transparency" is a painted grey checker pattern whose luminance overlaps
    the character's own dark hair and clothing, so a plain colour key would
    hollow the sprite out;
  * the per-row frame counts printed on it ("8 frames", "6 frames", …) are
    decorative and do NOT match the number of characters actually drawn;
  * frames are not on a strict grid — measured pitch differs per row and
    effects (dust, chakra glow, slash arcs) bleed across cell boundaries;
  * every strip also carries baked-in label text and panel chrome.

So this script does not "slice a grid". It:

  1. keys the painted background out to real alpha using a luminance +
     saturation test followed by a border flood fill, so dark pixels *inside*
     the silhouette are kept while the surrounding pattern is removed,
  2. measures each strip's frame pitch by autocorrelation and snaps the cut
     lines to the emptiest columns near each nominal boundary,
  3. drops cells that hold no meaningful content,
  4. re-anchors every surviving frame onto a uniform FRAME x FRAME canvas with
     the feet on a single baseline and the body centred,
  5. writes a real RGBA atlas, fighter.json metadata and a portrait.

The output is honest about what it found: `fighter.json` records the frame
count actually extracted for each animation, never the number printed on the
mockup.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngio import read_png, write_png, Image  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "fighters", "base-ninja")

FRAME = 64          # atlas cell size
ANCHOR_X = 32       # body centre within a cell
ANCHOR_Y = 52       # ground line within a cell (feet sit here)

# The painted background is a soft neutral-grey checker. Measured on the source:
# it oscillates between luminance ~26 and ~47 with near-zero saturation, while
# the character's darks fall below ~24 and its skin / chakra effects are
# strongly saturated. Those two facts are what make the key possible.
BG_LUM_MIN = 24
BG_LUM_MAX = 52
BG_MAX_SATURATION = 7

# Strips, in the order they appear on the sheet. `claimed` is the count printed
# on the mockup and is recorded only so the report can show the discrepancy.
# The y ranges are inset by a couple of pixels so the thin rules that separate
# the strips on the mockup are not picked up as sprite content.
STRIPS = [
    # name,          y0,  y1,  x0,   x1,   claimed
    ("idle",         65, 128, 166,  580, 8),
    ("walk",        133, 194, 166,  580, 8),
    ("run",         199, 261, 166,  580, 8),
    ("lightAttack", 266, 322, 166,  580, 6),
    ("heavyAttack", 328, 387, 166,  580, 6),
    ("jutsu1",      393, 453, 166,  580, 7),
    ("jutsu2",      458, 521, 166,  580, 7),
    ("jump",        526, 584, 166,  580, 4),
    ("fall",         66, 128, 708, 1044, 4),
    ("dash",        133, 194, 708, 1044, 6),
    ("hurt",        199, 261, 708, 1044, 4),
    ("knockdown",   267, 322, 708, 1044, 4),
    ("getUp",       328, 387, 708, 1044, 4),
    ("guard",       392, 453, 708, 1044, 3),
    ("victory",     458, 521, 708, 1044, 4),
    ("defeat",      527, 582, 708, 1044, 4),
]

# Playback metadata. `hitFrame` is the frame index the combat engine treats as
# the contact/emission moment; `-1` means the animation has no event.
ANIM_META = {
    "idle":        {"fps": 8,  "loop": True,  "hitFrame": -1},
    "walk":        {"fps": 10, "loop": True,  "hitFrame": -1},
    "run":         {"fps": 14, "loop": True,  "hitFrame": -1},
    "jump":        {"fps": 10, "loop": False, "hitFrame": -1},
    "fall":        {"fps": 10, "loop": True,  "hitFrame": -1},
    "dash":        {"fps": 18, "loop": False, "hitFrame": -1},
    "lightAttack": {"fps": 16, "loop": False, "hitFrame": 2, "event": "hit"},
    "heavyAttack": {"fps": 14, "loop": False, "hitFrame": 3, "event": "hit"},
    "jutsu1":      {"fps": 14, "loop": False, "hitFrame": 3, "event": "cast"},
    "jutsu2":      {"fps": 14, "loop": False, "hitFrame": 3, "event": "cast"},
    "hurt":        {"fps": 12, "loop": False, "hitFrame": -1},
    "knockdown":   {"fps": 9,  "loop": False, "hitFrame": -1},
    "getUp":       {"fps": 10, "loop": False, "hitFrame": -1},
    "guard":       {"fps": 8,  "loop": True,  "hitFrame": -1},
    "victory":     {"fps": 8,  "loop": True,  "hitFrame": -1},
    "defeat":      {"fps": 8,  "loop": False, "hitFrame": -1},
}


# ---------------------------------------------------------------------------
# background keying
# ---------------------------------------------------------------------------

def _is_background_colour(r, g, b):
    """True for the painted backdrop, false for anything the character owns."""
    saturation = max(r, g, b) - min(r, g, b)
    if saturation > BG_MAX_SATURATION:
        return False                      # skin, chakra, anything coloured
    luminance = (r * 2 + g * 3 + b) // 6
    return BG_LUM_MIN <= luminance <= BG_LUM_MAX


def key_background(src, x0, y0, w, h):
    """
    Crop a region and turn the painted backdrop into real alpha.

    A pure colour test is not enough: the character's dark clothing sits in the
    same luminance band as the backdrop. So after the colour test we flood-fill
    inwards from the strip border — only background that is actually *connected
    to the outside* is removed, and any dark pixel enclosed by the silhouette
    is kept.
    """
    from collections import deque

    bg = bytearray(w * h)
    for y in range(h):
        sy = y0 + y
        for x in range(w):
            sx = x0 + x
            if 0 <= sx < src.w and 0 <= sy < src.h:
                r, g, b, _ = src.get(sx, sy)
                if _is_background_colour(r, g, b):
                    bg[y * w + x] = 1
            else:
                bg[y * w + x] = 1

    outside = bytearray(w * h)
    q = deque()

    def seed(x, y):
        i = y * w + x
        if bg[i] and not outside[i]:
            outside[i] = 1
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                seed(nx, ny)

    out = Image(w, h)
    for y in range(h):
        sy = y0 + y
        for x in range(w):
            if outside[y * w + x]:
                continue
            sx = x0 + x
            if 0 <= sx < src.w and 0 <= sy < src.h:
                r, g, b, _ = src.get(sx, sy)
                out.set(x, y, r, g, b, 255)
    return out


def drop_small_components(img, min_pixels=26):
    """
    Remove leftover crumbs — panel rules, label descenders, stray dust — that
    survived the key but are far too small to be part of a character.
    """
    from collections import deque

    w, h = img.w, img.h
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if seen[i] or img.alpha(sx, sy) == 0:
                continue
            comp = []
            q = deque([(sx, sy)])
            seen[i] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and img.alpha(nx, ny) > 0:
                            seen[j] = 1
                            q.append((nx, ny))
            if len(comp) < min_pixels:
                for x, y in comp:
                    img.px[(y * w + x) * 4 + 3] = 0
    return img


# ---------------------------------------------------------------------------
# frame segmentation
# ---------------------------------------------------------------------------

def column_mass(img):
    return [sum(1 for y in range(img.h) if img.alpha(x, y) > 60) for x in range(img.w)]


def measure_pitch(mass, lo=42, hi=96):
    """Dominant horizontal period of the strip, by autocorrelation."""
    n = len(mass)
    mean = sum(mass) / max(1, n)
    c = [v - mean for v in mass]
    best_p, best_s = lo, -1e18
    for p in range(lo, hi):
        s = 0.0
        for i in range(n - p):
            s += c[i] * c[i + p]
        s /= max(1, n - p)
        if s > best_s:
            best_s, best_p = s, p
    return best_p


def segment(img, pitch):
    """
    Cut the strip into cells on the measured pitch, snapping every boundary to
    the emptiest column nearby so a slash arc or dust cloud is not sliced in
    half.
    """
    mass = column_mass(img)
    n = len(mass)

    first = next((x for x, m in enumerate(mass) if m > 0), 0)
    last = next((x for x in range(n - 1, -1, -1) if mass[x] > 0), n - 1)

    cuts = [first]
    window = max(4, int(pitch * 0.30))
    pos = first
    while pos + pitch * 0.6 < last:
        nominal = pos + pitch
        lo = max(pos + int(pitch * 0.55), nominal - window)
        hi = min(n - 1, nominal + window)
        if lo >= hi:
            break
        cut = min(range(lo, hi + 1), key=lambda x: (mass[x], abs(x - nominal)))
        cuts.append(cut)
        pos = cut
    cuts.append(min(n, last + 1))

    cells = []
    for i in range(len(cuts) - 1):
        a, b = cuts[i], cuts[i + 1]
        if b - a < 12:
            continue
        cells.append((a, b, sum(mass[a:b])))

    if not cells:
        return []
    # Drop near-empty tail cells (gutter left over at the end of a strip).
    med = sorted(c[2] for c in cells)[len(cells) // 2]
    return [(a, b) for a, b, m in cells if m >= med * 0.18]


# ---------------------------------------------------------------------------
# frame normalisation
# ---------------------------------------------------------------------------

def content_bounds(img):
    xs0, ys0, xs1, ys1 = img.w, img.h, -1, -1
    for y in range(img.h):
        for x in range(img.w):
            if img.alpha(x, y) > 60:
                if x < xs0: xs0 = x
                if x > xs1: xs1 = x
                if y < ys0: ys0 = y
                if y > ys1: ys1 = y
    if xs1 < 0:
        return None
    return xs0, ys0, xs1, ys1


def body_metrics(img):
    """
    Ground line and horizontal centre of the *body*, ignoring wispy effects.

    Rows/columns holding only a couple of pixels are almost always dust, a
    slash arc or a chakra spark, so they must not drag the feet anchor down or
    the centre sideways.
    """
    rows = [sum(1 for x in range(img.w) if img.alpha(x, y) > 90) for y in range(img.h)]
    cols = [sum(1 for y in range(img.h) if img.alpha(x, y) > 90) for x in range(img.w)]
    peak_row = max(rows) if rows else 0
    solid_min = max(2, int(peak_row * 0.16))

    bottom = None
    for y in range(img.h - 1, -1, -1):
        if rows[y] >= solid_min:
            bottom = y
            break
    if bottom is None:
        bottom = img.h - 1

    total = sum(cols)
    if total == 0:
        return bottom, img.w // 2
    # Weighted median column — robust against one-sided glow.
    acc = 0
    centre = img.w // 2
    for x, m in enumerate(cols):
        acc += m
        if acc >= total / 2:
            centre = x
            break
    return bottom, centre


def skin_pixels(img):
    """
    Count warm skin-tone pixels. Used to reject cells that hold only an effect
    (a slash burst, a lightning arc) and no character — the fighter must never
    disappear mid-animation, and the engine draws its own impact particles.
    """
    n = 0
    for y in range(img.h):
        for x in range(img.w):
            r, g, b, a = img.get(x, y)
            if a < 90:
                continue
            if r > 105 and r > g + 22 and g > b + 8:
                n += 1
    return n


def normalise(cell):
    """Place one extracted cell onto a FRAME x FRAME canvas, feet on the anchor."""
    bounds = content_bounds(cell)
    if bounds is None:
        return None
    x0, y0, x1, y1 = bounds
    cropped = cell.crop(x0, y0, x1 - x0 + 1, y1 - y0 + 1)

    bottom, centre = body_metrics(cropped)

    out = Image(FRAME, FRAME)
    # Feet land on ANCHOR_Y; body centre lands on ANCHOR_X.
    dx = ANCHOR_X - centre
    dy = ANCHOR_Y - bottom
    out.blit(cropped, dx, dy)
    return out


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "tools", "source-sheet.png")
    if not os.path.exists(src_path):
        print(f"source sheet not found: {src_path}")
        return 1

    print(f"reading {src_path} …")
    src = read_png(src_path)
    print(f"  {src.w}x{src.h}")

    os.makedirs(OUT_DIR, exist_ok=True)

    extracted = {}
    report = []
    for name, y0, y1, x0, x1, claimed in STRIPS:
        strip = key_background(src, x0, y0, x1 - x0, y1 - y0)
        drop_small_components(strip)
        pitch = measure_pitch(column_mass(strip))
        cells = segment(strip, pitch)

        frames = []
        dropped = 0
        for a, b in cells:
            piece = strip.crop(a, 0, b - a, strip.h)
            norm = normalise(piece)
            if norm is None:
                continue
            if skin_pixels(norm) < 10:
                dropped += 1          # effect-only cell, no character in it
                continue
            frames.append(norm)
        if not frames:
            print(f"  !! {name}: no frames recovered")
            continue
        extracted[name] = frames
        report.append((name, claimed, len(frames), pitch))
        note = f"  (dropped {dropped} effect-only)" if dropped else ""
        print(f"  {name:12s} pitch {pitch:3d}  claimed {claimed}  extracted {len(frames)}{note}")

    if not extracted:
        print("nothing extracted")
        return 1

    # ---- atlas -----------------------------------------------------------
    order = [s[0] for s in STRIPS if s[0] in extracted]
    cols = max(len(extracted[n]) for n in order)
    rows = len(order)
    atlas = Image(cols * FRAME, rows * FRAME)
    animations = {}
    for r, name in enumerate(order):
        frames = extracted[name]
        for c, f in enumerate(frames):
            atlas.blit(f, c * FRAME, r * FRAME)
        meta = ANIM_META.get(name, {"fps": 10, "loop": True, "hitFrame": -1})
        entry = {
            "row": r,
            "frames": len(frames),
            "fps": meta["fps"],
            "loop": meta["loop"],
        }
        hf = meta.get("hitFrame", -1)
        if hf >= 0:
            # Never point an event past the frames we actually recovered.
            entry["hitFrame"] = min(hf, len(frames) - 1)
            entry["event"] = meta.get("event", "hit")
        animations[name] = entry

    sheet_path = os.path.join(OUT_DIR, "sprite-sheet.png")
    size = write_png(sheet_path, atlas)
    print(f"\nsprite-sheet.png  {atlas.w}x{atlas.h}  ({size} bytes)")

    # ---- portrait --------------------------------------------------------
    idle0 = extracted.get("idle", extracted[order[0]])[0]
    portrait = Image(96, 128)
    # Draw the idle pose large and centred; nearest-neighbour upscale keeps the
    # pixel look rather than blurring it.
    scale = 2
    for y in range(idle0.h):
        for x in range(idle0.w):
            r, g, b, a = idle0.get(x, y)
            if a == 0:
                continue
            for dy in range(scale):
                for dx in range(scale):
                    px = x * scale + dx - (idle0.w * scale - 96) // 2
                    py = y * scale + dy - (idle0.h * scale - 128) // 2
                    if 0 <= px < 96 and 0 <= py < 128:
                        portrait.set(px, py, r, g, b, a)
    write_png(os.path.join(OUT_DIR, "portrait.png"), portrait)
    print("portrait.png      96x128")

    # ---- body height -----------------------------------------------------
    # How tall the drawn character is, in atlas pixels, measured from the feet
    # anchor to the top of the head across the idle frames. The renderer uses
    # this to scale the sprite to each fighter's world height, so a taller
    # roster entry is drawn bigger without anyone guessing a magic number.
    idle_frames = extracted.get("idle", extracted[order[0]])
    heights = []
    for f in idle_frames:
        bounds = content_bounds(f)
        if bounds:
            heights.append(ANCHOR_Y - bounds[1])
    body_height = sorted(heights)[len(heights) // 2] if heights else FRAME // 2
    print(f"body height       {body_height}px (feet anchor to top of head)")

    # ---- metadata --------------------------------------------------------
    meta = {
        "id": "base-ninja",
        "name": "Base Ninja",
        "displayName": "Base Ninja (temporary)",
        "spriteSheet": "assets/fighters/base-ninja/sprite-sheet.png",
        "portrait": "assets/fighters/base-ninja/portrait.png",
        "frameWidth": FRAME,
        "frameHeight": FRAME,
        "anchor": {"x": ANCHOR_X, "y": ANCHOR_Y},
        "bodyHeight": body_height,
        "pixelArt": True,
        "source": {
            "kind": "reference-mockup",
            "note": (
                "Extracted from a presentation mockup of a sprite sheet, not a "
                "production atlas. The source had no alpha channel and its "
                "printed frame counts did not match the drawn content; the "
                "counts below are what was actually recovered."
            ),
            "claimedFrames": {n: c for n, c, _e, _p in report},
            "extractedFrames": {n: e for n, _c, e, _p in report},
        },
        "animations": animations,
    }
    with open(os.path.join(OUT_DIR, "fighter.json"), "w") as fh:
        json.dump(meta, fh, indent=2)
        fh.write("\n")
    print("fighter.json      written")

    total = sum(len(v) for v in extracted.values())
    print(f"\n{len(order)} animations, {total} frames total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
