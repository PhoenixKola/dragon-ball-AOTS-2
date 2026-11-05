# Experience overhaul review report — animation batch complete, overall RC incomplete

## Completed in this local batch

- Used native Codex image generation to create real transparent character contact sheets, then cut each onto the actor's approved runtime canvas with stable scale and foot registration.
- Added four distinct melee drawings and four distinct looping idle drawings for **all 24 combat actor/form identities**: Goku, Gohan, Krillin, Vegeta, Piccolo, Nail, Cui, Dodoria, both Zarbon forms, Guldo, Recoome, Burter, Jeice, Ginyu, Frieza Force soldier, Trunks base/SSJ, Frieza forms 1–5, and Cooler.
- Added four-drawing charge loops and four-drawing special-release sequences for the five core heroes. The new body art runs with the game's existing skill-specific beams/projectiles and damage events. Each hero's special body sequence is shared across that hero's skills; individual VFX preserve move identity.
- Registered attack, idle, charge, and special frames in `src/data/battleAnimationFrames.ts` and extended the renderer, runtime preloader, frame audit, coverage report, and tests. Melee runs at 40 fps and holds its last drawing; idle is a 5 fps loop; charge is an 8 fps loop; signature release is 30 fps and holds the release drawing. The combat engine remains the sole owner of damage.
- Preserved independent Goku Kaioken/SSJ routes and Trunks SSJ status routing. Added actor-level art acceptance and asset-use documentation.
- The previously pushed first batch supplies nine distinct Namek title/battle backgrounds and the offline Windows package builder. It is commit `f2c3717` on `main`. This second batch remains local and uncommitted.

## Verification on the current source and assets

- `npm run typecheck`: passed.
- `npm run build`: passed. Vite retains its >2 MB minified JavaScript chunk warning.
- `npm test`: **365 passed, 2 skipped** across 26 files.
- `npm run audit:runtime`: **485 active battle files + 9 backgrounds; 0 missing, 0 invalid, 0 duplicate drawings**. New attack/idle/charge/special frames match their actor canvas and foot line.
- `npx playwright test tests/e2e/partyAnimation.spec.ts`: **4 passed**. Chromium advanced party/guest melee sequences, every Namek/postgame enemy strike, closed idle loops for all 24 actor/form identities, and charge/signature-release frames for all five core heroes.
- `docs/ANIMATION_COVERAGE.csv` reports 222 actor/form/pose rows with real exported frame counts. Source contact sheets, cut metadata, and Phaser captures are in `art-sources/production/` and `evidence/overhaul/`; both dev-only folders are excluded from the player ZIP.
- Final player archive: [AOTS2-Namek-Saga-experience-overhaul-incomplete-RC-windows.zip](../release/AOTS2-Namek-Saga-experience-overhaul-incomplete-RC-windows.zip), **90.1 MiB**, 1,232 entries. ZIP integrity passes; it contains 232 new runtime actor frames and `README-PLAY.txt`, and excludes source art, evidence, `.git`, `legacy`, `node_modules`, ROMs, and `.env` entries.

## Remaining before the master prompt can be called complete

This batch delivers broad real melee/idle motion and core-party charge/special body sequences. Guard, hurt, victory, and KO remain mostly single poses; the five core special body sequences are reused across each hero's skills; enemy signature-special body sequences are still static. World-map art, most menu/HUD refinement, authored audio and mix, cinematic staging, and the full responsive screen acceptance pass remain open. The earlier broad browser suite predates this final animation rollout; the current tree has the focused animation E2E suite above, not a fresh full browser-suite run.

The final ZIP's archive integrity and contents were verified. Its Windows BAT launcher was not re-launched after this rebuild. Another PC, physical controller, GPU/high-DPI behavior, audio-by-ear, owner save import, and a human new-game-to-Cooler playthrough remain unverified; see `docs/RELEASE_ACCEPTANCE_CHECKLIST.md`.

This is an **incomplete RC** for the current animation batch, not a final whole-game sign-off. No second-batch commit or push was made.
