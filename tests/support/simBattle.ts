import { simulate, type SimOptions } from '../../src/engine/combat/autoplay';
import { ENEMIES } from '../../src/data/enemies';
import { soldierPower } from '../../src/data/balance';
import type { HeroId } from '../../src/types';
import type { BattleRecord } from './storyDriver';
import { BattleEngine } from '../../src/engine/combat/engine';
import { playEngine } from '../../src/engine/combat/autoplay';
import { buildBattleSides } from '../../src/systems/battleSetup';
import type { GameState } from '../../src/systems/gameState';
import { statsOf } from '../../src/systems/party';

export interface Rate { win: number; rounds: number; hp: number; kos: number }
/** Win rate of one recorded story battle at the player's ACTUAL levels (per-hero offsets), for a given play style. */
export function rateRecord(b: BattleRecord, o: { perfect: number; good: number; items?: boolean; n?: number; lvDelta?: number; naive?: boolean; easy?: boolean }): Rate {
  const n = o.n ?? 40; const levels = b.levels; const ids = b.party;
  const avg = Math.round(ids.reduce((a, id) => a + (levels[id] ?? 1), 0) / ids.length);
  const offsets: Partial<Record<HeroId, number>> = {}; for (const id of ids) offsets[id] = (levels[id] ?? avg) - avg;
  const lv = Math.max(1, avg + (o.lvDelta ?? 0));
  const soft = b.foes.every((f) => !ENEMIES[f].boss) ? soldierPower(lv) : { hp: 1, atk: 1 };
  const rules: SimOptions['rules'] = { allowFlee: !(b.spec.allowFlee === false) && !b.foes.some((f) => ENEMIES[f].boss) };
  if (b.spec.surviveRounds) rules.surviveRounds = b.spec.surviveRounds;
  if (b.spec.scriptedEnd) rules.scriptedEnd = b.spec.scriptedEnd;
  let wins = 0, rounds = 0, hp = 0, kos = 0;
  for (let s = 1; s <= n; s++) {
    const r = simulate({ party: ids, level: lv, levelOffsets: offsets, foes: b.foes, seed: s * 7919, rules, perfect: o.perfect, good: o.good, hpMul: soft.hp, atkMul: soft.atk * (o.easy ? 0.7 : 1), ssj: b.title.includes('100%'), naive: o.naive, inventory: o.items === false ? {} : undefined });
    if (r.outcome === 'victory') { wins++; rounds += r.rounds; hp += r.hpLeft; kos += r.kos; }
  }
  return { win: wins / n, rounds: wins ? rounds / wins : 0, hp: wins ? hp / wins : 0, kos: wins ? kos / wins : 0 };
}

/**
 * Win rate of one story fight from the REAL state the player had when it began (training points spent, capsules worn, bag, carried HP/Ki),
 * repeated with different seeds. `rested` starts everyone at full HP/Ki (an altar visit before the fight); otherwise the carried values are used.
 */
export function rateFromState(b: BattleRecord, o: { perfect: number; good: number; naive?: boolean; n?: number; easy?: boolean; rested?: boolean; /** shift every hero's level (what-if: that many levels under/over the route's) */ lvDelta?: number }): Rate {
  if (!b.before) throw new Error('rateFromState needs a record made in play mode');
  const n = o.n ?? 40; let wins = 0, rounds = 0, hp = 0, kos = 0;
  for (let seed = 1; seed <= n; seed++) {
    const s = JSON.parse(JSON.stringify(b.before)) as GameState;
    if (o.lvDelta) for (const m of s.roster) {   // same carried fraction of HP/Ki at the shifted level
      const before = statsOf(m), fh = m.hp / before.hp, fk = m.ki / before.ki;
      m.level = Math.max(1, Math.min(30, m.level + o.lvDelta)); const st = statsOf(m); m.hp = Math.max(1, Math.round(st.hp * fh)); m.ki = Math.round(st.ki * fk);
    }
    if (o.rested) for (const m of s.roster) { const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; }
    const { allies, enemies, rules } = buildBattleSides(s, b.spec, !!o.easy);
    const e = new BattleEngine({ allies, enemies, seed: seed * 7919, rules, unlockedCombos: s.combos, inventory: { ...s.inventory } });
    const r = playEngine(e, { seed: seed * 104729, perfect: o.perfect, good: o.good, naive: o.naive });
    if (r.outcome === 'victory') { wins++; rounds += r.rounds; hp += r.hpLeft; kos += r.kos; }
  }
  return { win: wins / n, rounds: wins ? rounds / wins : 0, hp: wins ? hp / wins : 0, kos: wins ? kos / wins : 0 };
}
