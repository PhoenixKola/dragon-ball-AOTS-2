"""Cleans AI-derived sprite crops into reviewed runtime assets:
 - snaps near-opaque alpha (>=190) to 255 and faint alpha (<48) to 0 (source alpha was ~252 -> see-through bodies)
 - removes 1px chroma-key fringe (edge pixels whose colour is magenta/red-pink spill and that touch transparency)
 - preserves dimensions and registration (no resampling)
Reads archive/public-unused/actors (raw) -> writes public/assets/reviewed/actors. Idempotent.
Usage: python -I tools/clean_assets.py
"""
import glob, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-sources', 'archive', 'public-unused', 'actors')
DST = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'actors')
os.makedirs(DST, exist_ok=True)

def neighbours_transparent(alpha):
    t = alpha == 0
    up = np.roll(t, 1, 0); dn = np.roll(t, -1, 0); lf = np.roll(t, 1, 1); rt = np.roll(t, -1, 1)
    return up | dn | lf | rt

def clean(path):
    a = np.array(Image.open(path).convert('RGBA'))
    al = a[..., 3].astype(int)
    al[al >= 190] = 255
    al[al < 48] = 0
    a[..., 3] = al.astype(np.uint8)
    for _ in range(2):  # two passes remove 2px of fringe where it exists
        r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
        magenta = (r > 170) & (b > 140) & (g < 100)
        pinkred = (r > 200) & (g < 70) & (b < 120)
        edge = neighbours_transparent(a[..., 3])
        kill = edge & (magenta | pinkred) & (a[..., 3] > 0)
        a[..., 3][kill] = 0
    # clear colour under fully transparent pixels so filtering can never bleed it back
    a[a[..., 3] == 0] = 0
    return Image.fromarray(a, 'RGBA')

n = 0
removed = 0
for p in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    before = np.array(Image.open(p).convert('RGBA'))[..., 3] > 48
    im = clean(p)
    after = np.array(im)[..., 3] > 0
    removed += int(before.sum() - after.sum())
    im.save(os.path.join(DST, os.path.basename(p)), optimize=True)
    n += 1
print(f'cleaned {n} actor sprites; fringe/alpha pixels removed: {removed}')
