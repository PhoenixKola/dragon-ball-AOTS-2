"""Slices Goku's Kaioken and Super Saiyan battle sheets into registered, individually named frames.
Source : art-sources/goku-forms/{kaioken,super_saiyan}_goku_pixel_sprite_sheet.png   (the only live source for these forms)
Output : public/assets/reviewed/actors/goku_{kaioken,ssj}_<state>_NN.png   (288x272, feet anchor (144,232), pixels NOT resampled)
         src/data/powerupSprites.generated.ts   (explicit per-set animation tables; base Goku is NOT a set: it is the goku_<pose>.png stills)
         evidence/powerups/*_review.png          (human review sheets, original source cell index printed on each frame)
Usage  : python -I tools/slice_goku_forms.py

Layout facts (checked by eye on the sheets; see docs/GOKU_FORMS.md):
  - Kaioken source cell #1 (top-left, purple trousers / white-yellow top = wrong costume) is NEVER exported.
  - Neither sheet has a crossed-arms guard frame; `guard` is mapped to the crouched ready stance (attack #1) in the tables below.
  - The sheets also contain baked aura / crescent / ring / burst props. They are not used (the engine draws its own VFX), so they are not exported.
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-sources', 'goku-forms')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'actors')
EVD = os.path.join(ROOT, 'evidence', 'powerups')
os.makedirs(OUT, exist_ok=True); os.makedirs(EVD, exist_ok=True)
CW, CH, AX, AY = 288, 272, 144, 232
BASE_BODY, BASE_REF = 156, 159     # base Goku silhouette height / idle-crop reference, used to size forms against base

# name -> (x0, y0, x1, y1) in sheet pixels. Order inside a state is playback order.
SETS = {
    'kaioken': {
        'file': 'kaioken_goku_pixel_sprite_sheet.png', 'prefix': 'goku_kaioken',
        'cells': {
            # idle: sheet cells 2-4 only (cell 1 is the wrong-costume frame)
            'idle_01': (186, 51, 343, 279), 'idle_02': (355, 57, 508, 279), 'idle_03': (529, 52, 691, 279),
            'powerup_01': (703, 80, 880, 285), 'powerup_02': (885, 70, 1055, 285), 'powerup_03': (1060, 40, 1240, 285), 'powerup_04': (1245, 20, 1445, 285),
            'attack_01': (9, 297, 196, 491), 'attack_02': (200, 304, 443, 489), 'attack_03': (440, 304, 701, 490),
            'attack_04': (700, 289, 975, 490), 'attack_05': (1002, 289, 1250, 490), 'attack_06': (1259, 299, 1434, 491),
            'beam_01': (32, 497, 253, 690), 'beam_02': (276, 497, 551, 693), 'beam_03': (555, 497, 1205, 696), 'beam_04': (1218, 495, 1411, 696),
            'victory_01': (73, 700, 250, 940), 'victory_02': (267, 800, 432, 1019),
            'hurt_01': (446, 703, 646, 885), 'hurt_02': (662, 693, 853, 879), 'hurt_03': (858, 698, 1087, 885),
            'ko_01': (1119, 755, 1409, 872),
        },
        'beam_body': 'beam_03',
    },
    'ssj': {
        'file': 'super_saiyan_goku_pixel_sprite_sheet.png', 'prefix': 'goku_ssj',
        'cells': {
            'idle_01': (339, 10, 482, 195), 'idle_02': (533, 10, 676, 195), 'idle_03': (724, 10, 867, 196), 'idle_04': (920, 10, 1063, 196),
            'powerup_01': (276, 209, 476, 400), 'powerup_02': (491, 197, 695, 401), 'powerup_03': (708, 198, 909, 401), 'powerup_04': (935, 200, 1190, 405),
            'attack_01': (38, 404, 235, 545), 'attack_02': (252, 409, 476, 569), 'attack_03': (495, 408, 747, 569),
            'attack_04': (745, 408, 996, 570), 'attack_05': (1005, 403, 1250, 580), 'attack_06': (1262, 403, 1414, 560),
            'beam_01': (92, 575, 300, 740), 'beam_02': (362, 577, 600, 741), 'beam_03': (614, 570, 1170, 740), 'beam_04': (1178, 575, 1414, 741),
            'victory_01': (81, 748, 300, 910), 'victory_02': (95, 905, 225, 1082), 'victory_03': (235, 905, 380, 1082),
            'guard_01': (414, 744, 576, 909),
            'hurt_01': (687, 746, 907, 904),
            'ko_01': (912, 768, 1177, 886),
        },
        'beam_body': 'beam_03',
    },
}

# Playback tables. A frame name may repeat (ping-pong idle). `guard` reuses the crouched ready stance when a sheet has no guard frame.
ANIMS = {
    'kaioken': {
        'idle': ['idle_01', 'idle_02', 'idle_03', 'idle_02'],
        'powerup': ['powerup_01', 'powerup_02', 'powerup_03', 'powerup_04'],
        'attack': ['attack_01', 'attack_02', 'attack_03', 'attack_04', 'attack_05', 'attack_06'],
        'beam': ['beam_01', 'beam_02', 'beam_03', 'beam_04'],
        'victory': ['victory_01', 'victory_02'],
        'guard': ['attack_01'],
        'hurt': ['hurt_01', 'hurt_02', 'hurt_03'],
        'ko': ['ko_01'],
    },
    'ssj': {
        'idle': ['idle_01', 'idle_02', 'idle_03', 'idle_04'],
        'powerup': ['powerup_01', 'powerup_02', 'powerup_03', 'powerup_04'],
        'attack': ['attack_01', 'attack_02', 'attack_03', 'attack_04', 'attack_05', 'attack_06'],
        'beam': ['beam_01', 'beam_02', 'beam_03', 'beam_04'],
        'victory': ['victory_01', 'victory_02', 'victory_03'],
        'guard': ['guard_01'],
        'hurt': ['hurt_01'],
        'ko': ['ko_01'],
    },
}


def label(mask):
    import cv2
    n, lab = cv2.connectedComponents(mask.astype(np.uint8), connectivity=8)
    return lab, n - 1


def extract(atlas, box, pad=10):
    """Crop one cell, drop alpha dust and components that belong to neighbouring cells."""
    H, W = atlas.shape[:2]
    x0, y0, x1, y1 = box
    ex0, ey0, ex1, ey1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    crop = atlas[ey0:ey1, ex0:ex1].copy()
    crop[crop[..., 3] < 36] = 0
    lab, n = label(crop[..., 3] >= 60)
    keep = np.zeros(n + 1, bool)
    core = (x0 - ex0, y0 - ey0, x1 - ex0, y1 - ey0)
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) < 12: continue
        cx, cy = xs.mean(), ys.mean()
        if core[0] - 4 <= cx <= core[2] + 4 and core[1] - 4 <= cy <= core[3] + 4: keep[i] = True
    out = crop.copy(); out[~keep[lab]] = 0
    return out


def boots_bottom(img):
    r, g, b, a = [img[..., i].astype(int) for i in range(4)]
    blue = (a > 200) & (b > r + 35) & (b > 100)
    ys = np.where(blue.any(1))[0]
    return int(ys.max()) if len(ys) else None


def register(img, boots):
    """Place onto the shared canvas: feet baseline y=AY, horizontal centre of the opaque core at AX. No resampling."""
    a = img[..., 3]
    ys, xs = np.where(a > 0)
    if len(ys) == 0: return None, False
    core = a > 235
    cys, cxs = np.where(core) if core.any() else (ys, xs)
    cx = (cxs.min() + cxs.max()) / 2
    bottom = boots if boots is not None else cys.max()
    ox = int(round(AX - cx)); oy = int(round(AY - bottom))
    canvas = np.zeros((CH, CW, 4), np.uint8)
    h, w = img.shape[:2]
    sx0, sy0 = max(0, -ox), max(0, -oy); dx0, dy0 = max(0, ox), max(0, oy)
    sx1, sy1 = min(w, CW - ox), min(h, CH - oy)
    solid = img[..., 3] > 200   # only solid pixels count: a faint aura edge may be trimmed by the canvas
    lost = bool(solid[:sy0].any() or solid[:, :sx0].any() or solid[sy1:].any() or solid[:, sx1:].any())
    canvas[dy0:dy0 + (sy1 - sy0), dx0:dx0 + (sx1 - sx0)] = img[sy0:sy1, sx0:sx1]
    return canvas, lost


def strip_baked_beam(crop):
    """The firing frame has a ~600px beam painted in; keep the body only (the validated beam VFX family replaces it)."""
    r, g, b, al = [crop[..., i].astype(int) for i in range(4)]
    hard = (al > 200) & (((b > r + 35) & (b > 100)) | (r + g + b < 150))
    cols = np.where(hard.any(0))[0]
    end = int(cols.max()) if len(cols) else crop.shape[1]
    crop = crop.copy(); crop[:, min(crop.shape[1], end + 12):] = 0
    core = (np.minimum(np.minimum(r, g), b) > 205)   # white beam core hugging the hands
    core[:, :max(0, end - 6)] = False
    crop[core] = 0
    return crop


def main():
    # clean out previous Kaioken / SSJ exports so no stale frame can survive a re-run
    for f in os.listdir(OUT):
        if f.startswith(('goku_kaioken_', 'goku_ssj_')) and f.endswith('.png'): os.remove(os.path.join(OUT, f))
    manifest = {'canvas': [CW, CH], 'anchor': [AX, AY], 'sets': {}}
    refs = {}
    for sid, cfg in SETS.items():
        atlas = np.array(Image.open(os.path.join(SRC, cfg['file'])).convert('RGBA'))
        names = list(cfg['cells'])
        used = {n for lst in ANIMS[sid].values() for n in lst}
        assert used <= set(names), (sid, used - set(names))
        assert set(names) <= used, (sid, set(names) - used)
        frames = {}
        recs = []
        for n, box in cfg['cells'].items():
            crop = extract(atlas, box)
            if n == cfg['beam_body']: crop = strip_baked_beam(crop)
            bb = boots_bottom(crop)
            canvas, clipped = register(crop, bb)
            assert canvas is not None, (sid, n, 'empty')
            if clipped: print('  note:', sid, n, 'aura trimmed by the shared canvas')
            full = f"{cfg['prefix']}_{n}"
            Image.fromarray(canvas, 'RGBA').save(os.path.join(OUT, full + '.png'), optimize=True)
            frames[n] = canvas
            recs.append({'name': full, 'srcBox': list(box), 'boots': bb is not None, 'auraTrimmed': clipped})
        idle0 = frames['idle_01']
        a0 = idle0[..., 3]; ys = np.where((a0 > 235).any(1))[0]
        r_, g_, b_ = [idle0[..., i].astype(int) for i in range(3)]
        dark = (a0 > 200) & (r_ + g_ + b_ < 150); yd = np.where(dark.any(1))[0]
        body_h = (AY - int(yd.min())) if (sid == 'kaioken' and len(yd)) else (AY - int(ys.min()))
        refs[sid] = round(body_h * BASE_REF / BASE_BODY, 1)
        manifest['sets'][sid] = {'prefix': cfg['prefix'], 'bodyHeightPx': int(body_h), 'refHeightPx': refs[sid], 'frames': recs}
        # review sheet: every exported frame, plus the anim tables
        cols = 8; cell = (CW // 2 + 8, CH // 2 + 22)
        rows = (len(names) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * cell[0], rows * cell[1]), (52, 84, 74, 255)); d = ImageDraw.Draw(sheet)
        for i, n in enumerate(names):
            x, y = (i % cols) * cell[0], (i // cols) * cell[1]
            t = Image.fromarray(frames[n], 'RGBA').resize((CW // 2, CH // 2), Image.NEAREST)
            d.rectangle([x + 4, y + 18, x + 4 + CW // 2, y + 18 + CH // 2], outline=(90, 120, 110, 255))
            d.line([x + 4, y + 18 + AY // 2, x + 4 + CW // 2, y + 18 + AY // 2], fill=(255, 0, 255, 120))
            d.line([x + 4 + AX // 2, y + 18, x + 4 + AX // 2, y + 18 + CH // 2], fill=(255, 0, 255, 120))
            sheet.alpha_composite(t, (x + 4, y + 18)); d.text((x + 4, y + 3), n, fill=(255, 255, 0, 255))
        sheet.save(os.path.join(EVD, f'{sid}_review.png'))
        print(sid, 'body', body_h, 'ref', refs[sid], 'frames', len(names))
    mf = os.path.join(ROOT, 'art-sources', 'build-extras', 'reviewed', 'actors', 'powerups.manifest.json')
    os.makedirs(os.path.dirname(mf), exist_ok=True)
    json.dump(manifest, open(mf, 'w'), indent=1)

    sets = {cfg['prefix']: (refs[sid], {st: [f"{cfg['prefix']}_{n}" for n in lst] for st, lst in ANIMS[sid].items()}) for sid, cfg in SETS.items()}
    ts = ['// GENERATED by tools/slice_goku_forms.py. Do not edit by hand.',
          f'export const POWERUP_CANVAS = {{ w: {CW}, h: {CH}, ax: {AX}, ay: {AY} }};',
          'export type PowerupSetId = "goku_kaioken" | "goku_ssj";',
          'export const POWERUP_SETS: Record<PowerupSetId, { refH: number; anims: Record<string, string[]> }> = {']
    for k, (ref, anims) in sets.items(): ts.append(f'  {k}: {{ refH: {ref}, anims: {json.dumps(anims)} }},')
    ts += ['};', '']
    open(os.path.join(ROOT, 'src', 'data', 'powerupSprites.generated.ts'), 'w', encoding='utf8').write('\n'.join(ts))


if __name__ == '__main__':
    main()
