import type { HeroId } from '../types';
import { HEROES, ITEMS } from '../data/heroes';
import { addItem, avgLevel, joinHero, memberOf, ownedBalls, setFlags, type GameState } from './gameState';
import { statsOf } from './party';

/**
 * Porunga's three postgame wishes (optional, after the credits). Each is granted exactly once, in any order; committing is atomic
 * (nothing is written unless the whole wish applies) and idempotent (the `wish_*` flag is the single source of truth).
 * Pure: no DOM / Phaser, shared by the Session, the journal and the tests.
 */
export type WishId = 'trunks' | 'potential' | 'relic';
export const WISH_IDS: readonly WishId[] = ['trunks', 'potential', 'relic'];
export const wishFlag = (id: WishId) => `wish_${id}`;

export interface WishDef { id: WishId; title: string; short: string; detail: string; icon: string }
export const WISHES: Record<WishId, WishDef> = {
  trunks: {
    id: 'trunks', title: 'Unlock a Secret Ally', short: 'Future Trunks joins you for good.',
    detail: 'Future Trunks joins the roster (a non-canon what-if). He fights with a sword and Ki, equips four of his 12 skills, and can go Super Saiyan in battle. With a full party he waits on the bench until you swap him in.',
    icon: 'assets/reviewed/icons/wish/trunks.png',
  },
  potential: {
    id: 'potential', title: 'Awaken Hidden Potential', short: 'A permanent boost for the whole roster.',
    detail: 'Every fighter you have, now and anyone who joins later (including Trunks), gains a permanent +10% HP and Ki, +8% ATK and DEF, +5% SPD. It never stacks.',
    icon: 'assets/reviewed/icons/wish/potential.png',
  },
  relic: {
    id: 'relic', title: 'Claim a Dragon Relic', short: 'The Namekian Dragon Crest.',
    detail: 'You receive one legendary capsule, the Namekian Dragon Crest: +9 ATK, +9 DEF, +90 HP, +30 Ki and Rage fills 10% faster. Equip it from the Capsules tab. Only one exists.',
    icon: 'assets/reviewed/icons/wish/relic.png',
  },
};

export const isGranted = (s: GameState, id: WishId) => s.flags[wishFlag(id)] === true;
export const grantedWishes = (s: GameState) => WISH_IDS.filter((id) => isGranted(s, id));
export const pendingWishes = (s: GameState) => WISH_IDS.filter((id) => !isGranted(s, id));
export const allWishesGranted = (s: GameState) => pendingWishes(s).length === 0;

export type SummonCheck = { ok: true } | { ok: false; reason: 'locked' | 'balls' | 'done'; text: string; missing?: number[] };
/** Summoning needs the postgame (credits seen) and all seven distinct Dragon Balls (the ball1..ball7 flags). */
export function canSummon(s: GameState): SummonCheck {
  if (!s.flags.postgame_unlocked) return { ok: false, reason: 'locked', text: 'The Dragon Balls are still dormant. Finish the story first.' };
  const owned = ownedBalls(s);
  if (owned.length < 7) return { ok: false, reason: 'balls', text: `Porunga can only be summoned with all seven Dragon Balls (you have ${owned.length}).`, missing: [1, 2, 3, 4, 5, 6, 7].filter((n) => !owned.includes(n)) };
  if (allWishesGranted(s)) return { ok: false, reason: 'done', text: 'All three wishes have been granted. Porunga sleeps.' };
  return { ok: true };
}

const relicsOwned = (s: GameState) => (s.inventory.dragoncrest ?? 0) + s.roster.reduce((n, m) => n + m.capsules.filter((c) => c === 'dragoncrest').length, 0);

export interface WishResult { ok: boolean; message: string }
/** Commits one wish. Returns ok:false (and changes nothing) when it was already granted or cannot apply. */
export function grantWish(s: GameState, id: WishId): WishResult {
  if (!WISHES[id]) return { ok: false, message: 'Unknown wish.' };
  if (isGranted(s, id)) return { ok: false, message: 'That wish was already granted.' };
  const check = canSummon(s);
  if (!check.ok && check.reason !== 'done') return { ok: false, message: check.text };
  if (id === 'trunks') {
    if (memberOf(s, 'trunks')) { setFlags(s, wishFlag(id)); return { ok: true, message: 'Future Trunks is already with you.' }; }   // repair: flag was missing but he exists
    const m = joinHero(s, 'trunks' as HeroId, Math.max(22, avgLevel(s)));
    const st = statsOf(m); m.hp = st.hp; m.ki = st.ki;
    setFlags(s, wishFlag(id));
    return { ok: true, message: s.party.includes('trunks') ? 'Future Trunks joins your party!' : 'Future Trunks joins the roster (your party is full: swap him in from the Party tab).' };
  }
  if (id === 'potential') {
    for (const m of s.roster) { m.potential = true; const st = statsOf(m); m.hp = Math.min(st.hp, m.hp); m.ki = Math.min(st.ki, m.ki); }
    setFlags(s, wishFlag(id));
    return { ok: true, message: 'Hidden potential awakens in everyone.' };
  }
  if (relicsOwned(s) === 0) { addItem(s, 'dragoncrest', 1); }
  setFlags(s, wishFlag(id));
  return { ok: true, message: `${ITEMS.dragoncrest.name} received.` };
}

/** Roster members a new recruit should receive the Hidden Potential bonus for (used by joinHero). */
export const potentialActive = (s: GameState) => isGranted(s, 'potential');
export const trunksName = HEROES.trunks.name;
