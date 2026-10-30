"""Normalize the reviewed Frieza second-form victory source to the battle canvas.

The source stays separate from the runtime PNG so the pose can be re-exported.
Run: python -I tools/integrate_frieza2_victory.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-sources/source-art/frieza2/victory/source.png'
OUTPUT = ROOT / 'public/assets/reviewed/actors/frieza2_victory.png'
IDLE = ROOT / 'public/assets/reviewed/actors/frieza2_idle.png'
CANVAS = (448, 448)
BASELINE = 438


def main() -> None:
    source = Image.open(SOURCE).convert('RGBA')
    box = source.getchannel('A').getbbox()
    if not box:
        raise ValueError('victory source has no visible pixels')
    crop = source.crop(box)
    idle_box = Image.open(IDLE).convert('RGBA').getchannel('A').getbbox()
    target_h = idle_box[3] - idle_box[1]
    scale = min(target_h / crop.height, 410 / crop.width)
    size = (round(crop.width * scale), round(crop.height * scale))
    crop = crop.resize(size, Image.Resampling.LANCZOS)
    visible = crop.getchannel('A').getbbox()
    result = Image.new('RGBA', CANVAS)
    result.alpha_composite(crop, (CANVAS[0] // 2 - (visible[0] + visible[2]) // 2, BASELINE - visible[3]))
    assert result.getchannel('A').getbbox()[3] == BASELINE
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUTPUT, optimize=True)
    print(f'Wrote {OUTPUT}, bbox={result.getchannel("A").getbbox()}')


if __name__ == '__main__':
    main()
