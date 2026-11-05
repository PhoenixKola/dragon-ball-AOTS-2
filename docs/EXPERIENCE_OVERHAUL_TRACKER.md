# Experience overhaul tracker

The first local release batch is pushed as `f2c3717`. This animation batch is complete for the listed actor poses and remains local, uncommitted, and unpushed.

| Area | Current implementation | Verified | Remaining within this area |
|---|---|---|---|
| Namek title and battle stages | Nine native-generated 960×540 backgrounds: title plus eight distinct combat stage types. | Runtime background tests, Phaser screenshots, active asset audit. | Static backgrounds; environmental movement/parallax remains open. |
| Combat melee and idle | All 24 battle actor/form identities have four unique melee drawings and four-frame idle loops. | Asset audit, unit checks, and Chromium frame advancement for every actor/form. | Guard, hurt, victory, and KO remain single poses. |
| Core-party charge and special | Goku, Gohan, Krillin, Vegeta, and Piccolo each have a four-drawing charge loop and four-drawing signature-release sequence. Existing skill VFX remain distinct and are drawn separately. | Unit uniqueness/canvas checks and real Phaser charge/special frame advancement for all five heroes. | Same actor body sequence is shared across that hero's special skills; per-skill body variants remain open. |
| Goku / Trunks forms | Correct independent base/Kaioken/SSJ Goku routing and Trunks base/SSJ routing. SSJ Trunks has distinct melee/idle art. | Form unit tests and actual Phaser attack/idle checks. | Existing Goku form source-sheet limitations remain in `GOKU_FORMS.md`. |
| Contact timing | Melee animation begins before each authoritative damage marker; enemy multi-hit clips restart the strike before each contact. Rendering never applies damage. | Timing unit assertions and real Phaser capture/tests. | Human action-feel review at normal speed remains owner acceptance. |
| Asset source and runtime path | Active cuts live in `public/assets/reviewed/actors`; generated contact sheets/metadata are under ignored `art-sources/production/<actor>/`. | 485 active battle files + 9 backgrounds, zero missing/invalid/duplicate drawings. | Archive cleanup remains out of scope pending dynamic-use proof. |
| Windows player package | Offline local Node launcher and package builder; player ZIP excludes development artwork/evidence. | Final ZIP integrity, file count, frame count, and exclusions checked. | Final rebuilt BAT launch, another PC, physical controller remain unverified. |
| Other master-prompt tracks | Existing story, save, combat and progression systems are preserved. | Current unit/natural-progression suite and focused animation E2E passed. | World-map art, broader UI, authored/mixed audio, cinematic direction, and human/device acceptance remain open. |

The animation batch completes melee and idle sequences for all 24 combat actor/form identities plus charge/special body sequences for the five core heroes. Other poses and the rest of the overall experience overhaul are not claimed complete. See per-pose `docs/ANIMATION_COVERAGE.csv`.
