import Phaser from 'phaser';
import { ActorView } from './ActorView';
import { Vfx } from '../animation/vfx';
import { HEROES } from '../../data/heroes';
import { GAME_SCALE } from '../gameScale';
import type { Fighter } from '../../types';

/**
 * Title composition uses its own Namek landscape, not the generic battle stage.
 * The five reviewed fighters remain on a shared feet baseline and periodically
 * show their genuine authored punch drawings as a restrained showcase.
 */
export class TitleScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
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
    this.vfx = new Vfx(this);
    const line: (keyof typeof HEROES)[] = ['piccolo', 'vegeta', 'goku', 'gohan', 'krillin'];
    const xs = [215, 362, 490, 612, 738];
    line.forEach((id, i) => {
      const h = HEROES[id];
      const f = { uid: id, defId: id, side: 'ally', name: h.name, sprite: h.sprite, slot: i, level: 1, stats: h.base, hp: 1, ki: 1, rage: 0, statuses: [], defending: false, alive: true, skills: [], heightPx: Math.round(h.heightPx * 1.3), form: 'base', phaseIdx: 0, turnsTaken: 0, boss: false, chargeDmg: 0, rageGainMult: 1, ssj: false, actedThisRound: false } as Fighter;
      this.views.push(new ActorView(this, f, { x: xs[i], y: 420 }, this.vfx, false, k));
    });
    this.cameras.main.setZoom(k).centerOn(480, 270);
    this.events.once('shutdown', () => { this.bg.destroy(); this.vfx.clear(); this.views.forEach((v) => v.destroy()); this.views = []; });
  }
  update(_t: number, dt: number) {
    const d = Math.min(dt, 50);
    this.t += d;
    this.cameras.main.setZoom(GAME_SCALE.k).centerOn(480, 270);
    this.vfx.update(d);
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
}
