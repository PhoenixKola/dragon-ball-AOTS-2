# Alpha 4 test results (what was actually run)

Machine: Windows 11, headless Chromium through Playwright 1.55. Story and UI-resolution tests used the real GPU (ANGLE/D3D11, RTX 3070 Ti, ~59 fps); the smoke suite uses software GL. All browser play is automated (real key presses, no human watching).

## Unit tests: `npm test`
250 passed, 2 skipped, 15 files (Alpha 3g baseline: 155). New files: storyPath (9), quests (13), progression (15), saveCompat (18), combatRules (17), triggers (18), gamepad (5).

## Browser story tests (`tests/e2e/story.spec.ts`), real keys
Logs: `docs/test-results/story_run1_full_suite.log`, `story_run2_chapters_3_4_5_rerun.log`.

| Test | Result | Time | Defeats retried |
|---|---|---|---|
| Stolen Supplies quest chain | passed | 51 s | 0 |
| Chapters 1-2 from a new game: intro, first contact, Dende, Vegeta, Cui, ball 1, Dragon Radar line | passed | 2.2 min | 0 |
| Chapter 2→3: Dodoria, Medicine for the Elders, grotto, ball 2, Zarbon, Guru (+6 points), ball 3 | passed (after fixing the test's pathing margin) | 2.8 min | 0 |
| Chapter 4: Guldo, Recoome (Goku arrives), Burter+Jeice, Ginyu, ball 4 | passed (levels raised to 28 in the fixture: the bot loses Ginyu below that) | 9.4 min | 6 |
| Chapters 5-7: Nail, Piccolo, point of no return (Cancel then Continue), altar save, forms 1-3, Vegeta falls, final form, Krillin, SSJ, last ground, final fight, incomplete ending, credits | passed | 10.1 min | 4 |
| Chapter 7 with all seven balls: last ball does not start the fight, Porunga ending | passed | 1.8 min | 0 |

Fixtures: the save at each chapter boundary comes from the headless route (`tests/support/storyPlan.ts`), so flags and levels are what a player has there; levels were raised where noted. The battle bot uses the simulator's decision model through real key presses.
First run of this suite had 3 failures that were test or engine problems, all fixed: a world-scene position race (engine bug, fixed with a world-generation guard), path clearance in a narrow cave corridor, an unhandled altar overlay in the test driver.
A dedicated "defeat then Retry" test was removed: the smarter bot beats Cui even at level 1, so a defeat could not be forced reliably. The defeat screen and Retry were exercised for real in the Chapter 4 and Chapter 5-7 runs above (10 retries in total). "Load latest save" after a defeat is not covered by a browser test.

## UI browser tests (`tests/e2e/ui.spec.ts`): 5 passed
Menus and journal at 1024x600, 1280x720, 1920x1080 (all 11 tabs, no clipped button, no horizontal scroll, no console errors); journal spoiler boundaries; mocked gamepad in battle (D-pad, A, B) and in the world menu (Start, D-pad focus, A, B); title/save/load/resume (altar save, reload, Load slot, corrupt main file falls back to the backup, both corrupt reported, export to file and import).

## Not re-run
The Alpha 3g smoke suite (`tests/e2e/smoke.spec.ts`: 14 tests including the 10-cycle random-encounter test and the first-fight test) was **not re-run** after the Alpha 4 code changes. The full `npm run test:e2e` was therefore not run end to end for this release.

## Not tested
Human playthrough, audio, physical gamepad, any other GPU or monitor, the Windows launcher on another PC.
