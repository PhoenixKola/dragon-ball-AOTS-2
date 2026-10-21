# Game design (as implemented)

## Structure
Prologue (intro cutscene) + 7 chapters, 8 maps, 16 scripted story battles (some chain into multi-form fights), 6 visible patrol foes (Shore, Landing zone x2, Ridge, Hold x2), random encounters, 12 chests, shop, healer, 5 save altars (Alpha 4 adds the Landing Zone and Namek's Last Ground), **7 side quests**.

| Ch | Beat | Maps | Roster notes |
|---|---|---|---|
| 0 | Voyage (intro) | cutscene | |
| 1 | Shore, scouts, Dende rescued, Dragon Ball 1 | Shore, Village | Gohan, Krillin |
| 2 | Vegeta joins; Cui, Dodoria, Dragon Ball 2, Zarbon (transforms) | Landing, Cave, Village | + Vegeta |
| 3 | Guru awakens potential (+6 training points), Nail, Dragon Ball 3 | Guru | |
| 4 | Ginyu Force: Guldo, Recoome (survive 5 rounds, Goku arrives mid-crisis), Burter+Jeice, Ginyu body-swap | Ridge | + Goku |
| 5 | Nail vs Frieza (survive), Piccolo fuses with Nail | Guru | Nail guest, + Piccolo (fused) |
| 6 | Frieza forms 1-3, Vegeta falls, form 4, Krillin dies | Landing | Vegeta leaves, Krillin leaves |
| 7 | Super Saiyan cinematic, Frieza 100% on collapsing Namek, epilogue, credits | Core | Goku SSJ, Gohan, Piccolo |

Canon notes: sequencing follows the manga/anime beats as known to me (Vegeta's solo hunt, Ginyu Force with Goku's arrival during Recoome's assault, Ginyu's body change, Nail/Piccolo fusion before Frieza's forms, Krillin's death as the trigger). Dende heals; Spirit Bomb exists as Goku's Rage Art but is not a story beat. I did not re-verify these against sources in this environment (no web access was used), so treat details (e.g. who fights Zarbon) as authored adaptation.

## Side quests (Alpha 4)
Optional, tracked in Journal > Side quests, stored as ordinary flags (`q:`, `qp:`, `qd:`, `foe:`), so saves need no migration. Rewards are paid once. All close when the confrontation with Frieza begins; the game asks before that point (Continue / Cancel).

| Quest | Giver / place | Objective | Reward |
|---|---|---|---|
| Stolen Supplies | fisher, Azure Shore | beat the beach patrol, recover the sack | Senzu, 120 zeni, 150 XP |
| Medicine for the Elders | elder, Aojan | bring 2 Med Kits (consumed) | Vital Capsule, 150 zeni, 250 XP |
| Lost in the Grotto | child, Aojan | find the brother in the Crystal Grotto | Guard Capsule, 100 zeni, 200 XP |
| Bounty on the Patrols | trader, Aojan | beat both Landing Zone patrols | 300 zeni, Mega Med Kit, 300 XP |
| Frieza's Logbook | order log in the ship hold, hand in to Guru | find the log | +3 training points each, 400 XP |
| The Ridge Ambush | Namekian on the Highlands | beat the ambush party | 2 Med Kits, 150 zeni, 350 XP |
| Nail's Request | Nail, Sanctuary (only until Nail fuses) | beat both ship-hold patrols | Power Capsule, 200 zeni, 400 XP |

The Dragon Radar (Bulma at the ship, Dende in the village) reads out only the balls whose area is already unlocked. Balls 1 and 2 are story-required; 3-7 are optional and only a full set gives the Porunga epilogue.

## Combat
- Speed-ordered turns, seeded jitter, 1-4 enemies, 1-3 allies.
- Commands: Attack, Skills, Items, Defend, Rage Art, Sparking, Combo, Flee.
- **Ki** costs; Attack and Defend recover Ki. **Rage** is per fighter: +on dealing/taking damage, +bonus on guards; at 100 choose a personal **Rage Art** or **Sparking** (4 turns: x1.25 ATK, half Ki). **Combos** need 2-3 named partners at 50+ Rage who have not acted; each pays 50 Rage and its turn; recipes unlock by story flags (see Combos menu).
- Statuses: stun, blind, seal, atk/def up/down, regen, frozen (Guldo), charging (telegraph), counter (Cui), possessed (Ginyu), kaioken, sparking.
- Charge/interrupt: heavy moves telegraph for 1-2 turns; 16% of max HP damage in that window interrupts and staggers.
- Boss identities: Cui counter stance; Dodoria Mach Crush charge cycle; Zarbon transforms at 50%; Guldo Time Freeze (max two frozen, interruptible); Recoome Eraser Gun charge; Burter+Jeice Pincer only while both live; Ginyu Body Change under 50% HP (possessed ally attacks friends for 3 turns); Frieza forms with separate patterns and the 100% form's Death Ball (2-turn charge) and enrage at 50%.

## Progression
- Level cap 30, XP `18L + 3.2L^2` per level, enemy EXP x3.4 (x0.85 for scripted wins, Easier mode +25%), benched heroes get 50%.
- Each level: stat growth per hero + **3 training points** to allocate (HP/Ki/ATK/DEF/SPD, free reset).
- Skills unlock by level (Dragon Kick 8, Scatter 7, Pride 9, Kienzan 11, Barrage 12, Kaioken Assault 17, Hellzone 19); Goku's SSJ set replaces Kamehameha/Assault.
- 2 capsule slots per hero (6 capsule types). Shop sells consumables and capsules.
- Expected level at each story beat: `docs/PROGRESSION_AUDIT.md` (generated from the walked route: bare critical path ends around Lv 19, the full route with quests around Lv 23).

## Encounters
Random encounters only in tagged zones of non-safe maps, every ~16-34 steps (halved by Easier mode), plus visible patrolling foes (touch to fight, defeat is permanent). Villages, Guru and the final map are safe. Flee works except in boss fights.

## Accessibility
Guard presets (Standard / Relaxed / Assist), reduced flashing, screen-shake off, fast battle speed, easier difficulty, keyboard-only play, gamepad (world movement/interact, and Alpha 4's pad-to-keyboard bridge for battle, menus and dialogue; not tested on hardware), no Tab suppression, pause on blur.
