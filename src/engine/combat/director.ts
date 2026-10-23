import type { ActionPlan, BattleOutcome, Command, Fighter, GuardGrade, HitResult, HitStep } from '../../types';
import { BattleEngine, isError, type EngineEvent } from './engine';
import { GuardTracker } from './guard';
import { SKILLS } from '../../data/skills';
import { getClip } from '../animation/clips';
import type { ClipOp, MoveTo, Pose } from '../animation/clips';
import { ClipRunner } from '../animation/timeline';

/** Everything the renderer must be able to do. Implemented by the Phaser BattleScene (and a fake in tests). */
export interface Stage {
  setPose(uid: string, pose: Pose): void;
  move(uid: string, to: MoveTo, targetUid: string | undefined, dur: number): void;
  projectile(uid: string, vfx: string, targetUid: string, dur: number, opts: { from?: 'hand' | 'sky' | 'body'; scale?: number; arc?: boolean }): void;
  chargeVfx(uid: string, vfx: string, dur: number, opts: { from?: 'hand' | 'sky' | 'body'; scale?: number }): void;
  contact(targetUid: string, vfx: string, last: boolean): void;
  react(targetUid: string, result: HitResult): void;
  ko(uid: string): void;
  aura(uid: string, on: boolean, color: string): void;
  sfx(id: string): void;
  shake(amp: number, dur: number): void;
  flash(color: number, dur: number, alpha: number): void;
  zoom(to: number, dur: number): void;
  darken(on: boolean): void;
  banner(text: string): void;
  floatText(uid: string, text: string, tone: 'good' | 'bad' | 'warn' | 'info'): void;
  transform(uid: string, toSprite: string, name: string): void;
  resetPositions(): void;
  victory(uid: string): void;
  guardCue(uid: string, on: boolean): void;
  focus(uids: string[]): void;
}

export interface DirectorOptions {
  guard: GuardTracker;
  speed?: number;          // player-action speed multiplier (enemy actions always run at 1x for guard fairness)
  hitStop?: boolean;
}
export interface DirectorCallbacks {
  onChange(): void;
  onInput(actor: Fighter): void;
  onOutcome(outcome: BattleOutcome, scripted: boolean): void;
  onResult?(r: HitResult): void;
  onBanner?(text: string): void;
}

type State = 'start' | 'gap' | 'await-input' | 'think' | 'acting' | 'finishing' | 'phase' | 'ended';
interface Pending { step: HitStep; plan: ActionPlan; resolveAt: number; chainFirst: boolean; guarded: boolean }

export interface GuardCueInfo { uid: string; impactAt: number; startAt: number }

const SECOND_TURN_GAP = 260;

export class BattleDirector {
  state: State = 'start';
  time = 0;                 // battle clock (ms), unaffected by animation speed, frozen while paused
  paused = false;
  private timer = 0;        // time at which the current gap/think state ends
  private current: Fighter | null = null;
  private plan: ActionPlan | null = null;
  private runner: ClipRunner | null = null;
  private pending: Pending[] = [];
  private committedSteps = new Set<string>();
  private chainGrade = new Map<string, GuardGrade>();
  private lastMarkerAt = new Map<string, number>();
  private cues: GuardCueInfo[] = [];
  private afterEvents: EngineEvent[] = [];
  private phaseUntil = 0;
  outcome: BattleOutcome = 'ongoing';
  scriptedEnd = false;
  lastError = '';
  speed: number;

  constructor(readonly engine: BattleEngine, private stage: Stage, private cb: DirectorCallbacks, private opts: DirectorOptions) {
    this.speed = opts.speed ?? 1;
  }

  get guard() { return this.opts.guard; }
  get activeCues(): readonly GuardCueInfo[] { return this.cues; }
  get currentActor(): Fighter | null { return this.current; }
  get currentPlan(): ActionPlan | null { return this.plan; }
  get isPlayerInput() { return this.state === 'await-input'; }

  start() { this.state = 'gap'; this.timer = this.time + 500; this.cb.onChange(); }

  /** Stop everything: cancels timelines and pending hits so nothing can apply later. */
  dispose() {
    this.runner?.cancel(); this.runner = null; this.pending = []; this.cues = []; this.state = 'ended';
    this.stage.darken(false); this.stage.zoom(1, 0);
  }

  // ---------- input ----------
  submit(cmd: Command): { ok: true } | { ok: false; error: string } {
    if (this.paused) return { ok: false, error: 'Paused' };
    if (this.state !== 'await-input' || !this.current) return { ok: false, error: 'Not accepting commands' };
    const plan = this.engine.plan(cmd, this.current.uid);
    if (isError(plan)) { this.lastError = plan.error; return { ok: false, error: plan.error }; }
    this.beginPlan(plan);
    return { ok: true };
  }

  pressGuard(uid: string) {
    if (this.paused || this.state === 'ended') return false;
    return this.opts.guard.press(uid, this.time);
  }
  /** Accessibility: one press guards every currently-cued defender. */
  pressGuardAll() {
    let any = false;
    for (const c of this.cues) any = this.pressGuard(c.uid) || any;
    return any;
  }

  // ---------- main loop ----------
  update(dtMs: number) {
    if (this.paused || this.state === 'ended') return;
    const dt = Math.min(dtMs, 100); // never let one long frame skip markers wholesale
    this.time += dt;
    switch (this.state) {
      case 'start': break;
      case 'gap': if (this.time >= this.timer) this.advance(); break;
      case 'think': if (this.time >= this.timer) this.performAi(); break;
      case 'await-input': break;
      case 'phase': if (this.time >= this.phaseUntil) this.afterPhase(); break;
      case 'acting': this.updateActing(dt); break;
      case 'finishing': if (this.time >= this.timer) this.finishAction(); break;
    }
    this.processPending();
  }

  private advance() {
    const t = this.engine.nextTurn();
    if (t.kind === 'end') return this.end(t.outcome);
    this.current = t.actor;
    this.cb.onChange();
    if (t.kind === 'skip') {
      this.stage.floatText(t.actor.uid, t.reason === 'charging' ? 'CHARGING...' : t.reason === 'frozen' ? 'FROZEN' : 'STUNNED', 'warn');
      this.state = 'gap'; this.timer = this.time + 750; return;
    }
    if (t.kind === 'input') { this.state = 'await-input'; this.cb.onInput(t.actor); return; }
    this.state = 'think'; this.timer = this.time + 420;
  }

  private performAi() {
    const actor = this.current!;
    const cmd = this.engine.aiCommand(actor);
    let plan = this.engine.plan(cmd, actor.uid);
    if (isError(plan)) {
      // Never stall: fall back to a plain attack/defend.
      plan = this.engine.plan({ kind: 'attack', target: this.engine.opponentsOf(actor)[0]?.uid ?? actor.uid }, actor.uid);
      if (isError(plan)) plan = this.engine.plan({ kind: 'defend' }, actor.uid);
    }
    if (isError(plan)) { this.engine.finishAction({ id: -1, actorId: actor.uid, skillId: 'defend', targetIds: [], steps: [], guardTargets: [] }); this.state = 'gap'; this.timer = this.time + 200; return; }
    this.beginPlan(plan);
  }

  private clipFor(plan: ActionPlan) {
    if (plan.charging) return getClip('e_charge');
    if (['defend', 'sparking', 'flee', 'item'].includes(plan.skillId)) return getClip(plan.skillId);
    return getClip(SKILLS[plan.skillId].clip);
  }

  private speedFor(plan: ActionPlan) {
    const actor = this.engine.get(plan.actorId);
    return this.engine.isHostileToParty(actor) ? 1 : this.speed;
  }

  private beginPlan(plan: ActionPlan) {
    this.engine.begin(plan);
    this.plan = plan;
    this.committedSteps.clear(); this.chainGrade.clear(); this.lastMarkerAt.clear();
    const clip = this.clipFor(plan);
    const skill = SKILLS[plan.skillId];
    const actor = this.engine.get(plan.actorId);
    if (skill && !plan.skillId.startsWith('atk_') && (this.engine.isHostileToParty(actor) || skill.rageArt || plan.comboId)) {
      const name = plan.comboId ? skill.name : skill.name;
      this.stage.banner(name); this.cb.onBanner?.(name);
    }
    this.runner = new ClipRunner(clip, {
      op: (op) => this.playOp(op, plan),
      marker: (hit) => this.onMarker(hit, plan),
    });
    // Guard cues: shown ahead of each guardable chain's first hit.
    this.cues = [];
    if (plan.guardTargets.length) {
      const sp = this.speedFor(plan);
      const first = Math.min(...clip.hitTimes.filter((x) => x !== undefined));
      const cueLead = 520;
      for (const uid of plan.guardTargets) {
        const impactAt = this.time + first / sp;
        this.cues.push({ uid, impactAt, startAt: impactAt - cueLead });
      }
    }
    this.stage.focus([plan.actorId, ...plan.targetIds]);
    this.state = 'acting';
    this.cb.onChange();
  }

  private participantUid(plan: ActionPlan, by = 0): string {
    const p = this.engine.participantsOf(plan.id);
    return p.length ? (p[by] ?? plan.actorId) : plan.actorId;
  }

  private playOp(op: ClipOp, plan: ActionPlan) {
    const who = this.participantUid(plan, op.by);
    const firstTarget = plan.targetIds[0];
    const s = this.stage;
    switch (op.op) {
      case 'pose': s.setPose(who, op.pose); break;
      case 'move': s.move(who, op.to, firstTarget, op.dur / this.speedFor(plan)); break;
      case 'proj': plan.targetIds.forEach((t) => s.projectile(who, this.beamVariant(who, op.vfx), t, op.dur / this.speedFor(plan), { from: op.from, scale: op.scale, arc: op.arc })); break;
      case 'charge': s.chargeVfx(who, this.beamVariant(who, op.vfx), op.dur / this.speedFor(plan), { from: op.from, scale: op.scale }); break;
      case 'aura': s.aura(who, op.on, op.color ?? 'gold'); break;
      case 'sfx': s.sfx(op.id); break;
      case 'shake': s.shake(op.amp, op.dur); break;
      case 'flash': s.flash(op.color, op.dur, op.alpha ?? 0.5); break;
      case 'zoom': s.zoom(op.to, op.dur); break;
      case 'darken': s.darken(op.on); break;
      case 'banner': if (op.text) s.banner(op.text); break;
      case 'hit': break; // handled as marker
    }
  }

  /** Kaioken turns Goku's blue Kamehameha red. Nothing else changes colour. */
  private beamVariant(uid: string, vfx: string): string {
    return vfx === 'kame' && this.engine.get(uid).statuses.some((x) => x.kind === 'kaioken') ? 'red' : vfx;
  }

  private onMarker(hit: number, plan: ActionPlan) {
    const steps = plan.steps.filter((x) => x.index === hit);
    const op = this.runner?.clip.ops.find((o) => o.op === 'hit' && o.hit === hit) as Extract<ClipOp, { op: 'hit' }> | undefined;
    for (const step of steps) {
      const guarded = plan.guardTargets.includes(step.targetId);
      const key = `${step.targetId}`;
      const prevAt = this.lastMarkerAt.get(key);
      const inChain = prevAt !== undefined && this.time - prevAt < 330;
      this.lastMarkerAt.set(key, this.time);
      // Contact plays at the marker; the outcome resolves later for guarded hits. Preplanned misses must not sound or look like impacts.
      if (!this.engine.willMiss(plan, step)) {
        if (op && !op.quiet && op.vfx) this.stage.contact(step.targetId, op.vfx, step.last);
        else if (!op) this.stage.contact(step.targetId, 'impact', step.last);
      }
      const resolveAt = guarded && !inChain ? this.time + this.opts.guard.lateMs : this.time;
      this.pending.push({ step, plan, resolveAt, chainFirst: !inChain, guarded });
    }
  }

  private processPending() {
    if (!this.pending.length) return;
    this.pending.sort((a, b) => a.resolveAt - b.resolveAt);
    // keep order: a later hit in a chain cannot resolve before the first hit has
    while (this.pending.length && this.pending[0].resolveAt <= this.time) {
      const p = this.pending.shift()!;
      this.resolve(p);
    }
  }

  private resolve(p: Pending) {
    const key = `${p.plan.id}:${p.step.index}:${p.step.targetId}`;
    if (this.committedSteps.has(key)) return;
    this.committedSteps.add(key);
    let grade: GuardGrade = 'none';
    if (p.guarded) {
      if (p.chainFirst) {
        grade = this.opts.guard.grade(p.step.targetId, p.resolveAt - this.opts.guard.lateMs);
        this.chainGrade.set(p.step.targetId, grade);
      } else {
        const first = this.chainGrade.get(p.step.targetId) ?? 'none';
        grade = first === 'perfect' ? 'good' : first;
      }
    }
    const result = this.engine.commit(p.plan, p.step, grade);
    this.stage.react(p.step.targetId, result);
    if (result.killed) this.stage.ko(p.step.targetId);
    if (result.countered > 0) this.stage.floatText(p.step.actorId, String(result.countered), 'bad');
    this.cb.onResult?.(result);
    this.cb.onChange();
  }

  private updateActing(dt: number) {
    const plan = this.plan!;
    this.runner!.update(dt * this.speedFor(plan));
    if (this.runner!.done && this.pending.length === 0) {
      this.state = 'finishing';
      this.timer = this.time + SECOND_TURN_GAP;
    }
  }

  private finishAction() {
    const plan = this.plan!;
    // Safety net: commit any step whose marker never fired (never leave an action half-resolved).
    for (const s of plan.steps) {
      const key = `${plan.id}:${s.index}:${s.targetId}`;
      if (!this.committedSteps.has(key)) this.resolve({ step: s, plan, resolveAt: this.time, chainFirst: true, guarded: false });
    }
    this.cues.forEach((c) => this.stage.guardCue(c.uid, false));
    this.cues = [];
    this.opts.guard.clear();
    const events = this.engine.finishAction(plan);
    this.stage.resetPositions();
    this.runner = null; this.plan = null;
    this.cb.onChange();
    this.afterEvents = events;
    const phase = events.find((e) => e.type === 'phase') as Extract<EngineEvent, { type: 'phase' }> | undefined;
    for (const e of events) if (e.type === 'interrupt') this.stage.floatText(e.uid, 'INTERRUPTED!', 'good');
    if (phase) {
      const f = this.engine.get(phase.uid);
      this.stage.transform(phase.uid, f.sprite, f.name);
      this.stage.flash(0xffffff, 500, 0.7); this.stage.shake(6, 500);
      this.stage.banner(phase.message);
      this.state = 'phase'; this.phaseUntil = this.time + 1500; this.cb.onChange();
      return;
    }
    this.afterPhase();
  }

  private afterPhase() {
    const out = events2outcome(this.afterEvents) ?? this.engine.checkOutcome();
    if (out !== 'ongoing') return this.end(out);
    this.state = 'gap'; this.timer = this.time + 220;
  }

  private end(outcome: BattleOutcome) {
    this.outcome = outcome;
    this.scriptedEnd = this.engine.scriptedWin;
    this.state = 'ended';
    this.stage.darken(false);
    if (outcome === 'victory') this.engine.allies().forEach((a) => this.stage.victory(a.uid));
    this.cb.onChange();
    this.cb.onOutcome(outcome, this.engine.scriptedWin);
  }

  /** Fast-forward helper for tests and "skip animation" setting: plays the whole plan instantly in order. */
  flushPlan() {
    if (this.state !== 'acting' || !this.runner) return;
    this.runner.flush();
    this.time += this.opts.guard.lateMs + 1;
    this.processPending();
    this.state = 'finishing'; this.timer = this.time;
    this.finishAction();
  }
}

function events2outcome(events: EngineEvent[]): BattleOutcome | null {
  const o = events.find((e) => e.type === 'outcome') as Extract<EngineEvent, { type: 'outcome' }> | undefined;
  return o ? o.outcome : null;
}
