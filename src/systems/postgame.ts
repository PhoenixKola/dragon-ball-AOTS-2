import type { HeroId } from '../types';
import { HEROES } from '../data/heroes';
import { avgLevel, condMet, joinHero, memberOf, setFlags, type GameState } from './gameState';
import { statsOf, upcomingSkills, MAX_LEVEL } from './party';

/**
 * Postgame (after the credits): Capsule Corp's Namek Simulation.
 * Narrative device: Planet Namek really is gone (both endings stay intact). Bulma rebuilt it from the party's memories and Dende's ship records
 * as a training simulation with a real, separate threat: a cold signature she did not program, which turns out to be Cooler.
 * Everything here is pure (no DOM / Phaser) so the session, the journal and the tests share it.
 */

/** Where the simulation starts: Aojan Village next to the altar (save + heal), the trader and the Capsule Comm. */
export const HUB = { map: 'village', x: 21.5, y: 15 } as const;
/** Recommended average level for Cooler's ruins. A warning is shown below this; nothing is blocked. */
export const COOLER_LEVEL = 24;
/** Heroes the simulation brings back (Krillin and Vegeta left the roster in the story; the simulation is not canon). Nail lives on inside Piccolo. */
export const POSTGAME_ROSTER: readonly HeroId[] = ['goku', 'gohan', 'piccolo', 'vegeta', 'krillin', 'dende'];
const DEFAULT_PARTY: readonly HeroId[] = ['goku', 'gohan', 'piccolo'];

export const isPostgame = (s: GameState) => !!s.flags.postgame_unlocked;

export interface PostgameSetup { newlyUnlocked: boolean; restored: HeroId[] }

/**
 * Idempotent: unlocks the postgame, brings the simulation roster back, keeps every flag, ball, level, equipment, learned and equipped skill,
 * Super Saiyan and fusion state, heals, and puts the player at the hub. Calling it twice changes nothing the second time except the position.
 */
export function preparePostgame(s: GameState): PostgameSetup {
  const newlyUnlocked = !s.flags.postgame_unlocked;
  setFlags(s, 'postgame_unlocked');
  const restored: HeroId[] = [];
  for (const id of POSTGAME_ROSTER) {
    if (memberOf(s, id)) continue;
    joinHero(s, id, 0, id === 'piccolo' && !!s.flags.piccolo_fused);
    restored.push(id);
  }
  const goku = memberOf(s, 'goku'); if (goku && s.flags.ssj) goku.ssj = true;
  const piccolo = memberOf(s, 'piccolo'); if (piccolo && s.flags.piccolo_fused) piccolo.fused = true;
  const valid = s.party.length >= 1 && s.party.length <= 3 && s.party.every((id) => !!memberOf(s, id));
  if (!valid) s.party = DEFAULT_PARTY.filter((id) => !!memberOf(s, id)).slice(0, 3);
  if (!s.party.length) s.party = [s.roster[0].id];
  for (const m of s.roster) { const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; }
  s.mapId = HUB.map; s.x = HUB.x; s.y = HUB.y; s.facing = 'down';
  if (!s.postgame) s.postgame = { trainingWins: 0, coolerClears: 0, coolerBestRounds: 0 };
  return { newlyUnlocked, restored };
}

/** Postgame bookkeeping after a won fight. Called once per win by the session. */
export function recordPostgameWin(s: GameState, spec: { tag?: string; noRewards?: boolean }, rounds: number) {
  if (!isPostgame(s)) return;
  if (!s.postgame) s.postgame = { trainingWins: 0, coolerClears: 0, coolerBestRounds: 0 };
  s.postgame.trainingWins++;
  if (spec.tag === 'cooler') {
    s.postgame.coolerClears++;
    s.postgame.coolerBestRounds = s.postgame.coolerBestRounds ? Math.min(s.postgame.coolerBestRounds, rounds) : rounds;
  }
}

export interface TrailStep { text: string; done: boolean }
/** The trail to Cooler, as the journal shows it. */
export function coolerTrail(s: GameState): TrailStep[] {
  return [
    { text: 'Ask Bulma at the Capsule Comm in Aojan Village about the unknown signal', done: !!s.flags.cooler_clue },
    { text: 'Inspect the frozen rift at the east end of the Namek Highlands', done: !!s.flags.cooler_trail_open },
    { text: 'Cross the Frozen Ruins and face Cooler', done: !!s.flags.cooler_defeated },
  ];
}
export const coolerRiftOpen = (s: GameState) => condMet(s, { flag: 'cooler_trail_open' });

export function partyAverageLevel(s: GameState): number {
  const ms = s.party.map((id) => memberOf(s, id)).filter((m): m is NonNullable<typeof m> => !!m);
  return ms.length ? Math.round(ms.reduce((a, m) => a + m.level, 0) / ms.length) : avgLevel(s);
}
/** Text for the low-level warning (null when the party is ready). The player may still go. */
export function coolerWarning(s: GameState): string | null {
  const lv = partyAverageLevel(s);
  return lv >= COOLER_LEVEL ? null : `Your party averages Lv ${lv}. Cooler's ruins are tuned for Lv ${COOLER_LEVEL}+ (max ${MAX_LEVEL}). Train in the simulation first, or go in knowing it will hurt.`;
}

/** What each hero is training toward: the next skill and the level it arrives at. */
export function trainingTargets(s: GameState) {
  return s.roster.map((m) => {
    const next = upcomingSkills(m)[0];
    return { id: m.id, name: HEROES[m.id].name, level: m.level, maxed: m.level >= MAX_LEVEL, next: next ? { id: next.id, name: next.name, level: next.unlockLevel } : null };
  });
}
