#!/usr/bin/env python3
"""
Signature-technique effects, side by side by form.

    python3 tools/effects-preview.py

Shows each form's jutsu1 (charged sphere) and ultimate (release) at their
peak frames, so the per-form effect SHAPE can be compared, not just its hue.
All pixels come from the game's own sprite sheets.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from pngio import Image, write_png, read_png     # noqa: E402
from importlib import import_module              # noqa: E402

sheet = import_module('animation-sheet'.replace('-', '_')) if False else None

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
    ('BASE', NARUTO), ('ONE-TAIL', f'{NARUTO}/forms/naruto_onetail'),
    ('FOUR-TAIL', f'{NARUTO}/forms/naruto_fourtail'), ('SAGE', f'{NARUTO}/forms/naruto_sage'),
    ('KCM', f'{NARUTO}/forms/naruto_kcm1'), ('BIJUU', f'{NARUTO}/forms/naruto_kcm2'),
    ('ASHURA', f'{NARUTO}/forms/naruto_sixpaths'), ('BARYON', f'{NARUTO}/forms/naruto_baryon'),
]
CELL = 64
S = 3
ROWS = [('JUTSU 1', 'jutsu1', 0.62), ('ULTIMATE', 'ultimate', 0.68)]
BG = (16, 19, 29, 255)
INK = (228, 235, 246, 255)


def main():
    labelw = 90
    W = labelw + len(FORMS) * (CELL * S + 8)
    H = 30 + len(ROWS) * (CELL * S + 22)
    out = Image(W, H)
    for y in range(H):
        for x in range(W):
            out.set(x, y, *BG)

    for i, (name, _p) in enumerate(FORMS):
        text(out, name, labelw + i * (CELL * S + 8) + 4, 10, 2, INK)

    for r, (rname, clip, at) in enumerate(ROWS):
        y0 = 30 + r * (CELL * S + 22)
        text(out, rname, 6, y0 + CELL * S // 2, 2, INK)
        for i, (_n, path) in enumerate(FORMS):
            img = read_png(os.path.join(path, 'sprite-sheet.png'))
            meta = json.load(open(os.path.join(path, 'fighter.json')))
            info = meta['animations'][clip]
            f = min(info['frames'] - 1, max(0, int(info['frames'] * at)))
            x0 = labelw + i * (CELL * S + 8)
            for y in range(CELL):
                for x in range(CELL):
                    px = img.get(f * CELL + x, info['row'] * CELL + y)
                    if px[3] == 0:
                        continue
                    for dy in range(S):
                        for dx in range(S):
                            out.set(x0 + x * S + dx, y0 + y * S + dy, *px)

    dest = os.path.join(ROOT_DIR, 'reports', 'naruto-effects-preview.png')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    write_png(dest, out)
    print('wrote', os.path.relpath(dest, ROOT_DIR), out.w, out.h)


main()
