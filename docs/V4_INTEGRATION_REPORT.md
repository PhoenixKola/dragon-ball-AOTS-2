# Additive art pass: v4 pack + Visual Master Handoff v1 (implementation report)

Scope (as requested): visual integration only. No gameplay, balance, save, or story logic was changed. The postgame / Cooler map / Rage-Sparking rework / four-slot loadouts / Esc-fullscreen items in the master brief (phases E-I) were **not** part of this pass and are **not done**.

Rule applied throughout: **the runtime contains only the project's own new art.** All earlier overworld frames and portraits that came from outside sources were replaced by new-sheet art.

Cut-off / alpha policy: sheets store dark outlines and hair at alpha 20-250. Extraction keeps those dark pixels (`tools/v4_common.py: solid()`) and drops coloured glow/fringe; battle sprites are installed at **native pixel size, no resampling** (resampling mangled stair-stepped hair, e.g. Gohan). Only a pose that cannot fit the canvas (some KO frames) is reduced on its own. `python -I tools/audit_cuts.py --all` flags canvas-edge contact and flat crop edges; actors, aura frames and v4 world objects pass; the remaining flags are the natural flat silhouettes of Nail's/Bulma's overworld frames (checked by eye).

## Integrated
| Area | What | Where |
|---|---|---|
| Battle sprites, all 23 IDs | gohan, krillin, piccolo, vegeta, goku, ssj_goku, cui, dodoria, zarbon, guldo, recoome, burter, jeice, ginyu, frieza1-5 from the handoff sheets; **dende, nail, zarbon2 (transformed), soldier (Frieza Force)** from v4. 448x448 canvas, feet (224,438), one scale per character (relative proportions exact), all drawn facing right (allies never mirrored, enemies always) | `public/assets/reviewed/actors/`, `tools/integrate_battle_v4.py`, `tools/integrate_v4_actors.py`, `src/data/poseFacing.ts`, `src/engine/assets.ts` |
| Real KO / guard / charge / victory / special poses | now exist for most characters (previously fell back to hurt/idle); `ActorView` plays `ko` when downed | same |
| Overworld (all 11 entities) | goku, gohan (Namek outfit, no longer provisional), krillin, vegeta, piccolo (+fused = same art), SSJ goku, bulma; **new NPCs/foes**: dende, nail, Frieza-force soldier. 144x144 canvas, heights set from the battle height ratios | `public/assets/reviewed/overworld/`, `tools/integrate_overworld_v4.py`, `src/data/maps.ts` (Dende, Nail and all 7 soldier patrols now use them) |
| Portraits | goku, gohan, krillin, piccolo (new busts), **bulma, dende, nail, cui, zarbon, frieza (1/4), cooler** from v4. `Nail`/`Cui` speakers no longer borrow Dende/Ginyu portraits; `zarbon2`, frieza2/3/5 alias to their form's bust | `public/assets/portraits/`, `src/components/ui.tsx`, `SPEAKER_PORTRAIT` |
| Item icons | all 10 replaced by distinct v4 items (previously several identical orbs) | `icons/items/` |
| Skill / command icons | 72 skill icons + defend / flee / sparking from the v4 energy icon atlas; hero Attack uses the fist icon (the old comet icons were replaced after review) | `icons/skills/`, `icons/commands/` |
| VFX | gold and purple **aura-rise ground bursts** played when an aura ignites (skipped for Reduced Flash / procedural VFX style) | `vfx/aura_rise/`, `src/data/auraRise.generated.ts`, `vfxSprites.ts`, `ActorView.ts` |
| World | v4 horned Namek dome and blue tree on Aojan Village | `public/assets/world/obj/v4_*` |

## Rejected / kept existing (with reasons)
- **Red aura-rise set**: frames overlap neighbours on the atlas and clip when isolated. Not installed.
- **Frieza baked-aura frames, Jeice "special" (baked pink ball)**: not used (aura rectangles / glued effects).
- **Kaioken and SSJ 32-frame Goku sequences**: kept; they are AI-sheet derived and richer than the 8 new key poses. Base Goku's battle animation set is still the cleaned Kaioken-derived one; the new Goku sheet is installed for stills/fallbacks.
- **Post-fusion Piccolo sheet, Gohan rage sheet, golden aura explosion sheet**: reviewed, not wired (no runtime hook for a fused battle sprite or Rage overlay without a code change).
- **v4 beam/impact sprites from the energy atlas** (other than aura rise): beams/impacts already exist in the validated VFX set; the atlas pieces are not tileable.
- **Several energy-icon atlas entries** that look generic stay mapped to the old glyph where no v4 icon fits: `e_dirtyshot`, `e_tauntingflick` and similar are intentionally approximate.
- **Frozen-ruins / extra Namek tiles**: extracted, but not placed on a map (the Cooler area does not exist yet). Staged in `art-sources/staged-v4/world-objects/`.
- Replaced files are backed up under `art-sources/replaced-by-v4/`.

## Still missing / follow-up art
- Frieza forms have only idle / attack / hurt (no guard, KO, victory); Frieza1/2/3 morph transition frames, Zarbon transformation frames.
- Frieza-force soldier battle art reads like a horned purple Ginyu-type fighter (that is what the pack supplies); a distinct generic soldier would be better. Scout and Elite Soldier share it.
- No 4-6 frame idle loops or wind-up/recovery frames for anyone; motion is still choreography over key poses.
- Overworld walk cycles are the 3-4 sheet poses (not hand-timed). Fused Piccolo, Dende (guest) and Nail have no distinct costume variants.
- Cooler: portrait installed; no field sprite, battle backdrop, or any in-game content.
- Other NPCs (elders, villagers, children, trader, healer) are still the AI atlas objects.
- Zarbon (normal) uses a different canvas scale to Zarbon (transformed) by design (one scale per character); heightPx in `enemies.ts` drives on-screen size.

## Verification (see docs/test-results/V4_RUN.md)
Typecheck, unit tests, production build and Playwright e2e were run on this tree; evidence captures are in `evidence/v4/`. Not done: human playthrough, real-GPU performance, audio, gamepad, high-DPI.
