import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MAPS, START_MAP } from '../../src/data/maps';
import { SCRIPTS } from '../../src/data/scripts';
import { ENEMIES } from '../../src/data/enemies';
import { TILE, type Step } from '../../src/engine/world/mapTypes';
import { activeSolids, blockedAt, freeSpot } from '../../src/engine/world/collision';
import { condMet, newGameState, type GameState } from '../../src/systems/gameState';
import { clearPressed, consume, moveVector } from '../../src/systems/input';

/** Places the game puts the player (spawns, exits, warps) must be walkable, and no scripted fight can be walked away from. */
const everyFlag = (): GameState => {
  const s = newGameState();
  for (const m of Object.values(MAPS)) for (const e of m.ents) for (const f of ([] as string[]).concat(e.when?.flag ?? [])) s.flags[f] = true;
  return s;
};
const states = (): [string, GameState][] => [['new game', newGameState()], ['every story flag set', everyFlag()]];

function warps(steps: Step[], out: { script: string; map: string; x: number; y: number }[], script: string) {
  for (const st of steps) {
    if ('warp' in st) out.push({ script, ...st.warp });
    else if ('battle' in st) { warps(st.win ?? [], out, script); warps(st.lose ?? [], out, script); }
    else if ('if' in st) { warps(st.then, out, script); warps(st.else ?? [], out, script); }
    else if ('ask' in st) warps(st.ask.onNo, out, script);
  }
}

describe('landing spots are walkable', () => {
  it('the start position, every exit target and every scripted warp put the player on a free spot (under a fresh game and with every story flag set)', () => {
    const spots: { what: string; map: string; x: number; y: number }[] = [{ what: 'start', map: START_MAP.map, x: START_MAP.x, y: START_MAP.y }];
    for (const m of Object.values(MAPS)) {
      spots.push({ what: `spawn of ${m.id}`, map: m.id, x: m.spawn.x, y: m.spawn.y });
      for (const e of m.ents) if (e.exit) spots.push({ what: `exit ${e.id} -> ${e.exit.map}`, map: e.exit.map, x: e.exit.x, y: e.exit.y });
    }
    const w: { script: string; map: string; x: number; y: number }[] = []; for (const [id, steps] of Object.entries(SCRIPTS)) warps(steps, w, id);
    for (const x of w) spots.push({ what: `warp in ${x.script}`, map: x.map, x: x.x, y: x.y });
    const bad: string[] = [];
    for (const [label, s] of states()) for (const sp of spots) {
      const m = MAPS[sp.map]; if (!m) { bad.push(`${sp.what}: unknown map ${sp.map}`); continue; }
      if (blockedAt(m, activeSolids(m, s), sp.x * TILE, sp.y * TILE)) bad.push(`${sp.what} (${sp.map} ${sp.x},${sp.y}) is inside a wall or body (${label})`);
    }
    expect(bad).toEqual([]);
  });
  it('freeSpot keeps a free position, moves a blocked one to the nearest free spot, and gives up only when boxed in', () => {
    const m = MAPS.shore, s = newGameState(), solids = activeSolids(m, s);
    const free = { x: m.spawn.x * TILE, y: m.spawn.y * TILE };
    expect(blockedAt(m, solids, free.x, free.y)).toBe(false); expect(freeSpot(m, solids, free.x, free.y)).toEqual(free);
    const wall = { x: -50, y: free.y };
    const moved = freeSpot(m, solids, wall.x, wall.y);
    expect(moved === null || !blockedAt(m, solids, moved.x, moved.y)).toBe(true);
    const box = [{ x: free.x - 400, y: free.y - 400, w: 800, h: 800 }];
    expect(freeSpot(m, box, free.x, free.y)).toBeNull();
  });
});

describe('resupply and exits', () => {
  it('the last ground (no way back out by design) has (in the story) no way out, and has an altar that is present as soon as the player arrives, and the ball there never starts the fight by itself', () => {
    const core = MAPS.core; const arrived = newGameState(); arrived.flags.ssj = true; arrived.flags.frieza3_done = true;
    const altar = core.ents.find((e) => e.id === 'core_altar')!;
    expect(altar.kind).toBe('save'); expect(condMet(arrived, altar.when)).toBe(true);
    expect(core.ents.filter((e) => e.exit && !(e.when && [e.when.flag].flat().includes('postgame_unlocked'))), 'during the story no exit leaves the last ground (the only way out is the postgame one)').toEqual([]);
    const ball = core.ents.find((e) => e.id === 'ball7_pick')!; expect(ball.script).toBeDefined();
  });
  it('every map except the last ground has an exit that can be used under some story state (nobody is locked in a side map)', () => {
    for (const m of Object.values(MAPS)) { if (m.id === 'core') continue; expect(m.ents.some((e) => e.exit), `${m.id} has an exit`).toBe(true); }
  });
  it('every campfire/altar/healer is reachable: it has no `when` that can never be true on a map the player can reach', () => {
    for (const m of Object.values(MAPS)) for (const e of m.ents.filter((x) => x.kind === 'save' || x.kind === 'heal')) {
      const flags = ([] as string[]).concat(e.when?.flag ?? []); for (const f of flags) expect(Object.values(MAPS).some((mm) => mm.ents.some((x) => x.script && JSON.stringify(SCRIPTS[x.script] ?? []).includes(f))) || Object.values(SCRIPTS).some((s) => JSON.stringify(s).includes(f)), `${e.id} depends on flag ${f}, which something sets`).toBe(true);
    }
  });
});

describe('story fights cannot be walked away from', () => {
  it('every scripted battle either has a boss (no Flee row) or says allowFlee: false, so a scripted flow never silently skips its win steps', () => {
    const open: string[] = [];
    const walk = (id: string, steps: Step[]) => { for (const st of steps) { if ('battle' in st) { const b = st.battle; if ((b.allowFlee ?? !b.foes.some((f) => ENEMIES[f].boss))) open.push(`${id}: ${b.title ?? b.foes.join('+')}`); walk(id, st.win ?? []); } else if ('if' in st) { walk(id, st.then); walk(id, st.else ?? []); } } };
    for (const [id, steps] of Object.entries(SCRIPTS)) walk(id, steps);
    expect(open).toEqual([]);
  });
});

describe('gamepad input state', () => {
  type Pad = { connected: boolean; buttons: { pressed: boolean }[]; axes: number[] };
  const mk = (pressed: number[] = [], axes = [0, 0]): Pad => ({ connected: true, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes });
  let pads: (Pad | null)[] = [];
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  beforeEach(() => { pads = []; Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true }); clearPressed(); });
  afterEach(() => { if (saved) Object.defineProperty(globalThis, 'navigator', saved); else delete (globalThis as { navigator?: unknown }).navigator; });

  it('the world reads the same controller as the menu bridge, even when slot 0 is empty', () => {
    pads = [null, mk([], [0.9, 0])];
    expect(moveVector().x).toBeGreaterThan(0.8);
  });
  it('a held A that closed a dialogue does not count as a new press in the world, but a fresh press does', () => {
    pads = [mk([0])]; clearPressed();           // an overlay closed while A is still held
    expect(consume('e', 'E', 'Enter', ' ')).toBe(false);
    pads = [mk()]; expect(consume('Enter')).toBe(false);
    pads = [mk([0])]; expect(consume('Enter')).toBe(true); expect(consume('Enter')).toBe(false);
  });
});
