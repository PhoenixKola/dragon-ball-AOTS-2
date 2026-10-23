"""Static reference audit: which files under public/ can the game actually load?
A file counts as referenced when its stem (file name without extension) or its path under public/ appears in src/, index.html or vite.config.ts,
or (for actor stills `<sprite>_<pose>.png`) when <sprite> is a key of SPRITE_BOXES. Everything else is reported as unreferenced.
Usage: python -I tools/audit_public_refs.py [--json out.json]
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_all():
    parts = []
    for base in ('src',):
        for dp, _, fn in os.walk(os.path.join(ROOT, base)):
            for f in fn:
                if f.endswith(('.ts', '.tsx', '.css', '.json')): parts.append(open(os.path.join(dp, f), encoding='utf8', errors='ignore').read())
    for f in ('index.html', 'vite.config.ts'):
        p = os.path.join(ROOT, f)
        if os.path.exists(p): parts.append(open(p, encoding='utf8', errors='ignore').read())
    return '\n'.join(parts)


def main():
    text = read_all()
    sb = open(os.path.join(ROOT, 'src', 'data', 'spriteManifest.generated.ts'), encoding='utf8').read()
    sprites = set(re.findall(r'^ "([a-z0-9_]+)": \{', sb, re.M))
    unref = []; total = 0
    for dp, _, fn in os.walk(os.path.join(ROOT, 'public')):
        for f in fn:
            p = os.path.join(dp, f); rel = os.path.relpath(p, os.path.join(ROOT, 'public')).replace(os.sep, '/'); total += 1
            stem = os.path.splitext(f)[0]
            if rel in text or f in text or re.search(r'(?<![A-Za-z0-9])' + re.escape(stem) + r'(?![A-Za-z0-9])', text): continue
            m = re.fullmatch(r'(.+)_(idle|attack|guard|hurt|charge|special|victory|ko)', stem)
            if m and m.group(1) in sprites: continue
            unref.append(rel)
    out = {'total': total, 'unreferenced': sorted(unref)}
    if '--json' in sys.argv: json.dump(out, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
    print('public files:', total, ' unreferenced:', len(unref))
    by = {}
    for u in unref: by.setdefault(os.path.dirname(u), []).append(os.path.basename(u))
    for d, l in sorted(by.items()): print(' ', d, len(l), l[:6])


if __name__ == '__main__':
    main()
