# Release acceptance checklist

| Gate | Current review status |
|---|---|
| Typecheck | Passed on current tree |
| Production build | Passed; Vite warns about the >2 MB minified JavaScript chunk |
| Unit suite | **365 passed, 2 skipped** across 26 files |
| Active runtime art audit | **485 battle files + 9 backgrounds; 0 missing, 0 invalid, 0 duplicate drawings** |
| Animation renderer E2E | **4 passed**: party/guest melee, enemy melee, 24 idle loops, and core-party charge/special sequences |
| Broader browser suite | Prior 41-test run passed before final animation rollout; not rerun on current tree |
| Player ZIP | [Incomplete RC ZIP](../release/AOTS2-Namek-Saga-experience-overhaul-incomplete-RC-windows.zip), **90.1 MiB**, 1,232 entries. Integrity passed; contains 232 new runtime frames and `README-PLAY.txt`; dev art/evidence, `.git`, `legacy`, `node_modules`, ROM, and `.env` excluded. |
| Final ZIP launched through bundled Windows runtime | Not rechecked after final rebuild; BAT double-click remains unverified |
| Other PC, physical controller, GPU/high DPI | Unverified |
| BGM/SFX listened to by ear | Unverified; no audio production/mix pass in this batch |
| Owner playthrough: new game → credits → wishes → Cooler | Unverified; automated natural progression is not a human playthrough |
| Import of owner's existing save | Migration tests pass; personal save unverified |
| Git state | First batch pushed as `f2c3717` at the user's request. Animation batch is local, uncommitted, and unpushed. |

The animation batch is complete for the poses listed in the report, but the overall overhaul remains an **incomplete RC**, not a final v1 sign-off.
