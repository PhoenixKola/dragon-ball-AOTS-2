import { ITEMS } from '../../src/data/heroes';
import { SHOPS } from '../../src/data/shops';
import { buyItem, equipCapsule, useItemOutside } from '../../src/systems/inventoryOps';
import type { GameState } from '../../src/systems/gameState';
import { spendPoint, statsOf } from '../../src/systems/party';
import type { Stats } from '../../src/types';

/**
 * What a sensible (not perfect) player does between fights, built only from the game's own rules (inventoryOps, party):
 * spends the training points they are given, equips the capsules they own, shops at the Aojan trader when passing through,
 * and drinks a Med Kit / Ki Capsule when somebody is low. No item or level appears from nowhere.
 */
const POINT_CYCLE: (keyof Stats)[] = ['hp', 'atk', 'hp', 'def'];
const CAPSULE_PRIORITY = ['powercap', 'vitalcap', 'guardcap', 'kicap', 'speedcap', 'ragecap'];

export interface PolicyLog { spent: number; equipped: string[]; bought: Record<string, number>; usedKits: number; usedKi: number }
export const newPolicyLog = (): PolicyLog => ({ spent: 0, equipped: [], bought: {}, usedKits: 0, usedKi: 0 });

export function spendTrainingPoints(s: GameState, log: PolicyLog) {
  for (const m of s.roster) { let i = m.alloc.hp + m.alloc.atk + m.alloc.def; while (m.unspent > 0) { if (!spendPoint(m, POINT_CYCLE[i++ % POINT_CYCLE.length])) break; log.spent++; } }
}

export function equipOwnedCapsules(s: GameState, log: PolicyLog) {
  for (let slot = 0; slot < 2; slot++) for (const id of s.party) {
    const m = s.roster.find((r) => r.id === id); if (!m || m.capsules[slot]) continue;
    const cap = CAPSULE_PRIORITY.find((c) => (s.inventory[c] ?? 0) > 0); if (!cap) return;
    if (equipCapsule(s, id, cap, slot).ok) log.equipped.push(`${id}:${cap}`);
  }
}

/** The village trader: Med Kits to 5, Ki Capsules to 2, then capsules (never below a 120 Zeni cushion). */
export function shopVisit(s: GameState, log: PolicyLog, shopId = 'village') {
  const stock = SHOPS[shopId].stock;
  const buy = (id: string) => { if (!stock.includes(id)) return false; const r = buyItem(s, shopId, id); if (r.ok) log.bought[id] = (log.bought[id] ?? 0) + 1; return r.ok; };
  while ((s.inventory.medkit ?? 0) < 5 && s.zeni >= 60 && buy('medkit'));
  while ((s.inventory.kicapsule ?? 0) < 2 && s.zeni >= 70 && buy('kicapsule'));
  const wornOrOwned = () => s.roster.reduce((a, m) => a + m.capsules.length, 0) + Object.entries(s.inventory).reduce((a, [k, n]) => a + (ITEMS[k]?.capsule ? n : 0), 0);
  for (const cap of CAPSULE_PRIORITY) while (wornOrOwned() < s.party.length * 2 && s.zeni >= (ITEMS[cap].price ?? 1e9) + 120 && buy(cap));
  equipOwnedCapsules(s, log);
}

/** Between fights: top up anyone under half HP with a Med Kit (Mega first when a lot is missing) and anyone nearly out of Ki with a Ki Capsule. */
export function topUp(s: GameState, log: PolicyLog) {
  for (const m of s.roster) {
    const st = statsOf(m);
    for (let i = 0; i < 4 && m.hp < st.hp * 0.5; i++) {
      const item = (s.inventory.megakit ?? 0) > 0 && st.hp - m.hp > 300 ? 'megakit' : (s.inventory.medkit ?? 0) > 0 ? 'medkit' : (s.inventory.megakit ?? 0) > 0 ? 'megakit' : null;
      if (!item || !useItemOutside(s, item, m.id).ok) break; log.usedKits++;
    }
    if (m.ki < st.ki * 0.25 && (s.inventory.kicapsule ?? 0) > 0 && useItemOutside(s, 'kicapsule', m.id).ok) log.usedKi++;
  }
}

/** No altar nearby and a boss ahead: spend kits until everybody has at least 85% HP and 60% Ki (as far as the bag allows). */
export function topUpBeforeBoss(s: GameState, log: PolicyLog) {
  for (const m of s.roster) {
    const st = statsOf(m);
    for (let i = 0; i < 6 && m.hp < st.hp * 0.85; i++) {
      const item = (s.inventory.megakit ?? 0) > 0 && st.hp - m.hp > 300 ? 'megakit' : (s.inventory.medkit ?? 0) > 0 ? 'medkit' : (s.inventory.megakit ?? 0) > 0 ? 'megakit' : null;
      if (!item || !useItemOutside(s, item, m.id).ok) break; log.usedKits++;
    }
    if (m.ki < st.ki * 0.6 && (s.inventory.kicapsule ?? 0) > 0 && useItemOutside(s, 'kicapsule', m.id).ok) log.usedKi++;
  }
}

export function upkeep(s: GameState, log: PolicyLog) { spendTrainingPoints(s, log); equipOwnedCapsules(s, log); topUp(s, log); }
