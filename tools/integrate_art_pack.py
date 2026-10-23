"""Imports aots2-master-art-pack-v2/validated-art into the runtime asset tree, validating every file against manifest.json.
Idempotent. Writes:
  public/assets/reviewed/overworld/<entity>/<dir>/<idle|walk>_NNN.png   (+ overworld/atlases/*.png, verification only)
  public/assets/reviewed/icons/skills/<id>.png, icons/items/<id>.png, ui/*.png, vfx/<family>/NNN.png
  public/assets/reviewed/art-manifest.json, art-production-summary.json
  src/data/artManifest.generated.ts   (typed data the game loads; the ONLY place runtime asset names come from)
  docs/history/ART_INTEGRATION_VALIDATION.json (per-file checks + rejections)
Usage: python -I tools/integrate_art_pack.py
"""
import hashlib, json, os, shutil
# Alpha 3f: the pack's left/right folders hold frames drawn facing the opposite way (verified on screen), so they are installed swapped.
SWAP_LR = {'left': 'right', 'right': 'left'}
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-sources', 'aots2-master-art-pack-v2', 'validated-art')
DST = os.path.join(ROOT, 'public', 'assets', 'reviewed')
EXTRA = os.path.join(ROOT, 'art-sources', 'build-extras', 'reviewed')   # verification-only files (atlases, manifests) are kept out of the shipped game
man = json.load(open(os.path.join(SRC, 'manifest.json'), encoding='utf8'))
report = {'checked': 0, 'errors': [], 'warnings': [], 'rejected': [], 'overworld': {}, 'vfx': {}}


def check(rel, size=None, need_alpha=True):
    p = os.path.join(SRC, rel)
    if not os.path.isfile(p):
        report['errors'].append(f'missing file {rel}'); return None
    im = Image.open(p)
    if im.mode != 'RGBA': report['warnings'].append(f'{rel}: mode {im.mode}, converting'); im = im.convert('RGBA')
    if size and list(im.size) != list(size): report['errors'].append(f'{rel}: size {im.size} != manifest {size}')
    a = np.array(im)[..., 3]
    if a.max() == 0: report['errors'].append(f'{rel}: fully transparent')
    if need_alpha and (a == 0).mean() < 0.02: report['warnings'].append(f'{rel}: almost no transparency')
    report['checked'] += 1
    return im, hashlib.md5(np.array(im).tobytes()).hexdigest()


def copy(rel, out_rel):
    d = os.path.join(DST, out_rel); os.makedirs(os.path.dirname(d), exist_ok=True)
    shutil.copyfile(os.path.join(SRC, rel), d)


rt = {'overworld': {}, 'vfx': {}, 'skillIcons': [], 'itemIcons': [], 'ui': {}, 'beams': {}}

# ---------------- overworld ----------------
for ent, v in man['overworld'].items():
    entry = {'provenance': v['provenance'], 'approved': bool(v.get('runtimeApproved')), 'canvas': v['canvasPx'], 'anchor': v['anchorPx'],
             'limitations': v.get('limitations', []), 'dirs': {}}
    for d, spec in v['directions'].items():
        idle, walk = spec['idle'], spec['walk']
        hashes = []
        for rel in idle + walk:
            r = check(rel, v['canvasPx'])
            if r: hashes.append(r[1])
            state = 'idle' if rel in idle else 'walk'
            copy(rel, f'overworld/{ent}/{SWAP_LR.get(d, d)}/{os.path.basename(rel)}')
        distinct_walk = len(set(hashes[len(idle):]))
        if distinct_walk < 2: report['errors'].append(f'{ent}/{d}: walk cycle has <2 distinct frames')
        entry['dirs'][d] = {'idle': [os.path.basename(x) for x in idle], 'walk': [os.path.basename(x) for x in walk], 'walkMs': spec.get('walkFrameDurationMs', 130)}
        report['overworld'][f'{ent}/{d}'] = {'idle': len(idle), 'walk': len(walk), 'distinctWalk': distinct_walk}
    check(v['atlas'], [v['atlasGrid']['frameWidth'] * v['atlasGrid']['columns'], v['atlasGrid']['frameHeight'] * v['atlasGrid']['rows']])
    _a = os.path.join(EXTRA, 'overworld', 'atlases', os.path.basename(v['atlas'])); os.makedirs(os.path.dirname(_a), exist_ok=True); shutil.copyfile(os.path.join(SRC, v['atlas']), _a)
    rt['overworld'][ent] = entry

# ---------------- VFX ----------------
for fam, v in man['vfx'].items():
    hs = []
    for rel in v['frames']:
        r = check(rel, v['canvasPx'])
        if r: hs.append(r[1])
        copy(rel, f'vfx/{fam}/{os.path.basename(rel)}')
    report['vfx'][fam] = {'frames': len(v['frames']), 'distinct': len(set(hs))}
    if len(set(hs)) < len(hs): report['warnings'].append(f'vfx/{fam}: duplicate frames')
    rt['vfx'][fam] = {'frames': len(v['frames']), 'ms': v['frameDurationMs'], 'canvas': v['canvasPx'], 'anchor': v['anchorPx']}

# ---------------- beam part geometry (cap / tileable body / head) for the *_beam families, frames 3..5 ----------------
for fam in [f for f in man['vfx'] if f.endswith('_beam')]:
    rt['beams'][fam] = {}
    for fi in (3, 4, 5):
        a = np.array(Image.open(os.path.join(SRC, f'vfx/{fam}/{fi:03d}.png').replace('/', os.sep)).convert('RGBA'))[..., 3] > 0
        cols = a.sum(0); xs = np.where(cols > 0)[0]; H = int(cols.max())
        full = np.where(cols == H)[0]
        y = np.where(a.any(1))[0]
        x0, bodyEnd, headEnd = int(xs.min()), int(full.max()) + 1, int(xs.max()) + 1
        rt['beams'][fam][fi] = {'y': [int(y.min()), int(y.max()) + 1], 'tail': [x0, x0 + 8], 'body': [x0 + 8, bodyEnd], 'head': [bodyEnd, headEnd]}
        if bodyEnd - (x0 + 8) < 8: report['errors'].append(f'{fam}/{fi}: body too short for tiling')

# ---------------- icons / items / ui ----------------
for sid, v in man['skills'].items():
    check(v['file'], v['sizePx']); copy(v['file'], f'icons/skills/{sid}.png'); rt['skillIcons'].append(sid)
for f in sorted(os.listdir(os.path.join(SRC, 'item-icons'))):
    check('item-icons/' + f, [32, 32]); copy('item-icons/' + f, f'icons/items/{f}'); rt['itemIcons'].append(f[:-4])
for name, v in man['ui'].items():
    check(v['file'], v['canvasPx']); copy(v['file'], f'ui/{os.path.basename(v["file"])}')
    rt['ui'][name] = {'file': os.path.basename(v['file']), 'canvas': v['canvasPx'], 'insets': v.get('nineSliceInsetsPx')}
# UI files not in the manifest (cursor, arrows, icons): include with their real size
for f in sorted(os.listdir(os.path.join(SRC, 'ui'))):
    key = f[:-4]
    if key not in rt['ui']:
        im, _ = check('ui/' + f)
        copy('ui/' + f, f'ui/{f}'); rt['ui'][key] = {'file': f, 'canvas': list(im.size), 'insets': None}

# manifest copies as supporting references
os.makedirs(EXTRA, exist_ok=True)
shutil.copyfile(os.path.join(SRC, 'manifest.json'), os.path.join(EXTRA, 'art-manifest.json'))
shutil.copyfile(os.path.join(SRC, 'production-summary.json'), os.path.join(EXTRA, 'art-production-summary.json'))

ts = ['// GENERATED by tools/integrate_art_pack.py from aots2-master-art-pack-v2/validated-art/manifest.json. Do not edit by hand.',
      'export interface OverworldDir { idle: string[]; walk: string[]; walkMs: number }',
      'export interface OverworldEntity { provenance: string; approved: boolean; canvas: [number, number]; anchor: [number, number]; limitations: string[]; dirs: Record<"down" | "up" | "left" | "right", OverworldDir> }',
      'export interface VfxFamily { frames: number; ms: number; canvas: [number, number]; anchor: [number, number] }',
      'export const OVERWORLD: Record<string, OverworldEntity> = ' + json.dumps(rt['overworld'], indent=1) + ' as never;',
      'export const VFX_FAMILIES: Record<string, VfxFamily> = ' + json.dumps(rt['vfx'], indent=1) + ' as never;',
      'export const BEAM_PARTS: Record<string, Record<number, { y: [number, number]; tail: [number, number]; body: [number, number]; head: [number, number] }>> = ' + json.dumps(rt['beams']) + ' as never;',
      'export const SKILL_ICON_IDS: string[] = ' + json.dumps(rt['skillIcons']) + ';',
      'export const ITEM_ICON_IDS: string[] = ' + json.dumps(rt['itemIcons']) + ';',
      'export const UI_ASSETS: Record<string, { file: string; canvas: [number, number]; insets: [number, number, number, number] | null }> = ' + json.dumps(rt['ui'], indent=1) + ' as never;', '']
open(os.path.join(ROOT, 'src', 'data', 'artManifest.generated.ts'), 'w', encoding='utf8').write('\n'.join(ts))
os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
json.dump(report, open(os.path.join(ROOT, 'docs', 'history', 'ART_INTEGRATION_VALIDATION.json'), 'w'), indent=1)
print('checked', report['checked'], 'errors', len(report['errors']), 'warnings', len(report['warnings']))
for e in report['errors'][:20]: print(' ERR', e)
for w in report['warnings'][:20]: print(' warn', w)
