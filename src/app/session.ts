import type { BattleOutcome, HeroId } from '../types';
import type { BattleSpec, Ent, Line, Step } from '../engine/world/mapTypes';
import { MAPS } from '../data/maps';
import { SCRIPTS } from '../data/scripts';
import { HEROES, ITEMS } from '../data/heroes';
import { condMet, newGameState, addItem, memberOf, type GameState } from '../systems/gameState';
import { buyItem as buyItemOp, equipCapsule, unequipCapsule, useItemOutside as useItemOutsideOp } from '../systems/inventoryOps';
import { buildBattleSides, restoreForRetry, snapshotBattle, writeBackBattle } from '../systems/battleSetup';
import { applyBattleRewards, applyStateStep, ballHint, EASY_XP_MULT, promptText, radarLines, type StepFx } from '../systems/storyRuntime';
import { canSummon, grantWish, type WishId, type WishResult } from '../systems/wishes';
import { STAR_NAMES } from '../systems/gameState';
import { HUB, isPostgame, preparePostgame, recordPostgameWin } from '../systems/postgame';
import { statsOf, type LevelUp, type PartyMember } from '../systems/party';
import { allSlots, AUTOSAVE_SLOT, importText, migrateLegacy, readSlot, writeSlot, exportText, type SlotMeta } from '../systems/save';
import { getSettings } from '../systems/settings';
import { BattleController } from '../engine/combat/controller';
import type { WorldContext } from '../engine/world/context';
import { host } from '../engine/host';
import { audio } from '../engine/audio/audio';
import { music } from '../engine/audio/music';
import type { WorldScene } from '../engine/scenes/WorldScene';
import { clearPressed } from '../systems/input';
import { activeSolids, freeSpot } from '../engine/world/collision';
import { TILE } from '../engine/world/mapTypes';
import { xpForLevel } from '../engine/combat/formulas';
import { heroOverworld } from '../engine/world/overworld';

export type Mode = 'boot' | 'title' | 'world' | 'battle' | 'cutscene' | 'credits';
export interface ResultData {
  outcome: BattleOutcome; scripted: boolean; title: string; exp: number; zeni: number; drops: Record<string, number>;
  levelUps: LevelUp[]; members: { id: HeroId; name: string; level: number; xp: number; next: number }[]; rounds: number;
}
export type Overlay =
  | null
  | { kind: 'dialogue'; lines: Line[]; idx: number; done: () => void }
  | { kind: 'results'; data: ResultData; done: () => void }
  | { kind: 'defeat'; choose: (c: 'retry' | 'load' | 'title') => void }
  | { kind: 'menu'; tab: string }
  | { kind: 'shop'; shop: string; done: () => void }
  | { kind: 'altar'; done: () => void }
  | { kind: 'cutscene'; id: string; done: () => void }
  | { kind: 'confirm'; text: string; yes: () => void; no: () => void; yesLabel?: string; noLabel?: string }
  | { kind: 'porunga'; done: () => void }
  | { kind: 'credits' }
  | { kind: 'pause' }
  | { kind: 'toast'; text: string };

type L = () => void;
/** Thrown by a cancelled `ask` step to end the running script cleanly (state stays exactly as it was). */
class StopScript extends Error {}

export const OBJECTIVES: { when: (s: GameState) => boolean; text: string }[] = [
  { when: (s) => !s.flags.scouts1, text: 'Follow the path east from the landing site.' },
  { when: (s) => !s.flags.dende_met, text: 'Reach Aojan Village, east along the shore.' },
  { when: (s) => !s.flags.vegeta_arrived, text: 'Leave the village east for the Frieza landing zone.' },
  { when: (s) => !s.flags.cui_done, text: 'Push through the landing zone. Cui lies ahead.' },
  { when: (s) => !s.flags.dodoria_done, text: 'Continue east: Dodoria holds the road.' },
  { when: (s) => !s.flags.ball2, text: 'Search the Crystal Grotto east of the camp for the second Dragon Ball.' },
  { when: (s) => !s.flags.zarbon_done, text: 'Return to Aojan Village. Zarbon is hunting you.' },
  { when: (s) => !s.flags.guru_done, text: 'Climb north to Guru’s Sanctuary.' },
  { when: (s) => !s.flags.guldo_done, text: 'Take the southern road from the village to the Highlands.' },
  { when: (s) => !s.flags.recoome_done, text: 'Advance across the Highlands. Something enormous is ahead.' },
  { when: (s) => !s.flags.duo_done, text: 'Keep moving east: the Ginyu Force blocks the ridge.' },
  { when: (s) => !s.flags.ginyu_done, text: 'Face Captain Ginyu at the end of the ridge.' },
  { when: (s) => !s.flags.piccolo_joined, text: 'Return to Guru’s Sanctuary. Frieza is coming.' },
  { when: (s) => !s.flags.frieza3_done && s.flags.piccolo_joined && [1, 2, 3, 4, 5, 6].some((n) => !s.flags['ball' + n]), text: 'Confront Frieza at the landing zone. Optional: find the missing Dragon Balls first (see Journal); there is no way back once the fight starts.' },
  { when: (s) => !s.flags.frieza3_done, text: 'Confront Frieza at the landing zone.' },
  { when: (s) => !s.flags.krillin_dead, text: 'Stand your ground against Frieza.' },
  { when: (s) => !s.flags.final_done, text: 'Walk to the centre of what remains of Namek.' },
  { when: () => true, text: 'Escape Namek.' },
];
export const objectiveOf = (s: GameState) => (OBJECTIVES.find((o) => o.when(s)) ?? OBJECTIVES[OBJECTIVES.length - 1]).text;

const CHAPTER_NAMES = ['Prologue · The Voyage', 'Chapter 1 · Strangers on Namek', 'Chapter 2 · The Prince Returns', 'Chapter 3 · Secrets of the Eldest', 'Chapter 4 · The Ginyu Force', 'Chapter 5 · The Last Wish', 'Chapter 6 · The Tyrant of Namek', 'Final Chapter · The Legend Awakens'];
export const chapterName = (n: number) => CHAPTER_NAMES[Math.max(0, Math.min(7, n))];

function rngPick<T>(a: readonly T[], w: (t: T) => number): T { const tot = a.reduce((s, x) => s + w(x), 0); let r = Math.random() * tot; for (const x of a) { r -= w(x); if (r <= 0) return x; } return a[a.length - 1]; }
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class Session {
  state: GameState = newGameState();
  mode: Mode = 'boot';
  overlay: Overlay = null;
  fade = 0;                       // 0 clear .. 1 black
  mapTitle: { name: string; sub: string; until: number } | null = null;
  legacyNote = '';
  bootReport: { ok: boolean; missing: string[] } | null = null;
  battle: BattleController | null = null;
  battlePaused = false;
  private listeners = new Set<L>();
  private ver = 0;
  private stateVer = 0;
  private busy = 0;                // >0 while a script/battle owns the screen
  private run = 0;                 // cancellation token for scripts
  lastSaveSlot = AUTOSAVE_SLOT;

  constructor() {
    window.setInterval(() => { if ((this.mode === 'world' || this.mode === 'battle') && !this.battlePaused && !document.hidden) { this.state.playMs += 1000; } }, 1000);
  }

  // ---------------- subscription ----------------
  subscribe(l: L) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  emit() { this.ver++; this.listeners.forEach((l) => l()); }
  get version() { return this.ver; }
  touch() { this.stateVer++; this.emit(); }

  /** Bumped by every hard reset (title, load, new game). A flow that started before a reset must not touch `busy` when it unwinds afterwards. */
  private epoch = 0;
  private unbusy(epoch: number) { if (epoch === this.epoch) this.busy = Math.max(0, this.busy - 1); }
  /** Never leave the player standing inside a wall or an NPC (old saves, flee push-backs, warps). */
  private unstick() {
    const s = this.state; const m = MAPS[s.mapId];
    const p = freeSpot(m, activeSolids(m, s), s.x * TILE, s.y * TILE);
    if (p) { s.x = p.x / TILE; s.y = p.y / TILE; }
  }
  private setOverlay(o: Overlay) { this.overlay = o; clearPressed(); this.emit(); }
  private wait<T>(make: (resolve: (v: T) => void) => Overlay): Promise<T> { return new Promise<T>((res) => { this.setOverlay(make((v) => { this.setOverlay(null); res(v); })); }); }
  toast(text: string, ms = 2200) { const o = { kind: 'toast', text } as const; this.toastOverlay = o; this.emit(); window.setTimeout(() => { if (this.toastOverlay === o) { this.toastOverlay = null; this.emit(); } }, ms); }
  toastOverlay: { kind: 'toast'; text: string } | null = null;

  // ---------------- boot & title ----------------
  onBoot(r: { ok: boolean; missing: string[] }) {
    this.bootReport = r;
    if (!r.ok) return;
    this.toTitle();
    music.warm(['namek_day', 'battle', 'namek_village', 'frieza_camp']);
  }
  toTitle() {
    this.run++; this.epoch++; this.busy = 0; this.overlay = null; this.battle?.dispose(); this.battle = null; this.battlePaused = false;
    this.mode = 'title'; this.fade = 0;
    host.startTitle(); void music.play('title');
    this.emit();
  }
  slots(): SlotMeta[] { return allSlots(); }
  hasSave() { return allSlots().some((m) => !m.empty && !m.corrupt); }
  legacyAvailable() { try { return !!localStorage.getItem('aots2-namek-save-v2'); } catch { return false; } }

  async newGame() {
    audio.resume();
    this.state = newGameState(); this.lastSaveSlot = 1;
    this.run++; this.epoch++; this.busy = 1; const ep = this.epoch;
    this.mode = 'cutscene'; this.emit();
    await new Promise<void>((res) => { this.setOverlay({ kind: 'cutscene', id: 'intro', done: () => { this.setOverlay(null); res(); } }); });
    this.unbusy(ep);
    this.enterMap(this.state.mapId, this.state.x, this.state.y, true);
  }
  loadState(s: GameState, slot = 1) {
    audio.resume();
    // a save made at the very end of the story (credits reached, Namek gone) is moved to the postgame hub instead of the dead final ground
    if (s.flags.ending_seen && (!s.flags.postgame_unlocked || s.mapId === 'core')) preparePostgame(s);
    this.state = s; this.lastSaveSlot = slot; this.run++; this.epoch++; this.busy = 0; this.overlay = null;
    this.enterMap(s.mapId, s.x, s.y, true);
  }
  loadSlot(slot: number): string | null {
    const r = readSlot(slot);
    if (!r) return 'Empty slot';
    if (!r.ok) return r.error;
    this.loadState(r.state, slot); return null;
  }
  continueLatest(): string | null {
    const metas = allSlots().filter((m) => !m.empty && !m.corrupt).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
    if (!metas.length) return 'No save found';
    return this.loadSlot(metas[0].slot);
  }
  importLegacy(): string {
    const m = migrateLegacy();
    if (!m) return 'No readable v2 save was found.';
    this.legacyNote = m.note;
    writeSlot(1, m.state);
    this.loadState(m.state, 1);
    this.toast('Imported prototype save into slot 1', 4000);
    return m.note;
  }
  importFile(text: string): string | null {
    const p = importText(text);
    if (!p.ok) return p.error;
    writeSlot(1, p.state); this.loadState(p.state, 1);
    this.toast('Save imported into slot 1'); return null;
  }
  exportText() { return exportText(this.state); }
  saveTo(slot: number): boolean {
    const ok = writeSlot(slot, clone(this.state)); if (ok) { this.lastSaveSlot = slot; audio.sfx('save'); this.toast(`Saved to slot ${slot}`); }
    else this.toast('Could not save: storage unavailable');
    return ok;
  }
  private autosave() { writeSlot(AUTOSAVE_SLOT, clone(this.state)); }

  // ---------------- world ----------------
  private worldGen = 0;
  ctxFor(mapId: string): WorldContext {
    const self = this; const gen = ++this.worldGen;
    return {
      isCurrent: () => gen === self.worldGen,
      map: MAPS[mapId],
      getState: () => self.state,
      version: () => self.stateVer,
      locked: () => self.busy > 0 || self.overlay !== null || self.fade > 0.2 || self.mode !== 'world',
      leadSprite: () => { const id = self.state.party[0]; return id === 'goku' && memberOf(self.state, 'goku')?.ssj ? 'ssj_goku' : HEROES[id].sprite; },
      leadOverworld: () => { const id = self.state.party[0]; const m = memberOf(self.state, id); return heroOverworld(id, { ssj: !!m?.ssj, fused: !!m?.fused }, getSettings().provisionalArt); },
      encounterMultiplier: () => ({ normal: 1, easy: 0.5 } as Record<string, number>)[getSettings().difficulty] ?? 1,
      onInteract: (e) => self.interact(e),
      onZone: (e) => self.zone(e),
      onFoe: (e) => self.foeTouch(e),
      onEncounter: () => self.randomEncounter(),
      onStep: () => {},
    };
  }

  async enterMap(mapId: string, x: number, y: number, instant = false) {
    const my = ++this.run;
    if (!instant) { this.fade = 1; this.emit(); await sleep(260); }
    if (my !== this.run) return;
    this.state.mapId = mapId; this.state.x = x; this.state.y = y; this.unstick();
    const m = MAPS[mapId];
    // postgame: defeated patrols are training dummies again (chests, Dragon Balls and quest rewards keep their own once-only flags)
    if (isPostgame(this.state)) for (const e of m.ents) if (e.kind === 'foe') delete this.state.flags['foe:' + e.id];
    this.mode = 'world'; this.overlay = null; this.touch();
    host.startWorld({ ctx: this.ctxFor(mapId) });
    void music.play(m.music);
    this.mapTitle = { name: m.name, sub: m.sub, until: Date.now() + 2600 };
    this.fade = 0; this.emit();
    window.setTimeout(() => { if (this.mapTitle && Date.now() >= this.mapTitle.until) { this.mapTitle = null; this.emit(); } }, 2700);
    this.autosave();
  }

  /** Explicitly rebuild the world scene at the saved position (the battle transition stopped it). */
  private returnToWorld() {
    this.unstick();
    this.mode = 'world';
    host.startWorld({ ctx: this.ctxFor(this.state.mapId) });
    void music.play(MAPS[this.state.mapId].music);
    this.touch(); this.emit();
  }

  /** After a flee push-back the world scene already rebuilt itself at the old spot: rebuild it at the corrected position. */
  private returnToWorldPosition() { if (this.mode === 'world') this.returnToWorld(); }

  private world(): WorldScene | null { return host.scene<WorldScene>('world'); }

  private async interact(e: Ent) {
    if (this.busy || this.overlay) return;
    const s = this.state;
    switch (e.kind) {
      case 'chest': {
        if (s.flags['chest:' + e.id]) { audio.sfx('cancel'); this.toast('Empty.'); return; }
        s.flags['chest:' + e.id] = true;
        const parts: string[] = [];
        for (const [id, n] of Object.entries(e.chest?.items ?? {})) { addItem(s, id, n); parts.push(`${ITEMS[id]?.name ?? id} x${n}`); }
        if (e.chest?.zeni) { s.zeni = Math.min(999999, s.zeni + e.chest.zeni); parts.push(`${e.chest.zeni} zeni`); }
        audio.sfx('pickup'); this.toast('Found: ' + parts.join(', '), 3000); this.touch(); this.autosave(); return;
      }
      case 'heal': this.healAll(); audio.sfx('heal'); this.toast('The healer restored the whole party.'); this.touch(); return;
      case 'save': { this.healAll(); const ep = this.epoch; this.busy++; await this.wait<void>((r) => ({ kind: 'altar', done: () => r() })); this.unbusy(ep); return; }
      default: if (e.script) await this.runScript(e.script);
    }
  }
  healAll() { for (const m of this.state.roster) { const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; } }

  private async zone(e: Ent) {
    if (this.busy) return;
    if (e.kind === 'exit' && e.exit) {
      if (e.lock && !condMet(this.state, e.lock.cond)) {
        audio.sfx('cancel'); this.toast(e.lock.msg, 2600);
        const s = this.state; const m = MAPS[s.mapId];
        const dx = e.x < m.w / 2 ? 1.5 : e.x > m.w / 2 ? -1.5 : 0, dy = dx === 0 ? (e.y < m.h / 2 ? 1.5 : -1.5) : 0;
        this.world()?.pushBack(dx, dy); return;
      }
      audio.sfx('door');
      await this.enterMap(e.exit.map, e.exit.x, e.exit.y);
      return;
    }
    if (e.kind === 'trigger' && e.script) await this.runScript(e.script);
  }

  private async foeTouch(e: Ent) {
    if (this.busy || this.overlay || !e.foe) return;
    this.busy++;
    const run = this.run, ep = this.epoch;
    const r = await this.battleFlow({ foes: e.foe.foes, title: e.foe.title ?? 'Patrol', allowFlee: true, hp: e.foe.hp, atk: e.foe.atk }, true);
    this.unbusy(ep);
    if (run !== this.run) return;
    if (r === 'win') { this.state.flags['foe:' + e.id] = true; this.touch(); this.autosave(); }
    else if (r === 'fled') {
      // step back from the patrol, but only to a spot the player can stand on (the push used to ignore walls)
      const s = this.state, m = MAPS[s.mapId], solids = activeSolids(m, s), away = e.x < s.x ? 1 : -1;
      for (const [dx, dy] of [[1.6 * away, 0], [-1.6 * away, 0], [0, 1.6], [0, -1.6], [0.8 * away, 0], [0, 0]]) {
        const p = freeSpot(m, solids, (s.x + dx) * TILE, (s.y + dy) * TILE);
        if (p && Math.hypot(p.x - (s.x + dx) * TILE, p.y - (s.y + dy) * TILE) < 6) { s.x = Math.max(1, p.x / TILE); s.y = p.y / TILE; break; }
      }
      this.unstick(); this.returnToWorldPosition();
    }
  }

  private async randomEncounter() {
    if (this.busy || this.overlay) return;
    const m = MAPS[this.state.mapId]; const enc = m.encounters; if (!enc) return;
    const ch = this.state.chapter;
    const pool = enc.table.filter((t) => (t.minChapter === undefined || ch >= t.minChapter) && (t.maxChapter === undefined || ch <= t.maxChapter));
    if (!pool.length) return;
    const pick = rngPick(pool, (t) => t.weight);
    this.busy++;
    const ep = this.epoch;
    await this.battleFlow({ foes: pick.foes, title: 'Ambush!', allowFlee: true, hp: pick.hp, atk: pick.atk }, true);
    this.unbusy(ep);
  }

  // ---------------- scripts ----------------
  async runScript(id: string) {
    const steps = SCRIPTS[id]; if (!steps) return;
    const my = this.run, ep = this.epoch;
    this.busy++;
    try { await this.runSteps(steps, my); } catch (e) { if (!(e instanceof StopScript)) throw e; } finally { this.unbusy(ep); }
    if (my === this.run) { this.touch(); this.autosave(); }
  }

  private showFx(e: StepFx) {
    if (e.sfx) audio.sfx(e.sfx);
    if (e.chapter !== undefined) this.toast(chapterName(e.chapter), 3200);
    else if (e.toasts.length) this.toast(e.toasts.join('  ·  '), 3200 + 700 * (e.toasts.length - 1));
    this.touch();
  }

  /** Continue / Cancel prompt used for points of no return. Resolves true for Continue. */
  askChoice(a: { text: string; yes: string; no: string }): Promise<boolean> {
    return new Promise<boolean>((res) => { this.setOverlay({ kind: 'confirm', text: a.text, yesLabel: a.yes, noLabel: a.no, yes: () => { this.setOverlay(null); res(true); }, no: () => { this.setOverlay(null); res(false); } }); });
  }

  private async runSteps(steps: Step[], token: number): Promise<void> {
    for (const st of steps) {
      if (token !== this.run) return;
      const s = this.state;
      const state = applyStateStep(s, st);   // flags, items, XP, quests, joins, chapters... (pure rules, shared with the tests)
      if (state) { this.showFx(state); continue; }
      if ('say' in st) await this.say(st.say);
      else if ('battle' in st) {
        const r = await this.battleFlow(st.battle, false);
        if (token !== this.run) return;
        if (r === 'win') await this.runSteps(st.win ?? [], token);
        else if (r === 'lose' && st.lose) await this.runSteps(st.lose, token);
        else if (r === 'abort') return;
      }
      else if ('warp' in st) { await this.enterMap(st.warp.map, st.warp.x, st.warp.y); await sleep(50); }
      else if ('cutscene' in st) { await new Promise<void>((res) => { this.setOverlay({ kind: 'cutscene', id: st.cutscene, done: () => { this.setOverlay(null); res(); } }); }); }
      else if ('music' in st) void music.play(st.music);
      else if ('toast' in st) this.toast(st.toast, 3200);
      else if ('ending' in st) { await this.credits(); return; }
      else if ('porunga' in st) await this.porungaCeremony();
      else if ('if' in st) await this.runSteps(condMet(s, st.if) ? st.then : st.else ?? [], token);
      else if ('shop' in st) await this.wait<void>((r) => ({ kind: 'shop', shop: st.shop, done: () => r() }));
      else if ('fade' in st) { this.fade = st.fade === 'out' ? 1 : 0; this.emit(); await sleep(300); }
      else if ('run' in st) await this.runSteps(SCRIPTS[st.run] ?? [], token);
      else if ('wait' in st) await sleep(st.wait);
      else if ('radar' in st) await this.say(radarLines(s, st.radar));
      else if ('ask' in st) {
        const yes = await this.askChoice({ ...st.ask, text: promptText(s, st.ask.text) });
        if (token !== this.run) return;
        if (!yes) { await this.runSteps(st.ask.onNo, token); throw new StopScript(); }
      }
    }
  }

  say(lines: Line[]): Promise<void> {
    return new Promise<void>((res) => { this.setOverlay({ kind: 'dialogue', lines, idx: 0, done: () => { this.setOverlay(null); res(); } }); });
  }
  advanceDialogue(skipAll = false) {
    const o = this.overlay; if (!o || o.kind !== 'dialogue') return;
    if (skipAll || o.idx >= o.lines.length - 1) { o.done(); return; }
    o.idx++; audio.sfx('select'); this.emit();
  }

  // ---------------- battles ----------------
  /** Runs a battle to completion (with results/defeat handling). 'win' | 'fled' | 'lose' | 'abort'. */
  async battleFlow(spec: BattleSpec, optional: boolean): Promise<'win' | 'fled' | 'lose' | 'abort'> {
    const token = this.run;
    const snapshot = snapshotBattle(this.state);
    for (;;) {
      const { allies, enemies, guests, hasBoss, rules } = buildBattleSides(this.state, spec, getSettings().difficulty === 'easy');
      const result = await new Promise<{ outcome: BattleOutcome; scripted: boolean; engine: BattleController['engine'] }>((resolve) => {
        const ctl = new BattleController({
          allies, enemies, seed: (Math.random() * 1e9) | 0, inventory: { ...this.state.inventory }, unlockedCombos: this.state.combos,
          rules,
        }, {
          stageKind: spec.stage ?? MAPS[this.state.mapId].stage, theme: spec.theme ?? (hasBoss ? 'boss' : 'battle'), intro: spec.intro, title: spec.title, tutorial: spec.tutorial,
          onFinish: (outcome, scripted, engine) => resolve({ outcome, scripted, engine }),
        });
        this.battle = ctl; this.battlePaused = false; this.mode = 'battle'; this.state.stats.battles++;
        void music.play(spec.theme === 'final' ? 'final_battle' : spec.theme === 'cooler' ? 'cooler_battle' : spec.theme === 'frieza' ? 'frieza' : spec.theme === 'ginyu' ? 'ginyu_theme' : hasBoss ? 'boss' : 'battle', 500);
        host.startBattle(ctl); this.fade = 0; this.emit();
      });
      if (token !== this.run) return 'abort';
      const { outcome, scripted, engine } = result;
      const ctl = this.battle; ctl?.dispose(); this.battle = null;
      writeBackBattle(this.state, engine, guests);

      if (outcome === 'victory') {
        this.state.stats.wins++;
        const rd = this.applyRewards(spec, scripted, engine.round);
        void music.play('victory', 200);
        audio.sfx('victory');
        await this.wait<void>((r) => ({ kind: 'results', data: rd, done: () => r() }));
        this.returnToWorld();
        this.autosave();
        return 'win';
      }
      if (outcome === 'fled') { this.returnToWorld(); return 'fled'; }
      // defeat
      this.state.stats.defeats++;
      if (spec.noGameOver) { this.healAll(); this.returnToWorld(); return 'win'; }
      audio.sfx('defeat'); void music.play('defeat', 300);
      const choice = await this.wait<'retry' | 'load' | 'title'>((r) => ({ kind: 'defeat', choose: r }));
      if (token !== this.run) return 'abort';
      if (choice === 'retry') { restoreForRetry(this.state, snapshot); continue; }
      if (choice === 'load') { this.run++; this.epoch++; this.busy = 0; const e = this.continueLatest(); if (e) this.toTitle(); return 'abort'; }
      this.toTitle(); return 'abort';
    }
    void optional;
  }

  private applyRewards(spec: BattleSpec, scripted: boolean, rounds: number): ResultData {
    const s = this.state;
    const r = applyBattleRewards(s, spec, scripted, Math.random, getSettings().difficulty === 'easy' ? EASY_XP_MULT : 1);
    recordPostgameWin(s, spec, rounds);
    const inBattle = new Set(spec.party ?? s.party);
    const members = [...inBattle].map((id) => memberOf(s, id)).filter((m): m is PartyMember => !!m).map((m) => ({ id: m.id, name: HEROES[m.id].name, level: m.level, xp: m.xp, next: xpForLevel(m.level) }));
    this.touch();
    return { outcome: 'victory', scripted, title: spec.title ?? 'Victory', exp: r.exp, zeni: r.zeni, drops: r.drops, levelUps: r.levelUps, members, rounds };
  }

  // ---------------- battle pause / quit ----------------
  togglePause() { if (this.mode !== 'battle') return; this.battlePaused = !this.battlePaused; this.battle?.setPaused(this.battlePaused); this.emit(); }

  // ---------------- menu ----------------
  openMenu(tab = 'party') { if (this.mode !== 'world' || this.busy || this.overlay) return; this.setOverlay({ kind: 'menu', tab }); audio.sfx('confirm'); }
  closeOverlay() { this.setOverlay(null); }
  setMenuTab(tab: string) { if (this.overlay?.kind === 'menu') { this.overlay.tab = tab; this.emit(); } }
  confirm(text: string, yes: () => void) { const prev = this.overlay; this.setOverlay({ kind: 'confirm', text, yes: () => { this.setOverlay(null); yes(); }, no: () => this.setOverlay(prev) }); }

  private creditsChoice: ((c: 'continue' | 'title') => void) | null = null;
  /** Called by the credits screen. 'continue' resumes in the postgame hub; 'title' goes back to the title (the postgame save already exists). */
  finishCredits(c: 'continue' | 'title') { const r = this.creditsChoice; this.creditsChoice = null; if (r) r(c); else if (c === 'title') this.toTitle(); }
  /** Porunga's summoning. Reward application is pure and atomic (systems/wishes.ts); this only runs the screens and saves after each committed wish. */
  async porungaCeremony() {
    const check = canSummon(this.state);
    if (!check.ok) {
      const lines: Line[] = [['Narrator', check.text]];
      if (check.reason === 'balls' && check.missing) lines.push(['Narrator', check.missing.map((n) => `${STAR_NAMES[n - 1]}-Star (${ballHint(this.state, n)})`).join('; ') + '.']);
      await this.say(lines); return;
    }
    const hadTrunks = !!this.state.flags.wish_trunks;
    await new Promise<void>((res) => { this.setOverlay({ kind: 'porunga', done: () => { this.setOverlay(null); res(); } }); });
    this.touch(); this.autosave();
    if (!hadTrunks && this.state.flags.wish_trunks) {
      await this.say([['Trunks', 'Where... is this? I was in the middle of a battle. Planet Namek? That was before my time.'], ['Piccolo', 'You are not from this timeline, are you? This place is only a simulation, and a wish brought you here.'], ['Trunks', 'A wish. I see. Then let me repay it: I will fight beside you. Just do not tell my mother the Dragon Balls did the rescuing.'], ['Narrator', 'Future Trunks is a non-canon what-if. He did not fight Frieza on Namek.']]);
    }
  }
  /** Called by the Porunga screen when the player confirms a wish. */
  commitWish(id: WishId): WishResult { const r = grantWish(this.state, id); if (r.ok) { this.touch(); this.autosave(); audio.sfx('levelup'); } return r; }

  async credits() {
    this.mode = 'credits'; this.overlay = null; this.battle?.dispose(); this.battle = null;
    preparePostgame(this.state); this.autosave();       // the save after the credits is already the postgame hub: ending_seen, balls and levels untouched
    this.emit();
    void music.play('epilogue', 1200);
    host.startTitle();
    this.overlay = { kind: 'credits' }; this.emit();
    const choice = await new Promise<'continue' | 'title'>((res) => { this.creditsChoice = res; });
    if (choice === 'title') { this.toTitle(); return; }
    this.overlay = null; this.mode = 'world';
    await this.enterMap(HUB.map, HUB.x, HUB.y, false);
    this.toast('Postgame unlocked: Capsule Corp’s Namek Simulation. Talk to Bulma at the Capsule Comm.', 4200);
  }

  // ---------------- party management ----------------
  /** Keeps the lineup valid: only joined heroes, no duplicates, 1 to 3 of them. */
  setParty(ids: HeroId[]) {
    const ok = [...new Set(ids)].filter((id) => memberOf(this.state, id)).slice(0, 3);
    if (!ok.length) return;
    this.state.party = ok; this.touch();
  }
  useItemOutside(itemId: string, heroId: HeroId): string { const r = useItemOutsideOp(this.state, itemId, heroId); if (r.sfx) audio.sfx(r.sfx); if (r.ok) this.touch(); return r.msg; }
  buy(shopId: string, itemId: string): string { const r = buyItemOp(this.state, shopId, itemId); if (r.sfx) audio.sfx(r.sfx); if (r.ok) this.touch(); return r.msg; }
  equip(heroId: HeroId, capsuleId: string, slot: number): string { const r = equipCapsule(this.state, heroId, capsuleId, slot); if (r.ok) this.touch(); return r.msg; }
  unequip(heroId: HeroId, slot: number) { if (unequipCapsule(this.state, heroId, slot).ok) this.touch(); }
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
export const session = new Session();
