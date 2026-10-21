"""Beta 3 world art integration (repeatable). Usage: python -I tools/integrate_beta3_world.py [--preview DIR]
 1. Cooler field sprite (03_overworld/cooler_final_form_pixel_sprite_sheet.png, 5 columns x rows down/left/right/up, all 20 frames are distinct drawings)
    -> public/assets/reviewed/overworld/cooler/<dir>/{idle_000,walk_00N}.png (176x176, feet anchor 88,172) + OVERWORLD.cooler in artManifest.generated.ts.
 2. Frozen Ruins terrain crops from 04_world_terrain/frozen_alien_ruins_tileset_atlas.png -> public/assets/world/tex/ice_cliff.png, ice_water.png
    (seamless 64px textures chosen by eye from the atlas; originals of nothing are replaced).
The SSJ Trunks field sheet is deliberately NOT installed (SSJ Trunks is a battle-only status; see docs/BETA3_WORLD_NOTES.md).
"""
import os, re, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from v4_common import load, pieces, extract

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'art-sources', 'packs', 'AOTS2_Beta2_Final_Missing_Art_Pack_v1')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'overworld', 'cooler')
W, H, AX, AY = 176, 176, 88, 172
TARGET = 118   # standing front height in px (Cooler battle heightPx 236 * 0.5, same ratio family as the other field sprites)
DIRS = ['down', 'left', 'right', 'up']


def place(frame, s):
    h, w = frame.shape[:2]
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    pm = Image.fromarray(frame).convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    al = np.array(pm)[..., 3]
    ys, xs = np.nonzero(al > 8)
    x0 = int(round(AX - xs.mean())); y0 = AY - (ys.max() + 1)
    assert 1 <= x0 and x0 + nw <= W - 1 and y0 >= 1, f'frame {nw}x{nh} does not fit (x0={x0}, y0={y0})'
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(pm, (x0, y0)); return c


def cooler(prev):
    im = load(os.path.join(PACK, '03_overworld', 'cooler_final_form_pixel_sprite_sheet.png'))
    lab, ids, st, rows = pieces(im)
    assert [len(r) for r in rows] == [5, 5, 5, 5]
    frames = [[extract(im, lab, i, open_k=3) for i in r] for r in rows]
    s = TARGET / frames[0][0].shape[0]
    dirs = {}
    for d, row in zip(DIRS, frames):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
        placed = [place(f, s) for f in row]
        names = []
        for i, f in enumerate(placed):
            nm = 'idle_000.png' if i == 0 else f'walk_{i - 1:03d}.png'
            f.save(os.path.join(OUT, d, nm), optimize=True); names.append(nm)
        dirs[d] = {'idle': [names[0]], 'walk': [names[1], names[2], names[3], names[4]], 'walkMs': 140}
        if prev:
            os.makedirs(prev, exist_ok=True)
            strip = Image.new('RGBA', (W * 5, H), (70, 70, 90, 255))
            for i, f in enumerate(placed): strip.alpha_composite(f, (i * W, 0))
            strip.save(os.path.join(prev, f'cooler_{d}.png'))
    ent = {'provenance': 'AI-sheet (Beta 2 Final Missing Art Pack v1, cooler_final_form_pixel_sprite_sheet)', 'approved': True,
           'canvas': [W, H], 'anchor': [AX, AY], 'scale': 1,
           'limitations': ['Arena presence only: Cooler stands in the Frozen Ruins arena before the fight (no collision, no interaction). The battle uses the separate large battle poses.', 'Walk cycle = the 4 sheet poses per direction, unused on the map.'],
           'dirs': {k: dirs[k] for k in ('down', 'up', 'left', 'right')}}
    p = os.path.join(ROOT, 'src', 'data', 'artManifest.generated.ts')
    t = open(p, encoding='utf8').read()
    m = re.search(r'export const OVERWORLD: Record<string, OverworldEntity> = (.*?) as never;\n', t, flags=re.S)
    man = json.loads(m.group(1)); man['cooler'] = ent
    block = 'export const OVERWORLD: Record<string, OverworldEntity> = ' + json.dumps(man, indent=1) + ' as never;\n'
    t = t[:m.start()] + block + t[m.end():]
    open(p, 'w', encoding='utf8').write(t)
    print('cooler ok', [f.shape[:2] for f in frames[0]])


def mirror4(im):
    w, h = im.size
    o = Image.new('RGBA', (w * 2, h * 2))
    o.paste(im, (0, 0)); o.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    o.paste(im.transpose(Image.FLIP_TOP_BOTTOM), (0, h)); o.paste(im.transpose(Image.ROTATE_180), (w, h))
    return o


def terrain():
    atlas = Image.open(os.path.join(PACK, '04_world_terrain', 'frozen_alien_ruins_tileset_atlas.png')).convert('RGBA')
    tex = os.path.join(ROOT, 'public', 'assets', 'world', 'tex')
    # rock face of the big plateau block (no snow lip), mirrored 2x2 so it tiles without seams
    mirror4(atlas.crop(CLIFF_BOX)).save(os.path.join(tex, 'ice_cliff.png'), optimize=True)
    # plain deep-water tile, mirrored 2x2
    mirror4(atlas.crop(DEEP_BOX)).save(os.path.join(tex, 'ice_deep.png'), optimize=True)
    p = os.path.join(ROOT, 'src', 'engine', 'world', 'worldAssets.ts')
    t = open(p, encoding='utf8').read()
    for n in ('ice_cliff', 'ice_deep'):
        if f'"{n}"' not in t:
            t = t.replace('"ice"]', f'"ice", "{n}"]', 1) if '"ice"]' in t else t.replace('"' + 'ice_cliff"]', f'"ice_cliff", "{n}"]', 1)
    open(p, 'w', encoding='utf8').write(t)
    print('terrain ok')


CLIFF_BOX = (545, 136, 605, 154)
DEEP_BOX = (18, 244, 66, 288)

if __name__ == '__main__':
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    cooler(prev)
    terrain()
