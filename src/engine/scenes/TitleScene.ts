import Phaser from 'phaser';
import { ActorView } from './ActorView';
import { Vfx } from '../animation/vfx';
import { HEROES } from '../../data/heroes';
import { GAME_SCALE } from '../gameScale';
import { getSettings } from '../../systems/settings';
import type { Fighter } from '../../types';

/**
 * Title composition uses its own Namek landscape, not the generic battle stage.
 * The five reviewed fighters remain on a shared feet baseline and periodically
 * show their genuine authored punch drawings as a restrained showcase.
 */
export class TitleScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private ambience!: Phaser.GameObjects.Graphics;
  private vfx!: Vfx;
  private views: ActorView[] = [];
  private t = 0;
  private nextShowcase = 3600;
  private showcase = 0;
  constructor() { super('title'); }
  create() {
    const k = GAME_SCALE.k;
    this.t = 0; this.nextShowcase = 3600; this.showcase = 0;
    this.bg = this.add.image(0, 0, 'bg_title_namek').setOrigin(0, 0).setDepth(-100);
    this.ambience = this.add.graphics().setDepth(-80);
    this.vfx = new Vfx(this);
    const line: (keyof typeof HEROES)[] = ['piccolo', 'vegeta', 'goku', 'gohan', 'krillin'];
    const xs = [215, 362, 490, 612, 738];
    line.forEach((id, i) => {
      const h = HEROES[id];
      const f = { uid: id, defId: id, side: 'ally', name: h.name, sprite: h.sprite, slot: i, level: 1, stats: h.base, hp: 1, ki: 1, rage: 0, statuses: [], defending: false, alive: true, skills: [], heightPx: Math.round(h.heightPx * 1.3), form: 'base', phaseIdx: 0, turnsTaken: 0, boss: false, chargeDmg: 0, rageGainMult: 1, ssj: false, actedThisRound: false } as Fighter;
      this.views.push(new ActorView(this, f, { x: xs[i], y: 420 }, this.vfx, false, k));
    });
    this.cameras.main.setZoom(k).centerOn(480, 270);
    this.events.once('shutdown', () => { this.bg.destroy(); this.ambience.destroy(); this.vfx.clear(); this.views.forEach((v) => v.destroy()); this.views = []; });
  }
  update(_t: number, dt: number) {
    const d = Math.min(dt, 50);
    this.t += d;
    this.cameras.main.setZoom(GAME_SCALE.k).centerOn(480, 270);
    this.vfx.update(d);
    this.drawAmbience();
    if (this.t >= this.nextShowcase) {
      this.views[this.showcase % this.views.length]?.react('attack', 125);
      this.showcase++;
      this.nextShowcase += 3000;
    }
    this.views.forEach((v, i) => {
      const bob = Math.round(Math.sin(this.t / 520 + i * 1.3) * 1.5);
      v.pos = { x: v.home.x, y: v.home.y + bob };
      v.update(d);
    });
  }

  /** A few moving water glints give the still landscape life while leaving the logo readable. */
  private drawAmbience() {
    const g = this.ambience; g.clear(); const t = getSettings().reducedFlash ? 0 : this.t;
    for (let i = 0; i < 28; i++) {
      const phase = i * 2.399;
      const x = ((i * 149 + Math.sin(t / 1450 + phase) * 18) % 960 + 960) % 960;
      const y = 228 + (i % 5) * 11 + Math.sin(t / 820 + phase) * 2;
      const alpha = getSettings().reducedFlash ? 0.16 : 0.08 + (Math.sin(t / 330 + phase) + 1) * 0.13;
      g.fillStyle(i % 3 === 0 ? 0xffe6a6 : 0x9bfff0, alpha).fillEllipse(x, y, 4 + (i % 4) * 2, 1.2);
    }
    for (let i = 0; i < 7; i++) {
      const phase = i * 1.7; const x = (i * 157 + Math.sin(t / 1700 + phase) * 11 + 960) % 960;
      const y = 250 + Math.sin(t / 1100 + phase) * 6;
      g.fillStyle(0xd9fff4, getSettings().reducedFlash ? 0.2 : 0.16 + (Math.sin(t / 270 + phase) + 1) * 0.1).fillCircle(x, y, 1.2);
    }
  }
}
