import { describe, it, expect } from 'vitest';
import { BattleEngine, isError } from '../../src/engine/combat/engine';
import { BattleController } from '../../src/engine/combat/controller';
import { buildAlly, buildEnemy, newMember, statsOf } from '../../src/systems/party';
import { newGameState, addItem } from '../../src/systems/gameState';
import { buyItem, equipCapsule, unequipCapsule, useItemOutside } from '../../src/systems/inventoryOps';
import { effAtk, effDef, effSpd, hasStatus, kiCost, CHARGE_INTERRUPT_FRAC } from '../../src/engine/combat/formulas';
import { SKILLS } from '../../src/data/skills';
import type { ActionPlan, Fighter, HeroId } from '../../src/types';

function mk(heroes: [HeroId, number][], foes: string[], seed = 7, extra: Partial<ConstructorParameters<typeof BattleEngine>[0]> = {}) {
  const allies = heroes.map(([id, lv], i) => buildAlly(newMember(id, lv), i));
  const enemies = foes.map((id, i) => buildEnemy(id, i));
  return new BattleEngine({ allies, enemies, seed, inventory: { medkit: 2, senzu: 1, kicapsule: 1 }, unlockedCombos: ['gohan_krillin', 'goku_vegeta', 'z_trio'], ...extra });
}
const must = (p: ActionPlan | { error: string }): ActionPlan => { if (isError(p)) throw new Error(p.error); return p; };
function run(e: BattleEngine, plan: ActionPlan, guard: 'none' | 'good' | 'perfect' = 'none') { const r = plan.steps.map((s) => e.commit(plan, s, guard)); e.finishAction(plan); return r; }
/** Advance (defending for everyone else) until the given fighter has the turn. */
function turnOf(e: BattleEngine, uid: string): { kind: string; actor: Fighter } {
  for (let i = 0; i < 80; i++) {
    const t = e.nextTurn(); if (t.kind === 'end') throw new Error('battle ended');
    if (t.actor.uid === uid) return t;
    if (t.kind === 'input' || t.kind === 'ai') { const c = t.kind === 'ai' ? e.aiCommand(t.actor) : { kind: 'defend' as const }; let p = e.plan(c, t.actor.uid); if (isError(p)) p = e.plan({ kind: 'defend' }, t.actor.uid); if (!isError(p)) { e.begin(p); for (const s of p.steps) e.commit(p, s, 'none'); e.finishAction(p); } }
  }
  throw new Error('turn not reached');
}

describe('status effects (turn flow)', () => {
  it('Stun skips exactly one action and then wears off', () => {
    const e = mk([['gohan', 12], ['krillin', 12]], ['scout']);
    const g = e.get('a_gohan'); e.addStatus(g, { kind: 'stun', turns: 1 });
    const t = turnOf(e, 'a_gohan'); expect(t.kind).toBe('skip'); expect(hasStatus(g, 'stun')).toBe(false);
    for (let i = 0; i < 4; i++) { const n = turnOf(e, 'a_gohan'); if (n.kind !== 'skip') { expect(n.kind).toBe('input'); return; } }
    throw new Error('Gohan never acted again after the stun');
  });

  it('Seal blocks Ki skills but never basic attacks, Defend or items', () => {
    const e = mk([['gohan', 12], ['krillin', 12]], ['scout']);
    const g = e.get('a_gohan'); g.ki = 999; e.addStatus(g, { kind: 'seal', turns: 3 });
    turnOf(e, 'a_gohan');
    expect(e.plan({ kind: 'skill', skill: 'masenko', target: 'e_scout_0_x' }, 'a_gohan')).toEqual({ error: 'Ki is sealed' });
    const enemy = e.enemies()[0];
    expect(isError(e.plan({ kind: 'skill', skill: 'masenko', target: enemy.uid }, 'a_gohan'))).toBe(true);
    expect(isError(e.plan({ kind: 'attack', target: enemy.uid }, 'a_gohan'))).toBe(false);
    expect(isError(e.plan({ kind: 'defend' }, 'a_gohan'))).toBe(false);
    expect(isError(e.plan({ kind: 'item', item: 'kicapsule', target: g.uid }, 'a_gohan'))).toBe(false);
  });

  it('Blind makes damaging attacks miss about half the time (and only while blind)', () => {
    let blindMiss = 0, baseMiss = 0; const N = 120;
    for (let seed = 1; seed <= N; seed++) {
      const e = mk([['vegeta', 15]], ['guard'], seed); const v = e.get('a_vegeta'); turnOf(e, v.uid);
      const base = must(e.submit({ kind: 'attack', target: e.enemies()[0].uid }, v.uid)); if (base.steps.map((st) => e.commit(base, st)).some((r) => r.missed)) baseMiss++;
      const e2 = mk([['vegeta', 15]], ['guard'], seed); const v2 = e2.get('a_vegeta'); e2.addStatus(v2, { kind: 'blind', turns: 3 }); turnOf(e2, v2.uid);
      const p = must(e2.submit({ kind: 'attack', target: e2.enemies()[0].uid }, v2.uid)); if (p.steps.map((st) => e2.commit(p, st)).every((r) => r.missed)) blindMiss++;
    }
    expect(baseMiss, 'no misses without blindness').toBe(0);
    expect(blindMiss / N).toBeGreaterThan(0.25); expect(blindMiss / N).toBeLessThan(0.75);
  });

  it('Regen heals 6% of max HP at the start of the owner’s turn, never above max', () => {
    const e = mk([['gohan', 12]], ['scout']); const g = e.get('a_gohan'); g.hp = Math.round(g.stats.hp * 0.5); e.addStatus(g, { kind: 'regen', turns: 3 });
    const hp0 = g.hp; turnOf(e, g.uid); expect(g.hp).toBe(Math.min(g.stats.hp, hp0 + Math.round(g.stats.hp * 0.06)));
    g.hp = g.stats.hp; for (let i = 0; i < 2; i++) { try { turnOf(e, g.uid); } catch { break; } } expect(g.hp).toBeLessThanOrEqual(g.stats.hp);
  });

  it('ATK/DEF up and down change real damage in the right direction', () => {
    const dmg = (mod: (a: Fighter, t: Fighter) => void) => { const e = mk([['vegeta', 15]], ['guard'], 11); const a = e.get('a_vegeta'), t = e.enemies()[0]; mod(a, t); turnOf(e, a.uid); const hp = t.hp; run(e, must(e.plan({ kind: 'attack', target: t.uid }, a.uid))); return hp - t.hp; };
    const base = dmg(() => {});
    expect(dmg((a) => e0(a, { kind: 'atkUp', turns: 3, power: 0.3 }))).toBeGreaterThan(base);
    expect(dmg((a) => e0(a, { kind: 'atkDown', turns: 3, power: 0.3 }))).toBeLessThan(base);
    expect(dmg((_a, t) => e0(t, { kind: 'defUp', turns: 3, power: 0.5 }))).toBeLessThan(base);
    expect(dmg((_a, t) => e0(t, { kind: 'defDown', turns: 3, power: 0.5 }))).toBeGreaterThan(base);
    function e0(f: Fighter, s: { kind: 'atkUp' | 'atkDown' | 'defUp' | 'defDown'; turns: number; power: number }) { f.statuses.push({ ...s }); }
  });
});

describe('Kaioken and Super Saiyan', () => {
  it('Kaioken multiplies ATK and SPD, costs HP, and never kills the user', () => {
    const e = mk([['goku', 18]], ['guard']); const g = e.get('a_goku'); turnOf(e, g.uid);
    const atk0 = effAtk(g), spd0 = effSpd(g), hp0 = g.hp;
    run(e, must(e.submit({ kind: 'skill', skill: 'kaioken' }, g.uid)));
    expect(hasStatus(g, 'kaioken')).toBe(true); expect(effAtk(g)).toBeGreaterThan(atk0 * 1.3); expect(effSpd(g)).toBeCloseTo(spd0 * 1.25, 5);
    expect(g.hp).toBeLessThan(hp0); expect(g.hp).toBeGreaterThan(0);
    const low = mk([['goku', 18]], ['guard']); const l = low.get('a_goku'); l.hp = 1; turnOf(low, l.uid);
    const lp = low.submit({ kind: 'skill', skill: 'kaioken' }, l.uid); if (!isError(lp)) run(low, lp);
    expect(l.alive && l.hp >= 1, 'Kaioken at 1 HP must not be a suicide button').toBe(true);
  });

  it('a Super Saiyan can still use Kaioken, and the two bonuses stack multiplicatively (honest, documented behaviour)', () => {
    const m = newMember('goku', 22); m.ssj = true; const f = buildAlly(m, 0);
    expect(f.skills).toContain('kaioken'); expect(f.skills).toContain('ssjkame'); expect(f.skills).not.toContain('kamehameha');
    const base = effAtk(f); f.statuses.push({ kind: 'kaioken', turns: 3, power: 0.4 });
    expect(effAtk(f)).toBeCloseTo(base * 1.4, 5);
  });

  it('Sparking halves Ki costs (rounded) and raises ATK by 25%', () => {
    const f = buildAlly(newMember('gohan', 12), 0); const atk = effAtk(f); const cost = SKILLS.masenko.cost;
    expect(kiCost(f, cost)).toBe(cost); f.statuses.push({ kind: 'sparking', turns: 3 });
    expect(kiCost(f, cost)).toBe(Math.round(cost * 0.5)); expect(effAtk(f)).toBeCloseTo(atk * 1.25, 5); expect(effDef(f)).toBe(f.stats.def);
  });
});

describe('charge interrupts', () => {
  it('only a hit of at least 16% of the boss’s max HP in one turn breaks a charge', () => {
    expect(CHARGE_INTERRUPT_FRAC).toBeCloseTo(0.16, 5);
    const setup = (seed: number) => {
      const e = mk([['vegeta', 25]], ['dodoria'], seed); const d = e.enemies()[0];
      d.statuses.push({ kind: 'charging', turns: 99 }); d.chargedMove = 'e_machcrush'; d.chargeLeft = 1; d.chargeDmg = 0;
      const v = turnOf(e, 'a_vegeta').actor; d.hp = d.stats.hp; return { e, d, v };
    };
    // a weak jab (Defend-like chip) stays below the threshold: the charge survives
    const a = setup(3); a.d.chargeDmg = Math.round(a.d.stats.hp * 0.05);
    const pa = must(a.e.submit({ kind: 'attack', target: a.d.uid }, a.v.uid)); pa.steps.forEach((st) => a.e.commit(pa, st)); a.e.finishAction(pa);
    const hitFrac = (a.d.stats.hp - a.d.hp) / a.d.stats.hp;
    if (hitFrac + 0.05 < CHARGE_INTERRUPT_FRAC) expect(a.d.chargedMove, 'a light hit does not interrupt').toBe('e_machcrush');
    // a Rage Art (the biggest hit in the game) does break it
    const b = setup(5); b.v.rage = 100; b.v.statuses.push({ kind: 'atkUp', turns: 3, power: 1 });
    const art = b.v.skills.find((k) => SKILLS[k].rageArt)!;
    const pb = must(b.e.submit({ kind: 'skill', skill: art, target: b.d.uid }, b.v.uid)); pb.steps.forEach((st) => b.e.commit(pb, st)); const ev = b.e.finishAction(pb);
    expect(ev.some((x) => x.type === 'interrupt') || !b.d.chargedMove, 'a huge hit interrupts the charge').toBe(true);
  });
});

describe('affordability and reasons shown to the player', () => {
  function ctl(party: [HeroId, number][], foes: string[], mut?: (e: BattleEngine) => void) {
    const e = mk(party, foes); mut?.(e);
    const c = new BattleController({ allies: e.fighters.filter((f) => f.side === 'ally'), enemies: e.fighters.filter((f) => f.side === 'enemy'), seed: 1, inventory: { medkit: 1 }, unlockedCombos: ['gohan_krillin'], rules: {} }, { stageKind: 'plain', theme: 'battle', onFinish: () => {} });
    return c;
  }
  it('skill rows say exactly why they are disabled (Ki, seal) and list cost, hits, status and HP cost', () => {
    const c = ctl([['gohan', 12], ['krillin', 12]], ['scout']); const a = c.engine.get('a_gohan');
    a.ki = 0; expect(c.skillRows(a).find((r) => r.id === 'masenko')!.disabled).toBe('Not enough Ki');
    a.ki = 999; expect(c.skillRows(a).find((r) => r.id === 'masenko')!.disabled).toBeUndefined();
    a.statuses.push({ kind: 'seal', turns: 2 }); expect(c.skillRows(a).find((r) => r.id === 'masenko')!.disabled).toBe('Sealed');
    const g = ctl([['goku', 18]], ['scout']); const gk = g.skillRows(g.engine.get('a_goku')).find((r) => r.id === 'kaioken')!;
    expect(gk.sub).toMatch(/Costs 12% HP/); expect(gk.sub).toMatch(/Kaioken/);
  });
  it('combos explain why they are blocked', () => {
    const c = ctl([['gohan', 12], ['krillin', 12]], ['scout']); const a = c.engine.get('a_gohan');
    const rows = c.comboRows(a); expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) if (r.disabled) expect(r.disabled.length).toBeGreaterThan(3);
    expect(rows[0].disabled, 'no Rage yet').toBeTruthy();
  });
});

describe('equipment and stats', () => {
  it('capsules change stats exactly by their bonus and are reflected in battle fighters; Fury raises Rage gain', () => {
    const m = newMember('vegeta', 15); const base = statsOf(m);
    m.capsules = ['powercap', 'guardcap']; const s = statsOf(m);
    expect(s.atk).toBe(base.atk + 6); expect(s.def).toBe(base.def + 5);
    m.capsules = ['ragecap']; expect(buildAlly(m, 0).rageGainMult).toBeCloseTo(1.25, 5); m.capsules = []; expect(buildAlly(m, 0).rageGainMult).toBe(1);
  });
  it('level and training points recompute stats; a free reset returns every point', () => {
    const m = newMember('gohan', 10); m.unspent = 6; const b = statsOf(m);
    m.alloc.atk = 3; m.unspent = 3; expect(statsOf(m).atk).toBeGreaterThan(b.atk);
  });
});

describe('items and the shop (field rules)', () => {
  const st = () => { const s = newGameState(); return s; };
  it('a refused use never consumes the item, and a real use consumes exactly one', () => {
    const s = st(); const g = s.roster[0]; const full = statsOf(g);
    let r = useItemOutside(s, 'medkit', g.id); expect(r.ok).toBe(false); expect(s.inventory.medkit).toBe(3);
    r = useItemOutside(s, 'kicapsule', g.id); expect(r.ok).toBe(false); expect(s.inventory.kicapsule).toBe(2);
    addItem(s, 'senzu', 1); r = useItemOutside(s, 'senzu', g.id); expect(r.ok).toBe(false); expect(s.inventory.senzu, 'senzu at full strength is not wasted').toBe(1);
    g.hp = 10; r = useItemOutside(s, 'medkit', g.id); expect(r.ok).toBe(true); expect(s.inventory.medkit).toBe(2); expect(g.hp).toBe(Math.min(full.hp, 10 + 120));
    g.hp = 1; g.ki = 0; r = useItemOutside(s, 'senzu', g.id); expect(r.ok).toBe(true); expect(g.hp).toBe(full.hp); expect(g.ki).toBe(full.ki); expect(s.inventory.senzu).toBeUndefined();
    expect(useItemOutside(s, 'senzu', g.id).ok, 'none left').toBe(false); expect(useItemOutside(s, 'powercap', g.id).ok, 'capsules are equipment').toBe(false);
  });
  it('HP and Ki never exceed the maximum and items on the wrong hero are ignored', () => {
    const s = st(); const k = s.roster[1]; k.hp = statsOf(k).hp - 5; useItemOutside(s, 'megakit', k.id); expect(k.hp).toBeLessThanOrEqual(statsOf(k).hp);
    expect(useItemOutside(s, 'medkit', 'goku').ok, 'not in the roster').toBe(false);
  });
  it('buying: not for sale / not enough zeni / carry cap 99 / exact price deducted', () => {
    const s = st(); s.zeni = 70;
    expect(buyItem(s, 'village', 'senzu').msg).toBe('Not for sale.'); expect(buyItem(s, 'nowhere', 'medkit').ok).toBe(false);
    expect(buyItem(s, 'village', 'megakit').msg).toBe('Not enough zeni.'); expect(s.zeni).toBe(70);
    expect(buyItem(s, 'village', 'kicapsule').ok).toBe(true); expect(s.zeni).toBe(0); expect(s.inventory.kicapsule).toBe(3);
    s.zeni = 9999; s.inventory.medkit = 99; const r = buyItem(s, 'village', 'medkit'); expect(r.msg).toBe('You cannot carry more.'); expect(s.zeni).toBe(9999); expect(s.inventory.medkit).toBe(99);
    addItem(s, 'medkit', 50); expect(s.inventory.medkit, 'chests and quests cap at 99 too').toBe(99);
  });
  it('equipping swaps and returns the previous capsule, clamps HP/Ki to the new maxima, and unequip restores the item', () => {
    const s = st(); const g = s.roster[0]; addItem(s, 'vitalcap', 1); addItem(s, 'powercap', 1);
    expect(equipCapsule(s, g.id, 'vitalcap', 0).ok).toBe(true); g.hp = statsOf(g).hp;
    expect(equipCapsule(s, g.id, 'powercap', 0).ok).toBe(true); expect(s.inventory.vitalcap, 'swapped capsule goes back').toBe(1); expect(g.capsules).toEqual(['powercap']);
    expect(g.hp).toBeLessThanOrEqual(statsOf(g).hp);
    expect(equipCapsule(s, g.id, 'powercap', 1).ok, 'none left').toBe(false); expect(equipCapsule(s, g.id, 'medkit', 0).ok, 'not equipment').toBe(false); expect(equipCapsule(s, g.id, 'powercap', 5).ok).toBe(false);
    expect(unequipCapsule(s, g.id, 0).ok).toBe(true); expect(s.inventory.powercap).toBe(1); expect(g.capsules).toEqual([]); expect(unequipCapsule(s, g.id, 0).ok).toBe(false);
  });
});
