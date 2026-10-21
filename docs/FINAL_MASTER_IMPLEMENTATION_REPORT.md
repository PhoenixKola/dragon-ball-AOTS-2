# Final implementation report (release candidate, not "100% art complete")

Starting point: alpha 4.1 tree plus `AOTS2_additive_art_pack_v4` and `AOTS2_Namek_Saga_Visual_Master_Handoff_v1`. Nothing committed or pushed. Replaced files are in `art-sources/replaced-by-v4/`; the raw packs stay in the working tree.

Legend: **Implemented** = in the build. **Tested** = automated test passes. **Visually reviewed** = I looked at captures (`evidence/v4/`, `docs/images/before_after_battle_idle.png`). Human play, real hardware, audio by ear: NOT done.

## Art (Phases A-D)
| Item | Implemented | Tested | Visually reviewed |
|---|---|---|---|
| Battle sprites, all roster + Cooler (24 IDs), native pixels, feet-anchored, right-facing | yes | art tests, audit_cuts | yes |
| Dende, Nail, transformed Zarbon, Frieza Force soldier (v4) | yes | yes | yes |
| Overworld: all 11 entities from new sheets (no earlier-source art left) | yes | yes | yes |
| Portraits incl. Bulma, Dende, Nail, Cui, Zarbon, Frieza, Cooler | yes | - | yes |
| Item icons (11), skill icons (135 ids), command icons | yes | icon-coverage test | yes |
| Aura-rise VFX (gold/purple), SSJ flame, Sparking flame | yes | e2e loads | yes |
| New battle backdrop (day) and frozen backdrop; v4 world objects | yes | e2e | yes |
| Maps: 8 existing maps keep authored layouts; v4 dome/tree added to Aojan; 1 new map (Frozen Ruins) | yes | collision/route tests | yes |

Rejected / retained: red aura set (clips), Frieza baked-aura frames, Jeice special (glued ball), frozen tiles that are cut on the sheet (dome, cave), Kaioken/SSJ 32-frame sets kept (richer). Full per-row list: `docs/FINAL_ART_ACCEPTANCE.csv`; blockers: `docs/FINAL_MISSING_ASSETS.md`.

## Rage and Sparking (Phase E)
Tuning constants and identity multipliers in `src/engine/combat/rage.ts`: gains from hits (bosses full, soldiers x0.55), crits, damage taken (+clutch below 35% HP), Active Guard (+7 / +16), Defend only the first time in a row, 60 per-action cap. Measured with the simulator (`tests/support/rageProfile.ts`): story midbosses reach Rage in 60-100% of fights for attentive/average play; random soldier fights rarely do. UI: `+N RAGE` floaters, `RAGE MAX!`, meter pulse from 75, MAX · READY, command descriptions with the reason when unavailable, one-time tip, Help section. Sparking: 100 Rage, 4 turns, +25% ATK, half Ki, no stacking/double spend (tested), gold flame while active, own sound. Numbers are unchanged from before so no other text needed updating.

## Loadouts (Phase F)
Every main hero learns 9-12 specials (guests 5), equips four. New Loadout tab: slots I-IV, learned library with roles, locked list with unlock levels, always-available commands listed. Kaioken is a normal equippable special; SSJ skills appear automatically and base-only specials are hidden (not removed) while Super Saiyan. 45 new skills with new icons, generated clip families (each skill has its own clip id) and unique descriptions/roles. Save: optional `equipped` field, validated (distinct, learned, own-hero, max 4); old saves load with a deterministic default; `SAVE_VERSION` unchanged. Postgame skills (levels 23-27) unlock by training after the credits.

## Postgame and Cooler (Phase G)
Credits now offer Continue Adventure (Enter) / Save & Title (X). The autosave at the credits is already the postgame hub, so loading it never strands the player on the destroyed ground. Narrative: Namek stays destroyed; Bulma's Capsule Corp Namek Simulation rebuilds it for training. `postgame_unlocked` is a separate idempotent flag; endings, balls, levels, equipment, SSJ and fusion state are untouched; roster gains Krillin/Vegeta/Dende; patrols respawn as training dummies while chests, balls and quest rewards stay one-time. Journal gets a Postgame tab (trail, records, training targets, trophy). Trail: Bulma's Capsule Comm (clue) -> frozen rift at the Highlands' east end -> Frozen Ruins (altar, 3 patrols, 2 chests, arena). Cooler: 3-phase boss (Frost Armor counter, two telegraphed charges, Supernova Bomb under 50%), own skills and music cues, trophy Frost Core Capsule once, no-reward Training Rematch with best-clear record. Simulated odds: Lv22 a real risk, Lv26 attentive ~92%, Lv30 average ~100% (`tests/unit/postgame.test.ts`). Cooler's field sprite does not exist in the packs (named blocker).

## Back / fullscreen / audio (Phases H-I)
X, Backspace, Esc and gamepad B go back everywhere (`src/systems/backKey.ts`); clickable Back button on the menu; help text lists them. Browser Esc exiting fullscreen is a browser behaviour the page cannot intercept: the game listens to `fullscreenchange`, re-fits the canvas/cameras, keeps open menus as they are, never re-enters on its own and shows a one-time tip. New earcons: Sparking, Kaioken, Rage ready; two procedural Cooler tracks.

## Not done / honest limits
Real music and SFX, hand-timed multi-frame animation for most fighters, Frieza morph frames, distinct generic soldier, Cooler field sprite, NPC villagers redraw, physical gamepad / GPU / DPI / audio checks, a human playthrough, 1024x600 re-capture of the new screens (e2e checks menus at all three sizes only for the old tabs), packaging as an exe. The Windows launcher is the existing `START_GAME.bat` (needs `dist/`, included).
