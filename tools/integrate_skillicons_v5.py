"""Icons for the v5 learnable library (src/data/skillsLibrary.ts), cut from the v4 energy icon atlas with an optional hue shift so
similar motifs read as different techniques. Writes public/assets/reviewed/icons/skills/<id>.png (32x32) and appends the ids to SKILL_ICON_IDS
in src/data/artManifest.generated.ts. Usage: python -I tools/integrate_skillicons_v5.py"""
import os, sys, re, json
import numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from v4_common import load, pieces, fit_square

SRC = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_additive_art_pack_v4', 'pixel_art_saiyan_energy_icon_atlas.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'icons', 'skills')
# id: (atlas piece, hue shift in degrees)
MAP = {
    'wildfury': (15, 0), 'potentialguard': (53, 0), 'stunstrike': (12, 0), 'kishout': (24, 0), 'parrystance': (57, 0), 'angerstrike': (18, 0), 'twinmasenko': (5, 0), 'rallycry': (56, 0), 'maxpotential': (23, 0),
    'quickjab': (17, 0), 'focusbeam': (1, 0), 'firstaid': (48, 0), 'quickstep': (52, 0), 'distraction': (61, 0), 'hushbeam': (80, 0), 'discvolley': (21, 0), 'afterimage': (59, 0), 'laststand': (10, 0),
    'saiyansmash': (16, 0), 'pointblank': (80, 15), 'battlefury': (54, 0), 'menace': (79, 0), 'crusherkick': (15, 120), 'finishingbuster': (88, 0), 'royalguard': (53, 150), 'finalflash': (90, 0),
    'dragonfist': (22, 0), 'kiblast': (6, 0), 'backhand': (14, 0), 'instantstrike': (65, 0), 'kitransfer': (48, 60), 'turtlestance': (57, 120), 'meteorcombo': (20, 0), 'kisurge': (54, 90), 'kaiokenkame': (7, 150),
    'stretchpunch': (63, 100), 'lightgrenade': (33, 0), 'multiform': (60, 0), 'castoffweights': (56, 90), 'allycover': (53, 100), 'eyelaser': (1, 80), 'namekrenewal': (48, 90), 'demonbarrage': (83, 0), 'maxsbc': (84, 60),
    'e_froststrike': (14, 170), 'e_iceslam': (24, 170), 'e_coolertail': (28, 200), 'e_coolerbeam': (84, 180), 'e_coolerbarrage': (79, 190), 'e_coolerchill': (61, 190), 'e_frostarmor': (53, 0), 'e_coolernova': (88, 120), 'e_coolerbomb': (81, 150),
    'protectivechant': (53, 60), 'inspire': (54, 40), 'bladehand': (18, 100), 'stretchblock': (57, 60), 'piercingthrust': (55, 0), 'warriorsrite': (56, 40),
}
im = load(SRC)
lab, ids, st, rows = pieces(im, dil=3, minarea=800)
assert len(ids) == 92


def glow(i):
    core = lab == i
    grown = cv2.dilate(core.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0
    others = cv2.dilate(((lab > 0) & ~core).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    m = grown & ~others & (im[..., 3] >= 40)
    out = im.copy(); out[..., 3] = np.where(m, im[..., 3], 0)
    ys, xs = np.nonzero(m)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def shift(p, deg):
    if not deg: return p
    hsv = cv2.cvtColor(p[..., :3], cv2.COLOR_RGB2HSV)
    hsv[..., 0] = ((hsv[..., 0].astype(int) + int(deg / 2)) % 180).astype(np.uint8)
    q = p.copy(); q[..., :3] = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB); return q


for name, (idx, hue) in MAP.items():
    fit_square(shift(glow(ids[idx]), hue), 32).save(os.path.join(OUT, name + '.png'), optimize=True)
mp = os.path.join(ROOT, 'src', 'data', 'artManifest.generated.ts')
s = open(mp, encoding='utf8').read()
m = re.search(r'export const SKILL_ICON_IDS: string\[\] = (\[.*?\]);', s)
cur = json.loads(m.group(1))
new = cur + [k for k in MAP if k not in cur]
s = s.replace(m.group(0), 'export const SKILL_ICON_IDS: string[] = ' + json.dumps(new) + ';')
open(mp, 'w', encoding='utf8').write(s)
print('icons', len(MAP), 'total ids', len(new))
