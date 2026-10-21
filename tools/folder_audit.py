"""Asset-folder reconciliation report: sizes, presence and byte-identical duplicates across the project's asset folders.
Writes docs/ASSET_FOLDER_AUDIT.json. Usage: python -I tools/folder_audit.py
"""
import collections, hashlib, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDERS = ['art-sources', 'legacy', 'public/assets',
           'aots2-namek-validated-art-v1', 'aots2-goku-powerups-art-v2', 'private', 'dist']


def walk(d):
    for dp, dn, fn in os.walk(os.path.join(ROOT, d)):
        if 'node_modules' in dp: continue
        for f in fn: yield os.path.join(dp, f)


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def main():
    rep = {'folders': {}, 'duplicateGroups': 0, 'duplicatesBySignature': {}}
    for d in FOLDERS:
        if not os.path.isdir(os.path.join(ROOT, d)):
            rep['folders'][d] = 'NOT PRESENT'; continue
        files = list(walk(d)); size = sum(os.path.getsize(f) for f in files)
        rep['folders'][d] = {'files': len(files), 'mb': round(size / 1e6, 1)}
    hashes = collections.defaultdict(list)
    for d in ['assets', 'public/assets', 'legacy/assets', 'archive']:
        if os.path.isdir(os.path.join(ROOT, d)):
            for f in walk(d):
                if f.lower().endswith(('.png', '.wav')): hashes[md5(f)].append(os.path.relpath(f, ROOT).replace(os.sep, '/'))
    groups = [v for v in hashes.values() if len(v) > 1]
    rep['duplicateGroups'] = len(groups)
    sig = collections.Counter(tuple(sorted(set(x.split('/')[0] if not x.startswith('public') else 'public' for x in g))) for g in groups)
    rep['duplicatesBySignature'] = {'+'.join(k): v for k, v in sig.items()}
    json.dump(rep, open(os.path.join(ROOT, 'docs', 'ASSET_FOLDER_AUDIT.json'), 'w'), indent=1)
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()
