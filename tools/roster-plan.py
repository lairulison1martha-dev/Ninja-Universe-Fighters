#!/usr/bin/env python3
"""
The canonical 110-fighter roster and the legacy-id map, in one place.

This file is the single source for the cleanup: the JS data files, the save
migration and the tests are all generated or checked against it, so the roster
cannot drift between them.

Run it to regenerate `js/data/roster-migration.js`:

    python3 tools/roster-plan.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------------------
# The final roster: 110 unique people, in the order they should appear.
# ---------------------------------------------------------------------------

ROSTER = [
    # Leaf Village
    "naruto", "sasuke", "sakura", "kakashi", "sai", "yamato", "shikamaru",
    "choji", "ino", "hinata", "kiba", "shino", "neji", "lee", "tenten", "guy",
    "asuma", "kurenai", "ebisu", "iruka", "konohamaru", "hanabi", "hiashi",
    "hizashi",
    # Hokage, Sannin and Leaf legends
    "hashirama", "tobirama", "hiruzen", "minato", "tsunade", "jiraiya",
    "orochimaru", "kushina", "shisui", "fugaku", "izuna",
    # Sand
    "gaara", "temari", "kankuro", "chiyo", "pakura", "rasa",
    # Mist
    "zabuza", "haku", "chojuro", "mei", "kisame", "yagura", "suigetsu",
    # Cloud
    "bee", "raikage4", "darui", "omoi", "samui", "yugito",
    # Stone
    "onoki", "kurotsuchi", "deidara", "roshi", "han",
    # Akatsuki and major villains
    "itachi", "sasori", "kakuzu", "hidan", "konan", "pain", "nagato", "obito",
    "white_zetsu", "black_zetsu", "madara", "kabuto", "kimimaro", "jugo",
    "karin", "danzo", "hanzo",
    # Sound Four
    "jirobo", "kidomaru", "tayuya", "sakon",
    # Other jinchuriki
    "utakata", "fu",
    # Boruto generation
    "boruto", "sarada", "mitsuki", "kawaki", "sumire", "shinki", "mirai",
    "kagura", "buntan",
    # Kara
    "jigen", "isshiki", "delta", "code", "boro", "koji", "victor", "deepa",
    "eida", "daemon",
    # Otsutsuki and ancient
    "momoshiki", "kinshiki", "urashiki", "kaguya", "hagoromo", "hamura",
    "toneri",
    # Special
    "shin", "menma",
]

DISPLAY = {
    "raikage4": "Fourth Raikage",
    "white_zetsu": "White Zetsu",
    "black_zetsu": "Black Zetsu",
    "sakon": "Sakon and Ukon",
    "lee": "Rock Lee",
    "guy": "Might Guy",
    "bee": "Killer Bee",
    "hanabi": "Hanabi Hyuga",
    "hiashi": "Hiashi Hyuga",
    "hizashi": "Hizashi Hyuga",
    "kushina": "Kushina Uzumaki",
    "pakura": "Pakura",
    "shinki": "Shinki",
    "mirai": "Mirai Sarutobi",
    "kagura": "Kagura Karatachi",
    "buntan": "Buntan Kurosuki",
    "shin": "Shin Uchiha",
}

# ---------------------------------------------------------------------------
# Legacy ids -> the fighter they now live under.
#
# Every id the old 192-entry roster used that is not in ROSTER has to appear
# here, so an existing save can be carried forward instead of silently losing
# whatever it referenced. Alternate ages, costumes, titles, awakenings and Edo
# versions collapse onto the main fighter; bosses, summons and original
# characters map to a related fighter (they survive as transformations,
# ultimates and assists rather than as roster cards).
# ---------------------------------------------------------------------------

LEGACY = {
    # --- alternate ages / titles / forms of a fighter we keep --------------
    "naruto_hokage": "naruto",
    "naruto_adult": "naruto",
    "rtn_naruto": "naruto",
    "sasuke_adult": "sasuke",
    "rtn_sasuke": "sasuke",
    "sakura_adult": "sakura",
    "kakashi_hokage": "kakashi",
    "kakashi_young": "kakashi",
    "sai_adult": "sai",
    "shikamaru_adult": "shikamaru",
    "choji_adult": "choji",
    "ino_adult": "ino",
    "hinata_adult": "hinata",
    "kiba_adult": "kiba",
    "shino_adult": "shino",
    "lee_adult": "lee",
    "tenten_adult": "tenten",
    "guy_young": "guy",
    "konohamaru_adult": "konohamaru",
    "hanabi_adult": "hanabi",
    "temari_adult": "temari",
    "kankuro_adult": "kankuro",
    "gaara_adult": "gaara",
    "gaara_kazekage": "gaara",
    "madara_edo": "madara",
    "madara_young": "madara",
    "obito_young": "obito",
    "minato_young": "minato",
    "jiraiya_young": "jiraiya",
    "orochimaru_young": "orochimaru",
    "tsunade_young": "tsunade",
    "hiruzen_young": "hiruzen",
    "hashirama_young": "hashirama",
    "tobirama_young": "tobirama",
    "zetsu": "white_zetsu",

    # --- bosses: kept as transformations, ultimates and summons ------------
    "shukaku": "gaara",
    "matatabi": "yugito",
    "isobu": "yagura",
    "songoku": "roshi",
    "kokuo": "han",
    "saiken": "utakata",
    "chomei": "fu",
    "gyuki": "bee",
    "kurama": "naruto",
    "tentails": "obito",

    # --- original / generic / filler entries -------------------------------
    "gato": "hanzo",
    "mizuki": "iruka",
    "guren": "kabuto",
    "rin": "obito",
    "dai": "guy",
    "ao": "chojuro",
    "amado": "code",
    "indra": "sasuke",
    "ashura": "naruto",
    "kagami": "shisui",
    "sakumo": "kakashi",
    "shizune": "tsunade",
    "anko": "orochimaru",
    "moegi": "konohamaru",
    "udon": "konohamaru",
    "himawari": "hinata",
    "inojin": "ino",
    "shikadai": "shikamaru",
    "chocho": "choji",
    "metal_lee": "lee",
    "iwabe": "boruto",
    "denki": "boruto",
    "wasabi": "sumire",
    "namida": "sumire",
    "houki": "boruto",

    # --- minor / duplicate village entries ---------------------------------
    "kazekage1": "rasa",
    "reto": "rasa",
    "shamon": "rasa",
    "kazekage3": "rasa",
    "raikage3": "raikage4",
    "gengetsu": "mei",
    "mu": "onoki",
    "baki": "temari",
    "mangetsu": "suigetsu",
    "jinin": "chojuro",
    "jinpachi": "chojuro",
    "kushimaru": "chojuro",
    "ameyuri": "chojuro",
    "fuguki": "kisame",
    "c_cloud": "darui",
    "karui": "omoi",
    "atsui": "samui",
    "mabui": "samui",
    "akatsuchi": "kurotsuchi",
    "ginkaku": "kinkaku_pair",
    "kinkaku": "kinkaku_pair",
    "dosu": "kimimaro",
    "zaku": "kimimaro",
    "kin": "tayuya",
}

# Two legacy ids point at a pair that is itself gone; land them on a fighter
# that is actually in the roster so no mapping is a dead end.
LEGACY["ginkaku"] = "bee"
LEGACY["kinkaku"] = "bee"
LEGACY["kinkaku_pair"] = "bee"


def check():
    problems = []
    if len(ROSTER) != 110:
        problems.append(f"roster has {len(ROSTER)} entries, expected 110")
    if len(set(ROSTER)) != len(ROSTER):
        seen = set()
        for fid in ROSTER:
            if fid in seen:
                problems.append(f"duplicate id in roster: {fid}")
            seen.add(fid)
    for old, new in LEGACY.items():
        if old in ROSTER:
            problems.append(f"legacy id {old} is also in the roster")
        if new not in ROSTER:
            problems.append(f"legacy {old} -> {new}, which is not in the roster")
    return problems


def write_migration_js():
    lines = [
        "/**",
        " * Legacy fighter id migration.",
        " *",
        " * The roster used to carry 192 entries: alternate ages, Edo versions,",
        " * masked versions, tailed beasts and a spread of original characters all had",
        " * their own cards. It is now 110 unique people, with those variants attached",
        " * to their main fighter as costumes, transformations and awakenings.",
        " *",
        " * A save written before that change can reference any of the old ids, so every",
        " * one of them maps to the fighter it now lives under. Nothing is dropped: a",
        " * player who had unlocked Edo Madara keeps that progress on Madara Uchiha.",
        " *",
        " * Generated by tools/roster-plan.py — edit that, not this.",
        " */",
        "",
        "/** Old fighter id -> the fighter that absorbed them. */",
        "export const LEGACY_FIGHTER_IDS = Object.freeze({",
    ]
    for old in sorted(LEGACY):
        lines.append(f"  {json.dumps(old)}: {json.dumps(LEGACY[old])},")
    lines += [
        "});",
        "",
        "/**",
        " * Resolve any fighter id — current or legacy — to a roster id.",
        " *",
        " * @param {string} id",
        " * @returns {string|null} null when the id is not recognised at all, so",
        " *   callers can drop unknown data rather than inventing a fighter.",
        " */",
        "export function resolveFighterId(id) {",
        "  if (!id) return null;",
        "  if (LEGACY_FIGHTER_IDS[id]) return LEGACY_FIGHTER_IDS[id];",
        "  return id;",
        "}",
        "",
        "/** True when `id` only exists as a legacy alias. */",
        "export function isLegacyFighterId(id) {",
        "  return Object.prototype.hasOwnProperty.call(LEGACY_FIGHTER_IDS, id);",
        "}",
        "",
        "export default LEGACY_FIGHTER_IDS;",
        "",
    ]
    path = os.path.join(ROOT, "js", "data", "roster-migration.js")
    with open(path, "w") as fh:
        fh.write("\n".join(lines))
    return path


if __name__ == "__main__":
    problems = check()
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print(" -", p)
        raise SystemExit(1)
    print(f"roster: {len(ROSTER)} fighters")
    print(f"legacy map: {len(LEGACY)} ids")
    print("wrote", write_migration_js())
