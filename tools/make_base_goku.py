"""Alpha 3g: derives the base (black-haired, no aura) Goku animation set from the integrated Kaioken frames.
Usage: python -I tools/make_base_goku.py
The Kaioken frames are the cleanest in-style black-haired Goku we have, but carry a red outline and red/pink glow.
For every Kaioken body frame (not the aura-only vfx frames):
  - dark red outline / shadow pixels are recoloured to the neutral dark outline colour
  - bright red or pale pink glow pixels are made transparent
Hair and outline end up neutral blue-black (not red-brown), so base Goku does not read as Kaioken.
Writes public/assets/reviewed/actors/goku_base_<anim>_NN.png (288x272, anchor 144,232, same as the Kaioken set, so the
rendered size matches), three 176x176 stills (goku_idle/attack/hurt.png, used by title/world fallbacks) and registers the
"goku_base" set in src/data/powerupSprites.generated.ts.
Run `python -I tools/gen_sprite_manifest.py` afterwards.
"""
import os, re, shutil
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'actors')
TS = os.path.join(ROOT, 'src', 'data', 'powerupSprites.generated.ts')
QUAR = os.path.join(ROOT, 'art-sources', 'archive', 'replaced-art-v3', 'rom-goku')
ANIMS = ['idle', 'powerup', 'attack', 'beam', 'victory', 'guard', 'hurt']
STILLS = {'idle': 'goku_kaioken_idle_01', 'attack': 'goku_kaioken_attack_01', 'hurt': 'goku_kaioken_hurt_02'}


def clean(im):
    a = np.array(im.convert('RGBA')).astype(np.float32)
    r, g, b, al = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255, a[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn + 1e-6
    h = np.zeros_like(mx)
    m1 = mx == r; h = np.where(m1, ((g - b) / d) % 6, h)
    m2 = (mx == g) & ~m1; h = np.where(m2, (b - r) / d + 2, h)
    m3 = (mx == b) & ~m1 & ~m2; h = np.where(m3, (r - g) / d + 4, h)
    h = h * 60; s = d / (mx + 1e-6); v = mx
    opaque = al > 0
    red = ((h < 9) | (h > 335)) & (s > 0.35) & opaque
    pink = ((h < 8) | (h > 318)) & (s > 0.08) & (s <= 0.5) & (v > 0.75) & opaque
    outline = red & (v < 0.55)
    glow = (red & (v >= 0.55)) | pink
    out = a.copy()
    # red-tinted dark pixels (Kaioken hair/outline) -> neutral blue-black ramp that keeps the shading
    lum = v[outline] * 255
    out[outline, 0] = np.clip(lum * 0.70 + 10, 0, 255); out[outline, 1] = np.clip(lum * 0.72 + 10, 0, 255); out[outline, 2] = np.clip(lum * 0.95 + 18, 0, 255)
    out[glow, 3] = 0
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def main():
    os.makedirs(QUAR, exist_ok=True)
    for pose in ('idle', 'attack', 'hurt'):
        p = os.path.join(ACT, f'goku_{pose}.png')
        if os.path.exists(p) and not os.path.exists(os.path.join(QUAR, f'goku_{pose}.png')): shutil.copy2(p, QUAR)
    anims = {}
    for anim in ANIMS:
        names = sorted(f[:-4] for f in os.listdir(ACT) if re.fullmatch(rf'goku_kaioken_{anim}_\d+\.png', f))
        out_names = []
        for n in names:
            im = Image.open(os.path.join(ACT, n + '.png'))
            on = n.replace('goku_kaioken_', 'goku_base_')
            clean(im).save(os.path.join(ACT, on + '.png')); out_names.append(on)
        anims[anim] = out_names
    for pose, src in STILLS.items():
        im = clean(Image.open(os.path.join(ACT, src + '.png')))
        bb = im.getchannel('A').getbbox(); crop = im.crop(bb)
        canvas = Image.new('RGBA', (176, 176), (0, 0, 0, 0))
        x = 88 - crop.width // 2; y = 172 - crop.height
        canvas.alpha_composite(crop, (max(0, x), max(0, y))) if crop.width <= 176 and crop.height <= 172 else canvas.alpha_composite(crop.crop((0, 0, min(176, crop.width), min(172, crop.height))), (0, 0))
        canvas.save(os.path.join(ACT, f'goku_{pose}.png'))
    for stale in ('guard', 'charge', 'special', 'victory'):
        p = os.path.join(ACT, f'goku_{stale}.png')
        if os.path.exists(p): os.remove(p)
    s = open(TS, encoding='utf-8').read()
    kaioken_ref = re.search(r'goku_kaioken: \{ refH: ([\d.]+)', s).group(1)
    if '"goku_base"' not in s:
        s = s.replace('export type PowerupSetId = "goku_kaioken" | "goku_ssj";', 'export type PowerupSetId = "goku_base" | "goku_kaioken" | "goku_ssj";')
    s = re.sub(r'  goku_base: \{.*?\n', '', s)
    entry = '  goku_base: { refH: %s, anims: %s },\n' % (kaioken_ref, str(anims).replace("'", '"'))
    s = s.replace('  goku_kaioken: {', entry + '  goku_kaioken: {', 1)
    open(TS, 'w', encoding='utf-8').write(s)
    print({k: len(v) for k, v in anims.items()})


if __name__ == '__main__':
    main()
