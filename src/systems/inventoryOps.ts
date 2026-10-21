import type { HeroId } from '../types';
import { HEROES, ITEMS } from '../data/heroes';
import { SHOPS } from '../data/shops';
import { addItem, memberOf, type GameState } from './gameState';
import { statsOf } from './party';

/** Pure inventory rules (shop, field items, capsules) shared by the menus and the tests. Each returns the message to show. */
export interface OpResult { ok: boolean; msg: string; sfx?: 'pickup' | 'heal' | 'error' }
const fail = (msg: string): OpResult => ({ ok: false, msg, sfx: 'error' });

export function useItemOutside(s: GameState, itemId: string, heroId: HeroId): OpResult {
  const it = ITEMS[itemId]; const m = memberOf(s, heroId);
  if (!it || !m || (s.inventory[itemId] ?? 0) <= 0 || it.capsule) return fail('Cannot use that.');
  const st = statsOf(m);
  // refuse BEFORE consuming anything: a wasted item is never the player's fault
  if (it.full) { if (m.hp >= st.hp && m.ki >= st.ki) return fail(`${HEROES[heroId].name} is already at full strength.`); }
  else {
    if (it.hp && m.hp >= st.hp) return fail('HP is already full.');
    if (it.ki && m.ki >= st.ki) return fail('Ki is already full.');
  }
  if (it.full) { m.hp = st.hp; m.ki = st.ki; }
  if (it.hp) m.hp = Math.min(st.hp, m.hp + it.hp);
  if (it.ki) m.ki = Math.min(st.ki, m.ki + it.ki);
  s.inventory[itemId]--; if (!s.inventory[itemId]) delete s.inventory[itemId];
  return { ok: true, msg: `${HEROES[heroId].name} used ${it.name}.`, sfx: 'heal' };
}

export function buyItem(s: GameState, shopId: string, itemId: string): OpResult {
  const shop = SHOPS[shopId]; const it = ITEMS[itemId];
  if (!shop?.stock.includes(itemId) || !it?.price) return fail('Not for sale.');
  if (s.zeni < it.price) return fail('Not enough zeni.');
  if ((s.inventory[itemId] ?? 0) >= 99) return fail('You cannot carry more.');
  s.zeni -= it.price; addItem(s, itemId, 1);
  return { ok: true, msg: `Bought ${it.name}.`, sfx: 'pickup' };
}

export function equipCapsule(s: GameState, heroId: HeroId, capsuleId: string, slot: number): OpResult {
  const m = memberOf(s, heroId);
  if (!m || !ITEMS[capsuleId]?.capsule || slot < 0 || slot > 1) return fail('Invalid.');
  if ((s.inventory[capsuleId] ?? 0) <= 0) return fail('You have none.');
  const prev = m.capsules[slot]; if (prev) addItem(s, prev, 1);
  m.capsules[slot] = capsuleId; s.inventory[capsuleId]--; if (!s.inventory[capsuleId]) delete s.inventory[capsuleId];
  const st = statsOf(m); m.hp = Math.min(m.hp, st.hp); m.ki = Math.min(m.ki, st.ki);
  return { ok: true, msg: 'Equipped.' };
}

export function unequipCapsule(s: GameState, heroId: HeroId, slot: number): OpResult {
  const m = memberOf(s, heroId); const c = m?.capsules[slot];
  if (!m || !c) return fail('Nothing to remove.');
  addItem(s, c, 1); m.capsules.splice(slot, 1);
  const st = statsOf(m); m.hp = Math.min(m.hp, st.hp); m.ki = Math.min(m.ki, st.ki);   // lower maxima never leave HP/Ki above them
  return { ok: true, msg: 'Removed.' };
}
