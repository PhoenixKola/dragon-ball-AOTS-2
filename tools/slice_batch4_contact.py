"""Cut generated contact strips onto reviewed 288x272 actor canvases.

The generator used a light checker matte instead of alpha. This cutter removes only
the connected, near-neutral checkerboard background, then aligns every pose to the
approved reference sprite's feet and measured height.
"""
from collections import deque
from pathlib import Path
import argparse
from statistics import median

from PIL import Image


def strip_background(image: Image.Image, largest_component: bool = False) -> Image.Image:
    rgb = image.convert("RGB")
    px = rgb.load()
    w, h = rgb.size
    mask = Image.new("L", (w, h), 255)
    out = mask.load()
    q: deque[tuple[int, int]] = deque()

    def background(x: int, y: int) -> bool:
        r, g, b = px[x, y]
        return min(r, g, b) >= 215 and max(r, g, b) - min(r, g, b) <= 22

    for x in range(w):
        for y in (0, h - 1):
            if background(x, y) and out[x, y]:
                out[x, y] = 0
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if background(x, y) and out[x, y]:
                out[x, y] = 0
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and out[nx, ny] and background(nx, ny):
                out[nx, ny] = 0
                q.append((nx, ny))
    if largest_component:
        seen = bytearray(w * h)
        best: list[int] = []
        for y in range(h):
            for x in range(w):
                seed = y * w + x
                if not out[x, y] or seen[seed]:
                    continue
                comp: list[int] = []
                todo = [seed]
                seen[seed] = 1
                while todo:
                    idx = todo.pop()
                    comp.append(idx)
                    cx, cy = idx % w, idx // w
                    for ny in range(max(0, cy - 1), min(h, cy + 2)):
                        for nx in range(max(0, cx - 1), min(w, cx + 2)):
                            ni = ny * w + nx
                            if out[nx, ny] and not seen[ni]:
                                seen[ni] = 1
                                todo.append(ni)
                if len(comp) > len(best):
                    best = comp
        keep = set(best)
        for y in range(h):
            for x in range(w):
                if y * w + x not in keep:
                    out[x, y] = 0
    # Strip the pale matte line image generators often leave around a sprite on
    # checkerboard backgrounds. Dark outlines and colored hair/skin/cloth edges remain.
    fringe = []
    for y in range(h):
        for x in range(w):
            if not out[x, y]:
                continue
            edge = any(0 <= nx < w and 0 <= ny < h and not out[nx, ny]
                       for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
            if edge:
                r, g, b = px[x, y]
                if min(r, g, b) >= 104 and max(r, g, b) - min(r, g, b) <= 34:
                    fringe.append((x, y))
    for x, y in fringe:
        out[x, y] = 0
    rgb.putalpha(mask)
    return rgb


def cut(source: Path, reference: Path, output_prefix: str, count: int, size: tuple[int, int] | None = None, largest_component: bool = False, target_height: int | None = None, baseline: int | None = None) -> list[Path]:
    sheet = strip_background(Image.open(source))
    ref = Image.open(reference).convert("RGBA")
    size = size or ref.size
    rb = ref.getchannel("A").getbbox()
    if rb is None:
        raise ValueError(f"reference has no visible pixels: {reference}")
    ref_h = target_height or (rb[3] - rb[1])
    baseline = baseline if baseline is not None else rb[3]
    target_x = size[0] // 2
    outputs: list[tuple[Image.Image, tuple[int, int, int, int]]] = []
    cell_w = sheet.width / count
    for i in range(count):
        left = round(i * cell_w)
        right = round((i + 1) * cell_w)
        cell = sheet.crop((left, 0, right, sheet.height))
        if largest_component:
            cell = strip_background(cell, largest_component=True)
        box = cell.getchannel("A").getbbox()
        if box is None:
            raise ValueError(f"empty generated cell {i + 1}")
        outputs.append((cell.crop(box), box))
    # Use one scale for the whole strip. Per-frame fit-to-height makes a crouch
    # or recoil visibly grow/shrink, so the median visible height calibrates it.
    scale = ref_h / median(box[3] - box[1] for _, box in outputs)
    paths = []
    for i, (sprite, _) in enumerate(outputs):
        dims = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
        sprite = sprite.resize(dims, Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", size)
        x = round(target_x - dims[0] / 2)
        y = baseline - dims[1]
        canvas.alpha_composite(sprite, (x, y))
        path = Path(f"{output_prefix}_{i + 1:02d}.png")
        path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(path)
        paths.append(path)
    return paths


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("reference", type=Path)
    parser.add_argument("output_prefix")
    parser.add_argument("--count", type=int, default=4)
    parser.add_argument("--largest-component", action="store_true", help="remove detached energy/background bits from each cell")
    parser.add_argument("--target-height", type=int, help="visible sprite height on the output canvas")
    parser.add_argument("--baseline", type=int, help="output y coordinate of boot soles")
    parser.add_argument("--size", type=int, nargs=2, metavar=("WIDTH", "HEIGHT"), help="output canvas size")
    args = parser.parse_args()
    output_size = tuple(args.size) if args.size else None
    for path in cut(args.source, args.reference, args.output_prefix, args.count, size=output_size, largest_component=args.largest_component, target_height=args.target_height, baseline=args.baseline):
        print(path)


if __name__ == "__main__":
    main()
