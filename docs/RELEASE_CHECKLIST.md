# Release checklist (status honest at time of writing)

- [x] `npm run typecheck`, `npm test` (unit/integration), `npm run build`
- [x] `npm run test:e2e` (Playwright/Chromium: title, new game, walk, real first fight, save/reload/continue, hostile import, legacy migration, menus, SSJ cutscene)
- [x] Offline: `dist/` has no CDN references (fonts bundled); server binds 127.0.0.1
- [x] Save migration + strict import validation
- [ ] **Full human playthrough start to ending: NOT DONE** (only automated bot simulations and a symbolic story walk)
- [ ] Hand-finished animation frames (blocked: assets)
- [ ] Studio music (blocked)
- [ ] Windows `START_GAME.bat` run on a clean machine without dev tools (needs Node 20+; not tested on another PC)
- [ ] 2560x1440 and low-end laptop frame-rate measurement on real GPUs (only software-GL screenshots)
- [~] Gamepad: pad-to-keyboard bridge for battles, menus and dialogue (Alpha 4) is logic- and mock-tested only; **no physical controller was tested**
- [x] Alpha 4: real-keyboard browser walkthroughs of every chapter, both endings, defeat/retry, save/load/resume (see `docs/ALPHA4_TEST_RESULTS.md`); automated bot, not a human
- [x] Beta 3: full unit and e2e suites re-run on the final tree (see `docs/beta3-logs/`)
