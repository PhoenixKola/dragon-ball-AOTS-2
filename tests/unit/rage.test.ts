import { describe, it, expect } from 'vitest';
import { BattleEngine, isError } from '../../src/engine/combat/engine';
import { buildAlly, buildEnemy, newMember } from '../../src/systems/party';
import type { ActionPlan, Fighter, HeroId } from '../../src/types';
import { hasStatus, kiCost, effAtk, RAGE_FULL } from '../../src/engine/combat/formulas';
import { RAGE, rageDealt, rageTaken, identityOf } from '../../src/engine/combat/rage';
import { rageProfile } from '../support/rageProfile';

function mk(heroes: [HeroId, number][], foes: string[], seed = 7) {
  const allies = heroes.map(([id, lv], i) => buildAlly(newMember(id, lv), i));
  const enemies = foes.map((id, i) => buildEnemy(id, i));
  return new BattleEngine({ allies, enemies, seed, inventory: { medkit: 2, senzu: 1 }, unlockedCombos: ['gohan_krillin', 'goku_vegeta', 'z_trio'] });
}
function turnOf(e: BattleEngine, defId: string): Fighter {
  for (let i = 0; i < 80; i++) {
    const t = e.nextTurn();
    if (t.kind === 'end') throw new Error('battle ended');
    if (t.actor.defId === defId && t.kind !== 'skip') return t.actor;
    if (t.kind === 'input' || t.kind === 'ai') { e.submit({ kind: t.kind === 'ai' ? 'defend' : 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'defend', targetIds: [], steps: [], guardTargets: [] }); }
  }
  throw new Error('turn not reached');
}
const must = (p: ActionPlan | { error: string }): ActionPlan => { if (isError(p)) throw new Error(p.error); return p; };
function run(e: BattleEngine, plan: ActionPlan, guard: 'none' | 'good' | 'perfect' = 'none') { const r = plan.steps.map((s) => e.commit(plan, s, guard)); e.finishAction(plan); return r; }

describe('Rage constants and identity', () => {
  it('the published numbers are what the engine uses', () => {
    expect(RAGE_FULL).toBe(100);
    expect(RAGE.GUARD_PERFECT).toBeGreaterThan(RAGE.GUARD_GOOD); expect(RAGE.GUARD_GOOD).toBeGreaterThan(0);
    expect(identityOf({ defId: 'gohan' }).taken).toBeGreaterThan(1); expect(identityOf({ defId: 'vegeta' }).dealt).toBeGreaterThan(1);
    expect(identityOf({ defId: 'dende' })).toEqual({ dealt: 1, taken: 1, guard: 1, crit: 1 });
    for (const v of Object.values(identityOf({ defId: 'goku' }))) expect(v).toBeLessThan(1.5);   // identity stays small
  });
  it('rageDealt: bosses give full Rage, minions the reduced share; criticals add a bonus', () => {
    const plain = rageDealt({ defId: 'dende' }, 8, false, true);
    expect(rageDealt({ defId: 'dende' }, 8, false, false)).toBeCloseTo(plain * RAGE.MINION_FACTOR, 5);
    expect(rageDealt({ defId: 'dende' }, 8, true, true)).toBeCloseTo(plain + RAGE.CRIT_BONUS, 5);
    expect(rageDealt({ defId: 'krillin' }, 8, true, true)).toBeGreaterThan(rageDealt({ defId: 'goku' }, 8, true, true) - 3);
  });
  it('rageTaken: more damage, guards and low HP all give more Rage', () => {
    const t = { defId: 'dende', hp: 200, stats: { hp: 200, ki: 1, atk: 1, def: 1, spd: 1 } };
    const small = rageTaken(t, 10, 1, 'none'), big = rageTaken(t, 80, 1, 'none');
    expect(big).toBeGreaterThan(small);
    expect(rageTaken(t, 10, 1, 'good')).toBeCloseTo(small + RAGE.GUARD_GOOD, 5);
    expect(rageTaken(t, 10, 1, 'perfect')).toBeCloseTo(small + RAGE.GUARD_PERFECT, 5);
    expect(rageTaken({ ...t, hp: 40 }, 10, 1, 'none')).toBeCloseTo(small + RAGE.CLUTCH_BONUS, 5);
    expect(rageTaken({ ...t, defId: 'gohan' }, 10, 1, 'none')).toBeGreaterThan(small);
  });
});

describe('Rage in the engine', () => {
  it('every gain path adds Rage: dealing damage, taking damage, a good and a perfect guard', () => {
    const e = mk([['gohan', 8]], ['dodoria']); const g = turnOf(e, 'gohan'); const foe = e.enemies()[0];
    const a0 = g.rage; run(e, must(e.submit({ kind: 'attack', target: foe.uid }, g.uid))); const dealt = g.rage - a0; expect(dealt).toBeGreaterThan(0);
    const e3 = mk([['gohan', 8]], ['dodoria']); const gg = e3.allies()[0];
    const dodoria = e3.enemies()[0];
    let pid = 90;
    for (const [grade, min] of [['none', 0], ['good', RAGE.GUARD_GOOD], ['perfect', RAGE.GUARD_PERFECT]] as const) {
      gg.rage = 0; gg.hp = gg.stats.hp;
      const plan = { id: ++pid, actorId: dodoria.uid, skillId: 'e_pummel', targetIds: [gg.uid], steps: [{ index: 0, actorId: dodoria.uid, targetId: gg.uid, skillId: 'e_pummel', hitFrac: 0.6, last: false }], guardTargets: [gg.uid] } as ActionPlan;
      (e3 as unknown as { currentUid: string }).currentUid = dodoria.uid; e3.begin(plan); e3.commit(plan, plan.steps[0], grade);
      expect(gg.rage, grade).toBeGreaterThan(min);
    }
  });
  it('Defend gives Rage only for the first Defend in a row (no Defend-spam meter)', () => {
    const e = mk([['gohan', 8], ['krillin', 8]], ['dodoria']);
    const g = turnOf(e, 'gohan'); g.rage = 0;
    const p1 = must(e.submit({ kind: 'defend' }, g.uid)); e.finishAction(p1); const after1 = g.rage; expect(after1).toBeGreaterThanOrEqual(RAGE.DEFEND_GAIN);
    // a second Defend straight away gives nothing from Defend itself
    g.defendStreak = 1; const before = g.rage; e.begin({ id: 5, actorId: g.uid, skillId: 'defend', targetIds: [g.uid], steps: [], guardTargets: [] });
    expect(g.rage).toBe(before);
    // any other action resets the streak
    e.begin({ id: 6, actorId: g.uid, skillId: 'atk_gohan', targetIds: [], steps: [], guardTargets: [] }); expect(g.defendStreak).toBe(0);
  });
  it('one action can never add more than the per-action cap to one fighter', () => {
    const e = mk([['gohan', 8]], ['dodoria']); const g = turnOf(e, 'gohan'); g.rage = 0; g.rageGainMult = 10;
    run(e, must(e.submit({ kind: 'attack', target: e.enemies()[0].uid }, g.uid)));
    expect(g.rage).toBeLessThanOrEqual(RAGE.PER_ACTION_CAP);
  });
  it('Rage is capped at 100 and reset by the Rage Art; the full bar is exactly 100', () => {
    const e = mk([['vegeta', 8]], ['dodoria']); const v = turnOf(e, 'vegeta'); v.rage = 99.5;
    run(e, must(e.submit({ kind: 'attack', target: e.enemies()[0].uid }, v.uid))); expect(v.rage).toBeLessThanOrEqual(100);
  });
  it('Sparking: costs 100 Rage once, lasts 4 turns, +25% ATK, halves Ki cost, cannot stack or be re-used while active', () => {
    const e = mk([['vegeta', 12]], ['dodoria']); const v = turnOf(e, 'vegeta');
    const atk0 = effAtk(v), cost0 = kiCost(v, 30);
    v.rage = 100; const p = must(e.submit({ kind: 'sparking' }, v.uid)); e.finishAction(p);
    expect(hasStatus(v, 'sparking')).toBe(true); expect(v.rage).toBe(0);
    const s = v.statuses.find((x) => x.kind === 'sparking')!; expect(s.turns).toBe(4);
    expect(effAtk(v)).toBeCloseTo(atk0 * 1.25, 5); expect(kiCost(v, 30)).toBe(Math.round(cost0 * 0.5));
    v.rage = 100; expect(isError(e.plan({ kind: 'sparking' }, v.uid))).toBe(true);   // no double consumption while active
    expect(v.rage).toBe(100);
  });
  it('Sparking expires cleanly after its turns', () => {
    const e = mk([['vegeta', 12]], ['scout']); const v = turnOf(e, 'vegeta'); v.rage = 100;
    e.finishAction(must(e.submit({ kind: 'sparking' }, v.uid)));
    for (let i = 0; i < 40 && hasStatus(v, 'sparking'); i++) { const t = e.nextTurn(); if (t.kind === 'end') break; if (t.kind === 'input' || t.kind === 'ai') { e.submit({ kind: 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'defend', targetIds: [], steps: [], guardTargets: [] }); } }
    expect(hasStatus(v, 'sparking')).toBe(false);
  });
  it('combos still cost exactly 50 Rage from each partner', () => {
    const e = mk([['goku', 12], ['vegeta', 12]], ['dodoria']); const g = turnOf(e, 'goku'); const v = e.allies().find((a) => a.defId === 'vegeta')!;
    g.rage = 80; v.rage = 70; const g0 = g.rage, v0 = v.rage;
    const plan = must(e.submit({ kind: 'combo', combo: 'goku_vegeta', target: e.enemies()[0].uid }, g.uid));
    expect(g.rage).toBe(g0 - 50); expect(v.rage).toBe(v0 - 50); void plan;
  });
});

describe('Rage pacing (simulated naturally levelled parties; a model of play, not a human playthrough)', () => {
  const fights: [string, HeroId[], number, string[]][] = [
    ['Dodoria', ['gohan', 'krillin', 'vegeta'], 11, ['dodoria']], ['Zarbon', ['gohan', 'krillin', 'vegeta'], 14, ['zarbon']],
    ['Guldo', ['gohan', 'krillin', 'vegeta'], 14, ['guldo']], ['Ginyu', ['goku', 'vegeta', 'gohan'], 17, ['ginyu']],
  ];
  it('a story midboss lets an attentive or average guarder spend Rage in most fights; a quick random fight rarely reaches 100', () => {
    for (const [name, party, lv, foes] of fights) for (const [p, g] of [[0.35, 0.35], [0.15, 0.3]] as const) {
      const r = rageProfile({ party, level: lv, foes, perfect: p, good: g, seeds: 10 });
      expect(r.reachedFull, `${name} reaches full Rage (guard ${p}/${g})`).toBeGreaterThanOrEqual(0.5);
    }
    for (const [p, g] of [[0.35, 0.35], [0, 0]] as const) {
      const scouts = rageProfile({ party: ['gohan', 'krillin', 'vegeta'], level: 8, foes: ['scout', 'scout'], perfect: p, good: g, seeds: 10, hpMul: 2, atkMul: 3 });
      expect(scouts.reachedFull, 'two scouts').toBeLessThanOrEqual(0.2);
      const guards = rageProfile({ party: ['gohan', 'krillin', 'vegeta'], level: 14, foes: ['guard', 'guard', 'scout'], perfect: p, good: g, seeds: 10, hpMul: 2, atkMul: 3 });
      expect(guards.reachedFull, 'three soldiers').toBeLessThanOrEqual(0.4);
    }
  });
  it('even a player who never guards still reaches Rage in a long boss fight (Easy and Normal stay reasonable)', () => {
    const r = rageProfile({ party: ['goku', 'vegeta', 'gohan'], level: 17, foes: ['ginyu'], perfect: 0, good: 0, seeds: 8 });
    expect(r.reachedFull).toBeGreaterThanOrEqual(0.5);
  });
});
