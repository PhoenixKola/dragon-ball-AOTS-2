# Attack of the Saiyans II: The Namek Saga

Private, offline, single-player Dragon Ball Z JRPG (fan project, not for distribution). React 19 + TypeScript + Phaser 3, built with Vite. **Status: playable beta, version 1.0.0-beta.3 (final art integration and release QA pass; see `docs/BETA3_FINAL_ART_AND_RELEASE_REPORT.md`). The Windows launcher, real GPU, physical gamepad, audio and a full human playthrough are NOT tested.**

## Run it on Windows (offline)

Requirements: **Node.js 20 or newer** (https://nodejs.org). No internet is needed to play.

1. Double-click `START_GAME.bat`. The first time it builds the game (needs `npm install` to have been run once in this folder while online; if `dist\index.html` already exists it just starts).
2. A Chrome or Edge app window opens full screen on `http://127.0.0.1:5173` (other browsers open a normal tab; the game goes full screen on your first click or key press, and **F** toggles it any time). Keep the black server window open while you play; close it to quit.

Manual steps (PowerShell, in this folder):

```
npm install          # once, needs internet
npm run build        # produces dist/
npm start            # serves dist/ on http://127.0.0.1:5173
```

Development: `npm run dev` (hot reload on 5173), `npm run typecheck`, `npm test` (unit/integration tests incl. the natural-progression playthroughs), `npm run test:e2e` (builds, then drives real Chromium: smoke, story, flow and UI suites; numbers in `docs/ALPHA4_1_TEST_RESULTS.md`).

### Troubleshooting
- *"Port 5173 is already in use"*: close the previous game window or run `set PORT=5200 && npm start`.
- *Black screen or "Missing critical assets"*: the page lists the missing files; run `npm run build` again and make sure `public/assets/reviewed/actors` exists (`python -I tools/clean_assets.py` regenerates it).
- *No sound*: browsers need a click or key press first; also check Settings > Mute.
- *Choppy*: use a Chromium-based browser with hardware acceleration; Settings > "Integer pixel scale" lowers the render size on odd window sizes.
- *Saves*: stored in the browser's localStorage (per browser profile and per address). Use Menu > Save/Load > **Export to file** to keep backups.

## Controls
| | |
|---|---|
| Move | WASD / Arrows, Shift to run, gamepad left stick |
| Interact / confirm | E, Enter, Space, Z |
| Menu / back | Esc / X |
| Battle menu | Arrows + Enter; mouse works too |
| **Active Guard** | when a ring closes on a fighter press **that fighter's number key (1/2/3)** (or click them). *Assist* mode: Space guards everyone |
| Full screen | F (also Settings > Full screen) |
| Pause battle | P or Esc |
| Skip dialogue | K |

## What is in the game
Intro, 8 maps with collision, 16 story battles (Cui, Dodoria, Zarbon with transformation, Guldo, Recoome, Burter+Jeice, Ginyu, Frieza forms 1-5), the Super Saiyan cinematic, finale, credits. Per-fighter Rage, Rage Arts, Sparking and Sparking Combos, training points, capsules, shop, journal, map, three save slots plus autosave, import/export, v2 save migration. See `docs/GAME_DESIGN.md`.

## What is not finished (read this)
- **No frame-by-frame animation exists for any character**: every character has one still per state. Choreography moves stills (dash, alternate poses, projectiles) and never fakes breathing. Overworld heroes have real 4-direction walk cycles; battle poses are still stills except Kaioken/Super Saiyan Goku. Full list and specs: `docs/REQUIRED_MISSING_ASSETS.md`.
- Base Goku (Alpha 3g) is the Kaioken frame set with the red outline/glow removed (`tools/make_base_goku.py`): animated idle, attack, guard, hurt, charge, beam and victory; KO reuses hurt. It is a derived recolour, not newly drawn art. Ally/enemy poses drawn front-on cannot turn toward the other side without new art; the per-pose facing table is `src/data/poseFacing.ts`.
- Music is a procedural original score, not studio quality.
- The whole game has **not been played start to finish by a human**: verification is automated (see `docs/QA_REPORT.md`). Difficulty has been measured only by simulated players (`docs/NATURAL_PLAYTHROUGH.md`), never by a person, and fun is not verified. A physical gamepad, other GPUs/monitors, the Windows launcher on another PC and the audio have not been tested.
- **Length**: the modelled critical path is about 41 minutes and a completionist route about 57 minutes (model numbers, not a stopwatch). It is a short Namek Saga slice, not a 10-20 hour RPG; `docs/OPTIONAL_STORY_EXPANSION_ROADMAP.md` lists what a longer campaign would need.
- All 7 Dragon Balls are collectible (ownership tracked per star; all seven is optional and selects the ending text); the postgame Porunga screen lets you make three wishes (one each). See `docs/POSTGAME_PORUNGA_TRUNKS_IMPLEMENTATION.md`.

## Side quests and journal (Alpha 4)
Seven optional quests (shore, village, grotto, landing zone, ship hold, highlands, Nail) are tracked in Menu > Journal > Side quests. They close for good when you confront Frieza at the landing zone; the game asks first (Continue / Cancel) and the prompt tells you how many Dragon Balls and quests are still open. Altars on the Landing Zone and on the last ground heal and save. Controls: a gamepad now also drives battles, menus and dialogue (D-pad/stick, A confirm, B cancel, X/Y/RB Active Guard for fighters 1/2/3, Start = menu or pause).

## Layout
Project root: `src/` game code, `public/` the only art the game loads (about 10 MB), `docs/`, `tests/`, `tools/`, `evidence/` screenshots, `release/` ZIPs, `legacy/` old prototype. **`art-sources/`** holds every incoming art pack, the quarantined replaced art and build-only extras: it is never loaded by the game. `docs/briefs/` keeps the task briefs.

`src/engine` (combat, animation, scenes, world, audio) · `src/data` (heroes, skills, enemies, maps, scripts) · `src/systems` (party, saves, settings, input) · `src/components`, `src/app` (React) · `tools` (asset audit, slicing, cleaning, capture) · `tests` · `docs` · `legacy` (rollback of the prototype) · `evidence` (screenshots).
