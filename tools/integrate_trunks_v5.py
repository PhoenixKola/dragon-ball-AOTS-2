"""Future Trunks, Super Saiyan Trunks, Porunga and wish art from AOTS2_Postgame_Porunga_Trunks_Art_Addon_v1 (see docs/POSTGAME_PORUNGA_TRUNKS_IMPLEMENTATION.md).
Battle: 4x2 sheets (0 idle, 1 guard, 2 charge, 3 attack, 4 special, 5 hurt, 6 victory, 7 KO) -> 448x448 canvases, feet (224,438); box-filter downscale.
The SSJ sheet has a different size, so it is matched to base Trunks by BOOT WIDTH (same body size). Overworld: chibi sheet rows down / left / right / up.
Prints the SSJ/base idle-height ratio (FORM_K in src/engine/assets.ts)."""
import os, sys, glob, json, shutil, re
import numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from v4_common import load, pieces, extract, fit_square, area_downscale

B = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_Postgame_Porunga_Trunks_Art_Addon_v1', 'source_sheets')
PUB = os.path.join(ROOT, 'public', 'assets')
ACT = os.path.join(PUB, 'reviewed', 'actors')
OW = os.path.join(PUB, 'reviewed', 'overworld', 'trunks')
STD = {0: 'idle', 1: 'guard', 2: 'charge', 3: 'attack', 4: 'special', 5: 'hurt', 6: 'victory', 7: 'ko'}
C, AX, AY, HEIGHT = 448, 224, 438, 140


def sheet(rel, minarea=2500):
    f = glob.glob(os.path.join(B, rel))[0]
    im = load(f)
    lab, ids, st, rows = pieces(im, dil=3, minarea=minarea)
    return im, lab, ids


def place(piece, k, W, H, ax, ay):
    pm = Image.fromarray(piece).convert('RGBA')
    if abs(k - 1) > 1e-3:
        pm = area_downscale(pm, k)
    al = np.array(pm)[..., 3]
    ys, xs = np.nonzero(al > 8)
    lo = ys.min() + int((ys.max() - ys.min()) * 0.6)
    cx = xs[ys >= lo].mean()
    x0 = int(round(ax - cx))
    y0 = ay - (ys.max() + 1)
    assert x0 >= 1 and x0 + pm.width <= W - 1 and y0 >= 1, (pm.size, x0, y0)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.alpha_composite(pm, (x0, y0))
    return c


def boots_width(p):
    a = p[..., 3] > 0
    ys = np.nonzero(a.any(axis=1))[0]
    bottom = p[ys.max() - 25:ys.max() + 1, :, 3] > 0
    xs = np.nonzero(bottom.any(axis=0))[0]
    return xs.max() - xs.min()


report = {}
base_im, base_lab, base_ids = sheet('01*/future_trunks_battle_sprite_sheet.png')
ss_im, ss_lab, ss_ids = sheet('02*/super_saiyan_trunks_sprite_sheet.png')
bp = {n: extract(base_im, base_lab, base_ids[i]) for i, n in STD.items()}
sp = {n: extract(ss_im, ss_lab, ss_ids[i]) for i, n in STD.items()}
kb = min(1.0, 2 * HEIGHT / bp['idle'].shape[0])
ks = kb * boots_width(bp['idle']) / boots_width(sp['idle'])
for old in glob.glob(os.path.join(ACT, 'trunks*_*.png')):
    os.remove(old)
for name, crops, k in (('trunks', bp, kb), ('trunks_ssj', sp, ks)):
    for pose, p in crops.items():
        kk = min(k, (C - 12) / p.shape[1], (AY - 6) / p.shape[0])
        c = place(p, kk, C, C, AX, AY)
        bb = c.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        c.save(os.path.join(ACT, f'{name}_{pose}.png'), optimize=True)
        report.setdefault(name, {})[pose] = bb
ratio = (report['trunks_ssj']['idle'][3] - report['trunks_ssj']['idle'][1]) / (report['trunks']['idle'][3] - report['trunks']['idle'][1])
print('FORM_K trunks_ssj =', round(ratio, 4))

# overworld
im, lab, ids = sheet('01*/chibi_swordfighter_sprite_sheet.png')
assert len(ids) == 16
rows = [[extract(im, lab, ids[r * 4 + c]) for c in range(4)] for r in range(4)]
W, H, OAX, OAY = 144, 144, 72, 140
k = 78 / rows[0][0].shape[0]
if os.path.isdir(OW):
    shutil.rmtree(OW)
dirs = {}
for d, row in zip(['down', 'left', 'right', 'up'], rows):
    os.makedirs(os.path.join(OW, d), exist_ok=True)
    names = []
    for i, p in enumerate(row):
        nm = 'idle_000.png' if i == 0 else f'walk_{i - 1:03d}.png'
        place(p, k, W, H, OAX, OAY).save(os.path.join(OW, d, nm), optimize=True)
        names.append(nm)
    dirs[d] = {'idle': [names[0]], 'walk': [names[1], names[2], names[3], names[2]], 'walkMs': 130}
ow = {'provenance': 'AI-sheet (Postgame Porunga/Trunks add-on, chibi_swordfighter_sprite_sheet)', 'approved': True, 'canvas': [W, H], 'anchor': [OAX, OAY], 'scale': 1,
      'limitations': ['Base Trunks only: the pack has no Super Saiyan field sheet, so Super Saiyan Trunks keeps this appearance on the map.', 'Walk cycle = the 3 sheet poses per direction.'],
      'dirs': {k2: dirs[k2] for k2 in ('down', 'up', 'left', 'right')}}
mp = os.path.join(ROOT, 'src', 'data', 'artManifest.generated.ts')
s = open(mp, encoding='utf8').read()
m = re.search(r'export const OVERWORLD: Record<string, OverworldEntity> = (\{.*?\}) as never;\n', s, re.S)
cur = json.loads(m.group(1))
cur['trunks'] = ow
s = s.replace(m.group(0), 'export const OVERWORLD: Record<string, OverworldEntity> = ' + json.dumps(cur, indent=1) + ' as never;\n')
open(mp, 'w', encoding='utf8').write(s)

# portraits
CW, CH = 236, 210


def portrait(piece, name):
    h, w = piece.shape[:2]
    s2 = min(CW / w, CH / h)
    pm = Image.fromarray(piece).convert('RGBA')
    pm = area_downscale(pm, s2) if s2 < 1 else pm.resize((round(w * s2), round(h * s2)), Image.NEAREST)
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    c.alpha_composite(pm, ((CW - pm.width) // 2, CH - pm.height))
    c.save(os.path.join(PUB, 'portraits', name + '.png'), optimize=True)


pi, pl, pids = sheet('01*/future_trunks_pixel_portrait_sprite_sheet.png')
portrait(extract(pi, pl, pids[2]), 'trunks')
si, sl, sids = sheet('02*/super_saiyan_trunks_pixel_portrait_sheet.png')
portrait(extract(si, sl, sids[0]), 'trunks_ssj')


def glow_icon(im, lab, ids, idx, keep_main=False):
    i = ids[idx]
    core = lab == i
    grown = cv2.dilate(core.astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
    others = cv2.dilate(((lab > 0) & ~core).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    m = grown & ~others & (im[..., 3] >= 40)
    if keep_main:   # drop detached specks (neighbouring cells' glow)
        k2, l2, s2, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
        big = s2[1:, 4].max(); m = np.isin(l2, [j + 1 for j, a in enumerate(s2[1:, 4]) if a >= 0.15 * big])
    out = im.copy()
    out[..., 3] = np.where(m, im[..., 3], 0)
    ys, xs = np.nonzero(m)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


wi, wl, wids = sheet('04*/pixel_art_warrior_skill_icon_atlas.png', 1500)
SK = {'swordrush': 0, 'burningattack': 7, 'finishbuster': 18, 'kibarrier': 19, 'phantomstep': 1, 'fieldmedicine': 20, 'resolve': 21, 'chronoslash': 22, 'crossingslash': 23,
      'blazingstrike': 15, 'ssjtrunks': 13, 'ssjburning': 10, 'ssjbuster': 25, 'ssjslashrush': 24, 'swordstorm': 6, 'atk_trunks': 4}
sk_dir = os.path.join(PUB, 'reviewed', 'icons', 'skills')
for n, i in SK.items():
    fit_square(glow_icon(wi, wl, wids, i), 32).save(os.path.join(sk_dir, n + '.png'), optimize=True)
oi, ol, oids = sheet('03*/neon_golden_dragon_orb_icon_sheet.png', 1500)
wd = os.path.join(PUB, 'reviewed', 'icons', 'wish')
os.makedirs(wd, exist_ok=True)
for n, i in {'trunks': 5, 'potential': 9, 'relic': 8, 'orb': 0}.items():
    fit_square(glow_icon(oi, ol, oids, i), 96).save(os.path.join(wd, n + '.png'), optimize=True)
fit_square(glow_icon(oi, ol, oids, 8), 32).save(os.path.join(PUB, 'reviewed', 'icons', 'items', 'dragoncrest.png'), optimize=True)

# Porunga: one consistent source (the pixel-art sheet): 5 full-body poses, 7 star balls, light pillar frames
pr, plb, prids = sheet('03*/porunga_summoning_pixel_art_sprite_sheet.png', 1500)
pd_ = os.path.join(PUB, 'reviewed', 'porunga')
os.makedirs(pd_, exist_ok=True)
for f in glob.glob(os.path.join(pd_, '*.png')):
    os.remove(f)
for n, i in {'idle': 0, 'roar': 1, 'reach': 2, 'grant': 3, 'calm': 4}.items():
    Image.fromarray(extract(pr, plb, prids[i])).save(os.path.join(pd_, f'porunga_{n}.png'), optimize=True)
for n in range(7):
    Image.fromarray(glow_icon(pr, plb, prids, 27 + n, True)).save(os.path.join(pd_, f'ball_{n + 1}.png'), optimize=True)
for n, i in enumerate([37, 38, 39, 40, 41]):
    Image.fromarray(glow_icon(pr, plb, prids, i, True)).save(os.path.join(pd_, f'pillar_{n}.png'), optimize=True)
print('ok', report['trunks']['idle'], report['trunks_ssj']['idle'], len(prids))
