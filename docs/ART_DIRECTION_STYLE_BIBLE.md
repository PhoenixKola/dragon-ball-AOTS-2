# Battle art direction (current review build)

Approved battle sprites define continuity. [Base Goku's melee sheet](../evidence/overhaul/goku-attack-contact.png) and [core-party melee sheet](../evidence/overhaul/party-punch-contact.png) set the calibration. New frames use each actor's approved pose as its identity, costume, scale, and pixel-density reference; cuts return to the original canvas and foot baseline.

- **Style:** compact handheld anime pixel art, clustered colors, clean dark outlines, crisp silhouettes, nearest-filtered in Phaser. Keep each actor's existing source canvas size.
- **Identity:** preserve costume, hair, anatomy, props, and story form throughout each sheet. Goku Kaioken/SSJ and Trunks SSJ stay on independent routes.
- **Melee:** four drawings show anticipation, drive, contact, and recovery. Frame 3 is the contact pose; the clip triggers before damage is applied by the deterministic combat engine.
- **Idle:** all 24 combat actor/form identities have four distinct, authored drawings in a 5 fps closed breathing/stance loop.
- **Charge/special:** each core hero has four authored charge drawings and a four-drawing actor-specific special-release sequence. The charge loops at 8 fps. Special frames play at 30 fps and hold the release pose while that skill's existing beam/projectile VFX resolve. These body sequences are shared among that hero's special skills; VFX keep individual move identity.
- **Registration:** each frame preserves canvas and feet line, clean alpha, consistent body scale and centered alignment. Active audit rejects missing, empty, duplicated, or misregistered frames.
- **Facing:** `src/data/poseFacing.ts` owns mirroring. Generated sheets preserve each actor's approved direction and asymmetric costume details.
- **Review:** use the contact sheets and Phaser captures at battle scale. Reject identity drift, clipping, floating feet, visible baked backgrounds, duplicate drawings, or distracting pixel-density changes.

The earlier roster pass completes melee and idle animation for all 24 battle identities and charge/special body animation for the five core heroes. The current animation pass adds authored guard motion for base Goku and both Goku forms, multi-frame SSJ hurt recovery, and a Kaioken rebuild that uses the approved base Goku proportions with a separately rendered red aura. Kaioken's idle, melee, guard, hurt, and Kamehameha body frames now follow that same identity reference, with a dedicated four-drawing charge sequence. Other roster victory/KO and enemy charge/special coverage is still tracked separately; this document does not claim that static poses have become animation.

## Namek environment language

The [title capture](../evidence/overhaul/title-namek-v2-1280x720.png) and [stage sheet](../evidence/overhaul/all-stage-contact.png) establish connected geography: continuous shoreline and foreground, rounded hills, rooted blue-canopy trees, sandstone cliffs, and teal/gold daylight. The title uses twilight indigo; Frieza's finale uses red-violet; Cooler shifts to cold violet-blue. All nine 960×540 backgrounds are local images and nearest-filtered. These are authored static backdrops; no environmental motion is claimed.
