"""Extracts battle poses from AOTS2_additive_art_pack_v4 sheets into public/assets/reviewed/actors (2x canvas 352x352).
Usage: python -I tools/integrate_v4_actors.py [--preview DIR]
Binary alpha (>=250) removes the sheets' coloured semi-transparent fringe; every pose is one connected piece picked by a seed point,
scaled by ONE factor per character (so relative pose sizes stay true), feet anchored at (176, 344). Fails if any pose touches the canvas edge.
"""
import os, sys, shutil, json
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from v4_common import game_heights, area_downscale
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_additive_art_pack_v4')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'actors')
BACKUP = os.path.join(ROOT, 'art-sources', 'replaced-by-v4', 'actors')
C, AX, AY = 448, 224, 438

# char -> sheet, then pose -> (seed x, seed y, options). Seeds were read from the labelled previews; they only need to land in/near the piece.
SPECS = {
 'dende': ('dende_pixel_art_battle_sprite_sheet.png', {
   'idle': (170, 300), 'guard': (520, 300), 'attack': (1281, 290), 'special': (181, 640),
   'hurt': (191, 960), 'victory': (530, 930), 'ko': (1267, 1000)}),
 'nail': ('nail_s_pixel_art_battle_sprite_sheet.png', {
   'idle': (172, 270), 'guard': (525, 270), 'attack': (1251, 268), 'special': (183, 639),
   'hurt': (546, 632), 'victory': (488, 904), 'ko': (938, 1004)}),
 'zarbon2': ('transformed_zarbon_pixel_sprite_sheet.png', {
   'idle': (186, 252), 'attack': (893, 277), 'guard': (194, 592), 'hurt': (1240, 600),
   'victory': (713, 890), 'ko': (1177, 970), 'charge': (258, 893)}),
 'soldier': ('frieza_force_pixel_sprite_sheet.png', {
   'idle': (94, 883), 'guard': (261, 885), 'attack': (437, 884), 'hurt': (627, 879),
   'ko': (1332, 968)}),
}


def solid(im):
    """Opaque art mask: fully opaque pixels plus the semi-transparent DARK outline/hair pixels (the sheets draw their black outlines at alpha 20-250).
    Coloured semi-transparent glow/fringe is excluded."""
    a = im[..., 3].astype(int)
    luma = im[..., 0] * 0.3 + im[..., 1] * 0.59 + im[..., 2] * 0.11
    return (a >= 120) | ((a >= 20) & (luma < 150))


def pick(lab, seed):
    x, y = seed
    r = 40
    sub = lab[max(0, y - r):y + r, max(0, x - r):x + r]
    ys, xs = np.nonzero(sub)
    if len(xs) == 0: raise SystemExit(f'seed {seed} hits nothing')
    d = (xs + max(0, x - r) - x) ** 2 + (ys + max(0, y - r) - y) ** 2
    i = int(np.argmin(d)); return int(sub[ys[i], xs[i]])

def extract(im, seed, opt):
    strict = im[..., 3] >= 250
    k, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(strict.astype(np.uint8), np.ones((3, 3), np.uint8)))
    lab = np.where(strict, lab, 0)
    if 'xmin' in opt: lab[:, :opt['xmin']] = 0
    if 'xmax' in opt: lab[:, opt['xmax']:] = 0
    cid = pick(lab, seed)
    core = lab == cid
    other = strict & ~core
    grown = cv2.dilate(core.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0   # faint hair tips reach ~20px past the opaque core
    keep = (core | (solid(im) & grown & ~other))   # the piece plus its own dark outline pixels (alpha 20-250)
    if opt.get('strip') == 'magenta':
        r, g, b = [im[..., i].astype(int) for i in range(3)]
        hot = (r > 190) & (b > 120) & (g < 150) & (r - g > 90)
        keep &= ~hot
        # drop the detached remnants of the beam, keep the body
        k2, l2, s2, _ = cv2.connectedComponentsWithStats(keep.astype(np.uint8), connectivity=8)
        big = 1 + int(np.argmax(s2[1:, 4])); keep = l2 == big
    k2, l2, s2, _ = cv2.connectedComponentsWithStats(keep.astype(np.uint8), connectivity=8)
    big = s2[1:, 4].max(); keep = np.isin(l2, [i + 1 for i, a in enumerate(s2[1:, 4]) if a >= 0.03 * big])
    out = im.copy(); out[..., 3] = np.where(keep, 255, 0)
    ys, xs = np.nonzero(keep)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], keep[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def main():
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    os.makedirs(BACKUP, exist_ok=True)
    report = {}
    for char, (sheet, poses) in SPECS.items():
        im = np.array(Image.open(os.path.join(PACK, sheet)).convert('RGBA'))
        crops = {}
        for pose, spec in poses.items():
            opt = spec[2] if len(spec) > 2 else {}
            crops[pose] = extract(im, spec[:2], opt)[0]
        s = 1.0
        sc = min(1.0, 2 * game_heights(ROOT)[char] / crops['idle'].shape[0])
        for old in [f for f in os.listdir(OUT) if f.startswith(char + '_') and f[len(char) + 1:-4] in ('idle', 'attack', 'guard', 'hurt', 'charge', 'special', 'victory', 'ko')]:
            if not os.path.exists(os.path.join(BACKUP, old)): shutil.copy2(os.path.join(OUT, old), os.path.join(BACKUP, old))
            os.remove(os.path.join(OUT, old))
        report[char] = {'scale': round(s, 4), 'poses': {}}
        for pose, c in crops.items():
            h, w = c.shape[:2]; k = min(1.0, (C - 12) / w, (AY - 6) / h); nw, nh = max(1, round(w * k)), max(1, round(h * k))
            pm = Image.fromarray(c).convert('RGBA') if k == 1.0 else Image.fromarray(c).convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
            arr = np.array(pm); al = arr[..., 3]
            ys, xs = np.nonzero(al > 8)
            lo = ys.min() + int((ys.max() - ys.min()) * 0.6)
            cx = xs[ys >= lo].mean()
            x0 = int(round(AX - cx)); y0 = AY - (ys.max() + 1) + 0   # ground line at AY
            x0 = max(4, min(C - 4 - nw, x0)); y0 = max(4, y0)
            canvas = Image.new('RGBA', (C, C), (0, 0, 0, 0)); canvas.alpha_composite(pm, (x0, y0))
            canvas = area_downscale(canvas, sc); CS = canvas.width
            bb = canvas.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            assert bb[0] >= 1 and bb[1] >= 1 and bb[2] <= CS - 1 and bb[3] <= CS - 1, f'{char}_{pose} touches canvas edge {bb}'
            canvas.save(os.path.join(OUT, f'{char}_{pose}.png'), optimize=True)
            report[char]['poses'][pose] = list(bb)
            if prev:
                os.makedirs(prev, exist_ok=True); canvas.save(os.path.join(prev, f'{char}_{pose}.png'))
    print(json.dumps(report))

main()
