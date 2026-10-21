import Phaser from 'phaser';
import type { Ent, MapDef } from '../world/mapTypes';
import { TILE } from '../world/mapTypes';
import type { WorldContext } from '../world/context';
import { condMet } from '../../systems/gameState';
import { moveVector, consume } from '../../systems/input';
import { ANCHOR_X, ANCHOR_Y, idleSize, resolvePose, texKey } from '../assets';
import { audio } from '../audio/audio';
import { GAME_SCALE, LOGICAL_H, LOGICAL_W } from '../gameScale';
import { blockedAt } from '../world/collision';
import { OVERWORLD } from '../../data/artManifest.generated';
import { OW_SCALE, dirFromVector, dirToward, owFrame, owKey, type Dir } from '../world/overworld';

const FONT = '"Press Start 2P", monospace';
const AVATAR_H = 66;
const INTERACTABLE = new Set(['npc', 'chest', 'save', 'heal', 'ball', 'sign', 'shop']);

interface EntView { ent: Ent; img?: Phaser.GameObjects.Image; x: number; y: number; extra: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform)[]; patrolIdx: number; baseY: number; solid?: Rect }
interface Rect { x: number; y: number; w: number; h: number }

export class WorldScene extends Phaser.Scene {
  ctx!: WorldContext;
  private map!: MapDef;
  private solids: Rect[] = [];
  private ents: EntView[] = [];
  private staticObjs: Phaser.GameObjects.GameObject[] = [];
  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private px = 0; private py = 0;
  private facing: Dir = 'down';
  private ow: { entity: string; provisional: boolean } | null = null;
  private moving = false;
  private walkClock = 0;
  private lastWalkIdx = -1;
  private stepAcc = 0; private stepSnd = 0;
  private encSteps = 0; private encThreshold = 22;
  private inZone = new Set<string>();
  private promptText!: Phaser.GameObjects.Text;
  private labelText!: Phaser.GameObjects.Text;
  private fxG!: Phaser.GameObjects.Graphics;
  private t = 0;
  private lastVersion = -1;
  private graceUntil = 0;
  private leadSprite = '';
  manual = false;
  private waterTile: Phaser.GameObjects.TileSprite | null = null;
  private voidWater: Phaser.GameObjects.TileSprite | null = null;
  /** Set when a callback may start a scene change; the rest of this step is skipped. */
  private yielded = false;

  constructor() { super('world'); }
  init(data: { ctx: WorldContext }) { this.ctx = data.ctx; }

  create() {
    const ctx = this.ctx; this.map = ctx.map; const m = this.map;
    this.noEncounters = false; this.solids = []; this.ents = []; this.staticObjs = []; this.waterTile = null; this.voidWater = null; this.yielded = false; this.inZone.clear(); this.t = 0; this.lastVersion = -1;
    const W = m.w * TILE, H = m.h * TILE;
    this.cameras.main.setBackgroundColor(0x000000).setBounds(W >= LOGICAL_W ? 0 : -(LOGICAL_W - W) / 2, H >= LOGICAL_H ? 0 : -(LOGICAL_H - H) / 2, Math.max(W, LOGICAL_W), Math.max(H, LOGICAL_H));
    this.paintTerrain();
    this.placeObjects();
    const s = ctx.getState();
    this.px = s.x * TILE; this.py = s.y * TILE; this.facing = s.facing;
    this.shadow = this.add.ellipse(0, 0, 30, 10, 0x06140f, 0.4).setDepth(1);
    this.leadSprite = ctx.leadSprite();
    this.player = this.add.image(0, 0, texKey(this.leadSprite, 'idle')).setOrigin(ANCHOR_X, ANCHOR_Y);
    this.moving = false; this.walkClock = 0; this.lastWalkIdx = -1;
    this.applyAvatar();
    this.fxG = this.add.graphics().setDepth(5000);
    this.promptText = this.add.text(0, 0, 'E', { fontFamily: FONT, fontSize: '10px', color: '#101a40', backgroundColor: '#ffe14a', padding: { x: 4, y: 3 } }).setOrigin(0.5).setDepth(5100).setVisible(false);
    this.labelText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '8px', color: '#ffffff', stroke: '#101a40', strokeThickness: 4 }).setOrigin(0.5).setDepth(5100).setVisible(false);
    this.encThreshold = this.rollThreshold();
    this.graceUntil = 400;
    this.rebuildEntities();
    this.cameraSnap();
    (window as unknown as { __world?: WorldScene }).__world = this;
    this.events.once('shutdown', () => { this.staticObjs.forEach((o) => o.destroy()); this.ents.forEach((e) => this.destroyEnt(e)); this.ents = []; this.waterTile = null; this.voidWater = null; this.yielded = false; });
  }

  // ---------------- terrain ----------------
  private cell(x: number, y: number): string { const r = this.map.ground[y]; return r ? r[x] ?? 'x' : 'x'; }
  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T { this.staticObjs.push(o); return o; }

  private maskFor(pred: (c: string) => boolean, dy = 0): Phaser.Display.Masks.GeometryMask {
    const g = this.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    const m = this.map, r = TILE * 0.78;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!pred(this.cell(x, y))) continue;
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2 + dy;
      g.fillCircle(cx, cy, r);
      if (x + 1 < m.w && pred(this.cell(x + 1, y))) g.fillRect(cx, cy - r, TILE, r * 2);
      if (y + 1 < m.h && pred(this.cell(x, y + 1))) g.fillRect(cx - r, cy, r * 2, TILE);
      if (x + 1 < m.w && y + 1 < m.h && pred(this.cell(x + 1, y)) && pred(this.cell(x, y + 1)) && pred(this.cell(x + 1, y + 1))) g.fillRect(cx, cy, TILE, TILE);
    }
    return g.createGeometryMask();
  }

  private paintTerrain() {
    const m = this.map, W = m.w * TILE, H = m.h * TILE;
    const tex = (k: string) => this.textures.exists(k);
    const bg = this.add.rectangle(0, 0, W, H, 0x050912).setOrigin(0).setDepth(-1000); this.staticObjs.push(bg);
    if (m.sky === 'day') {
      if (tex('t_grass')) this.keep(this.add.tileSprite(0, 0, W, H, 't_grass').setOrigin(0).setDepth(-900).setTileScale(0.9));
      if (tex('t_dirt')) { const d = this.keep(this.add.tileSprite(0, 0, W, H, 't_dirt').setOrigin(0).setDepth(-880).setTileScale(0.85)); d.setMask(this.maskFor((c) => c === ',')); }
      if (tex('t_water')) {
        // shore: sand rim then water
        const rim = this.keep(this.add.tileSprite(0, 0, W, H, 't_dirt').setOrigin(0).setDepth(-875).setTileScale(0.85).setTint(0xe8d8a8));
        rim.setMask(this.maskFor((c) => c === '~' || c === ','));
        const w = this.keep(this.add.tileSprite(0, 0, W, H, 't_water').setOrigin(0).setDepth(-870).setTileScale(1));
        w.setMask(this.maskFor((c) => c === '~'));
        this.waterTile = w;
      }
    } else if (m.sky === 'ice') {
      const sky = this.keep(this.add.graphics().setDepth(-950)); sky.fillGradientStyle(0x0c0a2e, 0x0c0a2e, 0x2a2f7a, 0x2a2f7a, 1); sky.fillRect(0, 0, W, H);
      if (tex('t_ice_deep') && tex('t_ice_cliff')) {
        // out-of-world cells read as deep icy water; the ice plateau is an extruded rock cliff above it (atlas crops), never a flat hole
        this.voidWater = this.keep(this.add.tileSprite(0, 0, W, H, 't_ice_deep').setOrigin(0).setDepth(-940).setTileScale(1).setTint(0xb8c4ff));
        this.keep(this.add.rectangle(0, 0, W, H, 0x040a30, 0.28).setOrigin(0).setDepth(-939));
        const solid = (c: string) => c === 'i' || c === '~';
        const shade = this.keep(this.add.rectangle(0, 0, W, H, 0x02061c, 0.5).setOrigin(0).setDepth(-930)); shade.setMask(this.maskFor(solid, 28));
        const rock = this.keep(this.add.tileSprite(0, 0, W, H, 't_ice_cliff').setOrigin(0).setDepth(-905).setTileScale(1)); rock.setMask(this.maskFor(solid, 20));
        const mid = this.keep(this.add.tileSprite(0, 0, W, H, 't_ice_cliff').setOrigin(0).setDepth(-904).setTileScale(1).setTint(0xcfd6ff)); mid.setMask(this.maskFor(solid, 10));
      }
      if (tex('t_ice')) { const ice = this.keep(this.add.tileSprite(0, 0, W, H, 't_ice').setOrigin(0).setDepth(-900).setTileScale(0.9)); ice.setMask(this.maskFor((c) => c === 'i')); }
      if (tex('t_water')) { const pool = this.keep(this.add.tileSprite(0, 0, W, H, 't_water').setOrigin(0).setDepth(-890).setTileScale(1).setTint(0xb9a6ff)); pool.setMask(this.maskFor((c) => c === '~')); this.waterTile = pool; }
    } else if (m.sky === 'ship') {
      const g = this.keep(this.add.graphics().setDepth(-900));
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === 'm') {
        g.fillStyle((x + y) % 2 ? 0x3a3868 : 0x343262, 1).fillRect(x * TILE, y * TILE, TILE, TILE);
        g.lineStyle(1, 0x5a589a, 0.6).strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
        if (x % 4 === 1 && y % 4 === 1) g.fillStyle(0x7fe8ff, 0.5).fillRect(x * TILE + 12, y * TILE + 12, 8, 8);
      }
    } else if (m.sky === 'cave') {
      if (tex('t_dirt')) { const d = this.keep(this.add.tileSprite(0, 0, W, H, 't_dirt').setOrigin(0).setDepth(-900).setTileScale(0.85).setTint(0x7a665a)); d.setMask(this.maskFor((c) => c === 'c')); }
      const glow = this.keep(this.add.graphics().setDepth(-890)); glow.fillStyle(0x5ad2ff, 0.05); for (let i = 0; i < 6; i++) glow.fillCircle(150 + i * 180, 300 + (i % 2) * 120, 150);
    } else if (m.sky === 'final') {
      const sky = this.keep(this.add.graphics().setDepth(-950)); sky.fillGradientStyle(0x2a0a18, 0x2a0a18, 0xff7a2a, 0xff7a2a, 1); sky.fillRect(0, 0, W, 4 * TILE + 8);
      sky.fillStyle(0xffd27a, 0.45).fillEllipse(W / 2, 4 * TILE, W * 0.8, 80);
      if (tex('t_dirt')) { this.keep(this.add.tileSprite(0, 4 * TILE, W, H - 4 * TILE, 't_dirt').setOrigin(0).setDepth(-900).setTileScale(0.85).setTint(0x7a3a2a)); const d = this.keep(this.add.tileSprite(0, 0, W, H, 't_dirt').setOrigin(0).setDepth(-880).setTileScale(0.85).setTint(0xc89a7a)); d.setMask(this.maskFor((c) => c === ',')); }
      const cr = this.keep(this.add.graphics().setDepth(-870)); cr.lineStyle(3, 0xff7a2a, 0.9);
      let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 12; i++) { let x = r() * W, y = 4 * TILE + r() * (H - 4 * TILE); cr.beginPath(); cr.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.45) * 80; y += (r() - 0.3) * 30; cr.lineTo(x, y); } cr.strokePath(); }
    }
    // generic shadowed edge for void cells
    const vg = this.keep(this.add.graphics().setDepth(-860));
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === 'x' && m.sky !== 'final' && !this.voidWater) vg.fillStyle(m.sky === 'ice' ? 0x1b1a52 : 0x03050c, 1).fillRect(x * TILE, y * TILE, TILE, TILE);
  }

  private placeObjects() {
    for (const o of this.map.objs) {
      const key = 'o_' + o.o; if (!this.textures.exists(key)) continue;
      const im = this.keep(this.add.image(o.x * TILE, o.y * TILE, key).setOrigin(0.5, 1).setScale(o.s).setFlipX(!!o.flip).setDepth(o.y * TILE + (o.depthBias ?? 0)));
      if (o.tint !== undefined) im.setTint(o.tint);
      if (o.solid) this.solids.push({ x: o.x * TILE - (o.solid[0] * TILE) / 2, y: o.y * TILE - o.solid[1] * TILE, w: o.solid[0] * TILE, h: o.solid[1] * TILE });
    }
  }

  // ---------------- entities ----------------
  private destroyEnt(e: EntView) { e.img?.destroy(); e.extra.forEach((o) => o.destroy()); }
  private rebuildEntities() {
    const s = this.ctx.getState();
    this.ents.forEach((e) => this.destroyEnt(e)); this.ents = [];
    this.solids = this.solids.filter((r) => !(r as Rect & { ent?: boolean }).ent);
    for (const ent of this.map.ents) {
      if (!condMet(s, ent.when)) continue;
      if (ent.kind === 'foe' && s.flags['foe:' + ent.id]) continue;
      const ev: EntView = { ent, x: ent.x * TILE, y: ent.y * TILE, extra: [], patrolIdx: 0, baseY: ent.y * TILE };
      if (ent.ow && OVERWORLD[ent.ow]) {
        const o = OVERWORLD[ent.ow];
        ev.img = this.add.image(ev.x, ev.y, owKey(ent.ow, 'down', o.dirs.down.idle[0])).setOrigin(o.anchor[0] / o.canvas[0], o.anchor[1] / o.canvas[1]).setScale(o.scale ?? OW_SCALE).setDepth(ev.y);
      } else if (ent.obj && this.textures.exists('o_' + ent.obj)) {
        const img = this.add.image(ev.x, ev.y, 'o_' + ent.obj).setOrigin(0.5, 1).setScale(ent.scale ?? 0.6).setFlipX(!!ent.flip).setDepth(ev.y);
        ev.img = img;
        if (ent.kind === 'chest' && s.flags['chest:' + ent.id]) img.setAlpha(0.45).setTint(0x666666);
        if (ent.kind === 'save') { const ring = this.add.ellipse(ev.x, ev.y - 4, 120, 40, 0x6aa8ff, 0.18).setDepth(ev.y - 1); ev.extra.push(ring); }
        if (ent.kind === 'ball') { const glow = this.add.circle(ev.x, ev.y - 14, 22, 0xffd34a, 0.25).setDepth(ev.y - 1); ev.extra.push(glow); }
        if (ent.kind === 'heal') { const glow = this.add.ellipse(ev.x, ev.y - 2, 60, 18, 0x6dff9a, 0.22).setDepth(ev.y - 1); ev.extra.push(glow); }
      }
      if (ent.solid) { const r = { x: ev.x - (ent.solid[0] * TILE) / 2, y: ev.y - ent.solid[1] * TILE, w: ent.solid[0] * TILE, h: ent.solid[1] * TILE, ent: true }; this.solids.push(r); ev.solid = r; }
      else if (['npc', 'heal', 'shop'].includes(ent.kind)) { const r = { x: ev.x - 11, y: ev.y - 10, w: 22, h: 10, ent: true }; this.solids.push(r); ev.solid = r; }
      this.ents.push(ev);
    }
    this.lastVersion = this.ctx.version();
  }

  // ---------------- collision / movement ----------------
  private blockedAt(x: number, y: number): boolean { return blockedAt(this.map, this.solids, x, y); }
  private noEncounters = false;
  /** Test hook: stop random encounters for movement tests. */
  debugNoEncounters() { this.noEncounters = true; this.encThreshold = Infinity; }
  private rollThreshold() { if (this.noEncounters) return Infinity; const base = 16 + Math.random() * 18; const mult = this.ctx.encounterMultiplier(); return mult <= 0 ? Infinity : base / mult; }
  private inEncounterZone(): boolean {
    const enc = this.map.encounters; if (!enc || this.map.safe) return false;
    const tx = this.px / TILE, ty = this.py / TILE;
    return enc.zones.some(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1);
  }

  /** Dev/test: advance the world by ms with scripted input (bypasses real keyboard). */
  debugWalk(dx: number, dy: number, ms: number) { for (let t = 0; t < ms; t += 16) this.step(16, { x: dx, y: dy, run: false }); }

  /** Test hook: what the avatar is showing right now. */
  debugAvatar() { return { texture: this.player.texture.key, facing: this.facing, moving: this.moving, entity: this.ow?.entity ?? null, provisional: this.ow?.provisional ?? null, flipX: this.player.flipX, scale: this.player.scaleX }; }

  /** Test hook: move the player (tile coordinates) with the spawn grace already elapsed. */
  debugTeleport(tx: number, ty: number) { this.px = tx * TILE; this.py = ty * TILE; this.graceUntil = 0; this.inZone.clear(); }

  /** Test hook: make the very next counted step roll an encounter. */
  debugArmEncounter() { this.encSteps = this.encThreshold - 1; }

  update(_t: number, delta: number) { if (this.manual) return; this.step(Math.min(delta, 50), moveVector()); }

  private applyAvatar() {
    this.ow = this.ctx.leadOverworld();
    if (this.ow) {
      const o = OVERWORLD[this.ow.entity];
      this.player.setTexture(owKey(this.ow.entity, this.facing, o.dirs[this.facing].idle[0])).setOrigin(o.anchor[0] / o.canvas[0], o.anchor[1] / o.canvas[1]).setScale(o.scale ?? OW_SCALE).setFlipX(false);
      this.shadow.setVisible(false);      // the recovered frames carry their own ground shadow
      return;
    }
    this.shadow.setVisible(true);
    const sprite = this.ctx.leadSprite(); this.leadSprite = sprite;   // fallback: battle idle crop (only when no overworld set exists)
    const pose = resolvePose(sprite, 'idle');
    this.player.setTexture(texKey(sprite, pose)).setOrigin(ANCHOR_X, ANCHOR_Y).setScale(AVATAR_H / idleSize(sprite).h);
  }

  private step(dtMs: number, mv: { x: number; y: number; run: boolean }) {
    if (!this.sys?.isActive() || !this.cameras?.main || !this.player?.active) return;
    if (!this.ctx.isCurrent()) return;   // a newer world is being started (map change, warp, return from battle): never write the old position into the state
    const ctx = this.ctx; const dt = dtMs / 1000; this.t += dtMs;
    if (this.graceUntil > 0) this.graceUntil -= dtMs;
    if (ctx.version() !== this.lastVersion) { this.rebuildEntities(); const nowOw = ctx.leadOverworld(); if ((nowOw?.entity ?? '') !== (this.ow?.entity ?? '') || (!nowOw && ctx.leadSprite() !== this.leadSprite)) this.applyAvatar(); }
    const locked = ctx.locked();
    this.moving = false;
    if (!locked) {
      if (mv.x || mv.y) {
        const sp = (mv.run ? 215 : 150) * dt;
        const nx = this.px + mv.x * sp, ny = this.py + mv.y * sp;
        let moved = 0;
        if (!this.blockedAt(nx, this.py)) { moved += Math.abs(nx - this.px); this.px = nx; }
        if (!this.blockedAt(this.px, ny)) { moved += Math.abs(ny - this.py); this.py = ny; }
        if (moved > 0.01) {
          this.facing = dirFromVector(mv.x, mv.y, this.facing); this.moving = true;
          this.stepAcc += moved; this.stepSnd += dt;
          if (!this.ow && this.stepSnd > 0.3) { this.stepSnd = 0; audio.sfx('step'); }
          if (this.stepAcc >= TILE) { this.stepAcc -= TILE; ctx.onStep(); if (this.inEncounterZone()) { this.encSteps++; if (this.encSteps >= this.encThreshold) { this.encSteps = 0; this.encThreshold = this.rollThreshold(); ctx.onEncounter(); this.yielded = true; } } }
        }
      }
      if (consume('e', 'E', 'Enter', ' ')) this.tryInteract();
    }
    if (this.yielded) { this.yielded = false; return; }
    // persist transform into state (single source of truth)
    const s = ctx.getState(); s.x = this.px / TILE; s.y = this.py / TILE; s.facing = this.facing;
    this.updateZones(locked);
    this.updateFoes(dt, locked);
    this.draw(dt);
  }

  private reach(e: EntView) { return Math.hypot(e.x - this.px, (e.y - this.py) * 1.3); }
  private nearestInteractable(): EntView | null {
    let best: EntView | null = null, bd = 56;
    for (const e of this.ents) { if (!INTERACTABLE.has(e.ent.kind)) continue; const d = this.reach(e); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  private tryInteract() { const e = this.nearestInteractable(); if (e) { this.ctx.onInteract(e.ent); this.yielded = true; } }

  private updateZones(locked: boolean) {
    if (locked || this.graceUntil > 0) return;
    for (const e of this.ents) {
      if (e.ent.kind !== 'trigger' && e.ent.kind !== 'exit') continue;
      const w = (e.ent.w ?? 1) * TILE, h = (e.ent.h ?? 1) * TILE;
      const inside = this.px >= e.x - w / 2 && this.px <= e.x + w / 2 && this.py >= e.y - h / 2 && this.py <= e.y + h / 2 + 6;
      const was = this.inZone.has(e.ent.id);
      if (inside && !was) { this.inZone.add(e.ent.id); this.ctx.onZone(e.ent); this.yielded = true; return; }
      if (!inside && was) this.inZone.delete(e.ent.id);
    }
  }
  /** Called by the app after it pushes the player out of a locked exit. */
  pushBack(dx: number, dy: number) { this.px += dx * TILE; this.py += dy * TILE; }

  private updateFoes(dt: number, locked: boolean) {
    if (locked) return;
    for (const e of this.ents) {
      if (e.ent.kind !== 'foe') continue;
      const p = e.ent.foe?.patrol;
      if (p && p.length > 1 && e.img) {
        const tgt = p[(e.patrolIdx + 1) % p.length]; const tx = tgt[0] * TILE, ty = tgt[1] * TILE;
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
        if (d < 2) e.patrolIdx = (e.patrolIdx + 1) % p.length; else { e.x += (dx / d) * 38 * dt; e.y += (dy / d) * 38 * dt; e.img.setFlipX(dx < 0); }
      }
      if (this.graceUntil <= 0 && Math.hypot(e.x - this.px, (e.y - this.py) * 1.4) < 34) { this.ctx.onFoe(e.ent); this.yielded = true; return; }
    }
  }

  private cameraSnap() { const c = this.cameras.main; c.setZoom(GAME_SCALE.k); c.centerOn(this.px, this.py - 20); }

  private draw(dt: number) {
    if (this.waterTile) { this.waterTile.tilePositionX += 0.15; this.waterTile.tilePositionY += 0.05; }
    if (this.voidWater) { this.voidWater.tilePositionX += 0.1; this.voidWater.tilePositionY += 0.03; }
    const cam = this.cameras.main; cam.setZoom(GAME_SCALE.k);
    const tx = this.px, ty = this.py - 24;
    const cx = cam.midPoint.x + (tx - cam.midPoint.x) * Math.min(1, dt * 7);
    const cy = cam.midPoint.y + (ty - cam.midPoint.y) * Math.min(1, dt * 7);
    cam.centerOn(cx, cy);
    if (this.ow) {
      this.walkClock = this.moving ? this.walkClock + dt * 1000 : 0;
      const fr = owFrame(this.ow.entity, this.facing, this.moving, this.walkClock);
      this.player.setTexture(fr.key).setFlipX(false);
      if (fr.walkIndex !== this.lastWalkIdx) { if (fr.walkIndex === 1 || fr.walkIndex === 3) audio.sfx('step'); this.lastWalkIdx = fr.walkIndex; }
    } else this.player.setFlipX(this.facing === 'left');
    this.player.setPosition(Math.round(this.px), Math.round(this.py)).setDepth(this.py);
    this.shadow.setPosition(this.px, this.py - 2).setDepth(this.py - 0.5);
    const g = this.fxG; g.clear();
    const t = this.t / 1000;
    for (const e of this.ents) {
      const k = e.ent.kind;
      if (e.img) {
        e.img.setPosition(e.x, e.y).setDepth(e.y);
        if (k === 'ball') { e.img.y = e.y - 6 - Math.sin(t * 2.2) * 3; e.extra[0]?.setPosition(e.x, e.y - 20 - Math.sin(t * 2.2) * 3); }
        if (e.ent.ow && OVERWORLD[e.ent.ow]) {
          const dx = this.px - e.x, dy = this.py - e.y; const near = Math.hypot(dx, dy) < 120;
          const o = OVERWORLD[e.ent.ow]; const dir = near ? dirToward(dx, dy) : 'down';
          e.img.setTexture(owKey(e.ent.ow, dir, o.dirs[dir].idle[0]));
        } else if ((k === 'npc' || k === 'heal' || k === 'shop') && e.ent.dirs) {
          const dx = this.px - e.x, dy = this.py - e.y; const near = Math.hypot(dx, dy) < 120;
          const key = near ? (Math.abs(dx) > Math.abs(dy) * 1.2 ? e.ent.dirs.side : dy > 0 ? e.ent.dirs.down : e.ent.dirs.up) : e.ent.dirs.down;
          if (this.textures.exists('o_' + key)) e.img.setTexture('o_' + key);
          e.img.setFlipX(near && Math.abs(dx) > Math.abs(dy) * 1.2 ? dx < 0 : false);
        }
        if (k === 'chest' && !this.ctx.getState().flags['chest:' + e.ent.id]) { const a = (Math.sin(t * 4 + e.x) + 1) / 2; g.fillStyle(0xfff6a0, 0.4 + a * 0.5); const sx = e.x + 8, sy = e.y - e.img.displayHeight - 4; g.fillTriangle(sx, sy - 6, sx - 2, sy, sx + 2, sy); g.fillTriangle(sx, sy + 6, sx - 2, sy, sx + 2, sy); g.fillTriangle(sx - 6, sy, sx, sy - 2, sx, sy + 2); g.fillTriangle(sx + 6, sy, sx, sy - 2, sx, sy + 2); }
        if (k === 'save') e.extra[0]?.setScale(1 + Math.sin(t * 2) * 0.04);
      }
      if (k === 'exit') {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < 130) { const dirx = e.x < this.map.w * TILE / 2 ? -1 : 1; g.fillStyle(0xffe14a, 0.9); const ax = e.x - dirx * 8, ay = e.y; if (Math.abs(e.ent.w ?? 1) <= 1 || true) { const horiz = (e.ent.w ?? 1) <= (e.ent.h ?? 1); if (horiz) g.fillTriangle(ax + dirx * 10, ay, ax - dirx * 6, ay - 8, ax - dirx * 6, ay + 8); else { const up = e.y < this.map.h * TILE / 2 ? -1 : 1; g.fillTriangle(e.x, e.y + up * 10, e.x - 8, e.y - up * 6, e.x + 8, e.y - up * 6); } } }
      }
      if (e.ent.kind === 'foe') e.img?.setDepth(e.y);
    }
    const near = this.ctx.locked() ? null : this.nearestInteractable();
    if (near) {
      this.promptText.setPosition(near.x, near.y - (near.img?.displayHeight ?? 40) - 14 + Math.sin(t * 6) * 2).setVisible(true);
      this.labelText.setText(near.ent.label ?? '').setPosition(near.x, near.y + 12).setVisible(!!near.ent.label);
    } else { this.promptText.setVisible(false); this.labelText.setVisible(false); }
    // exit labels
    for (const e of this.ents) if (e.ent.kind === 'exit' && e.ent.label && Math.hypot(e.x - this.px, e.y - this.py) < 110) { this.labelText.setText(e.ent.label).setPosition(e.x, e.y - 22).setVisible(true); }
  }
}
