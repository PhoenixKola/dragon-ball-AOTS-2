# Beta 3 world notes: SSJ Trunks field, Cooler field sprite, Frozen Ruins

Tool: `tools/integrate_beta3_world.py` (repeatable; reads `art-sources/packs/AOTS2_Beta2_Final_Missing_Art_Pack_v1/`). QA capture: `tools/shot_ruins.mjs`. Evidence: `evidence/beta3/ruins/` (1024x600, 1280x720, 1920x1080; route points, full map, post-defeat).

## Decisions
| Source | Decision | Reason |
|---|---|---|
| `03_overworld/super_saiyan_trunks_pixel_sprite_sheet.png` | **Rejected for the field; not installed** | Super Saiyan Trunks is a battle status (`ssjform`, set by a skill, gone after the fight), so the map has no SSJ state to show. A permanent SSJ field sprite would be misleading. The sheet also has an inconsistent standing frame (no sword) and dark/red edge fringe. `heroOverworld('trunks', {ssj:true})` deliberately returns base `trunks` (tested). Beta 2's `SSJ Trunks field` row stays **missing, by design** (blocker only if SSJ ever becomes a field state). |
| `03_overworld/cooler_final_form_pixel_sprite_sheet.png` | **Accepted** | 20 distinct frames (5 per direction, rows down/left/right/up checked by face and tail side, no mirroring), clean RGBA. Installed to `public/assets/reviewed/overworld/cooler/<dir>/{idle_000,walk_00N}.png` (176x176, feet anchor 88,172, front height 118 px) plus `OVERWORLD.cooler`. Used **only** as an arena presence: prop `cooler_presence` in `cooler_ruins` at (40.2, 14.4), visible while `cooler_defeated` is unset, turns toward the player when near. No collision, no script, no reward, no respawn; the existing `cooler_arena` trigger (35.3) and `cooler_fight` script are unchanged apart from one narration line ("rises from the frost" became "waiting in the arena turns"). Battle poses are untouched. Walk frames are installed but unused. |
| `04_world_terrain/frozen_alien_ruins_tileset_atlas.png` | **Accepted selectively** | Two atlas crops, mirrored 2x2 to tile seamlessly: `ice_cliff.png` (rock face, atlas box 545,136,605,154) and `ice_deep.png` (plain deep-water tile, box 18,244,66,288) in `public/assets/world/tex/`. The atlas is not a tile grid, so nothing else was cut from it; the existing procedural ice floor is kept. |
| `05_optional_review/...` | not used (other stream) | |

## Frozen Ruins rendering (`WorldScene.paintTerrain`, ice sky only)
Before: every `x` cell was filled with flat `0x1b1a52` squares. After: the whole map sits on animated deep icy water; the ice plateau is extruded as a three-layer rock cliff (same rounded mask as the ice, shifted 28/20/10 px down, with a shadow layer) so every blocked/out-of-world edge reads as a cliff over water. Falls back to the old fill if the textures are missing. Other maps are unchanged. Collision grid, exits, camera bounds, encounter zones: untouched (`tests/unit/beta3World.test.ts` pins the ground grid hash).
Before/after: `evidence/beta3/ruins/ruins_*` (old flat squares seen in Beta 2 screenshots; no "before" capture of the new tool exists).

## Tested
- `tsc --noEmit`; vitest `beta3World`, `art-integration`, `triggers`, `softlocks`, `art-v3` (65 passed).
- Real Chromium (SwiftShader) via `tools/shot_ruins.mjs` at 1024x600, 1280x720, 1920x1080: entrance, save, both chests, bridge, arena with Cooler, rematch terminal, full map; no page errors. Reviewed by eye.
- **Not done:** walking every patrol/encounter by hand (teleported to route points instead; patrols are untouched), real GPU, high-DPI, human playthrough. Full `npm test`, build and e2e left to the lead.

## Remaining blockers
- SSJ Trunks field sprite: none needed unless SSJ becomes a persistent field state.
- Cooler's field walk cycle exists but is unused.
