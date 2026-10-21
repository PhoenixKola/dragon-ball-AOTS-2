import { MAPS } from '../../src/data/maps';
import { TILE, type Ent, type MapDef } from '../../src/engine/world/mapTypes';
import { blockedAt, entSolid, staticSolids, type Rect } from '../../src/engine/world/collision';
import { condMet, type GameState } from '../../src/systems/gameState';

/** Test support: walking paths on the REAL collision data (terrain, object footprints, NPC bodies present under the current flags). */
export interface Pt { x: number; y: number }   // pixels, feet position
const S = 4;   // fine lattice: exit/trigger bands at map edges can be only a few pixels thick

/** Solids active for a given state: static object footprints plus entity bodies whose `when` condition holds. */
export function solidsFor(m: MapDef, s: GameState | null): Rect[] {
  const ents = m.ents.filter((e) => !s || condMet(s, e.when)).filter((e) => !(e.kind === 'foe' && s?.flags['foe:' + e.id]));
  return [...staticSolids(m), ...ents.map(entSolid).filter((r): r is Rect => !!r)];
}

export function entCenterPx(e: Ent): Pt { return { x: e.x * TILE, y: e.y * TILE }; }

const latticeCache = new Map<string, Int8Array>();
/** Per map + solid set: 0 = not computed, 1 = free, 2 = blocked (terrain and solids only; story-zone avoidance is applied on top). */
function lattice(m: MapDef, solids: Rect[], margin = 0): Int8Array {
  const key = margin + '|' + m.id + '|' + solids.map((r) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`).join(';');
  let g = latticeCache.get(key);
  if (!g) { g = new Int8Array(Math.ceil((m.w * TILE) / S) * Math.ceil((m.h * TILE) / S)); latticeCache.set(key, g); if (latticeCache.size > 400) latticeCache.delete(latticeCache.keys().next().value as string); }
  return g;
}

/** A* over a 4px lattice. Returns waypoints in pixels, or null when unreachable. `accept` decides when the goal is reached (default: within `slack` px). */
export function findPath(m: MapDef, solids: Rect[], from: Pt, goal: Pt, slack = 20, accept?: (p: Pt) => boolean, avoid?: (p: Pt) => boolean, margin = 0): Pt[] | null {
  const W = Math.ceil((m.w * TILE) / S), H = Math.ceil((m.h * TILE) / S);
  const grid = lattice(m, solids, margin);
  const hit = (x: number, y: number) => blockedAt(m, solids, x, y) || (margin > 0 && (blockedAt(m, solids, x + margin, y) || blockedAt(m, solids, x - margin, y) || blockedAt(m, solids, x, y + margin) || blockedAt(m, solids, x, y - margin)));
  const terrainFree = (cx: number, cy: number) => { const k = cy * W + cx; let v = grid[k]; if (!v) { v = hit(cx * S + S / 2, cy * S + S / 2) ? 2 : 1; grid[k] = v; } return v === 1; };
  const free = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < W && cy < H && terrainFree(cx, cy) && !(avoid && avoid({ x: cx * S + S / 2, y: cy * S + S / 2 }));
  const sx = Math.floor(from.x / S), sy = Math.floor(from.y / S);
  const gx = Math.floor(goal.x / S), gy = Math.floor(goal.y / S);
  const near = (cx: number, cy: number) => (accept ? accept({ x: cx * S + S / 2, y: cy * S + S / 2 }) : Math.hypot(cx - gx, cy - gy) * S <= slack);
  const g = new Float64Array(W * H).fill(Infinity); const prev = new Int32Array(W * H).fill(-1);
  const open: [number, number][] = [];
  const push = (it: [number, number]) => { open.push(it); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0]; const last = open.pop()!; if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let mm = i; if (l < open.length && open[l][0] < open[mm][0]) mm = l; if (r < open.length && open[r][0] < open[mm][0]) mm = r; if (mm === i) break; [open[mm], open[i]] = [open[i], open[mm]]; i = mm; } } return top; };
  const h = (cx: number, cy: number) => Math.hypot(cx - gx, cy - gy);
  const start = sy * W + sx; g[start] = 0; push([h(sx, sy), start]);
  let found = -1;
  while (open.length) {
    const [, cur] = pop();
    const cx = cur % W, cy = (cur / W) | 0;
    if (near(cx, cy)) { found = cur; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (!free(nx, ny)) continue;
      if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue;
      const k = ny * W + nx; const ng = g[cur] + (dx && dy ? 1.414 : 1);
      if (ng < g[k]) { g[k] = ng; prev[k] = cur; push([ng + h(nx, ny), k]); }
    }
  }
  if (found < 0) return null;
  const cells: Pt[] = []; for (let c = found; c !== -1; c = prev[c]) cells.push({ x: (c % W) * S + S / 2, y: ((c / W) | 0) * S + S / 2 });
  cells.reverse();
  // string-pull: keep only the corners where a straight walk would collide
  const clear = (a: Pt, b: Pt) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2); for (let i = 1; i <= n; i++) { const t = i / n; const qx = a.x + (b.x - a.x) * t, qy = a.y + (b.y - a.y) * t; if (hit(qx, qy) || (avoid && avoid({ x: qx, y: qy }))) return false; } return true; };
  const out: Pt[] = [cells[0]]; let anchor = 0;
  for (let i = 2; i < cells.length; i++) if (!clear(cells[anchor], cells[i])) { out.push(cells[i - 1]); anchor = i - 1; }
  out.push(cells[cells.length - 1]);
  return out;
}

export const pathLengthPx = (p: Pt[]) => p.reduce((a, q, i) => (i ? a + Math.hypot(q.x - p[i - 1].x, q.y - p[i - 1].y) : 0), 0);

/** Pixels of the path that lie inside the map's random-encounter zones (each TILE of movement there counts as one step). */
export function encounterPixels(m: MapDef, p: Pt[]): number {
  if (!m.encounters || m.safe) return 0;
  let total = 0;
  for (let i = 1; i < p.length; i++) {
    const n = Math.ceil(Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y) / 4);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; const x = (p[i - 1].x + (p[i].x - p[i - 1].x) * t) / TILE, y = (p[i - 1].y + (p[i].y - p[i - 1].y) * t) / TILE; if (m.encounters.zones.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) total += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y) / n; }
  }
  return total;
}
export { MAPS };
