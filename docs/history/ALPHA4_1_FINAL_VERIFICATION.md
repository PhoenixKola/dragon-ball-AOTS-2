# Alpha 4.1: final code verification and release gate

Date: 2026-10-19. Platform: Windows 11 Home (10.0.26300), Node v22.22.0, headless Chromium via Playwright 1.55 with the machine's GPU (ANGLE/D3D11). No commits, pushes or deployments were made. No images, audio, art pipeline or engine design was changed.

## Gate result: PASSED (code gate)

| Requirement | Result |
|---|---|
| Clean typecheck | `npm run typecheck`: exit 0 (`docs/test-results/alpha4_1_final_typecheck.log`) |
| Unit tests | `npm test`: **17 files, 273 passed, 2 skipped, 0 failed, 0 unhandled errors, exit 0** (`alpha4_1_final_unit.log`). The 2 skips are the calibration cells in `tests/unit/calibrate.test.ts` that only run with `CALIBRATE=1` |
| Fresh build | `npm run build`: exit 0, bundle `index-B5iA0Owr.js` (`alpha4_1_final_build.log`) |
| Complete unfiltered E2E | `npm run test:e2e` (builds first, no filters, no `.only`/`.skip`, `retries: 0`, 1 worker): **31 passed, 0 failed, exit 0, 43.7 min** (`alpha4_1_final_e2e.log`, started 17:26, finished 18:10) |
| Same source as the package | No file in `src/`, `public/` or the build config changed after that run; the rebuild for the log produced the identical bundle hash; the ZIP contains that `dist/` |

This is a **code** gate only. It says nothing about fun, balance as felt by a person, art, audio or the Windows launcher on real hardware (see "Not verified").

## What I verified in the tree (diagnosis check)
* `tests/e2e/support.ts`: the Active Guard bot reads each cue's `uid` and `impactAt`, maps the uid to the fighter's real slot, and compares against the director clock. Confirmed.
* `src/systems/battleSetup.ts` is used by both `src/app/session.ts` and the test driver; `session.ts` guards stale `busy` decrements with an `epoch` and calls `unstick()` after warps, flees and world entry. Confirmed.
* `src/systems/gamepad.ts` + `src/systems/input.ts`: both read the same pad via `firstPad()`; `clearPressed()` records a still-held A so it is not a fresh press. Confirmed.
* The previous release report said the log files exist; the uploaded 4.1 ZIP did not contain them. **This package does** (see below).

## What changed in this pass
Code changed only in tests; no game source changed.
1. **Gamepad tests (the flaky one).** Previous fix was a longer sleep (90 -> 260 ms). Replaced with state-aware synchronization: `installMockPad()` and `padPress()` in `tests/e2e/support.ts`. The mock pad counts the synthetic key events the bridge dispatches; `padPress` holds the button until the page has actually received a key, then releases and lets the page's own timer queue run twice so the bridge sees the release. If the bridge never delivers a key the test fails after 5 s with the pad's diagnostics (keys so far, mode, overlay) instead of a vague timeout later. Both gamepad tests use it. No game, encounter or physical-gamepad behaviour was changed. Focused repeats: **5 of 5 runs, both tests passed** (`alpha4_1_final_gamepad_focused.log`), then they passed again inside the full 31/31 run.
2. **`tests/unit/saveCompat.test.ts`**: one test (walks the whole story twice, about 4.7 s alone) failed once on a loaded machine at vitest's 5 s default. This was a genuine timeout, not a logic failure. The file now sets an explicit 60 s test timeout.
3. **Vitest "Timeout calling onTaskUpdate" (exit 1 despite all tests passing).** Found while running the gate: the story-simulation tests run for a minute or more of unbroken synchronous work and the worker cannot report progress, which fails the run with unhandled errors. `naturalPlaythrough.test.ts` now yields between playthroughs and `storyPath`, `saveCompat`, `quests` yield after each test. No assertion was changed or removed. Result: 0 unhandled errors, exit 0.
4. **Logs and docs.** Raw logs are now under `docs/test-results/` (index in `docs/test-results/README.md`) and are included in the ZIP; `ALPHA4_1_TEST_RESULTS.md` was corrected (below).

## Regression coverage still in the final 31/31 run
Natural-level story routes (Chapters 1-2, 2-3, 4, 5-7, 7-with-seven-balls) - 10 random world->battle->world cycles and the first scripted fight (smoke) - defeat -> Retry / Load latest save / Return to title - save and reload at a chapter boundary - prototype v2, Alpha 3f-shaped and damaged-file imports - Dragon Ball pickup feedback (smoke tests 12-14) - point-of-no-return Cancel (changes nothing, then Continue) - the incomplete ending and the Porunga ending - menus at three resolutions, journal, keyboard-only title/settings, both mocked-gamepad tests. The two chapter tests marked `BOOSTED` (levels 16 and 28) remain and are labelled as flow-only.

## Windows launcher: UNTESTED on real hardware
`START_GAME.bat` was read and checked against the source, not launched:
* checks for Node (`where node`), builds if `dist\index.html` is missing (runs `npm install` if there is no `node_modules`), then starts `tools\serve-dist.mjs` on `127.0.0.1:5173` and opens Chrome/Edge as an app window in full screen, else the default browser.
* The server half was run on this machine (`node tools/serve-dist.mjs` with `PORT=5333`): `/` returned 200 `text/html`, the bundle returned 200 `text/javascript`, a path-traversal request returned 404. That does **not** prove the `.bat`, the PowerShell browser launch, full screen or the "first run" npm path work. The README says Node 20+ is required; it was tested with Node 22.
* Launcher on another Windows machine, a machine without Node, and with a different default browser: **not tested**.

## Not verified / outstanding
Human playthrough and re-tuning; physical gamepad (mocked only); audio listening; other GPUs/monitors (software GL is about 10x slower; the story tests need a GPU); the launcher above; the one-time `npm install` path. Outstanding content, unchanged by this pass: full per-character battle animation (only Goku has frame sets), missing portraits, transformation animations, Namek world polish, music quality. Length is still the short model-based 40-60 minutes; the optional 2-8 hour expansion in `docs/OPTIONAL_STORY_EXPANSION_ROADMAP.md` was **not** implemented and needs your decision first.

## Release files
`release/AOTS2-Namek-Saga-alpha4-1-final-verified.zip` (one root, fresh `dist/`, `src/`, `tests/`, `public/`, `docs/` with logs, lockfile, `START_GAME.bat`). Earlier release ZIPs in `release/` were not touched.
