import { describe, it, expect } from 'vitest';
import { MAPS } from '../../src/data/maps';
import { SCRIPTS } from '../../src/data/scripts';
import { newGameState, collectBall, ownedBalls, condMet, setFlags, clearFlags, type GameState } from '../../src/systems/gameState';
import { serialize, deserialize, exportText, importText, validateState, writeSlot, readSlot, migrateLegacy } from '../../src/systems/save';
import type { Step } from '../../src/engine/world/mapTypes';

const ALL = [1, 2, 3, 4, 5, 6, 7];
function shuffled(seed: number) { const a = [...ALL]; let x = seed; for (let i = a.length - 1; i > 0; i--) { x = (x * 1103515245 + 12345) & 0x7fffffff; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** Collects the `say` lines a script would show for this state (follows `if` branches with the real condMet). */
function said(steps: Step[], s: GameState, out: string[] = []): string[] {
  for (const st of steps) {
    if ('say' in st) st.say.forEach((l) => out.push(l[1]));
    else if ('if' in st) said(condMet(s, st.if) ? st.then : st.else ?? [], s, out);
  }
  return out;
}

describe('Dragon Ball ownership', () => {
  it('only Ball 5 collected => exactly 1 owned and it is the five-star ball', () => {
    const s = newGameState(); expect(collectBall(s, 5)).toBe(true);
    expect(s.balls).toBe(1); expect(ownedBalls(s)).toEqual([5]); expect(s.flags.ball5).toBe(true); expect(s.flags.ball4).toBeFalsy();
  });
  it('replaying a pickup never increments the count', () => {
    const s = newGameState(); collectBall(s, 3);
    expect(collectBall(s, 3)).toBe(false); expect(collectBall(s, 3)).toBe(false); expect(s.balls).toBe(1);
    setFlags(s, 'ball3'); expect(s.balls).toBe(1);
  });
  it('rejects invalid star numbers', () => {
    const s = newGameState(); for (const n of [0, 8, -1, 2.5, NaN]) expect(collectBall(s, n)).toBe(false); expect(s.balls).toBe(0);
  });
  it('all seven in any order => 7; leaving one out => 6', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const order = shuffled(seed); const s = newGameState();
      order.slice(0, 6).forEach((n) => collectBall(s, n)); expect(s.balls).toBe(6);
      collectBall(s, order[6]); expect(s.balls).toBe(7); expect(ownedBalls(s)).toEqual(ALL);
    }
  });
  it('clearing a ball flag is reflected in the count (flags are the single source of truth)', () => {
    const s = newGameState(); ALL.forEach((n) => collectBall(s, n)); clearFlags(s, 'ball4'); expect(s.balls).toBe(6); expect(ownedBalls(s)).not.toContain(4);
  });
  it('script ball steps map to their own star', () => {
    for (const [id, sc] of Object.entries(SCRIPTS)) {
      const m = /^ball(\d)_pick$/.exec(id); if (!m) continue;
      const step = sc.find((x) => 'ball' in x) as { ball: number }; expect(step.ball, id).toBe(Number(m[1]));
    }
  });
});

describe('Dragon Ball acquisition scripts', () => {
  /** Walks steps in order; fails if ballN is set (via `set`) before the `{ ball: N }` step. Recurses into win/then/else. */
  function check(steps: Step[], id: string, n: number): { sawBall: boolean } {
    let sawBall = false;
    for (const st of steps) {
      if ('set' in st) expect([st.set].flat(), `${id} must not set ball${n} itself`).not.toContain(`ball${n}`);
      if ('ball' in st && st.ball === n) sawBall = true;
      if ('battle' in st) sawBall = check(st.win ?? [], id, n).sawBall || sawBall;
      if ('if' in st) sawBall = check(st.then, id, n).sawBall || check(st.else ?? [], id, n).sawBall || sawBall;
    }
    return { sawBall };
  }
  it('every ball 1-7 is awarded by exactly one { ball: N } step and never pre-set by a { set } step', () => {
    for (const n of ALL) {
      const id = n === 1 ? 'village_enter' : `ball${n}_pick`;
      expect(check(SCRIPTS[id], id, n).sawBall, id).toBe(true);
    }
  });
  it('no script anywhere sets a ballN flag directly', () => {
    const walk = (steps: Step[], id: string) => { for (const st of steps) {
      if ('set' in st) expect([st.set].flat().filter((f) => /^ball[1-7]$/.test(f)), id).toEqual([]);
      if ('battle' in st) { walk(st.win ?? [], id); walk(st.lose ?? [], id); }
      if ('if' in st) { walk(st.then, id); walk(st.else ?? [], id); }
    } };
    for (const [id, sc] of Object.entries(SCRIPTS)) walk(sc, id);
  });
});

describe('Dragon Balls in saves', () => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; }, key: (i: number) => Object.keys(store)[i] ?? null, get length() { return Object.keys(store).length; } };

  it('serialize -> validate round-trips the owned set, not just a count', () => {
    const s = newGameState(); collectBall(s, 2); collectBall(s, 7);
    const r = validateState(JSON.parse(JSON.stringify(s))); expect(r.ok).toBe(true);
    if (r.ok) { expect(ownedBalls(r.state)).toEqual([2, 7]); expect(r.state.balls).toBe(2); }
  });
  it('a stored count that disagrees with the flags is normalised to the flags without inventing pickups', () => {
    const s = newGameState(); collectBall(s, 1);
    const raw = JSON.parse(JSON.stringify(s)); raw.balls = 7;
    const hi = validateState(raw); expect(hi.ok && hi.state.balls).toBe(1);
    const raw2 = JSON.parse(JSON.stringify(s)); raw2.balls = 0;
    const lo = validateState(raw2); expect(lo.ok && lo.state.balls).toBe(1);
    const raw3 = JSON.parse(JSON.stringify(newGameState())); raw3.balls = 3;
    const none = validateState(raw3); expect(none.ok && none.state.balls).toBe(0);
  });
  it('checksummed serialize/deserialize and export/import text keep the owned set', () => {
    const s = newGameState(); collectBall(s, 1); collectBall(s, 5);
    const a = deserialize(serialize(s)); expect(a.ok && ownedBalls(a.state)).toEqual([1, 5]);
    const b = importText(exportText(s)); expect(b.ok && ownedBalls(b.state)).toEqual([1, 5]);
    const tampered = JSON.parse(exportText(s)); tampered.balls = 7; const c = importText(JSON.stringify(tampered)); expect(c.ok && c.state.balls).toBe(2);
  });
  it('out-of-range stored counts are still rejected', () => {
    const raw = JSON.parse(JSON.stringify(newGameState())); raw.balls = 9; expect(validateState(raw).ok).toBe(false);
  });
  it('write/read slot keeps ownership and backs up the previous save', () => {
    const s = newGameState(); collectBall(s, 6); expect(writeSlot(1, s)).toBe(true);
    collectBall(s, 4); expect(writeSlot(1, s)).toBe(true);
    const r = readSlot(1); expect(r && r.ok && ownedBalls(r.state)).toEqual([4, 6]);
    expect(Object.keys(store).some((k) => /bak/i.test(k))).toBe(true);
  });
  it('legacy v2 migration derives balls from checkpoint flags, ignoring a bogus old count', () => {
    store['aots2-namek-save-v2'] = JSON.stringify({ index: 14, actors: {}, inventory: {}, coins: 10, balls: 7 });
    const m = migrateLegacy(); expect(m).not.toBeNull();
    if (m) { expect(ownedBalls(m.state)).toEqual([1, 2, 3]); expect(m.state.balls).toBe(3); }
    store['aots2-namek-save-v2'] = JSON.stringify({ index: 6, actors: {}, inventory: {}, coins: 10, balls: 0 });
    const m2 = migrateLegacy(); expect(m2 && m2.state.balls).toBe(1);
  });
});

describe('finale and ending rules (real conditions, real positions)', () => {
  const trig = (mapId: string, id: string) => MAPS[mapId].ents.find((e) => e.id === id)!;
  it('final battle only starts with ssj and before final_done; the epilogue only after final_done', () => {
    const s = newGameState(); const f = trig('core', 'core_final'), ep = trig('core', 'core_epilogue');
    expect(condMet(s, f.when)).toBe(false);
    setFlags(s, 'ssj'); expect(condMet(s, f.when)).toBe(true); expect(condMet(s, ep.when)).toBe(false);
    setFlags(s, 'final_done'); expect(condMet(s, f.when)).toBe(false); expect(condMet(s, ep.when)).toBe(true);
  });
  it('Ball 7 is offered after the unlock, vanishes once collected, and does not overlap the fight trigger', () => {
    const b = trig('core', 'ball7_pick'), f = trig('core', 'core_final');
    const s = newGameState(); expect(condMet(s, b.when)).toBe(false); setFlags(s, 'ssj'); expect(condMet(s, b.when)).toBe(true);
    collectBall(s, 7); expect(condMet(s, b.when)).toBe(false);
    const inside = b.x >= f.x - (f.w ?? 1) / 2 && b.x <= f.x + (f.w ?? 1) / 2 && b.y >= f.y - (f.h ?? 1) / 2 && b.y <= f.y + (f.h ?? 1) / 2;
    expect(inside, 'picking up the ball must not start the fight').toBe(false);
  });
  it('the finale never requires all seven balls (no trap on core) and the ending text matches what the player owns', () => {
    const f = trig('core', 'core_final'); const s = newGameState(); setFlags(s, 'ssj');
    expect(condMet(s, f.when)).toBe(true);
    const none = said(SCRIPTS.epilogue, s).join(' ');
    expect(none).toMatch(/never had all seven/); expect(none).not.toMatch(/Porunga rose/);
    const six = newGameState(); [1, 2, 3, 4, 5, 6].forEach((n) => collectBall(six, n));
    expect(said(SCRIPTS.epilogue, six).join(' ')).toMatch(/never had all seven/);
    const all = newGameState(); ALL.forEach((n) => collectBall(all, n));
    const full = said(SCRIPTS.epilogue, all).join(' '); expect(full).toMatch(/Porunga rose/); expect(full).not.toMatch(/never had all seven/);
  });
  it('each map pickup is gated by its own "not ballN"', () => {
    for (const [mapId, id, n] of [['cave', 'ball2_pick', 2], ['guru', 'ball3_pick', 3], ['ridge', 'ball4_pick', 4], ['hold', 'ball5_pick', 5], ['landing', 'ball6_pick', 6], ['core', 'ball7_pick', 7]] as [string, string, number][]) {
      expect(trig(mapId, id).when?.not, id).toBe(`ball${n}`);
    }
  });
});
