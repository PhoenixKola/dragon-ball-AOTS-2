"""Builds dialogue / HUD portraits from NEW art only.
- bulma, dende, nail, cui, zarbon, frieza1, frieza4, cooler: the seven busts of AOTS2_additive_art_pack_v4/retro_saiyan_portrait_sprite_sheet.png
- goku, gohan, krillin, piccolo: head-and-shoulders crops of the idle pose on the Visual Master Handoff v1 hero battle sheets
All are 236x210 RGBA, bottom-aligned, binary-clean alpha, with a 3px dark base line where a bust is cut by the crop.
Usage: python -I tools/integrate_portraits_v4.py
"""
import os, glob, shutil
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_additive_art_pack_v4', 'retro_saiyan_portrait_sprite_sheet.png')
HERO = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_Namek_Saga_Visual_Master_Handoff_v1', 'source_sheets', '01_Hero_Battle')
OUT = os.path.join(ROOT, 'public', 'assets', 'portraits')
BACKUP = os.path.join(ROOT, 'art-sources', 'replaced-by-v4', 'portraits')
CW, CH = 236, 210



def solid(im):
    """Opaque art mask: fully opaque pixels plus the semi-transparent DARK outline/hair pixels (the sheets draw their black outlines at alpha 20-250).
    Coloured semi-transparent glow/fringe is excluded."""
    a = im[..., 3].astype(int)
    luma = im[..., 0] * 0.3 + im[..., 1] * 0.59 + im[..., 2] * 0.11
    return (a >= 250) | ((a >= 20) & (luma < 110))


def pieces(im, dil=3, minarea=4000):
    m = solid(im).astype(np.uint8)
    k, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((dil, dil), np.uint8)))
    lab = np.where(m > 0, lab, 0)
    areas = np.bincount(lab.ravel(), minlength=k)
    ids = [i for i in range(1, k) if areas[i] >= minarea]
    return lab, ids, st


def crop_piece(im, lab, i, drop_small=True):
    keep = lab == i
    if drop_small:
        k2, l2, s2, _ = cv2.connectedComponentsWithStats(keep.astype(np.uint8), connectivity=8)
        big = s2[1:, 4].max()
        keep = np.isin(l2, [j + 1 for j, a in enumerate(s2[1:, 4]) if a >= 0.02 * big])
    out = im.copy()
    out[..., 3] = np.where(keep, 255, 0)
    ys, xs = np.nonzero(keep)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def compose(piece, name, base_line=False):
    h, w = piece.shape[:2]
    s = min(CW / w, CH / h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    pm = Image.fromarray(piece).convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    c.alpha_composite(pm, ((CW - nw) // 2, CH - nh))
    if base_line:
        a = np.array(c)
        edge = np.zeros(a.shape[:2], bool)   # frame the crop: dark base line plus dark side lines where the crop cuts the art
        edge[CH - 3:, :] = True
        bb = c.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if bb[0] <= 1: edge[:, :3] = True
        if bb[2] >= CW - 1: edge[:, CW - 3:] = True
        a[edge & (a[..., 3] > 128)] = (18, 14, 24, 255)
        c = Image.fromarray(a)
    if os.path.exists(os.path.join(OUT, name + '.png')) and not os.path.exists(os.path.join(BACKUP, name + '.png')):
        os.makedirs(BACKUP, exist_ok=True)
        shutil.copy2(os.path.join(OUT, name + '.png'), os.path.join(BACKUP, name + '.png'))
    c.save(os.path.join(OUT, name + '.png'), optimize=True)
    bb = c.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    print(name, (nw, nh), bb)


def main():
    im = np.array(Image.open(PACK).convert('RGBA'))
    lab, ids, st = pieces(im)
    ids.sort(key=lambda i: (int(st[i, 1] + st[i, 3] / 2 > 560), st[i, 0]))
    assert len(ids) == 7, len(ids)
    names = ['bulma', 'dende', 'nail', 'cui', 'zarbon', 'frieza1', 'cooler']
    for n, i in zip(names, ids):
        compose(crop_piece(im, lab, i), n)
    shutil.copy2(os.path.join(OUT, 'frieza1.png'), os.path.join(OUT, 'frieza4.png'))
    # hero busts: idle pose = first piece in reading order; head centre from its top quarter
    for name, sheet in (('goku', 'goku_inspired_16_bit_battle_sprite_sheet.png'), ('gohan', 'kid_gohan_battle_sprite_sheet.png'),
                        ('krillin', 'krillin_pixel_battle_sprite_sheet.png'), ('piccolo', 'piccolo_pixel_battle_sprite_sheet.png')):
        hi = np.array(Image.open(os.path.join(HERO, sheet)).convert('RGBA'))
        hl, hids, hst = pieces(hi, minarea=8000)
        hids.sort(key=lambda i: (round((hst[i, 1] + hst[i, 3] / 2) / 300), hst[i, 0]))
        piece = crop_piece(hi, hl, hids[0])
        h, w = piece.shape[:2]
        al = piece[..., 3] > 0
        top = np.nonzero(al[:max(8, h // 4)])
        cx = int(np.median(top[1]))
        ch = int(h * 0.60)
        cw = int(ch * CW / CH)
        x0 = max(0, min(w - cw, cx - cw // 2))
        sub = piece[:ch, x0:x0 + cw].copy()
        ys, xs = np.nonzero(sub[..., 3] > 0)
        sub = sub[ys.min():, xs.min():xs.max() + 1]
        compose(sub, name, base_line=True)


main()
