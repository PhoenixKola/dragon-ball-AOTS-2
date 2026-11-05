"""Cut a transparent 4x4 directional overworld NPC atlas into anchored 144px frames."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


DIRS = ('down', 'up', 'left', 'right')
POSES = ('idle_000', 'walk_000', 'walk_001', 'walk_002')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('atlas', type=Path)
    parser.add_argument('entity')
    parser.add_argument('--height', type=int, default=84, help='max visible sprite height in the 144px frame')
    args = parser.parse_args()
    source = args.atlas.resolve()
    image = Image.open(source).convert('RGBA')
    if image.width < 400 or image.height < 400 or image.width / image.height > 1.05 or image.height / image.width > 1.05:
        raise SystemExit('Expected a square 4x4 atlas with transparent spacing.')

    target = Path('public/assets/reviewed/overworld') / args.entity
    target.mkdir(parents=True, exist_ok=True)
    output_hashes: dict[str, str] = {}
    for row, direction in enumerate(DIRS):
        folder = target / direction
        folder.mkdir(parents=True, exist_ok=True)
        for col, pose in enumerate(POSES):
            cell = image.crop((col * image.width // 4, row * image.height // 4,
                               (col + 1) * image.width // 4, (row + 1) * image.height // 4))
            alpha = cell.getchannel('A')
            bbox = alpha.getbbox()
            if not bbox:
                raise SystemExit(f'Empty atlas cell at row {row + 1}, column {col + 1}')
            sprite = cell.crop(bbox)
            scale = min(args.height / sprite.height, 126 / sprite.width)
            size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
            sprite = sprite.resize(size, Image.Resampling.NEAREST)
            frame = Image.new('RGBA', (144, 144), (0, 0, 0, 0))
            resized_bbox = sprite.getchannel('A').getbbox()
            if not resized_bbox:
                raise SystemExit(f'Atlas cell vanished while resizing at row {row + 1}, column {col + 1}')
            frame.alpha_composite(sprite, (72 - (resized_bbox[0] + resized_bbox[2]) // 2, 140 - resized_bbox[3]))
            path = folder / f'{pose}.png'
            frame.save(path, optimize=True)
            output_hashes[f'{direction}/{pose}.png'] = hashlib.sha256(frame.tobytes()).hexdigest()

    production = Path('art-sources/production') / args.entity
    production.mkdir(parents=True, exist_ok=True)
    copied = production / 'contact_sheet_source.png'
    copied.write_bytes(source.read_bytes())
    metadata = {
        'entity': args.entity,
        'source': str(source),
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'grid': [4, 4],
        'rows': list(DIRS),
        'columns': list(POSES),
        'canvas': [144, 144],
        'foot_y': 140,
        'max_sprite_height': args.height,
        'frame_sha256': output_hashes,
    }
    (production / 'metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    for direction in DIRS:
        hashes = [output_hashes[f'{direction}/walk_{index:03}.png'] for index in range(3)]
        if len(set(hashes)) != 3:
            raise SystemExit(f'{args.entity}/{direction} walk frames are not three distinct drawings')
    print(f'Cut {args.entity}: 4 directions × 1 idle + 3 walk drawings into {target}')


if __name__ == '__main__':
    main()
