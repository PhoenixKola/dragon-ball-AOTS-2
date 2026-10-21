"""Builds public/icon.ico + PNG favicons from the 4-star Dragon Ball sprite (nearest-neighbour, pixel-art safe)."""
from PIL import Image
import json, os
root = os.path.join(os.path.dirname(__file__), '..')
src = Image.open(os.path.join(root, 'public/assets/reviewed/porunga/ball_4.png')).convert('RGBA')
src = src.crop(src.getbbox())
S = 256
k = max(1, (S - 16) // max(src.size))
big = src.resize((src.width * k, src.height * k), Image.NEAREST)
base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
base.paste(big, ((S - big.width) // 2, (S - big.height) // 2), big)
pub = os.path.join(root, 'public')
sizes = [16, 32, 48, 64, 128, 256]
base.save(os.path.join(pub, 'icon.ico'), sizes=[(s, s) for s in sizes])
for s in (32, 192, 512):
    base.resize((s, s), Image.NEAREST if s > S else Image.LANCZOS).save(os.path.join(pub, f'icon-{s}.png'))
json.dump({'name': 'Attack of the Saiyans II - The Namek Saga', 'short_name': 'AOTS II', 'start_url': '/', 'display': 'standalone',
           'background_color': '#000000', 'theme_color': '#0a1030',
           'icons': [{'src': '/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]},
          open(os.path.join(pub, 'manifest.webmanifest'), 'w'), indent=1)
print('ok')
