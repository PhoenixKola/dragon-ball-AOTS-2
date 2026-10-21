"""Shared helpers for the additive-pack-v4 integration tools (import with sys.path.insert(0, tools dir): the tools run under python -I)."""
import numpy as np, cv2
from PIL import Image


def solid(im):
    """Art mask: every pixel at alpha >= 120 plus dark (outline/hair) pixels down to alpha 20, so soft-edged hair tips are kept.
    Faint coloured glow/fringe is excluded."""
    a = im[..., 3].astype(int)
    luma = im[..., 0] * 0.3 + im[..., 1] * 0.59 + im[..., 2] * 0.11
    return (a >= 120) | ((a >= 20) & (luma < 150))


def load(path):
    return np.array(Image.open(path).convert('RGBA'))


def pieces(im, dil=3, minarea=1200):
    """Connected pieces of the opaque core, reading order (rows by gap, then x). Returns (label image, [ids], stats)."""
    strict = im[..., 3] >= 250
    k, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(strict.astype(np.uint8), np.ones((dil, dil), np.uint8)))
    lab = np.where(strict, lab, 0)
    ids = [i for i in range(1, k) if st[i, 4] >= minarea]
    ids.sort(key=lambda i: st[i, 1] + st[i, 3] / 2)
    rows, cur = [], [ids[0]] if ids else []
    for i in ids[1:]:
        if (st[i, 1] + st[i, 3] / 2) - (st[cur[-1], 1] + st[cur[-1], 3] / 2) > 0.45 * np.median(st[ids, 3]):
            rows.append(cur); cur = []
        cur.append(i)
    if cur: rows.append(cur)
    return lab, [i for r in rows for i in sorted(r, key=lambda j: st[j, 0])], st, rows


def extract(im, lab, cid, strict_other=True, min_frac=0.02, open_k=0):
    """The piece plus its own dark outline pixels, trimmed. Small stray specks are dropped."""
    strict = im[..., 3] >= 250
    core = lab == cid
    grown = cv2.dilate(core.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0   # faint hair tips reach ~20px past the opaque core
    keep = core | (solid(im) & grown & ~(strict & ~core))
    k2, l2, s2, _ = cv2.connectedComponentsWithStats(keep.astype(np.uint8), connectivity=8)
    big = s2[1:, 4].max()
    keep = np.isin(l2, [j + 1 for j, a in enumerate(s2[1:, 4]) if a >= min_frac * big])
    if open_k:   # removes 1-2px wisps/specks around hair and limbs (opening with a small kernel keeps the stair-stepped shapes)
        keep = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_OPEN, np.ones((open_k, open_k), np.uint8)) > 0
    out = im.copy()
    out[..., 3] = np.where(keep, 255, 0)
    ys, xs = np.nonzero(keep)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def fit_square(piece, size, margin=1):
    h, w = piece.shape[:2]
    s = (size - 2 * margin) / max(w, h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    pm = Image.fromarray(piece).convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    c.alpha_composite(pm, ((size - nw) // 2, (size - nh) // 2))
    return c


def game_heights(root):
    """sprite id -> on-screen heightPx (heroes.ts / enemies.ts). ssj_goku shares Goku's; the soldier averages scout (150) and guard (156)."""
    import re, os
    h = {}
    hs = open(os.path.join(root, 'src', 'data', 'heroes.ts'), encoding='utf8').read()
    for m in re.finditer(r"id: '(\w+)', name: [^\n]*?sprite: '(\w+)'.*?heightPx: (\d+)", hs, re.S):
        h[m.group(2)] = int(m.group(3))
    es = open(os.path.join(root, 'src', 'data', 'enemies.ts'), encoding='utf8').read()
    for m in re.finditer(r"sprite: '(\w+)'.*?heightPx: (\d+)", es):
        h.setdefault(m.group(1), int(m.group(2)))
    h['ssj_goku'] = h['goku']; h['trunks_ssj'] = h.get('trunks', 140); h['soldier'] = 153
    return h


def area_downscale(img, s):
    """Box-filter (INTER_AREA) downscale of an RGBA PIL image on premultiplied alpha: no halo, no ringing, no mangled stair-stepped hair."""
    if s >= 0.999:
        return img
    a = np.array(img).astype(np.float32)
    a[..., :3] *= a[..., 3:4] / 255.0
    w, h = img.size
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    r = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA)
    al = r[..., 3:4]
    r[..., :3] = np.where(al > 0.5, r[..., :3] * 255.0 / np.maximum(al, 1), 0)
    return Image.fromarray(np.clip(r + 0.5, 0, 255).astype(np.uint8))
