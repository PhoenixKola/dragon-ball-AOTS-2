"""Battle sprites for the whole roster from the Visual Master Handoff v1 sheets (4x2 sheets: 0 idle, 1 guard, 2 charge, 3 attack, 4 special, 5 hurt, 6 victory, 7 KO;
frieza sheets: per form idle / attack / hurt / baked-aura (aura frames are NOT used)). Replaces the old 176px crops with 448x448 native-pixel canvases, scale 1.0 (pose-to-pose proportions exact), feet anchor (176,344), outlines preserved (alpha<250 dark pixels), no touching the canvas edge.
Usage: python -I tools/integrate_battle_v4.py [--preview DIR]"""
import os, sys, glob, shutil, json
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from v4_common import load, pieces, extract, game_heights, area_downscale
H = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_Namek_Saga_Visual_Master_Handoff_v1', 'source_sheets')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'actors')
BACKUP = os.path.join(ROOT, 'art-sources', 'replaced-by-v4', 'actors')
C, AX, AY = 448, 224, 438
STD = {0: 'idle', 1: 'guard', 2: 'charge', 3: 'attack', 4: 'special', 5: 'hurt', 6: 'victory', 7: 'ko'}
NOSPECIAL = {'jeice'}   # the sheet's special frame has a baked pink energy ball
SPECS = {  # char: (sheet glob, {piece index: pose})
    'gohan': ('01_*/kid_gohan_battle', STD), 'krillin': ('01_*/krillin_pixel_battle', STD), 'piccolo': ('01_*/piccolo_pixel_battle', STD),
    'vegeta': ('01_*/vegeta_namek_saga_battle', STD), 'goku': ('01_*/goku_inspired_16_bit', STD), 'ssj_goku': ('01_*/super_saiyan_goku_battle', STD),
    'cui': ('02_*/cui_pixel', STD), 'dodoria': ('02_*/dodoria_s', STD), 'zarbon': ('02_*/zarbon_pixel', STD), 'guldo': ('02_*/guldo_pixel', STD),
    'recoome': ('02_*/recoome_pixel', STD), 'burter': ('02_*/burter_pixel', STD), 'jeice': ('02_*/jeice_pixel', STD), 'ginyu': ('02_*/captain_ginyu', STD),
    'frieza1': ('02_*/frieza_forms', {0: 'idle', 1: 'attack', 2: 'hurt'}), 'frieza2': ('02_*/frieza_forms', {4: 'idle', 5: 'attack', 6: 'hurt'}),
    'frieza3': ('02_*/frieza_forms', {8: 'idle', 9: 'attack', 10: 'hurt'}),
    'cooler': ('03_*/cooler_final_form_battle', STD),
    'frieza4': ('02_*/frieza_final', {0: 'idle', 1: 'attack', 2: 'hurt'}), 'frieza5': ('02_*/frieza_final', {4: 'idle', 5: 'attack', 6: 'hurt'}),
}
HEIGHTS = game_heights(ROOT)
prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
os.makedirs(BACKUP, exist_ok=True)
cache = {}
report = {}
for char, (g, mp) in SPECS.items():
    f = glob.glob(os.path.join(H, g + '*.png'))[0]
    if f not in cache:
        im = load(f); lab, ids, st, rows = pieces(im, dil=3, minarea=4000); cache[f] = (im, lab, ids)
    im, lab, ids = cache[f]
    crops = {pose: extract(im, lab, ids[i]) for i, pose in mp.items() if not (pose == 'special' and char in NOSPECIAL)}
    # the game draws a sprite at HEIGHTS[char] px (idle height); store it at exactly 2x that, box-filtered, so the runtime 0.5 scale is a clean 2x2 average
    sc = min(1.0, 2 * HEIGHTS[char] / crops['idle'].shape[0])
    s = 1.0   # native pixels, NO resampling (Lanczos mangled the stair-stepped hair); only a pose too big for the canvas (KO) is reduced on its own
    for old in glob.glob(os.path.join(OUT, char + '_*.png')):
        b = os.path.basename(old)
        if b[len(char) + 1:-4] in STD.values() and not os.path.exists(os.path.join(BACKUP, b)):
            shutil.copy2(old, os.path.join(BACKUP, b))
        if b[len(char) + 1:-4] in STD.values(): os.remove(old)
    report[char] = {}
    for pose, c in crops.items():
        h, w = c.shape[:2]; k = min(1.0, (C - 12) / w, (AY - 6) / h); nw, nh = max(1, round(w * k)), max(1, round(h * k))
        pm = Image.fromarray(c).convert('RGBA') if k == 1.0 else Image.fromarray(c).convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
        al = np.array(pm)[..., 3]; ys, xs = np.nonzero(al > 8)
        lo = ys.min() + int((ys.max() - ys.min()) * 0.6); cx = xs[ys >= lo].mean()
        x0 = max(6, min(C - 6 - nw, int(round(AX - cx)))); y0 = AY - (ys.max() + 1)
        canvas = Image.new('RGBA', (C, C), (0, 0, 0, 0)); canvas.alpha_composite(pm, (x0, y0))
        canvas = area_downscale(canvas, sc); CS = canvas.width
        bb = canvas.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        assert bb[0] >= 1 and bb[1] >= 1 and bb[2] <= CS - 1, f'{char}_{pose} {bb}'
        canvas.save(os.path.join(OUT, f'{char}_{pose}.png'), optimize=True); report[char][pose] = list(bb)
        if prev: os.makedirs(prev, exist_ok=True); canvas.save(os.path.join(prev, f'{char}_{pose}.png'))
    print(char, round(s, 3), sorted(crops))
