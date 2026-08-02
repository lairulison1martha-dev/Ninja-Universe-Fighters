#!/usr/bin/env python3
"""
Ninja Universe Fighters - original app icon generator.

Renders the icon procedurally (no external image libraries, no downloaded art)
and exports every PNG size the PWA / Apple / favicon metadata requires.

    python3 tools/generate-icons.py

Design: dark circular ninja universe, blue + red chakra swirl, eclipse moon,
original masked shinobi silhouette with bright eyes. All shapes are defined by
maths in this file, so the artwork is 100% original to this project.
"""

import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "icons")

MASTER = int(os.environ.get("NUF_ICON_MASTER", "1024"))  # downsampled per export

# ---------------------------------------------------------------------------
# tiny maths helpers
# ---------------------------------------------------------------------------


def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else hi if v > hi else v


def smoothstep(edge0, edge1, x):
    if edge0 == edge1:
        return 0.0 if x < edge0 else 1.0
    t = clamp((x - edge0) / (edge1 - edge0))
    return t * t * (3.0 - 2.0 * t)


def mix(a, b, t):
    return a + (b - a) * t


def mix3(c0, c1, t):
    return (mix(c0[0], c1[0], t), mix(c0[1], c1[1], t), mix(c0[2], c1[2], t))


def over(dst, src, alpha):
    """Alpha-composite src over dst."""
    if alpha <= 0.0:
        return dst
    if alpha >= 1.0:
        return src
    return mix3(dst, src, alpha)


def add_light(dst, src, amount):
    """Additive (screen-ish) blend used for the glowing energy."""
    if amount <= 0.0:
        return dst
    return (
        clamp(dst[0] + src[0] * amount),
        clamp(dst[1] + src[1] * amount),
        clamp(dst[2] + src[2] * amount),
    )


def rgb(hexstr):
    hexstr = hexstr.lstrip("#")
    return (
        int(hexstr[0:2], 16) / 255.0,
        int(hexstr[2:4], 16) / 255.0,
        int(hexstr[4:6], 16) / 255.0,
    )


# ---------------------------------------------------------------------------
# palette
# ---------------------------------------------------------------------------

C_BG_INNER = rgb("#141f38")
C_BG_OUTER = rgb("#05080f")
C_MOON = rgb("#243154")
C_MOON_RIM = rgb("#9fc4ff")
C_BLUE = rgb("#3d8bff")
C_BLUE_HOT = rgb("#a8dcff")
C_RED = rgb("#ff3b3b")
C_RED_HOT = rgb("#ffb066")
C_SILHOUETTE = rgb("#04060c")
C_MASK = rgb("#0d1526")
C_EYE_CORE = rgb("#ffffff")


# ---------------------------------------------------------------------------
# signed-distance shapes (normalised space, x/y in roughly -1..1, y grows down)
# ---------------------------------------------------------------------------


def sd_circle(x, y, cx, cy, r):
    return math.hypot(x - cx, y - cy) - r


def sd_ellipse(x, y, cx, cy, rx, ry):
    # cheap approximation, good enough for silhouette work
    dx = (x - cx) / rx
    dy = (y - cy) / ry
    d = math.hypot(dx, dy)
    return (d - 1.0) * min(rx, ry)


def sd_ellipse_rot(x, y, cx, cy, rx, ry, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    px = (x - cx) * ca + (y - cy) * sa
    py = -(x - cx) * sa + (y - cy) * ca
    return sd_ellipse(px, py, 0.0, 0.0, rx, ry)


def smooth_union(a, b, k):
    h = clamp(0.5 + 0.5 * (b - a) / k)
    return mix(b, a, h) - k * h * (1.0 - h)


def fill(d, aa):
    """Convert a signed distance into coverage with analytic anti-aliasing."""
    return smoothstep(aa, -aa, d)


# ---------------------------------------------------------------------------
# the icon itself
# ---------------------------------------------------------------------------


def shade(x, y, aa, scale):
    """Return (r, g, b) for a point in normalised icon space."""
    r_from_centre = math.hypot(x, y)

    # --- background: deep radial well -------------------------------------
    t = clamp(r_from_centre / 1.35)
    col = mix3(C_BG_INNER, C_BG_OUTER, t ** 0.75)

    # faint starfield / chakra dust
    for sx, sy, ss, sb in STARS:
        d = math.hypot(x - sx, y - sy)
        col = add_light(col, C_BLUE_HOT, sb * math.exp(-(d * d) / (ss * ss)))

    # --- eclipse moon disc -------------------------------------------------
    moon_cx, moon_cy, moon_r = 0.0, -0.06, 0.70
    d_moon = sd_circle(x, y, moon_cx, moon_cy, moon_r)
    # inner disc, slightly lighter than the void
    col = over(col, mix3(C_MOON, C_BG_OUTER, smoothstep(0.0, moon_r, r_from_centre)),
               fill(d_moon, aa) * 0.55)
    # bright rim of the eclipse
    rim = math.exp(-((d_moon / 0.030) ** 2))
    # rim is brightest top-left, fading bottom-right (light source)
    rim_dir = 0.55 + 0.45 * clamp((-x - y) * 0.9 + 0.5)
    col = add_light(col, C_MOON_RIM, rim * 0.85 * rim_dir)
    # soft outer halo
    halo = math.exp(-((max(d_moon, 0.0) / 0.26) ** 2))
    col = add_light(col, C_MOON_RIM, halo * 0.10)

    # --- twin chakra swirl (blue / red) ------------------------------------
    ang = math.atan2(y, x)
    for sign, cold, hot, phase in (
        (1.0, C_BLUE, C_BLUE_HOT, math.pi * 0.62),
        (-1.0, C_RED, C_RED_HOT, math.pi * -0.38),
    ):
        # spiral band: radius grows with angle
        a = ang * sign - phase
        a = (a + math.pi) % (2.0 * math.pi) - math.pi  # wrap to -pi..pi
        sweep = clamp((a + math.pi * 0.65) / (math.pi * 1.5))
        band_r = mix(0.42, 0.98, sweep)
        thick = mix(0.150, 0.020, sweep ** 0.7)
        d_band = abs(r_from_centre - band_r)
        core = math.exp(-((d_band / thick) ** 2))
        # fade the tails so it reads as a comma / swirl
        tail = smoothstep(0.0, 0.16, sweep) * (1.0 - smoothstep(0.72, 1.0, sweep))
        col = add_light(col, cold, core * tail * 0.85)
        col = add_light(col, hot, (core ** 3.0) * tail * 0.60)
        # broad ambient bloom on each side
        bloom = math.exp(-((d_band / (thick * 4.5)) ** 2))
        col = add_light(col, cold, bloom * tail * 0.16)

    # --- shinobi silhouette -------------------------------------------------
    # head under a wrapped hood: narrow, slightly pointed at the crown
    d_head = sd_ellipse(x, y, 0.0, -0.015, 0.250, 0.300)
    d_crown = sd_ellipse(x, y, 0.0, -0.230, 0.150, 0.180)
    d_jaw = sd_ellipse(x, y, 0.0, 0.140, 0.205, 0.190)
    d_sil = smooth_union(d_head, d_crown, 0.09)
    d_sil = smooth_union(d_sil, d_jaw, 0.10)

    # neck + shoulders (wide, tapering, reads as a fighting stance)
    d_neck = sd_ellipse(x, y, 0.0, 0.360, 0.150, 0.150)
    d_body = sd_ellipse(x, y, 0.0, 0.920, 0.72, 0.46)
    d_sil = smooth_union(d_sil, d_neck, 0.07)
    d_sil = smooth_union(d_sil, d_body, 0.11)

    # hood ties streaming up and outward behind the head
    for s in (-1.0, 1.0):
        d_tail = sd_ellipse_rot(x, y, s * 0.300, -0.115, 0.185, 0.030, s * -0.62)
        d_sil = smooth_union(d_sil, d_tail, 0.030)

    cov = fill(d_sil, aa)
    if cov > 0.0:
        # rim light picked up from the swirl behind the fighter
        edge = math.exp(-((d_sil / 0.022) ** 2))
        rimcol = C_BLUE_HOT if x < 0.0 else C_RED_HOT
        body = C_SILHOUETTE
        # face-wrap band below the eyes reads as a ninja mask
        band = fill(abs(y - 0.120) - 0.105, aa) * fill(
            sd_ellipse(x, y, 0.0, 0.120, 0.300, 0.290), aa)
        body = mix3(body, C_MASK, band * 0.85)
        col = over(col, body, cov)
        col = add_light(col, rimcol, edge * cov * 0.50)

    # --- glowing eyes -------------------------------------------------------
    for ex, ecol, ehot, tilt in (
        (-0.115, C_BLUE, C_BLUE_HOT, 0.34),
        (0.115, C_RED, C_RED_HOT, -0.34),
    ):
        ey = -0.055
        d_eye = sd_ellipse_rot(x, y, ex, ey, 0.088, 0.030, tilt)
        glow = math.exp(-((max(d_eye, 0.0) / 0.050) ** 2))
        col = add_light(col, ecol, glow * 0.60)
        col = add_light(col, ehot, glow ** 4 * 0.35)
        e = fill(d_eye, aa)
        col = over(col, mix3(ehot, C_EYE_CORE, 0.70), e)

    # forehead energy mark (three short strokes, original design)
    for i, mx in enumerate((-0.072, 0.0, 0.072)):
        h = 0.046 if i == 1 else 0.032
        d_mark = sd_ellipse(x, y, mx, -0.185, 0.013, h)
        m = fill(d_mark, aa)
        col = add_light(col, C_MOON_RIM, m * 0.85)

    # --- vignette + subtle overall contrast ---------------------------------
    vig = 1.0 - 0.55 * smoothstep(0.62, 1.45, r_from_centre)
    col = (col[0] * vig, col[1] * vig, col[2] * vig)
    return (clamp(col[0]), clamp(col[1]), clamp(col[2]))


# deterministic "random" chakra dust so re-runs are byte-identical
def _make_stars():
    stars = []
    seed = 20260801
    for i in range(46):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        a = (seed / 0x7FFFFFFF) * math.tau
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        rad = 0.45 + (seed / 0x7FFFFFFF) * 0.85
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        size = 0.008 + (seed / 0x7FFFFFFF) * 0.020
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        bright = 0.25 + (seed / 0x7FFFFFFF) * 0.65
        stars.append((math.cos(a) * rad, math.sin(a) * rad, size, bright))
    return stars


STARS = _make_stars()


# ---------------------------------------------------------------------------
# rendering / export
# ---------------------------------------------------------------------------


def render_master(size, art_scale=1.0):
    """Render the icon into a flat RGB float buffer of `size` x `size`."""
    buf = bytearray(size * size * 3)
    aa = (2.2 / size) / art_scale
    inv = 2.0 / size
    for py in range(size):
        y = ((py + 0.5) * inv - 1.0) / art_scale
        row = py * size * 3
        for px in range(size):
            x = ((px + 0.5) * inv - 1.0) / art_scale
            r, g, b = shade(x, y, aa, size)
            i = row + px * 3
            buf[i] = int(r * 255.0 + 0.5)
            buf[i + 1] = int(g * 255.0 + 0.5)
            buf[i + 2] = int(b * 255.0 + 0.5)
    return buf


def resample(src, src_size, dst_size):
    """Box/area resample RGB buffer down to dst_size."""
    if src_size == dst_size:
        return bytes(src)
    dst = bytearray(dst_size * dst_size * 3)
    ratio = src_size / dst_size
    for dy in range(dst_size):
        y0 = int(dy * ratio)
        y1 = max(y0 + 1, int((dy + 1) * ratio))
        for dx in range(dst_size):
            x0 = int(dx * ratio)
            x1 = max(x0 + 1, int((dx + 1) * ratio))
            tr = tg = tb = 0
            n = 0
            for sy in range(y0, y1):
                base = sy * src_size * 3
                for sx in range(x0, x1):
                    i = base + sx * 3
                    tr += src[i]
                    tg += src[i + 1]
                    tb += src[i + 2]
                    n += 1
            o = (dy * dst_size + dx) * 3
            dst[o] = tr // n
            dst[o + 1] = tg // n
            dst[o + 2] = tb // n
    return bytes(dst)


def write_png(path, rgb_buf, size):
    raw = bytearray()
    stride = size * 3
    for y in range(size):
        raw.append(0)  # filter type 0 (None)
        raw += rgb_buf[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


STANDARD_SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512]
MASKABLE_SIZES = [192, 512]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"rendering master {MASTER}x{MASTER} ...")
    master = render_master(MASTER)

    for s in STANDARD_SIZES:
        buf = resample(master, MASTER, s)
        p = os.path.join(OUT_DIR, f"icon-{s}.png")
        n = write_png(p, buf, s)
        print(f"  icon-{s}.png ({n} bytes)")

    # Apple touch icon is 180x180 and must NOT be pre-rounded (iOS masks it).
    apple = resample(master, MASTER, 180)
    write_png(os.path.join(OUT_DIR, "apple-touch-icon.png"), apple, 180)
    print("  apple-touch-icon.png (180x180)")

    # favicons keep their conventional names too
    for s in (16, 32):
        buf = resample(master, MASTER, s)
        write_png(os.path.join(OUT_DIR, f"favicon-{s}.png"), buf, s)
        print(f"  favicon-{s}.png")

    # maskable: art shrunk into the 80% safe zone, background bleeds to edge
    print(f"rendering maskable master ...")
    mask_master = render_master(MASTER, art_scale=0.72)
    for s in MASKABLE_SIZES:
        buf = resample(mask_master, MASTER, s)
        write_png(os.path.join(OUT_DIR, f"icon-maskable-{s}.png"), buf, s)
        print(f"  icon-maskable-{s}.png")

    print("done ->", OUT_DIR)


if __name__ == "__main__":
    main()
