import type {
  ActionPlan, BattleLogEntry, BattleOutcome, Command, Fighter, GuardGrade, HitResult, HitStep, SkillDef, StatusEffect,
} from '../../types';
import { ATTACK_SKILL, ITEMS } from '../../data/heroes';
import { ENEMIES } from '../../data/enemies';
import { SKILLS } from '../../data/skills';
import { COMBOS, comboById } from '../../data/combos';
import { Rng } from './rng';
import { RAGE, rageDealt, rageTaken } from './rage';
import {
  BLIND_MISS, CHARGE_INTERRUPT_FRAC, COMBO_RAGE_COST, CRIT_CHANCE, CRIT_MULT, DEFEND_MULT, GUARD_MULT, RAGE_FULL,
  effAtk, effDef, effSpd, SSJ_FORM, hasStatus, kiCost, mitigation, statusPower,
} from './formulas';

export interface BattleRules {
  allowFlee: boolean;
  /** Ends the battle as a scripted victory when the matching enemy drops to this HP fraction. */
  scriptedEnd?: { defId: string; hpFrac: number };
  /** The battle is won (as a scripted victory) once this many full rounds have been survived. */
  surviveRounds?: number;
}
export interface BattleSetup {
  allies: Fighter[];
  enemies: Fighter[];
  seed: number;
  rules?: Partial<BattleRules>;
  unlockedCombos?: string[];
  inventory?: Record<string, number>;
}

export type TurnStart =
  | { kind: 'input'; actor: Fighter }
  | { kind: 'ai'; actor: Fighter }
  | { kind: 'skip'; actor: Fighter; reason: string }
  | { kind: 'end'; outcome: BattleOutcome };

export type EngineEvent =
  | { type: 'phase'; uid: string; toForm?: string; message: string }
  | { type: 'interrupt'; uid: string; message: string }
  | { type: 'message'; message: string }
  | { type: 'outcome'; outcome: BattleOutcome };

export type PlanError = { error: string };
export const isError = (p: ActionPlan | PlanError): p is PlanError => 'error' in p;

export class BattleEngine {
  readonly fighters: Fighter[];
  readonly rng: Rng;
  readonly rules: BattleRules;
  readonly inventory: Record<string, number>;
  readonly unlockedCombos: string[];
  round = 0;
  outcome: BattleOutcome = 'ongoing';
  scriptedWin = false;
  log: BattleLogEntry[] = [];
  queue: string[] = [];
  currentUid: string | null = null;
  private planSeq = 0;
  private missMap = new Map<number, Set<string>>();
  private participants = new Map<number, string[]>();

  constructor(setup: BattleSetup) {
    this.fighters = [...setup.allies, ...setup.enemies];
    this.rng = new Rng(setup.seed);
    this.rules = { allowFlee: true, ...setup.rules };
    this.inventory = { ...(setup.inventory ?? {}) };
    this.unlockedCombos = setup.unlockedCombos ?? [];
  }

  // ---------- lookups ----------
  get(uid: string): Fighter {
    const f = this.fighters.find((x) => x.uid === uid);
    if (!f) throw new Error('Unknown fighter ' + uid);
    return f;
  }
  allies(aliveOnly = true) { return this.fighters.filter((f) => f.side === 'ally' && (!aliveOnly || f.alive)); }
  enemies(aliveOnly = true) { return this.fighters.filter((f) => f.side === 'enemy' && (!aliveOnly || f.alive)); }
  /** Does this actor attack the player's party right now? */
  isHostileToParty(f: Fighter) { return f.side === 'enemy' || hasStatus(f, 'possessed'); }
  opponentsOf(f: Fighter): Fighter[] {
    return this.isHostileToParty(f) ? this.allies().filter((a) => !hasStatus(a, 'possessed')) : this.enemies();
  }
  say(text: string, tone: BattleLogEntry['tone'] = 'info') {
    this.log.push({ text, tone });
    if (this.log.length > 60) this.log.shift();
  }

  // ---------- turn flow ----------
  private startRound() {
    this.round++;
    this.fighters.forEach((f) => { f.actedThisRound = false; });
    const order = this.fighters
      .filter((f) => f.alive)
      .map((f) => ({ f, key: effSpd(f) + this.rng.range(0, 3) + (f.side === 'ally' ? 0.01 : 0) }))
      .sort((a, b) => b.key - a.key);
    this.queue = order.map((o) => o.f.uid);
  }

  nextTurn(): TurnStart {
    for (let guard = 0; guard < 200; guard++) {
      const end = this.checkOutcome();
      if (end !== 'ongoing') return { kind: 'end', outcome: end };
      if (this.queue.length === 0) this.startRound();
      const uid = this.queue.shift()!;
      const f = this.get(uid);
      if (!f.alive || f.actedThisRound) continue;
      this.currentUid = uid;
      f.defending = false;
      if (hasStatus(f, 'regen')) this.heal(f, Math.round(f.stats.hp * 0.06));
      if (hasStatus(f, 'ssjform')) {
        f.ki = Math.max(0, f.ki - Math.round(f.stats.ki * SSJ_FORM.kiUpkeep));
        if (f.ki <= 0) { this.removeStatus(f, 'ssjform'); this.say(`${f.name} runs out of Ki and drops out of Super Saiyan.`, 'warn'); }
      }
      if (hasStatus(f, 'stun')) {
        this.removeStatus(f, 'stun');
        this.say(`${f.name} is stunned and cannot move!`, 'warn');
        return this.skipTurn(f, 'stunned');
      }
      if (hasStatus(f, 'frozen')) {
        this.say(`${f.name} is frozen in time!`, 'warn');
        return this.skipTurn(f, 'frozen');
      }
      if (f.chargedMove && (f.chargeLeft ?? 0) > 0) {
        f.chargeLeft = (f.chargeLeft ?? 1) - 1;
        this.say(`${f.name} keeps gathering power...`, 'warn');
        return this.skipTurn(f, 'charging');
      }
      const playerControlled = f.side === 'ally' && !hasStatus(f, 'possessed');
      return { kind: playerControlled ? 'input' : 'ai', actor: f };
    }
    throw new Error('nextTurn: no actionable fighter found');
  }

  private skipTurn(f: Fighter, reason: string): TurnStart {
    this.finishTurn(f);
    return { kind: 'skip', actor: f, reason };
  }

  private finishTurn(f: Fighter) {
    f.actedThisRound = true;
    f.turnsTaken++;
    // Status durations tick down at the end of the owner's own turn.
    f.statuses = f.statuses
      .map((s) => (s.kind === 'charging' ? s : s.fresh ? { ...s, fresh: false } : { ...s, turns: s.turns - 1 }))
      .filter((s) => s.turns > 0 || s.kind === 'charging');
    this.currentUid = null;
  }

  removeStatus(f: Fighter, kind: StatusEffect['kind']) { f.statuses = f.statuses.filter((s) => s.kind !== kind); }
  addStatus(f: Fighter, s: StatusEffect) {
    const fresh = this.currentUid === f.uid;
    const existing = f.statuses.find((x) => x.kind === s.kind);
    if (existing) { existing.turns = Math.max(existing.turns, s.turns); existing.power = s.power ?? existing.power; existing.fresh = existing.fresh || fresh; return; }
    f.statuses.push({ ...s, fresh });
  }

  // ---------- skills lookup ----------
  skillFor(actor: Fighter, cmd: Command): SkillDef | undefined {
    if (cmd.kind === 'attack') return SKILLS[ATTACK_SKILL[actor.defId as keyof typeof ATTACK_SKILL]];
    if (cmd.kind === 'skill') return SKILLS[cmd.skill];
    if (cmd.kind === 'combo') return SKILLS[comboById(cmd.combo)?.skill ?? ''];
    return undefined;
  }

  availableCombos(actor: Fighter): { id: string; ok: boolean; reason?: string }[] {
    if (actor.side !== 'ally' || hasStatus(actor, 'possessed')) return [];
    return COMBOS.filter((c) => c.members.includes(actor.defId as never) && this.unlockedCombos.includes(c.id)).map((c) => {
      const members = c.members.map((m) => this.fighters.find((f) => f.defId === m && f.side === 'ally'));
      if (members.some((m) => !m || !m.alive)) return { id: c.id, ok: false, reason: 'Partner not in battle' };
      const ms = members as Fighter[];
      if (ms.some((m) => hasStatus(m, 'stun') || hasStatus(m, 'frozen') || hasStatus(m, 'possessed'))) return { id: c.id, ok: false, reason: 'Partner cannot act' };
      if (ms.some((m) => m.rage < COMBO_RAGE_COST)) return { id: c.id, ok: false, reason: `All partners need ${COMBO_RAGE_COST} Rage` };
      if (ms.some((m) => m.uid !== actor.uid && m.actedThisRound)) return { id: c.id, ok: false, reason: 'Partner already acted this round' };
      return { id: c.id, ok: true };
    });
  }

  // ---------- planning ----------
  plan(cmd: Command, actorId: string): ActionPlan | PlanError {
    const actor = this.get(actorId);
    if (!actor.alive) return { error: 'Actor is down' };
    if (this.outcome !== 'ongoing') return { error: 'Battle is over' };
    if (this.currentUid !== actorId) return { error: 'Not this fighter’s turn' };
    const id = ++this.planSeq;
    const base: Omit<ActionPlan, 'skillId' | 'targetIds' | 'steps' | 'guardTargets'> = { id, actorId };

    switch (cmd.kind) {
      case 'defend':
        return { ...base, skillId: 'defend', targetIds: [actorId], steps: [], guardTargets: [] };
      case 'sparking': {
        if (actor.rage < RAGE_FULL) return { error: 'Rage not full' };
        if (hasStatus(actor, 'sparking')) return { error: 'Already Sparking' };
        return { ...base, skillId: 'sparking', targetIds: [actorId], steps: [], guardTargets: [] };
      }
      case 'flee':
        if (!this.rules.allowFlee) return { error: 'Cannot escape this battle' };
        return { ...base, skillId: 'flee', targetIds: [], steps: [], guardTargets: [] };
      case 'item': {
        const item = ITEMS[cmd.item];
        if (!item) return { error: 'Unknown item' };
        if ((this.inventory[cmd.item] ?? 0) <= 0) return { error: 'None left' };
        if (item.capsule) return { error: 'Capsules are equipped from the menu' };
        const t = this.get(cmd.target);
        if (t.side !== 'ally') return { error: 'Items target allies' };
        if (!t.alive && !item.revive) return { error: 'Target is down' };
        const step: HitStep = { index: 0, actorId, targetId: t.uid, skillId: 'item:' + cmd.item, hitFrac: 1, last: true };
        return { ...base, skillId: 'item', isItem: cmd.item, targetIds: [t.uid], steps: [step], guardTargets: [] };
      }
      default:
        break;
    }

    const skill = this.skillFor(actor, cmd);
    if (!skill) return { error: 'Unknown skill' };
    const isCombo = cmd.kind === 'combo';
    const hostile = this.isHostileToParty(actor);

    if (!hostile) {
      if (cmd.kind === 'skill' && !actor.skills.includes(skill.id)) return { error: 'Skill not learned' };
      if (skill.ssjOnly && !hasStatus(actor, 'ssjform')) return { error: 'Needs Super Saiyan' };
      if (skill.status?.kind === 'ssjform' && hasStatus(actor, 'ssjform')) return { error: 'Already Super Saiyan' };
      if (skill.rageArt && actor.rage < RAGE_FULL) return { error: 'Rage not full' };
      if (skill.cost > 0 && hasStatus(actor, 'seal')) return { error: 'Ki is sealed' };
      if (actor.ki < kiCost(actor, skill.cost)) return { error: 'Not enough Ki' };
    }
    if (isCombo) {
      const c = this.availableCombos(actor).find((x) => x.id === (cmd as { combo: string }).combo);
      if (!c) return { error: 'Combo not known' };
      if (!c.ok) return { error: c.reason ?? 'Combo unavailable' };
    }

    // Charge telegraph for heavy enemy moves.
    if (hostile && skill.chargeTurns && !(actor.chargedMove === skill.id && (actor.chargeLeft ?? 0) === 0)) {
      return { ...base, skillId: skill.id, targetIds: [actorId], steps: [], guardTargets: [], charging: true };
    }

    const targets = this.resolveTargets(actor, skill, 'target' in cmd ? cmd.target : undefined);
    if ('error' in targets) return targets;

    const steps: HitStep[] = [];
    skill.hits.forEach((frac, i) => targets.ids.forEach((tid) => {
      steps.push({ index: i, actorId, targetId: tid, skillId: skill.id, hitFrac: frac, last: i === skill.hits.length - 1 });
    }));
    const guardTargets = hostile && skill.guardable && skill.kind === 'damage' ? [...new Set(targets.ids)] : [];
    // Blind: decide once per action per target.
    if (hasStatus(actor, 'blind') && skill.kind === 'damage') {
      const misses = new Set<string>();
      targets.ids.forEach((t) => { if (this.rng.next() < BLIND_MISS) misses.add(t); });
      this.missMap.set(id, misses);
    }
    if (isCombo) {
      const recipe = comboById((cmd as { combo: string }).combo)!;
      this.participants.set(id, recipe.members.map((m) => this.fighters.find((f) => f.defId === m && f.side === 'ally')!.uid));
    }
    return { ...base, skillId: skill.id, comboId: isCombo ? (cmd as { combo: string }).combo : undefined, targetIds: targets.ids, steps, guardTargets };
  }

  private resolveTargets(actor: Fighter, skill: SkillDef, wanted?: string): { ids: string[] } | PlanError {
    const hostile = this.isHostileToParty(actor);
    const foes = this.opponentsOf(actor);
    const friends = hostile ? this.enemies() : this.allies().filter((a) => !hasStatus(a, 'possessed'));
    switch (skill.target) {
      case 'self': return { ids: [actor.uid] };
      case 'allEnemies': return foes.length ? { ids: foes.map((f) => f.uid) } : { error: 'No targets' };
      case 'allAllies': return { ids: friends.map((f) => f.uid) };
      case 'enemy': {
        let t = wanted ? this.fighters.find((f) => f.uid === wanted) : undefined;
        if (!t || !t.alive || !foes.includes(t)) {
          if (wanted && !hostile) return { error: 'Invalid target' };
          t = this.pickTarget(actor, foes);
        }
        return t ? { ids: [t.uid] } : { error: 'No targets' };
      }
      case 'ally': {
        const t = wanted ? this.fighters.find((f) => f.uid === wanted) : undefined;
        if (!t || !t.alive || !friends.includes(t)) return { error: 'Invalid ally target' };
        return { ids: [t.uid] };
      }
      case 'downedAlly': {
        const t = wanted ? this.fighters.find((f) => f.uid === wanted) : undefined;
        if (!t || t.alive || t.side !== actor.side) return { error: 'Choose a fallen ally' };
        return { ids: [t.uid] };
      }
    }
  }

  private pickTarget(actor: Fighter, foes: Fighter[]): Fighter | undefined {
    if (!foes.length) return undefined;
    if (actor.defId === 'ginyu' || actor.chargedMove === 'e_bodychange') return [...foes].sort((a, b) => b.stats.atk - a.stats.atk)[0];
    return this.rng.weighted(foes, (f) => 1 + (1 - f.hp / f.stats.hp) * 1.2);
  }

  /** Spends costs and flags the actor; call once when the animation timeline begins. */
  begin(plan: ActionPlan) {
    const a = this.get(plan.actorId);
    const skill = SKILLS[plan.skillId];
    this.actionRage.clear();
    if (plan.skillId !== 'defend') a.defendStreak = 0;
    if (plan.skillId === 'defend') {
      a.defending = true; a.ki = Math.min(a.stats.ki, a.ki + 14);
      this.gainRage(a, (a.defendStreak ?? 0) === 0 ? RAGE.DEFEND_GAIN : 0);   // only the first Defend in a row gives Rage
      a.defendStreak = (a.defendStreak ?? 0) + 1;
      this.say(`${a.name} takes a defensive stance.`);
      return;
    }
    if (plan.skillId === 'sparking') {
      a.rage = 0; this.addStatus(a, { kind: 'sparking', turns: 4, power: 0.25 });
      this.say(`${a.name} goes SPARKING!`, 'good');
      return;
    }
    if (plan.skillId === 'flee') { this.say('The party tries to escape...'); return; }
    if (plan.isItem) { this.inventory[plan.isItem] = (this.inventory[plan.isItem] ?? 1) - 1; return; }
    if (!skill) return;
    if (plan.charging) {
      a.chargedMove = skill.id; a.chargeLeft = Math.max(0, (skill.chargeTurns ?? 1) - 1); a.chargeDmg = 0;
      this.addStatus(a, { kind: 'charging', turns: 99 });
      this.say(`${a.name} begins ${skill.name}!`, 'warn');
      if (skill.desc) this.say(skill.desc, 'warn');
      return;
    }
    if (!this.isHostileToParty(a)) {
      a.ki -= kiCost(a, skill.cost);
      if (skill.rageArt) a.rage = 0;
      if (skill.hpCostFrac) a.hp = Math.max(1, a.hp - Math.round(a.hp * skill.hpCostFrac));
      if (plan.skillId.startsWith('atk_')) a.ki = Math.min(a.stats.ki, a.ki + 6);
    }
    if (plan.comboId) {
      (this.participants.get(plan.id) ?? []).forEach((uid) => { const m = this.get(uid); m.rage -= COMBO_RAGE_COST; if (uid !== a.uid) m.actedThisRound = true; });
    }
    if (a.chargedMove === skill.id) { a.chargedMove = undefined; a.chargeLeft = undefined; this.removeStatus(a, 'charging'); }
    this.say(`${a.name} uses ${skill.name}!`);
  }

  participantsOf(planId: number): string[] { return this.participants.get(planId) ?? []; }

  submit(cmd: Command, actorId: string): ActionPlan | PlanError {
    const p = this.plan(cmd, actorId);
    if (!isError(p)) this.begin(p);
    return p;
  }

  // ---------- committing a hit (called exactly once per HitStep at its animation marker) ----------
  private committed = new Set<string>();
  commit(plan: ActionPlan, step: HitStep, guard: GuardGrade = 'none'): HitResult {
    const key = `${plan.id}:${step.index}:${step.targetId}`;
    if (this.committed.has(key)) throw new Error('Hit committed twice: ' + key);
    this.committed.add(key);
    const actor = this.get(step.actorId);
    const target = this.get(step.targetId);
    const skill = SKILLS[step.skillId] ?? undefined;
    const res: HitResult = { step, damage: 0, heal: 0, crit: false, missed: false, guard, countered: 0, killed: false, targetHp: target.hp, actorHp: actor.hp };

    // Items
    if (plan.isItem) {
      const item = ITEMS[plan.isItem];
      if (!target.alive && item.revive) { target.alive = true; target.hp = 1; target.statuses = []; }
      if (item.full) { res.heal = target.stats.hp - target.hp; target.hp = target.stats.hp; target.ki = target.stats.ki; }
      if (item.hp) res.heal = this.heal(target, item.hp);
      if (item.ki) target.ki = Math.min(target.stats.ki, target.ki + item.ki);
      this.say(`${target.name} uses ${item.name}.`, 'good');
      res.targetHp = target.hp;
      return res;
    }
    if (!skill) return res;
    const hostile = this.isHostileToParty(actor);

    if (skill.kind === 'heal') {
      if (!target.alive) return res;
      res.heal = this.heal(target, Math.round(target.stats.hp * skill.power));
      this.gainRage(actor, skill.rageGain / Math.max(1, skill.hits.length));
      this.say(`${target.name} recovers ${res.heal} HP.`, 'good');
    } else if (skill.kind === 'revive') {
      if (!target.alive) { target.alive = true; target.hp = Math.max(1, Math.round(target.stats.hp * skill.power)); target.statuses = []; res.heal = target.hp; this.say(`${target.name} is revived!`, 'good'); }
    } else if (skill.kind === 'buff') {
      if (skill.status) this.addStatus(target, { kind: skill.status.kind, turns: skill.status.turns, power: skill.status.power, source: actor.uid });
      res.statusApplied = skill.status?.kind;
      this.say(`${target.name}'s power rises!`, 'good');
    } else if (skill.kind === 'status' || skill.kind === 'special') {
      if (target.alive && skill.status) {
        if (skill.status.kind === 'frozen') {
          // Time freeze catches at most two fighters.
          const already = this.allies().filter((a) => hasStatus(a, 'frozen')).length;
          if (already < 2 && !hasStatus(target, 'frozen')) {
            this.addStatus(target, { kind: 'frozen', turns: skill.status.turns, source: actor.uid });
            res.statusApplied = 'frozen';
            this.say(`${target.name} is frozen in time!`, 'bad');
          }
        } else if (skill.status.kind === 'possessed') {
          // Body Change: the strongest fighter is hijacked.
          this.addStatus(target, { kind: 'possessed', turns: skill.status.turns, source: actor.uid });
          res.statusApplied = 'possessed';
          this.say(`${target.name}'s body is stolen by Ginyu!`, 'bad');
        } else if (this.rng.next() < skill.status.chance) {
          this.addStatus(target, { kind: skill.status.kind, turns: skill.status.turns, power: skill.status.power, source: actor.uid });
          res.statusApplied = skill.status.kind;
          this.say(`${target.name} is afflicted: ${skill.status.kind}.`, hostile ? 'bad' : 'good');
        } else this.say(`${target.name} resists.`);
      }
    } else if (skill.kind === 'damage') {
      if (!target.alive) { res.missed = true; return res; }
      if (this.missMap.get(plan.id)?.has(target.uid)) { res.missed = true; this.say(`${actor.name}'s attack misses!`); return res; }
      const atkFighters = plan.comboId ? (this.participants.get(plan.id) ?? [actor.uid]).map((u) => this.get(u)) : [actor];
      const atk = plan.comboId ? atkFighters.reduce((s, f) => s + effAtk(f), 0) * 0.8 : effAtk(actor);
      const def = effDef(target) * (1 - (skill.pierce ?? 0));
      let dmg = atk * skill.power * step.hitFrac * mitigation(def) * this.rng.range(0.94, 1.06);
      if (this.rng.next() < CRIT_CHANCE && !hostile) { dmg *= CRIT_MULT; res.crit = true; }
      if (hostile) {
        dmg *= GUARD_MULT[guard];
        if (target.defending) dmg *= DEFEND_MULT;
      }
      if (hasStatus(target, 'counter') && skill.element === 'phys') {
        const reflect = Math.max(1, Math.round(dmg * statusPower(target, 'counter') * 1.25));
        dmg *= 0.3;
        res.countered = reflect;
        actor.hp = Math.max(0, actor.hp - reflect);
        if (actor.hp === 0) { actor.alive = false; actor.statuses = []; }
        res.actorHp = actor.hp;
        this.say(`${target.name} counters! ${actor.name} takes ${reflect}.`, 'bad');
      }
      dmg = Math.max(1, Math.round(dmg));
      target.hp = Math.max(0, target.hp - dmg);
      res.damage = dmg;
      if (hasStatus(target, 'charging')) target.chargeDmg += dmg;
      // Rage
      this.gainRage(actor, rageDealt(actor, skill.rageGain / skill.hits.length, res.crit, target.boss));
      this.gainRage(target, rageTaken(target, dmg, skill.hits.length, guard));
      if (target.hp === 0) { res.killed = true; this.kill(target); }
      if (skill.status && !res.killed && this.rng.next() < skill.status.chance && step.last) {
        this.addStatus(target, { kind: skill.status.kind, turns: skill.status.turns, power: skill.status.power, source: actor.uid });
        res.statusApplied = skill.status.kind;
      }
    }
    res.targetHp = target.hp;
    return res;
  }

  private kill(f: Fighter) {
    f.alive = false; f.statuses = []; f.chargedMove = undefined; f.chargeLeft = undefined; f.rage = 0;
    this.say(`${f.name} is defeated!`, f.side === 'enemy' ? 'good' : 'bad');
    // Frozen allies thaw when the caster falls.
    this.fighters.forEach((o) => { o.statuses = o.statuses.filter((s) => !(s.source === f.uid && (s.kind === 'frozen' || s.kind === 'possessed'))); });
  }

  heal(f: Fighter, amount: number): number {
    const before = f.hp;
    f.hp = Math.min(f.stats.hp, f.hp + amount);
    return f.hp - before;
  }
  /** Rage earned by each fighter during the current action (capped by RAGE.PER_ACTION_CAP). */
  private actionRage = new Map<string, number>();
  gainRage(f: Fighter, amount: number) {
    if (f.side !== 'ally' || !f.alive || amount <= 0) return;
    const gain = amount * f.rageGainMult, got = this.actionRage.get(f.uid) ?? 0;
    const add = Math.min(gain, Math.max(0, RAGE.PER_ACTION_CAP - got));
    this.actionRage.set(f.uid, got + add);
    f.rage = Math.min(RAGE_FULL, f.rage + add);
  }

  // ---------- ending an action ----------
  finishAction(plan: ActionPlan): EngineEvent[] {
    const events: EngineEvent[] = [];
    const actor = this.get(plan.actorId);
    if (plan.skillId === 'flee') {
      if (this.rng.next() < 0.6) { this.outcome = 'fled'; events.push({ type: 'outcome', outcome: 'fled' }); this.finishTurn(actor); return events; }
      this.say('Could not escape!', 'bad');
    }
    // Charge interrupts
    for (const f of this.fighters) {
      if (f.alive && hasStatus(f, 'charging') && f.chargeDmg >= f.stats.hp * CHARGE_INTERRUPT_FRAC) {
        f.chargedMove = undefined; f.chargeLeft = undefined; f.chargeDmg = 0; this.removeStatus(f, 'charging');
        this.addStatus(f, { kind: 'stun', turns: 1 });
        const m = `${f.name}'s charge is interrupted!`;
        this.say(m, 'good'); events.push({ type: 'interrupt', uid: f.uid, message: m });
      }
    }
    // Enemy phase triggers
    for (const f of this.enemies()) {
      const def = ENEMIES[f.defId];
      const ph = def?.phases?.[f.phaseIdx];
      if (ph && f.hp / f.stats.hp <= ph.atHpFrac) this.applyPhase(f, events);
    }
    this.finishTurn(actor);
    const o = this.checkOutcome();
    if (o !== 'ongoing') events.push({ type: 'outcome', outcome: o });
    return events;
  }

  private applyPhase(f: Fighter, events: EngineEvent[]) {
    const def = ENEMIES[f.defId];
    const ph = def.phases![f.phaseIdx];
    f.phaseIdx++;
    if (ph.toForm) {
      const next = ENEMIES[ph.toForm];
      const frac = Math.min(1, f.hp / f.stats.hp + (ph.healFrac ?? 0));
      f.defId = next.id; f.form = next.id; f.sprite = next.sprite; f.name = next.name; f.heightPx = next.heightPx;
      f.stats = { ...next.stats };
      f.hp = Math.max(1, Math.round(next.stats.hp * frac));
      f.phaseIdx = 0; f.chargedMove = undefined; f.chargeLeft = undefined; this.removeStatus(f, 'charging');
    }
    if (ph.addStatus) this.addStatus(f, { ...ph.addStatus });
    this.say(ph.message, 'warn');
    events.push({ type: 'phase', uid: f.uid, toForm: ph.toForm, message: ph.message });
  }

  checkOutcome(): BattleOutcome {
    if (this.outcome !== 'ongoing') return this.outcome;
    const se = this.rules.scriptedEnd;
    if (se) {
      const boss = this.enemies(false).find((e) => e.defId === se.defId);
      if (boss && boss.hp / boss.stats.hp <= se.hpFrac) { this.scriptedWin = true; return (this.outcome = 'victory'); }
    }
    if (this.enemies().length === 0) return (this.outcome = 'victory');
    const sr = this.rules.surviveRounds;
    if (sr && this.round >= sr && this.queue.length === 0 && this.currentUid === null && this.allies().some((a) => !hasStatus(a, 'possessed'))) { this.scriptedWin = true; return (this.outcome = 'victory'); }
    const live = this.allies().filter((a) => !hasStatus(a, 'possessed'));
    if (live.length === 0) return (this.outcome = 'defeat');
    return 'ongoing';
  }

  // ---------- enemy / possessed AI ----------
  aiCommand(actor: Fighter): Command {
    if (actor.side === 'ally') {
      // possessed hero: strongest affordable damaging skill, otherwise attack
      const foes = this.allies().filter((a) => !hasStatus(a, 'possessed') && a.uid !== actor.uid);
      const target = foes.length ? this.rng.pick(foes) : actor;
      return { kind: 'attack', target: target.uid };
    }
    if (actor.chargedMove && (actor.chargeLeft ?? 0) === 0) return { kind: 'skill', skill: actor.chargedMove };
    const def = ENEMIES[actor.defId];
    const foes = this.opponentsOf(actor);
    const cond = (w: NonNullable<typeof def.moves[number]['when']> | undefined) => {
      switch (w) {
        case 'bothAlive': return this.enemies().some((e) => e.defId === 'burter') && this.enemies().some((e) => e.defId === 'jeice');
        case 'hpBelowHalf': return actor.hp / actor.stats.hp < 0.5;
        case 'noCounter': return !hasStatus(actor, 'counter');
        case 'afterCharge': return actor.turnsTaken > 0;
        case 'partyRageHigh': return foes.some((f) => f.rage >= 80);
        default: return true;
      }
    };
    if (def.pattern?.kind === 'cycle') {
      const m = def.pattern.moves[actor.turnsTaken % def.pattern.moves.length];
      return { kind: 'skill', skill: m };
    }
    const options = def.moves.filter((m) => cond(m.when));
    const pool = options.length ? options : def.moves;
    // Do not re-charge while already charging; avoid immediate repeats of status moves.
    const pick = this.rng.weighted(pool, (m) => m.weight);
    return { kind: 'skill', skill: pick.skill };
  }
}
