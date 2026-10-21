import type { Fighter, GuardGrade, StatusKind } from '../../types';

export const GUARD_MULT: Record<GuardGrade, number> = { perfect: 0.15, good: 0.5, none: 1 };
export const DEFEND_MULT = 0.55;
export const CRIT_CHANCE = 0.07;
export const CRIT_MULT = 1.5;
export const BLIND_MISS = 0.5;
export const RAGE_FULL = 100;
export const COMBO_RAGE_COST = 50;
export const CHARGE_INTERRUPT_FRAC = 0.16;

/** Super Saiyan Trunks (battle-long): ATK/DEF/SPD multipliers; the form drains SSJ_FORM.kiUpkeep of max Ki at the start of every own turn and ends when Ki runs out. */
export const SSJ_FORM = { atk: 1.3, def: 1.15, spd: 1.2, kiUpkeep: 0.05 } as const;
export const hasStatus = (f: Fighter, k: StatusKind) => f.statuses.some((s) => s.kind === k);
export const statusPower = (f: Fighter, k: StatusKind) => f.statuses.find((s) => s.kind === k)?.power ?? 0;

export function effAtk(f: Fighter): number {
  let a = f.stats.atk;
  if (hasStatus(f, 'atkUp')) a *= 1 + statusPower(f, 'atkUp');
  if (hasStatus(f, 'atkDown')) a *= 1 - statusPower(f, 'atkDown');
  if (hasStatus(f, 'kaioken')) a *= 1 + statusPower(f, 'kaioken');
  if (hasStatus(f, 'sparking')) a *= 1.25;
  if (hasStatus(f, 'ssjform')) a *= SSJ_FORM.atk;
  return a;
}
export function effDef(f: Fighter): number {
  let d = f.stats.def;
  if (hasStatus(f, 'defUp')) d *= 1 + statusPower(f, 'defUp');
  if (hasStatus(f, 'defDown')) d *= 1 - statusPower(f, 'defDown');
  if (hasStatus(f, 'ssjform')) d *= SSJ_FORM.def;
  return d;
}
export function effSpd(f: Fighter): number {
  let s = f.stats.spd;
  if (hasStatus(f, 'spdUp')) s *= 1.3;
  if (hasStatus(f, 'kaioken')) s *= 1.25;
  if (hasStatus(f, 'ssjform')) s *= SSJ_FORM.spd;
  return s;
}

/** Defence mitigation curve: DEF 14 -> 0.83, DEF 35 -> 0.67, DEF 60 -> 0.54. */
export function mitigation(def: number): number { return 1 - def / (def + 70); }

export function kiCost(f: Fighter, base: number): number {
  return Math.max(0, Math.round(hasStatus(f, 'sparking') ? base * 0.5 : base));
}

export const xpForLevel = (lv: number) => Math.round(18 * lv + 3.2 * lv * lv);
export const EXP_SCALE = 3.4;
