"""Beta 3 per-ID art decisions (merged into docs/FINAL_ART_ACCEPTANCE.csv by gen_acceptance_csv.py and rendered by docs/BETA3_GAP_DECISIONS.md).
DECISIONS[id] = (outcome, candidate source, note). outcome: 'accepted' | 'rejected' | 'retained-fallback'.
Piece numbers are reading-order indices of the opaque pieces on the pack sheet (tools/integrate_beta3_battle.py SPECS is the executable record).
Other streams (overworld Trunks / Cooler) may add their own rows to DECISIONS_EXTRA below."""
PK = 'AOTS2_Beta2_Final_Missing_Art_Pack_v1/'
S = {
    'frieza1': PK + '01_frieza_forms/frieza_first_form_battle_sprite_sheet.png',
    'frieza2': PK + '01_frieza_forms/frieza_second_form_battle_sprite_sheet.png',
    'frieza3': PK + '01_frieza_forms/frieza_third_form_battle_sprite_sheet.png',
    'frieza4': PK + '01_frieza_forms/frieza_final_form_battle_sprite_sheet.png',
    'frieza5': PK + '01_frieza_forms/frieza_final_form_pixel_sprite_sheet.png',
    'jeice': PK + '02_bosses_foes/jeice_pixel_art_battle_sprite_sheet.png',
    'soldier': PK + '02_bosses_foes/pixel_art_alien_soldier_sprite_sheet.png',
    'zarbon2': PK + '02_bosses_foes/transformed_zarbon_pixel_sprite_sheet.png',
    'dende': 'AOTS2_additive_art_pack_v4/dende_pixel_art_battle_sprite_sheet.png',
    'nail': 'AOTS2_additive_art_pack_v4/nail_s_pixel_art_battle_sprite_sheet.png',
}
# actor -> {pose: piece}
PIECES = {
    'frieza1': {'guard': 1, 'charge': 2, 'special': 4, 'victory': 7, 'ko': 9},
    'frieza2': {'guard': 1, 'charge': 2, 'special': 5, 'ko': 8},
    'frieza3': {'guard': 1, 'charge': 2, 'special': 5, 'victory': 7, 'ko': 8},
    'frieza4': {'guard': 1, 'charge': 2, 'special': 6, 'victory': 9, 'ko': 10},
    'frieza5': {'guard': 6, 'charge': 16, 'special': 20, 'victory': 29, 'ko': 36},
    'jeice': {'special': 11},
    'soldier': {'charge': 40, 'victory': 37},
}
D = {}
for actor, poses in PIECES.items():
    for pose, i in poses.items():
        note = f'piece {i}; no baked aura/projectile; scale and feet anchor matched to the installed idle'
        if actor == 'frieza5' and pose == 'special': note = 'piece 20; a small purple glow at the open palm is baked into the frame (the separate beam pieces 21/22 are NOT used); accepted as a short held cast pose'
        if actor == 'frieza1' and pose == 'special': note = 'piece 4 (palm thrust); a close relative of the installed attack pose, kept because the frames differ (arm layout, tail, head)'
        if actor == 'jeice': note = 'piece 11: raised-arm cast with NO projectile on the sprite; the Crusher Ball is engine VFX, so cast, travel and hit stay independent'
        D[f'{actor}:{pose}'] = ('accepted', S[actor], note)
# full-set swaps (identity of the new sheet differs from the installed one, so mixing poses would pop)
SWAP_NOTE = {
    'frieza2': 'Beta 2 art had a white-spiked head; the new second form (curved black horns) is the canonical, more distinct look. Whole set swapped so idle/attack/hurt match the new guard/charge/special/KO',
    'frieza3': 'Beta 2 art was a spiked pink body close to form 2; the new third form (elongated head crest, purple body) keeps the five forms distinct. Whole set swapped',
    'frieza5': 'Beta 2 art was a larger, differently proportioned muscular redraw; mixing it with the new sheet pops between poses. Whole set from the 100% sheet (muscular, distinct from compact frieza4)',
    'soldier': 'Beta 2 soldier was a horned Ginyu-type look; the new sheet is a hornless generic trooper. Whole set swapped so charge/victory share the head and armour',
}
PIECE_IDLE = {'frieza2': {'idle': 0, 'attack': 4, 'hurt': 6}, 'frieza3': {'idle': 0, 'attack': 3, 'hurt': 6}, 'frieza5': {'idle': 0, 'attack': 11, 'hurt': 26},
              'soldier': {'idle': 0, 'guard': 8, 'attack': 26, 'hurt': 31, 'ko': 35}}
for actor, poses in PIECE_IDLE.items():
    for pose, i in poses.items():
        D[f'{actor}:{pose}'] = ('accepted', S[actor], f'REPLACED (original in art-sources/replaced-by-beta3/actors/{actor}_{pose}.png, contact_{actor}_before_after.png). piece {i}. {SWAP_NOTE[actor]}')
D['frieza2:victory'] = ('retained-fallback', S['frieza2'], 'No genuine victory frame on the sheet (piece 7 is a roaring claw pose that duplicates charge); not relabelled. Idle is used (src/engine/assets.ts)')
D['soldier:special'] = ('retained-fallback', S['soldier'], 'No distinct clean special frame: the only clean palm-thrust (piece 26) is already the attack, and every other cast frame carries baked crescents / beams / glows (pieces 20-24, 27-30 rejected). Falls back to attack')
D['zarbon2:special'] = ('rejected', S['zarbon2'], 'Candidate set is a different design (no cape, purple shorts, orange boots, tail) from the installed monstrous Zarbon; mixing it would break the creature identity. Installed charge/attack fallback kept')
D['dende:charge'] = ('accepted', S['dende'], 'Not in the new pack. The already-owned v4 sheet has a clean screaming stance as its 3rd frame (no aura), the same pose type every hero uses for charge; scaled with the installed idle')
D['nail:charge'] = ('accepted', S['nail'], 'Not in the new pack. The already-owned v4 sheet has a clean screaming stance as its 3rd frame (no aura); scaled with the installed idle')
DECISIONS = D
PK3 = PK + '03_overworld/'
DECISIONS_EXTRA = {
    'trunks:overworld SSJ': ('rejected', PK3 + 'super_saiyan_trunks_pixel_sprite_sheet.png', 'SSJ is battle-only by design (ends with the fight), so no SSJ field state exists; heroOverworld(trunks,{ssj:true}) returns base Trunks, pinned by tests/unit/beta3World.test.ts. The sheet also has an inconsistent standing frame and edge fringe. Base Trunks stays on the map'),
    'field:cooler sprite': ('accepted', PK3 + 'cooler_final_form_pixel_sprite_sheet.png', '20 distinct frames in 4 real directions installed (public/assets/reviewed/overworld/cooler/, 176px canvas). Used as a non-colliding arena presence (cooler_presence) that vanishes on cooler_defeated; no trigger/reward change. Walk frames installed but unused (he does not walk on the field)'),
}
