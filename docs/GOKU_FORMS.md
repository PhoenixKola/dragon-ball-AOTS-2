# Goku forms and battle frames

| Form | Routing | Body animation | Aura |
|---|---|---|---|
| **Base** | Default until the story unlock; remains the world and title form. | Four-frame idle, four-frame melee, four-frame charge and signature release, four-frame guard and hurt, plus dedicated KO and victory poses. | Skill/status aura only. |
| **Kaioken** | Active only while the Kaioken status or one of its two skills is active; SSJ still takes precedence. | Uses the approved base Goku face, costume and body proportions on the 288×272 power-up canvas. The four-frame idle, attack, guard, hurt and Kamehameha sequences are matched cuts from base Goku; power-up has its own four authored drawings. KO and victory use base Goku's approved poses. | A four-frame transparent red flame ring loops independently behind Goku, with an open center and reduced-flash alpha. It is not baked into body art or mixed with gold SSJ flames. |
| **Super Saiyan** | Active only when the story's persistent `ssj` flag is set. Trunks has a separate `ssjform` route. | Four-frame idle and charge, six attack drawings, four-beat beam sequence, new four-frame guard and four-frame hurt/recovery, plus its own KO/victory art. | Gold flame stays independent from body frames and respects the reduced-flash setting. |

`gokuForm()` and `formSet()` live in [gokuForms.ts](../src/engine/animation/gokuForms.ts). `BattleScene` applies the route after combat updates. `battleAnimationFrames.ts` registers and preloads every runtime frame; generated names use the `pw_` texture namespace so the form canvas and pivot remain consistent.

## Kaioken production path

The earlier Kaioken sheet did not hold the approved base Goku proportions. It is retained as source history, but its body poses are no longer drawn. `tools/build_kaioken_frames.py` rebuilds the form from approved base Goku frames and a dedicated generated charge strip. The latter is cut by `tools/slice_batch4_contact.py`, which removes the generated checker matte, rejects detached neighbor pixels, uses nearest-neighbor scaling and writes the fixed (144, 232) pivot canvas. The body frames and red aura can therefore animate independently.

## Generated-frame acceptance

The current contact sources are under the ignored `art-sources/production/batch4/` folder. Runtime cuts are reviewed under `public/assets/reviewed/actors/`. The slicer only accepts frames with a nonempty alpha bound, a stable canvas and baseline, one connected body silhouette, and no pale outline fringe. The SSJ hurt strip's second cell originally contained a boot from its neighbor; that cell was rejected and recut with detached-pixel filtering before it entered the runtime mapping. The replacement frames were checked individually: hurt frame 01 has two hands and both full boots; frame 02 has no neighboring boot, and every frame has transparent corners and the shared foot anchor. The aura is cut separately so its enclosed center is also transparent.

`gokuForm()` keeps base, Kaioken and SSJ selection separate. The story unlock flag, Ki drain rules, save data and combat damage timing remain owned by the existing gameplay systems.
