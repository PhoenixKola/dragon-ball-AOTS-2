import type { HeroId } from '../types';
import { newMember, type PartyMember } from './party';
import { MAPS, START_MAP } from '../data/maps';
import type { Cond } from '../engine/world/mapTypes';

export type Facing = 'down' | 'up' | 'left' | 'right';
export const SAVE_VERSION = 3;

export interface GameState {
  version: number;
  mapId: string;
  x: number; y: number; facing: Facing;
  flags: Record<string, boolean>;
  chapter: number;
  party: HeroId[];
  roster: PartyMember[];
  inventory: Record<string, number>;
  zeni: number;
  balls: number;
  combos: string[];
  playMs: number;
  stats: { battles: number; wins: number; steps: number; defeats: number };
  savedAt: number;
  /** Postgame bookkeeping (optional: absent in every pre-postgame save). */
  postgame?: PostgameStats;
}
export interface PostgameStats { trainingWins: number; coolerClears: number; coolerBestRounds: number }

export function newGameState(): GameState {
  return {
    version: SAVE_VERSION, mapId: START_MAP.map, x: START_MAP.x, y: START_MAP.y, facing: 'down', flags: Object.create(null) as Record<string, boolean>, chapter: 0,
    party: ['gohan', 'krillin'], roster: [newMember('gohan', 5), newMember('krillin', 5)],
    inventory: { medkit: 3, kicapsule: 2 }, zeni: 100, balls: 0, combos: ['gohan_krillin'], playMs: 0,
    stats: { battles: 0, wins: 0, steps: 0, defeats: 0 }, savedAt: Date.now(),
  };
}

const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
export function condMet(s: GameState, c?: Cond): boolean {
  if (!c) return true;
  return arr(c.flag).every((f) => s.flags[f]) && arr(c.not).every((f) => !s.flags[f]) && Object.entries(c.has ?? {}).every(([k, n]) => (s.inventory[k] ?? 0) >= n);
}
export const memberOf = (s: GameState, id: HeroId) => s.roster.find((m) => m.id === id);
export const avgLevel = (s: GameState) => Math.max(5, Math.round(s.roster.reduce((a, m) => a + m.level, 0) / Math.max(1, s.roster.length)));

export function addItem(s: GameState, id: string, n: number) { s.inventory[id] = Math.min(99, (s.inventory[id] ?? 0) + n); }

export function joinHero(s: GameState, id: HeroId, level = 0, fused = false) {
  let m = memberOf(s, id);
  if (!m) { m = newMember(id, level > 0 ? level : avgLevel(s)); s.roster.push(m); }
  if (fused) m.fused = true;
  if (s.flags.wish_potential) m.potential = true;   // Porunga's Hidden Potential also covers anyone who joins later
  if (!s.party.includes(id)) { if (s.party.length < 3) s.party.push(id); }
  // fully rested on joining
  return m;
}
export function leaveHero(s: GameState, id: HeroId) {
  s.roster = s.roster.filter((m) => m.id !== id);
  s.party = s.party.filter((p) => p !== id);
  // a lineup never shrinks just because someone left: fill free seats from the rest of the roster
  for (const m of s.roster) if (s.party.length < 3 && !s.party.includes(m.id)) s.party.push(m.id);
  if (!s.party.length && s.roster.length) s.party = [s.roster[0].id];
}
/** Story-set lineup: unknown or duplicate heroes are ignored, at most 3. Returns false if nothing valid was given. */
export function setStoryParty(s: GameState, ids: HeroId[]): boolean {
  const ok = [...new Set(ids)].filter((id) => memberOf(s, id)).slice(0, 3);
  if (!ok.length) return false;
  s.party = ok; return true;
}

export const BALL_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
export const BALL_FLAGS = BALL_IDS.map((n) => `ball${n}`);
export const BALL_HINT: Record<number, string> = { 1: 'Dende, Aojan Village', 2: 'Crystal Grotto', 3: 'Guru’s Sanctuary', 4: 'Namek Highlands, past the Ginyu Force', 5: 'Frieza’s Ship hold', 6: 'Frieza Landing Zone, after Piccolo joins', 7: 'Namek’s Last Ground' };
export const STAR_NAMES = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
/** Owned Dragon Balls are exactly the flags ball1..ball7; `GameState.balls` is only a cached count of them. */
export const ownedBalls = (s: GameState): number[] => BALL_IDS.filter((n) => s.flags[`ball${n}`] === true);
export function syncBalls(s: GameState): number { s.balls = ownedBalls(s).length; return s.balls; }
/** Returns true only if this star was not owned yet; replays never change the count. */
export function collectBall(s: GameState, n: number): boolean {
  if (!Number.isInteger(n) || n < 1 || n > 7) return false;
  const isNew = s.flags[`ball${n}`] !== true;
  s.flags[`ball${n}`] = true; syncBalls(s);
  return isNew;
}

export function setFlags(s: GameState, f: string | string[]) { for (const k of arr(f)) s.flags[k] = true; syncBalls(s); }
export function clearFlags(s: GameState, f: string | string[]) { for (const k of arr(f)) delete s.flags[k]; syncBalls(s); }

export function mapOf(s: GameState) { return MAPS[s.mapId]; }
