#!/usr/bin/env python3
"""
Side-by-side comparison sheet for one fighter's forms.

    python3 tools/form-preview.py            # Naruto, all eight forms

Every form is drawn on the SAME baseline at 6x so the silhouettes can be
compared directly, with a label under each. The 3x5 font is typed into this
file as bit rows — no font file is read, and no pixel comes from anywhere but
the game's own sprite sheets.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from pngio import Image, write_png, read_png

# A 3x5 uppercase pixel font, typed here as bit rows. No font file is read.
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
 '-':(0b000,0b000,0b111,0b000,0b000),' ':(0,0,0,0,0),
 '1':(0b010,0b110,0b010,0b010,0b111),'4':(0b101,0b101,0b111,0b001,0b001),
}
def text(img,s,x,y,scale,col):
    cx=x
    for ch in s.upper():
        g=F.get(ch,F[' '])
        for ry in range(5):
            for rx in range(3):
                if g[ry]>>(2-rx)&1:
                    for dy in range(scale):
                        for dx in range(scale):
                            img.set(cx+rx*scale+dx, y+ry*scale+dy, *col)
        cx+=4*scale
    return cx

ROOT = os.path.join(ROOT_DIR, 'assets', 'fighters', 'naruto')
FORMS=[('BASE',f'{ROOT}/sprite-sheet.png'),
       ('ONE-TAIL',f'{ROOT}/forms/naruto_onetail/sprite-sheet.png'),
       ('FOUR-TAIL',f'{ROOT}/forms/naruto_fourtail/sprite-sheet.png'),
       ('SAGE',f'{ROOT}/forms/naruto_sage/sprite-sheet.png'),
       ('KCM',f'{ROOT}/forms/naruto_kcm1/sprite-sheet.png'),
       ('BIJUU',f'{ROOT}/forms/naruto_kcm2/sprite-sheet.png'),
       ('ASHURA',f'{ROOT}/forms/naruto_sixpaths/sprite-sheet.png'),
       ('BARYON',f'{ROOT}/forms/naruto_baryon/sprite-sheet.png')]
CELL=64; S=6; PAD=10; LABEL=26
CW=CELL*S+PAD*2
out=Image(len(FORMS)*CW, CELL*S+LABEL+PAD)
BG=(22,26,38,255)
for y in range(out.h):
    for x in range(out.w): out.set(x,y,*BG)
# baseline marker: the anchor row every form shares
BASE_Y = 58*S
for i,(name,path) in enumerate(FORMS):
    img=read_png(path)
    ox=i*CW+PAD
    for x in range(CELL*S):
        out.set(ox+x, BASE_Y, 60,70,92,255)
    for y in range(CELL):
        for x in range(CELL):
            r,g,b,a=img.get(0*CELL+x, 0*CELL+y)   # idle frame 0
            if a==0: continue
            for dy in range(S):
                for dx in range(S):
                    out.set(ox+x*S+dx, y*S+dy, r,g,b,a)
    w=len(name)*4*3
    text(out,name, i*CW+(CW-w)//2, CELL*S+6, 3, (232,238,248,255))
OUT_PATH = os.path.join(ROOT_DIR, 'reports', 'naruto-forms-preview.png')
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
write_png(OUT_PATH, out)
print('wrote', os.path.relpath(OUT_PATH, ROOT_DIR), out.w, out.h)
