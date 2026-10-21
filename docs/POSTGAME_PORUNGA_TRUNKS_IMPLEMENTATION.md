# Future Trunks, Super Saiyan Trunks and Porunga's three wishes: implementation notes

Scope: `docs/briefs/AOTS2_Postgame_Trunks_Porunga_Additive_Claude_Prompt.md`. Additive to the v5 tree (loadouts, Rage/Sparking, postgame, Cooler, Frozen Ruins). Nothing committed or pushed; no source pack deleted.

## Repo layout change
The three art packs (`AOTS2_additive_art_pack_v4`, `AOTS2_Namek_Saga_Visual_Master_Handoff_v1`, `AOTS2_Postgame_Porunga_Trunks_Art_Addon_v1`) moved from the repo root to `art-sources/packs/`; the briefs moved to `docs/briefs/`. All `tools/integrate_*.py` read from the new paths. `tools/make_release_zip.py` skips `art-sources/packs`.

## Art (tool: `tools/integrate_trunks_v5.py`)
| Asset | Source sheet | Installed | Decision |
|---|---|---|---|
| Trunks battle, 8 poses | 01_future_trunks_base/future_trunks_battle_sprite_sheet | `actors/trunks_*.png` 448x448, feet (224,438) | approved; 2x display height (140 px), box-filter downscale, outlines kept, facing right (enemy side never used) |
| Super Saiyan Trunks battle, 8 poses | 02/super_saiyan_trunks_sprite_sheet | `actors/trunks_ssj_*.png` | approved; matched to base by boot width so both bodies are the same size (`SCALE_REF` in assets.ts) |
| Field walk, 4 facings x 4 frames | 01/chibi_swordfighter_sprite_sheet (rows down/left/right/up, checked by sword-sheath side) | `overworld/trunks/` | approved; never mirrored. Super Saiyan keeps this base look on the map (the pack has no SSJ field sheet): documented fallback |
| Portraits | 01/..portrait_sprite_sheet (#2), 02/..portrait_sheet (#0) | `portraits/trunks.png`, `trunks_ssj.png` | approved |
| Skill icons (15) | 04/pixel_art_warrior_skill_icon_atlas | `icons/skills/` | approved; glow kept, neighbours removed |
| Wish / relic icons | 03/neon_golden_dragon_orb_icon_sheet | `icons/wish/`, `items/dragoncrest.png` | approved |
| Porunga (5 poses), 7 Dragon Balls, light pillar | 03/porunga_summoning_pixel_art_sprite_sheet only | `reviewed/porunga/` | approved; ONE Porunga design used (the other sheet has fragmentary crops and a different style) |
Rejected / not used: `porunga_summoning_sprite_sheet` (second design, clipped heads), `golden_awakening_energy_vfx_sprite_sheet` and the Trunks energy effect atlases (kept as source: the battle uses the existing beam/melee sprite VFX, so Burning Attack and Finish Buster use the golden and violet beam sprites, not bespoke atlas animation), `dragon_ball_rpg_ui_icon_atlas` (not needed), the transformation sheet (aura baked into poses: the transformation uses the engine's aura/flash/banner with the SSJ sprite swap instead). No fake in-between frames anywhere.

## Trunks
`trunks` is a full `HeroId`. Stats like Vegeta's class (HP 290, ATK 48, SPD 28 at Lv1; recruited at max(22, party average)). 12 library skills (mixed roles: sword barrage, beams, barrier buff, counter, heal, party support, stun, three Super Saiyan-only skills), 4 equipped through the shared loadout, Rage Art `Future Slash Storm`, an always-available `Super Saiyan` command (no slot). Each skill has its own clip (generated families, each registered under the skill's id).

Super Saiyan (battle-long status `ssjform`, never Goku's `ssj` flag): ATK x1.3, DEF x1.15, SPD x1.2; 24 Ki to enter; drains 5% max Ki at the start of each own turn; ends with a message when Ki hits 0. SSJ-only skills can be equipped anywhere, are refused (and greyed with "Needs Super Saiyan") otherwise, and are never deleted from a loadout. Bot: transforms when HP > 50% and Ki >= 55%. Sprite, portrait and flame swap with the status; Rage, Sparking and Active Guard work unchanged (tested).

## Porunga
Shrine: `Dragon Ball Shrine` in Guru's Sanctuary (postgame only). Summoning needs `postgame_unlocked` and all seven `ball1..ball7` flags. Missing balls are named with their hints. Postgame access to the Last Ground (where ball 7 sits) was added (`landing_to_core_post` / `core_to_landing`), so no ball can be missed for good; the final fight cannot re-trigger. The ceremony is framed as a later summoning once the balls recharge, so neither main ending is contradicted.

Wishes (`src/systems/wishes.ts`, pure and atomic): `wish_trunks`, `wish_potential`, `wish_relic` flags are the only ownership record.
1. Secret Ally: Trunks joins (party if a seat is free, otherwise the roster/bench).
2. Hidden Potential: whole roster, permanent `potential` multiplier (HP/Ki x1.10, ATK/DEF x1.08, SPD x1.05), also applied to later recruits by `joinHero`; never stacks.
3. Dragon Relic: one `Namekian Dragon Crest` capsule (+9 ATK/DEF, +90 HP, +30 Ki, Rage +10%); a lost flag never produces a second one (equipped copies are counted).
Any order, once each, cancel spends nothing, all-done acknowledgement. UI: skippable ritual, three cards, confirm page with stat preview and a permanence warning, Back = X / Backspace / B, journal block with pending/granted status.

## Cooler compatibility
Cooler needs none of this. Simulation: Lv28 party without wishes wins >= 70%; with Hidden Potential and the relic it is only a little easier; Lv22 stays a real risk even with every wish (`tests/unit/trunks.test.ts`).

## Saves
`SAVE_VERSION` unchanged. Optional `potential` (boolean) per member and the three `wish_*` flags (existing safe flag whitelist). Validation rejects Trunks without `wish_trunks`, `potential` without `wish_potential`, wrong types and bad loadouts. Saves from before the update load unchanged and can still make all three wishes (tested).

## Tests
Unit: `tests/unit/trunks.test.ts` (25). Browser: `tests/e2e/porunga.spec.ts` (all balls: cancel, reload between wishes, three wishes; missing ball: shrine explains, Last Ground revisit, ceremony opens).

## Not done / limits
Super Saiyan Trunks on the overworld uses the base look. Burning Attack and Finish Buster reuse existing beam sprites. No bespoke Porunga speech audio or Hidden Potential effect sprite (CSS fades only). Restrained UI refinement is limited to the new cards, loadout badges and existing focus styles: no sweeping restyle of shop/items/equipment. No human playthrough, real-gamepad, audio-by-ear or real-GPU checks.
