import type { Command, Fighter, GuardGrade, HeroId } from '../../types';
import { BattleEngine, isError, type BattleRules } from './engine';
import { Rng } from './rng';
import { SKILLS } from '../../data/skills';
import { ITEMS } from '../../data/heroes';
import { buildAlly, buildEnemy, newMember } from '../../systems/party';
import { hasStatus, kiCost } from './formulas';
import { ENEMIES } from '../../data/enemies';

export interface SimOptions {
  party: HeroId[]; level: number; foes: string[]; seed: number; rules?: Partial<BattleRules>;
  perfect?: number; good?: number;        // guard skill model for the human player
  inventory?: Record<string, number>; combos?: string[]; maxRounds?: number;
  ssj?: boolean; hpFrac?: number; levelOffsets?: Partial<Record<HeroId, number>>;
  hpMul?: number; atkMul?: number; log?: string[];
  /** A beginner: only presses Attack on the weakest foe, never guards, never uses items. */
  naive?: boolean;
}
export interface SimResult { outcome: string; rounds: number; hpLeft: number; kos: number; log?: string[] }

/** Deterministic stand-in for a competent player: heals, uses Rage Arts, targets weakest, guards with human-like skill. */
export function simulate(o: SimOptions): SimResult {
  const allies = o.party.map((id, i) => { const m = newMember(id, Math.max(1, o.level + (o.levelOffsets?.[id] ?? 0))); if (id === 'goku' && o.ssj) m.ssj = true; const a = buildAlly(m, i); if (o.hpFrac) a.hp = Math.round(a.stats.hp * o.hpFrac); return a; });
  const enemies = o.foes.map((id, i) => { return buildEnemy(id, i, o.hpMul ?? 1, o.atkMul ?? 1); });
  const e = new BattleEngine({ allies, enemies, seed: o.seed, rules: o.rules, unlockedCombos: o.combos ?? ['gohan_krillin', 'goku_vegeta', 'z_trio', 'piccolo_gohan', 'vegeta_krillin'], inventory: { ...(o.inventory ?? { medkit: 3, kicapsule: 2, senzu: 1 }) } });
  return playEngine(e, { seed: o.seed, perfect: o.perfect, good: o.good, naive: o.naive, maxRounds: o.maxRounds, log: o.log });
}

export interface PlayOptions { seed: number; perfect?: number; good?: number; naive?: boolean; maxRounds?: number; log?: string[]; chooser?: (e: BattleEngine, a: Fighter) => Command }
/** Plays an already built engine to its end. Guard grades are rolled per enemy chain from the given skill model (a stand-in for the human's timing). */
export function playEngine(e: BattleEngine, o: PlayOptions): SimResult {
  const rngG = new Rng(o.seed ^ 0x9e3779b9);
  const pPerfect = o.perfect ?? 0.35, pGood = o.good ?? 0.35;
  const pick = o.chooser ?? choose;
  let guard = 0;
  while (e.outcome === 'ongoing' && e.round <= (o.maxRounds ?? 60) && guard++ < 4000) {
    const t = e.nextTurn();
    if (t.kind === 'end') break;
    if (t.kind === 'skip') continue;
    const a = t.actor;
    const cmd: Command = t.kind === 'ai' ? e.aiCommand(a) : o.naive ? { kind: 'attack', target: [...e.enemies()].sort((x, y) => x.hp - y.hp)[0].uid } : pick(e, a);
    let plan = e.plan(cmd, a.uid);
    if (isError(plan)) { plan = e.plan({ kind: 'defend' }, a.uid); if (isError(plan)) break; }
    e.begin(plan);
    const hostile = e.isHostileToParty(a);
    let chainGrade: GuardGrade | null = null;
    for (const s of plan.steps) {
      let g: GuardGrade = 'none';
      if (hostile && plan.guardTargets.includes(s.targetId)) {
        if (chainGrade === null) { const r = rngG.next(); chainGrade = r < pPerfect ? 'perfect' : r < pPerfect + pGood ? 'good' : 'none'; g = chainGrade; }
        else g = chainGrade === 'perfect' ? 'good' : chainGrade;
      }
      e.commit(plan, s, g);
    }
    e.finishAction(plan);
    if (o.log) o.log.push(`${a.name} ${plan.skillId} -> ${plan.steps.map((x) => e.get(x.targetId).hp).join('/')}`);
  }
  const al = e.fighters.filter((f) => f.side === 'ally');
  const outcome = e.outcome === 'ongoing' ? 'timeout' : e.outcome;
  return { outcome, rounds: e.round, hpLeft: al.reduce((s, f) => s + f.hp, 0) / al.reduce((s, f) => s + f.stats.hp, 0), kos: al.filter((f) => !f.alive).length };
}

/**
 * The simulator's stand-in for a competent player (also used by the browser tests' battle bot through `BattleController.debugSuggestCommand`).
 * It only uses what a person can see: HP, Ki, the charge telegraph, the skill list and the bag. (Tried and dropped: bracing with Defend when a charge cannot be
 * broken. Against these bosses attacking to break the charge won more fights than Defend at every guard skill, so the bot does not brace.)
 */
export function choose(e: BattleEngine, a: Fighter): Command {
  const foes = e.enemies();
  const live = e.allies();
  const weakest = [...foes].sort((x, y) => x.hp - y.hp)[0];
  const target = foes.find((f) => f.chargedMove) ?? (foes.find((f) => ENEMIES[f.defId]?.boss) ?? weakest);
  const usable = (s: string) => a.ki >= kiCost(a, SKILLS[s].cost) && !(hasStatus(a, 'seal') && SKILLS[s].cost > 0) && !(SKILLS[s].ssjOnly && !hasStatus(a, 'ssjform')) && !(SKILLS[s].status?.kind === 'ssjform' && hasStatus(a, 'ssjform'));
  // emergency healing
  const hurt = [...live].sort((x, y) => x.hp / x.stats.hp - y.hp / y.stats.hp)[0];
  if (hurt && hurt.hp / hurt.stats.hp < 0.5) {
    const healSkill = a.skills.find((s) => SKILLS[s].kind === 'heal' && usable(s));
    if (healSkill) return { kind: 'skill', skill: healSkill, target: hurt.uid };
    const missing = hurt.stats.hp - hurt.hp;
    if ((e.inventory.megakit ?? 0) > 0 && (missing > 260 || !(e.inventory.medkit ?? 0))) return { kind: 'item', item: 'megakit', target: hurt.uid };
    if ((e.inventory.medkit ?? 0) > 0) return { kind: 'item', item: 'medkit', target: hurt.uid };
    if ((e.inventory.senzu ?? 0) > 0 && hurt.hp / hurt.stats.hp < 0.2) return { kind: 'item', item: 'senzu', target: hurt.uid };
  }
  const downed = e.allies(false).find((f) => !f.alive);
  if (downed && (e.inventory.senzu ?? 0) > 0) return { kind: 'item', item: 'senzu', target: downed.uid };
  // combos
  for (const c of e.availableCombos(a)) if (c.ok) return { kind: 'combo', combo: c.id, target: target.uid };
  const art = a.skills.find((s) => SKILLS[s].rageArt);
  if (art && a.rage >= 100) return { kind: 'skill', skill: art, target: target.uid };
  const dmgSkills = a.skills.filter((s) => SKILLS[s].kind === 'damage' && !SKILLS[s].rageArt && usable(s));
  const power = (s: string) => SKILLS[s].power * SKILLS[s].hits.reduce((x, h) => x + h, 0) * (SKILLS[s].target === 'allEnemies' ? foes.length : 1);
  const best = [...dmgSkills].sort((x, y) => power(y) - power(x))[0];
  if (a.defId === 'krillin' && foes.length > 1 && !foes.some((f) => hasStatus(f, 'blind')) && a.ki >= 14 && a.skills.includes('solarflare') && !hasStatus(a, 'seal')) return { kind: 'skill', skill: 'solarflare' };
  if (a.defId === 'trunks' && !hasStatus(a, 'ssjform') && a.skills.includes('ssjtrunks') && a.hp / a.stats.hp > 0.5 && a.ki >= a.stats.ki * 0.55) return { kind: 'skill', skill: 'ssjtrunks' };
  if (a.defId === 'goku' && !a.ssj && !hasStatus(a, 'kaioken') && a.skills.includes('kaioken') && a.hp / a.stats.hp > 0.6 && a.ki >= 40) return { kind: 'skill', skill: 'kaioken' };
  if (best && (a.ki > a.stats.ki * 0.2 || foes.some((f) => f.chargedMove))) { const s = SKILLS[best]; return { kind: 'skill', skill: best, target: s.target === 'enemy' ? target.uid : undefined }; }
  if (a.ki < a.stats.ki * 0.15 && (e.inventory.kicapsule ?? 0) > 0 && ITEMS.kicapsule) return { kind: 'item', item: 'kicapsule', target: a.uid };
  return { kind: 'attack', target: target.uid };
}
