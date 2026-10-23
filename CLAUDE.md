# Claude Code instructions: AOTS II, Namek Saga

Offline private React/TypeScript/Phaser JRPG for Windows. Do **not** move to Godot/Unity; do not require MCP, accounts or network at runtime. Never commit, push or publish without explicit approval (private copyrighted fan work).

## Reality (read first)
- Stack: Vite 6, React 19, TypeScript 5.9, Phaser 3.90, Vitest, Playwright. `src/` is the game; `legacy/` is a rollback snapshot of the old prototype (stale prototype files may still exist at the project root and are unused).
- Pure combat: `src/engine/combat/engine.ts` (deterministic, no timers). Animation: `src/engine/animation/clips.ts` (declarative timelines; hit markers commit damage via `BattleDirector`). Never apply damage from the renderer.
- World: `src/data/maps.ts` + `src/data/scripts.ts` drive everything; entities are gated by flags. Add content there, not in UI code.
- Saves: `src/systems/save.ts` (strict validation, backups, v2 migration). Bump `SAVE_VERSION` and write a migration if you change the shape.
- Folders: `public/` is the only art the game loads; every art pack, archive and verification-only file lives under `art-sources/` (packs in `art-sources/packs/`, briefs in `docs/briefs/`; tools read from there). Briefs are in `docs/briefs/`.
- Goku forms: base = `goku_<pose>.png` stills; Kaioken/SSJ = frame sets sliced by `tools/slice_goku_forms.py` from `art-sources/goku-forms/`. Routing, pose mapping and limitations: `docs/GOKU_FORMS.md`. Never re-slice from archived sheets.
- Art is AI-derived stills, not animation. Do not fake motion; add missing frames to `docs/REQUIRED_MISSING_ASSETS.md`. Never claim art is verified; inspect images.

## Before changing things
1. `npm run typecheck && npm test`.
2. If you touch enemies/skills/stats/XP/items: run `npm test`. `tests/unit/naturalPlaythrough.test.ts` walks the whole story and PLAYS every fight with the real engine from earned state (no boosts) and rewrites `docs/NATURAL_PLAYTHROUGH.md`; it is the balance contract (average guarder >= 55% per attempt, Easy finishable without guarding). Re-calibrate with `CALIBRATE=1 npx vitest run tests/unit/calibrate.test.ts` if soldier fights shift. Browser story tests that start from RAISED levels are named `BOOSTED` and prove flow only.
3. Visual changes: `npm run dev`, then `node tools/shot.mjs <url> out.png`, `tools/capture_skill.mjs` (deterministic frame stepper via `window.__battle.debugStep`). Software GL is slow; use 960x540.
4. Before finishing: `npm run build && npm run test:e2e`.

## Priorities
1. Real battle animation frames for base Goku and the rest of the roster (needs assets; overworld walk cycles for heroes are done).
2. A human full playthrough and re-tuning.
3. Real music, hand-cleaned UI/tile art, gamepad menu support, Windows packaging polish.
