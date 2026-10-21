import { describe, it, expect } from 'vitest';
import { BattleEngine, isError } from '../../src/engine/combat/engine';
import { buildAlly, buildEnemy, newMember } from '../../src/systems/party';
import type { ActionPlan, Fighter, HeroId } from '../../src/types';
import { hasStatus } from '../../src/engine/combat/formulas';

function mk(heroes: [HeroId, number][], foes: string[], seed = 7, extra: Partial<ConstructorParameters<typeof BattleEngine>[0]> = {}) {
  const allies = heroes.map(([id, lv], i) => buildAlly(newMember(id, lv), i));
  const enemies = foes.map((id, i) => buildEnemy(id, i));
  return new BattleEngine({ allies, enemies, seed, inventory: { medkit: 2, senzu: 1 }, unlockedCombos: ['gohan_krillin', 'goku_vegeta', 'z_trio'], ...extra });
}
/** Advance until a fighter of the given defId can take input. */
function turnOf(e: BattleEngine, defId: string): Fighter {
  for (let i = 0; i < 60; i++) {
    const t = e.nextTurn();
    if (t.kind === 'end') throw new Error('battle ended');
    if (t.actor.defId === defId && t.kind !== 'skip') return t.actor;
    if (t.kind === 'input' || t.kind === 'ai') { e.submit({ kind: 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'defend', targetIds: [], steps: [], guardTargets: [] }); }
  }
  throw new Error('turn not reached');
}
const must = (p: ActionPlan | { error: string }): ActionPlan => { if (isError(p)) throw new Error(p.error); return p; };
function run(e: BattleEngine, plan: ActionPlan, guard: 'none' | 'good' | 'perfect' = 'none') {
  const results = plan.steps.map((s) => e.commit(plan, s, guard));
  e.finishAction(plan);
  return results;
}

describe('damage commits at hit markers only', () => {
  it('planning and beginning an action never changes target HP', () => {
    const e = mk([['gohan', 1]], ['scout']);
    const g = turnOf(e, 'gohan');
    const foe = e.enemies()[0];
    const before = foe.hp;
    const plan = must(e.submit({ kind: 'attack', target: foe.uid }, g.uid));
    expect(foe.hp).toBe(before);
    expect(plan.steps).toHaveLength(3);
    const r0 = e.commit(plan, plan.steps[0]);
    expect(foe.hp).toBe(before - r0.damage);
    expect(r0.damage).toBeGreaterThan(0);
  });
  it('a hit cannot be committed twice', () => {
    const e = mk([['gohan', 1]], ['scout']);
    const g = turnOf(e, 'gohan');
    const plan = must(e.submit({ kind: 'attack', target: e.enemies()[0].uid }, g.uid));
    e.commit(plan, plan.steps[0]);
    expect(() => e.commit(plan, plan.steps[0])).toThrow();
  });
  it('is deterministic for a given seed', () => {
    const play = () => {
      const e = mk([['goku', 5], ['gohan', 5]], ['guard', 'guard'], 99);
      const out: number[] = [];
      for (let i = 0; i < 6; i++) {
        const t = e.nextTurn();
        if (t.kind === 'end') break;
        if (t.kind === 'skip') continue;
        const cmd = t.kind === 'ai' ? e.aiCommand(t.actor) : ({ kind: 'attack', target: e.enemies()[0].uid } as const);
        const p = must(e.submit(cmd, t.actor.uid));
        out.push(...run(e, p).map((r) => r.damage));
      }
      return out;
    };
    expect(play()).toEqual(play());
  });
  it('dead targets take no damage from remaining hits', () => {
    const e = mk([['goku', 20]], ['scout']);
    const g = turnOf(e, 'goku');
    const foe = e.enemies()[0];
    foe.hp = 1;
    const plan = must(e.submit({ kind: 'attack', target: foe.uid }, g.uid));
    const rs = plan.steps.map((s) => e.commit(plan, s));
    expect(rs[0].killed).toBe(true);
    expect(rs.slice(1).every((r) => r.damage === 0 && r.missed)).toBe(true);
    expect(foe.hp).toBe(0);
  });
});

describe('Ki, items and legality', () => {
  it('rejects skills without enough Ki and never goes negative', () => {
    const e = mk([['vegeta', 1]], ['scout']);
    const v = turnOf(e, 'vegeta');
    v.ki = 10;
    expect(isError(e.plan({ kind: 'skill', skill: 'galick', target: e.enemies()[0].uid }, v.uid))).toBe(true);
    expect(v.ki).toBe(10);
  });
  it('spends Ki when the action begins', () => {
    const e = mk([['vegeta', 1]], ['scout']);
    const v = turnOf(e, 'vegeta');
    const k = v.ki;
    must(e.submit({ kind: 'skill', skill: 'galick', target: e.enemies()[0].uid }, v.uid));
    expect(v.ki).toBe(k - 32);
  });
  it('cannot use skills that are not learned yet', () => {
    const e = mk([['gohan', 1]], ['scout']);
    const g = turnOf(e, 'gohan');
    expect(isError(e.plan({ kind: 'skill', skill: 'dragonkick', target: e.enemies()[0].uid }, g.uid))).toBe(true);
  });
  it('Regeneration heals an ally and rejects self-target', () => {
    const e = mk([['piccolo', 1], ['gohan', 1]], ['scout']);
    const p = turnOf(e, 'piccolo');
    const ally = e.allies().find((a) => a.defId === 'gohan')!;
    ally.hp = 50;
    expect(isError(e.plan({ kind: 'skill', skill: 'regenerate' }, p.uid))).toBe(true);
    const plan = must(e.submit({ kind: 'skill', skill: 'regenerate', target: ally.uid }, p.uid));
    run(e, plan);
    expect(ally.hp).toBeGreaterThan(50);
  });
  it('items consume inventory and senzu revives', () => {
    const e = mk([['gohan', 1], ['krillin', 1]], ['scout']);
    const g = turnOf(e, 'gohan');
    const k = e.allies().find((a) => a.defId === 'krillin')!;
    k.hp = 0; k.alive = false;
    expect(isError(e.plan({ kind: 'item', item: 'medkit', target: k.uid }, g.uid))).toBe(true);
    const plan = must(e.submit({ kind: 'item', item: 'senzu', target: k.uid }, g.uid));
    run(e, plan);
    expect(k.alive).toBe(true);
    expect(k.hp).toBe(k.stats.hp);
    expect(e.inventory.senzu).toBe(0);
    expect(isError(e.plan({ kind: 'item', item: 'senzu', target: k.uid }, g.uid))).toBe(true);
  });
  it('cannot act out of turn or when down', () => {
    const e = mk([['gohan', 1], ['krillin', 1]], ['scout']);
    const g = turnOf(e, 'gohan');
    const other = e.allies().find((a) => a.uid !== g.uid)!;
    expect(isError(e.plan({ kind: 'defend' }, other.uid))).toBe(true);
  });
});

describe('Rage is per fighter', () => {
  it('only the participants gain rage; rage art needs 100', () => {
    const e = mk([['gohan', 3], ['krillin', 3]], ['scout']);
    const g = turnOf(e, 'gohan');
    const k = e.allies().find((a) => a.defId === 'krillin')!;
    expect(isError(e.plan({ kind: 'skill', skill: 'hiddenpower', target: e.enemies()[0].uid }, g.uid))).toBe(true);
    const gBefore = g.rage, kBefore = k.rage;
    run(e, must(e.submit({ kind: 'attack', target: e.enemies()[0].uid }, g.uid)));
    expect(g.rage).toBeGreaterThan(gBefore);
    expect(k.rage).toBe(kBefore);
  });
  it('rage art works at 100 rage and resets rage', () => {
    const e = mk([['gohan', 3]], ['dodoria']);
    const g = turnOf(e, 'gohan');
    g.rage = 100;
    run(e, must(e.submit({ kind: 'skill', skill: 'hiddenpower', target: e.enemies()[0].uid }, g.uid)));
    expect(g.rage).toBeLessThan(30);
  });
  it('Sparking halves Ki costs and requires full Rage', () => {
    const e = mk([['vegeta', 3]], ['dodoria']);
    const v = turnOf(e, 'vegeta');
    expect(isError(e.plan({ kind: 'sparking' }, v.uid))).toBe(true);
    v.rage = 100;
    const p = must(e.submit({ kind: 'sparking' }, v.uid));
    e.finishAction(p);
    expect(hasStatus(v, 'sparking')).toBe(true);
    expect(v.rage).toBe(0);
  });
});

describe('Sparking combos', () => {
  it('require every partner to have 50 rage and not have acted', () => {
    const e = mk([['gohan', 5], ['krillin', 5]], ['dodoria']);
    e.allies().find((a) => a.defId === 'gohan')!.stats.spd = 99;
    const g = turnOf(e, 'gohan');
    const k = e.allies().find((a) => a.defId === 'krillin')!;
    g.rage = 80; k.rage = 20;
    expect(isError(e.plan({ kind: 'combo', combo: 'gohan_krillin', target: e.enemies()[0].uid }, g.uid))).toBe(true);
    k.rage = 60;
    const plan = must(e.submit({ kind: 'combo', combo: 'gohan_krillin', target: e.enemies()[0].uid }, g.uid));
    expect(g.rage).toBe(30);
    expect(k.rage).toBe(10);
    expect(k.actedThisRound).toBe(true);
    const rs = run(e, plan);
    expect(rs.reduce((s, r) => s + r.damage, 0)).toBeGreaterThan(100);
  });
  it('locked recipes are unavailable', () => {
    const e = mk([['piccolo', 5], ['gohan', 5]], ['dodoria']);
    const p = turnOf(e, 'piccolo');
    p.rage = 90; e.allies().forEach((a) => { a.rage = 90; });
    expect(isError(e.plan({ kind: 'combo', combo: 'piccolo_gohan', target: e.enemies()[0].uid }, p.uid))).toBe(true);
  });
});

describe('Active Guard grading changes damage', () => {
  it('perfect < good < none for the same enemy hit', () => {
    const dmg = (grade: 'none' | 'good' | 'perfect') => {
      const e = mk([['gohan', 5]], ['dodoria'], 3);
      for (let i = 0; i < 20; i++) {
        const t = e.nextTurn();
        if (t.kind === 'end') throw new Error('over');
        if (t.kind === 'ai') {
          const plan = must(e.submit({ kind: 'skill', skill: 'e_pummel' }, t.actor.uid));
          const r = run(e, plan, grade);
          return r.reduce((s, x) => s + x.damage, 0);
        }
        e.submit({ kind: 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'defend', targetIds: [], steps: [], guardTargets: [] });
      }
      throw new Error('no enemy turn');
    };
    const n = dmg('none'), g = dmg('good'), p = dmg('perfect');
    expect(p).toBeLessThan(g);
    expect(g).toBeLessThan(n);
  });
  it('defending reduces incoming damage', () => {
    const run1 = (defend: boolean) => {
      const e = mk([['gohan', 5]], ['dodoria'], 3);
      const t0 = e.nextTurn();
      if (t0.kind === 'input' && defend) { e.submit({ kind: 'defend' }, t0.actor.uid); e.finishAction({ id: 0, actorId: t0.actor.uid, skillId: 'defend', targetIds: [], steps: [], guardTargets: [] }); }
      else if (t0.kind === 'input') { e.submit({ kind: 'attack', target: e.enemies()[0].uid }, t0.actor.uid); e.finishAction({ id: 0, actorId: t0.actor.uid, skillId: 'atk', targetIds: [], steps: [], guardTargets: [] }); }
      for (let i = 0; i < 10; i++) {
        const t = e.nextTurn();
        if (t.kind === 'ai') {
          const plan = must(e.submit({ kind: 'skill', skill: 'e_pummel' }, t.actor.uid));
          return run(e, plan).reduce((s, x) => s + x.damage, 0);
        }
        if (t.kind === 'input') { e.submit({ kind: defend ? 'defend' : 'attack' as never, target: e.enemies()[0].uid } as never, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'x', targetIds: [], steps: [], guardTargets: [] }); }
      }
      return 0;
    };
    expect(run1(true)).toBeLessThan(run1(false));
  });
});

describe('boss mechanics', () => {
  it('Dodoria telegraphs Mach Crush, then strikes', () => {
    const e = mk([['goku', 8]], ['dodoria']);
    const d = (() => { for (;;) { const t = e.nextTurn(); if (t.kind === 'ai') return t.actor; if (t.kind === 'end') throw new Error('x'); e.submit({ kind: 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'd', targetIds: [], steps: [], guardTargets: [] }); } })();
    const plan = must(e.submit({ kind: 'skill', skill: 'e_machcrush' }, d.uid));
    expect(plan.charging).toBe(true);
    expect(plan.steps).toHaveLength(0);
    expect(d.chargedMove).toBe('e_machcrush');
    e.finishAction(plan);
    // next time it is Dodoria's turn, it must release the charged move
    for (let i = 0; i < 10; i++) {
      const t = e.nextTurn();
      if (t.kind === 'ai') {
        const cmd = e.aiCommand(t.actor);
        expect(cmd).toEqual({ kind: 'skill', skill: 'e_machcrush' });
        const p2 = must(e.submit(cmd, t.actor.uid));
        expect(p2.charging).toBeFalsy();
        expect(p2.steps.length).toBe(1);
        expect(p2.guardTargets).toHaveLength(1);
        return;
      }
      if (t.kind === 'input') { e.submit({ kind: 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'd', targetIds: [], steps: [], guardTargets: [] }); }
    }
    throw new Error('Dodoria did not act again');
  });
  it('heavy damage during a charge interrupts it', () => {
    const e = mk([['goku', 12]], ['recoome']);
    const r = e.enemies()[0];
    r.statuses.push({ kind: 'charging', turns: 99 }); r.chargedMove = 'e_eraser'; r.chargeLeft = 1; r.chargeDmg = 0;
    const g = turnOf(e, 'goku');
    r.hp = r.stats.hp;
    const plan = must(e.submit({ kind: 'skill', skill: 'kamehameha', target: r.uid }, g.uid));
    const events = [];
    plan.steps.forEach((s) => e.commit(plan, s));
    events.push(...e.finishAction(plan));
    if (r.chargeDmg === 0 && !r.chargedMove) expect(events.some((x) => x.type === 'interrupt')).toBe(true);
    else expect(r.hp).toBeLessThan(r.stats.hp);
  });
  it('Cui reflects physical hits but not Ki techniques', () => {
    const e = mk([['gohan', 3], ['piccolo', 3]], ['cui']);
    const cui = e.enemies()[0];
    cui.statuses.push({ kind: 'counter', turns: 2, power: 0.4 });
    const g = turnOf(e, 'gohan');
    const planP = must(e.submit({ kind: 'attack', target: cui.uid }, g.uid));
    const rp = planP.steps.map((s) => e.commit(planP, s));
    expect(rp.some((r) => r.countered > 0)).toBe(true);
    expect(g.hp).toBeLessThan(g.stats.hp);
    e.finishAction(planP);
    const e2 = mk([['gohan', 3]], ['cui']);
    const cui2 = e2.enemies()[0];
    cui2.statuses.push({ kind: 'counter', turns: 2, power: 0.4 });
    const g2 = turnOf(e2, 'gohan');
    const planK = must(e2.submit({ kind: 'skill', skill: 'masenko', target: cui2.uid }, g2.uid));
    const rk = planK.steps.map((s) => e2.commit(planK, s));
    expect(rk[0].countered).toBe(0);
  });
  it('Zarbon transforms at half HP into a distinct form', () => {
    const e = mk([['goku', 10]], ['zarbon']);
    const z = e.enemies()[0];
    const g = turnOf(e, 'goku');
    z.hp = Math.round(z.stats.hp * 0.45);
    const plan = must(e.submit({ kind: 'defend' }, g.uid));
    const ev = e.finishAction(plan);
    expect(ev.some((x) => x.type === 'phase' && x.toForm === 'zarbon2')).toBe(true);
    expect(z.defId).toBe('zarbon2');
    expect(z.sprite).toBe('zarbon2');
    expect(z.hp).toBeGreaterThan(z.stats.hp * 0.5);
  });
  it('Ginyu body change possesses the strongest fighter for a limited time', () => {
    const e = mk([['goku', 10], ['gohan', 10]], ['ginyu']);
    const gin = e.enemies()[0];
    let t = e.nextTurn();
    while (!(t.kind === 'ai' && t.actor.defId === 'ginyu')) {
      if (t.kind === 'input') { e.submit({ kind: 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'd', targetIds: [], steps: [], guardTargets: [] }); }
      t = e.nextTurn();
    }
    const plan = must(e.submit({ kind: 'skill', skill: 'e_bodychange' }, gin.uid));
    e.commit(plan, plan.steps[0]);
    const goku = e.allies().find((a) => a.defId === 'goku')!;
    expect(hasStatus(goku, 'possessed')).toBe(true);
    e.finishAction(plan);
    // possessed Goku acts as AI and does not give the player input
    for (let i = 0; i < 10; i++) {
      const nt = e.nextTurn();
      if (nt.kind === 'ai' && nt.actor.defId === 'goku') { expect(e.aiCommand(nt.actor).kind).toBe('attack'); return; }
      if (nt.kind === 'input') { e.submit({ kind: 'defend' }, nt.actor.uid); e.finishAction({ id: 0, actorId: nt.actor.uid, skillId: 'd', targetIds: [], steps: [], guardTargets: [] }); }
      if (nt.kind === 'ai') { e.submit({ kind: 'defend' }, nt.actor.uid); e.finishAction({ id: 0, actorId: nt.actor.uid, skillId: 'd', targetIds: [], steps: [], guardTargets: [] }); }
    }
    throw new Error('possessed Goku never acted');
  });
  it('Guldo’s Time Freeze freezes at most two fighters', () => {
    const e = mk([['goku', 10], ['gohan', 10], ['krillin', 10]], ['guldo']);
    const gul = e.enemies()[0];
    let t = e.nextTurn();
    while (!(t.kind === 'ai')) { if (t.kind === 'end') throw new Error('end'); e.submit({ kind: 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'd', targetIds: [], steps: [], guardTargets: [] }); t = e.nextTurn(); }
    gul.chargedMove = 'e_timefreezeprep'; gul.chargeLeft = 0;
    const plan = must(e.submit({ kind: 'skill', skill: 'e_timefreezeprep' }, gul.uid));
    plan.steps.forEach((s) => e.commit(plan, s));
    expect(e.allies().filter((a) => hasStatus(a, 'frozen')).length).toBe(2);
  });
});

describe('statuses', () => {
  it('Kaioken lasts three of Goku’s own turns and costs HP', () => {
    const e = mk([['goku', 10]], ['dodoria'], 5);
    let t = turnOf(e, 'goku');
    const hp0 = t.hp;
    const p = must(e.submit({ kind: 'skill', skill: 'kaioken' }, t.uid));
    plan_commit(e, p);
    expect(t.hp).toBeLessThan(hp0);
    expect(hasStatus(t, 'kaioken')).toBe(true);
    let own = 0;
    for (let i = 0; i < 40 && hasStatus(t, 'kaioken'); i++) {
      const nt = e.nextTurn();
      if (nt.kind === 'end') break;
      if (nt.actor.uid === t.uid) own++;
      if (nt.kind === 'input') { e.submit({ kind: 'defend' }, nt.actor.uid); e.finishAction({ id: 0, actorId: nt.actor.uid, skillId: 'd', targetIds: [], steps: [], guardTargets: [] }); }
      if (nt.kind === 'ai') { e.submit({ kind: 'defend' as never } as never, nt.actor.uid); }
      if (nt.kind === 'ai') e.finishAction({ id: 0, actorId: nt.actor.uid, skillId: 'd', targetIds: [], steps: [], guardTargets: [] });
    }
    expect(own).toBe(3);
    t = e.get(t.uid);
  });
});

function plan_commit(e: BattleEngine, p: ActionPlan) { p.steps.forEach((s) => e.commit(p, s)); e.finishAction(p); }

describe('outcomes', () => {
  it('victory when all enemies fall; defeat when all allies fall', () => {
    const e = mk([['goku', 30]], ['scout']);
    const g = turnOf(e, 'goku');
    e.enemies()[0].hp = 1;
    plan_commit(e, must(e.submit({ kind: 'attack', target: e.enemies(false)[0].uid }, g.uid)));
    expect(e.outcome).toBe('victory');
    const e2 = mk([['gohan', 1]], ['frieza5']);
    e2.allies()[0].hp = 0; e2.allies()[0].alive = false;
    expect(e2.checkOutcome()).toBe('defeat');
  });
  it('scripted end triggers at the configured HP fraction', () => {
    const e = mk([['goku', 30]], ['frieza1'], 1, { rules: { scriptedEnd: { defId: 'frieza1', hpFrac: 0.5 } } });
    const g = turnOf(e, 'goku');
    e.enemies()[0].hp = Math.round(e.enemies()[0].stats.hp * 0.45);
    plan_commit(e, must(e.submit({ kind: 'defend' }, g.uid)));
    expect(e.outcome).toBe('victory');
    expect(e.scriptedWin).toBe(true);
  });
  it('fleeing can be forbidden', () => {
    const e = mk([['gohan', 1]], ['scout'], 1, { rules: { allowFlee: false } });
    const g = turnOf(e, 'gohan');
    expect(isError(e.plan({ kind: 'flee' }, g.uid))).toBe(true);
  });
});
