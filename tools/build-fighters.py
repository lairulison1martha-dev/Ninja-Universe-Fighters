#!/usr/bin/env python3
"""
Build per-fighter sprite sets.

    python3 tools/build-fighters.py                 # every roster fighter
    python3 tools/build-fighters.py naruto sasuke   # just these
    python3 tools/build-fighters.py --pass1         # the twenty starters
    python3 tools/build-fighters.py --contact out.png naruto sasuke

For each fighter it writes:

    assets/fighters/<id>/sprite-sheet.png
    assets/fighters/<id>/portrait.png
    assets/fighters/<id>/fighter.json

Every pixel is drawn by tools/fighter_art.py from the design record in
tools/designs.py. No image is read as input — there is nothing to trace.

The roster itself comes from js/data/fighters.js via tools/dump-roster.mjs, so
colours and proportions never drift from what the game uses.
"""

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from pngio import Image, write_png            # noqa: E402
import fighter_art as art                      # noqa: E402
import designs as dz                           # noqa: E402

OUT_ROOT = os.path.join(ROOT, "assets", "fighters")
ROSTER_JSON = os.path.join(HERE, "roster.json")

ORDER = [
    "idle", "combatIdle", "walk", "run", "jump", "fall", "landing", "dash",
    "guard", "guardBreak", "lightAttack", "heavyAttack",
    "jutsu1", "jutsu2", "jutsu3", "ultimate",
    "hurt", "knockdown", "getUp", "victory", "defeat", "transformation",
]


def load_roster():
    """Read the roster, regenerating the JSON dump when it is missing or stale."""
    src = os.path.join(ROOT, "js", "data", "fighters.js")
    stale = (not os.path.exists(ROSTER_JSON)
             or os.path.getmtime(ROSTER_JSON) < os.path.getmtime(src))
    if stale:
        with open(ROSTER_JSON, "w") as fh:
            subprocess.run(["node", os.path.join(HERE, "dump-roster.mjs")],
                           stdout=fh, check=True, cwd=ROOT)
    with open(ROSTER_JSON) as fh:
        return json.load(fh)


def build_one(entry, out_root=OUT_ROOT):
    """Render one fighter's sheet, portrait and metadata. Returns a summary."""
    design = dz.for_fighter(entry)
    fid = entry["id"]

    cols = max(art.FRAMES[a] for a in ORDER)
    rows = len(ORDER)
    atlas = Image(cols * art.FRAME, rows * art.FRAME)

    animations = {}
    total = 0
    body_tops = []
    idle0 = None

    for r, name in enumerate(ORDER):
        n = art.FRAMES[name]
        fps, loop, hit, event = art.PLAYBACK[name]
        for i in range(n):
            canvas = art.frame(design, name, i)
            canvas.paste_into(atlas, i * art.FRAME, r * art.FRAME)
            if name == "idle":
                b = canvas.bounds()
                if b:
                    body_tops.append(art.ANCHOR_Y - b[1])
                if i == 0:
                    idle0 = canvas
            total += 1
        entry_meta = {"row": r, "frames": n, "fps": fps, "loop": loop}
        if hit is not None:
            entry_meta["hitFrame"] = min(hit, n - 1)
            entry_meta["event"] = event
        animations[name] = entry_meta

    body_height = sorted(body_tops)[len(body_tops) // 2] if body_tops else 46

    out_dir = os.path.join(out_root, fid)
    os.makedirs(out_dir, exist_ok=True)
    write_png(os.path.join(out_dir, "sprite-sheet.png"), atlas)

    # Portrait: the idle pose, head and shoulders, at 2x.
    portrait = Image(96, 128)
    if idle0 is not None:
        b = idle0.bounds()
        if b:
            x0, y0, x1, y1 = b
            cx = (x0 + x1) // 2
            for y in range(y0, min(y1 + 1, y0 + 60)):
                for x in range(x0, x1 + 1):
                    r_, g_, b_, a_ = idle0.get(x, y)
                    if not a_:
                        continue
                    px = (x - cx) * 2 + 48
                    py = (y - y0) * 2 + 6
                    for dy in range(2):
                        for dx in range(2):
                            if 0 <= px + dx < 96 and 0 <= py + dy < 128:
                                portrait.set(px + dx, py + dy, r_, g_, b_, 255)
    write_png(os.path.join(out_dir, "portrait.png"), portrait)

    meta = {
        "id": fid,
        "name": entry["displayName"],
        "spriteSheet": f"assets/fighters/{fid}/sprite-sheet.png",
        "portrait": f"assets/fighters/{fid}/portrait.png",
        "frameWidth": art.FRAME,
        "frameHeight": art.FRAME,
        "anchor": {"x": art.ANCHOR_X, "y": art.ANCHOR_Y},
        "bodyHeight": body_height,
        "pixelArt": True,
        "source": {
            "kind": "generated",
            "tool": "tools/build-fighters.py",
            "note": ("Original pixel art drawn procedurally from this fighter's "
                     "design record. No source image is read, traced or sampled."),
            "design": "hand-authored" if design.get("hand") else "derived-from-roster",
        },
        "animations": animations,
    }
    with open(os.path.join(out_dir, "fighter.json"), "w") as fh:
        json.dump(meta, fh, indent=2)
        fh.write("\n")

    return {"id": fid, "frames": total, "rows": rows,
            "size": (atlas.w, atlas.h), "body": body_height,
            "hand": design.get("hand", False)}


def build_variant(entry, kind, variant_id, override, out_root=OUT_ROOT):
    """
    Render a costume or transformation sprite set.

    Same rig, same 22 animations — the override changes the design record, so
    the whole body is redrawn rather than recoloured. Output goes beside the
    fighter it belongs to:

        assets/fighters/<fighter>/costumes/<costume>/
        assets/fighters/<fighter>/forms/<form>/
    """
    base = dz.for_fighter(entry)
    design = dz.variant(base, override)
    fid = entry["id"]
    folder = "costumes" if kind == "costume" else "forms"
    # Costume sets are namespaced under their fighter; transformation ids are
    # already unique and globally addressable (`naruto_sage`), and the runtime
    # looks them up by exactly that id, so they are not namespaced again.
    set_id = f"{fid}__{variant_id}" if kind == "costume" else variant_id

    cols = max(art.FRAMES[a] for a in ORDER)
    atlas = Image(cols * art.FRAME, len(ORDER) * art.FRAME)
    animations = {}
    body_tops = []
    idle0 = None
    total = 0

    for r, name in enumerate(ORDER):
        n = art.FRAMES[name]
        fps, loop, hit, event = art.PLAYBACK[name]
        for i in range(n):
            canvas = art.frame(design, name, i)
            canvas.paste_into(atlas, i * art.FRAME, r * art.FRAME)
            if name == "idle":
                b = canvas.bounds()
                if b:
                    body_tops.append(art.ANCHOR_Y - b[1])
                if i == 0:
                    idle0 = canvas
            total += 1
        meta_row = {"row": r, "frames": n, "fps": fps, "loop": loop}
        if hit is not None:
            meta_row["hitFrame"] = min(hit, n - 1)
            meta_row["event"] = event
        animations[name] = meta_row

    rel = f"assets/fighters/{fid}/{folder}/{variant_id}"
    out_dir = os.path.join(out_root, fid, folder, variant_id)
    os.makedirs(out_dir, exist_ok=True)
    write_png(os.path.join(out_dir, "sprite-sheet.png"), atlas)

    portrait = Image(96, 128)
    if idle0 is not None:
        b = idle0.bounds()
        if b:
            x0, y0, x1, _y1 = b
            cx = (x0 + x1) // 2
            for y in range(y0, min(b[3] + 1, y0 + 60)):
                for x in range(x0, x1 + 1):
                    r_, g_, b_, a_ = idle0.get(x, y)
                    if not a_:
                        continue
                    px = (x - cx) * 2 + 48
                    py = (y - y0) * 2 + 6
                    for dy in range(2):
                        for dx in range(2):
                            if 0 <= px + dx < 96 and 0 <= py + dy < 128:
                                portrait.set(px + dx, py + dy, r_, g_, b_, 255)
    write_png(os.path.join(out_dir, "portrait.png"), portrait)

    meta = {
        "id": set_id,
        "fighter": fid,
        "kind": kind,
        "variant": variant_id,
        "name": entry["displayName"],
        "spriteSheet": f"{rel}/sprite-sheet.png",
        "portrait": f"{rel}/portrait.png",
        "frameWidth": art.FRAME,
        "frameHeight": art.FRAME,
        "anchor": {"x": art.ANCHOR_X, "y": art.ANCHOR_Y},
        "bodyHeight": sorted(body_tops)[len(body_tops) // 2] if body_tops else 46,
        "pixelArt": True,
        "assetStatus": "complete",
        "source": {
            "kind": "generated",
            "tool": "tools/build-fighters.py",
            "note": ("Original pixel art drawn procedurally from this "
                     f"{kind}'s design record. No source image is read."),
        },
        "animations": animations,
    }
    with open(os.path.join(out_dir, "fighter.json"), "w") as fh:
        json.dump(meta, fh, indent=2)
        fh.write("\n")
    return {"setId": set_id, "fighter": fid, "kind": kind, "variant": variant_id,
            "frames": total, "path": rel}


def contact_sheet(entries, path, anim="idle", frame_index=0, scale=3):
    """A zoomed grid of one frame per fighter — the visual check while iterating."""
    per_row = 10
    cell = art.FRAME * scale
    rows = (len(entries) + per_row - 1) // per_row
    sheet = Image(per_row * cell, rows * cell)
    for k, entry in enumerate(entries):
        design = dz.for_fighter(entry)
        canvas = art.frame(design, anim, frame_index)
        ox = (k % per_row) * cell
        oy = (k // per_row) * cell
        for y in range(art.FRAME):
            for x in range(art.FRAME):
                r_, g_, b_, a_ = canvas.get(x, y)
                if not a_:
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        sheet.set(ox + x * scale + dx, oy + y * scale + dy, r_, g_, b_, 255)
    write_png(path, sheet)
    return path


VARIANTS_JSON = os.path.join(HERE, "variants.json")


def load_variants():
    """Costume + transformation rows, regenerated from the game data if stale."""
    src = os.path.join(ROOT, "js", "data", "transformations.js")
    stale = (not os.path.exists(VARIANTS_JSON)
             or os.path.getmtime(VARIANTS_JSON) < os.path.getmtime(src))
    if stale:
        with open(VARIANTS_JSON, "w") as fh:
            subprocess.run(["node", os.path.join(HERE, "dump-transformations.mjs")],
                           stdout=fh, check=True, cwd=ROOT)
    with open(VARIANTS_JSON) as fh:
        return json.load(fh)


def write_variant_lists(variants):
    """
    Rewrite the two `*_WITH_ART` lists in the JS from what is actually on disk.

    Generating them (rather than editing by hand) is what keeps the game's
    claim about a costume or form matching the filesystem: a set that failed to
    build simply does not appear, and its status stays `fallback`.
    """
    costumes = []
    for c in variants["costumes"]:
        rel = f"assets/fighters/{c['fighterId']}/costumes/{c['id']}/sprite-sheet.png"
        if os.path.exists(os.path.join(ROOT, rel)):
            costumes.append(f"{c['fighterId']}:{c['id']}")
    forms = []
    for f in variants["forms"]:
        rel = f"assets/fighters/{f['fighterId']}/forms/{f['id']}/sprite-sheet.png"
        if os.path.exists(os.path.join(ROOT, rel)):
            forms.append(f["id"])

    _replace_list(
        os.path.join(ROOT, "js", "data", "costumes.js"),
        "COSTUMES_WITH_ART", costumes,
    )
    _replace_list(
        os.path.join(ROOT, "js", "data", "transformations.js"),
        "FORMS_WITH_ART", forms,
    )
    print(f"wrote COSTUMES_WITH_ART ({len(costumes)}) and FORMS_WITH_ART ({len(forms)})")


def _replace_list(path, const_name, items):
    """Replace `export const <NAME> = Object.freeze([...]);` in a JS file."""
    with open(path) as fh:
        src = fh.read()
    start = src.index(f"export const {const_name} = Object.freeze([")
    end = src.index("]);", start) + len("]);")
    lines = [f"export const {const_name} = Object.freeze(["]
    line = " "
    for item in items:
        piece = f" {json.dumps(item)},"
        if len(line) + len(piece) > 78:
            lines.append(line)
            line = " "
        line += piece
    if line.strip():
        lines.append(line)
    lines.append("]);")
    with open(path, "w") as fh:
        fh.write(src[:start] + "\n".join(lines) + src[end:])


def write_manifest(ids, precached):
    """
    Index of every generated sprite set.

    The game reads this at boot to know which fighters have art, then fetches
    each atlas on demand. `precached` is the subset the service worker installs
    up front so a brand-new offline install still has playable fighters.
    """
    path = os.path.join(OUT_ROOT, "manifest.json")
    existing = []
    if os.path.exists(path):
        try:
            with open(path) as fh:
                existing = json.load(fh).get("fighters", [])
        except (OSError, ValueError):
            existing = []
    merged = sorted(set(existing) | set(ids))
    payload = {
        "generator": "tools/build-fighters.py",
        "frameWidth": art.FRAME,
        "frameHeight": art.FRAME,
        "animations": ORDER,
        "fighters": merged,
        "precached": [i for i in precached if i in merged],
    }
    with open(path, "w") as fh:
        json.dump(payload, fh, indent=1)
        fh.write("\n")
    return merged


def main(argv):
    roster = load_roster()
    by_id = {e["id"]: e for e in roster}

    args = list(argv)
    contact = None
    if "--contact" in args:
        i = args.index("--contact")
        contact = args[i + 1]
        del args[i:i + 2]

    if "--variants" in args:
        args.remove("--variants")
        only = set(args)
        variants = load_variants()
        built = []
        skipped = 0

        for c in variants["costumes"]:
            fid = c["fighterId"]
            if fid not in by_id or (only and fid not in only):
                skipped += 1
                continue
            base = dz.for_fighter(by_id[fid])
            # Hand-authored keys win; the rules fill in everything else.
            override = dz.merge_costume(fid, c["id"], c["name"], base)
            info = build_variant(by_id[fid], "costume", c["id"], override)
            built.append(info)
            print(f"  costume  {fid:14s} {c['id']:14s} {info['frames']:3d} frames")

        for f in variants["forms"]:
            fid = f["fighterId"]
            if fid not in by_id or (only and fid not in only):
                skipped += 1
                continue
            base = dz.for_fighter(by_id[fid])
            override = dz.merge_form(f, base)
            info = build_variant(by_id[fid], "form", f["id"], override)
            built.append(info)
            print(f"  form     {fid:14s} {f['id']:26s} {info['frames']:3d} frames")

        print(f"\n{len(built)} variant sprite sets" + (f" ({skipped} skipped)" if skipped else ""))
        write_variant_lists(variants)
        return 0

    if "--pass1" in args:
        args.remove("--pass1")
        ids = dz.FIRST_PASS
    elif args:
        ids = args
    else:
        ids = [e["id"] for e in roster]

    unknown = [i for i in ids if i not in by_id]
    if unknown:
        print("unknown fighter ids:", ", ".join(unknown))
        return 1

    entries = [by_id[i] for i in ids]

    if contact:
        contact_sheet(entries, contact)
        print(f"contact sheet -> {contact}")
        return 0

    print(f"building {len(entries)} fighter sprite sets …")
    total_frames = 0
    for e in entries:
        info = build_one(e)
        total_frames += info["frames"]
        tag = "hand" if info["hand"] else "derived"
        print(f"  {info['id']:22s} {info['rows']:2d} anims  {info['frames']:3d} frames"
              f"  {info['size'][0]}x{info['size'][1]}  body {info['body']}px  [{tag}]")
    all_ids = write_manifest([e["id"] for e in entries], dz.FIRST_PASS)
    print(f"\n{len(entries)} fighters, {total_frames} frames"
          f"  ·  manifest lists {len(all_ids)} sets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
