"""Cut the reviewed native Goku punch strip into registered runtime frames.

Input is kept in art-sources/production/goku; this script never overwrites the
existing approved single-pose artwork. Requires Pillow.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-sources/production/goku/base_punch_source.png'
OUT = ROOT / 'public/assets/reviewed/actors'
COUNT = 4
CANVAS = 418
FOOT_X, FOOT_Y = 209, 409
BODY_H = 305  # approved goku_idle body bbox height


def main():
    sheet = Image.open(SOURCE).convert('RGBA')
    if sheet.size != (2172, 724):
        raise ValueError(f'Unexpected source dimensions: {sheet.size}')
    for i in range(COUNT):
        cell = sheet.crop((i * 543, 0, (i + 1) * 543, 724))
        alpha = cell.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        cell.putalpha(alpha)
        box = cell.getbbox()
        if box is None:
            raise ValueError(f'Empty frame {i + 1}')
        body = cell.crop(box)
        size = (round(body.width * BODY_H / body.height), BODY_H)
        body = body.resize(size, Image.Resampling.NEAREST)
        frame = Image.new('RGBA', (CANVAS, CANVAS))
        frame.alpha_composite(body, (FOOT_X - size[0] // 2, FOOT_Y - size[1]))
        if frame.getchannel('A').getbbox()[3] != FOOT_Y:
            raise ValueError('Foot registration failed')
        path = OUT / f'goku_attack_frame_{i + 1:02}.png'
        frame.save(path, optimize=True)
        print(path.relative_to(ROOT), frame.getchannel('A').getbbox())


if __name__ == '__main__':
    main()
