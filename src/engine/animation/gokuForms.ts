import { POWERUP_SETS, type PowerupSetId } from '../../data/powerupSprites.generated';
import type { Pose } from './clips';

/**
 * Goku's visual form is chosen here and nowhere else. The three forms never overwrite each other globally:
 *  - ssj:     only after the story unlock (`ssj` flag on the fighter, set by the {transform:'ssj'} script step)
 *  - kaioken: only while the Kaioken status is active, or during Kaioken skills (the activation and the assault)
 *  - base:    black-haired Goku in every other case (title, world, battles before the unlock): the goku_<pose>.png stills, no frame set
 */
export type GokuForm = 'base' | 'kaioken' | 'ssj';
export const KAIOKEN_SKILLS: ReadonlySet<string> = new Set(['kaioken', 'kaiokenassault']);

export interface FormInput { defId: string; ssj: boolean; statuses: readonly { kind: string }[] }

export function gokuForm(f: FormInput, activeSkillId?: string): GokuForm {
  if (f.defId !== 'goku') return 'base';
  if (f.ssj) return 'ssj';
  if (f.statuses.some((s) => s.kind === 'kaioken') || (activeSkillId !== undefined && KAIOKEN_SKILLS.has(activeSkillId))) return 'kaioken';
  return 'base';
}
export const formSet = (form: GokuForm): PowerupSetId | null => (form === 'kaioken' ? 'goku_kaioken' : form === 'ssj' ? 'goku_ssj' : null);
/** Kaioken and SSJ frames have their aura baked in; base Goku (stills) is aura-free so procedural auras (charge, Sparking) still apply. */
export const hasBakedAura = (set: PowerupSetId | null) => set === 'goku_kaioken' || set === 'goku_ssj';
export const frameTexKey = (name: string) => `pw_${name}`;

export interface FormAnim { frames: string[]; fps: number; loop: boolean }

/**
 * Pose -> frame mapping. The tables live in powerupSprites.generated.ts (tools/slice_goku_forms.py):
 * the Kaioken idle list already skips the wrong-costume source frame (ping-pong 1-2-3-2); `guard` is the crouched ready stance
 * (the supplied sheets have no crossed-arms frame); `victory` is the raised-fist frame; `ko` is the flat frame.
 */

/** Which sliced frames play for a pose. `attackIdx` walks the melee frames so a flurry shows different strikes. */
export function formAnim(set: PowerupSetId, pose: Pose, o: { attackIdx?: number; holdMs?: number } = {}): FormAnim {
  const a = POWERUP_SETS[set].anims;
  const pick = (list: string[] | undefined, i: number) => (list && list.length ? [list[Math.min(i, list.length - 1)]] : []);
  switch (pose) {
    case 'idle': return { frames: a.idle, fps: 7, loop: true };
    case 'charge': return { frames: a.powerup, fps: 10, loop: true };
    case 'attack': {
      const seq = [1, 2, 3, 4, 2, 3]; // dash, punch, punch+crescent, kick+crescent, ...
      return { frames: pick(a.attack, seq[(o.attackIdx ?? 0) % seq.length]), fps: 0, loop: false };
    }
    case 'special': return { frames: pick(a.beam, 2), fps: 0, loop: false };
    case 'guard': return { frames: pick(a.guard, 0), fps: 0, loop: false };
    case 'hurt': return { frames: pick(a.hurt, (o.holdMs ?? 0) >= 400 ? 1 : 0), fps: 0, loop: false };
    case 'ko': return { frames: pick(a.ko, 0), fps: 0, loop: false };
    case 'victory': return { frames: pick(a.victory, 0), fps: 0, loop: false };
  }
}

/** Every frame file the loader must fetch. */
export function powerupFrameNames(): string[] {
  const out = new Set<string>();
  for (const s of Object.values(POWERUP_SETS)) for (const list of Object.values(s.anims)) for (const n of list) out.add(n);
  return [...out];
}
