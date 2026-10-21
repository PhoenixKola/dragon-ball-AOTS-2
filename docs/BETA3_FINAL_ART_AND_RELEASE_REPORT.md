# Beta 3 final art integration and release QA report

Version 1.0.0-beta.3. Baseline: Beta 2 working tree (346 unit passes, 2 skips, 37 e2e). Nothing was replaced from the old archive. Source pack: `AOTS2_Beta2_Final_Missing_Art_Pack_v1` (12 sheets, SHA-256 list verified OK), now stored in `art-sources/packs/` (not shipped).

## Implemented
- **Frieza 1-5** (distinct forms): frieza1/frieza4 gained guard, charge, special, victory, KO. frieza2, frieza3, frieza5 had whole sets swapped (the old art was near-identical or mismatched with the new poses). frieza5 is the muscular 100% form from its own sheet.
- **Foes:** jeice special (raised-arm cast, no projectile baked in; Crusher Ball stays engine VFX). Generic hornless soldier set swapped in (changes the look of every grunt tier) with new charge and victory. dende and nail charge poses taken from the v4 sheets already owned.
- **Cooler field sprite:** 20 frames, 4 real directions, used as a non-colliding arena presence that disappears on `cooler_defeated`. No trigger, reward or collision change.
- **Frozen Ruins:** dark `x` void rectangles replaced by animated deep water and layered cliff edges (textures cut from the pack atlas, procedural fallback). Collision grid pinned by a hash test; other maps unchanged.
- **Title screen:** five heroes on one baseline with reviewed poses, old animated Goku removed, procedural breathing bob (not animation frames).
- **Proportions:** Piccolo `heightPx` 188 to 160, Nail 180 to 168.
- **Scroll bug:** the 3-row list window re-centred under a still mouse and re-fired mousemove. The window now moves one row only when the cursor leaves it; hover is ignored unless the pointer moved (`src/components/listWindow.ts`).
- **Icon:** Dragon Ball sprite to `public/icon.ico` + PNGs + web manifest; `START_GAME.bat` creates a shortcut using the icon.
- **UI:** shop list fills its panel; loadout text tightened. Story: `nail_frieza` Piccolo/Nail sentence corrected; Frieza intro had no duplicate lines.
- **Docs/versions:** package, lockfile, title footer, README and checklist updated to beta.3.

## Automated-tested (final tree logs in `docs/beta3-logs/`)
- `npm run typecheck`: exit 0. `npm run build`: exit 0 (dist/index.html sha256 `1a9fca42cf9042ecba0af5912db5dbddfc33257ad3d00e9b8f20c648f8e49091`).
- `npx vitest run`: 24 files, 354 passed, 2 skipped (baseline 346/2).
- `tools/audit_assets.py`: exit 0; only height-variance warnings on KO poses.
- `npx playwright test`: 37 passed (1.0 h), including natural-level story flows and both endings.

## Visually reviewed (by the agents, from screenshots in `evidence/beta3/`; evidence folder is not in git)
Frieza 1-5, Jeice, soldier galleries at gameplay size; title at 1024 and 1280; Party, Loadout, Capsules, Items, shop, Porunga cards; Frozen Ruins at 1024x600, 1280x720, 1920x1080 along entrance, save, chests, bridge, arena, rematch terminal. Menus are a fixed 880x480 scaled, so 1024x600 fixes hold at larger sizes. Real-browser scratch checks (`tests/review/`, not in the suite): last-row hover did not move the list over 3 s; fullscreen enter/exit kept the Items menu and refit the canvas with no re-entry or confirm.

## Not tested / real hardware
Human full playthrough; real GPU or high-DPI; physical gamepad (mocked only); audio by ear (all procedural; hardware listening gate requested); the Chrome taskbar icon rendering and the `.lnk`; Windows launcher on a clean machine (needs Node 20+; this is not a standalone exe); Frozen Ruins patrols/encounters were reached by teleport rather than walked by hand; Edge-specific run.

## Remaining art blockers (post-integration FINAL_ART_ACCEPTANCE.csv: 306 rows: 288 approved, 12 retained-original, 3 missing, 3 rejected)
- `frieza2:victory` (no genuine victory frame; idle used), `soldier:special` (no clean frame; attack used), `zarbon2:special` (candidate is a different design; rejected, fallback kept).
- `trunks:overworld SSJ`: rejected; SSJ is battle-only by design, the sheet also had an inconsistent standing frame.
- Cooler walk frames installed but unused. No genuine multi-frame battle animation for most fighters (poses are choreographed stills); no Frieza morph frames (reference sheet unused); frieza5 special has a small baked purple palm glow (accepted as a held cast pose, flagged).
- Piccolo's idle is a wide crouch so he reads wide; the 3-ally battle line-up overlaps slightly with Piccolo (pre-existing).

## Gap table
34 Beta 2 missing rows: 30 accepted, 2 retained-fallback, 2 rejected. See `docs/BETA3_GAP_DECISIONS.md`, `docs/FINAL_ART_ACCEPTANCE.csv` (Beta 2 original frozen as `FINAL_ART_ACCEPTANCE_BETA2.csv`), `docs/FINAL_MISSING_ASSETS.md`, `docs/BETA3_WORLD_NOTES.md`. Replaced originals are backed up in `art-sources/replaced-by-beta3/` (local only).

## Packaging
`tools/make_release_zip.py` builds `release/AOTS2-Namek-Saga-beta3-final-art-polish.zip` (single root folder, no node_modules/.git/ROM/old zips/art packs). Earlier releases untouched. The ZIP size and CRC check are printed by the tool when run.

ZIP: release/AOTS2-Namek-Saga-beta3-final-art-polish.zip, 3173 files, 277.5 MB, CRC test OK, no forbidden paths. It includes the developer evidence folder.
