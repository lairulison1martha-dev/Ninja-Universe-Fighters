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
    "idle", "walk", "run", "jump", "fall", "dash", "guard",
    "lightAttack", "heavyAttack", "jutsu1", "jutsu2", "jutsu3", "ultimate",
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
