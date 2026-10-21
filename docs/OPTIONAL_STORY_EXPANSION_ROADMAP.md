# Optional story expansion roadmap (not implemented)

**Status: a plan only.** Nothing in this document is in the game, and the Alpha 4.1 engineering pass deliberately did not add any of it. It exists so you can decide how long the campaign should be.

## Where the game is now (measured, not guessed)

| | Today |
|---|---|
| Areas | 8 maps: Azure Shore, Aojan Village, Frieza Landing Zone, Crystal Grotto, Guru's Sanctuary, Namek Highlands, Frieza's Ship hold, Namek's Last Ground (the last one has no way back out) |
| Story fights | 16 scripted fights (First Contact → Frieza 100%) |
| Non-boss enemies | **2 types** (Frieza Scout, Elite Soldier), reused everywhere, scaled by party level |
| Side quests | 7, all fetch / defeat-a-patrol / hand-in |
| Playable heroes | Gohan, Krillin, Vegeta, Goku, Piccolo (guests: Nail, Dende) |
| Modelled length | **about 41 minutes** on the critical path, about 57 minutes with every side quest. These are model numbers from `docs/NATURAL_PLAYTHROUGH.md` (walking at a fixed speed, 2.5 s per line, 70 s per fight), **not** a stopwatch measurement. |
| Levels | 5 → about 21 (critical path) or about 24 (everything); cap 30 |

It is a short, complete Namek Saga slice, not a 10-20 hour RPG. Reaching 10 hours by padding the same two soldiers across the same eight maps would feel bad; the plan below adds *different* things to do.

## Design principles for any expansion

1. **Add places and reasons, not grind.** Every added hour should be new maps, new people and new rules, never more of the same random fight.
2. **Keep the balance contract.** New fights must pass the same checks as the existing ones (`tests/unit/naturalPlaythrough.test.ts`): an average guarder wins ≥ 55% per attempt at the levels the route itself gives, and Easy is finishable without guarding.
3. **Stay optional.** The critical path must remain finishable without any of it (the "missed side content" test exists and must keep passing), and nothing may become compulsory grinding.
4. **No fake motion.** New art needs real frames (see `docs/REQUIRED_MISSING_ASSETS.md`); content that depends on missing art is marked as blocked, not stubbed.

## Tier A: about 2-3 more hours, little new art (mostly data + scripts)

Everything here reuses existing maps and sprites.

**A1. Three more Namek side regions (new small maps, reuse tilesets)**
- *Sunken Orchard* (off Aojan Village): fruit-harvest errand, a hidden Dragon Ball-radar puzzle, 6 new patrol fights.
- *Frozen Ravine* (off the Highlands): a timed crossing (collapsing ledges), first appearance of a **non-boss elite**: "Frieza Sergeant".
- *Wrecked Pod Field* (beyond the Landing Zone): salvage quest chain that pays Zeni and the only source of the Swift and Fury capsules besides the shop.

**A2. Ten more side quests** (so about 17), each with a *different* verb instead of fetch/defeat:
escort a child through the Grotto without being seen (stealth zones), find three scattered scouter parts (exploration), a Namekian recipe that needs two shop items + one rare drop (crafting-lite), a timed rescue before Dodoria's patrol returns, a "boss rush" request from Nail (two named elite fights in a row), a Bulma-radar tracking mini-quest, and a few NPC-relationship chains that unlock a new line in the Journal.

**A3. Six new non-boss enemy types** to end the "two soldiers" problem: Sergeant (shield-bearer, counter), Scouter Tech (support, buffs enemies), Sniper (long-charge ranged), Rock Namekian beast (non-Frieza ambient enemy), Cooler's-Armored-Squad-style heavy, Hover-pod gunner (flying). Each needs real battle frames (blocked on art for new silhouettes; until then they would have to reuse the soldier sprite).

**A4. A small post-game**: after the ending, "Namek Aftermath" lets you keep playing on the Last Ground's neighbouring islet: 8 optional boss rematches with scaled-up stats and a Zeni sink (the shop currently has far more Zeni than things to buy; see the economy table in `docs/NATURAL_PLAYTHROUGH.md`).

*Added content:* 3 maps, 10 quests, 6 enemies, about 40 new fights (most 1-2 minutes), 150-250 new dialogue lines.

## Tier B: about 5-8 more hours, real production

**B1. Pre-Namek prologue chapter (Earth / Kami's Lookout / Snake Way).** 4 new maps, a training montage structure (3 minigame-like training sessions that grant the first training points), Goku's absence explained, introduction of Piccolo as a rival, 5 story fights and about 60 minutes of play. Needs new art for Earth tilesets.

**B2. Character arcs with their own mini-chapters**, each 25-35 minutes and built around one hero's party slot so every character becomes the lead once:
- *Gohan: "Hidden Power"*: Gohan alone with Dende in the Grotto, a power-awakening arc ending in an optional Hidden Power fight.
- *Krillin: "The Scouter Spy"*: infiltration of Frieza's ship hold (stealth sections, a door-code puzzle, the first reason to visit the hold twice).
- *Vegeta: "Pride"*: his tracking of Zarbon and Dodoria expanded into 3 fights and an ally-or-enemy choice that changes one line in the finale.
- *Piccolo / Nail: "Two Warriors"*: the Namekian side of the ending, a Nail memorial quest and a unique Namekian technique.

**B3. A second world area per chapter with a sub-hub**, so each chapter has a "come back here" place: a Namekian elder's house that changes with your choices, a bounty board that rotates fights as you level.

**B4. A real exploration layer**: 3 hidden optional bosses (a Namekian guardian beast, a lost Ginyu Force member, a rival soldier captain), optional Dragon Ball puzzles for balls 3/5 beyond "walk to it".

*Added content:* about 12 maps, about 25 quests, about 70 new fights, 4 mini-chapters, 500-800 dialogue lines, new music (the current music has never been listened to by a person and is a prerequisite).

## Tier C: 10+ hours (a different game scope)

Everything in B plus: a second saga slice (Ginyu Force deep dive or Android arc), multiple party-member loadouts, a proper skill-tree for training points, difficulty modes beyond Easy/Normal, mid-chapter autosave, localisation. Realistically this is months of full-time work and is mostly art, music and writing, not code.

## Progression curve for any expansion

Today the curve is 5 → about 21 (critical path). To add hours without breaking the fights, **do not push the cap past 30 and do not raise boss stats to keep up**. Instead:

| Hours of play | Intended average level | Notes |
|---|---|---|
| 0-1 | 5-12 | current content |
| 1-3 | 12-20 | Tier A side regions give the extra XP; shift the new content's enemies to 1-2 levels below the main route so it never *blocks* the story |
| 3-6 | 20-26 | Tier B arcs and training; spend the extra training points on a larger skill choice (a second page of skills per hero) |
| 6-8 | 26-30 | cap; the final fights then need *new mechanics* (more Rage Arts, party swaps) rather than bigger numbers |

Each added XP source must be re-run through `tests/unit/naturalPlaythrough.test.ts` so the critical path (which adds none of it) does not get harder by comparison, and the "everything" route does not get trivial (it currently ends about three levels above the critical path; keep that gap between 2 and 8).

## Rough scope (one developer, art outsourced)

| Tier | New maps | Quests | Enemies | Story fights | Art needed | Rough effort |
|---|---|---|---|---|---|---|
| A | 3 | 10 | 6 | about 40 | 6 enemy sprite sets | 3-5 weeks |
| B | about 12 | about 25 | 12+ | about 70 | tilesets, 5 character arcs, music | 3-5 months |
| C | 20+ | 40+ | 25+ | 150+ | a full art and audio production | 9+ months |

These are order-of-magnitude estimates to help you pick a target length; they are not commitments.

## Decision for you

Pick a target (short polished slice / Tier A / Tier B) and whether art or music comes first. If Tier A: start with A3 (new enemy types) because it makes the existing eight maps feel bigger for free, then A2 (varied quests), then A1.
