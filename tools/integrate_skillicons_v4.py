"""Skill / command icons from AOTS2_additive_art_pack_v4/pixel_art_saiyan_energy_icon_atlas.png (glow preserved, alpha < 40 noise removed).
Only icons whose motif genuinely fits a skill replace the old generic one; everything else keeps its existing icon.
Writes 32x32 PNGs over public/assets/reviewed/icons/{skills,commands}. Usage: python -I tools/integrate_skillicons_v4.py"""
import os, sys, shutil
import numpy as np, cv2
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from v4_common import load, pieces, fit_square

SRC = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_additive_art_pack_v4', 'pixel_art_saiyan_energy_icon_atlas.png')
ICONS = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'icons')
BACKUP = os.path.join(ROOT, 'art-sources', 'replaced-by-v4', 'icons')
# piece index in reading order (see docs/V4_ICON_ATLAS_MAP.md for the numbered contact sheet)
SKILLS = {
    'kamehameha': 7, 'ssjkame': 5, 'masenko': 1, 'galick': 84, 'specialbeam': 6, 'bigbang': 2, 'hellzone': 10, 'demonwave': 90, 'spiritbomb': 35,
    'kaioken': 40, 'kaiokenassault': 43, 'ssjfury': 37, 'ssjassault': 38, 'barrage': 14, 'dragonkick': 15, 'hiddenpower': 50,
    'atk_goku': 63, 'atk_gohan': 63, 'atk_krillin': 63, 'atk_vegeta': 63, 'atk_piccolo': 63, 'atk_nail': 63, 'atk_dende': 62,
    'healtouch': 48, 'gallantstrike': 56, 'solarflare': 33,
    'dendehope': 30, 'revitalize': 29, 'namekrevive': 31, 'regenerate': 48, 'kienzan': 4, 'discstorm': 21, 'scatter': 3, 'nailstretch': 64, 'nailbeam': 55,
    'combo_z_trio': 60, 'combo_goku_vegeta': 42, 'combo_gohan_krillin': 46, 'combo_piccolo_gohan': 47, 'combo_vegeta_krillin': 41,
    'e_dodoriabeam': 80, 'e_eraser': 83, 'e_milkycannon': 84, 'e_pummel': 17, 'e_brutalrush': 15, 'e_monstercrush': 71, 'e_ginyupunch': 18, 'e_recoomekick': 16,
    'e_recoomebomber': 24, 'e_burningattack': 76, 'e_crusherball': 11, 'e_cuibarrage': 14, 'e_blasterbarrage': 0, 'e_finalbarrage': 79, 'e_deathslicer': 91,
    'e_hornCharge': 23, 'e_tailwhip': 28, 'e_tailLash': 29, 'e_elegantslash': 4, 'e_moonslash': 90,
    'e_dirtyshot': 2, 'e_psychicthrow': 25, 'e_tauntingflick': 55, 'e_pincer': 27,
    'e_bluehurricane': 8, 'e_counterstance': 62, 'e_timefreezeprep': 61, 'e_bodychange': 59, 'e_deathbeam': 84, 'e_deathball': 81,
    'e_deathwave': 90, 'e_supernova': 88, 'e_deathstorm': 87, 'e_speedrush': 65, 'e_machcrush': 75, 'e_energyshot': 6,
}
COMMANDS = {'defend': 53, 'flee': 52, 'sparking': 45}

im = load(SRC)
lab, ids, st, rows = pieces(im, dil=3, minarea=800)
assert len(ids) == 92, len(ids)


def glow(i):
    core = lab == i
    grown = cv2.dilate(core.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0
    others = cv2.dilate(((lab > 0) & ~core).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    m = grown & ~others & (im[..., 3] >= 40)
    out = im.copy(); out[..., 3] = np.where(m, im[..., 3], 0)
    ys, xs = np.nonzero(m)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def put(group, name, idx):
    p = os.path.join(ICONS, group, name + '.png')
    assert os.path.exists(p), p
    b = os.path.join(BACKUP, group)
    os.makedirs(b, exist_ok=True)
    if not os.path.exists(os.path.join(b, name + '.png')):
        shutil.copy2(p, os.path.join(b, name + '.png'))
    fit_square(glow(ids[idx]), 32).save(p, optimize=True)


for n, i in SKILLS.items(): put('skills', n, i)
for n, i in COMMANDS.items(): put('commands', n, i)
print('skills', len(SKILLS), 'commands', len(COMMANDS))
