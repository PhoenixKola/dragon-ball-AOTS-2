# Release acceptance checklist

| Gate | Current review status |
|---|---|
| Typecheck | Passed on current source tree |
| Production build | Passed; Vite warns that the minified JavaScript chunk is about 2.08 MB |
| Unit suite | **366 passed, 2 skipped** across 26 files |
| Active runtime art audit | **547 battle files, 12 backgrounds, 7 overworld animation assets; zero missing, invalid, or duplicate drawing groups** |
| Animation renderer E2E | **5 passed** in `tests/e2e/partyAnimation.spec.ts`, including Goku base/Kaioken/SSJ guard and hurt/recovery sequences |
| World animation / mini-map E2E | **10 passed** in `tests/e2e/worldAnimation.spec.ts`; real input moves the mini-map marker and facing arrow. D3D11 field sample: 53.7 Phaser FPS / 60.7 browser RAF |
| Audio routing check | **1 passed** in `tests/e2e/audioMix.spec.ts`; running context, music/SFX buses, victory cue, master gain and compressor verified. Nine-second PCM sample measured 0.13 RMS and 0.41 peak at default output in the latest full run. Human listening remains open |
| Natural story browser routes | **8 passed** in `tests/e2e/story.spec.ts` on isolated port 5217: New Game through Chapter 2; chapters 2–3, 4, and 5–7; full Dragon Ball/Porunga ending; natural-level later chapter segments. No defeats were retried on the natural segments |
| Natural postgame browser route | **1 passed** in `tests/e2e/coolerPostgame.spec.ts`: engine-earned Normal completionist save (levels 24/25/24) continued through hub, rift, Frozen Ruins, patrol interruption, and Cooler victory/reward. Cooler fell on the first arena attempt; zero retries and zero browser errors. Postgame objectives now advance from Bulma to Cooler and the cleared state |
| Focused regression reruns | **3 passed**: missing-ball Porunga route, Goku base/Kaioken/SSJ real-battle routing, and Cooler/SSJ stage asset loading |
| Full 56-test E2E invocation | Initial run: 31 passed / 25 failed after the web server on port 5199 began refusing requests; later tests failed at navigation. Two stale Goku/Cooler texture-prefix assertions were corrected. On the fresh 5217 configuration, the full run passed tests 1–41 and was stopped after the user raised the run time; 15 tests were not reached in that final full invocation. The directly relevant suites all passed separately on port 5217 |
| Mini-map evidence | `evidence/overhaul/world/shore_minimap_1280.png`; live movement and facing are also covered by E2E |
| Cooler postgame evidence | `evidence/overhaul/postgame/natural_hub_1280.png`, `natural_rift_1280.png`, `natural_cooler_ruins_1280.png`, `natural_cooler_battle_1280.png`, and `natural_cooler_cleared_1280.png` |
| Natural Cooler combat model | Actual earned-state simulation: two route seeds at levels 24/25/24 yielded 45% and 65% wins per attempt for average guarding. Level 22 without guarding remains high risk. Details in `NATURAL_PLAYTHROUGH.md` |
| Player ZIP | Existing [incomplete RC ZIP](../release/AOTS2-Namek-Saga-experience-overhaul-incomplete-RC-windows.zip) is from the prior batch and was not rebuilt for Batch 4 |
| Human audio review | Open; automated signal/headroom checks do not replace listening |
| Human uninterrupted full-story playthrough | Open; browser coverage uses segmented scenarios and an engine-earned completionist checkpoint for the postgame continuation |
| Other PC / physical controller / high DPI | Unverified |
| Final ZIP launch through bundled Windows runtime | Unverified after Batch 4 |
| Owner’s existing personal save | Migration tests pass; personal save not verified |
| Git state | Batch 1 and 2 remain pushed; Batch 3 and Batch 4 changes are local, uncommitted and unpushed |

Batch 4 implementation and its directly relevant automated checks are complete. The project remains an **incomplete RC**, not a final v1 sign-off.
