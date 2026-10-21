import type { Fighter } from '../../types';

/**
 * Rage tuning (v5). Every number a player can read about Rage lives here so the engine, the help page and the tests agree.
 *  - dealing damage: the skill's own rageGain (split per hit) x DEALT_MULT, +CRIT_BONUS on a critical hit
 *  - taking damage:  (TAKEN_BASE + TAKEN_SCALE x the share of max HP lost) per hit (halved per extra hit), plus a clutch bonus below CLUTCH_BELOW of max HP
 *  - Active Guard:   GUARD_GOOD / GUARD_PERFECT on the guarded hit
 *  - Defend:         DEFEND_GAIN, but only on the first Defend in a row (spamming Defend gives nothing more)
 * Per-hero identity multipliers are deliberately small: Gohan resilient, Vegeta aggressive, Goku offensive, Krillin clever (crits), Piccolo tactical (guards).
 */
export const RAGE = {
  DEALT_MULT: 1.95,
  CRIT_BONUS: 4,
  TAKEN_BASE: 5,
  TAKEN_SCALE: 20,
  CLUTCH_BELOW: 0.35,
  CLUTCH_BONUS: 3,
  GUARD_GOOD: 7,
  GUARD_PERFECT: 16,
  DEFEND_GAIN: 3,
  /** hits on ordinary soldiers give this share of the normal Rage, so quick random fights rarely reach 100 while bosses do */
  MINION_FACTOR: 0.55,
  NEAR_READY: 75,
  /** a single action never adds more than this to one fighter, so one big hit cannot fill the bar by itself */
  PER_ACTION_CAP: 60,
} as const;

export interface RageIdentity { dealt: number; taken: number; guard: number; crit: number }
const NEUTRAL: RageIdentity = { dealt: 1, taken: 1, guard: 1, crit: 1 };
export const RAGE_IDENTITY: Record<string, Partial<RageIdentity>> = {
  goku: { dealt: 1.1 },
  gohan: { taken: 1.3 },
  krillin: { crit: 2 },
  vegeta: { dealt: 1.15 },
  piccolo: { guard: 1.3 },
};
export const identityOf = (f: Pick<Fighter, 'defId'>): RageIdentity => ({ ...NEUTRAL, ...(RAGE_IDENTITY[f.defId] ?? {}) });

/** Rage the attacker gains for one landed hit of `perHit` base rageGain. */
export function rageDealt(attacker: Pick<Fighter, 'defId'>, perHit: number, crit: boolean, targetIsBoss = true): number {
  const id = identityOf(attacker);
  return (perHit * RAGE.DEALT_MULT * id.dealt + (crit ? RAGE.CRIT_BONUS * id.crit : 0)) * (targetIsBoss ? 1 : RAGE.MINION_FACTOR);
}

/** Rage the target gains for one damaging hit (`hits` = number of hits in the action). */
export function rageTaken(target: Pick<Fighter, 'defId' | 'hp' | 'stats'>, dmg: number, hits: number, guard: 'perfect' | 'good' | 'none'): number {
  const id = identityOf(target);
  let r = ((RAGE.TAKEN_BASE + RAGE.TAKEN_SCALE * (dmg / target.stats.hp)) / Math.max(1, hits * 0.5)) * id.taken;
  r += guard === 'perfect' ? RAGE.GUARD_PERFECT * id.guard : guard === 'good' ? RAGE.GUARD_GOOD * id.guard : 0;
  if (target.hp > 0 && target.hp / target.stats.hp < RAGE.CLUTCH_BELOW) r += RAGE.CLUTCH_BONUS;
  return r;
}
