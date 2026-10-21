import Phaser from 'phaser';
import { buildStage, type BuiltStage } from './stageBackgrounds';
import { ActorView } from './ActorView';
import { Vfx } from '../animation/vfx';
import { GAME_SCALE } from '../gameScale';
import { audio } from '../audio/audio';
import { getSettings } from '../../systems/settings';
import type { Fighter } from '../../types';

const FONT = '"Press Start 2P", monospace';
const mk = (id: string, sprite: string, h: number, side: 'ally' | 'enemy'): Fighter => ({ uid: id, defId: id, side, name: id, sprite, slot: 0, level: 1, stats: { hp: 1, ki: 1, atk: 1, def: 1, spd: 1 }, hp: 1, ki: 1, rage: 0, statuses: [], defending: false, alive: true, skills: [], heightPx: h, form: 'x', phaseIdx: 0, turnsTaken: 0, boss: false, chargeDmg: 0, rageGainMult: 1, ssj: false, actedThisRound: false });

/** The Super Saiyan awakening: a dedicated, authored beat sequence (not a stat change under a gold overlay). */
export class CutsceneScene extends Phaser.Scene {
  private bg!: BuiltStage; private vfx!: Vfx;
  private goku!: ActorView; private frieza!: ActorView;
  private t = 0; private beat = -1; private done = false;
  private onDone: () => void = () => {};
  private flashR!: Phaser.GameObjects.Rectangle; private flashA = 0;
  private rocks: { img: Phaser.GameObjects.Image; vy: number; sway: number }[] = [];
  private bolts!: Phaser.GameObjects.Graphics; private ring!: Phaser.GameObjects.Graphics; private ringT = -1;
  private title!: Phaser.GameObjects.Text; private sub!: Phaser.GameObjects.Text;
  private zoomT = 1; private shake = 0; private focusY = 330;
  constructor() { super('cutscene'); }
  init(data: { onDone: () => void }) { this.onDone = data.onDone; this.t = 0; this.beat = -1; this.done = false; this.rocks = []; this.ringT = -1; this.flashA = 0; this.zoomT = 1; this.shake = 0; }

  create() {
    const k = GAME_SCALE.k;
    this.bg = buildStage(this, 'final'); this.vfx = new Vfx(this);
    this.goku = new ActorView(this, mk('g', 'goku', 168, 'ally'), { x: 330, y: 392 }, this.vfx, false, k);
    this.frieza = new ActorView(this, mk('f', 'frieza4', 150, 'enemy'), { x: 640, y: 392 }, this.vfx, false, k);
    this.goku.setPose('guard');
    this.flashR = this.add.rectangle(0, 0, 960, 540, 0xffffff, 0).setOrigin(0).setDepth(3600);
    this.bolts = this.add.graphics().setDepth(1500); this.ring = this.add.graphics().setDepth(1400);
    this.title = this.add.text(480, 120, '', { fontFamily: FONT, fontSize: '44px', color: '#ffe45a', stroke: '#7a3a00', strokeThickness: 10 }).setOrigin(0.5).setDepth(3700).setAlpha(0);
    this.sub = this.add.text(480, 175, '', { fontFamily: FONT, fontSize: '12px', color: '#ffffff', stroke: '#101a40', strokeThickness: 5 }).setOrigin(0.5).setDepth(3700).setAlpha(0);
    for (let i = 0; i < 9; i++) { const im = this.add.image(220 + i * 62, 410 + (i % 3) * 14, 'o_rock_s' + (1 + (i % 2))).setScale(0.4 + (i % 3) * 0.12).setDepth(380 + i); this.rocks.push({ img: im, vy: 0, sway: Math.random() * 6 }); }
    this.cameras.main.setZoom(k).centerOn(480, 270);
    (window as unknown as { __cut?: CutsceneScene }).__cut = this;
    this.events.once('shutdown', () => { this.bg.destroy(); this.vfx.clear(); this.goku.destroy(); this.frieza.destroy(); });
    audio.sfx('charge');
  }

  skip() { if (!this.done) this.finish(); }
  private finish() { this.done = true; this.onDone(); }
  manual = false;
  debugStep(ms: number) { for (let t = 0; t < ms; t += 16) this.frame(16); }
  update(_t: number, dt: number) { if (!this.manual) this.frame(Math.min(dt, 50)); }

  private frame(dt: number) {
    if (this.done) return;
    this.t += dt; const t = this.t / 1000;
    const k = GAME_SCALE.k;
    // beats
    const at = (n: number, fn: () => void) => { if (this.beat < n && t >= [0, 1.6, 4.4, 4.9, 8.5][n]) { this.beat = n; fn(); } };
    at(0, () => { this.goku.setAura(true, 'red'); });
    at(1, () => { this.goku.setAura(true, 'purple'); this.zoomT = 1.45; this.focusY = 330; this.rocks.forEach((r, i) => { r.vy = -14 - (i % 4) * 8; }); audio.sfx('charge'); });
    at(2, () => { this.flashA = 1; audio.sfx('transform'); this.shake = 14; });
    at(3, () => {
      this.goku.setAura(false, ''); this.goku.setForm('goku_ssj'); this.goku.setPose('charge');
      this.vfx.sprite('transformation_flash', this.goku.chest, 7); this.vfx.sprite('shockwave', { x: this.goku.feet.x, y: this.goku.feet.y - 8 }, 8, 0.9);
      this.ringT = 0; this.title.setText('SUPER SAIYAN').setAlpha(1); this.sub.setText('A legend born from rage and sorrow.').setAlpha(1); this.frieza.flash(160);
      this.zoomT = 1.25; this.shake = 10; audio.duck(0.25, 3500); this.goku.heightPx = 168;
    });
    at(4, () => { this.finish(); });
    // electricity during the build-up
    const g = this.bolts; g.clear();
    if (t > 1.6 && t < 4.6) {
      const c = this.goku.chest; const n = 3 + Math.floor((t - 1.6) * 2);
      for (let i = 0; i < n; i++) { g.lineStyle(2 + (i % 2), i % 2 ? 0xfff6a0 : 0xffffff, 0.9); g.beginPath(); let x = c.x, y = c.y; g.moveTo(x, y); const ang = Math.random() * Math.PI * 2; for (let s = 0; s < 5; s++) { x += Math.cos(ang + (Math.random() - 0.5)) * 24; y += Math.sin(ang + (Math.random() - 0.5)) * 24; g.lineTo(x, y); } g.strokePath(); }
    }
    // floating rocks
    this.rocks.forEach((r) => { if (r.vy !== 0) { r.img.y += r.vy * dt / 1000; r.img.x += Math.sin(t * 3 + r.sway) * 0.2; r.vy *= 0.998; r.img.setDepth(3000); } });
    // shockwave
    this.ring.clear();
    if (this.ringT >= 0) { this.ringT += dt; const u = this.ringT / 1100; if (u < 1) { const c = this.goku.chest; this.ring.lineStyle(10 * (1 - u) + 2, 0xffe45a, 1 - u).strokeCircle(c.x, c.y, 40 + u * 520); this.ring.lineStyle(4, 0xffffff, 0.8 * (1 - u)).strokeCircle(c.x, c.y, 20 + u * 380); } }
    // camera
    const cam = this.cameras.main; const z = cam.zoom / k; const nz = z + (this.zoomT - z) * Math.min(1, dt / 500);
    this.shake = Math.max(0, this.shake - dt / 60); const amp = getSettings().screenShake ? this.shake + (t > 1.6 && t < 4.4 ? 2 : 0) : 0;
    cam.setZoom(k * nz);
    const hw = 480 / nz, hh = 270 / nz; const clampc = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    cam.centerOn(clampc(this.goku.feet.x + (nz - 1) * 100, hw, 960 - hw) + (Math.random() - 0.5) * amp, clampc(this.focusY - (nz - 1) * 120, hh, 540 - hh) + (Math.random() - 0.5) * amp);
    if (this.flashA > 0) { this.flashA = Math.max(0, this.flashA - dt / 520); this.flashR.setAlpha(getSettings().reducedFlash ? Math.min(0.2, this.flashA) : this.flashA).setFillStyle(0xffffff); }
    if (t > 4.9 && t < 8.5) { this.title.setScale(1 + Math.sin(t * 6) * 0.015); }
    this.bg.update(dt); this.vfx.update(dt); this.goku.update(dt); this.frieza.update(dt);
  }
}
