"""Fail on missing active battle sprites; report active dimensions and duplicate drawings."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
ACTORS = ROOT / 'public/assets/reviewed/actors'
BACKGROUNDS = ROOT / 'public/assets/backgrounds'
manifest = (ROOT / 'src/data/spriteManifest.generated.ts').read_text(encoding='utf-8')
boxes = json.loads(manifest.split('SPRITE_BOXES:', 1)[1].split(' = ', 1)[1].rsplit(';', 1)[0])
expected = {f'{actor}_{pose}' for actor, poses in boxes.items() for pose in poses}
forms = (ROOT / 'src/data/powerupSprites.generated.ts').read_text(encoding='utf-8')
for _, encoded in re.findall(r'(goku_(?:kaioken|ssj)): \{ refH: [^,]+, anims: (\{.*?\}) \}', forms):
    expected.update(name for names in json.loads(encoded).values() for name in names)
attack_actors = ('goku', 'gohan', 'krillin', 'vegeta', 'piccolo', 'cui', 'dodoria', 'zarbon', 'zarbon2', 'guldo', 'recoome', 'burter', 'jeice', 'ginyu', 'nail', 'soldier', 'trunks', 'trunks_ssj', 'frieza1', 'frieza2', 'frieza3', 'frieza4', 'frieza5', 'cooler')
for actor in attack_actors:
    expected.update(f'{actor}_attack_frame_{i:02}' for i in range(1, 5))
idle_actors = ('goku', 'gohan', 'krillin', 'vegeta', 'piccolo', 'trunks', 'trunks_ssj', 'cui', 'dodoria', 'zarbon', 'zarbon2', 'guldo', 'recoome', 'burter', 'jeice', 'ginyu', 'nail', 'soldier', 'frieza1', 'frieza2', 'frieza3', 'frieza4', 'frieza5', 'cooler')
for actor in idle_actors:
    expected.update(f'{actor}_idle_frame_{i:02}' for i in range(1, 5))
pose_actors = ('goku', 'gohan', 'krillin', 'vegeta', 'piccolo')
for actor in pose_actors:
    for pose in ('charge', 'special'):
        expected.update(f'{actor}_{pose}_frame_{i:02}' for i in range(1, 5))

missing = sorted(name for name in expected if not (ACTORS / f'{name}.png').is_file())
invalid = []
hashes = {}
for name in sorted(expected - set(missing)):
    path = ACTORS / f'{name}.png'
    try:
        im = Image.open(path).convert('RGBA')
        if not im.getchannel('A').getbbox():
            invalid.append(f'{name}: empty alpha')
        h = hashlib.sha256(im.tobytes()).hexdigest()
        hashes.setdefault(h, []).append(name)
    except Exception as exc:
        invalid.append(f'{name}: {exc}')
for actor in attack_actors:
    idle = Image.open(ACTORS / f'{actor}_idle.png').convert('RGBA')
    foot = idle.getchannel('A').getbbox()[3]
    for i in range(1, 5):
        name = f'{actor}_attack_frame_{i:02}'
        if name in missing:
            continue
        im = Image.open(ACTORS / f'{name}.png').convert('RGBA')
        if im.size != idle.size or im.getchannel('A').getbbox()[3] != foot:
            invalid.append(f'{name}: canvas or foot anchor differs from approved idle')
for actor in idle_actors:
    idle = Image.open(ACTORS / f'{actor}_idle.png').convert('RGBA')
    foot = idle.getchannel('A').getbbox()[3]
    for i in range(1, 5):
        name = f'{actor}_idle_frame_{i:02}'
        if name in missing:
            continue
        im = Image.open(ACTORS / f'{name}.png').convert('RGBA')
        if im.size != idle.size or im.getchannel('A').getbbox()[3] != foot:
            invalid.append(f'{name}: canvas or foot anchor differs from approved idle')
for actor in pose_actors:
    idle = Image.open(ACTORS / f'{actor}_idle.png').convert('RGBA')
    foot = idle.getchannel('A').getbbox()[3]
    for pose in ('charge', 'special'):
        for i in range(1, 5):
            name = f'{actor}_{pose}_frame_{i:02}'
            if name in missing:
                continue
            im = Image.open(ACTORS / f'{name}.png').convert('RGBA')
            if im.size != idle.size or im.getchannel('A').getbbox()[3] != foot:
                invalid.append(f'{name}: canvas or foot anchor differs from approved idle')

duplicates = [v for v in hashes.values() if len(v) > 1]
background_kinds = ('title', 'plain', 'water', 'village', 'ship', 'cave', 'ruin', 'final', 'frozen')
for kind in background_kinds:
    path = BACKGROUNDS / f'{kind}_namek.png'
    if not path.is_file():
        missing.append(str(path.relative_to(ROOT)))
        continue
    try:
        if Image.open(path).size != (960, 540):
            invalid.append(f'{kind} background: wrong dimensions')
    except Exception as exc:
        invalid.append(f'{kind} background: {exc}')
out = dict(active_battle_files=len(expected), missing=missing, invalid=invalid,
           duplicate_drawings=duplicates, background_files=len(background_kinds),
           scope='battle stills, Goku form frames, all 24 actor melee strike and idle sets, core-party charge and signature poses, all title/battle backgrounds')
(ROOT / 'docs/ACTIVE_ASSET_AUDIT.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
print(f'{len(expected)} active battle files and {len(background_kinds)} backgrounds; {len(missing)} missing; {len(invalid)} invalid; {len(duplicates)} duplicate drawing groups')
if missing or invalid:
    raise SystemExit(1)
