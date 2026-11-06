"""Write truthful active battle-frame coverage from installed PNGs and form tables."""
from pathlib import Path
from PIL import Image
import csv
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
ACTORS = ROOT / 'public/assets/reviewed/actors'
POSES = ('idle', 'attack', 'guard', 'hurt', 'charge', 'special', 'victory', 'ko')
rows = []


def unique_drawings(names):
    hashes = set()
    for name in names:
        image = Image.open(ACTORS / f'{name}.png').convert('RGBA')
        hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
    return len(hashes)


def add(actor, form, pose, names, fps, loop, note):
    idle = ACTORS / f'{actor}_idle.png'
    foot_anchor = '(144,232)' if form in ('goku_kaioken', 'goku_ssj') else None
    if foot_anchor is None:
        image = Image.open(idle).convert('RGBA')
        foot_anchor = f'({image.width // 2},{image.getchannel("A").getbbox()[3]})'
    rows.append(dict(actor=actor, form=form, pose=pose,
                     authored_changing_drawings=unique_drawings(names), listed_frames=len(names),
                     fps=fps, loop=loop, foot_anchor=foot_anchor,
                     runtime_files=';'.join(f'public/assets/reviewed/actors/{n}.png' for n in names), note=note))


stills = {}
for path in ACTORS.glob('*.png'):
    match = re.match(r'(.+)_(idle|attack|guard|hurt|charge|special|victory|ko)\.png$', path.name)
    if match:
        stills.setdefault(match.group(1), {})[match.group(2)] = path.stem
for actor, states in sorted(stills.items()):
    form_label = 'reference-only' if actor == 'ssj_goku' else 'ssj' if actor == 'trunks_ssj' else 'base'
    for pose in POSES:
        if pose not in states:
            continue
        if actor in ('goku', 'gohan', 'krillin', 'vegeta', 'piccolo', 'nail', 'trunks', 'trunks_ssj', 'cui', 'dodoria', 'zarbon', 'zarbon2', 'guldo', 'recoome', 'burter', 'jeice', 'ginyu', 'soldier', 'frieza1', 'frieza2', 'frieza3', 'frieza4', 'frieza5', 'cooler') and pose == 'attack':
            names = [f'{actor}_attack_frame_{i:02}' for i in range(1, 5)]
            note = f'authored {actor} strike; contact drawing is frame 3; legacy still retained as fallback'
            add(actor, 'base', pose, names, 40, False, note)
        elif actor in ('goku', 'gohan', 'krillin', 'vegeta', 'piccolo') and pose in ('charge', 'special') and (ACTORS / f'{actor}_{pose}_frame_01.png').is_file():
            names = [f'{actor}_{pose}_frame_{i:02}' for i in range(1, 5)]
            add(actor, 'base', pose, names, 8 if pose == 'charge' else 30, pose == 'charge',
                'authored charge loop; existing skill VFX remain layered above' if pose == 'charge' else 'authored signature release sequence; frame 3 is projectile contact pose')
        elif actor == 'goku' and pose == 'guard':
            add(actor, 'base', pose, [f'goku_guard_frame_{i:02}' for i in range(1, 5)], 18, False, 'four-frame braced guard and recoil; feet stay anchored')
        elif pose == 'idle' and (ACTORS / f'{actor}_idle_frame_01.png').is_file():
            names = [f'{actor}_idle_frame_{i:02}' for i in range(1, 5)]
            add(actor, 'base', pose, names, 5, True, 'native-drawn breathing/stance loop; returns to frame 1; approved still retained as fallback')
        else:
            note = 'battle size reference / world fallback; not displayed in SSJ battle' if actor == 'ssj_goku' else 'single authored still pose; no frame animation'
            add(actor, form_label, pose, [states[pose]], 0, False, note)

tables = (ROOT / 'src/data/powerupSprites.generated.ts').read_text(encoding='utf-8')
for form, encoded in re.findall(r'(goku_(?:kaioken|ssj)): \{ refH: [^,]+, anims: (\{.*?\}) \}', tables):
    anims = json.loads(encoded)
    if form == 'goku_kaioken':
        kaioken = {pose: [f'goku_kaioken_{pose}_frame_{i:02}' for i in range(1, 5)] for pose in ('idle', 'attack', 'charge', 'special', 'guard', 'hurt')}
        kaioken.update(ko=['goku_kaioken_ko_frame_01'], victory=['goku_kaioken_victory_frame_01'])
        for pose, names in kaioken.items():
            fps = {'idle': 5, 'attack': 40, 'charge': 8, 'special': 30, 'guard': 18, 'hurt': 16}.get(pose, 0)
            add('goku', form, pose, names, fps, pose in ('idle', 'charge'),
                'base Goku body proportions; separately layered red Kaioken aura')
        continue
    for key, names in anims.items():
        pose = {'powerup': 'charge', 'beam': 'special'}.get(key, key)
        if pose == 'guard':
            names, fps = [f'goku_ssj_guard_frame_{i:02}' for i in range(1, 5)], 18
        elif pose == 'hurt':
            names, fps = [f'goku_ssj_hurt_frame_{i:02}' for i in range(1, 5)], 16
        elif pose == 'special':
            fps = 24
        else:
            fps = 7 if pose == 'idle' else 10 if pose == 'charge' else 0
        note = 'continuous loop' if fps else 'discrete selected pose(s), not a continuous animation'
        add('goku', form, pose, names, fps, bool(fps), note)

add('goku', 'goku_kaioken', 'aura', [f'goku_kaioken_aura_frame_{i:02}' for i in range(1, 5)], 11, True,
    'transparent authored red flame ring, separately layered behind base-form Goku')

out = ROOT / 'docs/ANIMATION_COVERAGE.csv'
with out.open('w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
print(out, len(rows), 'rows')
