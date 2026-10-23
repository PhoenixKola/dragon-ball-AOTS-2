# Alpha 3d: first-fight browser test stabilised

## Cause
The test "new game -> intro -> exploration -> first scripted fight ..." held ArrowRight and waited for *any* dialogue. On the shore map, `WorldScene.step()` counts steps in encounter zones and can roll a normal random encounter before the player reaches the scripted `shore_scouts` trigger (x=35). A random battle then started instead of the scripted ambush and the wait timed out. This was a test-timing race, not a gameplay bug.

## Fix (test only; no gameplay or source change)
`tests/e2e/smoke.spec.ts`, first-fight test only:
- Waits for `window.__world` to be an active scene and `__session.mode === 'world'`, then calls the existing `WorldScene.debugNoEncounters()` hook (no new switch). Random encounters stay enabled in the game and in every other test.
- Walking is still real keyboard input across the real map; ArrowRight is released in a `finally`.
- The wait now accepts a dialogue or a battle, then asserts it is the intended one: mode is `world`, the first line contains "By order of Lord Frieza" (script `shore_scouts`), `x > 30`, and `scouts1` is still unset. A random battle or wrong dialogue fails with a JSON diagnostic.
- After the fight, asserts the results screen is title `First Contact` with outcome `victory`, then the existing scouts1 / wins / zeni / save / reload / Continue checks.
- No retries, skips or sleeps were added.

## Unchanged and still active
- "world -> battle -> results -> world ... (10 cycles)" still uses real random encounters.
- Dragon Ball first-pickup checks (unit script-order checks and the Ball 7 SFX/toast/replay browser test) are untouched.

## Also in this working tree since Alpha 3c (Dragon Ball pickup feedback fix)
`src/data/scripts.ts` (no premature `set: ballN`; `{ ball: N }` owns the flag), `src/app/App.tsx` (`window.__audio` test handle), `tests/unit/dragonballs.test.ts`, `tests/unit/story.test.ts`, Ball 7 browser test.

See `docs/QA_REPORT.md` for the verification results.
