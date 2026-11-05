# Active asset routing

`src/engine/scenes/BootScene.ts` loads battle stills from `src/data/spriteManifest.generated.ts`, existing Goku Kaioken/SSJ frames from `src/data/powerupSprites.generated.ts`, and the authored sequences named by `src/data/battleAnimationFrames.ts`. `ATTACK_FRAMES`, `IDLE_FRAMES`, `POSE_FRAMES`, and `ANIMATION_PROFILE` in that module are the combat animation source of truth.

All **24 combat actor/form identities** have four distinct generated melee drawings and four distinct idle drawings: the five core heroes, Nail, Cui, Dodoria, both Zarbon forms, Guldo, Recoome, Burter, Jeice, Ginyu, Frieza Force soldier, Trunks base/SSJ, Frieza forms 1–5, and Cooler. The five core heroes also have four-frame charge loops and four-frame signature-release sequences. Runtime cuts are in `public/assets/reviewed/actors/`.

Attack playback is 40 fps, nonlooping, and holds its last drawing. Frame 3 is the melee contact pose; clip events begin before the combat engine's hit marker. Idle loops run at 5 fps, charge loops at 8 fps, and special-release sequences at 30 fps. The renderer only displays frames; the combat engine still owns damage and skill VFX. The five signature-release body sequences are actor-specific but shared across that hero's special skills; the existing skill VFX retain move identity.

Generated contact sheets and per-pose JSON metadata are under `art-sources/production/<actor>/`. `tools/integrate_strike_contact.py <actor> --pose <idle|attack|charge|special> --cells <four zero-based indices>` cuts supported contact sheets into approved canvases. Runtime/package output excludes `art-sources/` and `evidence/`. `npm run audit:runtime` checks missing files, nonempty alpha, duplicate drawings, canvas dimensions, and foot anchors for all active new sequences.

The nine local title/battle backgrounds load through `stageBackgrounds.ts` and `BootScene.ts`. Existing art archives stay untouched because dynamic usage has not been ruled out. Exact actor/form/pose frame counts are listed in [ANIMATION_COVERAGE.csv](ANIMATION_COVERAGE.csv); actor-by-actor acceptance is in [ART_ACCEPTANCE_FINAL.csv](ART_ACCEPTANCE_FINAL.csv).
