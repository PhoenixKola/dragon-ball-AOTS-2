import Phaser from 'phaser';
import { buildStage, type BuiltStage } from './stageBackgrounds';
import { ActorView } from './ActorView';
import { Vfx } from '../animation/vfx';
import { HEROES } from '../../data/heroes';
import { GAME_SCALE } from '../gameScale';
import type { Fighter } from '../../types';

/**
 * Title backdrop: the real battle stage with the five heroes lined up on one feet baseline.
 * All five use their reviewed still idle pose at the shared battle scale. The only motion is a procedural
 * breathing bob (a sub-pixel-snapped vertical offset per actor, out of phase); there are no extra animation frames.
 */
export class TitleScene extends Phaser.Scene {
  private bg!: BuiltStage;
  private vfx!: Vfx;
  private views: ActorView[] = [];
  private t = 0;
  constructor() { super('title'); }
  create() {
    const k = GAME_SCALE.k;
    this.bg = buildStage(this, 'plain');
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
    this.bg.update(d); this.vfx.update(d);
    this.views.forEach((v, i) => {
      const bob = Math.round(Math.sin(this.t / 520 + i * 1.3) * 1.5);
      v.pos = { x: v.home.x, y: v.home.y + bob };
      v.update(d);
    });
  }
}
