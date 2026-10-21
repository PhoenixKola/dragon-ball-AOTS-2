import type { Fighter, HeroId, Stats } from '../types';
import { HEROES, ITEMS, SSJ_RAGE_ART, SSJ_SKILLS } from '../data/heroes';
import { SKILLS } from '../data/skills';
import { ENEMIES } from '../data/enemies';
import { xpForLevel } from '../engine/combat/formulas';

export const MAX_LEVEL = 30;
export const POINTS_PER_LEVEL = 3;
export const POINT_VALUE: Stats = { hp: 14, ki: 7, atk: 2, def: 1.2, spd: 1 };
export const CAPSULE_SLOTS = 2;
/** Awaken Hidden Potential (Porunga wish 2): every roster member, including later recruits, gets these permanent multipliers once. */
export const POTENTIAL = { hp: 1.10, ki: 1.10, atk: 1.08, def: 1.08, spd: 1.05 } as const;
export const MAX_EQUIPPED = 4;

export interface PartyMember {
  id: HeroId;
  level: number;
  xp: number;            // xp into the current level
  hp: number;
  ki: number;
  alloc: Stats;          // training points spent per stat
  unspent: number;
  capsules: string[];
  ssj?: boolean;
  fused?: boolean;       // Piccolo after Nail's fusion
  potential?: boolean;   // Porunga's Hidden Potential wish: permanent postgame boost (see POTENTIAL below)
  equipped?: string[];   // up to MAX_EQUIPPED learned specials chosen in the loadout menu; undefined = the default loadout (see equippedOf)
}

export const emptyAlloc = (): Stats => ({ hp: 0, ki: 0, atk: 0, def: 0, spd: 0 });

export function capsuleBonus(m: PartyMember): Partial<Stats> & { rageGain?: number } {
  const out: Partial<Stats> & { rageGain?: number } = {};
  for (const c of m.capsules) {
    const cap = ITEMS[c]?.capsule;
    if (!cap) continue;
    (Object.keys(cap) as (keyof typeof cap)[]).forEach((k) => { out[k] = (out[k] ?? 0) + (cap[k] ?? 0); });
  }
  return out;
}

export function statsOf(m: PartyMember): Stats {
  const h = HEROES[m.id];
  const lv = m.level - 1;
  const cap = capsuleBonus(m);
  const v = (k: keyof Stats) => Math.round(h.base[k] + h.growth[k] * lv + POINT_VALUE[k] * m.alloc[k] + (cap[k] ?? 0));
  let s: Stats = { hp: v('hp'), ki: v('ki'), atk: v('atk'), def: v('def'), spd: v('spd') };
  if (m.ssj) s = { hp: Math.round(s.hp * 1.12), ki: Math.round(s.ki * 1.2), atk: Math.round(s.atk * 1.35), def: Math.round(s.def * 1.15), spd: Math.round(s.spd * 1.1) };
  if (m.potential) s = { hp: Math.round(s.hp * POTENTIAL.hp), ki: Math.round(s.ki * POTENTIAL.ki), atk: Math.round(s.atk * POTENTIAL.atk), def: Math.round(s.def * POTENTIAL.def), spd: Math.round(s.spd * POTENTIAL.spd) };
  if (m.fused) s = { ...s, hp: Math.round(s.hp * 1.1), atk: Math.round(s.atk * 1.1), def: Math.round(s.def * 1.1) };
  return s;
}

/** Every base-form special this hero has learned (level-gated), in the hero's library order. Super Saiyan form skills are separate (formSkillsOf). */
export function learnedSkillsOf(m: PartyMember): string[] {
  return HEROES[m.id].skills.filter((id) => SKILLS[id].unlockLevel <= m.level);
}
/** Form-only skills that never use a slot (Goku as Super Saiyan). */
export function formSkillsOf(m: PartyMember): string[] { return m.id === 'goku' && m.ssj ? [...SSJ_SKILLS] : []; }
/** Default loadout (nothing chosen yet): the hero's signature moves first, then the earliest library skills. */
export function defaultEquipped(m: PartyMember): string[] {
  const learned = learnedSkillsOf(m), sig = HEROES[m.id].skills.slice(0, HEROES[m.id].signature);
  return [...learned.filter((id) => sig.includes(id)), ...learned.filter((id) => !sig.includes(id))].slice(0, MAX_EQUIPPED);
}
/** The four equipped specials: the player's choice, sanitised against what is actually learned (no unknown, unlearned or duplicate ids), or the default loadout. */
export function equippedOf(m: PartyMember): string[] {
  if (!m.equipped) return defaultEquipped(m);
  const learned = new Set(learnedSkillsOf(m)); const out: string[] = [];
  for (const id of m.equipped) if (learned.has(id) && !out.includes(id) && out.length < MAX_EQUIPPED) out.push(id);
  return out;
}
/** What a fighter can use in battle besides Attack / Defend / Items / Rage Art / Sparking / combos: form skills + the equipped specials that suit the form. */
export function skillsOf(m: PartyMember): string[] {
  const eq = equippedOf(m);
  if (m.id === 'goku' && m.ssj) return [...SSJ_SKILLS, ...eq.filter((id) => !SKILLS[id].baseOnly)];
  return eq;
}
/** Equip / swap / unequip helpers used by the loadout menu. Return an error text or null. */
export function equipSkill(m: PartyMember, id: string, slot?: number): string | null {
  if (!learnedSkillsOf(m).includes(id)) return 'Not learned yet.';
  const cur = equippedOf(m);
  if (cur.includes(id)) return 'Already equipped.';
  const next = [...cur];
  if (slot !== undefined && slot < next.length) next[slot] = id;
  else if (next.length < MAX_EQUIPPED) next.push(id);
  else return 'All four slots are full: pick a slot to swap.';
  m.equipped = next; return null;
}
export function unequipSkill(m: PartyMember, id: string): void { m.equipped = equippedOf(m).filter((x) => x !== id); }

/** Skills this hero has not learned yet, soonest first (SSJ-only skills are not listed). */
export function upcomingSkills(m: PartyMember) {
  return HEROES[m.id].skills.map((id) => SKILLS[id]).filter((sk) => sk.unlockLevel > m.level).sort((a, b) => a.unlockLevel - b.unlockLevel);
}
export const rageArtOf = (m: PartyMember) => (m.id === 'goku' && m.ssj ? SSJ_RAGE_ART : HEROES[m.id].rageArt);

export function newMember(id: HeroId, level: number): PartyMember {
  const m: PartyMember = { id, level, xp: 0, hp: 1, ki: 1, alloc: emptyAlloc(), unspent: 0, capsules: [] };
  const s = statsOf(m);
  m.hp = s.hp; m.ki = s.ki;
  return m;
}

export function xpToNext(m: PartyMember) { return m.level >= MAX_LEVEL ? Infinity : xpForLevel(m.level); }

export interface LevelUp { id: HeroId; from: number; to: number; points: number; newSkills: string[] }

export function grantXp(m: PartyMember, amount: number): LevelUp | null {
  if (m.level >= MAX_LEVEL) return null;
  const from = m.level;
  const beforeSkills = learnedSkillsOf(m); const custom = m.equipped !== undefined;
  m.xp += amount;
  while (m.level < MAX_LEVEL && m.xp >= xpForLevel(m.level)) {
    m.xp -= xpForLevel(m.level);
    m.level++;
    m.unspent += POINTS_PER_LEVEL;
  }
  if (m.level === from) return null;
  const s = statsOf(m);
  m.hp = Math.min(s.hp, m.hp + Math.round((s.hp) * 0.4));
  m.ki = Math.min(s.ki, m.ki + Math.round(s.ki * 0.4));
  const newSkills = learnedSkillsOf(m).filter((s2) => !beforeSkills.includes(s2));
  // a loadout the player chose is kept; new skills only fill a free slot (the rest wait in the library). An untouched default simply recomputes.
  if (custom) { const eq = equippedOf(m); for (const id of newSkills) if (eq.length < MAX_EQUIPPED) eq.push(id); m.equipped = eq; }
  return { id: m.id, from, to: m.level, points: (m.level - from) * POINTS_PER_LEVEL, newSkills };
}

export function spendPoint(m: PartyMember, stat: keyof Stats): boolean {
  if (m.unspent <= 0) return false;
  m.alloc[stat]++; m.unspent--;
  return true;
}
export function refundPoints(m: PartyMember) {
  const total = Object.values(m.alloc).reduce((a, b) => a + b, 0);
  m.unspent += total; m.alloc = emptyAlloc();
}

export function buildAlly(m: PartyMember, slot: number): Fighter {
  const h = HEROES[m.id];
  const stats = statsOf(m);
  const cap = capsuleBonus(m);
  return {
    uid: 'a_' + m.id, defId: m.id, side: 'ally', name: h.name, sprite: m.ssj && m.id === 'goku' ? 'ssj_goku' : h.sprite, slot, level: m.level,
    stats, hp: Math.min(m.hp, stats.hp), ki: Math.min(m.ki, stats.ki), rage: 0, statuses: [], defending: false, alive: m.hp > 0,
    skills: [...skillsOf(m), ...(h.extra ?? []), rageArtOf(m)], heightPx: h.heightPx, form: m.ssj ? 'ssj' : 'base', phaseIdx: 0, turnsTaken: 0, boss: false,
    chargeDmg: 0, rageGainMult: 1 + (cap.rageGain ?? 0), ssj: !!m.ssj, actedThisRound: false,
  };
}

let enemySeq = 0;
export function buildEnemy(defId: string, slot: number, hpScale = 1, atkScale = 1): Fighter {
  const d = ENEMIES[defId];
  if (!d) throw new Error('Unknown enemy ' + defId);
  const stats: Stats = { hp: Math.round(d.stats.hp * hpScale), ki: 999, atk: Math.round(d.stats.atk * atkScale), def: d.stats.def, spd: d.stats.spd };
  return {
    uid: `e_${defId}_${slot}_${++enemySeq}`, defId, side: 'enemy', name: d.name, sprite: d.sprite, slot, level: 1, stats, hp: stats.hp, ki: 999, rage: 0,
    statuses: [], defending: false, alive: true, skills: [], heightPx: d.heightPx, form: defId, phaseIdx: 0, turnsTaken: 0, boss: !!d.boss,
    chargeDmg: 0, rageGainMult: 1, ssj: false, actedThisRound: false,
  };
}
