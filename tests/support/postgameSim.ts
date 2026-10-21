import { BattleEngine } from '../../src/engine/combat/engine';
import { playEngine } from '../../src/engine/combat/autoplay';
import { buildAlly, buildEnemy, newMember, spendPoint, statsOf, type PartyMember } from '../../src/systems/party';
import type { HeroId, Stats } from '../../src/types';

const CYCLE: (keyof Stats)[] = ['hp', 'atk', 'hp', 'def'];

/** A naturally trained postgame hero: `level` with every training point spent the way a sensible player would (HP / ATK / HP / DEF) and two capsules. */
export function trainedMember(id: HeroId, level: number, o: { ssj?: boolean; fused?: boolean; capsules?: string[] } = {}): PartyMember {
  const m = newMember(id, level);
  m.unspent = (level - 1) * 3 * 0.9 | 0;                // a little under the maximum: nobody spends every point perfectly
  let i = 0; while (m.unspent > 0) { spendPoint(m, CYCLE[i++ % CYCLE.length]); }
  if (o.ssj) m.ssj = true; if (o.fused) m.fused = true; m.capsules = o.capsules ?? [];
  const s = statsOf(m); m.hp = s.hp; m.ki = s.ki;
  return m;
}

export interface Odds { win: number; rounds: number; kos: number; hpLeft: number }
export function fightOdds(o: { party: PartyMember[]; foes: string[]; perfect: number; good: number; seeds?: number; hpMul?: number; atkMul?: number; inventory?: Record<string, number> }): Odds {
  const seeds = o.seeds ?? 20; let wins = 0, rounds = 0, kos = 0, hp = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const allies = o.party.map((m, i) => buildAlly(JSON.parse(JSON.stringify(m)) as PartyMember, i));
    const enemies = o.foes.map((id, i) => buildEnemy(id, i, o.hpMul ?? 1, o.atkMul ?? 1));
    const e = new BattleEngine({ allies, enemies, seed: seed * 7919, rules: { allowFlee: false }, unlockedCombos: ['gohan_krillin', 'goku_vegeta', 'z_trio', 'piccolo_gohan', 'vegeta_krillin'], inventory: o.inventory ?? { medkit: 3, megakit: 3, senzu: 3, kicapsule: 2 } });
    const r = playEngine(e, { seed: seed * 104729, perfect: o.perfect, good: o.good, maxRounds: 80 });
    if (r.outcome === 'victory') { wins++; rounds += r.rounds; kos += r.kos; hp += r.hpLeft; }
  }
  return { win: wins / seeds, rounds: wins ? rounds / wins : 0, kos: wins ? kos / wins : 0, hpLeft: wins ? hp / wins : 0 };
}
