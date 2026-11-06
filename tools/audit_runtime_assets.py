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
hurt_actors = ('goku', 'gohan', 'krillin', 'vegeta', 'piccolo')
for actor in hurt_actors:
    expected.update(f'{actor}_hurt_frame_{i:02}' for i in range(1, 5))
expected.update(f'goku_guard_frame_{i:02}' for i in range(1, 5))
expected.update(f'goku_ssj_guard_frame_{i:02}' for i in range(1, 5))
expected.update(f'goku_ssj_hurt_frame_{i:02}' for i in range(1, 5))
for pose in ('idle', 'attack', 'charge', 'special', 'guard', 'hurt'):
    expected.update(f'goku_kaioken_{pose}_frame_{i:02}' for i in range(1, 5))
expected.update(('goku_kaioken_ko_frame_01', 'goku_kaioken_victory_frame_01'))
expected.update(f'goku_kaioken_aura_frame_{i:02}' for i in range(1, 5))

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
for actor in hurt_actors:
    idle = Image.open(ACTORS / f'{actor}_idle.png').convert('RGBA')
    foot = idle.getchannel('A').getbbox()[3]
    for i in range(1, 5):
        name = f'{actor}_hurt_frame_{i:02}'
        if name in missing:
            continue
        im = Image.open(ACTORS / f'{name}.png').convert('RGBA')
        if im.size != idle.size or im.getchannel('A').getbbox()[3] != foot:
            invalid.append(f'{name}: canvas or foot anchor differs from approved idle')

for actor, pose, reference in (
    ('goku', 'guard', 'goku_guard.png'),
    ('goku_ssj', 'guard', 'goku_ssj_guard_01.png'),
    ('goku_ssj', 'hurt', 'goku_ssj_idle_01.png'),
):
    ref = Image.open(ACTORS / reference).convert('RGBA')
    foot = ref.getchannel('A').getbbox()[3]
    for i in range(1, 5):
        name = f'{actor}_{pose}_frame_{i:02}'
        if name in missing:
            continue
        im = Image.open(ACTORS / f'{name}.png').convert('RGBA')
        if im.size != ref.size or im.getchannel('A').getbbox()[3] != foot:
            invalid.append(f'{name}: form canvas or foot anchor differs from reference')

kaioken_poses = ('idle', 'attack', 'charge', 'special', 'guard', 'hurt')
for pose in (*kaioken_poses, 'ko', 'victory'):
    count = 4 if pose in kaioken_poses else 1
    names = [f'goku_kaioken_{pose}_frame_{i:02}' for i in range(1, count + 1)]
    imgs = []
    for name in names:
        if name in missing:
            continue
        im = Image.open(ACTORS / f'{name}.png').convert('RGBA')
        bbox = im.getchannel('A').getbbox()
        if im.size != (288, 272) or not bbox or bbox[3] != 232 or not 72 <= bbox[3] - bbox[1] <= 205:
            invalid.append(f'{name}: expected 288x272 canvas, stable-scale body and feet at y=232')
        if im.getpixel((0, 0))[3] != 0 or im.getpixel((287, 271))[3] != 0:
            invalid.append(f'{name}: background is not transparent')
        imgs.append(im)
    if count == 4 and len({hashlib.sha256(im.tobytes()).hexdigest() for im in imgs}) < 3:
        invalid.append(f'goku_kaioken_{pose}: animation has fewer than 3 unique drawings')

aura_frames = []
for i in range(1, 5):
    name = f'goku_kaioken_aura_frame_{i:02}'
    if name in missing:
        continue
    im = Image.open(ACTORS / f'{name}.png').convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    if im.size != (288, 272) or not bbox or bbox[1] < 12 or bbox[3] != 232:
        invalid.append(f'{name}: expected transparent 288x272 aura canvas registered to feet at y=232')
    if im.getpixel((144, 132))[3] != 0 or im.getpixel((0, 0))[3] != 0:
        invalid.append(f'{name}: flame ring center or canvas corner must remain transparent')
    aura_frames.append(im)
if len(aura_frames) == 4 and len({hashlib.sha256(im.tobytes()).hexdigest() for im in aura_frames}) < 3:
    invalid.append('goku_kaioken aura: loop has fewer than 3 distinct drawings')

intentional_loops = [{'goku_ssj_guard_frame_01', 'goku_ssj_guard_frame_04'}]
duplicates = [v for v in hashes.values() if len(v) > 1 and not any(set(v) == loop for loop in intentional_loops)]
overworld_npcs = {}
for entity in ('namek_trader', 'namek_elder', 'namek_child', 'namek_villager'):
    frame_hashes = set()
    for direction in ('down', 'up', 'left', 'right'):
        base = ROOT / 'public/assets/reviewed/overworld' / entity / direction
        idle = base / 'idle_000.png'
        walk = [base / f'walk_{i:03}.png' for i in range(3)]
        for path in [idle, *walk]:
            if not path.is_file():
                missing.append(str(path.relative_to(ROOT)))
                continue
            try:
                im = Image.open(path).convert('RGBA')
                bbox = im.getchannel('A').getbbox()
                if im.size != (144, 144) or not bbox or bbox[3] != 140:
                    invalid.append(f'{path.relative_to(ROOT)}: expected 144x144 canvas and feet at y=140')
                frame_hashes.add(hashlib.sha256(im.tobytes()).hexdigest())
            except Exception as exc:
                invalid.append(f'{path.relative_to(ROOT)}: {exc}')
        if all(path.is_file() for path in walk) and len({hashlib.sha256(Image.open(path).convert('RGBA').tobytes()).hexdigest() for path in walk}) < 3:
            invalid.append(f'{entity}/{direction}: walk cycle has fewer than 3 distinct drawings')
    overworld_npcs[entity] = {'directions': 4, 'walk_drawings_per_direction': 3, 'canvas': [144, 144], 'unique_drawings': len(frame_hashes)}
field_cycles = {}
for entity in ('dende', 'soldier'):
    for direction in ('down', 'up', 'left', 'right'):
        base = ROOT / 'public/assets/reviewed/overworld' / entity / direction
        frames = [base / 'idle_000.png', base / 'walk_000.png', base / 'walk_001.png']
        for path in frames:
            if not path.is_file():
                missing.append(str(path.relative_to(ROOT)))
                continue
            try:
                im = Image.open(path).convert('RGBA')
                if im.size != (144, 144):
                    invalid.append(f'{path.relative_to(ROOT)}: canvas must be 144x144')
                bbox = im.getchannel('A').getbbox()
                if not bbox or abs(bbox[3] - 140) > 2:
                    invalid.append(f'{path.relative_to(ROOT)}: feet are not registered at y=140')
            except Exception as exc:
                invalid.append(f'{path.relative_to(ROOT)}: {exc}')
        walk = frames[1:]
        if all(path.is_file() for path in walk) and len({hashlib.sha256(Image.open(path).convert('RGBA').tobytes()).hexdigest() for path in walk}) < 2:
            invalid.append(f'{entity}/{direction}: two-frame walk does not change drawings')
    field_cycles[entity] = {'directions': 4, 'walk_drawings_per_direction': 2, 'canvas': [144, 144]}
frog = ROOT / 'public/assets/reviewed/overworld/namek_frog/right/hop_000.png'
if not frog.is_file():
    missing.append(str(frog.relative_to(ROOT)))
else:
    try:
        im = Image.open(frog).convert('RGBA')
        bbox = im.getchannel('A').getbbox()
        if im.size != (144, 144) or not bbox or bbox[3] != 140 or not (50 <= bbox[3] - bbox[1] <= 62):
            invalid.append(f'{frog.relative_to(ROOT)}: expected 144x144 canvas, 50-62px sprite, and y=140 foot anchor')
    except Exception as exc:
        invalid.append(f'{frog.relative_to(ROOT)}: {exc}')
background_kinds = ('title', 'plain', 'water', 'village', 'ship', 'cave', 'ruin', 'final', 'frozen', 'awakening', 'voyage', 'landing')
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
           duplicate_drawings=duplicates, intentional_loop_closures=[sorted(loop) for loop in intentional_loops], background_files=len(background_kinds),
           overworld_npcs=overworld_npcs,
           overworld_field_cycles=field_cycles,
           namek_frog={'frames': 1, 'canvas': [144, 144], 'visible_height_px': 56, 'anchor_y': 140},
           scope='battle art, core-party hurt/charge/special frames, 24 actor melee/idle sets, all battle/title/cinematic backgrounds, seven overworld animation assets including two-frame Dende/soldier walk cycles and the Ginyu story frog')
(ROOT / 'docs/ACTIVE_ASSET_AUDIT.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
print(f'{len(expected)} active battle files, {len(background_kinds)} backgrounds, 7 overworld animation assets; {len(missing)} missing; {len(invalid)} invalid; {len(duplicates)} duplicate drawing groups')
if missing or invalid:
    raise SystemExit(1)
