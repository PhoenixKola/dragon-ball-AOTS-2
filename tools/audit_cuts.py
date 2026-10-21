"""Flags sprites that look cut off: opaque pixels on the canvas edge, or a long straight run of opaque pixels along a bbox side (a crop line).
Usage: python -I tools/audit_cuts.py [--all]   (default: actors + overworld + portraits + aura rise; --all adds icons and world objects)
Exit status 1 if any asset is flagged; prints one line per finding. Known legacy defects are listed in docs/V4_INTEGRATION_REPORT.md."""
import os, sys, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public', 'assets')


def check(path, bottom_ok=False, thr=0.30):
    a = np.array(Image.open(path).convert('RGBA'))[..., 3] > 24
    if not a.any():
        return ['empty']
    ys, xs = np.nonzero(a)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    H, W = a.shape
    out = []
    if y0 == 0 or x0 == 0 or x1 == W - 1 or (y1 == H - 1 and not bottom_ok):
        out.append('touches canvas edge')
    sides = {'top': a[y0, x0:x1 + 1], 'left': a[y0:y1 + 1, x0], 'right': a[y0:y1 + 1, x1]}
    if not bottom_ok:
        sides['bottom'] = a[y1, x0:x1 + 1]
    for n, v in sides.items():
        run = best = 0
        for b in v:
            run = run + 1 if b else 0
            best = max(best, run)
        if best >= 14 and best / len(v) >= thr:
            out.append(f'flat {n} edge ({best}px, {best / len(v):.0%})')
    return out


def main():
    groups = [('actors', glob.glob(os.path.join(PUB, 'reviewed', 'actors', '*.png')), True),
              ('overworld', glob.glob(os.path.join(PUB, 'reviewed', 'overworld', '*', '*', '*.png')), True),
              ('aura_rise', glob.glob(os.path.join(PUB, 'reviewed', 'vfx', 'aura_rise', '*.png')), True)]
    if '--all' in sys.argv:
        groups += [('items', glob.glob(os.path.join(PUB, 'reviewed', 'icons', 'items', '*.png')), False),
                   ('world_v4', glob.glob(os.path.join(PUB, 'world', 'obj', 'v4_*.png')), True)]
    bad = 0
    for name, files, bottom_ok in groups:
        for f in sorted(files):
            base = os.path.basename(f)
            if name == 'actors' and base.startswith('goku_') and base.count('_') >= 2:
                continue   # Goku power-up sets are a separate 288x272 canvas (own test)
            r = check(f, bottom_ok)
            if r:
                bad += 1
                print(f'{name}: {os.path.relpath(f, PUB)}: ' + '; '.join(r))
    print('flagged', bad)
    sys.exit(1 if bad else 0)


main()
