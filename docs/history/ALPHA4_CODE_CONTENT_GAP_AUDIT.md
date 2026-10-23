# Alpha 4 code/content gap audit

**Baseline:** the local working tree after Alpha 3g (React 19 + TypeScript + Phaser 3 + Vite, save version 3). It is newer than `AOTS2-Namek-Saga-alpha3f.zip` (3g adds the layout/facing/menu fixes and the new base-Goku frames); no other newer source existed. Audited from the source, not from older documentation. Where a gap was found and fixed in this pass the right-hand column says so; "open" means it is still a limitation.

## 1. What already existed (not duplicated)

| Area | Already in Alpha 3g |
|---|---|
| World | 8 maps with collision and exits, chests, 3 altars (save + full heal), 1 healer, 1 shop, random encounters with per-map tables, visible patrols |
| Story | prologue + 7 chapters, 16 scripted fights, 2 endings; `Step` interpreter (`say/set/battle/join/leave/warp/cutscene/transform/ball/...`) |
| Combat | Ki, per-fighter Rage, Sparking, Active Guard, statuses, charge/interrupt, combos, boss phases, Kaioken, SSJ |
| Progression | level 1-30, 3 training points per level, free reset, 2 capsule slots, XP split (half to the bench) |
| Menus | Party, Skills, Training, Capsules, Items, Combos, Journal, Map, Save/Load, Settings, Help |
| Saves | 3 slots + autosave, backups, checksum, strict validation, v2 migration |
| Dragon Balls | seven optional-collection flags (`ball1..7`), once-only pickup feedback, two endings |

## 2. Chapter-by-chapter playable content (as found)

| Chapter | Real playable beats (found) | Corridor/boss-chain? |
|---|---|---|
| Prologue (Shore) | Bulma, 1 NPC, 2 crates, First Contact fight (tutorial), patrol after the fight | corridor with one fight |
| 1 Village | Dende fight, ball 1, village NPCs (kid, elder, trader, healer, altar), 2 chests | **mostly dialogue**: every NPC had one fixed line |
| 2 Landing zone | Vegeta joins, Cui, Dodoria, 2 patrols, supply crate, hold (2 lockers, ball 5, 2 guard patrols), grotto (2 chests, ball 2), Zarbon | boss chain with side rooms; patrols had no purpose |
| 3 Guru | Guru scene (+6 training points), Nail (one line), ball 3, chest | one cutscene |
| 4 Ginyu Force | Guldo, Recoome (survive, Goku arrives), Burter+Jeice, Ginyu, one NPC with a toast "optional", 2 chests, ball 4 | **pure boss chain**, the "optional quest" was a toast |
| 5 Last wish | Nail vs Frieza (survive), Piccolo fuses, ball 6 | one scene |
| 6 Tyrant | three Frieza forms chained in one script, Vegeta falls | **no choice, no warning** |
| 7 Legend | final form, Krillin falls, SSJ cutscene, core, ball 7, final fight, epilogue | no healer or save in the last area |

## 3. Gaps found and what was done

| # | Gap (verified in source) | Status |
|---|---|---|
| 1 | No quests: NPCs had one fixed line, nothing to do with patrols, the hold, the grotto or Nail | **Fixed**: 7 side quests (`src/data/quests.ts`), flag-based, journal tracker |
| 2 | Journal showed only the objective and a list of future story beats (spoilers) | **Fixed**: story / side quests / abilities pages, only met content shown, Dragon Ball hints only for places already unlocked |
| 3 | The "point of no return" was a line of objective text; the Frieza sequence started on touch and could not be cancelled | **Fixed**: Continue/Cancel prompts (`ask` step) before the forms and before the final form; Cancel changes no state and moves the player out of the zone |
| 4 | Last two areas had no heal or save; final fights had no resupply path | **Fixed**: altars in the Landing Zone and on Namek's Last Ground |
| 5 | Chapter order assumed a party that did not exist: Goku and Piccolo "joined" but were never put in the party (3 seats full); after Vegeta and Krillin left, the party was just Gohan | **Fixed**: story lineup step (`party`), `leaveHero` refills seats |
| 6 | Balance table assumed levels 3-6 above what the route gives (critical path reaches Lv 18 at Frieza, table said 22-24) | **Fixed by data**: XP scale 2.4 → 3.4, scripted reward 0.7 → 0.85, easy mode +25% XP; numbers in `docs/PROGRESSION_AUDIT.md` |
| 7 | All hero skills unlocked by level 7, so no new move ever arrived after chapter 2 | **Fixed**: unlock levels spread 8-19 (Dragon Kick 8, Kienzan 11, Barrage 12, Kaioken Assault 17, Hellzone 19); new moves announced on level-up and in the journal |
| 8 | `story.test.ts` "playthrough" visits any available trigger anywhere with battles auto-won | **Replaced as proof** by `tests/unit/storyPath.test.ts` (real collision pathing, real trigger rules, chronological flags); the old test is kept and renamed "symbolic" |
| 9 | Item use outside battle wasted items (Senzu at full strength, items on a full bar) and the logic lived in the UI-bound Session | **Fixed**: pure `inventoryOps.ts` refuses before consuming; tested |
| 10 | Ally idle poses drawn looking away from the enemy; Kaioken status invisible on a Super Saiyan | **Fixed** (3g facing table; Kaioken pip on SSJ) |
| 11 | Dragon Ball hints in the journal named Namek's Last Ground from the start (spoiler) | **Fixed** (`BALL_KNOWN` conditions) |
| 12 | Two story triggers (Cui and Frieza) overlapped on the Landing Zone and relied on story order only | **Fixed**: explicit mutually-exclusive conditions; footprint test for every map |
| 13 | Gamepad: world movement and interact only; menus and battles were keyboard/mouse | **Partly fixed**: pad → keyboard bridge for battle, menus, dialogue; logic and a mocked-pad browser test only, **no physical controller tested** |
| 14 | Settings, title and several screens had no keyboard focus navigation | **Open**: arrows move focus on pad-driven screens; the title/settings still rely on Tab/mouse for a keyboard-only player |

## 4. Progression table (found → now)

| Hero | Joins | Level at joining (critical path) | Skills found at join | Now |
|---|---|---|---|---|
| Gohan | start | 5 | Masenko, Dragon Kick (Lv 4) | Dragon Kick at 8 |
| Krillin | start (dies in ch. 6) | 5 | Solar Flare, Kienzan, Scatter (Lv 5) | Scatter 7, Kienzan 11 |
| Vegeta | ch. 2 | ≈ 8 | Galick, Barrage, Saiyan Pride | Pride 9, Barrage 12 |
| Goku | ch. 4 (Recoome) | ≈ 15 (party average) | Kamehameha, Kaioken, Kaioken Assault (Lv 6) | Assault 17; SSJ after ch. 6 |
| Piccolo | ch. 5 (fused with Nail) | ≈ 17 | Special Beam, Regenerate, Hellzone (Lv 7) | Hellzone 19 |
| Dende, Nail | guests | n/a | fixed lists | unchanged (not playable) |

Rage Arts and combos: unchanged (combos unlock with story flags: Vegeta, Goku, Piccolo). Capsules: 2 slots; 10 capsule/consumable types; two come from chests, six from shop/quests.

## 5. Save, softlock and sequence risks examined

| Risk | Result |
|---|---|
| Event replay after load | Triggers are guarded by `not` flags (test: every trigger has one); quest rewards are `qd:` flags, replay is a no-op (test) |
| Duplicate rewards | Zeni, XP, items, points, combos, balls all idempotent (tests in `quests.test.ts`, `dragonballs.test.ts`) |
| Irreversible transitions | Only the Frieza confrontation; now guarded by a prompt; the journal states it; side quests are listed as ending there |
| Sequence breaks | Exits locked by flags (test walks the real map graph); a player can sidestep a story trigger on the Highlands but cannot get past the next one |
| Impossible backtracking | After Piccolo joins the player can still walk back to every area (tested in the route) |
| Wrong party states | Fixed (see 5 above); `setParty` filters invalid ids |
| Stuck inputs | Browser tests release keys in `finally`; the pad bridge sends key-up with every key-down |
| Finale return constraints | The last ground has an altar (heal + save) and the last ball cannot start the fight |
| Old saves | Quest state lives in `flags`: **SAVE_VERSION stays 3, no migration needed**; Alpha 3f fixtures, including the old broken party shapes, load and finish (tests) |

## 6. Code-level UI gaps

Skill descriptions now show Ki cost, hits, statuses with duration and HP cost; combo rows give the exact reason they are blocked (already existed); the Help tab gained a status guide (Stun, Blind, Seal, Time-stop, Counter, Sparking, Kaioken, Possessed, Defend, Guard grades, charge interrupt at 16%). The party tab explains story-forced squads and half-XP for the bench. Menu clipping at 1024×600, 1280×720 and 1920×1080 is covered by browser tests (the Alpha 3f fix is preserved).

## 7. Not in scope or still missing (see the completion report)

New art and animation, music/SFX quality, full-length human playtest, physical gamepad test, Porunga cinematic (the wishes remain narrated), more maps (the world is still 8 areas), localisation. The game is a code-complete alpha, not a finished commercial RPG.
