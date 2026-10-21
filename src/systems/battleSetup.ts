import type { Fighter, HeroId } from '../types';
import type { BattleSpec } from '../engine/world/mapTypes';
import type { BattleEngine } from '../engine/combat/engine';
import { ENEMIES } from '../data/enemies';
import { soldierPower } from '../data/balance';
import { avgLevel, memberOf, type GameState } from './gameState';
import { buildAlly, buildEnemy, newMember, statsOf, type PartyMember } from './party';

/** Enemy damage multiplier on Easier difficulty. */
export const EASY_ENEMY_ATK = 0.7;

/**
 * The battle rules that live outside the combat engine, shared by the running game (Session) and the tests so a simulated
 * playthrough follows exactly the same lineup, scaling, write-back and retry rules as a real one.
 */
export function partyFor(s: GameState, spec: BattleSpec): { members: PartyMember[]; guests: Set<HeroId> } {
  const ids = spec.party ?? s.party; const guests = new Set<HeroId>(); const members: PartyMember[] = [];
  for (const id of ids.slice(0, 3)) {
    let m = memberOf(s, id);
    if (!m) { const g = spec.guests?.find((x) => x.id === id); m = newMember(id, g?.level ?? avgLevel(s)); guests.add(id); }
    members.push(m);
  }
  return { members, guests };
}

export function buildBattleSides(s: GameState, spec: BattleSpec, easy: boolean) {
  const { members, guests } = partyFor(s, spec);
  const allies: Fighter[] = members.map((m, i) => buildAlly(guests.has(m.id) ? { ...m, hp: statsOf(m).hp, ki: statsOf(m).ki } : m, i));
  const soft = spec.foes.every((f) => !ENEMIES[f].boss) ? soldierPower(avgLevel(s)) : { hp: 1, atk: 1 };
  const enemies = spec.foes.map((id, i) => buildEnemy(id, i, spec.hp ?? soft.hp, (spec.atk ?? soft.atk) * (easy ? EASY_ENEMY_ATK : 1)));
  const hasBoss = enemies.some((e) => e.boss);
  return { allies, enemies, guests, hasBoss, rules: { allowFlee: spec.allowFlee ?? !hasBoss, scriptedEnd: spec.scriptedEnd, surviveRounds: spec.surviveRounds } };
}

/** Surviving HP/Ki go back to the real roster; a fallen hero stands up again with 20% HP; the engine's inventory replaces the bag. */
export function writeBackBattle(s: GameState, engine: BattleEngine, guests: Set<HeroId>) {
  for (const f of engine.fighters.filter((x) => x.side === 'ally')) {
    const m = memberOf(s, f.defId as HeroId); if (!m || guests.has(m.id)) continue;
    const st = statsOf(m); m.hp = f.alive ? Math.max(1, Math.min(st.hp, f.hp)) : Math.max(1, Math.round(st.hp * 0.2)); m.ki = Math.max(0, Math.min(st.ki, f.ki));
  }
  s.inventory = { ...engine.inventory }; for (const k of Object.keys(s.inventory)) if (!s.inventory[k]) delete s.inventory[k];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export type BattleSnapshot = { roster: PartyMember[]; inventory: Record<string, number> };
export const snapshotBattle = (s: GameState): BattleSnapshot => clone({ roster: s.roster, inventory: s.inventory });
/** "Retry the battle": roster and bag go back to how they were before the fight, with at least 60% HP and Ki. */
export function restoreForRetry(s: GameState, snap: BattleSnapshot) {
  s.roster = clone(snap.roster); s.inventory = clone(snap.inventory);
  for (const m of s.roster) { const st = statsOf(m); m.hp = Math.max(m.hp, Math.round(st.hp * 0.6)); m.ki = Math.max(m.ki, Math.round(st.ki * 0.6)); }
}
