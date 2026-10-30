# Asset workflow decision (Namek, Cell, Daily Silver)

All three games are browser 2D projects. Namek and Cell use React/TypeScript/Phaser 3.90; Daily Silver uses JavaScript Canvas. Their existing PNG, Python/Pillow, and Node workflows already fit the runtime. No new program or package was installed.

| Candidate | Decision | License | Installation method if ever needed; current risk |
|---|---|---|---|
| [Jolt Physics](https://github.com/jrouwe/JoltPhysics) | Not appropriate: native 3D rigid bodies | MIT | CMake source build; would add a native physics stack |
| [Terrain3D](https://github.com/TokisanGames/Terrain3D) | Not appropriate: Godot terrain | MIT | Godot addon; engine mismatch |
| [Material Maker](https://github.com/RodZill4/material-maker) | Maybe later for hand-authored 2D texture export | MIT | Portable official release; editor/export and style QA needed |
| [Effekseer](https://github.com/effekseer/Effekseer) | Maybe later for complex effects baked to PNG | MIT (check tool/runtime files separately) | Portable official release; manual editor export and frame/pivot validation needed. Existing effects are simpler to rebuild with Pillow. No Effekseer export is claimed. |
| [Voxel Tools](https://github.com/Zylann/godot_voxel) | Not appropriate: Godot 3D voxels | MIT | Godot module/extension; engine mismatch |
| [Recast Navigation](https://github.com/recastnavigation/recastnavigation) | Not appropriate: 3D navmeshes | zlib | C++ source build; existing grid maps/pathing fit |
| [ozz-animation](https://github.com/guillaumeblanc/ozz-animation) | Not appropriate: 3D skeletal animation | MIT | CMake source build; character art is 2D PNG |
| [The Forge](https://github.com/ConfettiFX/The-Forge) | Not appropriate: native renderer | Apache 2.0 for this repo's PC code | Native source build; would replace Phaser/Canvas |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) | Not appropriate: mesh processing | MIT | C++/JS package; no mesh assets |
| [FastNoise2](https://github.com/Auburn/FastNoise2) | Not appropriate: C++ noise library | MIT | CMake source build; existing 2D procedural terrain/effects suffice |
| Tiled / LDtk | Maybe later only if map authoring becomes a bottleneck | License review at adoption | External editor plus importer; existing maps need no conversion now |

## Namek slice

`python tools/make_buff_vfx.py` rebuilds eight original, transparent 96×64 PNG frames at `public/assets/reviewed/vfx/buff_rise/`. `artManifest.generated.ts` declares their 65 ms pacing and centered pivot. `vfxSprites.ts` loads them and uses them for the existing `buff` cue when sprite VFX are selected; procedural VFX remain available under the existing setting. The generator needs Pillow, already used by `tools/audit_assets.py`. The effect is code-drawn original art, with no third-party sprite license or attribution. No character pose was replaced.

The previously missing `frieza2:victory` now has a separate generated source at `art-sources/source-art/frieza2/victory/source.png` and integrated output at `public/assets/reviewed/actors/frieza2_victory.png`. It was made with the built-in image-generation edit tool using the installed idle pose as the reference, then visually checked against that pose. `python -I tools/integrate_frieza2_victory.py` normalizes it to 448×448, centers the visible figure, and fixes its feet at y=438. `python -I tools/gen_sprite_manifest.py` refreshes the bounding-box registry. The game now resolves victory to that separate pose. This is an AI-derived candidate, not human-approved or a claim of hand-drawn animation. The original Beta 3 source-sheet gap remains documented in the historical report; the two other named pose gaps remain.

Run `npm run art:buff`, `python -I tools/integrate_frieza2_victory.py`, `python -I tools/gen_sprite_manifest.py`, `npm run typecheck`, `npx vitest run tests/unit/art-integration.test.ts`, then `npm run build`. The reviewed VFX manifest entry is source controlled; if a future art integration script rewrites that generated manifest, retain the `buff_rise` entry. Both outputs were visually inspected at game scale. Character animation and human art approval still require artwork/review.
