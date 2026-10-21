"""Slices the Planet Namek tileset atlas into named, alpha-trimmed world objects + seamless terrain textures.
Source: attack_of_the_saiyans_2_asset_pack/generated_assets/world_and_tiles/planet_namek_rpg_tileset_atlas.png (AI-generated concept art)
Output: public/assets/world/obj/*.png, public/assets/world/tex/*.png, public/assets/world/atlas/objects.manifest.json,
        evidence/atlas_contact_sheet.png
Usage: python -I tools/slice_atlas.py
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-sources', 'attack_of_the_saiyans_2_asset_pack', 'generated_assets', 'world_and_tiles', 'planet_namek_rpg_tileset_atlas.png')
OUT_OBJ = os.path.join(ROOT, 'public', 'assets', 'world', 'obj')
OUT_TEX = os.path.join(ROOT, 'public', 'assets', 'world', 'tex')
for d in (OUT_OBJ, OUT_TEX, os.path.join(ROOT, 'evidence')):
    os.makedirs(d, exist_ok=True)

im = Image.open(SRC).convert('RGBA')
a = np.array(im)

def edge(m):
    t = ~m
    return np.roll(t, 1, 0) | np.roll(t, -1, 0) | np.roll(t, 1, 1) | np.roll(t, -1, 1)

# alpha: source is ~0..252; binarise and remove chroma-key spill (red/magenta/green fringe) at borders
mask = a[..., 3] > 150
r, g, b = (a[..., i].astype(int) for i in range(3))
for _ in range(2):
    spill = ((r > 200) & (g < 90) & (b < 110)) | ((r > 200) & (b > 150) & (g < 110)) | ((g > 215) & (r < 100) & (b < 100))
    mask &= ~(edge(mask) & spill)
a[..., 3] = np.where(mask, 255, 0).astype(np.uint8)
a[~mask] = 0
clean = Image.fromarray(a, 'RGBA')

# name: (x0, y0, x1, y1) in atlas pixels, measured from the labelled/zoomed atlas
OBJ = {
    'tree_big': (10, 234, 113, 493), 'tree_med': (122, 269, 200, 465), 'tree_s1': (192, 355, 243, 445), 'tree_s2': (252, 285, 310, 440),
    'tree_tiny': (310, 357, 353, 433), 'tree_tiny2': (92, 417, 133, 503), 'tree_big2': (532, 255, 615, 415),
    'dead1': (342, 272, 403, 345), 'dead2': (427, 255, 488, 330), 'dead3': (490, 305, 538, 370),
    'rock_big': (362, 340, 483, 463), 'rock_med': (497, 385, 558, 450), 'rock_s1': (237, 437, 335, 508), 'rock_s2': (167, 465, 228, 505),
    'cliff_wide': (746, 12, 874, 128), 'cliff_low': (746, 125, 841, 235), 'cliff_tall': (886, 97, 964, 235), 'cliff_top': (886, 10, 964, 82),
    'cliff_s1': (976, 10, 1021, 82), 'cliff_s2': (976, 95, 1021, 147), 'cliff_s3': (974, 155, 1021, 235), 'cliff_m1': (1034, 12, 1106, 120),
    'cliff_m2': (1039, 132, 1121, 235), 'cliff_n1': (1129, 55, 1181, 127), 'cliff_n2': (1164, 12, 1211, 95),
    'cave': (1164, 17, 1389, 227),
    'dome_cluster': (603, 250, 850, 445), 'dome_big': (904, 275, 1019, 445), 'dome_door': (861, 370, 959, 442), 'dome_small': (981, 372, 1054, 457),
    'dome_plain': (876, 452, 991, 520), 'dome_tiny': (1009, 467, 1066, 520),
    'spire1': (1104, 272, 1139, 355), 'spire2': (1386, 237, 1421, 317), 'temple': (1089, 235, 1421, 548),
    'ship_ufo': (20, 525, 585, 755), 'ship_hull': (17, 733, 222, 850), 'pod_round': (600, 558, 702, 675), 'pod_eye': (492, 735, 607, 853),
    'pod_open': (620, 743, 720, 855), 'altar': (15, 868, 325, 1060), 'crystals': (335, 875, 550, 1048), 'fence': (580, 958, 700, 1048),
    'tent': (717, 555, 875, 740), 'crate_wood': (910, 563, 950, 612), 'crate_metal': (866, 630, 916, 685), 'crate_dark': (969, 658, 1024, 710),
    'sack': (846, 693, 901, 743), 'barrel': (826, 753, 876, 813), 'bucket': (746, 748, 784, 790), 'bottle': (799, 788, 826, 853),
    'tank_s': (889, 750, 936, 863), 'tank_m': (951, 725, 1026, 850), 'tank_l': (1044, 668, 1139, 848), 'lander': (1015, 520, 1140, 665),
    'panel_a': (1154, 570, 1239, 658), 'panel_vent': (1251, 578, 1341, 658), 'panel_tall': (1154, 665, 1239, 850), 'panel_door': (1251, 735, 1291, 850),
    'namek_elder_f': (1056, 868, 1106, 953), 'namek_f': (1124, 875, 1169, 953), 'namek_kid1_f': (1191, 890, 1229, 953), 'namek_kid2_f': (1246, 885, 1281, 953),
    'namek_elder_b': (1056, 960, 1106, 1045), 'namek_s': (1124, 965, 1169, 1045), 'namek_kid1_b': (1191, 980, 1229, 1045), 'namek_kid2_s': (1246, 975, 1281, 1045),
    'soldier_f': (1304, 868, 1356, 953), 'soldier_f2': (1374, 873, 1424, 953), 'soldier_b': (1304, 960, 1356, 1045), 'soldier_b2': (1374, 965, 1424, 1045),
}
# dragon balls: seven in a row at y~888-935
for i in range(7):
    cx = 620 + i * 63
    OBJ[f'dball{i + 1}'] = (cx - 25, 886, cx + 25, 938)

def largest_components(img, keep_frac=0.25):
    arr = np.array(img); m = arr[..., 3] > 0
    h, w = m.shape
    lab = np.zeros((h, w), int); n = 0; areas = {}
    for y0 in range(h):
        for x0 in range(w):
            if m[y0, x0] and not lab[y0, x0]:
                n += 1; st = [(y0, x0)]; lab[y0, x0] = n; c = 0
                while st:
                    y, x = st.pop(); c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                                lab[yy, xx] = n; st.append((yy, xx))
                areas[n] = c
    if not areas: return img
    big = max(areas.values())
    keep = [k for k, v in areas.items() if v >= big * keep_frac]
    arr[~np.isin(lab, keep)] = 0
    return Image.fromarray(arr, 'RGBA')

KEEP_MULTI = {'crystals', 'altar', 'fence', 'ship_hull', 'dome_cluster', 'tent', 'cave', 'temple', 'ship_ufo'}
manifest = {}
sheet_items = []
for name, (x0, y0, x1, y1) in OBJ.items():
    crop = clean.crop((x0, y0, x1, y1))
    if name not in KEEP_MULTI and not name.startswith('dball'):
        crop = largest_components(crop, 0.35)
    bb = crop.getchannel('A').getbbox()
    if not bb:
        print('EMPTY', name); continue
    crop = crop.crop(bb)
    crop.save(os.path.join(OUT_OBJ, name + '.png'))
    manifest[name] = {'w': crop.width, 'h': crop.height, 'src': [x0 + bb[0], y0 + bb[1], x0 + bb[2], y0 + bb[3]]}
    sheet_items.append((name, crop))

# --- seamless terrain textures: best axis-aligned window dominated by one colour class ---
def window_search(region, pred, size, step=4):
    x0, y0, x1, y1 = region
    best, bestscore = None, -1
    for y in range(y0, y1 - size, step):
        for x in range(x0, x1 - size, step):
            w = a[y:y + size, x:x + size]
            if (w[..., 3] == 255).mean() < 0.995: continue
            score = pred(w).mean()
            if score > bestscore: best, bestscore = (x, y), score
    return best, bestscore

def is_grass(w): return (w[..., 1] > w[..., 0] + 25) & (w[..., 1] > w[..., 2] + 25)
def is_dirt(w): return (w[..., 0] > 170) & (w[..., 1] > 120) & (w[..., 2] < 140) & (w[..., 0] > w[..., 2] + 50)
def is_water(w): return (w[..., 2] > 150) & (w[..., 1] > 130) & (w[..., 0] < 120)

def seamless(img):
    arr = np.array(img.convert('RGB')).astype(float)
    n = arr.shape[0]
    rolled = np.roll(np.roll(arr, n // 2, 0), n // 2, 1)
    ramp = np.sin(np.linspace(0, np.pi, n)) ** 2
    w = np.outer(ramp, ramp)[..., None]
    out = arr * w + rolled * (1 - w)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGB')

TEX = {
    'grass': ((10, 10, 125, 112), is_grass, 56),
    'dirt': ((100, 118, 195, 218), is_dirt, 40),
    'water': ((415, 5, 560, 112), is_water, 56),
}
for name, (region, pred, size) in TEX.items():
    pos, score = window_search(region, pred, size)
    if pos is None:
        print('no window for', name); continue
    tile = clean.crop((pos[0], pos[1], pos[0] + size, pos[1] + size))
    seamless(tile).save(os.path.join(OUT_TEX, name + '.png'))
    manifest['tex_' + name] = {'w': size, 'h': size, 'src': [pos[0], pos[1], pos[0] + size, pos[1] + size], 'purity': round(float(score), 3)}
    print('texture', name, pos, round(float(score), 3))

_mf = os.path.join(ROOT, 'art-sources', 'build-extras', 'world', 'atlas', 'objects.manifest.json'); os.makedirs(os.path.dirname(_mf), exist_ok=True)
json.dump(manifest, open(_mf, 'w'), indent=1)

# contact sheet for human review
cols = 10; cell = 150
rows = (len(sheet_items) + cols - 1) // cols
cs = Image.new('RGBA', (cols * cell, rows * cell), (70, 90, 110, 255))
d = ImageDraw.Draw(cs)
for i, (n, c) in enumerate(sheet_items):
    s = min(1.0, (cell - 20) / max(c.width, c.height))
    t = c.resize((max(1, int(c.width * s)), max(1, int(c.height * s))), Image.LANCZOS)
    x, y = (i % cols) * cell, (i // cols) * cell
    cs.alpha_composite(t, (x + (cell - t.width) // 2, y + 14 + (cell - 14 - t.height) // 2))
    d.text((x + 2, y + 2), n, fill=(255, 255, 0, 255))
cs.save(os.path.join(ROOT, 'evidence', 'atlas_contact_sheet.png'))
print(len(sheet_items), 'objects')
