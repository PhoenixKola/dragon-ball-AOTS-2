# Still-missing art (named blockers)

Generated from `docs/FINAL_ART_ACCEPTANCE.csv` by `tools/gen_acceptance_csv.py`. Nothing below is faked: the engine uses a labelled fallback (see `src/engine/assets.ts`).

| ID | What is missing | Why / fallback |
|---|---|---|
| `frieza2:victory` | battle pose | Beta 3 candidate retained-fallback: No genuine victory frame on the sheet (piece 7 is a roaring claw pose that duplicates charge); not relabelled. Idle is used (src/engine/assets.ts) |
| `soldier:special` | battle pose | Beta 3 candidate retained-fallback: No distinct clean special frame: the only clean palm-thrust (piece 26) is already the attack, and every other cast frame carries baked crescents / beams / glows (pieces 20-24, 27-30 rejected). Falls back to attack |
| `zarbon2:special` | battle pose | Beta 3 candidate rejected: Candidate set is a different design (no cape, purple shorts, orange boots, tail) from the installed monstrous Zarbon; mixing it would break the creature identity. Installed charge/attack fallback kept |

## Also still open (not representable as one pose each)
- Genuine multi-frame battle animation (4-6 frame idle loops, wind-up / strike / recovery) for every fighter other than Kaioken / Super Saiyan Goku. All motion is choreography over key poses.
- Frieza form-to-form morph frames (1 to 2 to 3 to 4 to 5) and the Zarbon transformation frames.
- Soldier art is one shared hornless trooper for scout, elite, Frost Guard and Frost Elite (palette-identical variants); soldier special has no distinct clean frame.
- Field costumes for fused Piccolo and a field sprite for Cooler; hand-timed walk cycles (the sheets give 3-4 poses per direction).
- Elders, villagers, children, trader and healer still use the earlier atlas objects.
- Real recorded or composed music and sound effects (everything is procedural synthesis, including the two new Cooler tracks).
