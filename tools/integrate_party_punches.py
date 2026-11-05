"""Register the four reviewed party punch strips against each approved idle canvas."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ACTORS = ROOT / 'public/assets/reviewed/actors'
PARTY = ('gohan', 'krillin', 'vegeta', 'piccolo')


def cut(actor):
    source = ROOT / 'art-sources/production' / actor / 'base_punch_source.png'
    sheet = Image.open(source).convert('RGBA')
    if sheet.size != (2172, 724):
        raise ValueError(f'{actor}: unexpected source dimensions {sheet.size}')
    idle = Image.open(ACTORS / f'{actor}_idle.png').convert('RGBA')
    ib = idle.getchannel('A').getbbox()
    if not ib or idle.width != idle.height:
        raise ValueError(f'{actor}: invalid idle reference')
    height, width = ib[3] - ib[1], ib[2] - ib[0]
    foot_y = ib[3]
    bodies = []
    for i in range(4):
        cell = sheet.crop((i * 543, 0, (i + 1) * 543, 724))
        cell.putalpha(cell.getchannel('A').point(lambda v: 255 if v >= 128 else 0))
        box = cell.getbbox()
        if not box:
            raise ValueError(f'{actor}: empty frame {i + 1}')
        bodies.append(cell.crop(box))
    # Keep the actor's approved silhouette width in the ready drawing, then use
    # one scale for all four frames so the punch can extend without re-scaling.
    x_scale = width / bodies[0].width
    for i, body in enumerate(bodies, 1):
        size = (round(body.width * x_scale), height)
        body = body.resize(size, Image.Resampling.NEAREST)
        frame = Image.new('RGBA', idle.size)
        left = idle.width // 2 - size[0] // 2
        if left < 0 or left + size[0] > idle.width:
            raise ValueError(f'{actor}: frame {i} does not fit reference canvas')
        frame.alpha_composite(body, (left, foot_y - height))
        if frame.getchannel('A').getbbox()[3] != foot_y:
            raise ValueError(f'{actor}: foot registration failed')
        out = ACTORS / f'{actor}_attack_frame_{i:02}.png'
        frame.save(out, optimize=True)
        print(out.relative_to(ROOT), frame.getchannel('A').getbbox())


for actor in PARTY:
    cut(actor)
