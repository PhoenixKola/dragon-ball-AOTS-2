import { BattleEngine } from '../../src/engine/combat/engine';
import { choose, playEngine } from '../../src/engine/combat/autoplay';
import { buildAlly, buildEnemy, newMember } from '../../src/systems/party';
import { SKILLS } from '../../src/data/skills';
import type { Command, HeroId } from '../../src/types';

export interface RageProfile {
  battles: number;
  /** share of battles in which at least one ally reached 100 Rage */
  reachedFull: number;
  /** share of battles in which an ally actually spent Rage (Rage Art or Sparking) */
  spent: number;
  /** mean round at which the first ally reached 100 (battles that got there) */
  firstFullRound: number;
  /** mean highest Rage any ally showed */
  peak: number;
  rounds: number;
  wins: number;
}

/**
 * Plays the same fight with many seeds with the simulator's player and records how fast Rage fills.
 * `perfect`/`good` = the Active Guard skill model (attentive 0.35/0.35, average 0.15/0.30, never 0/0).
 */
export function rageProfile(o: { party: HeroId[]; level: number; foes: string[]; perfect: number; good: number; seeds?: number; sparking?: boolean; hpMul?: number; atkMul?: number }): RageProfile {
  const seeds = o.seeds ?? 24;
  let reached = 0, spent = 0, firstSum = 0, firstN = 0, peakSum = 0, roundSum = 0, wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const allies = o.party.map((id, i) => buildAlly(newMember(id, o.level), i));
    const enemies = o.foes.map((id, i) => buildEnemy(id, i, o.hpMul ?? 1, o.atkMul ?? 1));
    const e = new BattleEngine({ allies, enemies, seed: seed * 7919, rules: { allowFlee: false }, unlockedCombos: ['gohan_krillin', 'goku_vegeta', 'z_trio', 'piccolo_gohan', 'vegeta_krillin'], inventory: { medkit: 3, kicapsule: 2, senzu: 1 } });
    let peak = 0, first = -1, didSpend = false;
    const chooser = (eng: BattleEngine, a: (typeof allies)[number]): Command => {
      for (const f of eng.allies()) { peak = Math.max(peak, f.rage); if (f.rage >= 100 && first < 0) first = eng.round; }
      const c = choose(eng, a);
      if (c.kind === 'skill' && SKILLS[c.skill]?.rageArt) didSpend = true;
      if (o.sparking && a.rage >= 100 && !didSpend) { didSpend = true; return { kind: 'sparking' }; }
      return c;
    };
    const r = playEngine(e, { seed: seed * 104729, perfect: o.perfect, good: o.good, chooser });
    for (const f of e.allies()) peak = Math.max(peak, f.rage);
    if (peak >= 100) reached++;
    if (didSpend) spent++;
    if (first >= 0) { firstSum += first; firstN++; }
    peakSum += peak; roundSum += r.rounds; if (r.outcome === 'victory') wins++;
  }
  return { battles: seeds, reachedFull: reached / seeds, spent: spent / seeds, firstFullRound: firstN ? firstSum / firstN : 0, peak: peakSum / seeds, rounds: roundSum / seeds, wins: wins / seeds };
}
