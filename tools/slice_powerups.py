"""Slices the Goku Kaioken / Super Saiyan battle atlases into registered, individually named frames.
Source: aots2-master-art-pack-v2/goku-powerups/{kaioken,super-saiyan}/*.png  (AI-drawn sheets, irregular layout, baked soft aura)
Output: public/assets/reviewed/actors/goku_{kaioken,ssj}_<state>_NN.png  (288x272, feet anchor (144,232), pixels NOT resampled)
        public/assets/reviewed/actors/powerups.manifest.json  (accepted + rejected with reasons)
        evidence/powerups/*_review.png (human review sheets)
Usage: python -I tools/slice_powerups.py
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'art-sources', 'aots2-master-art-pack-v2', 'goku-powerups')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'actors')
EVD = os.path.join(ROOT, 'evidence', 'powerups')
os.makedirs(OUT, exist_ok=True); os.makedirs(EVD, exist_ok=True)
CW, CH, AX, AY = 288, 272, 144, 232
BASE_BODY, BASE_REF = 156, 159   # Alpha 2 base Goku: silhouette height / idle-crop height used as scale reference

SETS = {
    'kaioken': {'file': 'kaioken/kaioken_goku_battle_sprite_sheet.png', 'prefix': 'goku_kaioken', 'thr': 140, 'gap': 14, 'minw': 25,
                'splits': []},
    'ssj': {'file': 'super-saiyan/super_saiyan_goku_battle_sprite_sheet.png', 'prefix': 'goku_ssj', 'thr': 235, 'gap': 10, 'minw': 25,
            'splits': []},
}
# (band, index) -> (state, nth)  ; rows follow the sheet layout (verified visually)
LAYOUT = {
    'kaioken': {0: 'idle', 1: 'powerup', 2: 'attack', 3: 'beam', 4: 'defense', 5: 'victory_vfx'},
    'ssj':     {0: 'idle', 1: 'powerup', 2: 'attack', 3: 'beam', 4: 'defense', 5: 'vfx'},
}


def bands_of(m, y0, y1, minrow=6):
    rows = m[y0:y1].sum(1); out = []; inb = False
    for y, v in enumerate(rows):
        if v > minrow and not inb: s = y; inb = True
        if v <= minrow and inb: out.append((y0 + s, y0 + y)); inb = False
    if inb: out.append((y0 + s, y1))
    return out


def cells_in(m, y0, y1, gap, minw):
    cols = m[y0:y1].sum(0); xs = []; inc = False; g = 0
    for x, v in enumerate(cols):
        if v > 2:
            if not inc: s = x; inc = True
            g = 0; e = x
        elif inc:
            g += 1
            if g > gap: xs.append((s, e + 1)); inc = False
    if inc: xs.append((s, e + 1))
    res = []
    for (x0, x1) in xs:
        if x1 - x0 <= minw: continue
        sub = m[y0:y1, x0:x1]; yy = np.where(sub.any(1))[0]
        res.append([x0, y0 + int(yy.min()), x1, y0 + int(yy.max()) + 1])
    return res


def cluster_cells(m, y0, y1, row_split, minw=25, infl=7):
    """Cells for a dense region: union overlapping component boxes, then order by row (split at row_split) and x."""
    sub = m[y0:y1]
    lab, n = label(sub)
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) < 25: continue
        boxes.append([int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1])
    changed = True
    while changed:
        changed = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] - infl < b[2] and b[0] - infl < a[2] and a[1] - infl < b[3] and b[1] - infl < a[3]:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]; boxes.pop(j); changed = True; break
            if changed: break
    out = [[b[0], b[1] + y0, b[2], b[3] + y0] for b in boxes if b[2] - b[0] > minw]
    rows = {0: [], 1: []}
    for b in out: rows[0 if (b[1] + b[3]) / 2 < row_split else 1].append(b)
    return [sorted(rows[0], key=lambda b: b[0]), sorted(rows[1], key=lambda b: b[0])]


def label(mask):
    h, w = mask.shape; lab = np.zeros((h, w), np.int32); n = 0
    for y0 in range(h):
        for x0 in range(w):
            if mask[y0, x0] and not lab[y0, x0]:
                n += 1; st = [(y0, x0)]; lab[y0, x0] = n
                while st:
                    y, x = st.pop()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                                lab[yy, xx] = n; st.append((yy, xx))
    return lab, n


def extract(atlas, box, pad=10):
    """Crop one cell, drop alpha dust and components that belong to neighbouring cells."""
    H, W = atlas.shape[:2]
    x0, y0, x1, y1 = box
    ex0, ey0, ex1, ey1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    crop = atlas[ey0:ey1, ex0:ex1].copy()
    a = crop[..., 3].astype(int)
    crop[a < 36] = 0                                     # alpha dust
    a = crop[..., 3].astype(int)
    lab, n = label(a >= 60)
    keep = np.zeros(n + 1, bool)
    core = (x0 - ex0, y0 - ey0, x1 - ex0, y1 - ey0)
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) < 12: continue
        cx, cy = xs.mean(), ys.mean()
        if core[0] - 4 <= cx <= core[2] + 4 and core[1] - 4 <= cy <= core[3] + 4: keep[i] = True
    out = crop.copy(); out[~keep[lab]] = 0
    removed = int(((crop[..., 3] > 0) & ~keep[lab]).sum())
    return out, removed


def register(img, boots):
    """Place onto the shared canvas: feet baseline y=AY, horizontal centre of the opaque core at AX. No resampling."""
    a = img[..., 3]
    ys, xs = np.where(a > 0)
    if len(ys) == 0: return None
    core = a > 235
    cys, cxs = np.where(core) if core.any() else (ys, xs)
    cx = (cxs.min() + cxs.max()) / 2
    bottom = boots if boots is not None else cys.max()
    ox = int(round(AX - cx)); oy = int(round(AY - bottom))
    canvas = np.zeros((CH, CW, 4), np.uint8)
    h, w = img.shape[:2]
    # clip report
    clipped = False
    sx0, sy0 = max(0, -ox), max(0, -oy); dx0, dy0 = max(0, ox), max(0, oy)
    sx1, sy1 = min(w, CW - ox), min(h, CH - oy)
    if sx0 > 0 or sy0 > 0 or sx1 < w or sy1 < h:
        lost = img[:sy0].any() or img[:, :sx0].any() or img[sy1:].any() or img[:, sx1:].any()
        clipped = bool(lost)
    canvas[dy0:dy0 + (sy1 - sy0), dx0:dx0 + (sx1 - sx0)] = img[sy0:sy1, sx0:sx1]
    return canvas, clipped


def boots_bottom(img):
    r, g, b, a = [img[..., i].astype(int) for i in range(4)]
    blue = (a > 200) & (b > r + 35) & (b > 100)
    ys = np.where(blue.any(1))[0]
    return int(ys.max()) if len(ys) else None


def main():
    manifest = {'canvas': [CW, CH], 'anchor': [AX, AY], 'sets': {}}
    for sid, cfg in SETS.items():
        im = Image.open(os.path.join(PACK, cfg['file'])).convert('RGBA'); atlas = np.array(im)
        m = atlas[..., 3] > cfg['thr']
        bands = bands_of(m, 0, m.shape[0])
        final_bands = []
        for (y0, y1) in bands:
            cuts = [s for s in cfg['splits'] if y0 < s < y1]
            edges = [y0] + cuts + [y1]
            for i in range(len(edges) - 1): final_bands.append((edges[i], edges[i + 1]))
        entries = []
        for bi, (y0, y1) in enumerate(final_bands):
            if sid == 'ssj' and bi == 4:      # dense region: poses (row 4) + vfx (row 5) interleave vertically
                r4, r5 = cluster_cells(m, y0, y1, 885)
                for ci, box in enumerate(r4): entries.append({'band': 4, 'idx': ci, 'box': box})
                for ci, box in enumerate(r5): entries.append({'band': 5, 'idx': ci, 'box': box})
                continue
            if sid == 'ssj' and bi == 5: continue
            for ci, box in enumerate(cells_in(m, y0, y1, cfg['gap'], cfg['minw'])):
                entries.append({'band': bi, 'idx': ci, 'box': box})
        print(sid, 'raw bands', len(final_bands), 'cells', len(entries))
        # --- logical rows by vertical centre (robust to how many raw bands the projection found) ---
        for e in entries: e['cy'] = (e['box'][1] + e['box'][3]) / 2
        ys_sorted = sorted(set(round(e['cy']) for e in entries)); groups = []
        for y in ys_sorted:
            if groups and y - groups[-1][-1] < 60: groups[-1].append(y)
            else: groups.append([y])
        row_of = {}
        for gi, g in enumerate(groups):
            for y in g: row_of[y] = gi
        for e in entries: e['row'] = row_of[round(e['cy'])]
        entries.sort(key=lambda e: (e['row'], e['box'][0]))
        for r in set(e['row'] for e in entries):
            for i, e in enumerate([x for x in entries if x['row'] == r]): e['idx'] = i
        by_row = {r: [e for e in entries if e['row'] == r] for r in sorted(set(e['row'] for e in entries))}
        expect = {0: 4, 1: 4, 2: 6, 3: 4, 4: 6, 5: 8}
        assert {r: len(v) for r, v in by_row.items()} == expect, (sid, {r: len(v) for r, v in by_row.items()})
        names = {}
        for i in range(4): names[(0, i)] = f'idle_{i+1:02d}'; names[(1, i)] = f'powerup_{i+1:02d}'
        for i in range(6): names[(2, i)] = f'attack_{i+1:02d}'
        for i in range(4): names[(3, i)] = f'beam_{i+1:02d}'
        for i, n in enumerate(['victory_01', 'guard_01', 'guard_02', 'hurt_01', 'hurt_02', 'hurt_03']): names[(4, i)] = n
        if sid == 'kaioken':
            for i, n in enumerate(['victory_02', 'victory_03'] + [f'vfx_{k:02d}' for k in range(1, 7)]): names[(5, i)] = n
        else:
            for i in range(8): names[(5, i)] = f'vfx_{i+1:02d}'
        # --- extract + register ---
        frames = []
        for e in entries:
            box = list(e['box']); note = None
            if e['row'] == 3 and e['idx'] == 2:   # beam firing frame: body-only crop, the baked 400px beam is dropped
                crop0, _ = extract(atlas, box)
                r, g, b_, al = [crop0[..., i].astype(int) for i in range(4)]
                hard = (al > 200) & (((b_ > r + 35) & (b_ > 100)) | (r + g + b_ < 150))
                cols = np.where(hard.any(0))[0]
                # the beam is bright/soft: the body ends where blue boots / dark outline end
                body_end = int(cols.max()) if len(cols) else crop0.shape[1]
                cut = min(crop0.shape[1], body_end + 34)
                crop0[:, cut:] = 0
                crop, removed = crop0, 0
                note = 'body-only crop; baked beam removed (use the validated red/yellow beam VFX family instead)'
            else:
                crop, removed = extract(atlas, box)
            bb = boots_bottom(crop)
            reg = register(crop, bb)
            rec = {'name': f"{cfg['prefix']}_{names[(e['row'], e['idx'])]}", 'row': e['row'], 'idx': e['idx'], 'srcBox': box, 'state': names[(e['row'], e['idx'])].rsplit('_', 1)[0]}
            if note: rec['note'] = note
            if reg is None:
                rec.update(status='rejected', reason='empty after cleanup'); frames.append((rec, None)); continue
            canvas, clipped = reg
            rec.update(clipped=clipped, boots=bb is not None, removedPx=removed, sizePx=[box[2] - box[0], box[3] - box[1]])
            frames.append((rec, canvas))
        idle0 = next(c for r, c in frames if r['name'].endswith('idle_01'))
        a0 = idle0[..., 3]; core = a0 > 235; ys = np.where(core.any(1))[0]
        r_, g_, b_ = [idle0[..., i].astype(int) for i in range(3)]
        dark = (a0 > 200) & (r_ + g_ + b_ < 150); yd = np.where(dark.any(1))[0]
        body_h = (AY - int(yd.min())) if (sid == 'kaioken' and len(yd)) else (AY - int(ys.min()))
        ref_h = round(body_h * BASE_REF / BASE_BODY, 1)
        manifest['sets'][sid] = {'prefix': cfg['prefix'], 'bodyHeightPx': int(body_h), 'refHeightPx': ref_h, 'frames': []}
        sheet_items = []
        for rec, canvas in frames:
            if canvas is not None:
                Image.fromarray(canvas, 'RGBA').save(os.path.join(OUT, rec['name'] + '.png'), optimize=True)
                rec['status'] = 'candidate'; sheet_items.append((rec['name'], canvas))
            manifest['sets'][sid]['frames'].append(rec)
        # review sheet
        cols = 8; cell = (CW // 2 + 8, CH // 2 + 22)
        rows = (len(sheet_items) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * cell[0], rows * cell[1]), (52, 84, 74, 255)); d = ImageDraw.Draw(sheet)
        for i, (nm, cv) in enumerate(sheet_items):
            x, y = (i % cols) * cell[0], (i // cols) * cell[1]
            t = Image.fromarray(cv, 'RGBA').resize((CW // 2, CH // 2), Image.NEAREST)
            d.rectangle([x + 4, y + 18, x + 4 + CW // 2, y + 18 + CH // 2], outline=(90, 120, 110, 255))
            d.line([x + 4, y + 18 + AY // 2, x + 4 + CW // 2, y + 18 + AY // 2], fill=(255, 0, 255, 120))
            d.line([x + 4 + AX // 2, y + 18, x + 4 + AX // 2, y + 18 + CH // 2], fill=(255, 0, 255, 120))
            sheet.alpha_composite(t, (x + 4, y + 18)); d.text((x + 4, y + 3), nm.replace(cfg['prefix'] + '_', ''), fill=(255, 255, 0, 255))
        sheet.save(os.path.join(EVD, f'{sid}_review.png'))
        print(' ', sid, 'body', body_h, 'ref', ref_h, 'frames', len(sheet_items))
    _mf = os.path.join(ROOT, 'art-sources', 'build-extras', 'reviewed', 'actors', 'powerups.manifest.json'); os.makedirs(os.path.dirname(_mf), exist_ok=True)
    json.dump(manifest, open(_mf, 'w'), indent=1)
    # typed runtime manifest: accepted frames grouped by state
    ts = ['// GENERATED by tools/slice_powerups.py. Do not edit by hand.',
          f'export const POWERUP_CANVAS = {{ w: {CW}, h: {CH}, ax: {AX}, ay: {AY} }};',
          'export type PowerupSetId = "goku_kaioken" | "goku_ssj";',
          'export const POWERUP_SETS: Record<PowerupSetId, { refH: number; anims: Record<string, string[]> }> = {']
    for sid, sset in manifest['sets'].items():
        anims = {}
        for f in sset['frames']:
            if f.get('status') == 'rejected': continue
            anims.setdefault(f['state'], []).append(f['name'])
        ts.append(f'  {sset["prefix"]}: {{ refH: {sset["refHeightPx"]}, anims: {json.dumps(anims)} }},')
    ts += ['};', '']
    open(os.path.join(ROOT, 'src', 'data', 'powerupSprites.generated.ts'), 'w', encoding='utf8').write(chr(10).join(ts))


if __name__ == '__main__':
    main()
