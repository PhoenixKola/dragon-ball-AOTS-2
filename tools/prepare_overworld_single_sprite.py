#!/usr/bin/env python3
"""Normalize one transparent generated character into the reviewed 144px overworld canvas."""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--height", type=int, default=56)
    parser.add_argument("--anchor-y", type=int, default=140)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGBA")
    alpha = source.getchannel("A")
    # Ignore isolated semitransparent export dust while preserving clean antialiased sprite edges.
    mask = alpha.point(lambda a: 255 if a >= 24 else 0)
    bbox = mask.getbbox()
    if not bbox:
        raise SystemExit("source has no visible pixels")
    sprite = source.crop(bbox)
    ratio = args.height / sprite.height
    size = (max(1, round(sprite.width * ratio)), args.height)
    sprite = sprite.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (144, 144), (0, 0, 0, 0))
    x = (144 - sprite.width) // 2
    y = args.anchor_y - sprite.height
    canvas.alpha_composite(sprite, (x, y))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, optimize=True)
    print(f"{args.output}: crop={bbox}, sprite={size}, anchor=(72,{args.anchor_y})")


if __name__ == "__main__":
    main()
