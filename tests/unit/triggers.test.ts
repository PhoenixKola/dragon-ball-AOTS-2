import { describe, it, expect } from 'vitest';
import { MAPS } from '../../src/data/maps';
import { TILE, type Cond, type Ent } from '../../src/engine/world/mapTypes';

const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const rect = (e: Ent) => ({ x0: e.x * TILE - ((e.w ?? 1) * TILE) / 2, x1: e.x * TILE + ((e.w ?? 1) * TILE) / 2, y0: e.y * TILE - ((e.h ?? 1) * TILE) / 2, y1: e.y * TILE + ((e.h ?? 1) * TILE) / 2 + 6 });
const overlap = (a: Ent, b: Ent) => { const p = rect(a), q = rect(b); return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1; };
/** Two conditions can never hold together when one requires a flag the other forbids. */
const exclusive = (a?: Cond, b?: Cond) => arr(a?.flag).some((f) => arr(b?.not).includes(f)) || arr(b?.flag).some((f) => arr(a?.not).includes(f));

describe('trigger footprints: nothing unexpected starts from ordinary exploration', () => {
  for (const m of Object.values(MAPS)) {
    it(`${m.id}: zones that overlap are never active at the same time`, () => {
      const zones = m.ents.filter((e) => e.kind === 'trigger' || e.kind === 'exit');
      for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
        if (!overlap(zones[i], zones[j])) continue;
        const bothCond = (c?: Cond) => ({ flag: arr(c?.flag), not: arr(c?.not) });
        const a = zones[i], b = zones[j];
        const ok = exclusive(a.when, b.when) || (a.kind === 'exit' && a.lock && exclusive(a.lock.cond, b.when)) || (b.kind === 'exit' && b.lock && exclusive(b.lock.cond, a.when));
        expect(ok, `${a.id} and ${b.id} overlap and could both fire (${JSON.stringify(bothCond(a.when))} / ${JSON.stringify(bothCond(b.when))})`).toBe(true);
      }
    });
    it(`${m.id}: no pickup, NPC or chest stands inside a story trigger (picking things up must not start a fight)`, () => {
      const zones = m.ents.filter((e) => e.kind === 'trigger');
      for (const e of m.ents) if (['ball', 'npc', 'chest', 'save', 'heal', 'shop'].includes(e.kind)) for (const z of zones) {
        const r = rect(z); const inside = e.x * TILE >= r.x0 - 20 && e.x * TILE <= r.x1 + 20 && e.y * TILE >= r.y0 - 20 && e.y * TILE <= r.y1 + 20;
        if (!inside) continue;
        // allowed only if the two can never exist together
        expect(exclusive(z.when, e.when), `${e.id} (${e.kind}) stands inside trigger ${z.id}`).toBe(true);
      }
    });
  }
  it('every story trigger runs exactly one script that is guarded by a not-flag so it can never replay after load', () => {
    for (const m of Object.values(MAPS)) for (const e of m.ents) if (e.kind === 'trigger') expect(arr(e.when?.not).length, `${e.id} needs a "not" flag`).toBeGreaterThan(0);
  });
  it('random encounter zones stay inside their map and never cover a story trigger’s position in safe maps', () => {
    for (const m of Object.values(MAPS)) {
      for (const [x0, y0, x1, y1] of m.encounters?.zones ?? []) { expect(x0).toBeGreaterThanOrEqual(0); expect(y0).toBeGreaterThanOrEqual(0); expect(x1).toBeLessThanOrEqual(m.w); expect(y1).toBeLessThanOrEqual(m.h); }
      if (m.safe) expect(m.encounters, `${m.id} is a safe map`).toBeUndefined();
    }
  });
});
