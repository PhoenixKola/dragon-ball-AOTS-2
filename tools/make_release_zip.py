"""Builds release/AOTS2-Namek-Saga-beta3-final-art-polish.zip (single root folder, CRC-checked).
Excludes: node_modules, private (ROM area), earlier releases, legacy, raw art packs/archives, *.nds, *.zip. Includes src, public, dist, tests, docs, tools, evidence, lockfile, launcher."""
import os, zipfile

NAME = 'AOTS2-Namek-Saga-beta3-final-art-polish'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'release', NAME + '.zip')
SKIP = {'node_modules', 'private', 'release', 'test-results', '.git', 'legacy', '__pycache__'}
SKIP_ART = {'packs', 'archive', 'attack_of_the_saiyans_2_asset_pack', 'source-art', 'aots2-battle-art-pack-v1', 'aots2-goku-original-animation-sources-v1', 'aots2-master-art-pack-v2', 'aots2-namek-all-art-handoff-v3', 'build-extras'}
n = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for dp, dn, fn in os.walk(ROOT):
        rel = os.path.relpath(dp, ROOT).replace(os.sep, '/')
        dn[:] = [d for d in dn if d not in SKIP and not (rel == 'art-sources' and d in SKIP_ART)]
        for f in fn:
            low = f.lower()
            if low.endswith(('.nds', '.zip')) or (rel == '.' and low.startswith('aots2-') and low.endswith('.md')): continue
            p = os.path.join(dp, f)
            z.write(p, NAME + '/' + os.path.relpath(p, ROOT).replace(os.sep, '/')); n += 1
with zipfile.ZipFile(OUT) as z:
    bad = z.testzip(); names = z.namelist()
print(n, 'files', round(os.path.getsize(OUT) / 1e6, 1), 'MB; crc ok:', bad is None)
print('forbidden present:', any(('.nds' in x or '/private/' in x or 'node_modules' in x) for x in names))
print('dist files:', sum(x.startswith(NAME + '/dist/') for x in names), 'public files:', sum(x.startswith(NAME + '/public/') for x in names))
