"""Beta 3 battle-art integration from AOTS2_Beta2_Final_Missing_Art_Pack_v1 (art-sources/packs/). Installs ONLY hand-accepted poses.
Pieces are connected components of the opaque core in reading order (same detector as integrate_battle_v4.py); every index below was chosen by eye
from labelled previews, and effect-carrying frames (baked auras, crescents, beams, glued glows) are deliberately NOT listed.
mode 'keep': the existing idle/attack/hurt stay; new poses are scaled by ONE factor so the new idle piece equals the installed idle's pixel height.
mode 'swap': the new sheet's identity differs from the installed one (mixing would pop between poses), so the whole set is replaced at one native scale.
Usage: python -I tools/integrate_beta3_battle.py [--only name,name]   (originals are copied to art-sources/replaced-by-beta3/actors first)"""
import os, sys, shutil
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from v4_common import load, pieces, extract, area_downscale
PACK = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_Beta2_Final_Missing_Art_Pack_v1')
V4 = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_additive_art_pack_v4')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'actors')
BACKUP = os.path.join(ROOT, 'art-sources', 'replaced-by-beta3', 'actors')
CONTACT = os.path.join(ROOT, 'art-sources', 'replaced-by-beta3')
POSES = ('idle', 'attack', 'guard', 'hurt', 'charge', 'special', 'victory', 'ko')

F = '01_frieza_forms/'
SPECS = {
    'frieza1': dict(sheet=PACK + '/' + F + 'frieza_first_form_battle_sprite_sheet.png', mode='keep', ref=0,
                    poses={'guard': 1, 'charge': 2, 'special': 4, 'victory': 7, 'ko': 9}),
    'frieza2': dict(sheet=PACK + '/' + F + 'frieza_second_form_battle_sprite_sheet.png', mode='swap',
                    poses={'idle': 0, 'guard': 1, 'charge': 2, 'attack': 4, 'special': 5, 'hurt': 6, 'ko': 8}),
    'frieza3': dict(sheet=PACK + '/' + F + 'frieza_third_form_battle_sprite_sheet.png', mode='swap',
                    poses={'idle': 0, 'guard': 1, 'charge': 2, 'attack': 3, 'special': 5, 'hurt': 6, 'victory': 7, 'ko': 8}),
    'frieza4': dict(sheet=PACK + '/' + F + 'frieza_final_form_battle_sprite_sheet.png', mode='keep', ref=0,
                    poses={'guard': 1, 'charge': 2, 'special': 6, 'victory': 9, 'ko': 10}),
    'frieza5': dict(sheet=PACK + '/' + F + 'frieza_final_form_pixel_sprite_sheet.png', mode='swap', minarea=3000,
                    poses={'idle': 0, 'guard': 6, 'charge': 16, 'attack': 11, 'special': 20, 'hurt': 26, 'victory': 29, 'ko': 36}),
    'jeice': dict(sheet=PACK + '/02_bosses_foes/jeice_pixel_art_battle_sprite_sheet.png', mode='keep', ref=0, poses={'special': 11}),
    'soldier': dict(sheet=PACK + '/02_bosses_foes/pixel_art_alien_soldier_sprite_sheet.png', mode='swap',
                    poses={'idle': 0, 'guard': 8, 'attack': 26, 'charge': 40, 'hurt': 31, 'victory': 37, 'ko': 35}),
    # Dende / Nail: the v4 sheets (already installed from) carry a clean screaming stance as their 3rd frame; picked by a point inside the piece.
    'dende': dict(sheet=V4 + '/dende_pixel_art_battle_sprite_sheet.png', mode='keep', ref=(170, 300), poses={'charge': (900, 220)}),
    'nail': dict(sheet=V4 + '/nail_s_pixel_art_battle_sprite_sheet.png', mode='keep', ref=(172, 270), poses={'charge': (880, 200)}),
}


# Poses that existed in the Beta 2 release (docs/BETA2 acceptance CSV): only these are ever backed up, so a re-run never mistakes an earlier output for an original.
ORIGINAL = {**{f'frieza{i}': {'idle', 'attack', 'hurt'} for i in range(1, 6)}, 'soldier': {'idle', 'attack', 'guard', 'hurt', 'ko'},
            'jeice': set(POSES) - {'special'}, 'dende': set(POSES) - {'charge'}, 'nail': set(POSES) - {'charge'}}


def bbox(img):
    return img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()


def pick(lab, ids, st, p):
    if isinstance(p, int):
        return ids[p]
    x, y = p
    for c in ids:
        X, Y, W, H = st[c][:4]
        if X <= x < X + W and Y <= y < Y + H:
            return c
    raise SystemExit(f'no piece at {p}')


def place(c, CS, k):
    """c: RGBA array crop -> CS x CS canvas, scale k (box filter down / Lanczos up on premultiplied alpha), feet at the same fractions as the 448 canvas (224/448, 438/448)."""
    im = Image.fromarray(c)
    if k < 0.999: im = area_downscale(im, k)
    elif k > 1.001:
        im = Image.fromarray(c).convert('RGBa').resize((round(c.shape[1] * k), round(c.shape[0] * k)), Image.LANCZOS).convert('RGBA')
    ax, ay = round(CS * 224 / 448), round(CS * 438 / 448)
    al = np.array(im)[..., 3]; ys, xs = np.nonzero(al > 8)
    lo = ys.min() + int((ys.max() - ys.min()) * 0.6); cx = xs[ys >= lo].mean()
    x0, y0 = int(round(ax - cx)), ay - (ys.max() + 1)
    x0 = max(3 - xs.min(), min(CS - 3 - (xs.max() + 1), x0))   # a wide pose (tail, outstretched arm) slides sideways rather than leaving the canvas
    canvas = Image.new('RGBA', (CS, CS), (0, 0, 0, 0)); canvas.alpha_composite(im, (x0, y0))
    bb = bbox(canvas)
    assert bb and bb[0] >= 1 and bb[1] >= 1 and bb[2] <= CS - 1 and bb[3] <= CS - 1, f'canvas edge/off-canvas {bb} k={k:.3f}'
    return canvas


def main():
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else list(SPECS)
    os.makedirs(BACKUP, exist_ok=True)
    for char in only:
        sp = SPECS[char]
        im = load(sp['sheet']); lab, ids, st, _ = pieces(im, dil=3, minarea=sp.get('minarea', 3000))
        crops = {pose: extract(im, lab, pick(lab, ids, st, i)) for pose, i in sp['poses'].items()}
        old_files = {p: os.path.join(OUT, f'{char}_{p}.png') for p in POSES}
        if sp['mode'] == 'keep':
            old_idle = Image.open(old_files['idle']).convert('RGBA'); CS = old_idle.width
            ref = extract(im, lab, pick(lab, ids, st, sp['ref']))
            k = (bbox(old_idle)[3] - bbox(old_idle)[1]) / ref.shape[0]
        else:
            CS = 448
            k = min([1.0] + [(CS - 12) / c.shape[1] for c in crops.values()] + [(438 - 6) / c.shape[0] for c in crops.values()])
        for p, f in old_files.items():                      # back up every original this run touches (first run only: a backup is never overwritten)
            b = os.path.join(BACKUP, os.path.basename(f))
            if os.path.exists(f) and p in crops and p in ORIGINAL[char] and not os.path.exists(b): shutil.copy2(f, b)
        before = {p: Image.open(os.path.join(BACKUP, f'{char}_{p}.png')).convert('RGBA') for p in POSES if os.path.exists(os.path.join(BACKUP, f'{char}_{p}.png'))}
        if sp['mode'] == 'swap':
            for p, f in old_files.items():                  # a swapped set must not keep stale old poses (e.g. an old victory)
                if os.path.exists(f) and p not in crops:
                    b = os.path.join(BACKUP, os.path.basename(f))
                    if p in ORIGINAL[char] and not os.path.exists(b): shutil.copy2(f, b)
                    os.remove(f)
        for p, c in crops.items():
            try: img = place(c, CS, k)
            except AssertionError: img = place(c, 448, k)   # only a lying KO is wider than a small installed canvas; same pixel scale, anchor fractions are identical
            img.save(old_files[p], optimize=True)
        # before / after contact sheet
        cells = [(p, before.get(p), Image.open(old_files[p]).convert('RGBA')) for p in POSES if os.path.exists(old_files[p])]
        T = 224
        sheet = Image.new('RGBA', (T * len(cells), T * 2 + 14), (70, 70, 70, 255))
        for n, (p, o, nw) in enumerate(cells):
            for row, img in enumerate((o, nw)):
                if img is None: continue
                t = img.resize((T, T), Image.LANCZOS) if img.width != T else img
                sheet.alpha_composite(t, (n * T, row * (T + 14)))
        sheet.convert('RGB').save(os.path.join(CONTACT, f'contact_{char}_before_after.png'))
        print(char, sp['mode'], 'canvas', CS, 'k=%.3f' % k, sorted(crops))


main()
