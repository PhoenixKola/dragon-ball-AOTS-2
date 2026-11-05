# Visual and interaction acceptance (current animation batch)

| Surface | Evidence | Result |
|---|---|---|
| Title at 1024×600, 1280×720, 1920×1080 | [before](../evidence/overhaul/before-title-ready-1280x720.png), [after 1024](../evidence/overhaul/title-namek-v2-1024x600.png), [after 1280](../evidence/overhaul/title-namek-v2-1280x720.png), [after 1920](../evidence/overhaul/title-namek-v2-1920x1080.png) | Dedicated twilight Namek shoreline; these sizes were inspected in Phaser. |
| Eight battle locations at 960×540 | [Phaser stage contact sheet](../evidence/overhaul/all-stage-contact.png) | Distinct backgrounds with continuous ground plane and aligned battle HUD. |
| All 24 actor/form melee sequences | Per-actor captures under [evidence/overhaul](../evidence/overhaul/) and `tests/e2e/partyAnimation.spec.ts` | Four authored changing drawings observed in Chromium for party, guest, and every enemy actor/form identity. |
| All 24 actor/form idle loops | Per-actor generated contact sheets under [evidence/overhaul](../evidence/overhaul/) and `tests/e2e/partyAnimation.spec.ts` | Four changing drawings observed; 5 fps loop returns to frame 1. |
| Core-party charge and special sequences | [Goku special release Phaser capture](../evidence/overhaul/goku-special-release-phaser-960x540.png), per-actor contact sheets, `tests/e2e/partyAnimation.spec.ts` | Four charge frames and four release frames advanced in real Phaser output for each core hero. |
| Battle HUD, other menus, world maps, credits, Porunga | Existing broad game coverage | No new visual acceptance pass in this animation batch. |

Final current-tree commands: `npm run build`, `npm test`, `npm run audit:runtime`, and `npx playwright test tests/e2e/partyAnimation.spec.ts` (4 passed). The earlier 41-test broad browser run predates this animation rollout. No human playthrough, audio-by-ear, or physical-device acceptance is claimed.
