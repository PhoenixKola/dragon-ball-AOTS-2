"""Cut generated animation sheets into stable reviewed actor canvases.

The image-generation output remains in art-sources/production. Generated sprites
are placed beside existing poses and retain each actor's approved canvas/feet.
"""
from pathlib import Path
from PIL import Image
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
ACTORS = ROOT / 'public/assets/reviewed/actors'
CELL = 512


def integrate(actor: str, selected: list[int], pose: str = 'attack') -> None:
    source_name = f'{actor}_strike_contact_source.png' if pose == 'attack' else f'{actor}_{pose}_contact_source.png'
    source = ROOT / 'art-sources/production' / actor / source_name
    meta_path = ROOT / 'art-sources/production' / actor / f'{actor}_{pose}_metadata.json'
    sheet = Image.open(source).convert('RGBA')
    if abs(sheet.width - sheet.height) <= max(sheet.width, sheet.height) * 0.2:
        columns, rows = 2, 2
        cell_width, cell_height = sheet.width // 2, sheet.height // 2
    elif sheet.width == 3 * sheet.height:
        columns, rows = 4, 1
        cell_width, cell_height = sheet.width // 4, sheet.height
    elif sheet.size == (CELL * 4, CELL):
        columns, rows = 4, 1
        cell_width = cell_height = CELL
    elif sheet.size == (CELL * 3, CELL * 2):
        columns, rows = 3, 2
        cell_width = cell_height = CELL
    else:
        raise ValueError(f'unexpected generated contact sheet dimensions: {sheet.size}')
    idle = Image.open(ACTORS / f'{actor}_idle.png').convert('RGBA')
    if idle.width != idle.height:
        raise ValueError(f'{actor} approved idle canvas is not square')
    approved = idle.getchannel('A').getbbox()
    if not approved:
        raise ValueError(f'{actor} approved idle has no visible pixels')
    foot_y = approved[3]
    target_h = approved[3] - approved[1]
    bodies = []
    max_width_ratio = 0.0
    for cell_index in selected:
        x, y = (cell_index % columns) * cell_width, (cell_index // columns) * cell_height
        cell = sheet.crop((x, y, x + cell_width, y + cell_height))
        cell.putalpha(cell.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
        bounds = cell.getchannel('A').getbbox()
        if not bounds:
            raise ValueError(f'empty generated cell {cell_index + 1}')
        body = cell.crop(bounds)
        bodies.append(body)
        max_width_ratio = max(max_width_ratio, body.width / body.height)
    # Keep one scale across the sequence and reserve a small transparent border.
    # A wide tail/extended limb must not be clipped by the approved actor canvas.
    target_h = min(target_h, int((idle.width - 8) / max_width_ratio))
    frames = []
    for out_index, body in enumerate(bodies, 1):
        # Remove faint generated background haze while retaining crisp drawing.
        size = (round(body.width * target_h / body.height), target_h)
        body = body.resize(size, Image.Resampling.NEAREST)
        left = idle.width // 2 - body.width // 2
        if left < 0 or left + body.width > idle.width:
            raise ValueError(f'{actor} drawing {out_index} does not fit approved canvas')
        frame = Image.new('RGBA', idle.size)
        frame.alpha_composite(body, (left, foot_y - target_h))
        frame_bounds = frame.getchannel('A').getbbox()
        if frame_bounds[3] != foot_y:
            raise ValueError(f'{actor} drawing {out_index} foot anchor differs: {frame_bounds}')
        frame.save(ACTORS / f'{actor}_{pose}_frame_{out_index:02}.png', optimize=True)
        frames.append(frame)

    evidence = ROOT / 'evidence/overhaul' / f'{actor}-{pose}-contact.png'
    evidence.parent.mkdir(parents=True, exist_ok=True)
    contact = Image.new('RGBA', (len(frames) * idle.width, idle.height), (15, 22, 46, 255))
    for i, frame in enumerate(frames):
        contact.alpha_composite(frame, (i * idle.width, 0))
    contact.save(evidence, optimize=True)
    meta_path.write_text(json.dumps({
        'actor': actor,
        'source': source.name,
        'source_dimensions': list(sheet.size),
        'cell_grid': [columns, rows],
        'selected_cells_zero_based': selected,
        'runtime_canvas': list(idle.size),
        'pose': pose,
        'runtime_frames': [f'{actor}_{pose}_frame_{i:02}.png' for i in range(1, len(frames) + 1)],
        'fps': 5 if pose == 'idle' else 8 if pose == 'charge' else 30 if pose == 'special' else 40,
        'loop': pose in ('idle', 'charge'),
        'contact_frame': min(3, len(frames)) if pose in ('attack', 'special') else None,
        'foot_y': foot_y,
        'alpha_threshold': 128,
    }, indent=2), encoding='utf-8')
    print(f'{actor}: cut {len(frames)} registered {pose} frames; canvas={idle.size}, foot_y={foot_y}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('actor')
    parser.add_argument('--cells', default='0,1,2,5', help='four 0-based contact-sheet cells, comma-separated')
    parser.add_argument('--pose', default='attack', choices=('attack', 'idle', 'guard', 'hurt', 'charge', 'special', 'victory', 'ko'))
    args = parser.parse_args()
    cells = [int(v) for v in args.cells.split(',')]
    if len(cells) != 4 or len(set(cells)) != 4 or any(v < 0 or v >= 6 for v in cells):
        parser.error('--cells must contain four unique cell indices from 0 through 5 (or 0 through 3 for a single row)')
    integrate(args.actor, cells, args.pose)
