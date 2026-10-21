"""Replaces ALL overworld character art with the new AI-sheet art.
Sources: AOTS2_Namek_Saga_Visual_Master_Handoff_v1/source_sheets/03_Overworld_Maps_Cooler (goku, gohan, krillin, piccolo, vegeta, SSJ goku; 4x4 grids)
         AOTS2_additive_art_pack_v4/16_bit_rpg_character_sprite_sheet.png (bulma, dende, nail, Frieza-force soldier; irregular, split per frame)
Sheet rows are down / left / right / up (verified on every sheet by looking at the faces). Column 0 is the standing pose, the rest are the walk.
Output: public/assets/reviewed/overworld/<entity>/<dir>/{idle_000,walk_00N}.png on a 144x144 canvas (feet anchor 72,140), displayed 1:1.
Proportions: each entity is scaled so its standing front frame has the height TARGET[entity] (derived from the battle heightPx ratios: Goku 152 -> 88 px).
Patches the OVERWORLD block of src/data/artManifest.generated.ts. Usage: python -I tools/integrate_overworld_v4.py [--preview DIR]
"""
import os, re, sys, json, shutil
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAND = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_Namek_Saga_Visual_Master_Handoff_v1', 'source_sheets', '03_Overworld_Maps_Cooler')
V4 = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_additive_art_pack_v4', '16_bit_rpg_character_sprite_sheet.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'overworld')
W, H, AX, AY = 144, 144, 72, 140
DIRS = ['down', 'left', 'right', 'up']

GRID = {  # entity -> sheet
    'goku_base': 'goku_overworld_walking_sprite_sheet.png',
    'gohan_namek': 'kid_gohan_namek_saga_sprite_sheet.png',
    'krillin': 'krillin_pixel_sprite_sheet_grid.png',
    'piccolo': 'piccolo_16_frame_overworld_sprite_sheet.png',
    'vegeta': 'vegeta_namek_saga_sprite_sheet.png',
    'goku_ssj_test': 'super_saiyan_goku_overworld_sprite_sheet.png',
}
# standing front-frame height in output px (battle heightPx * 0.58): goku 152, vegeta 142, krillin 120, gohan 108, piccolo 188, dende 96, nail 180
TARGET = {'goku_base': 88, 'goku_ssj_test': 92, 'vegeta': 82, 'krillin': 70, 'gohan_namek': 63, 'piccolo': 108, 'bulma': 78, 'dende': 56, 'nail': 104, 'soldier': 76}
# 16-bit sheet groups: entity -> (x0, x1, frame count, scale)
V4GROUPS = {'bulma': (0, 318, 4), 'dende': (328, 585, 3), 'nail': (600, 858, 3), 'soldier': (862, 1135, 3)}
V4ROWS = [(30, 262), (262, 488), (488, 722), (722, 960)]



def solid(im):
    """Opaque art mask: fully opaque pixels plus the semi-transparent DARK outline/hair pixels (the sheets draw their black outlines at alpha 20-250).
    Coloured semi-transparent glow/fringe is excluded."""
    a = im[..., 3].astype(int)
    luma = im[..., 0] * 0.3 + im[..., 1] * 0.59 + im[..., 2] * 0.11
    return (a >= 250) | ((a >= 20) & (luma < 110))


def clean(img, keep):
    keep = keep.astype(np.uint8)
    k, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(keep, np.ones((3, 3), np.uint8)))
    lab = np.where(keep > 0, lab, 0)
    areas = np.bincount(lab.ravel(), minlength=k)[1:]
    ok = [i + 1 for i, a in enumerate(areas) if a >= max(60, 0.05 * areas.max())]
    m = np.isin(lab, ok)
    out = img.copy()
    out[..., 3] = np.where(m, 255, 0)
    ys, xs = np.nonzero(m)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def grid_frames(path):
    im = np.array(Image.open(path).convert('RGBA'))
    m = solid(im).astype(np.uint8)
    k, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((3, 3), np.uint8)))
    comps = [i for i in range(1, k) if st[i, 4] > 9000]
    assert len(comps) == 16, (path, len(comps))
    comps.sort(key=lambda i: st[i, 1] + st[i, 3] / 2)
    rows = [sorted(comps[r * 4:(r + 1) * 4], key=lambda i: st[i, 0]) for r in range(4)]
    return [[clean(im, (lab == i) & (m > 0)) for i in row] for row in rows]


def v4_frames(ent):
    x0, x1, n = V4GROUPS[ent]
    im = np.array(Image.open(V4).convert('RGBA'))
    a = solid(im)
    res = []
    for (y0, y1) in V4ROWS:
        prof = a[y0:y1, x0:x1].sum(axis=0)
        fw = (x1 - x0) / n
        cuts = [0]
        for j in range(1, n):
            e = int(j * fw)
            lo, hi = max(cuts[-1] + 20, e - int(fw * 0.28)), min(x1 - x0 - 20, e + int(fw * 0.28))
            cuts.append(lo + int(np.argmin(prof[lo:hi])))
        cuts.append(x1 - x0)
        row = []
        for j in range(n):
            keep = np.zeros(a.shape, bool)
            keep[y0:y1, x0 + cuts[j]:x0 + cuts[j + 1]] = a[y0:y1, x0 + cuts[j]:x0 + cuts[j + 1]]
            row.append(clean(im, keep))
        res.append(row)
    return res


def place(frame, s):
    h, w = frame.shape[:2]
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    pm = Image.fromarray(frame).convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    al = np.array(pm)[..., 3]
    ys, xs = np.nonzero(al > 8)
    cx = xs.mean()
    x0 = int(round(AX - cx))
    y0 = AY - (ys.max() + 1)
    assert 1 <= x0 and x0 + nw <= W - 1 and y0 >= 1, f'frame {nw}x{nh} does not fit canvas (x0={x0}, y0={y0})'
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.alpha_composite(pm, (x0, y0))
    return c


def write(ent, rows, s, prev):
    base = os.path.join(OUT, ent)
    if os.path.isdir(base):
        shutil.rmtree(base)
    dirs = {}
    for d, row in zip(DIRS, rows):
        os.makedirs(os.path.join(base, d), exist_ok=True)
        scales = [s] * len(row)
        if len(row) == 3:   # the supplied sheet draws some standing frames larger than their walk frames: match their height
            hw = (row[1].shape[0] + row[2].shape[0]) / 2
            if abs(row[0].shape[0] / hw - 1) > 0.06:
                scales[0] = s * hw / row[0].shape[0]
        frames = [place(f, sc) for f, sc in zip(row, scales)]
        names = []
        for i, f in enumerate(frames):
            nm = 'idle_000.png' if i == 0 else f'walk_{i - 1:03d}.png'
            f.save(os.path.join(base, d, nm), optimize=True)
            names.append(nm)
        walk = [names[1], names[2], names[3], names[2]] if len(names) == 4 else [names[1], names[0], names[2], names[0]]
        dirs[d] = {'idle': [names[0]], 'walk': walk, 'walkMs': 130}
        if prev:
            os.makedirs(prev, exist_ok=True)
            strip = Image.new('RGBA', (W * len(frames), H), (70, 70, 90, 255))
            for i, f in enumerate(frames):
                strip.alpha_composite(f, (i * W, 0))
            strip.save(os.path.join(prev, f'{ent}_{d}.png'))
    return {'provenance': 'AI-sheet (Visual Master Handoff v1 / additive pack v4)', 'approved': True,
            'canvas': [W, H], 'anchor': [AX, AY], 'scale': 1,
            'limitations': ['Walk cycles are the 3-4 poses on the source sheet, not hand-timed animation.'],
            'dirs': {k: dirs[k] for k in ('down', 'up', 'left', 'right')}}


def main():
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    man = {}
    for ent, sheet in GRID.items():
        rows = grid_frames(os.path.join(HAND, sheet))
        man[ent] = write(ent, rows, TARGET[ent] / rows[0][0].shape[0], prev)
    for ent in V4GROUPS:
        rows = v4_frames(ent)
        man[ent] = write(ent, rows, TARGET[ent] / rows[0][0].shape[0], prev)
    pf = os.path.join(OUT, 'piccolo_fused')
    if os.path.isdir(pf):
        shutil.rmtree(pf)
    shutil.copytree(os.path.join(OUT, 'piccolo'), pf)
    man['piccolo_fused'] = dict(json.loads(json.dumps(man['piccolo'])), limitations=['Same art as Piccolo: the fusion has no separate field costume in the supplied sheets.'])
    order = ['goku_base', 'gohan_namek', 'krillin', 'vegeta', 'piccolo', 'piccolo_fused', 'goku_ssj_test', 'bulma', 'dende', 'nail', 'soldier']
    block = 'export const OVERWORLD: Record<string, OverworldEntity> = ' + json.dumps({k: man[k] for k in order}, indent=1) + ' as never;\n'
    p = os.path.join(ROOT, 'src', 'data', 'artManifest.generated.ts')
    s = open(p, encoding='utf8').read()
    s = re.sub(r'export const OVERWORLD: Record<string, OverworldEntity> = .*? as never;\n', lambda m: block, s, count=1, flags=re.S)
    s = s.replace('canvas: [number, number]; anchor: [number, number]; limitations', 'canvas: [number, number]; anchor: [number, number]; scale?: number; limitations', 1)
    open(p, 'w', encoding='utf8').write(s)
    print('ok', list(man))


main()
