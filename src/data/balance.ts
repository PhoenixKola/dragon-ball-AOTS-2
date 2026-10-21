// Enemy scaling tables produced by tests/unit/calibrate.test.ts (see docs/BALANCE_TABLE.md).
export interface Power { hp: number; atk: number }
/** Calibrated multipliers so a generic soldier encounter stays snappy (~3-4 rounds) but dangerous at the party's average level. */
export const SOLDIER_TABLE: [number, Power][] = [
  [5, { hp: 1.26, atk: 2.5 }], [8, { hp: 1.53, atk: 2.5 }], [11, { hp: 2.05, atk: 3.6 }], [14, { hp: 2.36, atk: 5 }], [17, { hp: 2.88, atk: 6.6 }], [20, { hp: 3.19, atk: 8 }], [23, { hp: 3.52, atk: 9 }],
];
export function soldierPower(level: number): Power {
  const t = SOLDIER_TABLE;
  if (level <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (level <= t[i][0]) { const [l0, a] = t[i - 1], [l1, b] = t[i]; const u = (level - l0) / (l1 - l0); return { hp: a.hp + (b.hp - a.hp) * u, atk: a.atk + (b.atk - a.atk) * u }; }
  return t[t.length - 1][1];
}
