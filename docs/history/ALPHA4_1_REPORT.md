# Alpha 4.1 report: gameplay, progression and regression pass (code only)

Version `1.0.0-alpha.4.1`. Scope exactly as briefed: gameplay, progression, tests, small UX/softlock fixes, packaging. **No sprites, animations, backgrounds, VFX, audio assets or art pipeline were touched, no combat-engine rewrite was done, and nothing was committed, pushed or deployed.** Test numbers are in `docs/ALPHA4_1_TEST_RESULTS.md`; the simulated-player evidence is in `docs/NATURAL_PLAYTHROUGH.md` (generated).

## 0. Baseline check
The uploaded Alpha 4 ZIP could not be diffed: `release/AOTS2-Namek-Saga-alpha4-code-complete.zip` was in `release/` when I started and was gone later (the folder changed at 13:55; nothing I ran touches `release/`; I did not delete it and could not find a copy). Instead I verified the working tree before changing anything: `npm run typecheck` clean, `npm test` **250 passed / 2 skipped** (the number the Alpha 4 report states) and the full **14-test smoke suite passed (4.4 min)** on the unmodified Alpha 4 build. So the tree matched the report's claims at the start.

## 1. What the evidence showed (and what it did not)
* The Alpha 4 route model healed the party fully between fights, auto-won every fight, never spent training points, never wore capsules and never used a shop. Its "natural" numbers were therefore not what a player has.
* The **browser battle bot never pressed a guard key.** It read `slot` and `now` from guard cues that only carry `uid` and `impactAt`, so the comparison was `NaN` and false. That is why the Alpha 4 story tests needed levels raised to 26-28 ("the bot loses Ginyu below 28"): it was playing with Active Guard off. This also means the Alpha 4 claim that the bot "presses Active Guard keys on cue" was wrong.
* After fixing that, the same bot beats Dodoria, Captain Ginyu and the rest at earned levels in a real browser (see the test results).

## 2. Natural-progression validation (requirement 2)
`tests/unit/naturalPlaythrough.test.ts` (new) walks the whole story on the real collision grid and plays **every** fight with the real combat engine from the party's real state:
* levels only from XP (random encounters, boss XP, quest XP); training points spent by the simulated player; capsules found or bought; shopping at the Aojan trader (modelled when entering the village); HP/Ki carried over; defeat uses the game's Retry rule (extracted to `src/systems/battleSetup.ts` so the game and tests share it); no menu inside a boss's chain of forms; before a boss trigger the player rests at the map's altar, or drinks kits if there is none.
* An **item and Zeni ledger** records every change by source; the test asserts the final bag equals the starting bag plus the ledger, that items enter only through chests, quest scripts, battle drops, the trader (paid in Zeni) or a retry that returns consumed items, and that nothing is invented.
* Matrix: critical path / partial Dragon Balls / everything x Normal and Easy x three guard-skill styles (*attentive* 35/35% perfect/good, *average* 15/30%, *casual* never guards) x several seeds.

Results (details and per-fight tables in `docs/NATURAL_PLAYTHROUGH.md`):
| | Result |
|---|---|
| Critical path, Normal, attentive / average | 4/4 and 4/4 reach the ending; 0.3 defeats per run on average (max 1) |
| Critical path, Normal, **never guards** | **7 of 8 finish**; the one that did not stalled on a named boss (Captain Ginyu) after 13 defeats. Normal is tuned for players who land some guards: this is the documented price, Easy exists for them |
| Critical path, Easy, never guards | 8/8 finish, 1.1 defeats per run |
| Everything (all 7 quests, all balls), any style | all finish, 0-1 defeats |
| Partial Dragon Balls | finishes, 0.5 defeats |
| Final levels | critical path about 21-22 (Gohan 22, Goku 21, Piccolo 22), everything about 24-25, cap 30 (nobody is boosted) |
| Per-attempt win odds per scripted fight, Normal critical path | attentive >= 85%, average >= 62%, never-guard >= 24% on average over the routes (asserted in the test as >= 70% / >= 55% / >= 15%) |

Browser tests that start from raised levels are **named `BOOSTED`** (two remain: Chapter 2-3 at level 16 and Chapter 4 at level 28, kept to exercise the item/quest flows with a short fight); everything else that starts from a save uses a route that was actually played (`fixture({ natural: true })`). See the test names.

**Not claimed:** these are simulated players with a modelled guard skill. No human has played the game, so fun and real difficulty are unverified.

## 3. Balance changes (targeted, evidence-based, nothing global)
Measured with the improved bot on real states from 5-12 routes per variant (see section 5 for the bot).
| Change | Why |
|---|---|
| Dodoria HP 2900 -> 2480, ATK 480 -> 456 | first mandatory wall; some earned states left a never-guarding player at ~0%. Now skilled/average ~95%, never-guard >= 20% in the worst state |
| Captain Ginyu HP 6110 -> 5800, ATK 195 -> 185 | hardest scripted fight stays the hardest (attentive ~85-90%) but average guarders are no longer at ~50% |
| Frieza second form HP 11100 -> 9990, ATK 460 -> 405 | an outlier: average guarder 15%, because the player cannot open the menu inside the chain of forms |
| New `restore` story step: after Frieza's first and second form Dende mends **half** of the party's missing HP/Ki (toast + a line) | the attrition across the chain, not the single fight, was the wall (never-guard odds on form 2/3 were 34%/52% carried vs 78%/97% rested) |
| First Contact and Defend Dende can no longer be fled (`allowFlee: false`) | fleeing silently skipped their win steps |
Not changed: XP, shops, items, Easy mode, Active Guard windows, all other enemies. `docs/BALANCE_TABLE.md` and `docs/PROGRESSION_AUDIT.md` are regenerated; the progression audit now uses real states instead of default-bag, no-points parties.

Tried and rejected on evidence: making the bot Defend when a charge cannot be broken (attacking to break the charge won more fights at every guard skill).

## 4. Test-bot improvements (requirement 2)
`choose()` (shared by the simulator, the audits and the browser bot) now heals earlier (below 50% instead of 35%), uses Mega Med Kits (it never did), and was compared A/B on real states. It still uses only what a person can see. The browser bot's guard cues are fixed (see section 1) and presses are timed from the battle clock. No test-only invulnerability or hidden information exists.

## 5. Softlocks and UX
* **Fixed: stuck busy counter after "Load latest save" from the defeat screen** (found by reading `Session`, not reproduced before the fix: the aborted script/patrol/encounter flow still decremented `busy`, leaving it at -1, which is truthy, so exits, triggers and interactions would be ignored). Hard resets now bump an `epoch` and stale flows no longer touch the counter. Regression test: browser `flows.spec.ts` (asserts `busy === 0` and that an exit still works after the load).
* **Fixed: flee push-back could place the player inside a wall** (patrol flee pushed 1.6 tiles ignoring collision). Candidate spots are now checked against the real solids, and every world entry runs `unstick()` (nearest free spot). A data audit test proves every spawn, exit target and scripted warp is walkable.
* **Fixed (found in testing my own change): Enter on the credits screen could press the title's newly auto-focused Continue**, reloading the final battle. Initial title focus is now delayed.
* Gamepad bridge audit: standard mapping documented in `src/systems/gamepad.ts`. Fixed a mismatch (world movement read `getGamepads()[0]`, the menu bridge read the first *connected* pad) and a duplicate-action risk (a pad A still held when a dialogue closed counted as a new press in the world). Unit-tested with a mocked navigator. **No physical gamepad was tested.**
* Keyboard: arrow keys (and Esc to step back) now work on the title, Load and Settings screens and in menus; New Game/Continue gets focus on the title. Sliders and selects keep their native arrows. No artwork or layout changed.
* Retreat, Retry, resupply on the last ground (altar present, no exit by design), map warps/reload and story party changes are covered by the new `softlocks.test.ts`, `flows.spec.ts` and the existing story tests.

## 6. Regression coverage added
`tests/unit/naturalPlaythrough.test.ts` (15), `tests/unit/softlocks.test.ts` (8), `tests/e2e/flows.spec.ts` (3: defeat -> Retry / Load latest save / Return to title with a deliberate, non-random defeat; save at a chapter boundary + page reload + load; Alpha 3f-shaped file, prototype v2 and a damaged file imports), a keyboard-only UI test, natural-level story tests. The point-of-no-return Cancel test now asserts that Cancel changed nothing against the pre-prompt state; the earlier `.catch(() => undefined)` calls that could hide failures were removed.

## 7. Length (requirement 5)
Modelled critical path about 40 minutes, everything about 58 minutes (a model of walking, dialogue and fights, not a stopwatch). It is a short Namek Saga, not a 10-20 hour RPG. `docs/OPTIONAL_STORY_EXPANSION_ROADMAP.md` lists concrete optional content by tier; none of it was added.

## 8. Still open
Human playthrough and re-tuning; physical gamepad; other GPUs/monitors; the Windows launcher on another PC; audio listening; economy (Zeni piles up with only one shop; roadmap A4); a never-guarding player on Normal can stall on Captain Ginyu at low level (documented, Easy exists). The earlier real-key flows use a GPU through ANGLE/D3D11; software GL is about 10x slower.
