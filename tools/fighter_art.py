"""
Procedural chibi pixel-art fighter renderer.

Every frame in every sprite sheet in this project is drawn by this file. There
are no source images: a frame is a posed skeleton, rasterised as capsules and
polygons into a 64x64 pixel grid, then outlined and shaded.

Why generated rather than drawn by hand: the roster is 192 fighters and the
engine asks each of them for 19 animations. That is roughly sixteen thousand
frames — far past what can be hand-authored here — and the alternative the game
shipped with (one shared body under a colour filter) is exactly what this
replaces. Driving the art from a per-fighter design record means silhouette,
proportions, hair, gear and palette all differ, not just the colours.

Proportions follow the reference direction: about 2.5 heads tall, feet on a
single ground line at y = 58, so a 64x64 cell has room for hair, weapons and
aura without the character drifting off the anchor.

    frame(design, 'run', 3) -> Canvas
"""

import math

from pixel import Canvas, hex_to_rgb, shade, mix, outline_of

FRAME = 64
ANCHOR_X = 32
ANCHOR_Y = 58

# Skeleton rest positions, in frame pixels for a height multiplier of 1.0.
GROUND = 58
HIP_Y = 41
CHEST_Y = 30
NECK_Y = 28
HEAD_Y = 19
HEAD_R = 8.4

# ---------------------------------------------------------------------------
# animation tables
# ---------------------------------------------------------------------------

# Frame counts. Kept modest on purpose: more frames means a wider atlas for
# every one of the 192 fighters, and these read cleanly at 6.
FRAMES = {
    "idle": 6, "combatIdle": 4, "walk": 6, "run": 6, "jump": 3, "fall": 3,
    "landing": 3, "dash": 4, "guard": 2, "guardBreak": 3,
    "lightAttack": 4, "heavyAttack": 5,
    "jutsu1": 5, "jutsu2": 5, "jutsu3": 5, "ultimate": 6,
    "hurt": 3, "knockdown": 3, "getUp": 3,
    "victory": 5, "defeat": 4, "transformation": 6,
}

# fps / looping / the frame an attack connects on.
PLAYBACK = {
    "idle":        (7, True, None, None),
    "combatIdle":  (8, True, None, None),
    "landing":     (12, False, None, None),
    "guardBreak":  (9, False, None, None),
    "walk":        (9, True, None, None),
    "run":         (12, True, None, None),
    "jump":        (10, False, None, None),
    "fall":        (8, True, None, None),
    "dash":        (16, False, None, None),
    "guard":       (6, True, None, None),
    "lightAttack": (15, False, 2, "hit"),
    "heavyAttack": (13, False, 2, "hit"),
    "jutsu1":      (13, False, 2, "cast"),
    "jutsu2":      (13, False, 2, "cast"),
    "jutsu3":      (13, False, 2, "cast"),
    "ultimate":    (11, False, 3, "cast"),
    "hurt":        (11, False, None, None),
    "knockdown":   (8, False, None, None),
    "getUp":       (9, False, None, None),
    "victory":     (7, True, None, None),
    "defeat":      (7, False, None, None),
    "transformation": (10, False, 3, "transform"),
}

NEUTRAL = {
    "lean": 0.0,      # torso rotation, radians, + leans forward
    "bob": 0.0,       # whole body vertical offset, px (+ = down)
    "crouch": 0.0,    # hip raise, px
    "shift": 0.0,     # whole body horizontal offset, px
    "armF": 0.35,     # front shoulder angle, radians from straight down
    "armB": -0.30,
    "elbowF": 0.25,   # elbow bend
    "elbowB": 0.25,
    "legF": 0.10,     # front hip angle
    "legB": -0.10,
    "kneeF": 0.10,
    "kneeB": 0.10,
    "head": 0.0,      # head tilt
    "airborne": False,
    "prone": 0.0,     # 0 standing, 1 flat on the ground
    "fx": None,       # named effect drawn behind/in front
    "fxT": 0.0,
}


def _p(**kw):
    p = dict(NEUTRAL)
    p.update(kw)
    return p


def pose(anim, i, n):
    """The skeleton pose for frame `i` of `anim`."""
    t = i / max(1, n - 1)
    two_pi = math.pi * 2

    if anim == "idle":
        s = math.sin(t * two_pi)
        return _p(bob=-abs(s) * 0.9, armF=0.30 + s * 0.06, armB=-0.26 - s * 0.06,
                  head=s * 0.03)

    if anim == "combatIdle":
        # A tighter, weight-forward stance: what a fighter stands in once the
        # opponent is in range, as opposed to the relaxed `idle` loop.
        s = math.sin(t * two_pi)
        return _p(lean=0.10, bob=-abs(s) * 0.7, crouch=1.2,
                  armF=-0.75 + s * 0.07, armB=-0.55 - s * 0.07,
                  elbowF=0.95, elbowB=0.85,
                  legF=0.26, legB=-0.26, kneeF=0.42, kneeB=0.38)

    if anim == "landing":
        return [
            _p(airborne=True, bob=-2.0, legF=0.30, legB=-0.20, kneeF=0.35,
               kneeB=0.30, armF=-0.9, armB=-0.7),
            _p(crouch=4.5, lean=0.16, legF=0.55, legB=-0.55, kneeF=1.05,
               kneeB=1.0, armF=0.55, elbowF=1.25, armB=0.35,
               fx="dust", fxT=1.0),
            _p(crouch=1.8, lean=0.06, legF=0.30, legB=-0.30, kneeF=0.55,
               kneeB=0.5, armF=0.1, armB=-0.1, fx="dust", fxT=0.35),
        ][i]

    if anim == "guardBreak":
        # Guard shattered: arms thrown wide, head back, fully open.
        return [
            _p(lean=-0.30, head=-0.22, armF=1.15, armB=1.30,
               elbowF=0.35, elbowB=0.3, legF=-0.15, legB=0.22,
               fx="shatter", fxT=1.0),
            _p(lean=-0.48, head=-0.34, armF=1.45, armB=1.60, bob=-1.0,
               legF=-0.28, legB=0.34, fx="shatter", fxT=0.6),
            _p(lean=-0.38, head=-0.28, armF=1.30, armB=1.45,
               legF=-0.20, legB=0.26, fx="shatter", fxT=0.25),
        ][i]

    if anim == "walk":
        s = math.sin(t * two_pi)
        c = math.cos(t * two_pi)
        return _p(lean=0.06, bob=-abs(c) * 1.0,
                  legF=s * 0.55, legB=-s * 0.55,
                  kneeF=0.10 + max(0, -s) * 0.5, kneeB=0.10 + max(0, s) * 0.5,
                  armF=-s * 0.5, armB=s * 0.5, elbowF=0.35, elbowB=0.35)

    if anim == "run":
        s = math.sin(t * two_pi)
        c = math.cos(t * two_pi)
        return _p(lean=0.26, bob=-abs(c) * 2.0 - 1.0,
                  legF=s * 0.95, legB=-s * 0.95,
                  kneeF=0.25 + max(0, -s) * 0.95, kneeB=0.25 + max(0, s) * 0.95,
                  armF=-s * 0.85 - 0.2, armB=s * 0.85 + 0.2,
                  elbowF=0.85, elbowB=0.85, head=-0.05)

    if anim == "jump":
        return [
            _p(crouch=3.0, legF=0.30, legB=-0.30, kneeF=0.8, kneeB=0.8, armF=0.8, armB=0.7),
            _p(bob=-3.0, airborne=True, legF=-0.35, legB=0.20, kneeF=0.7, kneeB=0.25,
               armF=-1.05, armB=-0.85, lean=-0.05),
            _p(bob=-2.0, airborne=True, legF=-0.20, legB=0.30, kneeF=0.45, kneeB=0.2,
               armF=-1.2, armB=-1.0),
        ][i]

    if anim == "fall":
        s = math.sin(t * two_pi)
        return _p(airborne=True, bob=-1.0, lean=-0.06 + s * 0.03,
                  legF=0.35, legB=-0.20, kneeF=0.45, kneeB=0.30,
                  armF=-1.25 + s * 0.08, armB=-1.05 - s * 0.08)

    if anim == "dash":
        return [
            _p(lean=0.30, crouch=2.0, legF=0.5, legB=-0.4, kneeF=0.6, kneeB=0.4,
               armF=-0.5, armB=0.7),
            _p(lean=0.55, shift=1.0, legF=0.85, legB=-0.75, kneeF=0.35, kneeB=0.75,
               armF=-1.0, armB=1.0, fx="speed", fxT=0.4),
            _p(lean=0.58, shift=2.0, legF=0.60, legB=-0.95, kneeF=0.2, kneeB=0.95,
               armF=-1.1, armB=1.05, fx="speed", fxT=1.0),
            _p(lean=0.34, shift=1.0, legF=0.30, legB=-0.35, kneeF=0.3, kneeB=0.4,
               armF=-0.6, armB=0.6, fx="speed", fxT=0.5),
        ][i]

    if anim == "guard":
        return [
            _p(lean=-0.12, crouch=1.5, armF=-1.45, armB=-1.25, elbowF=1.15, elbowB=1.1,
               legF=0.22, legB=-0.22, kneeF=0.4, kneeB=0.4, fx="guard", fxT=1.0),
            _p(lean=-0.12, crouch=1.5, bob=-0.5, armF=-1.5, armB=-1.3,
               elbowF=1.2, elbowB=1.15, legF=0.22, legB=-0.22, kneeF=0.4, kneeB=0.4,
               fx="guard", fxT=0.7),
        ][i]

    if anim == "lightAttack":
        return [
            _p(lean=0.10, armF=0.9, elbowF=1.3, armB=-0.5, legF=0.2, legB=-0.25),
            _p(lean=0.22, armF=0.2, elbowF=1.5, armB=0.4, legF=0.35, legB=-0.4, shift=0.5),
            _p(lean=0.34, armF=-1.55, elbowF=0.02, armB=0.85, elbowB=0.5,
               legF=0.55, legB=-0.55, shift=1.5, fx="slash", fxT=1.0),
            _p(lean=0.20, armF=-1.1, elbowF=0.45, armB=0.5, legF=0.35, legB=-0.35,
               shift=0.5, fx="slash", fxT=0.35),
        ][i]

    if anim == "heavyAttack":
        return [
            _p(lean=-0.16, armF=1.15, elbowF=1.0, armB=-0.9, legF=0.15, legB=-0.3, crouch=1.0),
            _p(lean=-0.26, armF=1.5, elbowF=1.4, armB=-1.2, legF=0.1, legB=-0.45, crouch=2.0),
            _p(lean=0.42, armF=-1.75, elbowF=0.0, armB=1.0, elbowB=0.4,
               legF=0.7, legB=-0.7, shift=2.0, fx="impact", fxT=1.0),
            _p(lean=0.46, armF=-1.5, elbowF=0.1, armB=0.9, legF=0.6, legB=-0.6,
               shift=2.5, fx="impact", fxT=0.6),
            _p(lean=0.24, armF=-0.9, elbowF=0.5, armB=0.5, legF=0.35, legB=-0.35, shift=1.0),
        ][i]

    if anim in ("jutsu1", "jutsu2", "jutsu3"):
        # Three distinct casts so the three ability slots do not look identical:
        # a forward palm thrust, a two-handed seal, and an overhead call.
        if anim == "jutsu1":
            return [
                _p(lean=-0.10, armF=0.75, elbowF=1.2, armB=-0.55, elbowB=0.9),
                _p(lean=-0.18, armF=0.30, elbowF=1.5, armB=-0.30, elbowB=1.3, crouch=1.0),
                _p(lean=0.30, armF=-1.60, elbowF=0.05, armB=-1.2, elbowB=0.7,
                   shift=1.0, fx="orb", fxT=1.0),
                _p(lean=0.34, armF=-1.62, elbowF=0.05, armB=-1.1, shift=1.5,
                   fx="orb", fxT=0.85),
                _p(lean=0.16, armF=-1.25, elbowF=0.35, armB=-0.7, fx="orb", fxT=0.35),
            ][i]
        if anim == "jutsu2":
            return [
                _p(lean=-0.06, armF=-0.5, elbowF=1.5, armB=-0.5, elbowB=1.5),
                _p(lean=-0.10, armF=-0.75, elbowF=1.75, armB=-0.75, elbowB=1.75,
                   fx="seal", fxT=0.5),
                _p(lean=-0.14, armF=-0.85, elbowF=1.85, armB=-0.85, elbowB=1.85,
                   fx="seal", fxT=1.0),
                _p(lean=0.24, armF=-1.45, elbowF=0.2, armB=-1.35, elbowB=0.25,
                   fx="wave", fxT=1.0),
                _p(lean=0.12, armF=-1.15, elbowF=0.5, armB=-1.05, fx="wave", fxT=0.4),
            ][i]
        return [
            _p(lean=0.06, armF=0.4, elbowF=0.9, armB=0.4, elbowB=0.9, crouch=1.0),
            _p(lean=-0.20, armF=-2.1, elbowF=0.4, armB=-2.0, elbowB=0.4, crouch=-1.0),
            _p(lean=-0.30, armF=-2.5, elbowF=0.15, armB=-2.45, elbowB=0.15,
               bob=-1.5, fx="pillar", fxT=1.0),
            _p(lean=-0.24, armF=-2.45, elbowF=0.2, armB=-2.4, bob=-1.0,
               fx="pillar", fxT=0.8),
            _p(lean=-0.05, armF=-1.6, elbowF=0.6, armB=-1.5, fx="pillar", fxT=0.3),
        ][i]

    if anim == "ultimate":
        return [
            _p(lean=-0.12, armF=-0.55, elbowF=1.6, armB=-0.55, elbowB=1.6, crouch=1.0),
            _p(lean=-0.22, armF=-0.9, elbowF=1.9, armB=-0.9, elbowB=1.9, crouch=2.0,
               fx="charge", fxT=0.5),
            _p(lean=-0.30, armF=-1.4, elbowF=1.4, armB=-1.4, elbowB=1.4, bob=-1.0,
               fx="charge", fxT=1.0),
            _p(lean=0.30, armF=-1.68, elbowF=0.0, armB=-1.55, elbowB=0.1, shift=2.0,
               fx="beam", fxT=1.0),
            _p(lean=0.34, armF=-1.70, elbowF=0.0, armB=-1.5, shift=2.5,
               fx="beam", fxT=0.9),
            _p(lean=0.18, armF=-1.3, elbowF=0.4, armB=-1.1, shift=1.0,
               fx="beam", fxT=0.3),
        ][i]

    if anim == "hurt":
        return [
            _p(lean=-0.32, shift=-1.0, head=-0.20, armF=0.85, armB=0.95,
               elbowF=0.7, elbowB=0.7, legF=-0.25, legB=0.30),
            _p(lean=-0.46, shift=-2.0, head=-0.30, armF=1.05, armB=1.2,
               legF=-0.35, legB=0.40, bob=-1.0),
            _p(lean=-0.30, shift=-1.0, head=-0.18, armF=0.8, armB=0.9,
               legF=-0.2, legB=0.25),
        ][i]

    if anim == "knockdown":
        return [
            _p(prone=0.35, lean=-0.7, shift=0.0, bob=-3.0, airborne=True,
               armF=1.9, armB=2.1, legF=0.9, legB=0.6, kneeF=0.5, kneeB=0.3),
            _p(prone=0.78, lean=-1.1, shift=0.5, armF=2.2, armB=2.4,
               legF=1.35, legB=1.15, kneeF=0.3, kneeB=0.2),
            _p(prone=1.0, lean=-1.35, shift=1.5, armF=2.4, armB=2.6,
               legF=1.5, legB=1.35, kneeF=0.15, kneeB=0.1),
        ][i]

    if anim == "getUp":
        return [
            _p(prone=0.85, lean=-1.15, shift=1.5, armF=2.2, armB=2.4,
               legF=1.35, legB=1.15, kneeF=0.3, kneeB=0.2),
            _p(prone=0.35, lean=-0.5, shift=0.5, crouch=4.0, armF=0.9, elbowF=1.2,
               armB=0.6, legF=0.55, legB=-0.2, kneeF=1.0, kneeB=0.6),
            _p(prone=0.0, crouch=1.5, armF=0.5, armB=-0.2, legF=0.2, legB=-0.2,
               kneeF=0.35, kneeB=0.3),
        ][i]

    if anim == "victory":
        s = math.sin(t * two_pi)
        return _p(bob=-abs(s) * 1.4 - 0.5, armF=-2.35 + s * 0.12, elbowF=0.15,
                  armB=-0.35, elbowB=0.6, head=0.05, legF=0.12, legB=-0.12)

    if anim == "defeat":
        return [
            _p(prone=0.42, lean=-0.8, shift=0.0, head=-0.4, armF=1.9, armB=2.1,
               legF=0.8, legB=0.55, kneeF=0.5, kneeB=0.35),
            _p(prone=0.82, lean=-1.2, shift=0.5, head=-0.5, armF=2.25, armB=2.45,
               legF=1.3, legB=1.1, kneeF=0.3, kneeB=0.2),
            _p(prone=1.0, lean=-1.4, shift=1.5, head=-0.55, armF=2.45, armB=2.6,
               legF=1.5, legB=1.3, kneeF=0.15, kneeB=0.1),
            _p(prone=1.0, lean=-1.42, shift=1.5, head=-0.55, armF=2.48, armB=2.62,
               legF=1.52, legB=1.32, kneeF=0.12, kneeB=0.08),
        ][i]

    if anim == "transformation":
        s = [0.0, 0.35, 0.7, 1.0, 1.0, 0.9][i]
        return _p(lean=-0.10 - s * 0.14, bob=-s * 2.0, crouch=1.0,
                  armF=0.5 - s * 1.1, armB=-0.5 - s * 1.1,
                  elbowF=0.9 - s * 0.5, elbowB=0.9 - s * 0.5,
                  head=-s * 0.12, legF=0.25, legB=-0.25, kneeF=0.35, kneeB=0.35,
                  fx="burst", fxT=s)

    return _p()


# ---------------------------------------------------------------------------
# palette
# ---------------------------------------------------------------------------

class Palette:
    """Resolved colours for one design, plus the shading ramp for each."""

    def __init__(self, d):
        self.skin = hex_to_rgb(d["skin"])
        self.hair = hex_to_rgb(d["hair"])
        self.outfit = hex_to_rgb(d["outfit"])
        self.outfit2 = hex_to_rgb(d.get("outfit2") or shade_hex(d["outfit"], 0.62))
        self.trim = hex_to_rgb(d.get("trim") or d["outfit2"])
        self.pants = hex_to_rgb(d.get("pants") or d["outfit2"])
        self.boots = hex_to_rgb(d.get("boots") or "#2b2f3a")
        self.eyes = hex_to_rgb(d.get("eyes") or "#2a3550")
        self.metal = hex_to_rgb(d.get("metal") or "#b9c4d6")
        self.aura = hex_to_rgb(d["aura"]) if d.get("aura") else None
        self.ink = outline_of(self.outfit)
        self.skin_dark = shade(self.skin, 0.80)
        self.hair_dark = shade(self.hair, 0.72)


def shade_hex(value, f):
    r, g, b = hex_to_rgb(value)
    return "#%02x%02x%02x" % shade((r, g, b), f)


# ---------------------------------------------------------------------------
# rig
# ---------------------------------------------------------------------------

class Frame2D:
    """A local drawing frame: an origin plus a rotation.

    The head, hair, headband and face are all authored as offsets from the head
    centre. Routing them through this means a knocked-down fighter's head lies
    on its side — hair, headband and all — instead of staying bolt upright over
    a collapsed body."""

    __slots__ = ("ox", "oy", "cos", "sin")

    def __init__(self, ox, oy, rot=0.0):
        self.ox = ox
        self.oy = oy
        self.cos = math.cos(rot)
        self.sin = math.sin(rot)

    def p(self, dx, dy):
        return (self.ox + dx * self.cos - dy * self.sin,
                self.oy + dx * self.sin + dy * self.cos)


def _joint(x, y, angle, length):
    """Move from a joint along `angle` (0 = straight down, + = forward)."""
    return x + math.sin(angle) * length, y + math.cos(angle) * length


def frame(design, anim, index):
    """Render one animation frame. Returns a Canvas."""
    n = FRAMES[anim]
    p = pose(anim, index, n)
    pal = Palette(design)

    hs = design.get("height", 1.0)
    bulk = design.get("bulk", 1.0)

    c = Canvas(FRAME, FRAME)

    # ---- skeleton ---------------------------------------------------------
    prone = p["prone"]
    lean = p["lean"] + prone * 0.0
    ox = p["shift"]
    oy = p["bob"] - p["crouch"]

    ground = GROUND
    head_r = HEAD_R * (0.94 + 0.10 * bulk) * (0.96 + 0.06 * hs)
    leg_span = (GROUND - HIP_Y) * hs
    torso_span = (HIP_Y - CHEST_Y) * hs
    hip_y = ground - (ground - HIP_Y) * hs + oy
    chest_y = ground - (ground - CHEST_Y) * hs + oy
    head_y = ground - (ground - HEAD_Y) * hs + oy
    hip_x = ANCHOR_X + ox

    chest_x = hip_x + math.sin(lean) * (hip_y - chest_y)
    head_x = hip_x + math.sin(lean) * (hip_y - head_y) + math.sin(p["head"]) * 2

    if prone > 0:
        # Lay the body flat: the whole skeleton rotates a quarter turn about the
        # hip, so the head ends up on the floor beside the feet rather than the
        # torso simply sliding downwards.
        def lerp(a, b):
            return a + (b - a) * prone
        hip_y = lerp(hip_y, ground - 4.5 * hs)
        chest_y = lerp(chest_y, ground - 5.5 * hs)
        head_y = lerp(head_y, ground - 7.5 * hs)
        chest_x = lerp(chest_x, hip_x - torso_span)
        head_x = lerp(head_x, hip_x - torso_span - head_r * 0.70)

    limb_r = 1.6 * bulk
    # Limb lengths come from the REST skeleton, never from the posed joints:
    # a knocked-down fighter's hip sits near the floor, and deriving lengths
    # from it would shrink the whole body to a stub.
    thigh = leg_span * 0.52
    shin = leg_span * 0.52
    upper = torso_span * 0.52
    fore = torso_span * 0.50

    torso_w = 5.0 * bulk

    def arm(angle, elbow, colour, hand_colour, forward):
        sx = chest_x + (torso_w * 0.92 if forward else -torso_w * 1.0)
        sy = chest_y + 1.5
        ex, ey = _joint(sx, sy, angle + lean, upper)
        hx, hy = _joint(ex, ey, angle + elbow + lean, fore)
        c.capsule_ink(sx, sy, ex, ey, limb_r, colour, pal.ink)
        c.capsule_ink(ex, ey, hx, hy, limb_r * 0.92, colour, pal.ink)
        c.ellipse_ink(hx, hy, limb_r * 1.05, limb_r * 1.05, hand_colour, pal.ink)
        return hx, hy

    def leg(angle, knee, colour, forward):
        sx = hip_x + (1.3 if forward else -1.3) * bulk
        sy = hip_y
        kx, ky = _joint(sx, sy, angle, thigh)
        fx, fy = _joint(kx, ky, angle + knee, shin)
        c.capsule_ink(sx, sy, kx, ky, limb_r * 1.15, colour, pal.ink)
        c.capsule_ink(kx, ky, fx, fy, limb_r * 1.0, colour, pal.ink)
        return fx, fy

    sleeve = design.get("sleeves", "long")
    hand_col = pal.skin
    arm_col_f = pal.outfit if sleeve == "long" else pal.skin
    arm_col_b = shade(arm_col_f, 0.78)

    # ---- behind the body --------------------------------------------------
    # Shroud flames go down first so they read as backlight rather than
    # covering the fighter's face.
    if design.get("shroud"):
        _shroud_flames(c, pal, design, float(design["shroud"]),
                       head_x, head_y, chest_y, head_r)
    if p["fx"] and p["fxT"] > 0:
        _effect_back(c, pal, p["fx"], p["fxT"], chest_x, chest_y, head_y, design)
    if design.get("coat") in ("cloak", "akatsuki", "robe", "coat"):
        _cloak(c, pal, design, chest_x, chest_y, hip_y, ground, lean, bulk, p)
    _hair_back(c, pal, design, Frame2D(head_x, head_y, -math.pi / 2 * prone), head_r)
    _back_accessory(c, pal, design, chest_x, chest_y, hip_y, lean, bulk)

    # ---- back limbs -------------------------------------------------------
    bfx, bfy = leg(p["legB"] + lean * 0.4, p["kneeB"], shade(pal.pants, 0.78), False)
    arm(p["armB"], p["elbowB"], arm_col_b, shade(hand_col, 0.82), False)

    # ---- torso ------------------------------------------------------------
    _torso(c, pal, design, chest_x, chest_y, hip_x, hip_y, lean, bulk, hs)

    # ---- front limbs ------------------------------------------------------
    ffx, ffy = leg(p["legF"] + lean * 0.4, p["kneeF"], pal.pants, True)
    hx, hy = arm(p["armF"], p["elbowF"], arm_col_f, hand_col, True)

    # ---- boots ------------------------------------------------------------
    _boot(c, pal, bfx, bfy, prone, shade(pal.boots, 0.8))
    _boot(c, pal, ffx, ffy, prone, pal.boots)

    # ---- head -------------------------------------------------------------
    _head(c, pal, design, Frame2D(head_x, head_y, -math.pi / 2 * prone), head_r, p, anim)

    # ---- weapon in hand ---------------------------------------------------
    _weapon(c, pal, design, hx, hy, p, anim)

    # ---- foreground effects -----------------------------------------------
    if p["fx"] and p["fxT"] > 0:
        _effect_front(c, pal, p["fx"], p["fxT"], hx, hy, chest_x, chest_y, head_y, design)

    # ---- finish -----------------------------------------------------------
    c.clear_below(ANCHOR_Y + 1)
    c.shade_pass(light_dx=-1, amount=0.20)
    c.outline(pal.ink)

    # A transformation has to be recognisable while the fighter is just
    # standing there, so the chakra shroud is drawn into every frame rather
    # than left to the effect system. `shroud` is 0..1 and drives how far it
    # reaches and how many flame tongues rise off it.
    shroud = design.get("shroud")
    if shroud:
        col = pal.aura or hex_to_rgb(design.get("trim", "#7fd4ff"))
        c.halo(shade(col, 1.35), 1)
        if float(shroud) >= 0.55:
            c.halo(shade(col, 0.72), 1)

    c.clear_below(ANCHOR_Y + 1)
    return c


def _shroud_flames(c, pal, d, intensity, head_x, head_y, chest_y, head_r):
    """
    Chakra flames licking up behind the fighter.

    Drawn before the body so a heavy shroud frames the character instead of
    hiding their face — the intensity is meant to read at a glance, not to
    obscure who is wearing it.
    """
    col = pal.aura or hex_to_rgb(d.get("trim", "#7fd4ff"))
    inner = shade(col, 1.3)
    outer = shade(col, 0.72)
    # Narrow tongues hugging the body: a shroud, not a pair of wings. The
    # profile is tallest at the edges so the silhouette stays readable.
    tongues = int(4 + intensity * 7)
    span = head_r * (0.95 + intensity * 0.75)
    for k in range(tongues):
        t = (k + 0.5) / tongues
        bx = head_x - span + span * 2 * t
        by = chest_y + head_r * 1.5
        edge = abs(t - 0.5) * 2
        rise = head_r * (0.8 + intensity * 1.9) * (0.5 + 0.5 * edge)
        c.capsule(bx, by, bx + (t - 0.5) * head_r * 0.8, by - rise,
                  0.45 + intensity * 0.3, inner if k % 2 else outer)
    return c


# ---------------------------------------------------------------------------
# body pieces
# ---------------------------------------------------------------------------

def _torso(c, pal, d, cx, cy, hx, hy, lean, bulk, hs):
    w = 5.0 * bulk
    coat = d.get("coat")

    # Core body as a capsule along the chest->hip axis. A capsule (rather than
    # a trapezoid between two horizontal edges) keeps its shape when the body
    # rotates, which is what a knockdown does to it.
    c.capsule_ink(cx, cy + 1, hx, hy, w * 0.92, pal.outfit, pal.ink)

    # Along-body axis, so clothing detail follows the torso when it tips over.
    ax = hx - cx
    ay = hy - cy
    alen = max(0.001, (ax * ax + ay * ay) ** 0.5)
    ux, uy = ax / alen, ay / alen        # down the body
    px, py = -uy, ux                     # across the body

    def at(down, across=0.0):
        return (cx + ux * down + px * across, cy + uy * down + py * across)

    def band(down, thickness, across, colour):
        a = at(down, -across)
        b = at(down, across)
        c.capsule(a[0], a[1], b[0], b[1], thickness, colour)

    # collar
    band(0.5, 0.9, w * 0.55, pal.trim)

    style = d.get("torso", "zip")
    if style == "zip":
        a = at(1.5)
        b = at(alen - 1.0)
        c.capsule(a[0], a[1], b[0], b[1], 0.4, pal.trim)
    elif style == "vest":
        a = at(2.0)
        b = at(alen - 1.5)
        c.capsule(a[0], a[1], b[0], b[1], w * 0.85, pal.trim)
        c.capsule(a[0], a[1], b[0], b[1], 0.4, shade(pal.trim, 0.72))
    elif style == "wrap":
        for k in range(3):
            band(2.0 + k * 2.2, 0.6, w * 0.9, pal.trim if k % 2 == 0 else pal.outfit2)
    elif style == "open":
        a = at(1.5)
        b = at(alen - 0.5)
        c.capsule(a[0], a[1], b[0], b[1], w * 0.42, pal.outfit2)

    # belt
    band(alen - 0.5, 0.9, w * 0.92, hex_to_rgb(d["sash"]) if d.get("sash") else pal.boots)

    if coat == "flak":
        a = at(1.4)
        b = at(alen * 0.82)
        c.capsule(a[0], a[1], b[0], b[1], w * 0.95, pal.trim)
        c.capsule(a[0], a[1], b[0], b[1], 0.4, shade(pal.trim, 0.72))
    elif coat == "hoodie":
        band(0.0, 1.6, w * 0.8, pal.trim)

    if d.get("markings") == "clouds":
        # the red-cloud coat motif, drawn as original round blobs
        cloud = hex_to_rgb(d.get("cloud", "#b8323c"))
        for down, across in ((3.0, -w * 0.45), (6.0, w * 0.4)):
            mx, my = at(down, across)
            c.ellipse(mx, my, 1.5, 1.1, cloud)


def _boot(c, pal, fx, fy, prone, colour):
    if prone > 0.6:
        c.ellipse_ink(fx, fy, 2.4, 1.5, colour, pal.ink)
        return
    c.ellipse_ink(fx, min(fy, ANCHOR_Y - 1), 2.0, 1.5, colour, pal.ink)
    c.rect(int(fx - 1), int(min(fy, ANCHOR_Y - 1)), 3, 2, colour)


def _head(c, pal, d, f, r, p, anim):
    """Face, eyes, markings, hair and headband, all in the head's own frame."""
    cx, cy = f.p(0, 0)
    c.ellipse_ink(cx, cy, r * 0.86, r * 0.92, pal.skin, pal.ink)
    jx, jy = f.p(0, r * 0.35)
    c.ellipse(jx, jy, r * 0.72, r * 0.55, pal.skin)

    if d.get("mask") == "lower":
        mx, my = f.p(0, r * 0.42)
        c.ellipse(mx, my, r * 0.78, r * 0.5, pal.outfit2)

    def dot(dx, dy, colour, w=2, h=2):
        for ix in range(w):
            for iy in range(h):
                px, py = f.p(dx + ix, dy + iy)
                c.put(int(round(px)), int(round(py)), colour)

    eye_dy = r * 0.12
    right_dx = r * 0.30
    left_dx = -r * 0.16

    if d.get("mask") == "full":
        a = f.p(-r * 0.7, eye_dy)
        b = f.p(r * 0.7, eye_dy)
        c.capsule(a[0], a[1], b[0], b[1], 1.4, pal.outfit2)
        dot(right_dx, eye_dy, (250, 250, 250), 1, 1)
    elif p["prone"] > 0.6 or anim == "defeat":
        # eyes shut
        dot(right_dx, eye_dy, pal.skin_dark, 2, 1)
        dot(left_dx, eye_dy, pal.skin_dark, 2, 1)
    else:
        dot(right_dx, eye_dy, pal.eyes)
        dot(left_dx, eye_dy, pal.eyes)
        dot(right_dx + 1, eye_dy, (255, 255, 255), 1, 1)
        if d.get("markings") in ("sharingan", "rinnegan", "byakugan"):
            dot(right_dx, eye_dy + 1, shade(pal.eyes, 1.6), 1, 1)
            dot(left_dx + 1, eye_dy + 1, shade(pal.eyes, 1.6), 1, 1)

    # brow line — two pixels of expression
    dot(right_dx, eye_dy - 2, pal.hair_dark, 2, 1)
    dot(left_dx, eye_dy - 2, pal.hair_dark, 2, 1)

    marks = d.get("markings")
    if marks == "whiskers":
        for k in (-1, 0, 1):
            dot(r * 0.62, eye_dy + 2 + k, pal.skin_dark, 1, 1)
            dot(-r * 0.52, eye_dy + 2 + k, pal.skin_dark, 1, 1)
    elif marks == "tearlines":
        dot(r * 0.36, eye_dy + 2, pal.skin_dark, 1, 2)
        dot(-r * 0.12, eye_dy + 2, pal.skin_dark, 1, 2)
    elif marks == "sage":
        dot(r * 0.18, eye_dy - 1, hex_to_rgb(d.get("markColor", "#c9603c")), 4, 1)
    elif marks == "seal":
        dot(r * 0.1, -r * 0.55, hex_to_rgb(d.get("markColor", "#6ec7f0")), 1, 1)

    _hair_front(c, pal, d, f, r)
    _headband(c, pal, d, f, r)


def _headband(c, pal, d, f, r):
    band = d.get("headband")
    if not band:
        return
    colour = hex_to_rgb(d.get("bandColor", "#2b3a52"))
    by = -r * 0.56
    slant = band.endswith("slant")
    a = f.p(-r * 0.86, by + (0.9 if slant else 0))
    b = f.p(r * 0.86, by - (0.9 if slant else 0))
    c.capsule(a[0], a[1], b[0], b[1], 1.1, colour)

    # metal plate
    px, py = f.p(r * 0.12 if not slant else -r * 0.46, by)
    c.ellipse(px, py, 2.0, 1.1, pal.metal)
    c.put(int(px), int(py), shade(pal.metal, 0.62))
    if band.startswith("rogue"):
        c.put(int(px + 1), int(py), shade(pal.metal, 0.42))


def _hair_back(c, pal, d, f, r):
    """Hair that hangs behind the head — drawn before the body."""
    style = d.get("hairStyle", "short")
    col = pal.hair
    dark = pal.hair_dark

    def poly(pts):
        c.poly([f.p(dx, dy) for dx, dy in pts], dark)

    def cap(x0, y0, x1, y1, rad, colour=None):
        a = f.p(x0, y0)
        b = f.p(x1, y1)
        c.capsule(a[0], a[1], b[0], b[1], rad, colour or dark)

    if style in ("long", "long-straight", "mane", "hime"):
        poly([(-r * 0.86, -r * 0.25), (r * 0.86, -r * 0.25),
              (r * 0.60, r * 1.75), (-r * 0.72, r * 1.75)])
    elif style in ("ponytail", "spiky-tail"):
        cap(-r * 0.62, -r * 0.1, -r * 1.05, r * 1.35, r * 0.28)
        ex, ey = f.p(-r * 1.05, r * 1.35)
        c.ellipse(ex, ey, r * 0.34, r * 0.42, col)
    elif style == "twin-tails":
        cap(-r * 0.75, 0, -r * 1.15, r * 1.30, r * 0.26)
        cap(r * 0.58, 0, r * 0.98, r * 1.30, r * 0.26)
    elif style in ("wild-mane", "wild"):
        for k in range(-4, 5):
            cap(k * r * 0.18, -r * 0.15, k * r * 0.36, r * (0.95 + abs(k) * 0.12), r * 0.24)
    elif style == "bob":
        ex, ey = f.p(0, r * 0.18)
        c.ellipse(ex, ey, r * 0.95, r * 0.88, dark)


def _hair_front(c, pal, d, f, r):
    style = d.get("hairStyle", "short")
    col = pal.hair
    dark = pal.hair_dark

    def tri(a, b, cc, colour=col):
        c.tri(f.p(*a), f.p(*b), f.p(*cc), colour)

    def ell(dx, dy, rx, ry, colour=col):
        ex, ey = f.p(dx, dy)
        c.ellipse(ex, ey, rx, ry, colour)

    def cap(x0, y0, x1, y1, rad, colour=col):
        a = f.p(x0, y0)
        b = f.p(x1, y1)
        c.capsule(a[0], a[1], b[0], b[1], rad, colour)

    if style == "spiky":
        for k in range(-3, 4):
            bx = k * r * 0.28
            tri((bx - r * 0.2, -r * 0.35), (bx + r * 0.22, -r * 0.35),
                (bx + k * r * 0.10, -r * (1.35 + (3 - abs(k)) * 0.14)))
        ell(0, -r * 0.42, r * 0.9, r * 0.42)
    elif style in ("ducktail", "spiky-tail"):
        ell(0, -r * 0.34, r * 0.94, r * 0.55)
        for k in range(-2, 2):
            tri((k * r * 0.35 - r * 0.1, -r * 0.5),
                (k * r * 0.35 + r * 0.28, -r * 0.5),
                (k * r * 0.35 - r * 0.35, -r * 1.15))
        c.poly([f.p(-r * 0.95, -r * 0.5), f.p(-r * 0.4, -r * 0.55),
                f.p(-r * 1.35, r * 0.65)], dark)
    elif style in ("silver-spike",):
        for k in range(-4, 5):
            bx = k * r * 0.24
            tri((bx - r * 0.18, -r * 0.3), (bx + r * 0.2, -r * 0.3),
                (bx - r * 0.42, -r * (1.0 + (4 - abs(k)) * 0.12)))
        ell(0, -r * 0.38, r * 0.92, r * 0.4)
    elif style in ("wild", "wild-mane"):
        for k in range(-4, 5):
            bx = k * r * 0.24
            tri((bx - r * 0.2, -r * 0.28), (bx + r * 0.22, -r * 0.28),
                (bx + k * r * 0.16, -r * (0.85 + (4 - abs(k)) * 0.10)))
        ell(0, -r * 0.34, r * 0.94, r * 0.44)
    elif style == "bowl":
        ell(0, -r * 0.24, r * 1.0, r * 0.78)
        cap(-r * 0.98, -r * 0.26, r * 0.98, -r * 0.26, 1.0)
    elif style == "bob":
        ell(0, -r * 0.28, r * 1.0, r * 0.72)
        c.poly([f.p(-r * 1.0, -r * 0.4), f.p(-r * 0.35, -r * 0.45),
                f.p(-r * 0.75, r * 0.75)], col)
    elif style in ("long", "long-straight", "hime"):
        ell(0, -r * 0.3, r * 1.0, r * 0.66)
        cap(-r * 0.9, -r * 0.3, -r * 0.9, r * 0.5, 1.0)
        cap(r * 0.82, -r * 0.3, r * 0.82, r * 0.5, 1.0)
    elif style == "ponytail":
        ell(0, -r * 0.3, r * 0.98, r * 0.6)
    elif style == "twin-tails":
        ell(0, -r * 0.32, r * 0.98, r * 0.62)
    elif style == "buzz":
        ell(0, -r * 0.34, r * 0.9, r * 0.44)
    elif style == "bald":
        pass
    else:  # short
        ell(0, -r * 0.3, r * 0.96, r * 0.58)
        cap(-r * 0.92, -r * 0.28, r * 0.92, -r * 0.28, 1.0)

    if d.get("horns"):
        hc = hex_to_rgb(d.get("hornColor", "#e8e2d0"))
        tri((-r * 0.75, -r * 0.7), (-r * 0.45, -r * 0.75), (-r * 1.05, -r * 1.5), hc)
        tri((r * 0.45, -r * 0.7), (r * 0.75, -r * 0.75), (r * 1.0, -r * 1.5), hc)


def _back_accessory(c, pal, d, cx, cy, hy, lean, bulk):
    acc = d.get("accessory")
    if acc == "gourd":
        col = hex_to_rgb(d.get("accColor", "#b08a52"))
        c.ellipse_ink(cx - 8.4 * bulk, cy + 3, 3.9, 5.2, col, pal.ink)
        c.ellipse(cx - 8.4 * bulk, cy - 2.0, 1.9, 1.7, shade(col, 0.78))
        c.capsule(cx - 3, cy + 1, cx + 2, cy + 5, 0.7, shade(col, 0.6))
    elif acc == "sword-back":
        col = hex_to_rgb(d.get("accColor", "#3a4152"))
        c.capsule_ink(cx - 9.0, cy + 5, cx - 1.5, cy - 8, 1.0, col, pal.ink)
        c.capsule(cx - 1.5, cy - 8, cx - 0.5, cy - 10.5, 0.8, pal.trim)
    elif acc == "scroll":
        col = hex_to_rgb(d.get("accColor", "#d8c9a0"))
        c.capsule_ink(cx - 8.2 * bulk, cy + 0, cx - 8.2 * bulk, cy + 6, 1.6, col, pal.ink)
    elif acc == "twin-swords":
        col = hex_to_rgb(d.get("accColor", "#3a4152"))
        c.capsule_ink(cx - 8.0, cy + 6, cx - 1.5, cy - 7.5, 0.9, col, pal.ink)
        c.capsule_ink(cx - 10.0, cy + 5, cx - 4.0, cy - 8.5, 0.9, shade(col, 0.8), pal.ink)
    elif acc == "fan-back":
        col = hex_to_rgb(d.get("accColor", "#8e6a3c"))
        c.capsule_ink(cx - 8.5, cy + 7, cx - 4.5, cy - 8, 1.2, col, pal.ink)
    elif acc == "shoulder-pads":
        c.ellipse(cx - 4.5 * bulk, cy + 0.5, 2.6, 1.8, pal.trim)
        c.ellipse(cx + 4.0 * bulk, cy + 0.5, 2.6, 1.8, pal.trim)


def _cloak(c, pal, d, cx, cy, hy, ground, lean, bulk, p):
    """A coat or cloak hanging behind the fighter, swaying with the pose."""
    colour = hex_to_rgb(d.get("coatColor") or d.get("outfit2") or "#1b2233")
    sway = -lean * 10 - p["shift"] * 0.8
    bottom = min(ground - 6, hy + 7)
    c.poly([
        (cx - 5.0 * bulk, cy - 1),
        (cx + 4.6 * bulk, cy - 1),
        (cx + 4.0 * bulk + sway * 0.4, bottom),
        (cx - 5.2 * bulk + sway, bottom),
    ], colour)
    if d.get("markings") == "clouds":
        cloud = hex_to_rgb(d.get("cloud", "#b8323c"))
        c.ellipse(cx - 3.4, cy + 4, 1.4, 1.0, cloud)
        c.ellipse(cx + 2.4, cy + 7, 1.4, 1.0, cloud)
    if d.get("coatTrim"):
        c.rect(int(cx - 5.2 * bulk), int(bottom - 1), max(2, int(bulk * 10)), 1,
               hex_to_rgb(d["coatTrim"]))


def _weapon(c, pal, d, hx, hy, p, anim):
    w = d.get("weapon")
    if not w or w == "none":
        return
    swing = p["armF"] + p["elbowF"]
    ang = swing - math.pi / 2
    dx = math.sin(ang + math.pi / 2)
    dy = math.cos(ang + math.pi / 2)

    if w in ("katana", "sword", "blade"):
        tipx = hx + dx * 15
        tipy = hy + dy * 15
        c.capsule(hx, hy, tipx, tipy, 0.7, pal.metal)
        c.capsule(hx - dx * 2, hy - dy * 2, hx + dx * 1.5, hy + dy * 1.5, 0.9, pal.ink)
    elif w == "kunai":
        c.capsule(hx, hy, hx + dx * 6, hy + dy * 6, 0.8, pal.metal)
        c.capsule(hx - dx * 2, hy - dy * 2, hx, hy, 0.8, pal.ink)
    elif w == "fan":
        col = hex_to_rgb(d.get("weaponColor", "#e6e1d2"))
        c.poly([(hx, hy), (hx + dx * 12 - dy * 6, hy + dy * 12 + dx * 6),
                (hx + dx * 13 + dy * 5, hy + dy * 13 - dx * 5)], col)
        c.capsule(hx, hy, hx + dx * 4, hy + dy * 4, 0.7, pal.ink)
    elif w == "scythe":
        c.capsule(hx - dx * 6, hy - dy * 6, hx + dx * 12, hy + dy * 12, 0.7, hex_to_rgb("#5b4636"))
        c.capsule(hx + dx * 12, hy + dy * 12, hx + dx * 9 - dy * 6, hy + dy * 9 + dx * 6, 0.8, pal.metal)
    elif w == "staff":
        c.capsule(hx - dx * 8, hy - dy * 8, hx + dx * 12, hy + dy * 12, 0.8, hex_to_rgb(d.get("weaponColor", "#8b5a2b")))
    elif w == "claws":
        for k in (-1, 0, 1):
            c.capsule(hx, hy, hx + dx * 5 + k * 1.2, hy + dy * 5, 0.5, pal.metal)
    elif w == "shuriken":
        col = pal.metal
        for k in range(4):
            a = ang + k * math.pi / 2
            c.capsule(hx, hy, hx + math.sin(a) * 3.4, hy + math.cos(a) * 3.4, 0.6, col)
    elif w == "puppet":
        col = hex_to_rgb(d.get("weaponColor", "#8a6a48"))
        c.ellipse(hx + dx * 6, hy + dy * 6, 2.6, 3.4, col)


# ---------------------------------------------------------------------------
# effects
# ---------------------------------------------------------------------------

def _fx_colour(pal, d):
    return pal.aura or hex_to_rgb(d.get("accent", "#7fd4ff"))


def _effect_back(c, pal, kind, t, cx, cy, head_y, d):
    col = _fx_colour(pal, d)
    if kind == "burst":
        rr = 6 + t * 12
        for k in range(10):
            a = k * math.pi / 5 + t
            c.capsule(cx + math.sin(a) * rr * 0.5, cy + math.cos(a) * rr * 0.5,
                      cx + math.sin(a) * rr, cy + math.cos(a) * rr, 0.7, shade(col, 0.9))
    elif kind == "charge":
        for k in range(8):
            a = k * math.pi / 4 + t * 3
            rr = 10 - t * 4
            c.ellipse(cx + math.sin(a) * rr, cy + math.cos(a) * rr * 0.7, 1.1, 1.1, col)
    elif kind == "pillar":
        h = int(t * 22)
        c.rect(int(cx - 1), int(cy - h), 3, h, shade(col, 1.15))
    elif kind == "guard":
        for k in range(-3, 4):
            c.put(int(cx + 8), int(cy + k * 2), col)


def _effect_front(c, pal, kind, t, hx, hy, cx, cy, head_y, d):
    col = _fx_colour(pal, d)
    hot = shade(col, 1.45)

    if kind == "slash":
        for k in range(6):
            a = -0.9 + k * 0.32
            rr = 9 * t + 3
            c.put(int(hx + math.cos(a) * rr), int(hy + math.sin(a) * rr), hot)
            c.put(int(hx + math.cos(a) * (rr - 1)), int(hy + math.sin(a) * (rr - 1)), col)
    elif kind == "impact":
        rr = 3 + t * 5
        for k in range(8):
            a = k * math.pi / 4
            c.capsule(hx + math.sin(a) * rr * 0.4, hy + math.cos(a) * rr * 0.4,
                      hx + math.sin(a) * rr, hy + math.cos(a) * rr, 0.6, hot)
    elif kind == "orb":
        c.ellipse(hx + 2, hy, 3.4 * t + 1.2, 3.4 * t + 1.2, col)
        c.ellipse(hx + 2, hy, 2.0 * t, 2.0 * t, hot)
    elif kind == "seal":
        c.ellipse(hx, hy, 2.2, 2.2, hot)
    elif kind == "wave":
        for k in range(5):
            yy = int(hy - 4 + k * 2)
            c.rect(int(hx + 2 + k * 0.5), yy, int(3 + t * 5), 1, col if k % 2 else hot)
    elif kind == "beam":
        c.rect(int(hx), int(hy - 2), int(4 + t * 22), 5, col)
        c.rect(int(hx), int(hy - 1), int(4 + t * 22), 3, hot)
    elif kind == "speed":
        for k in range(4):
            yy = int(cy + k * 4 - 4)
            c.rect(int(cx - 12 - k), yy, int(3 + t * 4), 1, shade(col, 1.2))
    elif kind == "guard":
        for k in range(-4, 5):
            c.put(int(cx + 7), int(cy + k * 1.6), hot if k % 2 else col)
    elif kind == "dust":
        for k in range(6):
            a = k * math.pi / 3
            rr = 4 + t * 6
            c.ellipse(cx + math.sin(a) * rr * 1.6, ANCHOR_Y - 2 - abs(math.cos(a)) * 2,
                      1.4 * t + 0.6, 1.0 * t + 0.5, shade(col, 0.85))
    elif kind == "shatter":
        for k in range(7):
            a = -0.4 + k * 0.42
            rr = 7 + t * 6
            c.capsule(cx + math.cos(a) * rr * 0.55, cy + math.sin(a) * rr * 0.55,
                      cx + math.cos(a) * rr, cy + math.sin(a) * rr, 0.6, hot)
    elif kind == "burst":
        rr = 4 + t * 7
        c.ellipse(cx, cy, rr, rr * 1.3, None) if False else None
        for k in range(6):
            a = k * math.pi / 3 - t
            c.capsule(cx, cy, cx + math.sin(a) * rr, cy + math.cos(a) * rr, 0.6, hot)
