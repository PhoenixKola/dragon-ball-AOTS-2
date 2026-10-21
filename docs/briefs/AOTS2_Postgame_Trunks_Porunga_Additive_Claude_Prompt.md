# ATTACK OF THE SAIYANS II — THE NAMEK SAGA
## ADDITIVE IMPLEMENTATION BRIEF: FUTURE TRUNKS + SUPER SAIYAN + PORUNGA'S THREE WISHES + RESTRAINED UI REFINEMENT

**Status:** NEW ADDITIVE SCOPE, not a replacement for the prior master implementation plan.

**Use these materials together:**
1. Existing `AOTS2_Namek_Saga_Final_Visuals_Gameplay_Postgame_Claude_Master_Brief.md` (the primary assignment covering visual integration, Rage/Sparking, loadouts, Cooler, postgame, audio, QA, etc.).
2. Existing `AOTS2_Namek_Saga_All_Art_Packs_1_2_3_and_Cooler_v1.zip` (note: the master's originally mentioned `...Visual_Master_Handoff_v1.zip` is the *internal folder name*, not the supplied ZIP filename).
3. Existing `AOTS2_additive_art_pack_v4.zip` and its additive instructions (Dende, Nail, transformed Zarbon, additional portraits/VFX/icons/tiles).
4. **NEW:** `AOTS2_Postgame_Porunga_Trunks_Art_Addon_v1.zip` (14 source sheets for Trunks, SSJ Trunks, Porunga, relic, awakening effects and attacks; see README and manifest).
5. **THIS document** (new feature scope and restrained UI art direction).

**Starting code:** Inspect the newest real local working tree. The latest source independently reviewed when this brief was authored is `AOTS2-Namek-Saga-alpha4-1-final-verified.zip` (React 19/TS/Phaser 3/Vite, 273 passing unit tests + 31/31 E2E as *previous reported/logged baseline*). If your tree already includes code and assets from the master brief, KEEP THEM; extend rather than overwrite. No git commits/push/deploy and no deleting existing art, saves, or release ZIPs.

**User priority:** polished, playable **~1-hour main Namek story**, optional meaningful postgame, distinctive characters and visual consistency. User likes the first two visual sprite batches. The large Pack 3 menu boards were considered **too exaggerated**: *DO NOT COPY/REPRODUCE THOSE INTERFACES*. None of those four giant UI mockup boards are included in the new art ZIP.

---

## 1. First audit what exists, then integrate additively

- Inventory the current `HeroId`, `HEROES`, `SKILLS`, `ITEMS`, `PartyMember`, save parsing, game/scene state, map triggers, ability loadouts, progression caps, endgame/credits, postgame, Cooler content, menus and existing applied art. Check reality rather than assuming the master prompt succeeded.
- Record a diff/snapshot and safe backup, identify finished versus unfinished master requirements, and write a short plan before implementing the add-on.
- Do **not** start the story from scratch, alter established boss encounters unnecessarily, remove existing sprites or regress 31 prior E2E tests. Preserve older v3 saves, save-slot backups, export/import and existing Dragon Ball ending logic.
- The 14 new art PNGs are **original source sheets / candidates**. Inspect manifest checksums and source dimensions, then curate into approved runtime images. All source images are RGBA with transparent regions, but **they contain partial-alpha halos, artwork touching neighbors, and some attached VFX**. Some tightly packed poses are not automatically sliceable. Zero checks for clipping, neighbor bleed, huge transparent boxes, wrong directions or misaligned feet are mandatory. Do not auto-install entire PNGs as Phaser actor textures.
- Don't infer a timed animation exists because a sheet has eight poses. Use genuine distinct states with properly timed travel, holds and VFX; describe any still-based animation limitations accurately.

## 2. Future Trunks — secret postgame ally (replaces the earlier tentative Tien proposal)

**Creative choice locked:** *Future Trunks* in Capsule Corp blue jacket with lavender hair, black trousers, boots and sheathed sword is the **only** secret member for this add-on. Tien is **not** to be added as a secret recruit. Broly, Beerus, Whis, Goku Black and extra bosses are NOT authorized scope; Cooler is the single optional postgame superboss from the master plan.

**Source sheets (new pack):**
- `01_future_trunks_base/future_trunks_battle_sprite_sheet.png`
- `01_future_trunks_base/chibi_swordfighter_sprite_sheet.png`
- `01_future_trunks_base/future_trunks_pixel_portrait_sprite_sheet.png`
- `04_attacks_icons_optional_ui/future_trunks_energy_effects_atlas.png`
- `04_attacks_icons_optional_ui/future_trunks_energy_skill_sprite_atlas.png`
- `04_attacks_icons_optional_ui/pixel_art_warrior_skill_icon_atlas.png`

Implement a **real** persistent postgame playable hero, not a costume or temporary cameo:
- Correct `trunks` hero ID/data and all affected unions/registries; level-appropriate initial stats and XP, equipment, capsule eligibility, 8–10 or more **mechanically varied** skills including sword, Ki, utility/defense and support. Avoid overpowered instant victory or a single animation reused for all skills.
- Give him four equippable active abilities, using the **same customizable loadout system** from the master brief, with meaningful skill descriptions, Ki costs, targeting, lock/unlock rules and save persistence. Existing hero loadouts must remain intact.
- Choose clear source poses: idle, attack/sword, guard, charge, hurt, victory and KO, with clean alpha, stable size and correct facing toward enemies. Extract field idle/walk poses for all four facings; compare hair and sword sheath orientation; never blindly flip an already correctly facing image.
- Unique move-specific visuals for *Burning Attack*, *Finish Buster* and distinctive sword rush/slash finishers (names/roles should fit the battle engine). Sync charge/travel/hit sound and VFX with actual combat results (miss, guard, immunities, KO); do not hard-code a huge screen flash for every small attack.
- Preserve the existing **maximum active battle party of three** unless broader changes were deliberately implemented and tested earlier. If the roster is full when Trunks arrives, add him to roster/bench and let the player swap; don't overwrite Goku or another party member.
- Recruitment is a **non-canon postgame "what-if" consequence of Porunga's power**, explicitly explained in an optional cutscene. Don't imply Future Trunks fought Namek-era Frieza as part of the original chapter progression.

### Super Saiyan Future Trunks is mandatory, not an optional visual recolor

**Source:**
- `02_future_trunks_super_saiyan/super_saiyan_trunks_sprite_sheet.png`
- `02_future_trunks_super_saiyan/future_trunks_super_saiyan_transformation_sprite_s.png`
- `02_future_trunks_super_saiyan/super_saiyan_trunks_pixel_portrait_sheet.png`
- `03_porunga_wishes_relic/golden_awakening_energy_vfx_sprite_sheet.png` (only if the effect suits this state; do not equate the Hidden Potential wish with SSJ)

Requirements:
- A real **base → SSJ** transformation during battle with golden hair/teal eyes, an appropriately animated activation, visual state indicators, correct portraits, form-aware skills/stats/AI targeting, sensible Ki/HP costs or conditions, and a balanced, distinct reason to transform. Inspired by Goku SSJ but **no accidental shared Goku form flag**.
- Working SSJ-specific skills, Rage/Sparking/Active Guard interactions and the four-slot customization; form switching must never silently delete an equipped skill. Define tested rules for unavailable base/SSJ skills and preserve loadout choices in saves.
- On the overworld, implement SSJ Trunks facing correctly in every direction. The new pack has **only a base-Trunks 4-direction sheet**; it does **not contain an authenticated full 16-frame SSJ Trunks field walk sheet**. If creating a faithful dedicated variant isn't feasible, retain base appearance in the overworld or use a clearly documented fallback until genuine approved directional frames exist; never claim missing frames were supplied.
- Distinct SSJ battle art and portrait must be real and visible. Any other missing poses/art must appear in the acceptance inventory, not quietly generated as fake animation counts.

## 3. Porunga summoning + exactly three selectable wishes

**Three rewards (user approved; no alternate wish menu filler):**
1. **Unlock a Secret Ally** → Future Trunks joins the persistent roster; unlocks his SSJ transformation and skills.
2. **Awaken Hidden Potential** → a meaningful, balanced, persistent postgame party enhancement. Specify whether it's a per-character or whole-owned-roster upgrade and apply consistently, including newly recruited Trunks and benched members; don't stack it from repeat UI visits.
3. **Claim a Dragon Relic** → grant **one** unique *Namekian Dragon Crest* or equivalent legendary equipment item, with meaningful but not game-breaking stats and a distinct icon. Equip/unequip works correctly; no duplication on revisit/reload.

**Sources:**
- `03_porunga_wishes_relic/porunga_summoning_sprite_sheet.png`
- `03_porunga_wishes_relic/porunga_summoning_pixel_art_sprite_sheet.png`
- `03_porunga_wishes_relic/neon_golden_dragon_orb_icon_sheet.png`
- `03_porunga_wishes_relic/golden_awakening_energy_vfx_sprite_sheet.png`

The existing story's seven balls are held via **`ball1`…`ball7` flags**; the derived `balls` count must continue to come from those flags. The existing seven-ball branch in `scripts.ts` says Dende summoned Porunga to save the Namekians, and the other ending says no wish was made. **Do not change or invalidate either existing main ending.**

Design rules for the new **optional postgame** ceremony:
- Summoning is available **only after credits/Frieza completion and ownership of all seven distinct Dragon Balls**, within a coherent explorable postgame world; if some balls were skipped before ending, allow the player to finish collecting them in free roam. No missable ball softlocks.
- If the main ending already involved Porunga, the optional ceremony is clearly a **later summoning after the Dragon Balls recharge**, rather than a contradictory repeat of the story wish. Make the postgame environment explanation consistent with Namek's destruction/reconstruction or visitable training reconstruction established by the master brief.
- New visitable shrine/altar (within the postgame world and map/collision/quest system), recognizable 7-star placement ritual, sky lighting change, large Porunga entrance, a **brief skippable** speaking/granting effect and an elegant three-card wish selection screen. Keep animations reasonably short and low-flash with controls remaining accessible.
- Player chooses any **one of the three remaining wishes at a time**, in any order; after a successful grant, that choice is permanently marked fulfilled in the save. The remaining choices are still offered until all three are used. All three may ultimately be obtained; these are **not** mutually exclusive branches. On cancel, no wish is spent and no items/characters granted. Once all three are fulfilled, show an appropriate completion acknowledgement and do not allow repeats.
- Idempotent, atomic reward application and persistence: award each unique wish exactly once, and save only committed choices; revisiting a shrine, repeated clicks, interruptions, reloads, import/export, autosave and saves migrated from Alpha 4.1 must never duplicate the recruit, power boost or relic. Upgrade the strict save whitelist/version/migration deliberately where required and add focused regression tests for old saves, corrupted saves and save-slot backups.
- As much as possible, **preserve all current flags**, and store per-wish completion in well-named safe flags/data with strict validation rather than inventing a second contradictory ownership counter. Existing Dragon Ball pickup, 7/7 HUD, normal ending and all-seven-balls ending must remain valid.
- Communicate in the Journal which wishes are available, granted and pending; show reward descriptions and stat comparisons, and a gentle warning before a permanent choice.
- Porunga is **not a combat boss or a playable party member**. Draw him at cinematic scale separate from the heroes; large mixed sheets may need careful per-region matting. Prefer one consistent character source rather than showing mismatched two different Porunga designs in one sequence.

## 4. Cooler postgame integration

The previous master brief already requires post-Frieza free roam, a frozen ruins map, **Cooler (final form) superboss**, postgame XP/rewards, and appropriate training. Do **not** add a second redundant postgame world or a new unrelated boss. Connect the Porunga sanctuary and Trunks into the **same** postgame state and existing optional map network.

- Cooler is accessible whether or not wishes were taken. The wish rewards can help the fight, but **must not be prerequisites** to challenge or beat him. Balance at the naturally earned postgame party level with and without relic/hidden-potential/Trunks.
- Preserve replayability, training encounters, completed boss markers and reward persistence. If Cooler is repeatable, establish separate first-clear reward flag from rematch eligibility, no farming duplicate unique rewards, and no loss of free roam after victory.
- Validate recruiting Trunks **before and after** beating Cooler, using both main-story ending routes.

## 5. Premium UI — restrained, functional polish ONLY (NO Pack 3 mockup integration)

The user was explicit that the Pack 3 menu concept boards were **over the top**. They are **not shipped in this add-on ZIP** and **must not be treated as production art, screen mockups to recreate, or a new visual style mandate**.

Apply a tasteful, cohesive refinement to the **actual functional React/Phaser UI** already installed:
- Preserve the layout/controls the game already gets right, existing text structure, keyboard/gamepad navigation, focus, contrast, small-screen usability and existing save slots. Keep a readable DS-inspired navy/gold palette with subtle Namek accents—not neon effects everywhere or giant portrait overlays.
- Ensure the main title, pause/party dashboard, character details, ability loadout four-slot editor, shop buy/sell and quantity/price comparison, items, equipment, journal, save/load/settings, battle actions and Rage/Sparking explanations all have consistent button sizes, selected/hover/focus/disabled states, spacing and understandable interaction cues.
- The Porunga wish selector and Trunks recruitment/status pages should feel like part of those menus: clean choice cards, icon, succinct descriptions, confirmation/cancel, already-granted state and gamepad focus.
- Visual design should favor **CSS components, existing approved assets and small icons**, not flattening menus into pre-rendered noninteractive images. Don't import the busy full-screen Pack 3 images. Optional `dragon_ball_rpg_ui_icon_atlas.png` provides small design candidates only; use at most individually approved clean isolated bits, or none.
- Correct the browser Escape/fullscreen conflict according to the prior master brief: browsers can reserve Escape to exit fullscreen. Expose **X/Backspace / visible Back button / gamepad B**, keep menu state coherent on fullscreenchange, and test the actual modal/overlay behavior. Never promise browser Escape can be intercepted in fullscreen.
- Check layout/no clipping at 1024×600, 1280×720 and 1920×1080, keyboard-only and mocked gamepad, with touch-safe focus targets if browser supports them.

## 6. Animation / art acceptance and missing-asset handling

- Use the **same canonical pixel density, palette, shadow/highlight, outline thickness, body proportions and crisp scaling established by the approved visual art**. Prefer the stronger old assets if new ones clash or are clipped. No global flip applied without verifying pose-facing direction.
- Track each Trunks/base/SSJ battle state, overworld facing, portrait, transform, Porunga pose, wish icon and skill VFX in the existing `FINAL_ART_ACCEPTANCE.csv` or equivalent. Each marked accepted needs an installed path, source file, dimensions/pivot, in-game screenshot and test. Every missing piece needs honest fallback/disposition.
- Separate VFX from character art, make effect backgrounds truly transparent where needed (terrain/full-screen backdrops may remain opaque), clean stray chroma and semi-transparent rectangular halos. Don't force all 14 sheets into the runtime. Deduplicate visually redundant attacks and remove only **new unnecessary runtime copies**, never delete user source packs.
- Do not silently generate stock UI pictures or claim that sprite sheets are complete, in-between animations. Preserve quality above sheer asset count. Don't degrade already polished Goku, Kaioken, SSJ, Frieza or Cooler animations.

## 7. Testing, playable deliverable and honest report

Mandatory validation **on final tree**:
- Typecheck, production build, all unit tests, **full previously passing 31-test browser suite**, and new focused unit/integration/browser tests for Trunks recruitment, SSJ battle form/skills, four-slot loadouts, Dragon Ball conditions, three wish orderings, cancellations, persistence/idempotence, pre/post Cooler, both endings, and clean load of Alpha 4.1 v3 saves (plus current updated saves).
- Real input flows: fresh game → Frieza → either ending → credits → postgame → collect any remaining balls → Porunga ritual → take 3 wishes (in various orders, with cancel/reload) → recruit and configure Trunks → base + SSJ battles → Cooler optional fight/rematch → save/reload and continue roaming. No dev-forced chapter flags, extra XP/levels, or battle skips to declare human-playable completion; separate bot verification from human testing.
- Visual screenshots at 1024×600 / 1280×720 / 1920×1080 for base Trunks / SSJ / transformation, field movement 4 facings, Porunga, menus/loadouts/shop and Cooler. Check no clipped artwork and reasonable animations. Verify sound changes with actual listening if hardware available; disclose when not.
- Preserve old baseline test logs and attach new test logs, per-asset acceptance report, save migration evidence and `docs/POSTGAME_PORUNGA_TRUNKS_IMPLEMENTATION.md` with actual decisions, rejected assets, fallbacks and remaining blockers.
- Test Windows browser/launcher and offline packaging within available environment, clearly mark any hardware-only checks not executed. Do not claim finished v1.0 or 100% completion if essential checks or artwork are missing.
- Package ONE clean **full updated playable project ZIP**, same structure as previously verified packages, with source/tests/docs, fresh `dist/`, public runtime assets, launcher, logs and no node_modules, `.git`, `.nds` or redundant art packs; keep source art packs in development tree and do not touch prior release ZIPs.

**No commit, push or deployment. Do not rewrite the engine or extend the ~1-hour main campaign.**

---

### Hand-off message recap

Implement the existing master brief + existing Art Pack 4 additive pass + **this new Trunks/Porunga add-on** together. The new ZIP contains **14 artwork source sheets**, not a complete game or guaranteed install-ready animations. New feature decisions: **Future Trunks and Super Saiyan Trunks**, Porunga's **three nonexclusive once-each selectable wishes** (Trunks / Hidden Potential / Dragon Relic), existing Cooler postgame compatibility, and **restrained UI refinement without using the oversized Pack 3 menu concepts**. Preserve saves, prior art and tests, then return a ZIP, logs, accepted/missing-art inventory, and implementation report.
