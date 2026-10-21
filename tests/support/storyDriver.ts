import { appendFileSync } from 'node:fs';
import { MAPS } from '../../src/data/maps';
import { SCRIPTS } from '../../src/data/scripts';
import { ENEMIES } from '../../src/data/enemies';
import { ITEMS } from '../../src/data/heroes';
import { TILE, type BattleSpec, type Ent, type Line, type MapDef, type Step } from '../../src/engine/world/mapTypes';
import { addItem, avgLevel, condMet, newGameState, type GameState } from '../../src/systems/gameState';
import { applyBattleRewards, applyStateStep, EASY_XP_MULT, promptText, radarLines } from '../../src/systems/storyRuntime';
import { statsOf, type LevelUp } from '../../src/systems/party';
import { BattleEngine } from '../../src/engine/combat/engine';
import { playEngine } from '../../src/engine/combat/autoplay';
import { buildBattleSides, restoreForRetry, snapshotBattle, writeBackBattle } from '../../src/systems/battleSetup';
import { newPolicyLog, shopVisit, topUpBeforeBoss, upkeep, type PolicyLog } from './playerPolicy';
import type { HeroId } from '../../src/types';
import { encounterPixels, findPath, pathLengthPx, solidsFor, type Pt } from './pathing';

/**
 * A deterministic, headless "player": it walks the real collision grid, enters triggers/exits/foe zones with the same rules as
 * WorldScene, runs story scripts through the same pure step rules as the game (storyRuntime) and resolves battles as wins
 * (combat itself is covered by the simulation and browser tests). It records everything so tests can assert on chronology.
 */
export interface BattleRecord { /** the REAL game state just before the fight (play mode only): levels, training points, capsules, carried HP/Ki, bag */ before?: GameState; defeats?: number; rounds?: number; hpLeft?: number; title: string; foes: string[]; party: HeroId[]; levels: Partial<Record<HeroId, number>>; spec: BattleSpec; scripted: boolean; source: 'script' | 'foe' | 'random'; chapter: number; map: string }
/**
 * How battles are resolved. 'auto-win' (default) is the cheap model for story-flow tests: every fight is won and the party is rested afterwards.
 * 'play' runs every fight with the real combat engine from the party's REAL state (levels, training points, capsules, HP/Ki carried over, bag),
 * uses the game's retry rules after a defeat, and lets the player do ordinary upkeep between fights (see playerPolicy.ts). Nothing is boosted.
 */
export interface PlayStyle { name: string; perfect: number; good: number; naive?: boolean; /** defeats allowed on one fight before the run is declared stuck */ maxRetries?: number }
export interface DriverOptions { difficulty?: 'normal' | 'easy'; seed?: number; ask?: (text: string) => boolean; /** continue from a loaded save instead of a new game */ state?: GameState; fights?: 'auto-win' | 'play'; style?: PlayStyle }
export class StuckFight extends Error { constructor(public title: string, public attempts: number) { super(`stuck on "${title}" after ${attempts} defeats`); } }
/** Item and Zeni movements by source, so every item the party ever holds can be traced to chests, quests, drops, the shop or the starting bag. */
export type Ledger = Record<string, Record<string, number>>

class StopScript extends Error {}
const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export class StoryDriver {
  s: GameState = newGameState();
  mapId = 'shore';
  pos: Pt = { x: MAPS.shore.spawn.x * TILE, y: MAPS.shore.spawn.y * TILE };
  battles: BattleRecord[] = [];
  said: { who: string; text: string; script: string }[] = [];
  events: string[] = [];
  toasts: string[] = [];
  levelUps: LevelUp[] = [];
  defeats = 0; ledger: Ledger = {}; policy: PolicyLog = newPolicyLog(); shopVisits = 0; altarRests = 0;
  walkedPx = 0; encounterSteps = 0; randomFights = 0; sayCount = 0;
  ended = false; saves = 0; prompts: string[] = [];
  private rng: () => number;
  private inZone = new Set<string>();
  private encSteps = 0; private encThreshold = 25;
  private currentScript = '';
  private expect = new Set<string>();

  constructor(private o: DriverOptions = {}) { this.rng = mulberry(o.seed ?? 1); this.encThreshold = this.roll(); if (o.state) { this.s = o.state; this.enterMap(o.state.mapId, o.state.x, o.state.y, false); } else this.enterMap('shore', MAPS.shore.spawn.x, MAPS.shore.spawn.y, false); }

  get map(): MapDef { return MAPS[this.mapId]; }
  private get playing() { return this.o.fights === 'play'; }
  private note(source: string, item: string, n: number) { if (!n) return; const l = (this.ledger[source] ??= {}); l[item] = (l[item] ?? 0) + n; }
  /** Runs `fn` and books every change of the bag and Zeni under `source`. Used on leaf operations only (never nested). */
  private audit<T>(source: string, fn: () => T): T {
    const inv = { ...this.s.inventory }, zeni = this.s.zeni; const r = fn();
    for (const k of new Set([...Object.keys(inv), ...Object.keys(this.s.inventory)])) this.note(source, k, (this.s.inventory[k] ?? 0) - (inv[k] ?? 0));
    this.note(source, 'zeni', this.s.zeni - zeni); return r;
  }
  /**
   * A player who sees a boss trigger ahead rests first: the map's altar/healer if there is one (modelled as a walk there and back),
   * otherwise Med Kits and Ki Capsules until everyone is mostly topped up.
   */
  private prepForBoss(script: string) {
    if (!this.playing) return;
    const hasBattle = (steps: Step[]): boolean => steps.some((st) => 'battle' in st || ('if' in st && (hasBattle(st.then) || hasBattle(st.else ?? []))) || ('run' in st && hasBattle(SCRIPTS[st.run] ?? [])));
    if (!hasBattle(SCRIPTS[script] ?? [])) return;
    const altar = this.map.ents.find((x) => (x.kind === 'save' || x.kind === 'heal') && condMet(this.s, x.when));
    this.tend();
    if (altar) {
      this.walkedPx += 2 * Math.hypot(altar.x * TILE - this.pos.x, altar.y * TILE - this.pos.y); this.altarRests++;
      for (const m of this.s.roster) { const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; }
    } else {
      this.audit('upkeep', () => topUpBeforeBoss(this.s, this.policy));
    }
  }
  /** Player upkeep between fights and on arrival in a town (only when fights are really played). */
  private tend(shop = false) {
    if (!this.playing) return;
    this.audit(shop ? 'shop' : 'upkeep', () => { if (shop) { this.shopVisits++; shopVisit(this.s, this.policy); } upkeep(this.s, this.policy); });
  }
  private roll() { const base = 16 + this.rng() * 18; return base / (this.o.difficulty === 'easy' ? 0.5 : 1); }
  private solids() { return solidsFor(this.map, this.s); }

  enterMap(id: string, x: number, y: number, log = true) {
    this.mapId = id; this.s.mapId = id; this.pos = { x: x * TILE, y: y * TILE }; this.s.x = x; this.s.y = y; this.inZone.clear(); this.encSteps = 0;
    if (log) this.events.push(`map:${id}`);
    if (log && id === 'village' && this.playing) this.tend(true);   // passing the Aojan trader: a modelled shop visit
  }

  // ------------------------------------------------------------------ scripts
  runScript(id: string) {
    const steps = SCRIPTS[id]; if (!steps) throw new Error('Unknown script ' + id);
    const prev = this.currentScript; this.currentScript = id; this.events.push(`script:${id}`);
    try { this.runSteps(steps); } catch (e) { if (!(e instanceof StopScript)) throw e; } finally { this.currentScript = prev; }
  }

  private runSteps(steps: Step[]) {
    for (const st of steps) {
      if (this.ended) return;
      const fx = this.audit('script:' + (this.currentScript || '?'), () => applyStateStep(this.s, st));
      if (fx) { this.toasts.push(...fx.toasts); this.levelUps.push(...fx.levelUps); continue; }
      if ('say' in st) this.say(st.say);
      else if ('battle' in st) { this.fight(st.battle, 'script'); this.runSteps(st.win ?? []); }
      else if ('warp' in st) this.enterMap(st.warp.map, st.warp.x, st.warp.y);
      else if ('toast' in st) this.toasts.push(st.toast);
      else if ('ending' in st) { this.ended = true; this.events.push('ending'); return; }
      else if ('if' in st) this.runSteps(condMet(this.s, st.if) ? st.then : st.else ?? []);
      else if ('run' in st) { const prev = this.currentScript; this.currentScript = st.run; this.events.push(`script:${st.run}`); try { this.runSteps(SCRIPTS[st.run]); } finally { this.currentScript = prev; } }
      else if ('radar' in st) this.say(radarLines(this.s, st.radar));
      else if ('shop' in st) { this.events.push('shop:' + st.shop); this.tend(true); }
      else if ('cutscene' in st) this.events.push('cutscene:' + st.cutscene);
      else if ('ask' in st) {
        const text = promptText(this.s, st.ask.text); this.prompts.push(text);
        if (!(this.o.ask?.(text) ?? true)) { this.events.push('ask:cancel'); this.runSteps(st.ask.onNo); throw new StopScript(); }
        this.events.push('ask:continue');
      }
      // music / fade / wait have no state
    }
  }
  private say(lines: Line[]) { for (const [who, text] of lines) { this.said.push({ who, text, script: this.currentScript }); this.sayCount++; } }

  // ------------------------------------------------------------------ battles
  fight(spec: BattleSpec, source: BattleRecord['source']) {
    const ids = (spec.party ?? this.s.party).slice(0, 3);
    const levels: Partial<Record<HeroId, number>> = {};
    for (const id of ids) { const m = this.s.roster.find((r) => r.id === id); levels[id] = m ? m.level : avgLevel(this.s); }
    for (const f of spec.foes) if (!ENEMIES[f]) throw new Error('Unknown enemy ' + f);
    const rec: BattleRecord = { title: spec.title ?? spec.foes.join('+'), foes: [...spec.foes], party: ids, levels, spec, scripted: !!(spec.scriptedEnd || spec.surviveRounds), source, chapter: this.s.chapter, map: this.mapId };
    this.battles.push(rec);
    const xpMult = this.o.difficulty === 'easy' ? EASY_XP_MULT : 1;
    if (!this.playing) {
      const r = applyBattleRewards(this.s, spec, rec.scripted, this.rng, xpMult);
      this.levelUps.push(...r.levelUps);
      for (const m of this.s.roster) { const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; }   // the player rests/heals between fights (resupply paths are tested separately)
      this.s.stats.battles++; this.s.stats.wins++;
      return;
    }
    const style = this.o.style ?? { name: 'skilled', perfect: 0.35, good: 0.35 };
    const snap = snapshotBattle(this.s); rec.defeats = 0; rec.before = JSON.parse(JSON.stringify(this.s)) as GameState;
    for (;;) {
      const { allies, enemies, guests, rules } = buildBattleSides(this.s, spec, this.o.difficulty === 'easy');
      const engine = new BattleEngine({ allies, enemies, seed: Math.floor(this.rng() * 1e9), rules, unlockedCombos: this.s.combos, inventory: { ...this.s.inventory } });
      const res = playEngine(engine, { seed: Math.floor(this.rng() * 1e9), perfect: style.perfect, good: style.good, naive: style.naive });
      this.audit('battle-used', () => writeBackBattle(this.s, engine, guests));
      this.s.stats.battles++;
      if (engine.outcome === 'victory') {
        this.s.stats.wins++; rec.rounds = res.rounds; rec.hpLeft = res.hpLeft;
        this.audit('battle-drops', () => { const r = applyBattleRewards(this.s, spec, engine.scriptedWin, this.rng, xpMult); this.levelUps.push(...r.levelUps); });
        break;
      }
      this.s.stats.defeats++; this.defeats++; rec.defeats = (rec.defeats ?? 0) + 1;
      if (spec.noGameOver) { for (const m of this.s.roster) { const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; } break; }
      if (rec.defeats > (style.maxRetries ?? 12)) throw new StuckFight(rec.title, rec.defeats);
      this.audit('retry-restore', () => restoreForRetry(this.s, snap));   // the bag goes back to how it was before the failed attempt
    }
    if (source !== 'script') this.tend();   // inside a story script the menu is closed: no top-up between a boss's forms
  }
  private randomEncounter() {
    const enc = this.map.encounters; if (!enc) return;
    const ch = this.s.chapter;
    const pool = enc.table.filter((t) => (t.minChapter === undefined || ch >= t.minChapter) && (t.maxChapter === undefined || ch <= t.maxChapter));
    if (!pool.length) return;
    const tot = pool.reduce((a, t) => a + t.weight, 0); let r = this.rng() * tot; let pick = pool[pool.length - 1];
    for (const t of pool) { r -= t.weight; if (r <= 0) { pick = t; break; } }
    this.randomFights++; this.events.push('random:' + this.mapId);
    this.fight({ foes: pick.foes, title: 'Ambush!' }, 'random');
  }

  // ------------------------------------------------------------------ walking
  private zoneInside(e: Ent, p: Pt) {
    const cx = e.x * TILE, cy = e.y * TILE, w = (e.w ?? 1) * TILE, h = (e.h ?? 1) * TILE;
    return p.x >= cx - w / 2 && p.x <= cx + w / 2 && p.y >= cy - h / 2 && p.y <= cy + h / 2 + 6;
  }
  /** Walk to a pixel point on the current map (A* on the real collision data). Returns false if the walk was cut short by a map change. */
  walkToPoint(goal: Pt, label: string, opt: { slack?: number; expect?: string[]; allowTriggers?: boolean; accept?: (p: Pt) => boolean } = {}): boolean {
    this.expect = new Set(opt.expect ?? []);
    if (process.env.AOTS_TRACE) appendFileSync(process.env.AOTS_TRACE, `${this.mapId} -> ${label} from ${(this.pos.x / TILE).toFixed(1)},${(this.pos.y / TILE).toFixed(1)}
`);
    // A careful player walks around story zones they do not want to start; if a zone blocks the whole way, they have to cross it
    const avoid = (p: Pt) => this.map.ents.some((e) => (e.kind === 'trigger' || e.kind === 'exit') && !this.expect.has(e.id) && condMet(this.s, e.when) && this.zoneInside(e, { x: p.x, y: p.y }) );
    const path = findPath(this.map, this.solids(), this.pos, goal, opt.slack ?? 20, opt.accept, opt.allowTriggers ? undefined : avoid) ?? findPath(this.map, this.solids(), this.pos, goal, opt.slack ?? 20, opt.accept);
    if (!path) throw new Error(`No walkable path on ${this.mapId} from (${(this.pos.x / TILE).toFixed(1)},${(this.pos.y / TILE).toFixed(1)}) to ${label}`);
    this.walkedPx += pathLengthPx(path);
    const startMap = this.mapId;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i]; const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let k = 1; k <= n; k++) {
        const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
        this.step(p, label, opt.allowTriggers ?? false);
        if (this.mapId !== startMap) return false;
      }
    }
    return true;
  }
  private step(p: Pt, label: string, allowTriggers: boolean) {
    const moved = Math.hypot(p.x - this.pos.x, p.y - this.pos.y); this.pos = p;
    this.s.x = p.x / TILE; this.s.y = p.y / TILE;
    // zones (triggers, exits)
    const before = this.mapId;
    for (const e of this.map.ents) {
      if ((e.kind !== 'trigger' && e.kind !== 'exit') || !condMet(this.s, e.when)) continue;
      const inside = this.zoneInside(e, p); const was = this.inZone.has(e.id);
      if (inside && !was) {
        this.inZone.add(e.id);
        if (e.kind === 'exit' && e.exit) {
          if (e.lock && !condMet(this.s, e.lock.cond)) { this.events.push(`locked:${e.id}`); throw new Error(`Walking to ${label} hit locked exit ${e.id}: ${e.lock.msg}`); }
          if (!this.expect.has(e.id) && !allowTriggers) throw new Error(`Walking to ${label} crossed exit ${e.id} unexpectedly`);
          this.events.push(`exit:${e.id}`); this.enterMap(e.exit.map, e.exit.x, e.exit.y, true); return;
        }
        if (e.kind === 'trigger' && e.script) {
          if (!this.expect.has(e.id) && !allowTriggers) throw new Error(`Walking to ${label} unexpectedly started trigger ${e.id} (${e.script}) at flags ${Object.keys(this.s.flags).slice(-6).join(',')}`);
          this.events.push(`trigger:${e.id}`); this.prepForBoss(e.script); this.runScript(e.script); if (this.ended || this.mapId !== before) return;
        }
      } else if (!inside && was) this.inZone.delete(e.id);
    }
    // foe contact (patrols are treated as standing at their base point)
    for (const e of this.map.ents) {
      if (e.kind !== 'foe' || !condMet(this.s, e.when) || this.s.flags['foe:' + e.id]) continue;
      if (Math.hypot(e.x * TILE - p.x, (e.y * TILE - p.y) * 1.4) < 34) { this.events.push(`foe:${e.id}`); this.fight({ foes: e.foe!.foes, title: e.foe!.title ?? 'Patrol' }, 'foe'); this.s.flags['foe:' + e.id] = true; }
    }
    // random encounters: one step per TILE of movement inside an encounter zone
    if (moved > 0 && this.map.encounters && !this.map.safe && this.map.encounters.zones.some(([x0, y0, x1, y1]) => p.x / TILE >= x0 && p.x / TILE <= x1 && p.y / TILE >= y0 && p.y / TILE <= y1)) {
      this.encSteps += moved / TILE; this.encounterSteps += moved / TILE;
      if (this.encSteps >= this.encThreshold) { this.encSteps = 0; this.encThreshold = this.noEnc ? Infinity : this.roll(); this.randomEncounter(); }
    }
  }

  entity(id: string): Ent { const e = this.map.ents.find((x) => x.id === id); if (!e) throw new Error(`No entity ${id} on ${this.mapId}`); return e; }

  /** Walk next to an interactable and use it, exactly like pressing E. */
  interact(id: string, opt: { expect?: string[]; allowTriggers?: boolean } = {}) {
    const e = this.entity(id);
    if (!condMet(this.s, e.when)) throw new Error(`${id} is not present at the current flags`);
    const goal = { x: e.x * TILE, y: e.y * TILE };
    const reach = (p: Pt) => Math.hypot(e.x * TILE - p.x, (e.y * TILE - p.y) * 1.3) < 50;
    if (!this.walkToPoint(goal, id, { accept: reach, ...opt })) return;
    if (Math.hypot(e.x * TILE - this.pos.x, (e.y * TILE - this.pos.y) * 1.3) >= 56) throw new Error(`Cannot reach ${id} within interaction range`);
    this.events.push(`interact:${id}`);
    switch (e.kind) {
      case 'chest': {
        if (this.s.flags['chest:' + e.id]) return;
        this.s.flags['chest:' + e.id] = true;
        this.audit('chest', () => {
          for (const [item, n] of Object.entries(e.chest?.items ?? {})) { if (!ITEMS[item]) throw new Error('bad item ' + item); addItem(this.s, item, n); }
          if (e.chest?.zeni) this.s.zeni = Math.min(999999, this.s.zeni + e.chest.zeni);
        });
        return;
      }
      case 'heal': for (const m of this.s.roster) { const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; } this.tend(); return;
      case 'save': for (const m of this.s.roster) { const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; } this.saves++; this.tend(); return;
      default: if (e.script) this.runScript(e.script);
    }
  }

  /** Walk into a trigger or exit zone on purpose. */
  /** Test hook, like WorldScene.debugNoEncounters(): stop random encounters for the rest of this driver's life. */
  noEncounters() { this.encThreshold = Infinity; this.noEnc = true; }
  private noEnc = false;

  setAsk(fn: ((text: string) => boolean) | undefined) { this.o = { ...this.o, ask: fn }; }

  /** `also`: other triggers that legitimately start in the same footprint right after this script (e.g. Frieza's forms, then the final form). */
  enter(id: string, also: string[] = []) {
    const e = this.entity(id);
    if (!condMet(this.s, e.when)) throw new Error(`${id} is not active at the current flags`);
    this.walkToPoint({ x: e.x * TILE, y: e.y * TILE }, id, { accept: (p) => this.zoneInside(e, p), expect: [id, ...also], allowTriggers: false });
  }

  /** Engage a patrol on purpose (walk onto it). */
  engage(id: string) {
    const e = this.entity(id); if (this.s.flags['foe:' + e.id]) return;
    this.walkToPoint({ x: e.x * TILE, y: e.y * TILE }, id, { slack: 20 });
    if (!this.s.flags['foe:' + e.id]) throw new Error(`Did not meet ${id}`);
  }

  /** Cross maps by walking: BFS over exits that are currently unlocked. */
  travelTo(target: string, opt: { entry?: string } = {}) {
    if (this.mapId === target) return;
    const route = (() => {
      const q: { id: string; via: Ent[] }[] = [{ id: this.mapId, via: [] }]; const seen = new Set([this.mapId]);
      while (q.length) {
        const cur = q.shift()!;
        if (cur.id === target) return cur.via;
        for (const e of MAPS[cur.id].ents) {
          if (!e.exit || seen.has(e.exit.map)) continue;
          if (!condMet(this.s, e.when) || (e.lock && !condMet(this.s, e.lock.cond))) continue;
          seen.add(e.exit.map); q.push({ id: e.exit.map, via: [...cur.via, e] });
        }
      }
      return null;
    })();
    if (!route) throw new Error(`No unlocked route from ${this.mapId} to ${target} at the current flags`);
    for (const e of route) {
      if (this.map.id !== e.exit!.map && !MAPS[this.mapId].ents.includes(e)) throw new Error('route desync');
      this.walkToPoint({ x: e.x * TILE, y: e.y * TILE }, `exit ${e.id}`, { accept: (p) => this.zoneInside(e, p), expect: [e.id] });
      if (this.mapId !== e.exit!.map) throw new Error(`Exit ${e.id} did not lead to ${e.exit!.map} (now on ${this.mapId})`);
    }
    void opt;
  }

  // ------------------------------------------------------------------ metrics
  /** Rough playable time: walking at 150 px/s, ~2.5 s per spoken line, ~70 s per fight. A model, not a measurement. */
  estimateMinutes() { return (this.walkedPx / 150 + this.sayCount * 2.5 + this.battles.length * 70) / 60; }
  flags() { return this.s.flags; }
  levelOf(id: HeroId) { return this.s.roster.find((m) => m.id === id)?.level ?? 0; }
  encounterShare(p: Pt[]) { return encounterPixels(this.map, p); }
}
