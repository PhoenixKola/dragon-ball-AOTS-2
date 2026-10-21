"""World objects from AOTS2_additive_art_pack_v4/namek_and_frozen_ruins_tileset.png (RGB sheet on a near-black ground).
Background = pixels with max channel <= 18; each object is the connected piece at a seed point inside a hand-set rectangle (the sheet packs objects tightly).
Writes public/assets/world/obj/<name>.png trimmed (bottom-centre origin is applied by the loader). Usage: python -I tools/integrate_world_v4.py [--preview DIR]"""
import os, sys
import numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_additive_art_pack_v4', 'namek_and_frozen_ruins_tileset.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'world', 'obj')
STAGED = os.path.join(ROOT, 'art-sources', 'staged-v4', 'world-objects')   # clean extractions not placed on a map yet (frozen-ruins set for the Cooler area)
LIVE = {'v4_dome_horn_big', 'v4_tree_blue_big', 'v4_ice_tree', 'v4_ice_tree_big', 'v4_ice_banner', 'v4_ice_pillar_crystal', 'v4_ice_crystal_big', 'v4_cave_big', 'v4_pillar_a', 'v4_pillar_b'}
# name: (seed x, seed y, rect x0, y0, x1, y1)
OBJS = {
    'v4_dome_horn_big': (1255, 60, 1150, 0, 1310, 150), 'v4_cave_big': (1100, 470, 1000, 385, 1215, 550),
    'v4_pillar_a': (770, 490, 745, 430, 800, 545), 'v4_pillar_b': (960, 470, 945, 425, 1000, 545),
    'v4_tree_blue_big': (560, 330, 515, 235, 600, 395),
    'v4_ice_tree': (1135, 585, 1105, 555, 1180, 675), 'v4_ice_tree_big': (1370, 610, 1325, 555, 1425, 690),
    'v4_ice_crystal_big': (940, 640, 880, 555, 1010, 730): (100, 1000, 0, 940, 215, 1080),
    'v4_ice_dome': (1270, 860, 1205, 790, 1345, 925),
    'v4_ice_banner': (1390, 985, 1350, 925, 1440, 1070), 'v4_ice_pillar_crystal': (1010, 990, 960, 935, 1065, 1070),
}
TRIM_TOP = {'v4_ice_cave': 9}   # rows that belong to the tile above it on the sheet
rgb = np.array(Image.open(SRC).convert('RGB'))
bg = rgb.max(axis=2) <= 18
prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
for name, (sx, sy, x0, y0, x1, y1) in OBJS.items():
    fg = np.zeros(bg.shape, np.uint8)
    fg[y0:y1, x0:x1] = (~bg[y0:y1, x0:x1]).astype(np.uint8)
    k, lab, st, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    sub = lab[max(0, sy - 30):sy + 30, max(0, sx - 30):sx + 30]
    ys, xs = np.nonzero(sub)
    j = int(np.argmin((xs - min(30, sx)) ** 2 + (ys - min(30, sy)) ** 2))
    cid = int(sub[ys[j], xs[j]])
    m = lab == cid
    # fill enclosed dark holes so interior outlines are not punched out
    cnt, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(m, np.uint8); cv2.drawContours(filled, cnt, -1, 1, -1)
    ys, xs = np.nonzero(filled)
    a = (filled > 0)
    out = np.dstack([rgb, np.where(a, 255, 0).astype(np.uint8)])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    out = out[TRIM_TOP.get(name, 0):]
    os.makedirs(STAGED, exist_ok=True)
    Image.fromarray(out).save(os.path.join(OUT if name in LIVE else STAGED, name + '.png'), optimize=True)
    if prev:
        os.makedirs(prev, exist_ok=True); Image.fromarray(out).save(os.path.join(prev, name + '.png'))
    print(name, out.shape[1], out.shape[0])
