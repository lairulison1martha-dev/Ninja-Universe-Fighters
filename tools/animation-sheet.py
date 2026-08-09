#!/usr/bin/env python3
"""
Contact sheet: every animation of every Naruto form, every frame.

    python3 tools/animation-sheet.py

Rows are the 22 animation clips the engine requires, columns are the frames of
each clip, and the eight forms sit side by side so a clip can be compared
across forms at a glance. Everything drawn here comes from the game's own
sprite sheets; the 3x5 label font is typed into this file as bit rows.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from pngio import Image, write_png, read_png     # noqa: E402

F = {
 'A':(0b010,0b101,0b111,0b101,0b101),'B':(0b110,0b101,0b110,0b101,0b110),
 'C':(0b011,0b100,0b100,0b100,0b011),'D':(0b110,0b101,0b101,0b101,0b110),
 'E':(0b111,0b100,0b110,0b100,0b111),'F':(0b111,0b100,0b110,0b100,0b100),
 'G':(0b011,0b100,0b101,0b101,0b011),'H':(0b101,0b101,0b111,0b101,0b101),
 'I':(0b111,0b010,0b010,0b010,0b111),'J':(0b001,0b001,0b001,0b101,0b010),
 'K':(0b101,0b101,0b110,0b101,0b101),'L':(0b100,0b100,0b100,0b100,0b111),
 'M':(0b101,0b111,0b111,0b101,0b101),'N':(0b101,0b111,0b111,0b111,0b101),
 'O':(0b010,0b101,0b101,0b101,0b010),'P':(0b110,0b101,0b110,0b100,0b100),
 'Q':(0b010,0b101,0b101,0b110,0b011),'R':(0b110,0b101,0b110,0b101,0b101),
 'S':(0b011,0b100,0b010,0b001,0b110),'T':(0b111,0b010,0b010,0b010,0b010),
 'U':(0b101,0b101,0b101,0b101,0b011),'V':(0b101,0b101,0b101,0b010,0b010),
 'W':(0b101,0b101,0b111,0b111,0b101),'X':(0b101,0b101,0b010,0b101,0b101),
 'Y':(0b101,0b101,0b010,0b010,0b010),'Z':(0b111,0b001,0b010,0b100,0b111),
 '-':(0,0,0b111,0,0),' ':(0,0,0,0,0),'1':(0b010,0b110,0b010,0b010,0b111),
 '2':(0b110,0b001,0b010,0b100,0b111),'3':(0b110,0b001,0b010,0b001,0b110),
 '4':(0b101,0b101,0b111,0b001,0b001),
}


def text(img, s, x, y, scale, col):
    cx = x
    for ch in s.upper():
        g = F.get(ch, F[' '])
        for ry in range(5):
            for rx in range(3):
                if g[ry] >> (2 - rx) & 1:
                    for dy in range(scale):
                        for dx in range(scale):
                            img.set(cx + rx * scale + dx, y + ry * scale + dy, *col)
        cx += 4 * scale
    return cx


NARUTO = os.path.join(ROOT_DIR, 'assets', 'fighters', 'naruto')
FORMS = [
    ('BASE', NARUTO),
    ('ONE-TAIL', os.path.join(NARUTO, 'forms', 'naruto_onetail')),
    ('FOUR-TAIL', os.path.join(NARUTO, 'forms', 'naruto_fourtail')),
    ('SAGE', os.path.join(NARUTO, 'forms', 'naruto_sage')),
    ('KCM', os.path.join(NARUTO, 'forms', 'naruto_kcm1')),
    ('BIJUU', os.path.join(NARUTO, 'forms', 'naruto_kcm2')),
    ('ASHURA', os.path.join(NARUTO, 'forms', 'naruto_sixpaths')),
    ('BARYON', os.path.join(NARUTO, 'forms', 'naruto_baryon')),
]

CELL = 64
LABEL_W = 116
GAP = 10
BG = (18, 21, 32, 255)
GRID = (38, 44, 62, 255)
INK = (226, 233, 245, 255)


def main():
    meta = json.load(open(os.path.join(FORMS[0][1], 'fighter.json')))
    order = list(meta['animations'].keys())
    maxframes = max(a['frames'] for a in meta['animations'].values())

    block_w = maxframes * CELL + GAP
    W = LABEL_W + len(FORMS) * block_w
    H = 34 + len(order) * CELL

    out = Image(W, H)
    for y in range(H):
        for x in range(W):
            out.set(x, y, *BG)

    for i, (name, _p) in enumerate(FORMS):
        x0 = LABEL_W + i * block_w
        text(out, name, x0 + 6, 12, 2, INK)
        for y in range(34, H):
            out.set(x0 - GAP // 2, y, *GRID)

    sheets = {}
    for name, path in FORMS:
        sheets[name] = (read_png(os.path.join(path, 'sprite-sheet.png')),
                        json.load(open(os.path.join(path, 'fighter.json'))))

    for r, clip in enumerate(order):
        y0 = 34 + r * CELL
        text(out, clip[:14], 6, y0 + CELL // 2 - 5, 2, INK)
        for x in range(LABEL_W, W):
            out.set(x, y0, *GRID)
        for i, (name, _p) in enumerate(FORMS):
            img, m = sheets[name]
            info = m['animations'].get(clip)
            if not info:
                continue
            row = info['row']
            x0 = LABEL_W + i * block_w
            for f in range(info['frames']):
                for y in range(CELL):
                    for x in range(CELL):
                        px = img.get(f * CELL + x, row * CELL + y)
                        if px[3] == 0:
                            continue
                        out.set(x0 + f * CELL + x, y0 + y, *px)

    dest = os.path.join(ROOT_DIR, 'reports', 'naruto-animation-sheet.png')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    write_png(dest, out)
    print('wrote', os.path.relpath(dest, ROOT_DIR), out.w, out.h,
          f'({len(order)} clips x {len(FORMS)} forms)')


main()
