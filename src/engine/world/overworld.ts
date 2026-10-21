import type { HeroId } from '../../types';
import { OVERWORLD } from '../../data/artManifest.generated';

export type Dir = 'down' | 'up' | 'left' | 'right';
export const OW_SCALE = 2; // frames are authored at display size, so they render 1:1

const stem = (f: string) => f.replace(/\.png$/, '');
export const owKey = (entity: string, dir: Dir, file: string) => `ow_${entity}_${dir}_${stem(file)}`;

/** Every texture the overworld needs: [key, url] (boot loader). */
export function overworldTextures(): [string, string][] {
  const out: [string, string][] = [];
  for (const [ent, v] of Object.entries(OVERWORLD)) for (const [dir, d] of Object.entries(v.dirs)) for (const f of new Set([...d.idle, ...d.walk])) out.push([owKey(ent, dir as Dir, f), `assets/reviewed/overworld/${ent}/${dir}/${f}`]);
  return out;
}

/** Frame to show for an entity facing `dir`. Idle uses idle_000; walking cycles the 4 walk frames at the manifest rate. */
export function owFrame(entity: string, dir: Dir, moving: boolean, tMs: number): { key: string; walkIndex: number } {
  const e = OVERWORLD[entity]; if (!e) throw new Error('Unknown overworld entity ' + entity);
  const d = e.dirs[dir];
  if (!moving || d.walk.length === 0) return { key: owKey(entity, dir, d.idle[0]), walkIndex: -1 };
  const i = Math.floor(tMs / d.walkMs) % d.walk.length;
  return { key: owKey(entity, dir, d.walk[i]), walkIndex: i };
}

/** Which overworld set represents a hero right now. Provisional (unapproved) sets are only returned when allowed. */
export function heroOverworld(id: HeroId, o: { ssj?: boolean; fused?: boolean }, allowProvisional: boolean): { entity: string; provisional: boolean } | null {
  let entity: string | null = null;
  switch (id) {
    case 'gohan': entity = 'gohan_namek'; break;
    case 'krillin': entity = 'krillin'; break;
    case 'vegeta': entity = 'vegeta'; break;
    case 'goku': entity = o.ssj ? 'goku_ssj_test' : 'goku_base'; break;   // SSJ only after the story unlock sets member.ssj
    case 'trunks': entity = 'trunks'; break;
    case 'piccolo': entity = o.fused ? 'piccolo_fused' : 'piccolo'; break;
    default: entity = null;                                                  // Dende / Nail have no overworld art
  }
  if (!entity || !OVERWORLD[entity]) return null;
  const provisional = !OVERWORLD[entity].approved;
  if (provisional && !allowProvisional) return null;
  return { entity, provisional };
}

/** Facing from an input vector: dominant axis wins; ties keep the previous facing so diagonals never flicker. */
export function dirFromVector(x: number, y: number, prev: Dir): Dir {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax === 0 && ay === 0) return prev;
  if (ax > ay * 1.05) return x > 0 ? 'right' : 'left';
  if (ay > ax * 1.05) return y > 0 ? 'down' : 'up';
  return prev;
}

/** Direction toward a point (NPCs turning to face the player). */
export function dirToward(dx: number, dy: number): Dir {
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}
