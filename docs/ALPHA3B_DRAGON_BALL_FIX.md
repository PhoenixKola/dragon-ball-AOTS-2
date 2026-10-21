# Alpha 3b: Dragon Ball progression fix

## Problems fixed
1. `ball` script steps did `balls = max(balls, starNumber)`, so collecting only Ball 5 showed 5/7 and Ball 7 alone showed 7/7. The story test copied the same logic, so it could not catch this.
2. The Journal drew a consecutive row of dots from the count, not the specific stars owned.
3. The epilogue narrated "Porunga granted the wish" regardless of what the player had collected.
4. A `|| true` in the map test made the placement assertion meaningless.

## Decisions
- **Ownership** is the flags `ball1`..`ball7`, the single source of truth (`ownedBalls`, `collectBall`, `syncBalls` in `src/systems/gameState.ts`). `GameState.balls` is only a cached count recomputed from those flags (on pickup, on `setFlags`/`clearFlags`, on save validation and on legacy migration). `SAVE_VERSION` is unchanged because the saved shape is unchanged.
- **Old or inconsistent saves:** the stored count is discarded in memory and recomputed from flags. Nothing is invented: a save that says 7 but has one flag loads as 1. Loading never writes, so untouched saves stay as they are; the next save backs up the previous file (existing `writeSlot` behaviour). Legacy v2 imports derive the count from the checkpoint flags and ignore the prototype's count (its original is still backed up and untouched).
- **Collecting all seven is optional.** Ball 1 stays the scripted Dende rescue (not a map pickup). Making it mandatory would require backtracking to Ridge/Hold/Landing after Frieza's final form, which warps the party to the collapsing Namek with no exits, so it would either trap the player or force a story rewrite. Instead:
  - the epilogue branches: all seven flags => Porunga is summoned and the wish is narrated; otherwise Dende says Porunga could not be summoned and the wishes wait;
  - the pickup toast names the actual star ("Five-Star Dragon Ball obtained (1/7)");
  - the Journal shows owned stars (★n) vs missing (·n), with a location hint per missing ball and a note that the finale has no way back;
  - from Piccolo joining until the Frieza fight starts, the objective text says the missing balls (1 to 6) can still be found first. Ball 7 is only on Namek's Last Ground (after the Super Saiyan unlock, away from the fight trigger).
- No playable Porunga sequence was added (out of scope).

## Changed files
`src/systems/gameState.ts`, `src/systems/save.ts`, `src/app/session.ts`, `src/data/scripts.ts`, `src/components/menu.tsx`, `src/app/styles.css` (earlier Items fix, preserved), `tests/unit/story.test.ts`, `tests/unit/dragonballs.test.ts` (new), `tests/e2e/smoke.spec.ts`, docs (`QA_REPORT.md`, `README.md`, `ALPHA3B_FILE_LIST.md`, this file).

## Tests added
Unit (`dragonballs.test.ts`): only-Ball-5 => 1 owned; replay never increments; invalid numbers rejected; any order of seven => 7, one missing => 6; cleared flag lowers the count; save round-trip, export/import, tampered count, out-of-range count, slot write/read with backup, legacy migration with a bogus count; real `condMet` checks for final-battle/epilogue gating, Ball 7 not overlapping the fight trigger, ending text matches ownership, pickups gated by their own flag. `story.test.ts` now uses the real `collectBall` and replaces the `|| true` line with a check that balls, chests, NPCs and foes stand on walkable tiles.
E2E: real `E` interact picks Ball 7 (6 -> 7, fight not started, replay does nothing); the final battle starts with only 3 balls owned.

Not done: no human walkthrough of balls 4 to 6 on their maps (reachability is covered by the existing collision test only).
