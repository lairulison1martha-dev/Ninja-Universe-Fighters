"""
Per-fighter design records.

A design is the input to the art rig: palette, hair shape, coat, accessories,
proportions, face markings. Two fighters with different designs get different
silhouettes, not just different colours — that is the whole point of this file.

The twenty starters are authored by hand from the reference direction (colour
families, hair shape, signature gear). Everyone else is derived from the roster
data the game already ships — each entry's own `colors` and `visual` block —
with the remaining choices hashed off the fighter id so they stay distinct from
one another and stable between builds.

Nothing here is traced, sampled or copied from any image: every value is a
number typed into this file, and every pixel is drawn by fighter_art.py.
"""

import hashlib

# ---------------------------------------------------------------------------
# The first complete pass: twenty hand-authored designs.
# ---------------------------------------------------------------------------

HAND = {
    "naruto": dict(
        skin="#f0c090", hair="#f5cf4a", hairStyle="spiky",
        outfit="#e8722a", outfit2="#1f2740", trim="#2b3550", pants="#e8722a",
        boots="#232a3c", eyes="#3f7fd0", torso="zip", sleeves="long",
        headband="leaf", bandColor="#2b4a86", markings="whiskers",
        aura="#ffb020", height=1.0, bulk=1.0,
    ),
    "sasuke": dict(
        skin="#efc9a4", hair="#242a3a", hairStyle="ducktail",
        outfit="#20263a", outfit2="#12162a", trim="#4a3f7a", pants="#2b3247",
        boots="#1a1e2c", eyes="#3a2030", torso="open", sleeves="short",
        headband=None, accessory="sword-back", accColor="#3b4258",
        sash="#5a4a9a", aura="#7a5cff", height=1.02, bulk=0.98,
    ),
    "sakura": dict(
        skin="#f4d1b0", hair="#f09ab4", hairStyle="bob",
        outfit="#d0455c", outfit2="#a8354a", trim="#f2e2d0", pants="#d0455c",
        boots="#3a2a34", eyes="#4c9a63", torso="zip", sleeves="short",
        headband="leaf", bandColor="#b8324a", markings=None,
        aura="#ff6f96", height=0.96, bulk=0.92,
    ),
    "kakashi": dict(
        skin="#f0c9a6", hair="#d8dce6", hairStyle="silver-spike",
        outfit="#2c3448", outfit2="#1c2233", trim="#4a6b3e", pants="#2c3448",
        boots="#1a1e2c", eyes="#39424f", torso="vest", sleeves="long",
        coat="flak", headband="leaf-slant", bandColor="#2b4a86",
        mask="lower", aura="#8fd0ff", height=1.06, bulk=1.0,
    ),
    "lee": dict(
        skin="#eec49a", hair="#1c2030", hairStyle="bowl",
        outfit="#2f7a44", outfit2="#215c33", trim="#e08a30", pants="#2f7a44",
        boots="#2a2f3c", eyes="#2a3550", torso="zip", sleeves="long",
        headband=None, sash="#2f5f8a", aura="#5fe07a",
        height=1.0, bulk=1.04,
    ),
    "gaara": dict(
        skin="#f2cdaa", hair="#c0392f", hairStyle="wild",
        outfit="#7a2530", outfit2="#4e1a22", trim="#c8b28a", pants="#3a2630",
        boots="#2b2028", eyes="#6fb7c0", torso="wrap", sleeves="long",
        accessory="gourd", accColor="#b08a52", headband=None,
        markings="seal", markColor="#b83a3a", aura="#d8b06a",
        height=0.98, bulk=1.0,
    ),
    "itachi": dict(
        skin="#f0cba8", hair="#1a1d2c", hairStyle="ponytail",
        outfit="#181c2b", outfit2="#0f1220", trim="#3a3f55", pants="#1c2030",
        boots="#14172a", eyes="#b8323c", torso="zip", sleeves="long",
        coat="akatsuki", coatColor="#14182a", markings="clouds", cloud="#b8323c",
        headband="rogue-slant", bandColor="#2b3550",
        aura="#c2404a", height=1.04, bulk=0.96,
    ),
    "pain": dict(
        skin="#eecfae", hair="#e0672a", hairStyle="silver-spike",
        outfit="#181c2b", outfit2="#0f1220", trim="#3a3f55", pants="#1c2030",
        boots="#14172a", eyes="#8a72c8", torso="zip", sleeves="long",
        coat="akatsuki", coatColor="#14182a", markings="clouds", cloud="#b8323c",
        aura="#9a7ad8", height=1.02, bulk=1.0,
    ),
    "madara": dict(
        skin="#eec9a8", hair="#1e2130", hairStyle="wild-mane",
        outfit="#8a2b34", outfit2="#1b2030", trim="#c4a45c", pants="#20263a",
        boots="#171b28", eyes="#c8404a", torso="wrap", sleeves="long",
        coat="cloak", coatColor="#7a232c", accessory="shoulder-pads",
        aura="#d8404a", height=1.08, bulk=1.06,
    ),
    "boruto": dict(
        skin="#f2c99e", hair="#f2d05a", hairStyle="spiky",
        outfit="#1e2434", outfit2="#151a28", trim="#e8722a", pants="#2a3244",
        boots="#1a1e2c", eyes="#4a9ad8", torso="open", sleeves="short",
        markings="seal", markColor="#6ec7f0", aura="#5ac8f0",
        height=0.94, bulk=0.92,
    ),
    "kawaki": dict(
        skin="#e8b98d", hair="#22262f", hairStyle="short",
        outfit="#3a4038", outfit2="#242a26", trim="#8a9a6a", pants="#2a2f38",
        boots="#1e222c", eyes="#7a8494", torso="open", sleeves="short",
        markings="seal", markColor="#3a3f55", aura="#6a7a94",
        height=1.02, bulk=1.02,
    ),
    "momoshiki": dict(
        skin="#f2e6de", hair="#e8e4ee", hairStyle="long-straight",
        outfit="#e6e2ea", outfit2="#8f8aa0", trim="#c8a44c", pants="#b6b0c4",
        boots="#8a8496", eyes="#c4404a", torso="wrap", sleeves="long",
        coat="robe", coatColor="#dcd6e4", horns=True, hornColor="#e8e2d0",
        aura="#b06ad8", height=1.06, bulk=0.96,
    ),
    "minato": dict(
        skin="#f0c79c", hair="#f5cf4a", hairStyle="spiky",
        outfit="#2b4a86", outfit2="#e8e4dc", trim="#c8402a", pants="#2b4a86",
        boots="#22283a", eyes="#4a9ad8", torso="vest", sleeves="long",
        coat="cloak", coatColor="#ece8de", coatTrim="#c8402a",
        headband="leaf", bandColor="#2b4a86", aura="#ffd45e",
        height=1.04, bulk=0.98,
    ),
    "hashirama": dict(
        skin="#eec39a", hair="#3a2c26", hairStyle="long",
        outfit="#8a2f30", outfit2="#2a2430", trim="#c0a060", pants="#2e2a38",
        boots="#1f1c26", eyes="#3a2f28", torso="wrap", sleeves="long",
        accessory="shoulder-pads", aura="#6fc06a",
        height=1.06, bulk=1.08,
    ),
    "guy": dict(
        skin="#eec49a", hair="#1c2030", hairStyle="bowl",
        outfit="#2f7a44", outfit2="#215c33", trim="#4a6b3e", pants="#2f7a44",
        boots="#2a2f3c", eyes="#2a3550", torso="vest", sleeves="long",
        coat="flak", sash="#2f5f8a", aura="#5fe07a",
        height=1.04, bulk=1.10,
    ),
    "bee": dict(
        skin="#8a5a3c", hair="#e8e2d4", hairStyle="buzz",
        outfit="#f0ece2", outfit2="#3a3f4c", trim="#c4302c", pants="#2e3442",
        boots="#22283a", eyes="#2a3550", torso="wrap", sleeves="short",
        accessory="twin-swords", accColor="#5a4638",
        headband="cloud", bandColor="#e8e4dc",
        aura="#c86a3a", height=1.08, bulk=1.14,
    ),
    "obito": dict(
        skin="#efc9a4", hair="#22263a", hairStyle="wild",
        outfit="#1c2233", outfit2="#12162a", trim="#3a3f55", pants="#1e2434",
        boots="#14172a", eyes="#c8404a", torso="zip", sleeves="long",
        coat="cloak", coatColor="#141a2c", aura="#d0603a",
        height=1.04, bulk=1.0,
    ),
    "jiraiya": dict(
        skin="#f0c79c", hair="#e8e4dc", hairStyle="wild-mane",
        outfit="#2f6a48", outfit2="#8a2f30", trim="#c0a060", pants="#3a3f4c",
        boots="#2a2f3c", eyes="#3a2f28", torso="wrap", sleeves="long",
        coat="cloak", coatColor="#8a2f30", accessory="scroll", accColor="#d8c9a0",
        headband="rogue", bandColor="#c0a060", markings="tearlines",
        aura="#e8b04a", height=1.08, bulk=1.12,
    ),
    "orochimaru": dict(
        skin="#e8e2d8", hair="#1a1d2c", hairStyle="long-straight",
        outfit="#d8cdb4", outfit2="#8a7f66", trim="#6a4a86", pants="#3a3546",
        boots="#2a2632", eyes="#c8b03a", torso="wrap", sleeves="long",
        sash="#6a4a86", aura="#8ad06a", markings="tearlines",
        height=1.04, bulk=0.94,
    ),
    "white_zetsu": dict(
        skin="#e8ece4", hair="#dfe6da", hairStyle="bald",
        outfit="#3f4a3c", outfit2="#2a3228", trim="#8fa07e", pants="#2f382c",
        boots="#232a20", eyes="#c9d84a", torso="wrap", sleeves="long",
        coat="cloak", coatColor="#dfe6da", aura="#9fd06a",
        height=1.0, bulk=1.0,
    ),
    "black_zetsu": dict(
        skin="#2a2f38", hair="#1a1e26", hairStyle="wild",
        outfit="#20242c", outfit2="#12151b", trim="#5a6270", pants="#1a1e26",
        boots="#101319", eyes="#e8e4dc", torso="wrap", sleeves="long",
        coat="cloak", coatColor="#171b22", aura="#7a8494",
        height=1.0, bulk=1.0,
    ),
    "tsunade": dict(
        skin="#f4d0ae", hair="#f0d878", hairStyle="twin-tails",
        outfit="#4a7a5c", outfit2="#2a4a6a", trim="#e8e4dc", pants="#2f4a66",
        boots="#3a3040", eyes="#8a6a3c", torso="wrap", sleeves="short",
        coat="cloak", coatColor="#3f6a52", markings="seal", markColor="#7a5ad0",
        aura="#6ad0a0", height=1.02, bulk=0.96,
    ),
}

FIRST_PASS = list(HAND.keys())

# ---------------------------------------------------------------------------
# Derived designs for the rest of the roster
# ---------------------------------------------------------------------------

# The roster's own hairStyle vocabulary mapped onto the rig's shapes.
HAIR_MAP = {
    "spiky": "spiky", "long": "long", "ponytail": "ponytail", "bowl": "bowl",
    "wild": "wild", "braided": "twin-tails", "hooded": "short",
    "bald": "bald", "short": "short",
}

WEAPON_MAP = {
    "none": None, "sword": "katana", "kunai": "kunai", "fan": "fan",
    "scythe": "scythe", "staff": "staff", "puppet": "puppet",
    "claws": "claws", "blades": "twin-blades",
}

# Variation pools. Indexing these by a hash of the fighter id is what keeps
# 172 derived designs from collapsing into the same silhouette.
TORSO = ["zip", "vest", "wrap", "open"]
SLEEVES = ["long", "long", "short"]
COATS = [None, None, "flak", "cloak", "hoodie", "coat"]
BANDS = [None, "leaf", "leaf-slant", "rogue", "cloud", "sand"]
ACCESSORIES = [None, None, "scroll", "sword-back", "shoulder-pads", "fan-back"]
HAIRS = ["short", "spiky", "long", "ponytail", "wild", "bowl", "bob",
         "twin-tails", "buzz", "long-straight", "wild-mane", "ducktail"]
MARKS = [None, None, None, "tearlines", "seal", "sage"]


def _hash(fid):
    return int(hashlib.sha1(fid.encode()).hexdigest(), 16)


def derive(entry):
    """Build a design from a roster entry (the parsed fighter.js record)."""
    c = entry["colors"]
    v = entry.get("visual", {})
    h = _hash(entry["id"])

    def pick(pool, shift):
        return pool[(h >> shift) % len(pool)]

    hair_style = HAIR_MAP.get(v.get("hairStyle"), "short")
    # Nudge some fighters off the roster's nine hairstyles so the derived half
    # of the cast is not visibly built from a small set.
    if (h >> 3) % 3 == 0:
        hair_style = pick(HAIRS, 5)

    coat = pick(COATS, 11)
    if v.get("cape"):
        coat = "cloak"

    design = dict(
        skin=c.get("skin", "#e8b98d"),
        hair=c.get("hair", "#2a2f3a"),
        hairStyle=hair_style,
        outfit=c["primary"],
        outfit2=c.get("secondary"),
        trim=c.get("accent"),
        pants=c.get("secondary"),
        boots="#242a36",
        eyes=c.get("accent", "#2a3550"),
        aura=c.get("aura"),
        torso=pick(TORSO, 17),
        sleeves=pick(SLEEVES, 23),
        coat=coat,
        coatColor=c.get("secondary"),
        headband=pick(BANDS, 29),
        bandColor=c.get("secondary"),
        accessory=pick(ACCESSORIES, 37),
        accColor=c.get("accent"),
        weapon=WEAPON_MAP.get(v.get("weapon"), None),
        weaponColor=c.get("accent"),
        markings=MARKS[(h >> 41) % len(MARKS)],
        markColor=c.get("aura"),
        height=v.get("height", 1.0),
        bulk=v.get("bulk", 1.0),
    )
    if v.get("markings") == "stripes":
        design["torso"] = "wrap"
    elif v.get("markings") == "seal":
        design["markings"] = "seal"
    return design


def for_fighter(entry):
    """The design for a roster entry: hand-authored if we have one."""
    d = dict(derive(entry))
    hand = HAND.get(entry["id"])
    if hand:
        d.update(hand)
        # Hand designs opt in to gear explicitly; drop anything the derived
        # pass guessed that the author did not ask for.
        for key in ("weapon", "accessory", "coat", "headband", "markings"):
            if key not in hand:
                d[key] = None
    d["id"] = entry["id"]
    d["name"] = entry["displayName"]
    d["hand"] = entry["id"] in HAND
    return d


# ---------------------------------------------------------------------------
# Costume and transformation variants
# ---------------------------------------------------------------------------
#
# A variant is a partial design record layered over the fighter's base design.
# That is what makes a costume real artwork rather than a colour filter: it can
# change clothing cut, gear, hair, proportions and palette all at once, and the
# rig redraws every animation from the merged record.
#
# Only variants listed here get their own sprite set. Anything else falls back
# to the fighter's base art and is reported as a fallback in the asset manifest
# — never as finished work.

COSTUME_DESIGNS = {
    # -- Naruto ------------------------------------------------------------
    ("naruto", "kid"): dict(
        outfit="#e86a1e", outfit2="#2b4a86", trim="#2b4a86", pants="#e86a1e",
        torso="zip", sleeves="long", height=0.86, bulk=0.88,
    ),
    ("naruto", "shippuden"): dict(
        outfit="#e8722a", outfit2="#1f2740", trim="#1f2740", pants="#1f2740",
        torso="open", sleeves="long", height=1.0, bulk=1.0,
    ),
    ("naruto", "hokage"): dict(
        outfit="#e8722a", outfit2="#2b3550", trim="#c8402a",
        coat="cloak", coatColor="#ece8de", coatTrim="#c8402a",
        torso="vest", sleeves="long", height=1.04, bulk=1.04,
    ),
    # -- Sasuke ------------------------------------------------------------
    ("sasuke", "kid"): dict(
        outfit="#2f5f9a", outfit2="#e4e0d6", trim="#e4e0d6", pants="#e4e0d6",
        torso="zip", sleeves="short", accessory=None,
        height=0.86, bulk=0.86,
    ),
    ("sasuke", "shippuden"): dict(
        outfit="#e8e4dc", outfit2="#2b3247", trim="#5a4a9a", pants="#2b3247",
        torso="open", sleeves="short", accessory="sword-back", sash="#5a4a9a",
        height=1.02, bulk=0.98,
    ),
    ("sasuke", "adult"): dict(
        outfit="#2a2f42", outfit2="#161a28", trim="#6a5a3a",
        coat="cloak", coatColor="#3a3020", torso="wrap", sleeves="long",
        accessory="sword-back", height=1.06, bulk=1.02,
    ),
    # -- Sakura ------------------------------------------------------------
    ("sakura", "genin"): dict(
        outfit="#c8394f", outfit2="#8e2a3c", trim="#e8dcc8", pants="#2f3a52",
        torso="wrap", sleeves="short", height=0.88, bulk=0.86,
    ),
    ("sakura", "shippuden"): dict(
        outfit="#d0455c", outfit2="#a8354a", trim="#f2e2d0", pants="#3a4460",
        torso="zip", sleeves="short", height=0.96, bulk=0.92,
    ),
    # -- Kakashi -----------------------------------------------------------
    ("kakashi", "jonin"): dict(
        outfit="#2c3448", outfit2="#1c2233", trim="#4a6b3e",
        coat="flak", torso="vest", height=1.06, bulk=1.0,
    ),
    ("kakashi", "hokage"): dict(
        outfit="#2c3448", outfit2="#1c2233", trim="#c8402a",
        coat="cloak", coatColor="#ece8de", coatTrim="#c8402a",
        torso="vest", height=1.06, bulk=1.02,
    ),
    # -- Gaara -------------------------------------------------------------
    ("gaara", "genin"): dict(
        outfit="#4e2630", outfit2="#2f1a22", trim="#c8b28a", pants="#332028",
        torso="wrap", sleeves="long", accessory="gourd", accColor="#b08a52",
        height=0.9, bulk=0.9,
    ),
    ("gaara", "kazekage"): dict(
        outfit="#e4e0d2", outfit2="#5a7a9a", trim="#3f5f86", pants="#4a6a8a",
        coat="cloak", coatColor="#e8e4d8", coatTrim="#3f5f86",
        torso="wrap", accessory="gourd", accColor="#b08a52",
        height=1.02, bulk=1.02,
    ),
    # -- Hinata ------------------------------------------------------------
    ("hinata", "genin"): dict(
        outfit="#e6dfc8", outfit2="#3a4258", trim="#8fa0b8", pants="#2f3648",
        coat="hoodie", torso="zip", sleeves="long", height=0.88, bulk=0.88,
    ),
    ("hinata", "shippuden"): dict(
        outfit="#8e7fc0", outfit2="#3a4258", trim="#e6dfc8", pants="#2f3648",
        coat="hoodie", torso="zip", sleeves="long", height=0.98, bulk=0.94,
    ),
    # -- Obito -------------------------------------------------------------
    ("obito", "young"): dict(
        outfit="#2f5f9a", outfit2="#1c2c48", trim="#c8a44c", pants="#e4e0d6",
        coat=None, torso="zip", sleeves="short", mask=None,
        height=0.9, bulk=0.9,
    ),
    ("obito", "masked"): dict(
        outfit="#1c2233", outfit2="#12162a", trim="#d0603a",
        coat="cloak", coatColor="#141a2c", mask="full", torso="zip",
        height=1.04, bulk=1.0,
    ),
    # -- Madara ------------------------------------------------------------
    ("madara", "valley"): dict(
        outfit="#8a2b34", outfit2="#1b2030", trim="#c4a45c",
        coat="cloak", coatColor="#7a232c", accessory="shoulder-pads",
        torso="wrap", height=1.08, bulk=1.10,
    ),
    ("madara", "war"): dict(
        outfit="#3a2f4a", outfit2="#1b1826", trim="#9a8ab0",
        coat="cloak", coatColor="#2a2438", accessory="fan-back", accColor="#8e6a3c",
        torso="wrap", height=1.10, bulk=1.06,
    ),
}

# Transformation variants. An awakening changes the fighter visibly — a cloak
# of chakra, a curse mark spreading, an armour of sand — so each of these gets
# its own sheet rather than reusing the base body under a coloured overlay.
FORM_DESIGNS = {
    # Naruto chakra modes
    "naruto_sage": dict(markings="sage", markColor="#c9603c", eyes="#e8a23c",
                        aura="#e8a23c", trim="#c9603c"),
    "naruto_kcm1": dict(outfit="#f5c542", outfit2="#e08a20", trim="#2b3550",
                        pants="#f5c542", aura="#ffd45e", eyes="#f5e08a",
                        markings="stripes"),
    "naruto_kcm2": dict(outfit="#ffd45e", outfit2="#e8952a", trim="#1f2740",
                        pants="#ffd45e", aura="#ffe08a", eyes="#fff0b0",
                        markings="stripes", bulk=1.08),
    "naruto_sixpaths": dict(outfit="#ffd45e", outfit2="#2b2f42", trim="#e8952a",
                            pants="#ffd45e", aura="#fff0b0", eyes="#fff6d0",
                            coat="cloak", coatColor="#f5c542",
                            markings="sage", markColor="#c9603c", bulk=1.10),
    "naruto_baryon": dict(outfit="#e85a2a", outfit2="#8a2318", trim="#ffb84a",
                          pants="#e85a2a", aura="#ff6a2a", eyes="#ffd45e",
                          coat="cloak", coatColor="#c03a1a", bulk=1.06),
    "naruto_onetail": dict(outfit="#c8502a", outfit2="#7a2a18", trim="#e87a3a",
                           pants="#c8502a", aura="#e8602a", eyes="#f5e08a",
                           markings="whiskers"),
    "naruto_fourtail": dict(outfit="#9a2f1a", outfit2="#5a1a10", trim="#d0502a",
                            pants="#9a2f1a", aura="#d8401a", eyes="#ffffff",
                            coat="cloak", coatColor="#8a2418", bulk=1.08),
    # Sasuke eye stages and curse mark
    "sasuke_sharingan": dict(eyes="#c8303a", markings="sharingan"),
    "sasuke_mangekyo": dict(eyes="#d0303a", markings="sharingan", aura="#c8303a"),
    "sasuke_ems": dict(eyes="#e03a44", markings="sharingan", aura="#d0303a",
                       trim="#8a2a32"),
    "sasuke_rinnegan": dict(eyes="#8a6ad0", markings="rinnegan", aura="#7a5cff",
                            coat="cloak", coatColor="#241c3a"),
    "sasuke_cm1": dict(skin="#c8b8a0", markings="tearlines", eyes="#c8b03a",
                       aura="#8a6ad0"),
    "sasuke_cm2": dict(skin="#8a7a96", hair="#b0a0c0", markings="tearlines",
                       eyes="#c8b03a", aura="#6a4a86", bulk=1.10),
    # Sakura
    "sakura_byakugo": dict(markings="seal", markColor="#7a5ad0", aura="#c86ad0"),
    "sakura_hundred": dict(markings="seal", markColor="#7a5ad0", aura="#e86ad0",
                           trim="#c86ad0", bulk=1.04),
    # Kakashi eye stages and Susanoo
    "kakashi_sharingan": dict(eyes="#c8303a", markings="sharingan"),
    "kakashi_mangekyo": dict(eyes="#d0303a", markings="sharingan", aura="#c8303a"),
    "kakashi_double_mangekyo": dict(eyes="#d0303a", markings="sharingan",
                                    aura="#8fd0ff", trim="#8fd0ff"),
    "kakashi_susanoo": dict(outfit="#5a7ad0", outfit2="#2f4a8a", trim="#8fb8ff",
                            coat="cloak", coatColor="#4a6ac0", aura="#8fd0ff",
                            bulk=1.16, height=1.10),
    # Eight Gates
    "guy_gate1": dict(skin="#f0a898", aura="#e8503a"),
    "guy_gate4": dict(skin="#e88a72", aura="#e8402a", coat="cloak",
                      coatColor="#c8341f", bulk=1.12),
    "guy_gate6": dict(skin="#e07a62", aura="#f05a2a", coat="cloak",
                      coatColor="#d8401a", bulk=1.14),
    "guy_gate8": dict(skin="#f0d0a0", hair="#f5e0a0", aura="#ff8a2a",
                      coat="cloak", coatColor="#e8602a", trim="#ffd45e",
                      bulk=1.18, height=1.06),
    "lee_gate1": dict(skin="#f0a898", aura="#e8503a"),
    "lee_gate4": dict(skin="#e88a72", aura="#e8402a", coat="cloak",
                      coatColor="#c8341f", bulk=1.10),
    "lee_gate6": dict(skin="#e07a62", aura="#f05a2a", coat="cloak",
                      coatColor="#d8401a", bulk=1.12),
    # Gaara sand
    "gaara_sand_armor": dict(skin="#c8a878", outfit="#b09060", outfit2="#7a6038",
                             trim="#d8c090", bulk=1.10, aura="#d8b06a"),
    "gaara_partial_shukaku": dict(skin="#d8bc86", outfit="#c0a068",
                                  outfit2="#8a6a40", trim="#e8d0a0",
                                  markings="stripes", bulk=1.20, height=1.06,
                                  aura="#e8c878"),
    # Jinchuriki cloaks
    "bee_v1": dict(outfit="#c8502a", outfit2="#7a2a18", trim="#e87a3a",
                   pants="#c8502a", aura="#e8602a"),
    "bee_v2": dict(outfit="#9a2f1a", outfit2="#5a1a10", trim="#d0502a",
                   pants="#9a2f1a", aura="#d8401a", coat="cloak",
                   coatColor="#8a2418", bulk=1.10),
    "minato_kcm": dict(outfit="#f5c542", outfit2="#e08a20", trim="#2b3550",
                       pants="#f5c542", aura="#ffd45e", eyes="#f5e08a"),
    # Susanoo
    "itachi_susanoo": dict(outfit="#c8402a", outfit2="#8a2418", trim="#e8703a",
                           coat="cloak", coatColor="#b8341f", aura="#e8503a",
                           bulk=1.16, height=1.10),
    "madara_susanoo": dict(outfit="#3a6ad0", outfit2="#1f3a7a", trim="#6a9aff",
                           coat="cloak", coatColor="#2f5ac0", aura="#5a8aff",
                           bulk=1.18, height=1.12),
    # Sage modes
    "jiraiya_sage": dict(markings="sage", markColor="#c9603c", eyes="#e8a23c",
                         aura="#e8a23c", skin="#e8b884"),
    "kabuto_sage": dict(skin="#d8d0c0", markings="sage", markColor="#8ad06a",
                        eyes="#c8b03a", aura="#8ad06a"),
    # Curse mark (Orochimaru's line)
    "orochimaru_serpent": dict(skin="#e8e8dc", hair="#e8e8dc", outfit="#c8c8b8",
                               outfit2="#8a8a78", aura="#8ad06a", bulk=1.12),
    # Karma
    "boruto_karma": dict(markings="seal", markColor="#3a3f55", eyes="#5ac8f0",
                         aura="#5ac8f0"),
    "kawaki_karma": dict(markings="seal", markColor="#3a3f55", eyes="#c8404a",
                         aura="#c8404a"),
}


def variant(base_design, override):
    """Layer a costume or transformation override over a base design."""
    d = dict(base_design)
    d.update({k: v for k, v in override.items()})
    return d
