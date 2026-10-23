# Goku forms: which file is which

| Form | When it shows | Live art (all under `public/assets/reviewed/actors/`) | Source sheet |
|---|---|---|---|
| **Base Goku** | every battle before the SSJ unlock, title, world fallback | stills `goku_idle.png`, `goku_attack.png`, `goku_guard.png`, `goku_hurt.png`, `goku_charge.png`, `goku_special.png`, `goku_victory.png`, `goku_ko.png` (sprite id `goku`) | Beta 3 hero sheet (`art-sources/packs/...Visual_Master_Handoff_v1`, `goku_inspired_16_bit_battle_sprite_sheet.png`) |
| **Kaioken Goku** | only while the Kaioken status is active, or during the `kaioken` / `kaiokenassault` skills | `goku_kaioken_<state>_NN.png` (23 frames, set `goku_kaioken`) | `art-sources/goku-forms/kaioken_goku_pixel_sprite_sheet.png` |
| **Super Saiyan Goku** | only after the story unlock (`ssj` flag set by the `{transform:'ssj'}` script step) | `goku_ssj_<state>_NN.png` (24 frames, set `goku_ssj`) | `art-sources/goku-forms/super_saiyan_goku_pixel_sprite_sheet.png` |

Routing lives in one place: `gokuForm()` / `formSet()` in `src/engine/animation/gokuForms.ts`, applied by `BattleScene` (`setForm` for Kaioken, `ActorView.setSsjForm()` for SSJ, `setStillSprite('goku')` for base). SSJ wins over Kaioken. `formSet('base')` is `null`: there is no base frame set.

`ssj_goku_*.png` stills still exist because the SSJ fighter keeps the sprite id `ssj_goku` (size reference, persistent gold flame trigger, world fallback). They are never drawn in battle.

## Regenerating
`python -I tools/slice_goku_forms.py` rewrites every `goku_kaioken_*` / `goku_ssj_*` frame (deleting stale ones first), `src/data/powerupSprites.generated.ts` (animation tables and `refH` scale) and the review sheets in `evidence/powerups/`. The cell boxes and the pose tables are the two explicit dicts at the top of the script.

## Pose mapping (explicit)
| Pose | Kaioken | Super Saiyan |
|---|---|---|
| idle (loops, 7 fps) | `idle_01, 02, 03, 02` (ping-pong) | `idle_01..04` |
| charge | `powerup_01..04` (loops, 10 fps) | `powerup_01..04` |
| attack | `attack_02..05` walk the flurry (dash, punch, punch+crescent, kick+crescent) | same |
| special | `beam_03` (baked beam removed; engine beam VFX replaces it) | `beam_03` (same) |
| guard | `attack_01` (crouched ready stance) | `guard_01` |
| hurt | `hurt_01` / `hurt_02` (after 400 ms hold) | `hurt_01` |
| ko | `ko_01` | `ko_01` |
| victory | `victory_01` (fist raised) | `victory_01` |

## Known limitations
- **Kaioken source cell 1 (top-left of the sheet) shows the wrong costume** (purple trousers, light top). It is never sliced, so it cannot be played. The idle loop therefore uses source cells 2-4 as a 1-2-3-2 ping-pong, which keeps the first and last frame of the loop identical and avoids a pop. A unit test (`tests/unit/art-v3.test.ts`) fails if any exported Kaioken frame contains that costume.
- Neither new sheet has a crossed-arms guard frame; guard reuses the crouched ready stance (Kaioken `attack_01`, SSJ `guard_01`).
- The new SSJ sheet has one hurt frame (the old one had three), so a long hit-stun shows the same frame; Kaioken has three.
- Both sheets' baked aura / crescent / ring / burst props (bottom rows) are not exported: the engine draws its own VFX.
- `goku_kaioken_powerup_04` and `goku_kaioken_victory_02` lose a few faint aura pixels at the top edge of the shared 288x272 canvas (solid body pixels are never cut; the slicer prints a note).
- Kaioken `beam_04` keeps a little pink beam residue on its left edge. That frame is not used by any pose.
- Scale: each set has its own `refH` (hair-to-boots height measured on its idle frame, scaled to base). Kaioken's drawn hair is taller than base, so it renders a touch larger. Check in a battle screenshot if you retune.
