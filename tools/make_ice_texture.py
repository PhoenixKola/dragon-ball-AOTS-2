"""Seamless frozen-ground tile for the Cooler ruins (public/assets/world/tex/ice.png, 192x192).
Palette sampled from AOTS2_additive_art_pack_v4/namek_and_frozen_ruins_tileset.png (the frozen ground slabs): pale blue frost, violet shadow patches, dark crack lines.
Tileable by construction (periodic value noise, wrapped cracks). Usage: python -I tools/make_ice_texture.py"""
import os
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N, B = 192, 2          # 128px tile, 2px "pixels"
rng = np.random.default_rng(20261020)

def fbm(n, octaves):
    out = np.zeros((n, n)); amp = 1.0; tot = 0
    for o in range(octaves):
        g = 4 * 2 ** o
        grid = rng.random((g, g))
        ys = np.arange(n) * g / n; xs = np.arange(n) * g / n
        y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int); fy = ys - y0; fx = xs - x0
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        a = grid[np.ix_(y0 % g, x0 % g)]; b = grid[np.ix_(y0 % g, (x0 + 1) % g)]
        c = grid[np.ix_((y0 + 1) % g, x0 % g)]; d = grid[np.ix_((y0 + 1) % g, (x0 + 1) % g)]
        out += amp * ((a * (1 - fx)[None, :] + b * fx[None, :]) * (1 - fy)[:, None] + (c * (1 - fx)[None, :] + d * fx[None, :]) * fy[:, None])
        tot += amp; amp *= 0.5
    return out / tot

n = N // B
base = fbm(n, 4); patch = fbm(n, 3)
frost = np.array([116, 178, 238], float); light = np.array([150, 206, 250], float); shade = np.array([84, 128, 214], float); violet = np.array([112, 82, 186], float)
img = frost + (light - frost) * np.clip((base - 0.45) * 3, 0, 1)[..., None] - (frost - shade) * np.clip((0.4 - base) * 3, 0, 1)[..., None]
img = img * (1 - np.clip((patch - 0.68) * 5, 0, 1)[..., None] * 0.55) + violet * np.clip((patch - 0.68) * 5, 0, 1)[..., None] * 0.55
# two short, connected hairline cracks (1 step per pixel so they stay unbroken), wrapped so the tile stays seamless
for _ in range(2):
    x, y = int(rng.integers(0, n)), int(rng.integers(0, n)); dx = int(rng.choice([-1, 1])); dy = int(rng.choice([-1, 1]))
    for _s in range(int(rng.integers(10, 20))):
        img[y % n, x % n] = np.array([88, 84, 176], float)
        if rng.random() < 0.5: x += dx
        else: y += dy
out = np.kron(np.clip(img, 0, 255).astype(np.uint8), np.ones((B, B, 1), np.uint8))
Image.fromarray(out).save(os.path.join(ROOT, 'public', 'assets', 'world', 'tex', 'ice.png'), optimize=True)
print('ice.png', out.shape)
