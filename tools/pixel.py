"""
A tiny integer-only pixel canvas.

Everything here rasterises with hard edges — no antialiasing anywhere — because
the output is pixel art that gets scaled up with nearest-neighbour sampling in
the game. A single soft edge pixel becomes a visible smear at 3x.

Coordinates are pixel indices. Colours are (r, g, b) tuples; alpha is always
either 0 or 255.
"""

__all__ = [
    "Canvas", "hex_to_rgb", "shade", "mix", "outline_of",
]


def hex_to_rgb(value):
    """'#rrggbb' -> (r, g, b). Accepts a tuple unchanged."""
    if isinstance(value, tuple):
        return value
    v = value.lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def shade(color, factor):
    """Scale a colour's brightness. factor < 1 darkens, > 1 lightens."""
    r, g, b = color
    if factor <= 1:
        return int(r * factor), int(g * factor), int(b * factor)
    f = factor - 1
    return (min(255, int(r + (255 - r) * f)),
            min(255, int(g + (255 - g) * f)),
            min(255, int(b + (255 - b) * f)))


def mix(a, b, t):
    """Blend two colours, t in 0..1."""
    return (int(a[0] + (b[0] - a[0]) * t),
            int(a[1] + (b[1] - a[1]) * t),
            int(a[2] + (b[2] - a[2]) * t))


class Canvas:
    """An RGBA pixel buffer with the handful of shapes the fighter rig needs."""

    __slots__ = ("w", "h", "px")

    def __init__(self, w, h):
        self.w = w
        self.h = h
        self.px = bytearray(w * h * 4)

    # ---------------------------------------------------------------- basics

    def put(self, x, y, color, alpha=255):
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return
        i = (y * self.w + x) * 4
        self.px[i] = color[0]
        self.px[i + 1] = color[1]
        self.px[i + 2] = color[2]
        self.px[i + 3] = alpha

    def get(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return (0, 0, 0, 0)
        i = (y * self.w + x) * 4
        return self.px[i], self.px[i + 1], self.px[i + 2], self.px[i + 3]

    def alpha(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return 0
        return self.px[(y * self.w + x) * 4 + 3]

    def opaque(self, x, y):
        return self.alpha(x, y) > 0

    def blend(self, x, y, color, t):
        """Mix `color` into an already-opaque pixel. Skips empty pixels, so
        highlights and shadows never leak outside the silhouette."""
        if not self.opaque(x, y):
            return
        r, g, b, _ = self.get(x, y)
        self.put(x, y, mix((r, g, b), color, t))

    # ---------------------------------------------------------------- shapes

    def rect(self, x0, y0, w, h, color):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.put(x, y, color)

    def ellipse(self, cx, cy, rx, ry, color):
        if rx <= 0 or ry <= 0:
            return
        for y in range(int(cy - ry), int(cy + ry) + 1):
            dy = (y - cy) / ry
            if abs(dy) > 1:
                continue
            span = rx * (1 - dy * dy) ** 0.5
            for x in range(int(cx - span), int(cx + span) + 1):
                self.put(x, y, color)

    def capsule(self, x0, y0, x1, y1, r, color):
        """A thick line with round caps — every limb is one of these."""
        dx = x1 - x0
        dy = y1 - y0
        length2 = dx * dx + dy * dy
        lo_x = int(min(x0, x1) - r - 1)
        hi_x = int(max(x0, x1) + r + 1)
        lo_y = int(min(y0, y1) - r - 1)
        hi_y = int(max(y0, y1) + r + 1)
        rr = r * r + r * 0.35     # a touch of bias so radius 1 is 3px wide
        for y in range(lo_y, hi_y + 1):
            for x in range(lo_x, hi_x + 1):
                px = x - x0
                py = y - y0
                if length2 > 0:
                    t = (px * dx + py * dy) / length2
                    t = 0 if t < 0 else (1 if t > 1 else t)
                else:
                    t = 0
                ox = px - dx * t
                oy = py - dy * t
                if ox * ox + oy * oy <= rr:
                    self.put(x, y, color)

    def capsule_ink(self, x0, y0, x1, y1, r, color, ink):
        """A capsule with its own 1px dark rim.

        Internal outlines are what stop an arm from melting into the torso at
        this size — the outer silhouette outline alone is not enough, because
        every limb overlaps the body."""
        self.capsule(x0, y0, x1, y1, r + 0.75, ink)
        self.capsule(x0, y0, x1, y1, r, color)

    def poly_ink(self, points, color, ink, grow=0.9):
        cx = sum(p[0] for p in points) / len(points)
        cy = sum(p[1] for p in points) / len(points)
        big = [(x + (x - cx) * 0.0 + (grow if x > cx else -grow),
                y + (grow if y > cy else -grow)) for x, y in points]
        self.poly(big, ink)
        self.poly(points, color)

    def ellipse_ink(self, cx, cy, rx, ry, color, ink):
        self.ellipse(cx, cy, rx + 0.85, ry + 0.85, ink)
        self.ellipse(cx, cy, rx, ry, color)

    def poly(self, points, color):
        """Filled polygon, even-odd scanline fill."""
        if len(points) < 3:
            return
        ys = [p[1] for p in points]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            spans = []
            n = len(points)
            for i in range(n):
                ax, ay = points[i]
                bx, by = points[(i + 1) % n]
                if ay == by:
                    continue
                if min(ay, by) <= y < max(ay, by):
                    t = (y - ay) / (by - ay)
                    spans.append(ax + (bx - ax) * t)
            spans.sort()
            for i in range(0, len(spans) - 1, 2):
                for x in range(int(round(spans[i])), int(round(spans[i + 1])) + 1):
                    self.put(x, y, color)

    def tri(self, a, b, c, color):
        self.poly([a, b, c], color)

    # ------------------------------------------------------------ operations

    def clear_below(self, y):
        """Erase everything at or below a row — used to keep feet on the anchor."""
        for yy in range(y, self.h):
            for xx in range(self.w):
                self.put(xx, yy, (0, 0, 0), 0)

    def bounds(self):
        x0, y0, x1, y1 = self.w, self.h, -1, -1
        for y in range(self.h):
            for x in range(self.w):
                if self.alpha(x, y):
                    if x < x0: x0 = x
                    if x > x1: x1 = x
                    if y < y0: y0 = y
                    if y > y1: y1 = y
        return None if x1 < 0 else (x0, y0, x1, y1)

    def translate(self, dx, dy):
        out = Canvas(self.w, self.h)
        for y in range(self.h):
            ty = y + dy
            if ty < 0 or ty >= self.h:
                continue
            for x in range(self.w):
                tx = x + dx
                if 0 <= tx < self.w and self.alpha(x, y):
                    r, g, b, a = self.get(x, y)
                    out.put(tx, ty, (r, g, b), a)
        return out

    def outline(self, color):
        """Add a 1px border just outside the silhouette.

        This is what makes the sprite read at small sizes: without it the
        character melts into the stage. Drawn as a separate pass so limbs can
        overlap freely first."""
        edge = []
        for y in range(self.h):
            for x in range(self.w):
                if self.alpha(x, y):
                    continue
                if (self.alpha(x - 1, y) or self.alpha(x + 1, y)
                        or self.alpha(x, y - 1) or self.alpha(x, y + 1)):
                    edge.append((x, y))
        for x, y in edge:
            self.put(x, y, color)
        return edge

    def shade_pass(self, light_dx=-1, amount=0.22):
        """
        Cheap directional shading.

        A pixel whose neighbour on the lit side is empty or outline is a rim —
        it gets a highlight; a pixel on the shadow side of the silhouette gets
        darkened. Two tones over the base colour is all the reference style
        uses, and it keeps the palette small.
        """
        w, h = self.w, self.h
        lit = []
        dark = []
        for y in range(h):
            for x in range(w):
                if not self.opaque(x, y):
                    continue
                if not self.opaque(x + light_dx, y):
                    lit.append((x, y))
                elif not self.opaque(x - light_dx, y):
                    dark.append((x, y))
        for x, y in lit:
            self.blend(x, y, (255, 255, 255), amount)
        for x, y in dark:
            self.blend(x, y, (0, 0, 0), amount * 0.9)

    def to_image(self, Image):
        """Copy into a pngio Image."""
        img = Image(self.w, self.h)
        img.px[:] = self.px
        return img

    def paste_into(self, img, x0, y0):
        for y in range(self.h):
            for x in range(self.w):
                a = self.alpha(x, y)
                if not a:
                    continue
                r, g, b, _ = self.get(x, y)
                img.set(x0 + x, y0 + y, r, g, b, 255)


def outline_of(color):
    """The outline colour for a palette: a very dark, slightly hue-shifted ink."""
    r, g, b = color
    return (max(6, int(r * 0.22)), max(6, int(g * 0.22)), max(10, int(b * 0.26)))
