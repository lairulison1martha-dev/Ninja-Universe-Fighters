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
