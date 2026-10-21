import type { Ent, MapDef } from './mapTypes';
import { TILE } from './mapTypes';
import { condMet, type GameState } from '../../systems/gameState';

export interface Rect { x: number; y: number; w: number; h: number }
export const PLAYER_HW = 8;
export const PLAYER_HH = 5;

export function staticSolids(m: MapDef): Rect[] {
  const out: Rect[] = [];
  for (const o of m.objs) if (o.solid) out.push({ x: o.x * TILE - (o.solid[0] * TILE) / 2, y: o.y * TILE - o.solid[1] * TILE, w: o.solid[0] * TILE, h: o.solid[1] * TILE });
  return out;
}
export function entSolid(e: Ent): Rect | null {
  const x = e.x * TILE, y = e.y * TILE;
  if (e.solid) return { x: x - (e.solid[0] * TILE) / 2, y: y - e.solid[1] * TILE, w: e.solid[0] * TILE, h: e.solid[1] * TILE };
  if (['npc', 'heal', 'shop'].includes(e.kind)) return { x: x - 11, y: y - 10, w: 22, h: 10 };
  return null;
}
export function cellAt(m: MapDef, tx: number, ty: number) { return m.ground[ty]?.[tx] ?? 'x'; }

/** Is a player whose feet are at pixel (x, y) colliding with terrain or any solid? */
export function blockedAt(m: MapDef, solids: Rect[], x: number, y: number): boolean {
  const pts = [[x - PLAYER_HW, y - PLAYER_HH], [x + PLAYER_HW, y - PLAYER_HH], [x - PLAYER_HW, y], [x + PLAYER_HW, y]];
  for (const [cx, cy] of pts) {
    const tx = Math.floor(cx / TILE), ty = Math.floor(cy / TILE);
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    const c = cellAt(m, tx, ty);
    if (c === '~' || c === 'x') return true;
  }
  for (const r of solids) if (x + PLAYER_HW > r.x && x - PLAYER_HW < r.x + r.w && y > r.y && y - PLAYER_HH < r.y + r.h) return true;
  return false;
}

/** Flood-fill on an 8px lattice. Returns a predicate telling whether a pixel position is reachable from (sx, sy). */
export function reachability(m: MapDef, solids: Rect[], sx: number, sy: number) {
  const S = 8, W = Math.ceil((m.w * TILE) / S), H = Math.ceil((m.h * TILE) / S);
  const seen = new Uint8Array(W * H);
  const q: number[] = [];
  const start = Math.floor(sy / S) * W + Math.floor(sx / S);
  seen[start] = 1; q.push(start);
  while (q.length) {
    const c = q.pop()!; const cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny * W + nx; if (seen[k]) continue;
      if (blockedAt(m, solids, nx * S + S / 2, ny * S + S / 2)) continue;
      seen[k] = 1; q.push(k);
    }
  }
  return (px: number, py: number, slack = 40): boolean => {
    for (let dy = -slack; dy <= slack; dy += S) for (let dx = -slack; dx <= slack; dx += S) {
      const x = Math.floor((px + dx) / S), y = Math.floor((py + dy) / S);
      if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x]) return true;
    }
    return false;
  };
}

/** Solids that exist under the given state: static object footprints plus the bodies of the entities present (a defeated patrol leaves none). */
export function activeSolids(m: MapDef, s: GameState): Rect[] {
  const ents = m.ents.filter((e) => condMet(s, e.when)).filter((e) => !(e.kind === 'foe' && s.flags['foe:' + e.id]));
  return [...staticSolids(m), ...ents.map(entSolid).filter((r): r is Rect => !!r)];
}

/** The given foot position if it is walkable, else the nearest walkable one within ~3 tiles (rings of 4px steps); null if none. Safety net against spawning inside a wall. */
export function freeSpot(m: MapDef, solids: Rect[], x: number, y: number): { x: number; y: number } | null {
  if (!blockedAt(m, solids, x, y)) return { x, y };
  for (let r = 4; r <= TILE * 3; r += 4) {
    let best: { x: number; y: number; d: number } | null = null;
    for (let a = 0; a < 360; a += 15) {
      const px = x + Math.cos((a * Math.PI) / 180) * r, py = y + Math.sin((a * Math.PI) / 180) * r;
      if (!blockedAt(m, solids, px, py) && (!best || Math.hypot(px - x, py - y) < best.d)) best = { x: px, y: py, d: Math.hypot(px - x, py - y) };
    }
    if (best) return { x: best.x, y: best.y };
  }
  return null;
}
