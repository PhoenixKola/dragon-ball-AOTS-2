"""Rebuild the original, transparent 96x64 buff cue used by Phaser.

Usage: python tools/make_buff_vfx.py
Requires Pillow, already used by the existing art audit. No external art.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public/assets/reviewed/vfx/buff_rise"


def frame(index: int) -> Image.Image:
    im = Image.new("RGBA", (96, 64))
    draw = ImageDraw.Draw(im)
    # Six short, staggered upward glints leave the actor silhouette readable.
    for j in range(6):
        phase = (index * 3 + j * 9) % 48
        x = 29 + (j % 3) * 19 + (j // 3) * 3
        y = 58 - phase
        length = 3 + (j % 3)
        color = [(255, 242, 166, 255), (255, 201, 85, 255), (255, 156, 54, 255)][j % 3]
        draw.rectangle((x, y - length, x + 1, y + length), fill=color)
        draw.rectangle((x - length, y, x + length + 1, y + 1), fill=color)
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i in range(8):
        frame(i).save(OUT / f"{i:03}.png", optimize=True)
    print(f"Wrote 8 transparent buff frames to {OUT}")


if __name__ == "__main__":
    main()
