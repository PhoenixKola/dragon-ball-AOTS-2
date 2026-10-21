import { describe, it, expect } from 'vitest';
import { simulate, type SimOptions } from '../../src/engine/combat/autoplay';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { HeroId } from '../../src/types';
import { soldierPower } from '../../src/data/balance';
import { ENEMIES } from '../../src/data/enemies';

// [id, party, expected party level, foes, rules, scale, ssj]
export interface B { id: string; party: HeroId[]; lv: number; foes: string[]; rules?: SimOptions['rules']; scale?: number; ssj?: boolean; min: number; max: number; offsets?: SimOptions['levelOffsets'] }
export const BATTLES: B[] = [
  { id: 'shore_scouts', party: ['gohan', 'krillin'], lv: 5, foes: ['scout', 'scout'], min: 0.8, max: 1 },
  { id: 'village_dende', party: ['gohan', 'krillin'], lv: 8, foes: ['scout', 'guard'], min: 0.8, max: 1 },
  { id: 'cui', party: ['gohan', 'krillin', 'vegeta'], lv: 11, foes: ['cui', 'guard'], min: 0.8, max: 1 },
  { id: 'dodoria', party: ['gohan', 'krillin', 'vegeta'], lv: 14, foes: ['dodoria'], min: 0.8, max: 1 },
  { id: 'zarbon', party: ['gohan', 'krillin', 'vegeta'], lv: 15, foes: ['zarbon'], min: 0.8, max: 1 },
  { id: 'guldo', party: ['gohan', 'krillin', 'vegeta'], lv: 17, foes: ['guldo'], min: 0.8, max: 1 },
  { id: 'recoome_survive', party: ['gohan', 'krillin', 'vegeta'], lv: 19, foes: ['recoome'], rules: { surviveRounds: 5, allowFlee: false }, min: 0.8, max: 1 },
  { id: 'recoome_goku', party: ['goku', 'vegeta', 'gohan'], lv: 19, foes: ['recoome'], min: 0.8, max: 1 },
  { id: 'duo', party: ['goku', 'vegeta', 'gohan'], lv: 20, foes: ['burter', 'jeice'], min: 0.8, max: 1 },
  { id: 'ginyu', party: ['goku', 'vegeta', 'gohan'], lv: 21, foes: ['ginyu'], min: 0.8, max: 1 },
  { id: 'nail_vs_frieza', party: ['nail', 'gohan', 'krillin'], lv: 22, foes: ['frieza1'], rules: { surviveRounds: 4, allowFlee: false }, min: 0.8, max: 1 },
  { id: 'frieza1', party: ['goku', 'vegeta', 'gohan'], lv: 23, foes: ['frieza1'], rules: { scriptedEnd: { defId: 'frieza1', hpFrac: 0.5 } }, min: 0.8, max: 1 },
  { id: 'frieza2', party: ['goku', 'vegeta', 'piccolo'], lv: 23, foes: ['frieza2'], rules: { scriptedEnd: { defId: 'frieza2', hpFrac: 0.5 } }, min: 0.8, max: 1 },
  { id: 'frieza3', party: ['vegeta', 'piccolo', 'gohan'], lv: 23, foes: ['frieza3'], rules: { scriptedEnd: { defId: 'frieza3', hpFrac: 0.55 } }, min: 0.8, max: 1 },
  { id: 'frieza4', party: ['gohan', 'krillin', 'piccolo'], lv: 24, foes: ['frieza4'], rules: { scriptedEnd: { defId: 'frieza4', hpFrac: 0.6 } }, min: 0.8, max: 1 },
  { id: 'final', party: ['goku', 'gohan', 'piccolo'], lv: 24, foes: ['frieza5'], ssj: true, rules: { allowFlee: false }, min: 0.8, max: 1 },
];

function rate(b: B, lvDelta: number, perfect: number, good: number, opts: { items?: boolean; n?: number } = {}) {
  const n = opts.n ?? 60; let wins = 0, rounds = 0, hp = 0, kos = 0;
  const soft = b.foes.every((f) => !ENEMIES[f].boss) ? soldierPower(b.lv + lvDelta) : { hp: 1, atk: 1 };
  for (let s = 1; s <= n; s++) {
    const r = simulate({ party: b.party, level: b.lv + lvDelta, foes: b.foes, seed: s * 7919, rules: b.rules, ssj: b.ssj, perfect, good, levelOffsets: b.offsets, hpMul: soft.hp, atkMul: soft.atk, inventory: opts.items === false ? {} : undefined });
    if (r.outcome === 'victory') { wins++; rounds += r.rounds; hp += r.hpLeft; kos += r.kos; }
  }
  return { win: wins / n, rounds: wins ? rounds / wins : 0, hp: wins ? hp / wins : 0, kos: wins ? kos / wins : 0 };
}

describe('balance: every authored story battle (deterministic simulation, 60 seeds each)', () => {
  const rows: string[] = ['| Battle | Party Lv | Win% (skilled) | Win% (no guard) | Win% (no guard, no items) | Win% (Lv-3) | Win% (Lv+3) | Avg rounds | HP left | KOs |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const b of BATTLES) {
    it(`${b.id}: beatable, takes real effort, rewards skill`, () => {
      const skilled = rate(b, 0, 0.35, 0.35), noGuard = rate(b, 0, 0, 0), bare = rate(b, 0, 0, 0, { items: false }), under = rate(b, -3, 0.35, 0.35), over = rate(b, 3, 0.35, 0.35);
      rows.push(`| ${b.id} | ${b.lv} | ${(skilled.win * 100).toFixed(0)} | ${(noGuard.win * 100).toFixed(0)} | ${(bare.win * 100).toFixed(0)} | ${(under.win * 100).toFixed(0)} | ${(over.win * 100).toFixed(0)} | ${skilled.rounds.toFixed(1)} | ${(skilled.hp * 100).toFixed(0)}% | ${skilled.kos.toFixed(1)} |`);
      expect(skilled.win, `${b.id} skilled win ${skilled.win}`).toBeGreaterThanOrEqual(b.min);
      expect(skilled.rounds, `${b.id} must not be a one-round pushover`).toBeGreaterThanOrEqual(3);
      expect(skilled.rounds, `${b.id} must not drag`).toBeLessThan(14);
      expect(skilled.hp, `${b.id} should cost HP`).toBeLessThan(0.93);
      expect(bare.win, `${b.id} without guard or items is a real risk`).toBeLessThan(skilled.win + 0.001);
      expect(over.win).toBeGreaterThanOrEqual(skilled.win - 0.05);
      expect(under.win).toBeLessThanOrEqual(skilled.win + 0.05);
    });
  }
  it('soldier encounters stay snappy and fair across the whole level range', () => {
    for (const lv of [5, 8, 11, 14, 17, 20, 23]) {
      const party: HeroId[] = lv < 10 ? ['gohan', 'krillin'] : lv < 16 ? ['gohan', 'krillin', 'vegeta'] : ['goku', 'vegeta', 'gohan'];
      const b: B = { id: 'enc' + lv, party, lv, foes: lv < 10 ? ['scout', 'scout'] : ['guard', 'guard', 'scout'], min: 0.9, max: 1 };
      const r = rate(b, 0, 0.35, 0.35);
      expect(r.win, 'enc win Lv' + lv).toBeGreaterThanOrEqual(0.93); expect(r.rounds, 'enc rounds Lv' + lv).toBeLessThan(6); expect(r.rounds).toBeGreaterThanOrEqual(2.2);
    }
  });
  it('the opening fights are survivable by a beginner who only presses Attack and never guards', () => {
    for (const [lv, party, foes] of [[5, ['gohan', 'krillin'], ['scout', 'scout']], [8, ['gohan', 'krillin'], ['scout', 'guard']], [11, ['gohan', 'krillin', 'vegeta'], ['guard', 'guard', 'scout']]] as [number, HeroId[], string[]][]) {
      const p = soldierPower(lv); let w = 0;
      for (let sd = 1; sd <= 60; sd++) if (simulate({ party, level: lv, foes, seed: sd * 7919, hpMul: p.hp, atkMul: p.atk, naive: true, perfect: 0, good: 0, inventory: {} }).outcome === 'victory') w++;
      expect(w / 60, 'naive win Lv' + lv).toBeGreaterThanOrEqual(0.95);
    }
  });
  it('writes the tuning table', () => {
    mkdirSync('docs', { recursive: true });
    const intro = ['# Balance table (generated by tests/unit/balance.test.ts)', '', 'Deterministic simulation, 60 seeds per cell, using the real enemy data. "Skilled" models a human who perfect-guards 35% / good-guards 35% of chains, uses items sensibly and the Rage/Combo systems. Levels are the intended party level at that story point (XP model in docs/GAME_DESIGN.md). This is a simulation of a scripted bot, not a human playtest.', ''];
    writeFileSync('docs/BALANCE_TABLE.md', [...intro, ...rows, ''].join(String.fromCharCode(10)));
    expect(rows.length).toBeGreaterThan(2);
  });
});
