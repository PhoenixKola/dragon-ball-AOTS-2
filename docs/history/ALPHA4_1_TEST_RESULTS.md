# Alpha 4.1 test results (what was actually run)

> **Superseded for the release gate by `docs/ALPHA4_1_FINAL_VERIFICATION.md`**: a later complete unfiltered `npm run test:e2e` run on the final source passed **31 of 31**. The tables below describe the earlier pass, including the one flaky gamepad failure and the statement that no 31/31 run existed at that time. Raw logs are in `docs/test-results/` (index: `docs/test-results/README.md`) and are included in the release ZIP.

Machine: Windows 11, headless Chromium through Playwright 1.55. Story, flow and UI tests ran with the real GPU (ANGLE/D3D11); smoke uses software GL. All browser play is automated (real key presses, nobody watching). **Nothing here is a human playthrough.** Logs are in `docs/test-results/alpha4_1_*.log` (earlier Alpha 4 logs untouched).

## Baseline before any change (unmodified Alpha 4 tree)
| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | 250 passed, 2 skipped (15 files) |
| `tests/e2e/smoke.spec.ts` (the 14 tests that were not rerun in Alpha 4) | **14 passed (4.4 min)** (`alpha4_1_smoke_baseline.log`) |

## Final tree
| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | **273 passed, 2 skipped (17 files)**. The 2 skipped are the calibration cells gated behind `CALIBRATE=1`. Includes the natural-playthrough (15) and softlock (8) suites |
| `npm run build` | OK |
| `npm run test:e2e` (full: flows, smoke, ui, story) | **30 passed, 1 failed (37 min)**, log `alpha4_1_e2e_final.log`. The one failure was the mocked-gamepad overworld-menu test: its 90 ms button hold could be missed by the 16 ms bridge poll on a busy page (key log shows lost presses). The hold was lengthened and that spec (both gamepad tests) then passed 3 times in a row (15-19 s each). **I did not rerun the whole 37-minute suite after that one test-timing fix**, so there is no single run with 31/31 on the final tree. |
| Suite after earlier fixes (previous full run) | 29 passed, 2 failed: the deliberate-defeat test (the fixed bot beat Dodoria at level 1, so the test now forces the defeat) and the credits-to-title step (see the report: the auto-focused Continue) - both fixed and rerun green |

### Browser tests by kind (names say which)
| Test | Kind | Result | Defeats retried |
|---|---|---|---|
| Stolen Supplies quest chain | natural | pass (50 s) | 0 |
| Chapters 1-2 from a new game | natural, from a new game | pass (2.2 min) | 0 |
| Chapter 2-3 (items, Grotto, Zarbon, Guru) | **BOOSTED level 16** | pass (2.5 min) | - |
| Chapter 4 (Guldo ... Ginyu) | **BOOSTED level 28** | pass (3.7 min) | - |
| Chapter 2-3 at earned levels (rest at altars, Dodoria, Zarbon, Guru) | **NATURAL** | pass (2.7 min), levels 11/11/11 | 0 |
| Chapter 4 at earned levels | **NATURAL** | pass (5.3 min), levels 17-18 | 0 (1 in an earlier run) |
| Chapters 5-7 incl. point of no return (Cancel changes nothing, then Continue), forms 1-3, final form, SSJ, incomplete ending, credits | **NATURAL** | pass (5.4 min) | 0 |
| Chapter 7 with all seven balls and the Porunga ending | **NATURAL** | pass (1.6 min) | - |
| Defeat screen: Retry, Load latest save (busy counter back to 0, exits still work), Return to title | flow | pass (36 s) | forced on purpose |
| Save at a chapter boundary, reload, load slot: state identical, story continues | flow | pass (22 s) | - |
| Prototype v2 import, Alpha 3f-shaped file import, damaged file refused | flow | pass (42 s) | - |
| UI (menus at 3 resolutions, journal, gamepad x2, save/load/corrupt/export, keyboard-only) | ui | 6 of 6 passed individually; the overworld gamepad one flaked once in the full run and was fixed as above | - |
| Smoke (14 incl. the 10-cycle random world -> battle -> world and the first fight) | smoke | 14 passed | - |

"Real-level vs boosted": the two remaining BOOSTED tests only prove flows and scripts; the NATURAL tests used a save produced by really playing the route with the engine and spending points/capsules like a player. These do **not** show the game is fun or fairly hard for a person.

## Simulated players (unit, `docs/NATURAL_PLAYTHROUGH.md`)
See the report. Highlights: 4/4 + 4/4 (Normal, attentive/average), 7/8 (Normal, never guards), 8/8 (Easy, never guards), all 2/2 routes for everything; item ledger consistent for every run.

## Not tested
Human playthrough; physical gamepad (mocked pad only); audio; other GPUs or monitors; the Windows launcher on another PC; the whole 37-minute browser suite after the final test-timing fix.
