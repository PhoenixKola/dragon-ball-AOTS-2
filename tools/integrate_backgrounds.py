"""Produce the nine local 960x540 stage images from reviewed native sources."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-sources/production/backgrounds'
OUTPUT = ROOT / 'public/assets/backgrounds'
KINDS = ('title', 'plain', 'water', 'village', 'ship', 'cave', 'ruin', 'final', 'frozen')

OUTPUT.mkdir(parents=True, exist_ok=True)
for kind in KINDS:
    source = SOURCE / f'{kind}_namek_source.png'
    image = Image.open(source).convert('RGB')
    if image.size != (1672, 941):
        raise ValueError(f'{kind}: unexpected source size {image.size}')
    output = OUTPUT / f'{kind}_namek.png'
    image.resize((960, 540), Image.Resampling.NEAREST).save(output, optimize=True)
    print(output.relative_to(ROOT), output.stat().st_size)
