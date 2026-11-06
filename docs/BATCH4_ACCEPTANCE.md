# Batch 4 acceptance record

## Scope delivered

- Added complete four-drawing guard and hurt/recovery sequences for base Goku, Kaioken Goku, and Super Saiyan Goku. Kaioken uses its own body motion and a separate transparent red aura loop. Frame reviews, runtime registration, reduced-flash behavior, and coverage reporting are included in the local source changes.
- Added a live world mini-map. It draws the authored map tiles and available route markers, and tracks the player tile and facing while walking. The E2E check verifies that the marker moves with real input; `evidence/overhaul/world/shore_minimap_1280.png` records the rendered result.
- Updated the objective header to follow the postgame route: ask Bulma, inspect the rift, face Cooler, then explore after his defeat. The postgame E2E verifies the hub and victory objective text; the final screenshot confirms the short completion label stays clear of the reward toast.
- Added a master dynamics safety stage after the existing music/SFX buses and preserved the separate volume controls and music ducking. A browser audio test checks the running context, buses, victory cue, master gain and limiter, and measures rendered PCM. The latest full-suite sample measured about 0.13 RMS and 0.41 peak at the default music/master routing over nine seconds. This is an engineering headroom check, not a subjective listening review. Music and effects are still procedural; no new authored score or sampled effects were added.
- Rebalanced Cooler from 20,000 HP / 600 ATK to 17,000 HP / 540 ATK after earned-state simulations showed the original tuning was unfair for the actual completionist party. The natural completionist route produces levels 24/25/24. Two deterministic route seeds yielded 45% and 65% wins per attempt for the average-guarder policy at the new tuning; a separate level-risk simulation continues to mark level 22 without guarding as high risk. See `NATURAL_PLAYTHROUGH.md` and `tests/unit/postgame.test.ts` for the model and thresholds.
- Added browser evidence for the post-credits hub, opened rift, Frozen Ruins and live Cooler fight/clear. The route starts from a state earned by replaying the full story through the real story/combat engine, then continues through the game UI with real movement and battle input. It is not a single uninterrupted manual or browser run from New Game, and the engine-generated earned checkpoint is not evidence of human play.

## Verification record

- `npm run typecheck`: pass.
- `npm test`: 366 passed, 2 skipped across 26 files.
- `npm run audit:runtime`: 547 active battle files, 12 backgrounds, 7 overworld animation assets; zero missing, invalid, or duplicate drawing groups.
- Focused browser verification on the isolated port 5217: `story.spec.ts` **8/8 passed** (23.3 minutes), `worldAnimation.spec.ts` **10/10 passed** (3.0 minutes), `coolerPostgame.spec.ts` **1/1 passed** (5.3 minutes), plus the filtered Porunga/Goku-form/Cooler-asset regressions **3/3 passed**.
- Full `npm run test:e2e`: the first 56-test run ended **31 passed / 25 failed** after its server on port 5199 stopped accepting connections. Two texture-name assertions were stale and have been corrected. The final fresh-port full run passed tests **1–41**, then was stopped after the user raised the elapsed time; its remaining 15 tests were already covered by the standalone story/world suites above. See `RELEASE_ACCEPTANCE_CHECKLIST.md` for exact status.
- Relevant browser evidence is under `evidence/overhaul/world/` and `evidence/overhaul/postgame/`.

## Acceptance status

Batch 4 implementation and all directly relevant automated suites are complete. The repository-wide 56-test E2E command was not completed in one uninterrupted final run, although the story, world-animation, Cooler postgame, Goku-form, Porunga, audio, and renderer suites all passed separately. Subjective audio balance, a human uninterrupted full-story playthrough through Cooler, other-PC/controller review, and final release packaging/launch remain open acceptance items. This is not a final v1 sign-off. Changes remain local and uncommitted.
