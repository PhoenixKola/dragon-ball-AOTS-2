import { it } from 'vitest';
import { simulate } from '../../src/engine/combat/autoplay';
import { BATTLES } from './balance.test';
import { writeFileSync } from 'node:fs';
import type { HeroId } from '../../src/types';

// CALIBRATE=1 npx vitest run tests/unit/calibrate.test.ts  -> docs/_calibration.json
const on = process.env.CALIBRATE === '1';
interface Q { party: HeroId[]; lv: number; foes: string[]; rules?: Parameters<typeof simulate>[0]['rules']; ssj?: boolean }
function stats(q: Q, H: number, A: number, n: number) { let w = 0, rounds = 0, hp = 0, kos = 0; for (let s = 1; s <= n; s++) { const r = simulate({ party: q.party, level: q.lv, foes: q.foes, seed: s * 7919, rules: q.rules, ssj: q.ssj, hpMul: H, atkMul: A, perfect: 0.35, good: 0.35, inventory: {} }); if (r.outcome === 'victory') { w++; hp += r.hpLeft; kos += r.kos; } rounds += r.rounds; } return { win: w / n, rounds: rounds / n, hp: hp / n, kos: w ? kos / w : 0 }; }
function calibrate(q: Q, tWin: number, tRounds: number, n = 40) {
  let H = 3, A = 3;
  for (let it2 = 0; it2 < 3; it2++) {
    let lo = 0.2, hi = 400; for (let i = 0; i < 11; i++) { const mid = Math.sqrt(lo * hi); if (stats(q, mid, A, n).rounds < tRounds) lo = mid; else hi = mid; } H = Math.sqrt(lo * hi);
    lo = 0.2; hi = 400; for (let i = 0; i < 11; i++) { const mid = Math.sqrt(lo * hi); if (stats(q, H, mid, n).hp > tWin) lo = mid; else hi = mid; } A = Math.sqrt(lo * hi);
  }
  const f = stats(q, H, A, 120); return { hp: Number(H.toFixed(2)), atk: Number(A.toFixed(2)), win: Number(f.win.toFixed(2)), rounds: Number(f.rounds.toFixed(1)), hpLeft: Number(f.hp.toFixed(2)), kos: Number(f.kos.toFixed(2)) };
}
const T: Record<string, [number, number]> = { shore_scouts: [0.8, 3.5], village_dende: [0.78, 4], cui: [0.7, 5], dodoria: [0.6, 6], zarbon: [0.55, 7], guldo: [0.6, 6], recoome_survive: [0.5, 5], recoome_goku: [0.55, 6], duo: [0.52, 7], ginyu: [0.48, 8], nail_vs_frieza: [0.55, 4], frieza1: [0.5, 6], frieza2: [0.48, 6], frieza3: [0.46, 6], frieza4: [0.46, 6], final: [0.4, 10] };
it.runIf(on)('calibrate story battles', () => {
  const out: Record<string, unknown> = {};
  for (const b of BATTLES.filter((x) => !process.env.ONLY || x.id === process.env.ONLY)) { out[b.id] = calibrate(b, T[b.id][0], T[b.id][1]); console.log(b.id, JSON.stringify(out[b.id])); }
  writeFileSync('docs/_calibration.json', JSON.stringify(out, null, 1));
}, 1800000);
it.runIf(on)('calibrate soldier encounters by party level', () => {
  const out: Record<string, unknown> = {};
  for (const lv of [5, 8, 11, 14, 17, 20, 23]) {
    const party: HeroId[] = lv < 10 ? ['gohan', 'krillin'] : lv < 16 ? ['gohan', 'krillin', 'vegeta'] : ['goku', 'vegeta', 'gohan'];
    out['L' + lv] = calibrate({ party, lv, foes: lv < 10 ? ['scout', 'scout'] : ['guard', 'guard', 'scout'] }, 0.78, 3.6);
    console.log('soldiers L' + lv, JSON.stringify(out['L' + lv]));
  }
  writeFileSync('docs/_calibration_soldiers.json', JSON.stringify(out, null, 1));
}, 1800000);
