"""Convert the generated 4-frame Kaioken aura strip to transparent runtime canvases."""
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-sources/production/batch4/kaioken_aura_contact.png'
OUT = ROOT / 'public/assets/reviewed/actors'
CELL_COUNT = 4
CANVAS = (288, 272)
ANCHOR = (144, 232)
VISIBLE_HEIGHT = 216

image = Image.open(SOURCE).convert('RGB')
if image.width % CELL_COUNT:
    raise ValueError(f'contact sheet width {image.width} is not divisible into {CELL_COUNT} frames')
cell_width = image.width // CELL_COUNT

for index in range(CELL_COUNT):
    cell = image.crop((index * cell_width, 0, (index + 1) * cell_width, image.height))
    rgb = cell.load()
    w, h = cell.size
    alpha = Image.new('L', cell.size, 255)
    a = alpha.load()
    queue = deque()
    def is_matte(x, y):
        r, g, b = rgb[x, y]
        return min(r, g, b) >= 238 and max(r, g, b) - min(r, g, b) <= 18
    for x in range(w):
        for y in (0, h - 1):
            if is_matte(x, y) and a[x, y]:
                a[x, y] = 0
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_matte(x, y) and a[x, y]:
                a[x, y] = 0
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0 <= nx < w and 0 <= ny < h and a[nx, ny] and is_matte(nx, ny):
                a[nx, ny] = 0
                queue.append((nx, ny))
    # The ring's hollow center is enclosed and therefore disconnected from the
    # outside matte. Remove that same neutral white matte wherever it appears.
    for y in range(h):
        for x in range(w):
            if is_matte(x, y):
                a[x, y] = 0
    cell.putalpha(alpha)
    box = cell.getchannel('A').getbbox()
    if not box:
        raise ValueError(f'frame {index + 1} is empty')
    aura = cell.crop(box)
    scale = VISIBLE_HEIGHT / aura.height
    dims = (round(aura.width * scale), VISIBLE_HEIGHT)
    aura = aura.resize(dims, Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', CANVAS)
    x = ANCHOR[0] - dims[0] // 2
    y = ANCHOR[1] - dims[1]
    canvas.alpha_composite(aura, (x, y))
    path = OUT / f'goku_kaioken_aura_frame_{index + 1:02}.png'
    canvas.save(path)
    print(f'{path.relative_to(ROOT)} {CANVAS} bbox={canvas.getchannel("A").getbbox()}')
