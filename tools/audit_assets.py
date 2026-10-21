"""Asset audit: inspects every runtime PNG/WAV and writes docs/ASSET_AUDIT.json + .csv.
Usage: python -I tools/audit_assets.py
"""
import csv, glob, hashlib, json, os, wave
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = {'actors': 'art-sources/archive/public-unused/actors', 'portraits': 'public/assets/portraits', 'maps': 'art-sources/archive/public-unused/maps',
       'vfx': 'art-sources/archive/public-unused/vfx', 'skill-icons': 'public/assets/skill-icons'}

def analyse(path):
    im = Image.open(path).convert('RGBA')
    px = im.load(); w, h = im.size
    a = im.getchannel('A'); bb = a.getbbox()
    semi = opaque = fringe = 0
    colors = set()
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al == 0: continue
            if al < 255: semi += 1
            else: opaque += 1
            colors.add((r >> 3, g >> 3, b >> 3))
            if al > 0 and r > 200 and b > 200 and g < 90: fringe += 1  # magenta-ish
    bbw = bb[2] - bb[0] if bb else 0; bbh = bb[3] - bb[1] if bb else 0
    touches = bool(bb) and (bb[0] == 0 or bb[1] == 0 or bb[2] == w or bb[3] == h)
    return dict(width=w, height=h, bbox=list(bb) if bb else None, bbox_w=bbw, bbox_h=bbh,
                feet_y=bb[3] if bb else None, center_x=(bb[0] + bb[2]) / 2 if bb else None,
                semi_alpha_px=semi, opaque_px=opaque, color_count_5bit=len(colors),
                magenta_px=fringe, touches_canvas_edge=touches)

def used_in(rel_names, sources):
    return [n for n in rel_names if any(n in s for s in sources)]

def main():
    sources = []
    for f in glob.glob(os.path.join(ROOT, 'src', '**', '*.ts*'), recursive=True):
        sources.append(open(f, encoding='utf8').read())
    rows, hashes = [], {}
    for cat, d in SRC.items():
        for p in sorted(glob.glob(os.path.join(ROOT, d, '*.png'))):
            name = os.path.basename(p)[:-4]
            info = analyse(p)
            md5 = hashlib.md5(open(p, 'rb').read()).hexdigest()
            hashes.setdefault(md5, []).append(f'{cat}/{name}')
            parts = name.rsplit('_', 1)
            flags = []
            if info['touches_canvas_edge']: flags.append('touches-canvas-edge(possible crop)')
            if info['semi_alpha_px'] > 0.25 * max(1, info['opaque_px']): flags.append('heavy-antialias(non-native pixels)')
            if info['magenta_px'] > 12: flags.append('magenta-fringe-suspect')
            if cat == 'actors' and info['bbox_w'] > info['bbox_h'] * 1.15: flags.append('wide-aspect(likely effect fragment, not a body pose)')
            rows.append(dict(category=cat, asset=name, file=f'{d}/{name}.png',
                             character=parts[0] if cat == 'actors' else name,
                             animation_state=parts[1] if cat == 'actors' and len(parts) > 1 else '',
                             provenance='AI-generated concept sheet crop (previous-generated-asset-pack.zip)',
                             frame_count=1, flags=flags, used_in_code=bool(used_in([name], sources)),
                             **info))
    dups = [v for v in hashes.values() if len(v) > 1]
    for r in rows:
        key = f"{r['category']}/{r['asset']}"
        for g in dups:
            if key in g: r['flags'].append('duplicate-of:' + ','.join(x for x in g if x != key))
    # per-character height variance
    chars = {}
    for r in rows:
        if r['category'] == 'actors': chars.setdefault(r['character'], []).append(r)
    char_report = {}
    for c, rs in chars.items():
        hs = [x['bbox_h'] for x in rs]; ws = [x['bbox_w'] for x in rs]
        char_report[c] = dict(states=[x['animation_state'] for x in rs], bbox_h_range=[min(hs), max(hs)],
                              bbox_w_range=[min(ws), max(ws)], height_variance_ratio=round(max(hs) / max(1, min(hs)), 2),
                              real_animation_frames=1, verdict='STILL-POSES-ONLY: not frame animation')
    audio = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'art-sources/archive/public-unused/audio', '*.wav'))):
        with wave.open(p) as w:
            audio.append(dict(file=os.path.basename(p), seconds=round(w.getnframes() / w.getframerate(), 2),
                              channels=w.getnchannels(), rate=w.getframerate()))
    out = dict(generated_by='tools/audit_assets.py', image_count=len(rows), duplicate_groups=dups,
               characters=char_report, audio=audio, assets=rows)
    os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, 'docs', 'ASSET_AUDIT.json'), 'w'), indent=1)
    with open(os.path.join(ROOT, 'docs', 'ASSET_AUDIT.csv'), 'w', newline='') as f:
        cols = ['category', 'character', 'animation_state', 'file', 'width', 'height', 'bbox_w', 'bbox_h', 'feet_y', 'center_x',
                'semi_alpha_px', 'magenta_px', 'frame_count', 'used_in_code', 'provenance', 'flags']
        wr = csv.DictWriter(f, fieldnames=cols); wr.writeheader()
        for r in rows: wr.writerow({**{k: r[k] for k in cols if k != 'flags'}, 'flags': '; '.join(r['flags'])})
    flagged = [r for r in rows if r['flags']]
    print(f'{len(rows)} images, {len(flagged)} flagged, {len(dups)} duplicate groups')
    for c, r in char_report.items():
        if r['height_variance_ratio'] > 1.5: print('  height variance', c, r['bbox_h_range'])

if __name__ == '__main__':
    main()
