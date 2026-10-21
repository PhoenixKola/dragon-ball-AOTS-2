import { describe, it, expect } from 'vitest';
import { MAPS } from '../../src/data/maps';
import { SCRIPTS } from '../../src/data/scripts';
import { ENEMIES } from '../../src/data/enemies';
import { HEROES, ITEMS } from '../../src/data/heroes';
import { COMBOS } from '../../src/data/combos';
import { WORLD_OBJECTS } from '../../src/engine/world/worldAssets';
import { condMet, newGameState, joinHero, leaveHero, setFlags, collectBall, type GameState } from '../../src/systems/gameState';
import type { Step } from '../../src/engine/world/mapTypes';
import { TILE } from '../../src/engine/world/mapTypes';
import { QUESTS, QUEST_DONE } from '../../src/data/quests';

const objs = new Set(WORLD_OBJECTS);
function walkable(mapId: string, x: number, y: number) { const m = MAPS[mapId]; const c = m.ground[Math.floor(y)]?.[Math.floor(x)]; return !!c && c !== '~' && c !== 'x'; }

describe('maps are well-formed', () => {
  for (const m of Object.values(MAPS)) {
    it(`${m.id}: dimensions, spawn, objects, entities`, () => {
      expect(m.ground).toHaveLength(m.h);
      m.ground.forEach((r) => expect(r).toHaveLength(m.w));
      expect(walkable(m.id, m.spawn.x, m.spawn.y), 'spawn walkable').toBe(true);
      for (const o of m.objs) { expect(objs.has(o.o), `object ${o.o}`).toBe(true); expect(o.x).toBeGreaterThanOrEqual(0); expect(o.x).toBeLessThanOrEqual(m.w); }
      const ids = new Set<string>();
      for (const e of m.ents) {
        expect(ids.has(e.id), 'dup id ' + e.id).toBe(false); ids.add(e.id);
        if (e.obj) expect(objs.has(e.obj), `ent obj ${e.obj}`).toBe(true);
        if (e.dirs) Object.values(e.dirs).forEach((d) => expect(objs.has(d), 'dir ' + d).toBe(true));
        if (e.script) expect(SCRIPTS[e.script], `script ${e.script} for ${e.id}`).toBeDefined();
        if (e.kind === 'trigger' || e.kind === 'exit') { expect(e.script || e.exit, e.id).toBeTruthy(); }
        if (e.exit) {
          expect(MAPS[e.exit.map], `exit target ${e.exit.map}`).toBeDefined();
          expect(walkable(e.exit.map, e.exit.x, e.exit.y), `arrival of ${e.id} walkable`).toBe(true);
        }
        if (e.kind === 'foe') e.foe!.foes.forEach((f) => expect(ENEMIES[f]).toBeDefined());
        if (e.kind === 'chest') Object.keys(e.chest?.items ?? {}).forEach((i) => expect(ITEMS[i], 'item ' + i).toBeDefined());
        if (['ball', 'chest', 'npc', 'foe'].includes(e.kind)) expect(walkable(m.id, e.x, e.y), `${e.kind} ${e.id} must stand on a walkable ground tile`).toBe(true);
        expect(e.x).toBeGreaterThanOrEqual(0); expect(e.x * TILE).toBeLessThanOrEqual(m.w * TILE + 40);
      }
    });
  }
  it('every object footprint is solid-only where intended (no zero or negative footprints)', () => {
    for (const m of Object.values(MAPS)) for (const o of m.objs) if (o.solid) { expect(o.solid[0]).toBeGreaterThan(0); expect(o.solid[1]).toBeGreaterThan(0); }
  });
});

function collect(steps: Step[], out: { flags: Set<string>; foes: string[][]; battles: number }) {
  for (const st of steps) {
    if ('set' in st) [st.set].flat().forEach((f) => out.flags.add(f));
    if ('ball' in st) out.flags.add(`ball${st.ball}`);
    if ('quest' in st) { const q = QUESTS.find((x) => x.id === st.quest.id); expect(q, 'quest ' + st.quest.id).toBeDefined(); out.flags.add(q!.startFlag); if (st.quest.do === 'complete') out.flags.add(QUEST_DONE(q!.id)); }
    if ('ask' in st) collect(st.ask.onNo, out);
    if ('battle' in st) { out.foes.push(st.battle.foes); out.battles++; st.battle.foes.forEach((f) => expect(ENEMIES[f], 'foe ' + f).toBeDefined()); (st.battle.party ?? []).forEach((p) => expect(HEROES[p]).toBeDefined()); collect(st.win ?? [], out); collect(st.lose ?? [], out); }
    if ('if' in st) { collect(st.then, out); collect(st.else ?? [], out); }
    if ('run' in st) expect(SCRIPTS[st.run], 'run ' + st.run).toBeDefined();
    if ('unlockCombo' in st) expect(COMBOS.some((c) => c.id === st.unlockCombo)).toBe(true);
    if ('give' in st) Object.keys(st.give).forEach((i) => expect(ITEMS[i]).toBeDefined());
    if ('warp' in st) { expect(MAPS[st.warp.map]).toBeDefined(); expect(walkable(st.warp.map, st.warp.x, st.warp.y), 'warp target').toBe(true); }
  }
}

describe('story graph', () => {
  it('every script is structurally valid and every gating flag is set by some script', () => {
    const out = { flags: new Set<string>(), foes: [] as string[][], battles: 0 };
    for (const s of Object.values(SCRIPTS)) collect(s, out);
    // runtime-set flags: chests, patrol defeats (the world sets `foe:<id>` when a patrol is beaten)
    for (const m of Object.values(MAPS)) for (const e of m.ents) if (e.kind === 'foe') out.flags.add('foe:' + e.id);
    for (const m of Object.values(MAPS)) for (const e of m.ents) {
      const need = [e.when?.flag ?? [], e.lock?.cond.flag ?? []].flat().flat() as string[];
      for (const f of need) expect(out.flags.has(f), `flag ${f} (used by ${e.id}) is never set`).toBe(true);
    }
    expect(out.battles).toBeGreaterThanOrEqual(16);
  });

  /** SYMBOLIC graph check only (battles are assumed won, position is ignored). The real route test is tests/unit/storyPath.test.ts. */
  it('symbolic: the main story can be completed from a new game by following available triggers', () => {
    const s: GameState = newGameState();
    const done = new Set<string>();
    const apply = (steps: Step[]) => {
      for (const st of steps) {
        if ('set' in st) setFlags(s, st.set);
        else if ('join' in st) joinHero(s, st.join, st.level ?? 0, st.fused);
        else if ('leave' in st) leaveHero(s, st.leave);
        else if ('battle' in st) apply(st.win ?? []);
        else if ('if' in st) apply(condMet(s, st.if) ? st.then : st.else ?? []);
        else if ('run' in st) apply(SCRIPTS[st.run]);
        else if ('chapter' in st) s.chapter = Math.max(s.chapter, st.chapter);
        else if ('ball' in st) collectBall(s, st.ball);
        else if ('transform' in st) { const g = s.roster.find((m) => m.id === 'goku'); if (g) g.ssj = true; }
      }
    };
    const log: string[] = [];
    for (let guard = 0; guard < 80 && !s.flags.ending_seen; guard++) {
      let progressed = false;
      for (const m of Object.values(MAPS)) for (const e of m.ents) {
        if ((e.kind !== 'trigger' && e.kind !== 'ball') || !e.script || done.has(m.id + e.id)) continue;
        if (!condMet(s, e.when)) continue;
        // exits that gate the path must be satisfiable from here
        done.add(m.id + e.id); log.push(e.script); apply(SCRIPTS[e.script]); progressed = true;
      }
      if (!progressed) break;
    }
    expect(s.flags.ending_seen, 'story stalled after: ' + log.join(' > ')).toBe(true);
    expect(s.flags.ssj && s.flags.final_done && s.flags.piccolo_joined && s.flags.goku_joined).toBe(true);
    expect(s.balls, 'all seven Dragon Balls must be collectible').toBe(7);
    for (const n of [1, 2, 3, 4, 5, 6, 7]) expect(s.flags['ball' + n], 'ball' + n).toBe(true);
    expect(log.indexOf('guldo_fight')).toBeLessThan(log.indexOf('recoome_fight'));
    expect(log.indexOf('recoome_fight')).toBeLessThan(log.indexOf('ginyu_fight'));
    expect(log.indexOf('ginyu_fight')).toBeLessThan(log.indexOf('nail_frieza'));
    expect(log.indexOf('nail_frieza')).toBeLessThan(log.indexOf('frieza_forms'));
    expect(log.indexOf('frieza_forms')).toBeLessThan(log.indexOf('frieza_final_form'));
  });

  it('every exit can be reached from a map that is reachable (graph connectivity)', () => {
    const seen = new Set(['shore']); const q = ['shore'];
    while (q.length) { const id = q.pop()!; for (const e of MAPS[id].ents) if (e.exit && !seen.has(e.exit.map)) { seen.add(e.exit.map); q.push(e.exit.map); } for (const st of Object.values(SCRIPTS)) void st; }
    // 'core' is entered by story warp only; everything else must be reachable by walking
    for (const id of Object.keys(MAPS)) if (id !== 'core') expect(seen.has(id), id + ' unreachable').toBe(true);
  });
});

import { reachability, staticSolids, entSolid } from '../../src/engine/world/collision';
describe('world collision: everything the player must touch is reachable on foot from the spawn', () => {
  for (const m of Object.values(MAPS)) {
    it(`${m.id}: exits, triggers, NPCs, chests, pickups, altars reachable`, () => {
      const solids = [...staticSolids(m), ...m.ents.map(entSolid).filter((r): r is NonNullable<typeof r> => !!r)];
      const reach = reachability(m, solids, m.spawn.x * TILE, m.spawn.y * TILE);
      const bad: string[] = [];
      for (const e of m.ents) {
        const w = (e.w ?? 1) * TILE, h = (e.h ?? 1) * TILE;
        const ok = ['trigger', 'exit'].includes(e.kind) ? reach(e.x * TILE, e.y * TILE, Math.max(w, h) / 2 + 16) : reach(e.x * TILE, e.y * TILE, 56);
        if (!ok) bad.push(e.id);
      }
      expect(bad, 'unreachable: ' + bad.join(',')).toEqual([]);
    });
  }
  it('arrival points of every exit can reach the way back', () => {
    for (const m of Object.values(MAPS)) for (const e of m.ents) if (e.exit) {
      const t = MAPS[e.exit.map]; const solids = [...staticSolids(t), ...t.ents.map(entSolid).filter((r): r is NonNullable<typeof r> => !!r)];
      const reach = reachability(t, solids, e.exit.x * TILE, e.exit.y * TILE);
      const back = t.ents.filter((x) => x.exit?.map === m.id);
      expect(back.length, `${t.id} has no exit back to ${m.id}`).toBeGreaterThan(0);
      expect(back.some((b) => reach(b.x * TILE, b.y * TILE, 80)), `no path from arrival of ${e.id} to the way back`).toBe(true);
    }
  });
});
