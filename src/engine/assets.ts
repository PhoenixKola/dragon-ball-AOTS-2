import { SPRITE_BOXES, type Box } from '../data/spriteManifest.generated';
import type { Pose } from './animation/clips';

export const ACTOR_DIR = 'assets/reviewed/actors';
export const CANVAS = 176;          // legacy actor crops are 176x176; v4 sprites (HIRES_SPRITES) use a 352x352 canvas with the same relative anchor
export const ANCHOR_X = 88 / CANVAS;
export const ANCHOR_Y = 172 / CANVAS; // feet baseline (all poses verified bottom-centre registered)

/** Every battle sprite is authored on a 448x448 canvas (anchor (224,438): the same fractions as the old 176 canvas). */
export const HIRES_SPRITES = new Set(['dende', 'nail', 'zarbon2', 'soldier', 'gohan', 'krillin', 'piccolo', 'vegeta', 'goku', 'ssj_goku', 'cui', 'dodoria', 'zarbon', 'guldo', 'recoome', 'burter', 'jeice', 'ginyu', 'frieza1', 'frieza2', 'frieza3', 'frieza4', 'frieza5', 'cooler', 'trunks', 'trunks_ssj']);
/** Sprites whose 'charge' crop is a clean body pose (no baked aura rectangle), so it may play. */
const CLEAN_CHARGE = new Set(HIRES_SPRITES);

/**
 * Poses that exist as files but are visually unusable (identity/recolour defects or non-body fragments).
 * Each is routed to a safe stand-in and listed in docs/REQUIRED_MISSING_ASSETS.md; the animation system never
 * shows them. Key: `<sprite>:<pose>`.
 */
export const BLOCKED_POSES: Record<string, Pose> = {
};
/** Poses whose crop is a lying body: fine for KO, wrong for a light flinch. */
export function isLyingHurt(sprite: string): boolean {
  if (SPRITE_BOXES[sprite]?.ko) return false;   // a dedicated KO pose exists, so 'hurt' is a real flinch
  const b = SPRITE_BOXES[sprite]?.hurt;
  return !!b && (b[2] - b[0]) / (b[3] - b[1]) > 1.25;
}

// 'charge' deliberately skips the charge crops: their baked aura is a clipped rectangle. Clean stances + procedural auras are used instead.
const FALLBACK: Record<Pose, Pose[]> = {
  idle: ['idle'], attack: ['attack', 'idle'], charge: ['guard', 'idle'], hurt: ['hurt', 'idle'],
  guard: ['guard', 'idle'], special: ['special', 'attack', 'idle'], victory: ['victory', 'idle'], ko: ['ko', 'hurt', 'idle'],
};

export function resolvePose(sprite: string, pose: Pose): Pose {
  const boxes = SPRITE_BOXES[sprite];
  if (!boxes) throw new Error('Unknown sprite ' + sprite);
  const order = pose === 'charge' && CLEAN_CHARGE.has(sprite) ? ['charge', 'guard', 'idle'] : FALLBACK[pose];
  for (const p of order as Pose[]) {
    const blocked = BLOCKED_POSES[`${sprite}:${p}`];
    if (blocked) { if (blocked !== p && boxes[blocked]) return blocked; continue; }
    if (boxes[p]) return p;
  }
  return 'idle';
}

export const texKey = (sprite: string, pose: string) => `a_${sprite}_${pose}`;
export const spriteBox = (sprite: string, pose: string): Box => SPRITE_BOXES[sprite][pose] ?? SPRITE_BOXES[sprite].idle;
/** Form sprites that must keep the base form's body size (their idle box is taller because of the hair). */
const SCALE_REF: Record<string, string> = { trunks_ssj: 'trunks' };
export const scaleHeight = (sprite: string) => idleSize(SCALE_REF[sprite] ?? sprite).h;
export const idleSize = (sprite: string) => { const b = SPRITE_BOXES[sprite].idle; return { w: b[2] - b[0], h: b[3] - b[1] }; };
export const allSprites = () => Object.keys(SPRITE_BOXES);
export const posesOf = (sprite: string) => Object.keys(SPRITE_BOXES[sprite]);
