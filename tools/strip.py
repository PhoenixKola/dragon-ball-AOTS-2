"""Builds a contact strip from evidence/skills/<name>_NN.png. Usage: python -I tools/strip.py <name> [cols] [crop x0,y0,x1,y1]"""
import sys, glob
from PIL import Image
name = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 3
files = sorted(glob.glob(f'evidence/skills/{name}_[0-9][0-9].png'))
ims = [Image.open(f).convert('RGB') for f in files]
if len(sys.argv) > 3:
    x0, y0, x1, y1 = map(int, sys.argv[3].split(','))
    ims = [i.crop((x0, y0, x1, y1)) for i in ims]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * w, (i // cols) * h))
out = f'evidence/skills/{name}_strip.png'
sheet.save(out); print(out, sheet.size)
