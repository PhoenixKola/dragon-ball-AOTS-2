# Goku forms and battle frames

| Form | Routing | Body animation | Aura |
|---|---|---|---|
| **Base** | Default until the story unlock; remains the world and title form. | Four-frame idle, four-frame melee, four-frame charge and signature release, four-frame guard and hurt, plus dedicated KO and victory poses. | Skill/status aura only. |
| **Kaioken** | Active only while the Kaioken status or one of its two skills is active; SSJ still takes precedence. | Uses the approved base Goku face, costume and body proportions on the 288×272 power-up canvas. The four-frame idle, attack, guard, hurt and Kamehameha sequences are matched cuts from base Goku; power-up has its own four authored drawings. KO and victory use base Goku's approved poses. | A four-frame transparent red flame ring loops independently behind Goku, with an open center and reduced-flash alpha. It is not baked into body art or mixed with gold SSJ flames. |
| **Super Saiyan** | Active only when the story's persistent `ssj` flag is set. Trunks has a separate `ssjform` route. | New four-frame idle, authored guard, punch, kick and energy-release poses. The idle cycle also carries charge; KO retains its dedicated pose. | Gold flame stays independent from body frames and respects the reduced-flash setting. |

`gokuForm()` and `formSet()` live in [gokuForms.ts](../src/engine/animation/gokuForms.ts). `BattleScene` applies the route after combat updates. `battleAnimationFrames.ts` registers and preloads every runtime frame; generated names use the `pw_` texture namespace so the form canvas and pivot remain consistent.

## Kaioken production path

The earlier Kaioken sheet did not hold the approved base Goku proportions. It is retained as source history, but its body poses are no longer drawn. `tools/build_kaioken_frames.py` rebuilds the form from approved base Goku frames and a dedicated generated charge strip. The latter is cut by `tools/slice_batch4_contact.py`, which removes the generated checker matte, rejects detached neighbor pixels, uses nearest-neighbor scaling and writes the fixed (144, 232) pivot canvas. The body frames and red aura can therefore animate independently.

## Generated-frame acceptance

The current SSJ source atlas is `art-sources/goku-ssj-v2/goku_ssj_sprite_atlas.png`; `tools/slice_goku_ssj_v2.py` registers its eight poses on the shared canvas. Runtime cuts are reviewed under `public/assets/reviewed/actors/`. Kaioken production contact sources remain under the ignored `art-sources/production/batch4/` folder.

`gokuForm()` keeps base, Kaioken and SSJ selection separate. The story unlock flag, Ki drain rules, save data and combat damage timing remain owned by the existing gameplay systems.
