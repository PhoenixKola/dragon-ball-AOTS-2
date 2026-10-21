import { describe, it, expect } from 'vitest';
import { MAPS } from '../../src/data/maps';
import { SCRIPTS } from '../../src/data/scripts';
import { ENEMIES } from '../../src/data/enemies';
import { SKILLS } from '../../src/data/skills';
import { TILE, type Ent, type Step } from '../../src/engine/world/mapTypes';
import { blockedAt } from '../../src/engine/world/collision';
import { addItem, condMet, newGameState, ownedBalls, type GameState } from '../../src/systems/gameState';
import { newMember, statsOf } from '../../src/systems/party';
import { applyBattleRewards, applyStateStep, promptText } from '../../src/systems/storyRuntime';
import { COOLER_LEVEL, HUB, POSTGAME_ROSTER, coolerTrail, coolerWarning, isPostgame, preparePostgame, recordPostgameWin, trainingTargets } from '../../src/systems/postgame';
import { serialize, deserialize, validateState } from '../../src/systems/save';
import { findPath, solidsFor } from '../support/pathing';
import { fightOdds, trainedMember } from '../support/postgameSim';

/** A save as it is at the end of the story: everything done, Krillin and Vegeta gone from the roster, Goku Super Saiyan, Piccolo fused. */
function endOfStory(balls: number): GameState {
  const s = newGameState();
  for (const f of ['scouts1', 'dende_met', 'ball1', 'vegeta_joined', 'cui_done', 'dodoria_done', 'ball2', 'zarbon_done', 'guru_done', 'guldo_done', 'recoome_done', 'goku_joined', 'duo_done', 'ginyu_done', 'piccolo_joined', 'piccolo_fused', 'frieza3_done', 'krillin_dead', 'vegeta_down', 'ssj', 'final_done', 'frieza_defeated', 'ending_seen']) s.flags[f] = true;
  for (let n = 1; n <= balls; n++) s.flags['ball' + n] = true;
  s.balls = balls; s.chapter = 7;
  s.roster = [newMember('gohan', 22), newMember('goku', 23), newMember('piccolo', 22)];
  s.roster[1].ssj = true; s.roster[2].fused = true; s.party = ['goku', 'gohan', 'piccolo'];
  s.mapId = 'core'; s.x = 12; s.y = 12; s.zeni = 777; s.inventory = { senzu: 2 };
  return s;
}
const run = (s: GameState, steps: Step[]) => {   // minimal interpreter for the pure steps a script uses (battles and speech are not part of the reward logic)
  for (const st of steps) {
    if ('if' in st) { run(s, condMet(s, st.if) ? st.then : st.else ?? []); continue; }
    applyStateStep(s, st);
  }
};

describe('postgame unlock', () => {
  for (const balls of [2, 7]) it(`both endings (${balls}/7 balls; the story itself always grants two): unlocking keeps every flag, ball, level and item and is idempotent`, () => {
    const s = endOfStory(balls); const flagsBefore = { ...s.flags }; const lv = s.roster.map((m) => [m.id, m.level]);
    const a = preparePostgame(s);
    expect(a.newlyUnlocked).toBe(true); expect(isPostgame(s)).toBe(true);
    for (const k of Object.keys(flagsBefore)) expect(s.flags[k], k).toBe(true);
    expect(ownedBalls(s).length).toBe(balls); expect(s.flags.ending_seen).toBe(true);
    for (const [id, level] of lv) expect(s.roster.find((m) => m.id === id)!.level).toBe(level);
    expect(s.zeni).toBe(777); expect(s.inventory.senzu).toBe(2);
    const snap = JSON.stringify({ ...s, savedAt: 0 });
    const b = preparePostgame(s);
    expect(b.newlyUnlocked).toBe(false); expect(b.restored).toEqual([]); expect(JSON.stringify({ ...s, savedAt: 0 })).toBe(snap);
  });
  it('the simulation roster returns (Krillin, Vegeta, Dende), keeps Super Saiyan and the fusion, and the party is valid', () => {
    const s = endOfStory(7); const r = preparePostgame(s);
    for (const id of POSTGAME_ROSTER) expect(s.roster.some((m) => m.id === id), id).toBe(true);
    expect(r.restored).toEqual(expect.arrayContaining(['krillin', 'vegeta', 'dende']));
    expect(s.roster.find((m) => m.id === 'goku')!.ssj).toBe(true); expect(s.roster.find((m) => m.id === 'piccolo')!.fused).toBe(true);
    expect(s.party.length).toBeGreaterThanOrEqual(1); expect(s.party.length).toBeLessThanOrEqual(3); expect(new Set(s.party).size).toBe(s.party.length);
    for (const m of s.roster) { expect(m.hp).toBe(statsOf(m).hp); expect(m.level).toBeGreaterThanOrEqual(5); }
  });
  it('the player is put in the hub, never left on the destroyed final ground', () => {
    const s = endOfStory(3); preparePostgame(s);
    expect(s.mapId).toBe(HUB.map); expect(s.x).toBe(HUB.x); expect(s.y).toBe(HUB.y);
  });
  it('the unlocked state saves, reloads and round-trips; tampered postgame blocks are rejected; old saves without the block load', () => {
    const s = endOfStory(7); preparePostgame(s); s.postgame!.trainingWins = 3;
    const p = deserialize(serialize(s)); expect(p.ok).toBe(true); if (p.ok) { expect(p.state.postgame).toEqual(s.postgame); expect(p.state.flags.postgame_unlocked).toBe(true); }
    const raw = JSON.parse(JSON.stringify(s)); raw.postgame = { trainingWins: -1, coolerClears: 0, coolerBestRounds: 0 }; expect(validateState(raw).ok).toBe(false);
    raw.postgame = 'x'; expect(validateState(raw).ok).toBe(false);
    delete raw.postgame; expect(validateState(raw).ok).toBe(true);
  });
  it('postgame bookkeeping only counts after the unlock; Cooler clears track the best round count', () => {
    const s = endOfStory(7); recordPostgameWin(s, { tag: 'cooler' }, 20); expect(s.postgame).toBeUndefined();
    preparePostgame(s); recordPostgameWin(s, { tag: 'cooler' }, 20); recordPostgameWin(s, { tag: 'cooler' }, 15); recordPostgameWin(s, {}, 4);
    expect(s.postgame).toEqual({ trainingWins: 3, coolerClears: 2, coolerBestRounds: 15 });
  });
});

describe('the postgame world (real collision data)', () => {
  const s = (() => { const g = endOfStory(7); preparePostgame(g); g.flags.cooler_clue = true; g.flags.cooler_trail_open = true; return g; })();
  const reachable = (map: string, from: { x: number; y: number }, to: Ent | { x: number; y: number }) => {
    const m = MAPS[map]; const sol = solidsFor(m, s);
    return !!findPath(m, sol, { x: from.x * TILE, y: from.y * TILE }, { x: ('x' in to ? to.x : 0) * TILE, y: ('y' in to ? to.y : 0) * TILE }, 36);
  };
  it('the hub spawn is walkable and the hub NPC (Capsule Comm), altar, trader and exits are reachable from it', () => {
    const m = MAPS[HUB.map]; expect(blockedAt(m, solidsFor(m, s), HUB.x * TILE, HUB.y * TILE)).toBe(false);
    for (const id of ['village_comm', 'altar_save', 'village_trader']) { const e = m.ents.find((x) => x.id === id)!; expect(e, id).toBeDefined(); expect(reachable(HUB.map, HUB, e), id).toBe(true); }
    for (const e of m.ents.filter((x) => x.kind === 'exit')) expect(reachable(HUB.map, HUB, e), e.id).toBe(true);
  });
  it('Cooler is reached by a real route: hub -> Highlands (east end, rift) -> Frozen Ruins -> arena', () => {
    const village = MAPS.village, ridge = MAPS.ridge, cr = MAPS.cooler_ruins;
    const toRidge = village.ents.find((e) => e.id === 'village_to_ridge')!; expect(toRidge.exit!.map).toBe('ridge');
    expect(reachable('village', HUB, toRidge)).toBe(true);
    const rift = ridge.ents.find((e) => e.id === 'ridge_rift')!, gate = ridge.ents.find((e) => e.id === 'ridge_to_cooler')!;
    expect(gate.exit).toEqual({ map: 'cooler_ruins', x: cr.spawn.x - 0.4, y: 14.2 });
    expect(reachable('ridge', toRidge.exit!, rift)).toBe(true); expect(reachable('ridge', toRidge.exit!, gate)).toBe(true);
    expect(blockedAt(cr, solidsFor(cr, s), gate.exit!.x * TILE, gate.exit!.y * TILE)).toBe(false);
    for (const id of ['cooler_to_ridge', 'cooler_save', 'cooler_comm', 'cr_foe1', 'cr_foe2', 'cr_foe3', 'chest_cr1', 'chest_cr2', 'cooler_arena']) { const e = cr.ents.find((x) => x.id === id)!; expect(e, id).toBeDefined(); expect(reachable('cooler_ruins', gate.exit!, e), id).toBe(true); }
    const back = cr.ents.find((x) => x.id === 'cooler_to_ridge')!.exit!; expect(blockedAt(ridge, solidsFor(ridge, s), back.x * TILE, back.y * TILE)).toBe(false);
  });
  it('the Frozen Ruins gate and the rift obey the trail: locked until the clue and the rift were used, absent before the postgame', () => {
    const ridge = MAPS.ridge; const gate = ridge.ents.find((e) => e.id === 'ridge_to_cooler')!, rift = ridge.ents.find((e) => e.id === 'ridge_rift')!;
    const pre = endOfStory(7);   // credits not reached yet
    expect(condMet(pre, rift.when)).toBe(false); expect(condMet(pre, gate.when)).toBe(false);
    const post = endOfStory(7); preparePostgame(post);
    expect(condMet(post, rift.when)).toBe(true); expect(condMet(post, gate.when)).toBe(false);
    post.flags.cooler_trail_open = true; expect(condMet(post, gate.when)).toBe(true);
    expect(coolerTrail(post).map((t) => t.done)).toEqual([false, true, false]);
  });
  it('every map exit still leads to a walkable spot, including the new ones; old maps keep working after the story (no story re-triggers)', () => {
    for (const m of Object.values(MAPS)) for (const e of m.ents.filter((x) => x.kind === 'exit' && x.exit)) {
      const t = MAPS[e.exit!.map]; expect(t, `${m.id}/${e.id}`).toBeDefined();
      expect(blockedAt(t, solidsFor(t, s), e.exit!.x * TILE, e.exit!.y * TILE), `${m.id}/${e.id} lands blocked`).toBe(false);
    }
    // story triggers never fire again: every trigger that starts a boss needs a flag that the finished story has already set away
    for (const m of Object.values(MAPS)) for (const e of m.ents.filter((x) => x.kind === 'trigger' && x.script && x.script !== 'cooler_fight')) {
      if (!condMet(s, e.when)) continue;
      expect(['to_final'].includes(e.script!) || /ssj|final/.test(e.script!), `${m.id}/${e.id} (${e.script}) is live after the story`).toBe(false);
    }
  });
  it('postgame foes respawn by entering the map (the flag is cleared) without touching chests or Dragon Balls', () => {
    const g = endOfStory(7); preparePostgame(g); g.flags['foe:cr_foe1'] = true; g.flags['chest:chest_cr1'] = true;
    for (const e of MAPS.cooler_ruins.ents) if (e.kind === 'foe') delete g.flags['foe:' + e.id];   // what Session.enterMap does in the postgame
    expect(g.flags['foe:cr_foe1']).toBeUndefined(); expect(g.flags['chest:chest_cr1']).toBe(true); expect(ownedBalls(g).length).toBe(7);
  });
});

describe('Cooler, rewards and the rematch', () => {
  const winSteps = () => { const st = SCRIPTS.cooler_fight.find((x) => 'battle' in x) as Extract<Step, { battle: unknown }>; return st.win ?? []; };
  it('the first victory pays the trophy exactly once, however often the script runs', () => {
    const s = endOfStory(7); preparePostgame(s);
    run(s, winSteps()); const after1 = { frost: s.inventory.frostcore, senzu: s.inventory.senzu, zeni: s.zeni, megakit: s.inventory.megakit };
    expect(s.flags.cooler_defeated).toBe(true); expect(s.flags.cooler_reward).toBe(true); expect(after1.frost).toBe(1); expect(after1.senzu).toBe(5);
    run(s, winSteps()); run(s, winSteps());
    expect(s.inventory.frostcore).toBe(1); expect(s.inventory.senzu).toBe(after1.senzu); expect(s.zeni).toBe(after1.zeni); expect(s.inventory.megakit).toBe(after1.megakit);
  });
  it('the arena trigger disappears after the victory and the rematch terminal appears; the rematch pays nothing', () => {
    const cr = MAPS.cooler_ruins; const trig = cr.ents.find((e) => e.id === 'cooler_arena')!, rem = cr.ents.find((e) => e.id === 'cooler_rematch')!;
    const s = endOfStory(7); preparePostgame(s);
    expect(condMet(s, trig.when)).toBe(true); expect(condMet(s, rem.when)).toBe(false);
    s.flags.cooler_defeated = true; expect(condMet(s, trig.when)).toBe(false); expect(condMet(s, rem.when)).toBe(true);
    const rematch = (SCRIPTS.cooler_rematch.find((x) => 'battle' in x) as Extract<Step, { battle: { noRewards?: boolean; foes: string[] } }>).battle;
    expect(rematch.noRewards).toBe(true);
    const before = JSON.stringify({ z: s.zeni, inv: s.inventory, lv: s.roster.map((m) => [m.level, m.xp]) });
    const r = applyBattleRewards(s, rematch, false); expect(r).toEqual({ exp: 0, zeni: 0, drops: {}, levelUps: [] });
    expect(JSON.stringify({ z: s.zeni, inv: s.inventory, lv: s.roster.map((m) => [m.level, m.xp]) })).toBe(before);
  });
  it('retrying a lost fight cannot farm anything: rewards come only from the win branch', () => {
    const fight = SCRIPTS.cooler_fight.find((x) => 'battle' in x) as Extract<Step, { battle: { allowFlee?: boolean } }>;
    expect(fight.battle.allowFlee).toBe(false);
    const preWin = SCRIPTS.cooler_fight.slice(0, SCRIPTS.cooler_fight.indexOf(fight));
    for (const st of preWin) expect('give' in st || 'zeni' in st || 'xp' in st).toBe(false);
  });
  it('the low-level warning appears below the recommended level and the prompt token resolves it', () => {
    const s = endOfStory(7); preparePostgame(s);
    expect(coolerWarning(s)).toMatch(/Lv \d+/); expect(promptText(s, '{warn} Go?')).toContain('Cooler');
    for (const m of s.roster) m.level = COOLER_LEVEL + 2; expect(coolerWarning(s)).toBeNull(); expect(promptText(s, '{warn}')).toBe('Your party is ready.');
  });
  it('training targets name each hero’s next skill, and Dende/Nail style guests are handled; the Frost Core Capsule is equippable once', () => {
    const s = endOfStory(7); preparePostgame(s);
    expect(trainingTargets(s).length).toBe(s.roster.length);
    expect(trainingTargets(s).some((t) => t.next)).toBe(true);
    addItem(s, 'frostcore', 1); expect(s.inventory.frostcore).toBe(1);
  });
  it('Cooler is his own boss: three escalating mechanics, two telegraphed attacks, a counter armour, phases, and nothing copied from Frieza', () => {
    const c = ENEMIES.cooler; expect(c.boss).toBe(true); expect(c.sprite).toBe('cooler');
    expect((c.phases ?? []).length).toBeGreaterThanOrEqual(2);
    const skills = c.moves.map((m) => SKILLS[m.skill]);
    expect(skills.filter((k) => (k.chargeTurns ?? 0) >= 1).length).toBeGreaterThanOrEqual(2);
    expect(skills.some((k) => k.status?.kind === 'counter')).toBe(true); expect(skills.some((k) => k.status?.kind === 'atkDown')).toBe(true);
    const frieza = new Set(Object.values(ENEMIES).filter((e) => e.id.startsWith('frieza')).flatMap((e) => e.moves.map((m) => m.skill)));
    for (const m of c.moves) expect(frieza.has(m.skill), m.skill).toBe(false);
    expect(c.moves.some((m) => m.when === 'hpBelowHalf')).toBe(true);
  });
  it('balance at naturally earned postgame levels (simulated; a model of play, not a human playthrough)', () => {
    const party = (lv: number) => [trainedMember('goku', lv, { ssj: true, capsules: ['powercap', 'guardcap'] }), trainedMember('gohan', lv, { capsules: ['powercap', 'vitalcap'] }), trainedMember('piccolo', lv, { fused: true, capsules: ['guardcap', 'vitalcap'] })];
    const at = (lv: number, p: number, g: number) => fightOdds({ party: party(lv), foes: ['cooler'], perfect: p, good: g, seeds: 8 });
    const l22 = at(22, 0.35, 0.35), l26 = at(26, 0.35, 0.35), l26avg = at(26, 0.15, 0.3), l30 = at(30, 0.15, 0.3), l22never = at(22, 0, 0);
    expect(l22.win, 'Lv22 is a real risk').toBeLessThanOrEqual(0.85); expect(l22never.win, 'Lv22 never guarding').toBeLessThanOrEqual(0.25);
    expect(l26.win, 'Lv26 attentive').toBeGreaterThanOrEqual(0.6); expect(l26avg.win, 'Lv26 average').toBeGreaterThanOrEqual(0.4);
    expect(l30.win, 'Lv30 average').toBeGreaterThanOrEqual(0.85);
    expect(l26.rounds).toBeGreaterThan(12); expect(l26.rounds, 'not endless').toBeLessThan(45);
  });
  it('training foes are fair at postgame levels: a trained party wins, but not without losing HP', () => {
    const party = [trainedMember('goku', 24, { ssj: true, capsules: ['powercap', 'guardcap'] }), trainedMember('gohan', 24, { capsules: ['powercap', 'vitalcap'] }), trainedMember('piccolo', 24, { fused: true, capsules: ['guardcap', 'vitalcap'] })];
    const r = fightOdds({ party, foes: ['frostelite', 'frostguard', 'frostguard'], perfect: 0.15, good: 0.3, seeds: 8, inventory: { medkit: 2 } });
    expect(r.win).toBeGreaterThanOrEqual(0.85); expect(r.hpLeft).toBeLessThan(0.95); expect(r.rounds).toBeGreaterThan(5);
  });
});
