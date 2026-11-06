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
import { OVERWORLD, OW_SCALE, dirFromVector, dirToward, owFrame, owKey, type Dir } from '../world/overworld';
import { firstPad } from '../../systems/gamepad';
import { getSettings } from '../../systems/settings';

const FONT = '"Press Start 2P", monospace';
const AVATAR_H = 66;
const INTERACTABLE = new Set(['npc', 'chest', 'save', 'heal', 'ball', 'sign', 'shop']);

interface EntView { ent: Ent; img?: Phaser.GameObjects.Image; x: number; y: number; extra: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform)[]; patrolIdx: number; baseY: number; facing: Dir; moving: boolean; walkClock: number; idlePhaseMs: number; solid?: Rect }
interface Rect { x: number; y: number; w: number; h: number }
interface Ambient { x: number; y: number; phase: number; speed: number; size: number }
interface PropMotion { image: Phaser.GameObjects.Image; aura?: Phaser.GameObjects.Ellipse; phase: number; tree: boolean; crystal: boolean }

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
  private ambientG!: Phaser.GameObjects.Graphics;
  private riftG!: Phaser.GameObjects.Graphics;
  private ambient: Ambient[] = [];
  private propMotion: PropMotion[] = [];
  private ambientFrameAcc = 0;
  private ambientCalm: boolean | undefined;
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
    this.noEncounters = false; this.solids = []; this.ents = []; this.staticObjs = []; this.propMotion = []; this.waterTile = null; this.voidWater = null; this.yielded = false; this.inZone.clear(); this.t = 0; this.lastVersion = -1;
    const W = m.w * TILE, H = m.h * TILE;
    const outsideTone = m.sky === 'cave' ? 0x111a30 : m.sky === 'ship' ? 0x15142b : m.sky === 'ice' ? 0x1b1a52 : m.sky === 'final' ? 0x170c16 : 0x173740;
    this.cameras.main.setBackgroundColor(outsideTone).setBounds(W >= LOGICAL_W ? 0 : -(LOGICAL_W - W) / 2, H >= LOGICAL_H ? 0 : -(LOGICAL_H - H) / 2, Math.max(W, LOGICAL_W), Math.max(H, LOGICAL_H));
    this.paintTerrain();
    this.placeObjects();
    const s = ctx.getState();
    this.px = s.x * TILE; this.py = s.y * TILE; this.facing = s.facing;
    this.shadow = this.add.ellipse(0, 0, 30, 10, 0x06140f, 0.4).setDepth(1);
    this.leadSprite = ctx.leadSprite();
    this.player = this.add.image(0, 0, texKey(this.leadSprite, 'idle')).setOrigin(ANCHOR_X, ANCHOR_Y);
    this.moving = false; this.walkClock = 0; this.lastWalkIdx = -1;
    this.applyAvatar();
    this.makeAmbient();
    this.fxG = this.add.graphics().setDepth(5000);
    this.ambientG = this.add.graphics().setDepth(0);
    this.riftG = this.add.graphics().setDepth(0);
    this.promptText = this.add.text(0, 0, 'E', { fontFamily: FONT, fontSize: '10px', color: '#101a40', backgroundColor: '#ffe14a', padding: { x: 4, y: 3 } }).setOrigin(0.5).setDepth(5100).setVisible(false);
    this.labelText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '8px', color: '#ffffff', stroke: '#101a40', strokeThickness: 4 }).setOrigin(0.5).setDepth(5100).setVisible(false);
    this.encThreshold = this.rollThreshold();
    this.graceUntil = 400;
    this.rebuildEntities();
    this.cameraSnap();
    (window as unknown as { __world?: WorldScene }).__world = this;
    this.events.once('shutdown', () => { this.staticObjs.forEach((o) => o.destroy()); this.ents.forEach((e) => this.destroyEnt(e)); this.ents = []; this.riftG?.destroy(); this.waterTile = null; this.voidWater = null; this.yielded = false; });
  }

  // ---------------- terrain ----------------
  private cell(x: number, y: number): string { const r = this.map.ground[y]; return r ? r[x] ?? 'x' : 'x'; }
  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T { this.staticObjs.push(o); return o; }

  private maskFor(pred: (c: string) => boolean, dy = 0, wobble = 0): Phaser.Display.Masks.GeometryMask {
    const g = this.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    const m = this.map;
    if (wobble > 0) {
      const mapSeed = [...m.id].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) | 0, 17);
      const jitter = (x: number, y: number, side: number) => {
        let h = Math.imul(x + mapSeed, 0x45d9f3b) ^ Math.imul(y + side * 17, 0x119de1f3);
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
        return ((h >>> 0) % (wobble * 2 + 1)) - wobble;
      };
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (pred(this.cell(x, y))) {
        const left = x * TILE + (pred(this.cell(x - 1, y)) ? 0 : jitter(x, y, 0));
        const right = (x + 1) * TILE + (pred(this.cell(x + 1, y)) ? 0 : jitter(x, y, 1));
        const top = y * TILE + (pred(this.cell(x, y - 1)) ? 0 : jitter(x, y, 2));
        const bottom = (y + 1) * TILE + (pred(this.cell(x, y + 1)) ? 0 : jitter(x, y, 3));
        g.fillRect(left, top + dy, right - left + 0.5, bottom - top + 0.5);
      }
      return g.createGeometryMask();
    }
    for (let y = 0; y < m.h; y++) {
      let start = -1;
      const span = (end: number) => {
        if (start < 0) return;
        // Merge each row into horizontal spans: the authored grid retains its crisp
        // tile contour while the mask uses far fewer draw commands at runtime.
        g.fillRect(start * TILE, y * TILE + dy, (end - start) * TILE + 0.5, TILE + 0.5);
        start = -1;
      };
      for (let x = 0; x < m.w; x++) {
        if (pred(this.cell(x, y))) { if (start < 0) start = x; }
        else span(x);
      }
      span(m.w);
    }
    return g.createGeometryMask();
  }

  private paintTerrain() {
    const m = this.map, W = m.w * TILE, H = m.h * TILE;
    const tex = (k: string) => this.textures.exists(k);
    const voidTone = m.sky === 'cave' ? 0x111a30 : m.sky === 'ship' ? 0x15142b : m.sky === 'ice' ? 0x1b1a52 : m.sky === 'final' ? 0x170c16 : 0x173740;
    const bg = this.add.rectangle(0, 0, W, H, voidTone).setOrigin(0).setDepth(-1000); this.staticObjs.push(bg);
    if (m.sky === 'day') {
      const grass = tex('t_grass_namek_v3') ? 't_grass_namek_v3' : tex('t_grass_namek_v2') ? 't_grass_namek_v2' : 't_grass';
      if (tex(grass)) {
        const grassScale = grass === 't_grass_namek_v3' ? 0.18 : grass === 't_grass_namek_v2' ? 0.10 : 0.9;
        const grassTint: Record<string, number> = { shore: 0xc6dcb6, village: 0xc2dcae, landing: 0xadb997, guru: 0xcde0b0, ridge: 0xb9d2af };
        // Use the broad authored meadow texture as the actual field surface. The old
        // 56px noise tile repeated every few steps and made the whole world look stamped.
        const overscan = 160;
        this.keep(this.add.tileSprite(-overscan, -overscan, W + overscan * 2, H + overscan * 2, grass)
          .setOrigin(0).setDepth(-900).setTileScale(grassScale).setTint(grassTint[m.id] ?? 0xc5d9b6).setAlpha(0.96));
        // Low-contrast blade marks break up the repeated grass tile without competing with props.
        const detail = this.keep(this.add.graphics().setDepth(-899));
        let seed = m.w * 233 + m.h * 811 + 19; const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
        const marks = Math.round(m.w * m.h * 0.18);
        for (let i = 0; i < marks; i++) {
          const x = Math.floor(rand() * m.w), y = Math.floor(rand() * m.h);
          if (this.cell(x, y) !== '.') continue;
          const px = x * TILE + 3 + rand() * (TILE - 6), py = y * TILE + 4 + rand() * (TILE - 8);
          detail.lineStyle(1, rand() > 0.5 ? 0x83c969 : 0x398957, 0.18 + rand() * 0.12);
          detail.beginPath().moveTo(px, py + 2); detail.lineTo(px + 1 + rand() * 3, py - 1); detail.strokePath();
          if (i % 5 === 0) detail.fillStyle(0xb3da70, 0.18).fillCircle(px + 4, py + 3, 0.8);
        }
      }
      const pathMaterial: Record<string, string> = { shore: 'namek_sand', village: 'namek_sacred_stone', landing: 'frieza_camp_earth', guru: 'namek_sacred_stone', ridge: 'namek_ridge_gravel' };
      const pathTint: Record<string, number> = { shore: 0xfff3d5, village: 0xf0e8cb, landing: 0xe2c5a6, guru: 0xf2e9c9, ridge: 0xe0e4ce };
      const pathKey = 't_' + (pathMaterial[m.id] ?? 'dirt');
      const pathScale = pathKey === 't_dirt' ? 0.85 : 0.12;
      if (tex(pathKey)) {
        const d = this.keep(this.add.tileSprite(0, 0, W, H, pathKey).setOrigin(0).setDepth(-880).setTileScale(pathScale).setTint(pathTint[m.id] ?? 0xffffff));
        d.setMask(this.maskFor((c) => c === ',', 0, 3));
      }
      if (tex('t_water')) {
        const w = this.keep(this.add.tileSprite(0, 0, W, H, 't_water').setOrigin(0).setDepth(-870).setTileScale(1));
        w.setMask(this.maskFor((c) => c === '~', 0, 4));
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
      const iceSurface = tex('t_cooler_ice_surface') ? 't_cooler_ice_surface' : 't_ice';
      if (tex(iceSurface)) { const ice = this.keep(this.add.tileSprite(0, 0, W, H, iceSurface).setOrigin(0).setDepth(-900).setTileScale(iceSurface === 't_ice' ? 0.9 : 0.12)); ice.setMask(this.maskFor((c) => c === 'i', 0, 3)); }
      if (tex('t_water')) { const pool = this.keep(this.add.tileSprite(0, 0, W, H, 't_water').setOrigin(0).setDepth(-890).setTileScale(1).setTint(0xb9a6ff)); pool.setMask(this.maskFor((c) => c === '~', 0, 3)); this.waterTile = pool; }
    } else if (m.sky === 'ship') {
      const g = this.keep(this.add.graphics().setDepth(-900));
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === 'm') {
        g.fillStyle((x + y) % 2 ? 0x3a3868 : 0x343262, 1).fillRect(x * TILE, y * TILE, TILE, TILE);
        g.lineStyle(1, 0x5a589a, 0.6).strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
        if (x % 4 === 1 && y % 4 === 1) g.fillStyle(0x7fe8ff, 0.5).fillRect(x * TILE + 12, y * TILE + 12, 8, 8);
      }
    } else if (m.sky === 'cave') {
      const caveFloor = tex('t_namek_cave_stone') ? 't_namek_cave_stone' : 't_dirt';
      if (tex(caveFloor)) { const d = this.keep(this.add.tileSprite(0, 0, W, H, caveFloor).setOrigin(0).setDepth(-900).setTileScale(caveFloor === 't_dirt' ? 0.85 : 0.12)); d.setMask(this.maskFor((c) => c === 'c', 0, 3)); }
      // Keep cave light anchored to the crystal formations instead of scattering broad,
      // disconnected circles over the walkable floor.
      const glow = this.keep(this.add.graphics().setDepth(-890));
      for (const crystal of m.objs.filter((o) => o.o.includes('crystal') || o.o === 'crystals')) {
        const x = crystal.x * TILE, y = crystal.y * TILE - 16;
        glow.fillStyle(0x4ebdff, 0.025).fillCircle(x, y, 72);
        glow.fillStyle(0x70d9ff, 0.035).fillCircle(x, y, 36);
      }
    } else if (m.sky === 'final') {
      const sky = this.keep(this.add.graphics().setDepth(-950)); sky.fillGradientStyle(0x2a0a18, 0x2a0a18, 0xff7a2a, 0xff7a2a, 1); sky.fillRect(0, 0, W, 4 * TILE + 8);
      sky.fillStyle(0xffd27a, 0.45).fillEllipse(W / 2, 4 * TILE, W * 0.8, 80);
      const cinder = tex('t_namek_cinder_rock') ? 't_namek_cinder_rock' : 't_dirt';
      if (tex(cinder)) this.keep(this.add.tileSprite(0, 4 * TILE, W, H - 4 * TILE, cinder).setOrigin(0).setDepth(-900).setTileScale(cinder === 't_dirt' ? 0.85 : 0.12));
      if (tex('t_dirt')) { const d = this.keep(this.add.tileSprite(0, 0, W, H, 't_dirt').setOrigin(0).setDepth(-880).setTileScale(0.85).setTint(0xc89a7a)); d.setMask(this.maskFor((c) => c === ',', 0, 3)); }
      const cr = this.keep(this.add.graphics().setDepth(-870)); cr.lineStyle(1.5, 0xff7a2a, 0.52);
      let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 5; i++) {
        let x = r() * W, y = 4 * TILE + 12 + r() * Math.max(1, H - 4 * TILE - 24);
        cr.beginPath().moveTo(x, y);
        for (let s = 0; s < 3; s++) { x += (r() - 0.5) * 52; y += (r() - 0.5) * 28; cr.lineTo(x, y); }
        cr.strokePath();
      }
    }
    this.paintTerrainTransitions();
    // generic shadowed edge for void cells
    const vg = this.keep(this.add.graphics().setDepth(-860));
    const voidFill = m.sky === 'ice' ? 0x1b1a52 : m.sky === 'cave' ? 0x111a30 : m.sky === 'ship' ? 0x15142b : 0x173740;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === 'x' && m.sky !== 'final' && !this.voidWater) vg.fillStyle(voidFill, 1).fillRect(x * TILE, y * TILE, TILE, TILE);
  }

  /** Adds hand-shaped visual transitions over the grid without changing its gameplay cells. */
  private paintTerrainTransitions() {
    const m = this.map;
    const g = this.keep(this.add.graphics().setDepth(-850));
    let seed = [...m.id].reduce((n, c) => (n * 33 + c.charCodeAt(0)) >>> 0, 5381);
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
    const edge = (x: number, y: number, horizontal: boolean, water: boolean) => {
      const center = horizontal ? (y + 1) * TILE : (x + 1) * TILE;
      const along = horizontal ? x * TILE : y * TILE;
      // A few irregular glints soften water and ice edges without outlining every tile.
      for (let i = 0; i < 2; i++) {
        const a = along + 2 + rand() * (TILE - 10);
        const len = 2 + rand() * 5;
        const offset = (rand() - 0.5) * (water ? 10 : 6);
        const color = rand() > 0.38 ? 0xb4f5e7 : 0xe2fff2;
        g.lineStyle(water ? 1.5 : 1, color, water ? 0.38 : 0.2).beginPath();
        if (horizontal) g.moveTo(a, center + offset).lineTo(a + len, center + offset + (rand() - 0.5) * 2);
        else g.moveTo(center + offset, a).lineTo(center + offset + (rand() - 0.5) * 2, a + len);
        g.strokePath();
      }
    };

    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const here = this.cell(x, y);
      const right = this.cell(x + 1, y), down = this.cell(x, y + 1);
      if ((here === '~' && right !== '~' && right !== 'x') || (right === '~' && here !== 'x' && here !== '~')) edge(x, y, false, true);
      if ((here === '~' && down !== '~' && down !== 'x') || (down === '~' && here !== 'x' && here !== '~')) edge(x, y, true, true);
      if (m.sky === 'ice') {
        if (((here === 'i' || here === '~') && right === 'x') || ((right === 'i' || right === '~') && here === 'x')) edge(x, y, false, true);
        if (((here === 'i' || here === '~') && down === 'x') || ((down === 'i' || down === '~') && here === 'x')) edge(x, y, true, true);
      }
    }

    // Biome-specific ground marks establish scale and material: beach foam, village-set stones,
    // camp wheel ruts, cold glints, and restrained ship-floor seams.
    if (m.id === 'shore') {
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === '~' && rand() < 0.11) {
        g.fillStyle(0xe7fff5, 0.18).fillEllipse(x * TILE + 7 + rand() * 18, y * TILE + 7 + rand() * 18, 5 + rand() * 6, 0.8);
      }
    } else if (m.id === 'village' || m.id === 'guru') {
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === ',' && rand() < 0.08) {
        const px = x * TILE + 6 + rand() * 20, py = y * TILE + 7 + rand() * 18;
        g.fillStyle(m.id === 'guru' ? 0xbca985 : 0xb49a69, 0.28).fillRoundedRect(px, py, 3 + rand() * 4, 2 + rand() * 3, 1);
        g.fillStyle(0xeadbb5, 0.18).fillRect(px + 1, py, 2, 1);
      }
    } else if (m.id === 'landing' || m.id === 'ridge') {
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === ',' && rand() < 0.11) {
        const px = x * TILE + 5 + rand() * 19, py = y * TILE + 5 + rand() * 21;
        g.fillStyle(m.id === 'landing' ? 0x754d34 : 0x777465, 0.2).fillEllipse(px, py, 3 + rand() * 5, 2 + rand() * 3);
      }
    } else if (m.sky === 'ice') {
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === 'i' && rand() < 0.17) {
        const px = x * TILE + 5 + rand() * 21, py = y * TILE + 5 + rand() * 21;
        g.lineStyle(1, 0xe2f9ff, 0.14 + rand() * 0.12).beginPath().moveTo(px, py).lineTo(px + 3 + rand() * 7, py + 2 + rand() * 5).strokePath();
      }
    } else if (m.sky === 'ship') {
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (this.cell(x, y) === 'm' && (x + y) % 3 === 0) {
        g.fillStyle(0xaaa9d0, 0.12).fillRect(x * TILE + 4, y * TILE + 4, 1, 1);
        g.fillStyle(0x17162d, 0.22).fillRect(x * TILE + 4, y * TILE + 27, TILE - 8, 1);
      }
    }
  }

  private placeObjects() {
    for (const o of this.map.objs) {
      const key = 'o_' + o.o; if (!this.textures.exists(key)) continue;
      const im = this.keep(this.add.image(o.x * TILE, o.y * TILE, key).setOrigin(0.5, 1).setScale(o.s).setFlipX(!!o.flip).setDepth(o.y * TILE + (o.depthBias ?? 0)));
      if (o.tint !== undefined) im.setTint(o.tint);
      const tree = o.o.includes('tree'), crystal = o.o.includes('crystal') || o.o === 'crystals';
      if (tree || crystal) {
        const phase = ((o.x * 127 + o.y * 311 + o.o.length * 29) % 628) / 100;
        let aura: Phaser.GameObjects.Ellipse | undefined;
        if (crystal) {
          const ice = this.map.sky === 'ice';
          aura = this.keep(this.add.ellipse(o.x * TILE, o.y * TILE - im.displayHeight * 0.34, Math.max(18, im.displayWidth * 0.56), Math.max(8, im.displayHeight * 0.22), ice ? 0x9cefff : 0x6deaff, 0.075)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(im.depth - 0.5));
        }
        this.propMotion.push({ image: im, aura, phase, tree, crystal });
      }
      if (o.solid) this.solids.push({ x: o.x * TILE - (o.solid[0] * TILE) / 2, y: o.y * TILE - o.solid[1] * TILE, w: o.solid[0] * TILE, h: o.solid[1] * TILE });
    }
  }

  /** Small biome-specific motion keeps the field alive without changing map geometry or collision. */
  private makeAmbient() {
    let seed = this.map.w * 92821 + this.map.h * 68917 + this.map.id.length * 104729;
    const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const count = Math.max(14, Math.min(24, Math.round(this.map.w * this.map.h / 48)));
    this.ambient = Array.from({ length: count }, () => ({ x: rand() * this.map.w * TILE, y: rand() * this.map.h * TILE, phase: rand() * Math.PI * 2, speed: 5 + rand() * 15, size: 0.7 + rand() * 1.5 }));
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
      const idlePhaseMs = [...ent.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 6800;
      const ev: EntView = { ent, x: ent.x * TILE, y: ent.y * TILE, extra: [], patrolIdx: 0, baseY: ent.y * TILE, facing: 'down', moving: false, walkClock: 0, idlePhaseMs };
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
    let crossedTile = false;
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
          if (this.stepAcc >= TILE) { this.stepAcc -= TILE; crossedTile = true; if (this.inEncounterZone()) { this.encSteps++; if (this.encSteps >= this.encThreshold) { this.encSteps = 0; this.encThreshold = this.rollThreshold(); ctx.onEncounter(); this.yielded = true; } } }
        }
      }
      if (consume('e', 'E', 'Enter', ' ')) this.tryInteract();
    }
    if (this.yielded) { this.yielded = false; return; }
    // persist transform into state (single source of truth)
    const s = ctx.getState(); s.x = this.px / TILE; s.y = this.py / TILE; s.facing = this.facing;
    if (crossedTile) ctx.onStep();
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
      e.moving = false;
      const p = e.ent.foe?.patrol;
      if (p && p.length > 1 && e.img) {
        const toPlayerX = this.px - e.x, toPlayerY = this.py - e.y;
        if (Math.hypot(toPlayerX, toPlayerY) < 120) {
          e.facing = dirToward(toPlayerX, toPlayerY); e.walkClock = 0;
        } else {
          const tgt = p[(e.patrolIdx + 1) % p.length]; const tx = tgt[0] * TILE, ty = tgt[1] * TILE;
          const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
          if (d < 2) e.patrolIdx = (e.patrolIdx + 1) % p.length;
          else {
            const stride = Math.min(d, 38 * dt); e.x += (dx / d) * stride; e.y += (dy / d) * stride;
            e.facing = dirFromVector(dx, dy, e.facing); e.moving = stride > 0.01; e.walkClock = e.moving ? e.walkClock + dt * 1000 : 0;
          }
        }
      } else if (e.img && e.ent.ow && Math.hypot(this.px - e.x, this.py - e.y) < 120) {
        e.facing = dirToward(this.px - e.x, this.py - e.y);
      }
      if (this.graceUntil <= 0 && Math.hypot(e.x - this.px, (e.y - this.py) * 1.4) < 34) { this.ctx.onFoe(e.ent); this.yielded = true; return; }
    }
  }

  private cameraSnap() { const c = this.cameras.main; c.setZoom(GAME_SCALE.k); c.centerOn(this.px, this.py - 20); }

  /** Keep small world HUD labels readable when an exit or interactable sits at a screen edge. */
  private placeHudText(text: Phaser.GameObjects.Text, x: number, y: number, margin = 8) {
    const view = this.cameras.main.worldView;
    const halfW = text.displayWidth * 0.5, halfH = text.displayHeight * 0.5;
    text.setPosition(
      Phaser.Math.Clamp(x, view.x + halfW + margin, view.right - halfW - margin),
      Phaser.Math.Clamp(y, view.y + halfH + margin, view.bottom - halfH - margin),
    );
  }

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
    const reducedMotion = getSettings().reducedFlash;
    for (const prop of this.propMotion) {
      prop.image.setAngle(prop.tree && !reducedMotion ? Math.sin(t * 0.7 + prop.phase) * 0.32 : 0);
      if (prop.crystal) prop.aura?.setAlpha(reducedMotion ? 0.06 : 0.045 + (Math.sin(t * 1.5 + prop.phase) + 1) * 0.027);
    }
    this.drawAmbient(dt, t);
    this.drawRift(t);
    for (const e of this.ents) {
      const k = e.ent.kind;
      if (e.img) {
        e.img.setPosition(e.x, e.y).setDepth(e.y);
        if (k === 'ball') { e.img.y = e.y - 6 - Math.sin(t * 2.2) * 3; e.extra[0]?.setPosition(e.x, e.y - 20 - Math.sin(t * 2.2) * 3); }
        if (e.ent.ow && OVERWORLD[e.ent.ow]) {
          const o = OVERWORLD[e.ent.ow];
          if (k === 'foe' && e.ent.foe?.patrol?.length) {
            const fr = owFrame(e.ent.ow, e.facing, e.moving, e.walkClock); e.img.setTexture(fr.key).setFlipX(false);
          } else {
            const dx = this.px - e.x, dy = this.py - e.y; const near = Math.hypot(dx, dy) < 120;
            const dir = near ? dirToward(dx, dy) : e.ent.ow === 'cooler' ? 'left' : 'down';
            const cycle = (t * 1000 + e.idlePhaseMs) % 6800;
            const fidget = (k === 'npc' || k === 'shop' || k === 'heal') && o.dirs[dir].walk.length > 0 && cycle >= 4500 && cycle < 5300;
            const key = fidget ? owFrame(e.ent.ow, dir, true, cycle - 4500).key : owKey(e.ent.ow, dir, o.dirs[dir].idle[0]);
            e.img.setTexture(key).setFlipX(false);
          }
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
        if (d < 130) { const dirx = e.x < this.map.w * TILE / 2 ? -1 : 1; g.fillStyle(0xffe14a, 0.72 + Math.sin(t * 4) * 0.18); const ax = e.x - dirx * 8, ay = e.y; const horiz = (e.ent.w ?? 1) <= (e.ent.h ?? 1); if (horiz) g.fillTriangle(ax + dirx * 10, ay, ax - dirx * 6, ay - 8, ax - dirx * 6, ay + 8); else { const up = e.y < this.map.h * TILE / 2 ? -1 : 1; g.fillTriangle(e.x, e.y + up * 10, e.x - 8, e.y - up * 6, e.x + 8, e.y - up * 6); } }
      }
      if (e.ent.kind === 'foe') e.img?.setDepth(e.y);
    }
    const near = this.ctx.locked() ? null : this.nearestInteractable();
    if (near) {
      this.promptText.setText(firstPad() ? 'E / A' : 'E');
      this.placeHudText(this.promptText, near.x, near.y - (near.img?.displayHeight ?? 40) - 14 + Math.sin(t * 6) * 2);
      this.promptText.setVisible(true);
      this.labelText.setText(near.ent.label ?? ''); this.placeHudText(this.labelText, near.x, near.y + 12); this.labelText.setVisible(!!near.ent.label);
    } else { this.promptText.setVisible(false); this.labelText.setVisible(false); }
    // exit labels
    for (const e of this.ents) if (e.ent.kind === 'exit' && e.ent.label && Math.hypot(e.x - this.px, e.y - this.py) < 110) { this.labelText.setText(e.ent.label); this.placeHudText(this.labelText, e.x, e.y - 78); this.labelText.setVisible(true); }
  }

  private drawAmbient(dt: number, t: number) {
    const calm = getSettings().reducedFlash;
    this.ambientFrameAcc += dt;
    const modeChanged = calm !== this.ambientCalm;
    if (!modeChanged && (calm || this.ambientFrameAcc < 0.05)) return;
    const stepDt = Math.min(this.ambientFrameAcc, 0.1); this.ambientFrameAcc = 0; this.ambientCalm = calm;
    const g = this.ambientG; g.clear();
    const W = this.map.w * TILE, H = this.map.h * TILE;
    const palette = this.map.sky === 'final' ? [0xff783f, 0xffc66b] : this.map.sky === 'ice' ? [0xc7edff, 0xf4fbff] : this.map.sky === 'cave' ? [0x61eaff, 0x9ffff2] : this.map.sky === 'ship' ? [0x77cfff, 0xd9f6ff] : [0xeaffcd, 0xb9f4eb];
    const snow = this.map.sky === 'ice', embers = this.map.sky === 'final';
    for (let i = 0; i < this.ambient.length; i++) {
      const p = this.ambient[i]; const drift = Math.sin(t * 0.7 + p.phase) * 5;
      if (!calm) {
        p.y += (snow ? p.speed : embers ? -p.speed * 0.75 : Math.sin(t + p.phase) * 1.2) * stepDt;
        p.x += (snow ? Math.sin(t * 0.9 + p.phase) * 8 : embers ? Math.sin(t * 1.7 + p.phase) * 4 : p.speed * 0.28) * stepDt;
      }
      if (p.y < -4) p.y = H + 4; if (p.y > H + 4) p.y = -4;
      if (p.x < -4) p.x = W + 4; if (p.x > W + 4) p.x = -4;
      const a = calm ? 0.2 : 0.14 + (Math.sin(t * (embers ? 5 : 2) + p.phase) + 1) * (embers ? 0.17 : 0.09);
      g.fillStyle(palette[i % palette.length], a).fillCircle(p.x + (calm ? 0 : drift), p.y, p.size * (snow ? 1.1 : 1));
    }
  }

  /** The postgame rift is a real map event: its cold fracture lights up as soon as the route flag is set. */
  private drawRift(t: number) {
    const g = this.riftG; g.clear();
    if (this.map.id !== 'ridge' || !this.ctx.getState().flags.cooler_trail_open) return;
    const marker = this.ents.find((e) => e.ent.id === 'ridge_rift'); if (!marker) return;
    const calm = getSettings().reducedFlash, pulse = calm ? 0.66 : 0.6 + (Math.sin(t * 1.7) + 1) * 0.1;
    const x = marker.x, y = marker.y - 35;
    // Keep the tear behind actors and the crystal, but large enough to frame the landmark.
    g.setDepth(marker.y - 0.5);
    g.fillStyle(0x873fff, pulse * 0.15).fillEllipse(x, y - 74, 128, 238);
    g.fillStyle(0x4ceaff, pulse * 0.18).fillEllipse(x, y - 76, 74, 214);
    // Layered angular seams create a readable frozen-glass fracture at game scale.
    g.lineStyle(8, 0x7547e8, pulse * 0.7);
    g.beginPath(); g.moveTo(x - 3, y + 24); g.lineTo(x + 7, y + 5); g.lineTo(x - 6, y - 16); g.lineTo(x + 12, y - 38); g.lineTo(x - 4, y - 61); g.lineTo(x + 12, y - 83); g.lineTo(x - 7, y - 105); g.lineTo(x + 5, y - 128); g.lineTo(x - 8, y - 151); g.strokePath();
    g.lineStyle(4, 0x43dfff, pulse * 0.95);
    g.beginPath(); g.moveTo(x - 3, y + 24); g.lineTo(x + 7, y + 5); g.lineTo(x - 6, y - 16); g.lineTo(x + 12, y - 38); g.lineTo(x - 4, y - 61); g.lineTo(x + 12, y - 83); g.lineTo(x - 7, y - 105); g.lineTo(x + 5, y - 128); g.lineTo(x - 8, y - 151); g.strokePath();
    g.lineStyle(2, 0xe6fcff, calm ? 0.66 : 0.6 + (Math.sin(t * 2.4) + 1) * 0.2);
    g.beginPath(); g.moveTo(x, y + 22); g.lineTo(x + 3, y + 2); g.lineTo(x - 2, y - 18); g.lineTo(x + 6, y - 39); g.lineTo(x - 1, y - 62); g.lineTo(x + 5, y - 84); g.lineTo(x - 3, y - 106); g.lineTo(x + 3, y - 129); g.lineTo(x - 4, y - 150); g.strokePath();
    g.lineStyle(3, 0x8fefff, pulse * 0.9);
    g.beginPath(); g.moveTo(x + 2, y - 25); g.lineTo(x + 24, y - 37); g.lineTo(x + 35, y - 60); g.moveTo(x - 4, y - 75); g.lineTo(x - 28, y - 88); g.lineTo(x - 38, y - 111); g.moveTo(x + 3, y - 124); g.lineTo(x + 23, y - 137); g.strokePath();
    g.lineStyle(3, 0x70eaff, pulse * 0.66).strokeEllipse(x, y + 14, 132, 23);
    g.lineStyle(1, 0xe7fcff, pulse * 0.7).strokeEllipse(x, y + 14, 94, 12);
    for (let i = 0; i < 8; i++) {
      const phase = calm ? i * Math.PI / 4 : t * 1.3 + i * Math.PI / 4;
      const sx = x + Math.cos(phase) * (44 + i % 2 * 13), sy = y - 76 + Math.sin(phase) * (75 + i % 2 * 14);
      g.fillStyle(i % 2 ? 0xc8f7ff : 0x6de6ff, calm ? 0.64 : 0.58 + Math.sin(phase) * 0.22).fillRect(Math.round(sx), Math.round(sy), 4, 4);
    }
  }
}
