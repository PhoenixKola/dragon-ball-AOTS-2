# Release acceptance checklist

| Gate | Current review status |
|---|---|
| Typecheck | Passed on current tree |
| Production build | Passed; Vite warns about the >2 MB minified JavaScript chunk |
| Unit suite | **365 passed, 2 skipped** across 26 files |
| Active runtime art audit | **505 battle files + 12 backgrounds; 0 missing, 0 invalid, 0 duplicate drawings**; additionally validates four Namekian atlases (4 directions × 3 walk frames), Dende/soldier atlases (4 directions × 2 distinct walk frames), and the generated anchored frog cel |
| Animation renderer E2E | **4 passed**: party/guest melee, enemy melee, 24 idle loops, and core-party charge/special sequences |
| Batch 3 world animation/cinematic E2E | **10 passed** in `tests/e2e/worldAnimation.spec.ts`: field patrol/ambience, battle-stage atmosphere, new-game orbital approach → landing → exploration handoff, Dende rescue, postgame rift, Ginyu frog payoff, Frieza reveal, Cooler entrance, Reduced Flash, and all nine map renders with four village NPC texture assertions. |
| Story route and softlock checks | **31 passed** across `story.test.ts` and `softlocks.test.ts` after visual contour changes |
| D3D11 overworld route | **1 passed** on RTX 3070 Ti: real-key Stolen Supplies quest, route-to-NPC, patrol battle, pickup and journal flow |
| UI review at 1024x600, 1280x720, 1920x1080 | **3 passed**: all menu tabs, shop, Porunga, victory, defeat, credits and Frieza battle HUD; no browser errors |
| Chromium software-renderer performance | Open: latest field sample 11.38 Phaser FPS / 3.98 browser RAF callbacks per second under Playwright SwiftShader; this slow software-renderer result does not represent hardware GPU playback |
| Broader browser suite | Prior 41-test run passed before final animation rollout; not rerun on current tree |
| Player ZIP | [Incomplete RC ZIP](../release/AOTS2-Namek-Saga-experience-overhaul-incomplete-RC-windows.zip), **90.1 MiB**, 1,232 entries. Integrity passed; contains 232 new runtime frames and `README-PLAY.txt`; dev art/evidence, `.git`, `legacy`, `node_modules`, ROM, and `.env` excluded. |
| Final ZIP launched through bundled Windows runtime | Not rechecked after final rebuild; BAT double-click remains unverified |
| Other PC, physical controller, GPU/high DPI | Unverified |
| BGM/SFX listened to by ear | Unverified; no audio production/mix pass in this batch |
| Owner playthrough: new game → credits → wishes → Cooler | Unverified; automated natural progression is not a human playthrough |
| Import of owner's existing save | Migration tests pass; personal save unverified |
| Git state | Batch 1 `f2c3717` and batch 2 `63aa7a7` are pushed; Batch 3 source and focused verification are complete. Human/device, authored-audio and hardware-performance acceptance remain open, so this does not claim final v1 sign-off. |

The animation batch is complete for the poses listed in the report, but the overall overhaul remains an **incomplete RC**, not a final v1 sign-off.
