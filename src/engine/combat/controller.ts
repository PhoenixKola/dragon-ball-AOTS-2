import type { BattleOutcome, Command, Fighter, SkillDef } from '../../types';
import { BattleEngine, type BattleSetup } from './engine';
import { BattleDirector, type Stage } from './director';
import { GUARD_PRESETS, GuardTracker } from './guard';
import { SKILLS } from '../../data/skills';
import { ITEMS } from '../../data/heroes';
import { comboById } from '../../data/combos';
import { choose as chooseCommand } from './autoplay';
import { getSettings } from '../../systems/settings';
import { audio } from '../audio/audio';
import { hasStatus, kiCost, RAGE_FULL } from './formulas';
import type { StageKind } from '../scenes/stageBackgrounds';

export interface MenuItem { id: string; label: string; sub?: string; cost?: number; disabled?: string; icon?: string; desc?: string; accent?: boolean }
export type MenuState =
  | { kind: 'none' }
  | { kind: 'root' | 'skills' | 'items' | 'combos'; cursor: number }
  | { kind: 'target'; label: string; candidates: string[]; index: number; build: (uid: string | undefined) => Command; from: 'root' | 'skills' | 'items' | 'combos'; fromCursor: number };

export interface BattleOptions {
  stageKind: StageKind;
  theme?: 'battle' | 'boss' | 'frieza' | 'ginyu' | 'final' | 'cooler';
  intro?: string;
  title?: string;
  tutorial?: boolean;
  onFinish: (outcome: BattleOutcome, scripted: boolean, engine: BattleEngine) => void;
}

const ROOT_ORDER = ['attack', 'skills', 'items', 'defend', 'rage', 'sparking', 'combo', 'flee'] as const;

export class BattleController {
  readonly engine: BattleEngine;
  director!: BattleDirector;
  readonly guard: GuardTracker;
  menu: MenuState = { kind: 'none' };
  finished = false;
  resultReady = false;
  paused = false;
  banner = '';
  bannerUntil = 0;
  private listeners = new Set<() => void>();
  private resultTimer = -1;
  private lastTarget = new Map<string, string>();
  private version = 0;
  introShown = false;

  constructor(setup: BattleSetup, readonly opts: BattleOptions) {
    this.engine = new BattleEngine(setup);
    this.guard = new GuardTracker(GUARD_PRESETS[getSettings().guardPreset]);
  }

  // ---------- wiring ----------
  attachStage(stage: Stage) {
    this.director = new BattleDirector(this.engine, stage, {
      onChange: () => this.emit(),
      onInput: (a) => { this.openRoot(a); },
      onOutcome: (o, s) => { this.menu = { kind: 'none' }; this.resultTimer = 1800; this.pendingOutcome = [o, s]; this.emit(); },
      onBanner: (t) => { this.banner = t; this.bannerUntil = 1400; },
    }, { guard: this.guard, speed: getSettings().battleSpeed });
    this.director.start();
  }
  private pendingOutcome: [BattleOutcome, boolean] | null = null;

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  emit() { this.version++; this.listeners.forEach((l) => l()); }
  get snapshotVersion() { return this.version; }

  /** Called every frame by the scene with real elapsed ms. Pausing stops the battle clock completely. */
  tick(dtMs: number) {
    if (!this.director) return;
    this.director.paused = this.paused;
    if (this.paused) return;
    this.director.speed = getSettings().battleSpeed;
    this.guard.settings = GUARD_PRESETS[getSettings().guardPreset];
    this.director.update(dtMs);
    if (this.bannerUntil > 0) { this.bannerUntil -= dtMs; if (this.bannerUntil <= 0) { this.banner = ''; this.emit(); } }
    if (this.resultTimer > 0) {
      this.resultTimer -= dtMs;
      if (this.resultTimer <= 0 && this.pendingOutcome && !this.finished) {
        this.finished = true; this.resultReady = true; this.emit();
        this.opts.onFinish(this.pendingOutcome[0], this.pendingOutcome[1], this.engine);
      }
    }
  }
  setPaused(p: boolean) { if (this.paused !== p) { this.paused = p; if (this.director) this.director.paused = p; this.emit(); } }
  dispose() { this.director?.dispose(); this.listeners.clear(); this.finished = true; }

  // ---------- derived data for UI ----------
  get actor(): Fighter | null { return this.director?.isPlayerInput ? this.director.currentActor : null; }
  get awaitingInput() { return !!this.actor && this.menu.kind !== 'none'; }

  skillRows(a: Fighter): MenuItem[] {
    return a.skills.filter((id) => !SKILLS[id].rageArt).map((id) => {
      const s = SKILLS[id];
      const cost = kiCost(a, s.cost);
      const inForm = hasStatus(a, 'ssjform');
      const disabled = s.ssjOnly && !inForm ? 'Needs Super Saiyan' : s.status?.kind === 'ssjform' && inForm ? 'Already Super Saiyan' : hasStatus(a, 'seal') && s.cost > 0 ? 'Sealed' : a.ki < cost ? 'Not enough Ki' : undefined;
      return { id, label: s.name, cost, sub: describeSkill(s), desc: s.desc, disabled, icon: `skill:${id}`, accent: s.status?.kind === 'ssjform' && !disabled };
    });
  }
  rageArtRow(a: Fighter): MenuItem | null {
    const id = a.skills.find((k) => SKILLS[k].rageArt);
    if (!id) return null;
    const s = SKILLS[id];
    return { id, label: s.name, sub: describeSkill(s), desc: s.desc, icon: `skill:${id}`, accent: true, disabled: a.rage < RAGE_FULL ? `Rage ${Math.floor(a.rage)}/100` : undefined };
  }
  itemRows(): MenuItem[] {
    return Object.entries(this.engine.inventory).filter(([id, n]) => n > 0 && ITEMS[id] && !ITEMS[id].capsule).map(([id, n]) => ({ id, label: ITEMS[id].name, sub: `x${n}`, desc: ITEMS[id].desc, icon: `item:${id}` }));
  }
  comboRows(a: Fighter): MenuItem[] {
    return this.engine.availableCombos(a).map((c) => {
      const r = comboById(c.id)!;
      return { id: c.id, label: r.name, sub: r.members.map((m) => m[0].toUpperCase() + m.slice(1)).join(' + '), desc: SKILLS[r.skill].desc, disabled: c.ok ? undefined : c.reason, icon: `skill:${r.skill}`, accent: c.ok };
    });
  }
  rootRows(a: Fighter): MenuItem[] {
    const rows: MenuItem[] = [];
    const items = this.itemRows(), skills = this.skillRows(a), combos = this.comboRows(a);
    const rage = this.rageArtRow(a);
    for (const k of ROOT_ORDER) {
      if (k === 'attack') rows.push({ id: 'attack', label: 'Attack', sub: '+Ki', icon: `skill:atk_${a.defId}` });
      if (k === 'skills') rows.push({ id: 'skills', label: 'Skills', disabled: skills.length ? undefined : 'None learned', icon: 'cmd:skills' });
      if (k === 'items') rows.push({ id: 'items', label: 'Items', disabled: items.length ? undefined : 'No items', icon: 'item:senzu' });
      if (k === 'defend') rows.push({ id: 'defend', label: 'Defend', sub: '+Ki', icon: 'cmd:defend' });
      if (k === 'rage' && rage) rows.push({ id: 'rage', label: 'Rage Art', sub: rage.disabled ? undefined : 'READY', desc: `${rage.label}: ${rage.desc ?? ''} Costs all 100 Rage.`, disabled: rage.disabled, icon: rage.icon, accent: !rage.disabled });
      if (k === 'sparking') rows.push({ id: 'sparking', label: 'Sparking', sub: a.rage >= RAGE_FULL ? 'READY' : undefined, desc: 'Spend 100 Rage · 4 turns · +25% ATK · half Ki cost.', disabled: a.rage >= RAGE_FULL ? (hasStatus(a, 'sparking') ? 'Already active' : undefined) : `Rage ${Math.floor(a.rage)}/100`, icon: 'cmd:sparking', accent: a.rage >= RAGE_FULL });
      if (k === 'combo' && combos.length) rows.push({ id: 'combo', label: 'Combo', sub: `${combos.filter((c) => !c.disabled).length} OK`, disabled: combos.some((c) => !c.disabled) ? undefined : 'Not ready', icon: combos[0]?.icon ?? 'legacy:combo', accent: combos.some((c) => !c.disabled) });
      if (k === 'flee' && this.engine.rules.allowFlee) rows.push({ id: 'flee', label: 'Flee', icon: 'cmd:flee' });
    }
    return rows;
  }
  currentRows(): MenuItem[] {
    const a = this.actor; const m = this.menu;
    if (!a) return [];
    if (m.kind === 'root') return this.rootRows(a);
    if (m.kind === 'skills') return this.skillRows(a);
    if (m.kind === 'items') return this.itemRows();
    if (m.kind === 'combos') return this.comboRows(a);
    return [];
  }
  get targetUids(): string[] { return this.menu.kind === 'target' ? [this.menu.candidates[this.menu.index]] : []; }
  get targetLabel(): string { return this.menu.kind === 'target' ? this.menu.label : ''; }

  // ---------- navigation ----------
  openRoot(a: Fighter) {
    this.menu = { kind: 'root', cursor: 0 };
    void a; this.emit();
  }
  nav(key: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') {
    const m = this.menu;
    if (m.kind === 'none' || !this.actor) return;
    if (m.kind === 'target') {
      if (key === 'left' || key === 'up') this.moveTarget(-1);
      else if (key === 'right' || key === 'down') this.moveTarget(1);
      else if (key === 'ok') this.confirmTarget();
      else if (key === 'back') this.back();
      return;
    }
    const rows = this.currentRows();
    if (key === 'up' || key === 'down') {
      const step = key === 'down' ? 1 : -1; let c = m.cursor;
      c = (c + step + rows.length) % rows.length;
      this.menu = { ...m, cursor: c }; audio.sfx('select'); this.emit();
    } else if (key === 'ok') this.activate(m.cursor);
    else if (key === 'back') this.back();
  }
  activate(index: number) {
    const m = this.menu; const a = this.actor;
    if (m.kind === 'none' || m.kind === 'target' || !a) return;
    const rows = this.currentRows(); const row = rows[index];
    if (!row) return;
    if (row.disabled) { audio.sfx('error'); this.flashHint(row.disabled); return; }
    audio.sfx('confirm');
    if (m.kind === 'root') {
      switch (row.id) {
        case 'attack': return this.chooseTarget('Attack', 'enemy', (t) => ({ kind: 'attack', target: t! }), 'root', index);
        case 'skills': this.menu = { kind: 'skills', cursor: 0 }; return this.emit();
        case 'items': this.menu = { kind: 'items', cursor: 0 }; return this.emit();
        case 'combo': this.menu = { kind: 'combos', cursor: Math.max(0, this.comboRows(a).findIndex((c) => !c.disabled)) }; return this.emit();
        case 'defend': return this.submit({ kind: 'defend' });
        case 'sparking': return this.submit({ kind: 'sparking' });
        case 'flee': return this.submit({ kind: 'flee' });
        case 'rage': { const r = this.rageArtRow(a)!; return this.pickSkill(r.id, 'root', index); }
      }
    } else if (m.kind === 'skills') this.pickSkill(row.id, 'skills', index);
    else if (m.kind === 'items') {
      const it = ITEMS[row.id];
      const downed = this.engine.allies(false).filter((f) => !f.alive).map((f) => f.uid);
      const living = this.engine.allies().map((f) => f.uid);
      this.menu = { kind: 'target', label: it.name, candidates: it.revive && downed.length && !living.length ? downed : [...living, ...(it.revive ? downed : [])], index: 0, build: (t) => ({ kind: 'item', item: row.id, target: t! }), from: 'items', fromCursor: index };
      if (this.menu.kind === 'target') { const firstNeedy = this.menu.candidates.findIndex((u) => { const f = this.engine.get(u); return !f.alive || f.hp < f.stats.hp; }); this.menu.index = Math.max(0, firstNeedy); }
      this.emit();
    } else if (m.kind === 'combos') {
      const r = comboById(row.id)!;
      this.chooseTarget(r.name, SKILLS[r.skill].target, (t) => ({ kind: 'combo', combo: row.id, target: t }), 'combos', index);
    }
  }
  private pickSkill(id: string, from: 'root' | 'skills', cursor: number) {
    const s = SKILLS[id];
    this.chooseTarget(s.name, s.target, (t) => ({ kind: 'skill', skill: id, target: t }), from, cursor);
  }
  private chooseTarget(label: string, mode: SkillDef['target'], build: (t: string | undefined) => Command, from: 'root' | 'skills' | 'items' | 'combos', fromCursor: number) {
    const a = this.actor!;
    if (mode === 'allEnemies' || mode === 'allAllies' || mode === 'self') return this.submit(build(undefined));
    const cands = mode === 'enemy' ? this.engine.enemies().map((f) => f.uid)
      : mode === 'ally' ? this.engine.allies().map((f) => f.uid)
      : this.engine.allies(false).filter((f) => !f.alive).map((f) => f.uid);
    if (!cands.length) { audio.sfx('error'); this.flashHint('No valid targets'); return; }
    let index = Math.max(0, cands.indexOf(this.lastTarget.get(a.uid) ?? ''));
    if (mode === 'ally') { const needy = cands.findIndex((u) => this.engine.get(u).hp < this.engine.get(u).stats.hp); if (needy >= 0) index = needy; }
    if (cands.length === 1 && mode === 'enemy') return this.submit(build(cands[0]));
    this.menu = { kind: 'target', label, candidates: cands, index, build, from, fromCursor };
    this.emit();
  }
  moveTarget(d: number) {
    const m = this.menu; if (m.kind !== 'target') return;
    this.menu = { ...m, index: (m.index + d + m.candidates.length) % m.candidates.length };
    audio.sfx('select'); this.emit();
  }
  confirmTarget() {
    const m = this.menu; if (m.kind !== 'target') return;
    const t = m.candidates[m.index];
    if (this.actor) this.lastTarget.set(this.actor.uid, t);
    this.submit(m.build(t));
  }
  hoverTarget(uid: string) {
    const m = this.menu; if (m.kind !== 'target') return;
    const i = m.candidates.indexOf(uid); if (i >= 0 && i !== m.index) { this.menu = { ...m, index: i }; this.emit(); }
  }
  back() {
    const m = this.menu;
    if (m.kind === 'target') { this.menu = { kind: m.from, cursor: m.fromCursor }; audio.sfx('cancel'); this.emit(); }
    else if (m.kind === 'skills' || m.kind === 'items' || m.kind === 'combos') { this.menu = { kind: 'root', cursor: 0 }; audio.sfx('cancel'); this.emit(); }
  }
  /** Test hook: what the simulator's competent-player model would do for the current actor (the browser bot then presses the real keys for it). */
  debugSuggestCommand(): Command | null { return this.actor ? chooseCommand(this.engine, this.actor) : null; }
  hint = ''; private hintUntil = 0;
  flashHint(t: string) { this.hint = t; this.hintUntil = Date.now() + 1400; this.emit(); setTimeout(() => { if (Date.now() >= this.hintUntil) { this.hint = ''; this.emit(); } }, 1450); }

  submit(cmd: Command) {
    const r = this.director.submit(cmd);
    if (!r.ok) { audio.sfx('error'); this.flashHint(r.error); return; }
    this.menu = { kind: 'none' }; this.emit();
  }

  // ---------- Active Guard ----------
  guardSlot(slot: number) {
    const f = this.engine.allies().find((a) => a.slot === slot);
    if (!f) return;
    this.director.pressGuard(f.uid);
  }
  guardAll() { this.director?.pressGuardAll(); }
  onActorClick(uid: string) {
    if (this.menu.kind === 'target') { this.hoverTarget(uid); if (this.menu.kind === 'target' && this.menu.candidates[this.menu.index] === uid) this.confirmTarget(); return; }
    if (this.director?.activeCues.some((c) => c.uid === uid)) this.director.pressGuard(uid);
  }
}

const STATUS_NAME: Record<string, string> = { stun: 'Stun', blind: 'Blind', seal: 'Seal', atkUp: 'ATK up', defUp: 'DEF up', atkDown: 'ATK down', defDown: 'DEF down', spdUp: 'SPD up', regen: 'Regen', frozen: 'Time-stop', kaioken: 'Kaioken' };
export function describeSkill(s: SkillDef): string {
  const parts: string[] = [];
  if (s.kind === 'damage') parts.push(`${s.hits.length > 1 ? s.hits.length + ' hits · ' : ''}PWR ${Math.round(s.power * 100)}`);
  if (s.kind === 'heal') parts.push(`Heal ${Math.round(s.power * 100)}%`);
  if (s.target === 'allEnemies') parts.push('All foes');
  if (s.pierce) parts.push(`Pierce ${Math.round(s.pierce * 100)}%`);
  if (s.hpCostFrac) parts.push(`Costs ${Math.round(s.hpCostFrac * 100)}% HP`);
  if (s.status) parts.push(`${STATUS_NAME[s.status.kind] ?? s.status.kind} ${s.status.turns}t${s.status.chance !== undefined && s.status.chance < 1 ? ` (${Math.round(s.status.chance * 100)}%)` : ''}`);
  return parts.join(' · ');
}
