"""Writes docs/FINAL_ART_ACCEPTANCE.csv from the REAL installed files (one row per actor/pose, overworld entity/direction, portrait, icon group, world object, VFX family)
and docs/FINAL_MISSING_ASSETS.md (the named blockers). Status vocabulary: approved / retained-original / rejected / missing.
Usage: python -I tools/gen_acceptance_csv.py"""
import csv, glob, json, os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from beta3_decisions import DECISIONS, DECISIONS_EXTRA
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public', 'assets')
POSES = ['idle', 'attack', 'guard', 'hurt', 'charge', 'special', 'victory', 'ko']
SHEET = {  # actor -> candidate source sheet
    'gohan': '01_Hero_Battle/kid_gohan_battle_sprite_sheet', 'krillin': '01_Hero_Battle/krillin_pixel_battle_sprite_sheet', 'piccolo': '01_Hero_Battle/piccolo_pixel_battle_sprite_sheet',
    'vegeta': '01_Hero_Battle/vegeta_namek_saga_battle_sprite_sheet', 'goku': '01_Hero_Battle/goku_inspired_16_bit_battle_sprite_sheet', 'ssj_goku': '01_Hero_Battle/super_saiyan_goku_battle_sprite_sheet',
    'cui': '02_Boss_Battle/cui_pixel_art_combat_sprite_sheet', 'dodoria': '02_Boss_Battle/dodoria_s_namek_saga_battle_sprite_sheet', 'zarbon': '02_Boss_Battle/zarbon_pixel_sprite_sheet',
    'guldo': '02_Boss_Battle/guldo_pixel_fighter_sprite_sheet', 'recoome': '02_Boss_Battle/recoome_pixel_battle_sprite_sheet', 'burter': '02_Boss_Battle/burter_pixel_sprite_sheet',
    'jeice': '02_Boss_Battle/jeice_pixel_sprite_sheet_collection', 'ginyu': '02_Boss_Battle/captain_ginyu_pixel_sprite_sheet', 'frieza1': '02_Boss_Battle/frieza_forms_pixel_sprite_sheet',
    'frieza2': '02_Boss_Battle/frieza_forms_pixel_sprite_sheet', 'frieza3': '02_Boss_Battle/frieza_forms_pixel_sprite_sheet', 'frieza4': '02_Boss_Battle/frieza_final_forms_sprite_sheet',
    'frieza5': '02_Boss_Battle/frieza_final_forms_sprite_sheet', 'cooler': '03_Overworld_Maps_Cooler/cooler_final_form_battle_sprite_sheet',
    'trunks': 'porunga-addon/01_future_trunks_base/future_trunks_battle_sprite_sheet', 'trunks_ssj': 'porunga-addon/02_future_trunks_super_saiyan/super_saiyan_trunks_sprite_sheet',
    'dende': 'v4/dende_pixel_art_battle_sprite_sheet', 'nail': 'v4/nail_s_pixel_art_battle_sprite_sheet', 'zarbon2': 'v4/transformed_zarbon_pixel_sprite_sheet', 'soldier': 'v4/frieza_force_pixel_sprite_sheet',
}
REASON = {
    'special_jeice': 'Sheet frame carries a glued pink energy ball: not installed, engine falls back to attack.',
    'frieza_guard': 'Frieza sheets supply idle / attack / hurt (plus baked-aura frames that were rejected). No guard, KO or victory art exists: named blocker.',
}
# Beta 2's decisions are history: frozen once into FINAL_ART_ACCEPTANCE_BETA2.csv, never regenerated. The live CSV adds two columns:
# the Beta 2 status of the same ID and the Beta 3 decision (accepted / rejected / retained-fallback / unchanged) with its reason.
HIST = os.path.join(ROOT, 'docs', 'FINAL_ART_ACCEPTANCE_BETA2.csv')
LIVE = os.path.join(ROOT, 'docs', 'FINAL_ART_ACCEPTANCE.csv')
if not os.path.exists(HIST): shutil.copy2(LIVE, HIST)
with open(HIST, newline='', encoding='utf8') as f:
    BETA2 = {r[0]: r[3] for r in list(csv.reader(f))[1:]}
ALL_DECISIONS = {**DECISIONS, **DECISIONS_EXTRA}
rows = []
def add(*r): rows.append(r)

for actor in sorted({os.path.basename(p).rsplit('_', 1)[0] for p in glob.glob(os.path.join(PUB, 'reviewed', 'actors', '*_*.png')) if not re.search(r'_(base|kaioken|ssj)_', os.path.basename(p))}):
    if actor not in SHEET: continue
    for pose in POSES:
        p = os.path.join(PUB, 'reviewed', 'actors', f'{actor}_{pose}.png')
        if os.path.exists(p):
            im = Image.open(p); bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            dec = ALL_DECISIONS.get(f'{actor}:{pose}')
            add(f'{actor}:{pose}', 'battle pose, drawn facing right (enemies mirrored at runtime)', ('art-sources/packs/' + dec[1]) if dec else SHEET[actor], 'approved', os.path.relpath(p, ROOT).replace(os.sep, '/'), f'{im.width}x{im.height} (bbox {bb[0]},{bb[1]},{bb[2]},{bb[3]})', f'feet baseline y={bb[3]} (canvas fraction .978)', ('evidence/beta3/gallery/' + actor.replace('soldier', 'scout') + '_' + pose + '.png, tools/audit_cuts.py') if dec else 'evidence/v4/*.png, tools/audit_cuts.py', (dec[2]) if dec else 'Native pixels, outline kept, no canvas-edge contact (audit_cuts); stored at 2x the on-screen height for a clean 0.5x runtime scale')
        else:
            d = ALL_DECISIONS.get(f'{actor}:{pose}')
            why = ('Beta 3 candidate ' + d[0] + ': ' + d[2]) if d else 'No matching pose on the supplied sheet; the engine uses the documented fallback (see src/engine/assets.ts)'
            add(f'{actor}:{pose}', 'battle pose', ('art-sources/packs/' + d[1]) if d else SHEET[actor], 'missing', '', '', '', '', why)
for fam, st in (('goku_kaioken', 'approved'), ('goku_ssj', 'approved')):
    n = len(glob.glob(os.path.join(PUB, 'reviewed', 'actors', fam + '_*.png')))
    add(fam, 'multi-pose battle set (idle / power-up / melee / beam / guard / hurt / victory / ko)', 'art-sources/goku-forms/' + {'goku_kaioken': 'kaioken', 'goku_ssj': 'super_saiyan'}[fam] + '_goku_pixel_sprite_sheet.png', st, 'public/assets/reviewed/actors/' + fam + '_*.png', '288x272', 'feet (144,232)', '', f'{n} frames from tools/slice_goku_forms.py (see docs/GOKU_FORMS.md). Kaioken source cell 1 (wrong costume) is never exported; guard reuses the crouched ready stance; base Goku is the goku_<pose>.png stills')

for ent in sorted(os.listdir(os.path.join(PUB, 'reviewed', 'overworld'))):
    for d in ('down', 'left', 'right', 'up'):
        fs = sorted(glob.glob(os.path.join(PUB, 'reviewed', 'overworld', ent, d, '*.png')))
        if fs:
            im = Image.open(fs[0])
            src = 'v4/16_bit_rpg_character_sprite_sheet' if ent in ('bulma', 'dende', 'nail', 'soldier') else '03_Overworld_Maps_Cooler/*'
            add(f'overworld:{ent}:{d}', f'field idle + walk ({len(fs)} frames)', src, 'approved', f'public/assets/reviewed/overworld/{ent}/{d}/', f'{im.width}x{im.height}', 'feet (72,140)', 'evidence/v4', 'Dedicated art per direction (never mirrored); the sheet supplies 3-4 poses per direction, not hand-timed animation')
for p in sorted(glob.glob(os.path.join(PUB, 'portraits', '*.png'))):
    n = os.path.basename(p)[:-4]; im = Image.open(p)
    src = 'v4/retro_saiyan_portrait_sheet' if n in ('bulma', 'dende', 'nail', 'cui', 'zarbon', 'frieza1', 'frieza4', 'cooler') else '01_Hero_Battle (bust crop)' if n in ('goku', 'gohan', 'krillin', 'piccolo') else 'earlier AI crop (kept)'
    add(f'portrait:{n}', 'dialogue / HUD bust', src, 'retained-original' if 'kept' in src else 'approved', os.path.relpath(p, ROOT).replace(os.sep, '/'), f'{im.width}x{im.height}', 'bottom aligned', '', 'Frieza forms 2/3/5 alias to the nearest bust' if n.startswith('frieza') else '')
for grp in ('items', 'skills', 'commands'):
    fs = sorted(glob.glob(os.path.join(PUB, 'reviewed', 'icons', grp, '*.png')))
    add(f'icons:{grp}', f'{len(fs)} icons', 'v4/dragon_ball_rpg_item_sprite_atlas + pixel_art_saiyan_energy_icon_atlas', 'approved', f'public/assets/reviewed/icons/{grp}/', '32x32', '', '', 'Hue-shifted variants separate similar motifs; a few approximate enemy-move icons are documented in docs/V4_INTEGRATION_REPORT.md')
for p in sorted(glob.glob(os.path.join(PUB, 'world', 'obj', 'v4_*.png'))):
    im = Image.open(p); add(f'world:{os.path.basename(p)[:-4]}', 'map object', 'v4/namek_and_frozen_ruins_tileset', 'approved', os.path.relpath(p, ROOT).replace(os.sep, '/'), f'{im.width}x{im.height}', 'bottom centre', 'evidence/v4', '')
add('world:t_ice', 'seamless frozen ground tile', 'generated (tools/make_ice_texture.py) with the palette of the v4 frozen slabs', 'approved', 'public/assets/world/tex/ice.png', '192x192', '', '', 'The sheet slabs are not seamless squares; a tileable texture was generated instead')
for fam in sorted(os.listdir(os.path.join(PUB, 'reviewed', 'vfx', 'aura_rise'))[:0] or []): pass
add('vfx:aura_rise gold', 'aura ignition burst + persistent flame', 'v4/pixel_art_energy_effects_atlas', 'approved', 'public/assets/reviewed/vfx/aura_rise/gold_*.png', '144x144', 'base centre (72,140)', '', '')
add('vfx:aura_rise purple', 'aura ignition burst', 'v4/pixel_art_energy_effects_atlas', 'approved', 'public/assets/reviewed/vfx/aura_rise/purple_*.png', '144x144', 'base centre (72,140)', '', '')
add('vfx:aura_rise red', 'aura ignition burst', 'v4/pixel_art_energy_effects_atlas', 'rejected', '', '', '', '', 'Frames overlap their neighbours and clip when isolated')
for n, src in (('porunga_idle', 'idle'), ('porunga_roar', 'roar'), ('porunga_reach', 'reach'), ('porunga_grant', 'grant'), ('porunga_calm', 'calm')):
    add('porunga:' + src, 'cinematic pose (DOM overlay)', 'porunga-addon/03/porunga_summoning_pixel_art_sprite_sheet', 'approved', f'public/assets/reviewed/porunga/{n}.png', '', 'bottom centre', 'evidence/v4/e2e_porunga_cards.png', 'Single consistent Porunga design; the second sheet was rejected (fragmentary crops)')
add('porunga:balls + pillar', '7 numbered balls, light pillar', 'porunga-addon/03/porunga_summoning_pixel_art_sprite_sheet', 'approved', 'public/assets/reviewed/porunga/ball_*.png, pillar_*.png', '', '', 'evidence/v4/e2e_porunga_cards.png', 'Pillar is edge-masked in CSS')
for w in ('trunks', 'potential', 'relic'):
    add('wish icon:' + w, 'wish card icon', 'porunga-addon/03/neon_golden_dragon_orb_icon_sheet', 'approved', f'public/assets/reviewed/icons/wish/{w}.png', '96x96', '', 'evidence/v4/e2e_porunga_cards.png', '')
add('trunks:overworld SSJ', 'Super Saiyan field walk', 'AOTS2_Beta2_Final_Missing_Art_Pack_v1/03_overworld/super_saiyan_trunks_pixel_sprite_sheet.png', 'rejected', '', '', '', 'tests/unit/beta3World.test.ts', 'SSJ is battle-only by design, so there is no SSJ field state; base Trunks stays on the map. Sheet also has an inconsistent standing frame and edge fringe (see docs/BETA3_WORLD_NOTES.md)')
add('trunks:bespoke VFX', 'Burning Attack / Finish Buster effect sprites', 'porunga-addon/04/future_trunks_energy_*_atlas', 'rejected', '', '', '', '', 'Atlas pieces are not tileable beams; the existing golden and violet beam sprites are used')
add('field:cooler sprite', 'Cooler field / introduction sprite', 'AOTS2_Beta2_Final_Missing_Art_Pack_v1/03_overworld/cooler_final_form_pixel_sprite_sheet.png', 'approved', 'public/assets/reviewed/overworld/cooler/', '176px canvas', 'feet-anchored', 'evidence/beta3/ruins/', 'Non-colliding arena presence that vanishes on cooler_defeated; 4 real directions, 20 frames; walk frames unused (see docs/BETA3_WORLD_NOTES.md)')
add('battle backdrop:cooler arena', 'dedicated arena backdrop', 'v4/namek_and_frozen_ruins_tileset', 'approved', 'src/engine/scenes/stageBackgrounds.ts (frozen)', '', '', 'evidence/v4/e2e_cooler_stage.png', 'Built from the extracted frozen objects + generated ice ground, not a single painted image')

with open(LIVE, 'w', newline='', encoding='utf8') as f:
    w = csv.writer(f); w.writerow(['ID', 'expected state', 'candidate source', 'status (approved / rejected / retained-original / missing)', 'installed path', 'dimensions', 'pivot / feet baseline', 'tested screenshot / evidence', 'reason', 'Beta 2 status', 'Beta 3 decision'])
    for r in rows:
        d = ALL_DECISIONS.get(r[0])
        w.writerow(list(r) + [BETA2.get(r[0], 'not in Beta 2'), d[0] if d else ('unchanged' if r[0] in BETA2 else 'new row')])
cnt = {}
for r in rows: cnt[r[3]] = cnt.get(r[3], 0) + 1
print(len(rows), 'rows', cnt)
missing = [r for r in rows if r[3] == 'missing']
with open(os.path.join(ROOT, 'docs', 'FINAL_MISSING_ASSETS.md'), 'w', encoding='utf8') as f:
    f.write('# Still-missing art (named blockers)\n\nGenerated from `docs/FINAL_ART_ACCEPTANCE.csv` by `tools/gen_acceptance_csv.py`. Nothing below is faked: the engine uses a labelled fallback (see `src/engine/assets.ts`).\n\n| ID | What is missing | Why / fallback |\n|---|---|---|\n')
    for r in missing: f.write(f'| `{r[0]}` | {r[1]} | {r[8]} |\n')
    f.write('\n## Also still open (not representable as one pose each)\n- Genuine multi-frame battle animation (4-6 frame idle loops, wind-up / strike / recovery) for every fighter other than Kaioken / Super Saiyan Goku. All motion is choreography over key poses.\n- Frieza form-to-form morph frames (1 to 2 to 3 to 4 to 5) and the Zarbon transformation frames.\n- Soldier art is one shared hornless trooper for scout, elite, Frost Guard and Frost Elite (palette-identical variants); soldier special has no distinct clean frame.\n- Field costumes for fused Piccolo and a field sprite for Cooler; hand-timed walk cycles (the sheets give 3-4 poses per direction).\n- Elders, villagers, children, trader and healer still use the earlier atlas objects.\n- Real recorded or composed music and sound effects (everything is procedural synthesis, including the two new Cooler tracks).\n')
