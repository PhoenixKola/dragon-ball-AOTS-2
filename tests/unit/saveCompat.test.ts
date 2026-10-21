import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StoryDriver } from '../support/storyDriver';
import { playFinale, playStory } from '../support/storyPlan';
import { allSlots, AUTOSAVE_SLOT, deserialize, exportText, importText, migrateLegacy, readSlot, serialize, slotMeta, validateState, writeSlot, SLOT_COUNT } from '../../src/systems/save';
import { SAVE_VERSION, newGameState, type GameState } from '../../src/systems/gameState';
import { questStatus } from '../../src/systems/storyRuntime';
import { QUESTS } from '../../src/data/quests';
import { MAPS } from '../../src/data/maps';

// These files run long synchronous story simulations: yield between tests so the vitest worker can report progress (otherwise: "Timeout calling onTaskUpdate").
afterEach(() => new Promise<void>((r) => setTimeout(r, 0)));

// Several tests here walk the whole story (one takes ~4.7 s on its own): the 5 s default is too tight on a loaded machine.
vi.setConfig({ testTimeout: 60000 });

/**
 * Save compatibility. The quest system lives entirely in the existing `flags` map (q:, qp:, qd: and foe: names), so
 * SAVE_VERSION stays 3 and no migration is needed; these tests prove that saves written by Alpha 3f (no quest flags, the
 * old party rules) still load, are not given retroactive rewards, and can be played to the ending.
 */
let store: Record<string, string> = {};
let failWrites: string | null = null;
beforeEach(() => {
  store = {}; failWrites = null;
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { if (failWrites && k.includes(failWrites)) throw new Error('QuotaExceededError'); store[k] = v; },
    removeItem: (k: string) => { delete store[k]; }, key: (i: number) => Object.keys(store)[i] ?? null, get length() { return Object.keys(store).length; }, clear: () => { store = {}; },
  } as Storage;
});

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** What Alpha 3f would have written for this progress: no quest flags (its own `ridge_helped` stays) and its party rules. */
function as3f(s: GameState, party: GameState['party']): GameState {
  const o = clone(s);
  for (const k of Object.keys(o.flags)) if (/^(q|qp|qd):/.test(k)) delete o.flags[k];
  o.party = party; o.version = 3;
  return o;
}
function stageVillage(): GameState { const d = new StoryDriver({ seed: 9 }); d.interact('ship'); d.enter('shore_scouts'); d.travelTo('village'); d.enter('village_enter'); return d.s; }
function stageGuru(): GameState { const d = new StoryDriver({ seed: 9 }); playStory(d, { sideQuests: false, balls: [] }); return d.s; }   // finishes; the intermediate stage below stops earlier
function stageAfterGuru(): StoryDriver { const d = new StoryDriver({ seed: 9 }); d.interact('ship'); d.enter('shore_scouts'); d.travelTo('village'); d.enter('village_enter'); d.travelTo('landing'); d.enter('landing_vegeta'); d.enter('landing_cui'); d.enter('landing_dodoria'); d.travelTo('cave'); d.interact('ball2_pick'); d.travelTo('village'); d.enter('village_zarbon'); d.travelTo('guru'); d.enter('guru_trigger'); d.noEncounters(); return d; }
function stagePreFinale(): StoryDriver { const d = new StoryDriver({ seed: 9 }); playStory(d, { sideQuests: false, balls: [], stopBeforeFrieza: true }); return d; }
function stageCore(): StoryDriver { const d = stagePreFinale(); d.setAsk(() => true); d.enter('landing_frieza', ['landing_frieza4']); return d; }

describe('Alpha 3f saves keep working (SAVE_VERSION unchanged, quests live in flags)', () => {
  it('the save version is still 3 and the quest state is plain flags the strict validator already accepts', () => {
    expect(SAVE_VERSION).toBe(3);
    const s = newGameState(); s.flags['q:shore_net'] = true; s.flags['qd:aojan_medicine'] = true; s.flags['qp:logbook'] = true; s.flags['foe:ridge_foe1'] = true;
    expect(validateState(clone(s)).ok).toBe(true);
  });

  const stages: [string, () => GameState][] = [['new game', () => newGameState()], ['village after Dende', stageVillage], ['Guru reached (mid chapter 3)', () => as3f(stageAfterGuru().s, ['gohan', 'krillin', 'vegeta'])], ['before Frieza (party is the 3f lineup)', () => as3f(stagePreFinale().s, ['gohan', 'krillin', 'vegeta'])], ['on the last ground (3f left only Gohan in the party)', () => as3f(stageCore().s, ['gohan'])], ['finished game', stageGuru]];
  for (const [name, make] of stages) {
    it(`loads and round-trips unchanged: ${name}`, () => {
      const s = as3f(make(), make().party);   // strips quest flags like Alpha 3f
      const view = (g: GameState) => ({ z: g.zeni, i: { ...g.inventory }, r: g.roster.map((m) => ({ id: m.id, level: m.level, xp: m.xp, hp: m.hp, ki: m.ki, alloc: { ...m.alloc }, unspent: m.unspent, capsules: [...m.capsules], ssj: !!m.ssj, fused: !!m.fused })), f: Object.keys(g.flags).sort(), c: [...g.combos], p: [...g.party], m: g.mapId, ch: g.chapter, b: g.balls });
      const text = serialize(s);
      const a = deserialize(text); expect(a.ok, name).toBe(true);
      if (!a.ok) return;
      expect(view(a.state)).toEqual(view(s));
      expect(Object.keys(a.state.flags).some((k) => /^(q|qd):/.test(k)), 'loading must not invent quest progress').toBe(false);
      const b = importText(exportText(a.state)); expect(b.ok, name + ' export/import').toBe(true);
    });
  }

  it('no retroactive rewards: patrol flags from an old save never complete or pay a quest by themselves', () => {
    const s = as3f(stagePreFinale().s, ['gohan', 'krillin', 'vegeta']); const zeni = s.zeni, inv = JSON.stringify(s.inventory);
    for (const q of QUESTS) expect(['available', 'locked', 'active', 'ready'], q.id).toContain(questStatus(s, q));
    expect(questStatus(s, QUESTS.find((q) => q.id === 'shore_net')!)).toBe('available');   // the patrol is dead (foe flag) but the quest was never accepted
    expect(s.zeni).toBe(zeni); expect(JSON.stringify(s.inventory)).toBe(inv);
  });

  it('an Alpha 3f save from mid chapter 3 can be played to the ending (with and without the new side quests)', () => {
    for (const side of [false, true]) {
      const s = as3f(stageAfterGuru().s, ['gohan', 'krillin', 'vegeta']);
      const loaded = deserialize(serialize(s)); expect(loaded.ok).toBe(true); if (!loaded.ok) return;
      const d = new StoryDriver({ seed: 3, state: loaded.state }); playStory(d, { sideQuests: side });
      expect(d.ended, `side quests ${side}`).toBe(true); expect(d.s.flags.ending_seen).toBe(true);
    }
  });

  it('an Alpha 3f save from just before Frieza finishes, and the 3f party (Piccolo benched) is fixed by the story lineup steps', () => {
    const s = as3f(stagePreFinale().s, ['gohan', 'krillin', 'vegeta']);
    expect(s.party).not.toContain('piccolo');
    const d = new StoryDriver({ seed: 3, state: clone(s) }); d.noEncounters(); playFinale(d);
    expect(d.ended).toBe(true); expect([...d.s.party].sort()).toEqual(['gohan', 'goku', 'piccolo']);
  });

  it('an Alpha 3f save made on the last ground with only Gohan in the party still reaches the ending', () => {
    const s = as3f(stageCore().s, ['gohan']);
    expect(s.mapId).toBe('core'); expect(s.party).toEqual(['gohan']);
    const d = new StoryDriver({ seed: 3, state: clone(s) }); playFinale(d);
    expect(d.ended).toBe(true);
  });

  it('a prototype (v2) import is a clean checkpoint without quest flags and continues to the ending', () => {
    store['aots2-namek-save-v2'] = JSON.stringify({ index: 14, actors: { gohan: { lv: 12 }, krillin: { lv: 11 } }, inventory: { medkit: 4, capsule: 2, senzu: 1 }, coins: 500, balls: 7 });
    const m = migrateLegacy(); expect(m).not.toBeNull(); if (!m) return;
    expect(Object.keys(m.state.flags).some((k) => /^(q|qd|qp):/.test(k))).toBe(false);
    expect(m.state.balls).toBe(3);
    const d = new StoryDriver({ seed: 4, state: m.state }); playStory(d, { sideQuests: true });
    expect(d.ended).toBe(true);
    expect(store['aots2.legacy.v2.backup'], 'the original v2 data is backed up, untouched').toBeDefined();
  });
});

describe('slots, autosave, backups and corrupt files', () => {
  const mk = (n: number): GameState => { const s = newGameState(); s.zeni = 100 + n; s.chapter = n; return s; };

  it('autosave and the three slots are independent and listed in order', () => {
    for (let i = 0; i <= SLOT_COUNT; i++) expect(writeSlot(i, mk(i))).toBe(true);
    const metas = allSlots();
    expect(metas).toHaveLength(SLOT_COUNT + 1);
    metas.forEach((m, i) => { expect(m.slot).toBe(i); expect(m.empty).toBe(false); expect(m.chapter).toBe(i); });
    for (let i = 0; i <= SLOT_COUNT; i++) { const r = readSlot(i); expect(r && r.ok && r.state.zeni).toBe(100 + i); }
    expect(AUTOSAVE_SLOT).toBe(0);
  });

  it('every write keeps the previous good save as a backup, which is used when the main file is corrupt', () => {
    writeSlot(1, mk(1)); writeSlot(1, mk(2));
    expect(Object.keys(store).some((k) => /slot1\.bak$/.test(k))).toBe(true);
    const key = Object.keys(store).find((k) => /slot1$/.test(k))!;
    store[key] = '{"body": "garbage"';                               // truncated file
    const r = readSlot(1); expect(r && r.ok, 'falls back to the backup').toBe(true);
    if (r && r.ok) expect(r.state.chapter).toBe(1);
    const bak = Object.keys(store).find((k) => /slot1\.bak$/.test(k))!; store[bak] = 'not json';
    const dead = readSlot(1); expect(dead && !dead.ok).toBe(true); expect(slotMeta(1).corrupt).toBe(true);
  });

  it('a tampered or edited file is rejected (checksum) and never loaded', () => {
    writeSlot(2, mk(3)); const key = Object.keys(store).find((k) => /slot2$/.test(k))!;
    const env = JSON.parse(store[key]); env.body = env.body.replace('"zeni":103', '"zeni":999999'); store[key] = JSON.stringify(env);
    const r = readSlot(2); expect(r && !r.ok).toBe(true);
    if (r && !r.ok) expect(r.error).toMatch(/Checksum/);
  });

  it('a failed write (storage full) never destroys the previous save', () => {
    writeSlot(3, mk(4));
    failWrites = 'slot3'; const ok = writeSlot(3, mk(5)); expect(ok).toBe(false);
    failWrites = null;
    const r = readSlot(3); expect(r && r.ok && r.state.chapter).toBe(4);
  });

  it('export/import round-trips quest state and rejects hostile files without crashing', () => {
    const s = newGameState(); s.flags['q:camp_bounty'] = true; s.flags['foe:landing_foe1'] = true; s.flags['qd:shore_net'] = true;
    const back = importText(exportText(s)); expect(back.ok).toBe(true);
    if (back.ok) { expect(back.state.flags['q:camp_bounty']).toBe(true); expect(back.state.flags['qd:shore_net']).toBe(true); }
    for (const bad of ['', '{', '[]', 'null', '{"version":3}', JSON.stringify(s).replace('"flags":{', '"flags":{"__proto__":true,'), JSON.stringify({ ...s, flags: { 'q:x': 'yes' } }), JSON.stringify({ ...s, mapId: 'nowhere' })]) expect(importText(bad).ok, bad.slice(0, 30)).toBe(false);
  });

  it('every saved position is on a real map inside its bounds, for every map the story visits', () => {
    for (const m of Object.values(MAPS)) { const s = newGameState(); s.mapId = m.id; s.x = m.spawn.x; s.y = m.spawn.y; expect(validateState(clone(s)).ok, m.id).toBe(true); }
  });
});
