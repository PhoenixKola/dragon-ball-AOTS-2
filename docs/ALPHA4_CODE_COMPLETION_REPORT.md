# Alpha 4 code completion report

Baseline: the Alpha 3g working tree (newer than `AOTS2-Namek-Saga-alpha3f.zip`). Gap audit: `docs/ALPHA4_CODE_CONTENT_GAP_AUDIT.md`. **This is a code-complete alpha, not a finished game**: art, animation, music, a human full playthrough, a physical gamepad test and long-term balance by play are still open (section 8).

## 1. What was implemented

| Area | Change |
|---|---|
| Side quests | 7 quests (`src/data/quests.ts`): Stolen Supplies, Medicine for the Elders, Lost in the Grotto, Bounty on the Patrols, Frieza's Logbook, The Ridge Ambush (the old "optional" toast, now real), Nail's Request. Quest state lives in ordinary flags (`q:`, `qp:`, `qd:`, `foe:`), so **SAVE_VERSION stays 3, no migration**. Rewards (items, Zeni, XP, training points) are paid once. 5 new interactables (sack, lost child, order log, 2 altars) |
| Point of no return | `ask` step: Continue / Cancel before Frieza's forms and before the final form; the prompt reports Dragon Balls found and open quests; Cancel changes no state and moves the player out of the trigger |
| Story logic | `party` step and `leaveHero` refill fix the broken lineups (Goku/Piccolo never joined the party; the party shrank to Gohan after Vegeta and Krillin left). Triggers that shared a footprint now have mutually exclusive conditions |
| Dialogue | chapter/flag dependent lines for Bulma, fisher, child, elder, trader, Dende, Guru, Nail, the Highlands Namekian; Dragon Radar (Bulma, Dende) reads out only unlocked ball locations |
| Journal | Story (objective, met beats only, ball hints without spoilers), Side quests (rumour / in progress / ready / done, steps, reward, honest "missable" note), Abilities (learned and next skills, combos) |
| Progression | XP scale 2.4 → 3.4, scripted fights pay 0.85, Easier mode +25% XP; skill unlocks spread (Scatter 7, Dragon Kick 8, Pride 9, Kienzan 11, Barrage 12, Kaioken Assault 17, Hellzone 19) |
| Inventory | `src/systems/inventoryOps.ts`: refused uses never consume the item (Senzu at full strength was wasted before), buy/equip/unequip rules shared with tests |
| Combat UI | skill rows show Ki, hits, status with duration, HP cost; Kaioken pip on a Super Saiyan; Help tab status guide |
| Gamepad | pad → keyboard bridge for battles, menus, dialogue (`src/systems/gamepad.ts`); logic and mocked-pad browser tests only |
| Engine fixes found by the new tests | world-scene position race (after a map change or warp the old scene could write its stale position into the state, spawning the player at the wrong place or back inside a trigger); stale canvas after a resize during boot (Alpha 3g) |
| Resupply | altars on the Landing Zone and on Namek's Last Ground |

Playable-content counts: 7 quests with 14 objectives, 7 hand-in scripts, 6 patrol fights that now matter (4 are quest objectives), 3 new altar/NPC interactions, about 70 new dialogue lines. Modelled route length (a model of walking, dialogue and fights, not a measurement): critical path ≈ 41 min, everything ≈ 57 min.

## 2. Chapter / quest / progression matrix

| Chapter | Main beats | Side content now |
|---|---|---|
| Prologue/1 | First Contact, Dende, ball 1 | Stolen Supplies, Medicine for the Elders |
| 2 | Vegeta, Cui, Dodoria, ball 2, Zarbon | Lost in the Grotto, Bounty on the Patrols, Frieza's Logbook, ship hold, Landing altar |
| 3 | Guru (+6 training points) | Logbook hand-in (+3 points), Nail's Request |
| 4 | Guldo, Recoome (Goku), Burter+Jeice, Ginyu | The Ridge Ambush |
| 5 | Nail's stand, Piccolo fuses | ball 6, resupply at the Landing altar |
| 6 | prompt, Frieza forms 1-3, Vegeta falls, prompt, final form, Krillin | none (quests close) |
| 7 | SSJ, last ground altar, ball 7, final fight, two endings | none |

## 3. Design adaptations from canon

Unchanged from earlier alphas (Vegeta/Krillin fall during the forms; Piccolo/Nail fusion; Goku's arrival during Recoome; Ginyu frog). New material is original side content (the Namekian village errands, Frieza's order log). The wishes remain narrated (no Porunga scene exists).

## 4. Balance and economy (`docs/PROGRESSION_AUDIT.md`, generated)

Levels come from the walked route, then every scripted fight is simulated 20 times at those levels with the real engine.

| Route | Levels at the finale | Skilled win rate | Notes |
|---|---|---|---|
| Critical path, normal | 20-22 | 70-100% (Ginyu 70%, Frieza 2nd form 85%, final form 90%, 100% power 80%) | casual play (no guarding) loses the big bosses: guarding matters |
| Critical path, easy | ≈ 20 | 95%+ | +25% XP, enemy damage -30%, fewer encounters |
| Everything, normal | 24-25 | ≥ 80% every fight | side quests are worth roughly +3 levels |

Outliers (not tuned away on purpose): Dodoria casual 10%, Captain Ginyu is the hardest scripted fight (body swap) and was the only one the browser bot lost below level 28. The earlier balance table assumed levels 3-6 above what the route really gives; that was corrected by raising XP, not by weakening bosses. Money: quest Zeni (≈ 1,200 total) pays for about 15 Med Kits at the trader; no sell option exists (consistent: buy-only shop).

## 5. Saves

SAVE_VERSION 3, no schema change. `tests/unit/saveCompat.test.ts` (18 tests): Alpha 3f-shaped saves from six stages (including the old broken one-person party and a save on the last ground) load unchanged, get no retroactive rewards, and can be played to the ending with and without the new quests; legacy v2 import continues to the ending; four slots (autosave + 3), backups, corrupt main file falls back to the backup, both corrupt is reported and never loaded, tampered checksum rejected, a failed (full-storage) write never damages the previous save, export/import round trip with quest flags, hostile imports rejected. Browser: altar save → reload → Load slot, corrupt-main fallback, double corruption, file export/import all pass.

## 6. Tests actually run

| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | **250 passed, 2 skipped (15 files)** (Alpha 3g baseline 155) |
| `npm run build` | OK |
| Story browser tests (`tests/e2e/story.spec.ts`, real arrow keys, E, Enter, real battles, GPU via ANGLE/D3D11) | passed in the last full run: Stolen Supplies (51 s); Chapters 1-2 from a new game through Cui (2.2 min, 0 defeats); Chapter 2→3 (2.8 min); Chapter 4 (9.4 min, 6 defeats retried); Chapters 5-7 incl. point of no return, three Frieza forms, SSJ, incomplete ending, credits (10.1 min, 4 defeats retried); Chapter 7 with all seven balls and the Porunga ending (1.8 min) |
| UI browser tests (`tests/e2e/ui.spec.ts`) | passed: menus/journal at 1024×600, 1280×720, 1920×1080 with no clipping; journal spoiler check; mocked gamepad in battle and in the world menu; title/save/load/resume/corrupt/export-import |
| Alpha 3g smoke suite (`tests/e2e/smoke.spec.ts`, 14 tests incl. the 10-cycle random-encounter test) | last full pass was on Alpha 3g; **not re-run after the Alpha 4 code changes** |
| Defeat → Retry | exercised for real inside the Chapter 4 (6 retries) and Chapter 5-7 (4 retries) browser runs; a dedicated test was removed because the bot can no longer be made to lose reliably; "Load latest save" after a defeat has no browser test |

Not tested: a full human playthrough, audio listening, a physical gamepad, other monitors/GPUs. The story browser tests used a hardware GPU through headless Chromium; no one watched the screen. The battle bot is automated (it uses the simulator's decision model through real key presses), so the browser fights prove flow and state, not fun.

## 7. Files

New: `src/data/quests.ts`, `src/systems/storyRuntime.ts`, `src/systems/inventoryOps.ts`, `src/systems/gamepad.ts`, `src/components/loading.tsx` (3g); tests `storyPath`, `quests`, `progression`, `saveCompat`, `combatRules`, `triggers`, `gamepad` (unit), `story.spec.ts`, `ui.spec.ts`, helpers in `tests/support/` and `tests/e2e/support.ts`. Changed: `scripts.ts`, `maps.ts`, `session.ts`, `menu.tsx`, `screens.tsx`, `mapTypes.ts`, `gameState.ts`, `party.ts`, `skills.ts`, `formulas.ts`, `controller.ts`, `autoplay.ts`, `App.tsx`, `WorldScene.ts`, `context.ts`, `BattleScene.ts`. Generated docs: `PROGRESSION_AUDIT.md`, `BALANCE_TABLE.md`.

## 8. Blockers that are not code

Battle sprite animation (only Goku has frame sets), new art and portraits, music/SFX quality (never listened to), Porunga cinematic art, a full human playthrough, physical gamepad test, other hardware, localisation. Code limits: title/settings still need Tab or mouse for keyboard-only focus; the world has 8 areas; Namek's last ground cannot be left once entered.
