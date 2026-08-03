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
#
# These were written before the shroud existed and they name only the keys the
# author cared about. They are merged *over* the derived override rather than
# replacing it (see `merge_form` / `merge_costume`), so escalation and aura
# still come from the rules and a hand-authored key always wins where it is set.
FORM_DESIGNS = ({
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
})


def variant(base_design, override):
    """Layer a costume or transformation override over a base design."""
    d = dict(base_design)
    d.update({k: v for k, v in override.items()})
    return d


# ---------------------------------------------------------------------------
# Deriving a variant design for every costume and every transformation
# ---------------------------------------------------------------------------
#
# 75 costumes and 157 transformations is more than can be hand-authored one at
# a time, but "generate them" must not mean "recolour the base body". So each
# rule below is written from what the variant *is*: an Eight Gate reddens the
# skin and adds a chakra shroud that grows with the gate number, an Edo Tensei
# costume greys the skin and cracks the face, a Susanoo state adds armour and
# real bulk, a kage costume adds the cloak.
#
# The hand-authored entries above always win; these fill in everything else.

import colorsys


def _hex(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(v))) for v in rgb)


def _rgb(value):
    v = value.lstrip("#")
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def _shift(value, dh=0.0, ds=1.0, dl=1.0):
    """Nudge a colour in HLS space — used to derive related shades."""
    r, g, b = (c / 255 for c in _rgb(value))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h + dh) % 1.0
    l = max(0.04, min(0.96, l * dl))
    s = max(0.0, min(1.0, s * ds))
    return _hex(tuple(c * 255 for c in colorsys.hls_to_rgb(h, l, s)))


def _blend(a, b, t):
    ra, ga, ba = _rgb(a)
    rb, gb, bb = _rgb(b)
    return _hex((ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t))


# Chakra-shroud palettes by tail count / intensity, warmest first.
CLOAK_RAMP = ["#e8a23c", "#e8722a", "#d0501f", "#b03418", "#8a2412"]

AWAKEN_FLAVOURS = ["shroud", "battle_coat", "marked", "armoured", "focused"]


def form_override(form, base):
    """
    The design for one transformation, derived from what the form is.

    `form` is a row from tools/variants.json: id, fighterId, displayName,
    auraColor, index, chainLength.
    """
    # Match on the form's own words only. The id is prefixed with the fighter
    # id, and leaving that in makes a fighter whose name is also a keyword —
    # "hashirama" — match the wood rule on *every* one of their forms, which
    # collapses that fighter's whole chain into one look.
    short_id = form["id"]
    if short_id.startswith(f"{form['fighterId']}_"):
        short_id = short_id[len(form["fighterId"]) + 1:]
    name = f"{form['displayName']} {short_id}".lower()
    aura = form.get("auraColor") or base.get("aura") or "#7fd4ff"
    # How far up its own chain this form sits, 0..1 — every escalating theme
    # uses it so a chain reads as an escalation rather than five recolours.
    depth = (form["index"] + 1) / max(1, form["chainLength"])
    # Every form is shrouded — that is what makes an awakening readable at a
    # glance — and later forms in a chain burn brighter than earlier ones.
    # A one-form chain is not an escalation, so it does not get the top of the
    # ramp: at full intensity the flames swallow the arms and torso, and the
    # 88 fighters who carry the generic single awakening would read as 88
    # identical blue fires instead of 88 different people powering up.
    shroud = 0.50 if form["chainLength"] <= 1 else 0.30 + 0.55 * depth
    o = {"aura": aura, "shroud": round(shroud, 3)}

    def has(*words):
        return any(w in name for w in words)

    # ---- eye awakenings ---------------------------------------------------
    if has("rinne sharingan"):
        o.update(eyes="#e04a8a", markings="rinnegan", markColor="#e04a8a",
                 coat="cloak", coatColor=_shift(aura, dl=0.5),
                 horns=True, hornColor="#e8e2d0", bulk=base.get("bulk", 1) * 1.06)
    elif has("rinnegan"):
        o.update(eyes="#8a6ad0", markings="rinnegan", markColor="#8a6ad0",
                 coat="cloak", coatColor=_shift(base.get("outfit2", "#20263a"), dl=0.8),
                 trim="#7a5cff")
    elif has("eternal mangekyo", "ems"):
        o.update(eyes="#e03a44", markings="sharingan", trim="#8a2a32",
                 coat="cloak", coatColor=_shift(base.get("outfit", "#333"), dl=0.55))
    elif has("mangekyo"):
        o.update(eyes="#d0303a", markings="sharingan", trim="#b8323c")
    elif has("sharingan"):
        o.update(eyes="#c8303a", markings="sharingan")
    elif has("byakugan", "tenseigan"):
        o.update(eyes="#d8e4f0", markings="byakugan", markColor="#a8c8e8",
                 trim="#a8c8e8")

    # ---- avatars and armour ----------------------------------------------
    if has("susanoo"):
        o.update(coat="cloak", coatColor=_shift(aura, dl=0.6),
                 outfit=_blend(base.get("outfit", "#333"), aura, 0.55),
                 trim=_shift(aura, dl=1.4), accessory="shoulder-pads",
                 bulk=base.get("bulk", 1) * (1.10 + 0.08 * depth),
                 height=base.get("height", 1) * (1.04 + 0.05 * depth))
    elif has("ten-tails", "juubi", "ten tails"):
        o.update(hair="#e8e4dc", skin="#d8d4c8", eyes="#e8e0a0",
                 outfit="#d0ccc0", outfit2="#8a8478", trim="#c8b06a",
                 horns=True, hornColor="#e8e2d0", coat="cloak", coatColor="#c8c4b8",
                 hairStyle="wild-mane", bulk=base.get("bulk", 1) * 1.22,
                 height=base.get("height", 1) * 1.10, markings="rinnegan")
    elif has("six paths"):
        o.update(outfit=_blend(base.get("outfit", "#333"), "#ffd45e", 0.5),
                 trim="#fff0b0", coat="cloak", coatColor="#f5c542",
                 markings="sage", markColor="#c9603c", accessory="shoulder-pads",
                 bulk=base.get("bulk", 1) * 1.10)

    # ---- the Eight Gates --------------------------------------------------
    if has("gate"):
        # Gate number drives everything: skin reddens, the shroud grows, the
        # body swells. Gate 8 is deliberately extreme.
        gate = 1
        for n in range(8, 0, -1):
            if f"{n}." in name or f"gate{n}" in name or f"gate_{n}" in name:
                gate = n
                break
        t = (gate - 1) / 7
        o.update(
            skin=_blend(base.get("skin", "#eec49a"), "#e06048", 0.25 + 0.55 * t),
            eyes="#f0f0f0" if gate >= 6 else base.get("eyes", "#2a3550"),
            aura=_blend("#e8503a", "#ffcf5e", t),
            trim=_blend(base.get("trim", "#888"), "#ffb04a", t),
            bulk=base.get("bulk", 1) * (1.02 + 0.16 * t),
            height=base.get("height", 1) * (1.0 + 0.05 * t),
        )
        if gate >= 4:
            o.update(coat="cloak", coatColor=_blend("#c8341f", "#ff8a2a", t))
        if gate >= 7:
            o.update(hair=_blend(base.get("hair", "#222"), "#ffe0a0", 0.7),
                     markings="sage", markColor="#ffd45e")
        o["shroud"] = round(0.22 + 0.78 * t, 3)
        if gate == 8:
            o.update(skin="#f0d8a8", hair="#fff0c0", outfit="#e8602a",
                     outfit2="#8a2412", coatColor="#ff8a2a", trim="#ffd45e",
                     accessory="shoulder-pads",
                     bulk=base.get("bulk", 1) * 1.26,
                     height=base.get("height", 1) * 1.08)

    # ---- jinchuriki cloaks ------------------------------------------------
    if has("cloak", "version one", "version two", "tail", "gyuki", "shukaku",
           "kurama", "beast"):
        step = min(len(CLOAK_RAMP) - 1, int(depth * (len(CLOAK_RAMP) - 1) + 0.5))
        shroud = CLOAK_RAMP[step] if not has("shukaku", "sand") else "#d8b06a"
        o.update(outfit=shroud, outfit2=_shift(shroud, dl=0.55),
                 pants=shroud, trim=_shift(shroud, dl=1.5),
                 eyes="#ffffff", aura=_shift(shroud, dl=1.25),
                 shroud=round(0.45 + 0.5 * depth, 3),
                 bulk=base.get("bulk", 1) * (1.04 + 0.14 * depth))
        if depth > 0.5:
            o.update(coat="cloak", coatColor=_shift(shroud, dl=0.7),
                     markings="stripes")

    # ---- chakra modes -----------------------------------------------------
    if has("chakra mode", "kcm", "avatar"):
        o.update(outfit="#f5c542", outfit2="#e08a20", pants="#f5c542",
                 trim="#2b3550", eyes="#f5e08a", aura="#ffd45e",
                 markings="stripes",
                 bulk=base.get("bulk", 1) * (1.02 + 0.10 * depth))
    if has("baryon"):
        o.update(outfit="#e85a2a", outfit2="#8a2318", trim="#ffb84a",
                 pants="#e85a2a", aura="#ff6a2a", eyes="#ffd45e",
                 coat="cloak", coatColor="#c03a1a")

    # ---- sage modes and marks ---------------------------------------------
    if has("sage"):
        o.update(markings="sage", markColor="#c9603c", eyes="#e8a23c",
                 aura="#e8a23c",
                 skin=_blend(base.get("skin", "#eec49a"), "#d8a070", 0.35))
    if has("curse mark", "curse", "cursed"):
        o.update(skin=_blend(base.get("skin", "#eec49a"), "#8a7a96", 0.4 + 0.4 * depth),
                 markings="tearlines", eyes="#c8b03a",
                 aura="#8a6ad0", hair=_shift(base.get("hair", "#222"), dl=1.4),
                 bulk=base.get("bulk", 1) * (1.04 + 0.10 * depth))
    if has("byakugo", "hundred healing", "creation rebirth", "rebirth"):
        o.update(markings="seal", markColor="#7a5ad0", aura="#c86ad0",
                 trim="#c86ad0", eyes="#8a6ad0")
        if has("creation", "rebirth", "hundred healing"):
            # The seal released: the mark runs off the forehead and down the
            # face, and the body braces. Not the same picture as the seal.
            o.update(markings="tearlines", markColor="#c86ad0",
                     skin=_blend(base.get("skin", "#eec49a"), "#f4dcec", 0.35),
                     hair=_shift(base.get("hair", "#e8d070"), dl=1.15),
                     accessory="shoulder-pads",
                     bulk=base.get("bulk", 1) * 1.10)
    if has("karma"):
        o.update(markings="seal", markColor="#3a3f55", eyes="#5ac8f0",
                 aura="#5ac8f0", trim="#5ac8f0",
                 coat="cloak" if depth > 0.5 else base.get("coat"),
                 coatColor="#1b2a3a",
                 bulk=base.get("bulk", 1) * (1.0 + 0.10 * depth))
    if has("true essence", "isshiki"):
        o.update(outfit="#3a2f4a", outfit2="#1b1826", trim="#c8a44c",
                 eyes="#c8a44c", aura="#b06ad8", horns=True, hornColor="#e8e2d0",
                 coat="robe", coatColor="#2a2438")

    # ---- body / element themes -------------------------------------------
    if has("serpent", "snake", "eight-headed"):
        o.update(skin="#e8e8dc", hair="#e8e8dc", hairStyle="long-straight",
                 outfit="#c8c8b8", outfit2="#8a8a78", aura="#8ad06a",
                 bulk=base.get("bulk", 1) * 1.12)
    if has("wood", "mokuton"):
        o.update(coat="cloak", coatColor="#5a7a3a", trim="#8ad06a",
                 aura="#6fc06a")
    if has("thousand", "titan", "colossus", "complete body", "giant"):
        # A summoned avatar is a size change first and a colour change second.
        o.update(accessory="shoulder-pads", torso="wrap",
                 coat="cloak", coatColor=_shift(aura, dl=0.55),
                 trim=_shift(aura, dl=1.45),
                 outfit=_blend(base.get("outfit", "#333"), aura, 0.4),
                 bulk=base.get("bulk", 1) * (1.20 + 0.10 * depth),
                 height=base.get("height", 1) * (1.08 + 0.04 * depth))
    if has("sand armour", "sand armor", "armour", "armor"):
        o.update(skin=_blend(base.get("skin", "#eec49a"), "#c8a878", 0.7),
                 outfit=_blend(base.get("outfit", "#333"), "#b09060", 0.6),
                 trim="#d8c090", bulk=base.get("bulk", 1) * 1.10)
    if has("partial", "full ", "perfect"):
        o.update(bulk=base.get("bulk", 1) * (1.16 + 0.10 * depth),
                 height=base.get("height", 1) * 1.06,
                 accessory="shoulder-pads")

    # ---- generic awakening ------------------------------------------------
    # 88 fighters carry the game's generic awakening. Each still has to look
    # like *that fighter* powering up rather than a shared silhouette, so the
    # treatment is chosen per fighter and applied over their own design.
    # `o` is seeded with aura and shroud, so those two keys mean "no themed
    # rule matched" — testing the length instead silently skipped this branch
    # and left 88 awakenings as a glow over an unchanged body.
    if set(o) <= {"aura", "shroud"}:
        flavour = AWAKEN_FLAVOURS[_hash(form["fighterId"]) % len(AWAKEN_FLAVOURS)]
        if flavour == "shroud":
            o.update(coat="cloak", coatColor=_shift(aura, dl=0.55),
                     trim=_shift(aura, dl=1.3), eyes=_shift(aura, dl=1.5),
                     bulk=base.get("bulk", 1) * 1.06)
        elif flavour == "battle_coat":
            o.update(coat="flak", torso="vest",
                     trim=_shift(aura, dl=1.15),
                     outfit2=_shift(base.get("outfit", "#333"), dl=0.6),
                     accessory="shoulder-pads", eyes=_shift(aura, dl=1.4))
        elif flavour == "marked":
            o.update(markings="sage", markColor=_shift(aura, dl=1.2),
                     eyes=_shift(aura, dl=1.5),
                     skin=_blend(base.get("skin", "#eec49a"), aura, 0.16),
                     trim=_shift(aura, dl=1.2))
        elif flavour == "armoured":
            o.update(accessory="shoulder-pads", torso="wrap",
                     outfit=_blend(base.get("outfit", "#333"), aura, 0.35),
                     trim=_shift(aura, dl=1.35),
                     bulk=base.get("bulk", 1) * 1.10,
                     height=base.get("height", 1) * 1.03)
        else:  # focused
            o.update(eyes=_shift(aura, dl=1.6), markings="stripes",
                     outfit=_blend(base.get("outfit", "#333"), aura, 0.28),
                     trim=_shift(aura, dl=1.4),
                     sleeves="short", bulk=base.get("bulk", 1) * 1.04)

    # ---- chain escalation -------------------------------------------------
    # Everything above keys off the form's *theme*, so two rungs of the same
    # theme — Byakugo then Creation Rebirth, Sage then Thousand Hands — can
    # come out differing by shroud radius and nothing else. A brighter glow is
    # not a second form. Every rung above the first also grows the body, lifts
    # the eyes and takes a structural cue the rung below it does not have.
    stage = form["index"]
    if form["chainLength"] > 1 and stage > 0:
        o["bulk"] = o.get("bulk", base.get("bulk", 1)) * (1 + 0.055 * stage)
        o["height"] = o.get("height", base.get("height", 1)) * (1 + 0.022 * stage)
        o["eyes"] = _shift(o.get("eyes") or base.get("eyes", "#2a3550"),
                           dl=1.0 + 0.30 * stage, ds=1.25)
        o["trim"] = _shift(o.get("trim") or base.get("trim", "#888888"),
                           dl=1.0 + 0.12 * stage)
        # Only fill gear the fighter does not already carry — a gourd or a
        # sword on the back is that fighter's signature, not spare space.
        if not o.get("accessory") and not base.get("accessory"):
            o["accessory"] = "shoulder-pads"
        if not o.get("markings") and not base.get("markings"):
            o["markings"] = "stripes"
            o["markColor"] = _shift(aura, dl=1.25)
        if stage == form["chainLength"] - 1 and not o.get("coat") and not base.get("coat"):
            o["coat"] = "cloak"
            o["coatColor"] = _shift(aura, dl=0.6)

    return o


# Costume treatments, keyed by the costume id the roster uses.
def costume_override(fighter_id, costume_id, costume_name, base):
    """The design for one costume, derived from which costume it is."""
    o = {}
    cid = costume_id
    name = (costume_name or "").lower()
    h = _hash(f"{fighter_id}:{costume_id}")

    if cid in ("kid", "genin"):
        # Younger: smaller frame, simpler kit, brighter cloth, no coat.
        o.update(height=base.get("height", 1) * 0.86,
                 bulk=base.get("bulk", 1) * 0.86,
                 coat=None, accessory=None,
                 outfit=_shift(base.get("outfit", "#333"), dl=1.28, ds=1.15),
                 pants=_shift(base.get("pants", base.get("outfit", "#333")), dl=1.1),
                 sleeves="short", torso="zip")
    elif cid == "young":
        o.update(height=base.get("height", 1) * 0.94,
                 bulk=base.get("bulk", 1) * 0.92,
                 coat=None,
                 outfit=_shift(base.get("outfit", "#333"), dl=1.16),
                 torso="zip", sleeves="long")
    elif cid == "shippuden":
        o.update(torso="open",
                 outfit2=_shift(base.get("outfit2", "#222"), dl=0.85),
                 trim=_shift(base.get("trim", "#888"), dl=1.1))
    elif cid in ("adult", "timeskip"):
        o.update(height=base.get("height", 1) * 1.06,
                 bulk=base.get("bulk", 1) * 1.06,
                 coat="coat", coatColor=_shift(base.get("outfit2", "#222"), dl=0.8),
                 outfit=_shift(base.get("outfit", "#333"), dl=0.82),
                 torso="wrap", sleeves="long")
    elif cid in ("hokage", "kazekage"):
        cloak = "#ece8de" if cid == "hokage" else "#e4e0d2"
        edge = "#c8402a" if cid == "hokage" else "#3f5f86"
        o.update(coat="cloak", coatColor=cloak, coatTrim=edge,
                 trim=edge, torso="vest",
                 height=base.get("height", 1) * 1.03)
    elif cid == "anbu":
        o.update(outfit="#20242e", outfit2="#12151b", trim="#9aa4b4",
                 coat=None, mask="full", accessory="sword-back",
                 accColor="#3a4150", torso="vest",
                 pants="#1a1e26")
    elif cid == "edo":
        # Reanimated: grey skin, cracked face, dead eyes.
        o.update(skin="#cfcabc", hair=_shift(base.get("hair", "#222"), ds=0.4),
                 eyes="#3a3f4a", markings="tearlines",
                 outfit=_shift(base.get("outfit", "#333"), ds=0.45, dl=0.85),
                 trim="#8a8478")
    elif cid in ("war", "valley"):
        o.update(accessory="shoulder-pads", torso="wrap",
                 coat="cloak", coatColor=_shift(base.get("outfit", "#333"), dl=0.62),
                 trim=_shift(base.get("trim", "#888"), dl=1.15),
                 bulk=base.get("bulk", 1) * 1.05)
    elif cid == "masked":
        o.update(mask="full", coat="cloak",
                 coatColor=_shift(base.get("outfit2", "#222"), dl=0.75),
                 trim="#d0603a")
    elif cid == "white_mask":
        o.update(mask="full", skin="#e8e4dc", coat="cloak", coatColor="#dcd8d0",
                 outfit="#c8c4bc", outfit2="#8a8880", trim="#e8e4dc",
                 eyes="#c8404a")
    elif cid == "tobi":
        o.update(mask="full", coat="akatsuki", coatColor="#14182a",
                 markings="clouds", cloud="#b8323c", trim="#d0603a",
                 bulk=base.get("bulk", 1) * 0.96)
    elif cid == "the_last":
        o.update(coat="cloak", coatColor=_shift(base.get("outfit", "#333"), dl=0.7),
                 trim="#e8e4dc", torso="vest",
                 height=base.get("height", 1) * 1.03)
    elif cid == "sannin":
        o.update(coat="cloak", coatColor=_shift(base.get("outfit2", "#222"), dl=1.1),
                 accessory="scroll", accColor="#d8c9a0", torso="wrap")
    elif cid == "elder":
        o.update(height=base.get("height", 1) * 0.96,
                 hair="#d8d4cc", coat="robe",
                 coatColor=_shift(base.get("outfit", "#333"), dl=1.2),
                 torso="wrap")
    elif cid == "jonin":
        o.update(coat="flak", torso="vest",
                 trim=_shift(base.get("trim", "#4a6b3e"), dl=1.05))
    elif cid == "base":
        o.update(torso="wrap", trim=_shift(base.get("trim", "#888"), dl=1.12))
    else:
        # Any costume id without a rule still gets a real, stable treatment
        # rather than the base body: pick one deterministically from its name.
        picks = [
            dict(coat="cloak", coatColor=_shift(base.get("outfit", "#333"), dl=0.7)),
            dict(torso="vest", accessory="shoulder-pads"),
            dict(sleeves="short", torso="wrap",
                 outfit=_shift(base.get("outfit", "#333"), dl=1.18)),
            dict(coat="hoodie", torso="zip",
                 trim=_shift(base.get("trim", "#888"), dl=1.2)),
        ]
        o.update(picks[h % len(picks)])
        o.setdefault("outfit2", _shift(base.get("outfit2", "#222"), dl=0.9))

    if "adult" in name and "height" not in o:
        o["height"] = base.get("height", 1) * 1.05
    return o


def merge_form(form, base):
    """
    The final override for one transformation.

    The derived rules run first — they know the form's chain depth, its gate
    number and its aura, so they are the only thing that can make an escalation
    read as an escalation. A hand-authored record is then laid on top of that,
    key by key. Written the other way round, a record that names only `skin`
    would silently drop the whole shroud ramp, and gate 1 would end up glowing
    harder than gate 3.
    """
    derived = form_override(form, base)
    authored = FORM_DESIGNS.get(form["id"])
    return derived if authored is None else {**derived, **authored}


def merge_costume(fighter_id, costume_id, costume_name, base):
    """The final override for one costume. Same layering as `merge_form`."""
    derived = costume_override(fighter_id, costume_id, costume_name, base)
    authored = COSTUME_DESIGNS.get((fighter_id, costume_id))
    return derived if authored is None else {**derived, **authored}
