"""Slice the generated eight-pose SSJ Goku atlas into the shared battle canvas."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art-sources' / 'goku-ssj-v2' / 'goku_ssj_sprite_atlas.png'
OUT = ROOT / 'public' / 'assets' / 'reviewed' / 'actors'
W, H, AX, FEET, BODY_H = 288, 272, 144, 232, 171
NAMES = [
    'idle_01', 'idle_02', 'idle_03', 'idle_04',
    'guard_01', 'attack_01', 'attack_02', 'special_01',
]

atlas = Image.open(SOURCE).convert('RGBA')
if atlas.width < 4 or atlas.height < 2:
    raise SystemExit(f'Unexpected atlas size: {atlas.size}')
OUT.mkdir(parents=True, exist_ok=True)

for index, name in enumerate(NAMES):
    row, col = divmod(index, 4)
    box = (
        round(col * atlas.width / 4), round(row * atlas.height / 2),
        round((col + 1) * atlas.width / 4), round((row + 1) * atlas.height / 2),
    )
    cell = atlas.crop(box)
    alpha = cell.getchannel('A')
    bounds = alpha.getbbox()
    if bounds is None:
        raise SystemExit(f'Empty atlas cell: {name}')
    sprite = cell.crop(bounds)
    scale = BODY_H / sprite.height
    sprite = sprite.resize((round(sprite.width * scale), BODY_H), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = round(AX - sprite.width / 2)
    y = FEET - BODY_H
    canvas.alpha_composite(sprite, (x, y))
    canvas.save(OUT / f'goku_ssj_v2_{name}.png', optimize=True)
