"""Item icons from AOTS2_additive_art_pack_v4/dragon_ball_rpg_item_sprite_atlas.png -> public/assets/reviewed/icons/items/<id>.png (32x32).
Replaces the generic procedural icons (many were identical green orbs / sparkles). Usage: python -I tools/integrate_items_v4.py"""
import os, sys, shutil
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from v4_common import load, pieces, extract, fit_square

SRC = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_additive_art_pack_v4', 'dragon_ball_rpg_item_sprite_atlas.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'icons', 'items')
BACKUP = os.path.join(ROOT, 'art-sources', 'replaced-by-v4', 'icons', 'items')
SEEDS = {'medkit': (72, 493), 'megakit': (193, 496), 'kicapsule': (768, 80), 'senzu': (520, 85), 'powercap': (404, 217),
         'guardcap': (1008, 1022), 'vitalcap': (79, 77), 'kicap': (1000, 221), 'speedcap': (636, 218), 'ragecap': (925, 1022), 'frostcore': (1245, 630)}

im = load(SRC)
lab, ids, st, rows = pieces(im)
os.makedirs(BACKUP, exist_ok=True)
for name, (x, y) in SEEDS.items():
    sub = lab[y - 40:y + 40, x - 40:x + 40]
    ys, xs = np.nonzero(sub)
    j = int(np.argmin((xs - 40) ** 2 + (ys - 40) ** 2))
    icon = fit_square(extract(im, lab, int(sub[ys[j], xs[j]])), 32)
    p = os.path.join(OUT, name + '.png')
    if os.path.exists(p) and not os.path.exists(os.path.join(BACKUP, name + '.png')):
        shutil.copy2(p, os.path.join(BACKUP, name + '.png'))
    icon.save(p, optimize=True)
print('items', len(SEEDS))
