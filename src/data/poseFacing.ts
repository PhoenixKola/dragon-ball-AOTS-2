// Which way each source pose is DRAWN (annotated by inspecting every pose crop: evidence/facing/*.png).
// L = faces/acts toward the left of the image, R = toward the right, F = front/symmetric (default).
// Allies stand on the left and must face RIGHT; enemies stand on the right and must face LEFT.
import { SPRITE_BOXES } from './spriteManifest.generated';
export type Facing = 'L' | 'R' | 'F';

// All battle art (new sheets) is drawn facing RIGHT, so allies are never mirrored and enemies always are.
const T: Record<string, Partial<Record<string, Facing>>> = {};
for (const [c, poses] of Object.entries(SPRITE_BOXES)) T[c] = Object.fromEntries(Object.keys(poses).map((p) => [p, 'R' as Facing]));

export const nativeFacing = (sprite: string, pose: string): Facing => T[sprite]?.[pose] ?? 'F';
export const wantedFacing = (side: 'ally' | 'enemy'): 'L' | 'R' => (side === 'ally' ? 'R' : 'L');

/**
 * Mirror only when the drawn direction opposes the direction the fighter must face.
 * Front-facing poses keep the historical rule (mirror enemies) so their weapon side stays consistent.
 */
export function shouldFlip(native: Facing, side: 'ally' | 'enemy'): boolean {
  if (native === 'F') return side === 'enemy';
  return native !== wantedFacing(side);
}
/** Power-up frames (Kaioken / Super Saiyan) are all drawn facing right or front: never mirrored for allies. */
export const POWERUP_FACING: Facing = 'R';
export const POSE_FACING_TABLE = T;
