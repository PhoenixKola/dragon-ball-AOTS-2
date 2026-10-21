import type { Step } from '../engine/world/mapTypes';
import { HEROES, ITEMS } from '../data/heroes';
import { COMBOS } from '../data/combos';
import { QUESTS, QUEST_DONE, questById, type QuestDef } from '../data/quests';
import type { Cond, Line } from '../engine/world/mapTypes';
import { addItem, BALL_HINT, BALL_IDS, collectBall, condMet, clearFlags, joinHero, leaveHero, memberOf, ownedBalls, setFlags, setStoryParty, STAR_NAMES, type GameState } from './gameState';
import { grantXp, statsOf, type LevelUp } from './party';
import { ENEMIES } from '../data/enemies';
import { EXP_SCALE } from '../engine/combat/formulas';
import type { HeroId } from '../types';
import { coolerWarning } from './postgame';

/**
 * Pure story rules shared by the running game (Session) and the tests. Nothing here touches the DOM, audio or Phaser.
 * Steps that need the screen (say, battle, warp, cutscene, shop, ask, fade...) stay in Session.
 */

export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'done';

export function questStatus(s: GameState, q: QuestDef): QuestStatus {
  if (s.flags[QUEST_DONE(q.id)]) return 'done';
  if (!s.flags[q.startFlag]) return condMet(s, q.available) ? 'available' : 'locked';
  return q.steps.every((st) => condMet(s, st.done)) ? 'ready' : 'active';
}
export const questProgress = (s: GameState, q: QuestDef) => q.steps.map((st) => ({ text: st.text, done: !!s.flags[QUEST_DONE(q.id)] || condMet(s, st.done) }));

export interface StepFx { toasts: string[]; levelUps: LevelUp[]; sfx?: 'pickup' | 'levelup'; chapter?: number }
const fx = (): StepFx => ({ toasts: [], levelUps: [] });

/** Whole-roster XP (milestones and quest rewards): every member who has joined gets the full amount. */
export function grantRosterXp(s: GameState, amount: number): LevelUp[] {
  const out: LevelUp[] = [];
  for (const m of s.roster) { const lu = grantXp(m, amount); if (lu) out.push(lu); }
  return out;
}

export function rewardText(r: QuestDef['reward']): string {
  const parts: string[] = [];
  for (const [id, n] of Object.entries(r.items ?? {})) parts.push(`${ITEMS[id]?.name ?? id} x${n}`);
  if (r.zeni) parts.push(`${r.zeni} zeni`);
  if (r.xp) parts.push(`${r.xp} XP`);
  if (r.training) parts.push(`+${r.training} training points each`);
  return parts.join(', ');
}

/** Starts a quest. Idempotent: starting twice changes nothing. */
export function startQuest(s: GameState, id: string): StepFx | null {
  const q = questById(id); if (!q) throw new Error('Unknown quest ' + id);
  if (s.flags[q.startFlag] || s.flags[QUEST_DONE(id)]) return null;
  setFlags(s, q.startFlag);
  const e = fx(); e.toasts.push(`New quest: ${q.name}`); return e;
}

/** Completes a quest and pays its reward exactly once; every later call is a no-op that returns null. */
export function completeQuest(s: GameState, id: string): StepFx | null {
  const q = questById(id); if (!q) throw new Error('Unknown quest ' + id);
  if (s.flags[QUEST_DONE(id)]) return null;
  setFlags(s, [QUEST_DONE(id), q.startFlag]);
  const r = q.reward; const e = fx();
  for (const [item, n] of Object.entries(r.items ?? {})) addItem(s, item, n);
  if (r.zeni) s.zeni = Math.min(999999, s.zeni + r.zeni);
  if (r.training) for (const m of s.roster) m.unspent += r.training;
  if (r.xp) e.levelUps = grantRosterXp(s, r.xp);
  e.sfx = 'pickup';
  e.toasts.push(`Quest complete: ${q.name} (${rewardText(r)})`);
  for (const lu of e.levelUps) e.toasts.push(`${HEROES[lu.id].name} reached Lv ${lu.to}`);
  return e;
}

/** Applies one state-only step. Returns null for steps that need the screen (Session handles those). */
export function applyStateStep(s: GameState, st: Step): StepFx | null {
  const e = fx();
  if ('set' in st) { setFlags(s, st.set); return e; }
  if ('clear' in st) { clearFlags(s, st.clear); return e; }
  if ('give' in st) { for (const [k, n] of Object.entries(st.give)) addItem(s, k, n); return e; }
  if ('take' in st) { for (const [k, n] of Object.entries(st.take)) { s.inventory[k] = Math.max(0, (s.inventory[k] ?? 0) - n); if (!s.inventory[k]) delete s.inventory[k]; } return e; }
  if ('zeni' in st) { s.zeni = Math.min(999999, s.zeni + st.zeni); return e; }
  if ('ball' in st) {
    if (collectBall(s, st.ball)) { e.sfx = 'pickup'; e.toasts.push(`${STAR_NAMES[st.ball - 1]}-Star Dragon Ball obtained (${ownedBalls(s).length}/7)`); }
    return e;
  }
  if ('join' in st) { joinHero(s, st.join, st.level ?? 0, st.fused); e.sfx = 'levelup'; return e; }
  if ('leave' in st) { leaveHero(s, st.leave); return e; }
  if ('party' in st) { setStoryParty(s, st.party); return e; }
  if ('transform' in st) { const g = memberOf(s, 'goku'); if (g) { g.ssj = true; const stt = statsOf(g); g.hp = stt.hp; g.ki = stt.ki; } return e; }
  if ('restore' in st) {
    const f = Math.max(0, Math.min(1, st.restore));
    for (const m of s.roster) { const stt = statsOf(m); m.hp = Math.min(stt.hp, m.hp + Math.round((stt.hp - m.hp) * f)); m.ki = Math.min(stt.ki, m.ki + Math.round((stt.ki - m.ki) * f)); }
    return e;
  }
  if ('heal' in st) { for (const m of s.roster) { const stt = statsOf(m); m.hp = stt.hp; m.ki = stt.ki; } return e; }
  if ('training' in st) { for (const m of s.roster) m.unspent += st.training; return e; }
  if ('chapter' in st) { const before = s.chapter; s.chapter = Math.max(s.chapter, st.chapter); e.chapter = s.chapter; if (s.chapter === before) delete e.chapter; return e; }
  if ('unlockCombo' in st) {
    if (!s.combos.includes(st.unlockCombo)) { s.combos.push(st.unlockCombo); e.toasts.push('New Sparking Combo: ' + (COMBOS.find((c) => c.id === st.unlockCombo)?.name ?? st.unlockCombo)); }
    return e;
  }
  if ('xp' in st) {
    e.levelUps = grantRosterXp(s, st.xp); e.toasts.push(`+${st.xp} XP for everyone`);
    for (const lu of e.levelUps) e.toasts.push(`${HEROES[lu.id].name} reached Lv ${lu.to}`);
    return e;
  }
  if ('quest' in st) return (st.quest.do === 'start' ? startQuest(s, st.quest.id) : completeQuest(s, st.quest.id)) ?? e;
  return null;
}

/** Quests the journal should list, in authoring order, grouped by status. */
export function journalQuests(s: GameState) {
  return QUESTS.map((q) => ({ q, status: questStatus(s, q) }));
}

/** When each Dragon Ball's location becomes known to the player (no spoilers for places not yet reached). */
export const BALL_KNOWN: Record<number, Cond> = {
  1: { flag: 'scouts1' }, 2: { flag: 'dodoria_done' }, 3: { flag: 'guru_done' }, 4: { flag: 'ginyu_done' }, 5: { flag: 'dodoria_done' }, 6: { flag: 'piccolo_joined' }, 7: { flag: 'ssj' },
};
export const ballHint = (s: GameState, n: number) => (condMet(s, BALL_KNOWN[n]) ? BALL_HINT[n] : 'location not known yet');

/** What the Dragon Radar / Dende's senses report. Pure so the journal and tests can reuse it. */
export function radarLines(s: GameState, speaker: string): Line[] {
  const have = ownedBalls(s).length;
  if (have === 7) return [[speaker, 'All seven are with us. Nothing else is left to find.']];
  const missing = BALL_IDS.filter((n) => !s.flags[`ball${n}`]);
  const known = missing.filter((n) => condMet(s, BALL_KNOWN[n]));
  const lines: Line[] = [[speaker, `We hold ${have} of the 7 Dragon Balls.`]];
  if (known.length) lines.push([speaker, known.map((n) => `The ${STAR_NAMES[n - 1]}-Star ball is at ${BALL_HINT[n]}.`).join(' ')]);
  if (missing.length > known.length) lines.push([speaker, 'There are signals I cannot place yet. They will show up as we move on.']);
  if (!known.length && !have) lines.push([speaker, 'Nothing on the radar yet. Keep moving east.']);
  return lines;
}

/** Token substitution for prompt text: {balls} and {quests} (started but unfinished side quests). */
export function promptText(s: GameState, text: string): string {
  text = text.replace('{warn}', coolerWarning(s) ?? 'Your party is ready.');
  const open = QUESTS.filter((q) => { const st = questStatus(s, q); return st === 'active' || st === 'ready'; }).length;
  return text.replace('{balls}', String(ownedBalls(s).length)).replace('{quests}', String(open));
}

/** Story fights that end on a scripted HP threshold or a survived round count pay this share of the normal reward. */
export const SCRIPTED_REWARD_FACTOR = 0.85;
/** Easy mode meets fewer random fights and takes less damage; this keeps its levels from falling behind the story. */
export const EASY_XP_MULT = 1.25;

export interface BattleReward { exp: number; zeni: number; drops: Record<string, number>; levelUps: LevelUp[] }
/** Pays out a won battle: Zeni, drops (rng is injectable for tests), XP to the fighters in the battle and half to the rest of the roster. */
export function applyBattleRewards(s: GameState, spec: { foes: string[]; party?: HeroId[]; noRewards?: boolean }, scripted: boolean, rng: () => number = Math.random, xpMult = 1): BattleReward {
  if (spec.noRewards) return { exp: 0, zeni: 0, drops: {}, levelUps: [] };   // training rematch
  let exp = 0, zeni = 0; const drops: Record<string, number> = {};
  for (const id of spec.foes) {
    const e = ENEMIES[id]; exp += e.exp; zeni += e.zeni;
    for (const d of e.drops ?? []) if (rng() < d.chance) drops[d.item] = (drops[d.item] ?? 0) + 1;
  }
  exp = Math.round(exp * EXP_SCALE * xpMult);
  if (scripted) { exp = Math.round(exp * SCRIPTED_REWARD_FACTOR); zeni = Math.round(zeni * SCRIPTED_REWARD_FACTOR); }
  s.zeni = Math.min(999999, s.zeni + zeni);
  for (const [k, n] of Object.entries(drops)) addItem(s, k, n);
  const inBattle = new Set<HeroId>(spec.party ?? s.party);
  const levelUps: LevelUp[] = [];
  for (const m of s.roster) { const lu = grantXp(m, inBattle.has(m.id) ? exp : Math.round(exp * 0.5)); if (lu) levelUps.push(lu); }   // benched fighters still learn, at half rate
  return { exp, zeni, drops, levelUps };
}
