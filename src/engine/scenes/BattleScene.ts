import Phaser from 'phaser';
import type { Fighter, HitResult } from '../../types';
import type { Stage } from '../combat/director';
import type { BattleController } from '../combat/controller';
import type { MoveTo, Pose } from '../animation/clips';
import { ActorView, type Pt } from './ActorView';
import { buildStage, STAGE_H, STAGE_W, type BuiltStage } from './stageBackgrounds';
import { Vfx } from '../animation/vfx';
import { audio } from '../audio/audio';
import { getSettings } from '../../systems/settings';
import { isLyingHurt } from '../assets';
import { GAME_SCALE } from '../gameScale';
import { formSet, gokuForm, hasBakedAura } from '../animation/gokuForms';

const ALLY_SLOTS: Pt[] = [{ x: 350, y: 372 }, { x: 255, y: 392 }, { x: 160, y: 366 }];
const ENEMY_SLOTS: Record<number, Pt[]> = {
  1: [{ x: 700, y: 380 }],
  2: [{ x: 650, y: 362 }, { x: 770, y: 392 }],
  3: [{ x: 615, y: 358 }, { x: 725, y: 388 }, { x: 835, y: 360 }],
  4: [{ x: 600, y: 352 }, { x: 690, y: 382 }, { x: 790, y: 354 }, { x: 865, y: 390 }],
};
const FONT = '"Press Start 2P", monospace';

interface Floater { t: Phaser.GameObjects.Text; vx: number; vy: number; life: number; max: number; g: number }

export class BattleScene extends Phaser.Scene implements Stage {
  ctl!: BattleController;
  views = new Map<string, ActorView>();
  vfx!: Vfx;
  bg!: BuiltStage;
  private floaters: Floater[] = [];
  private cueG!: Phaser.GameObjects.Graphics;
  private cueLabels = new Map<string, Phaser.GameObjects.Text>();
  private markG!: Phaser.GameObjects.Graphics;
  private dark!: Phaser.GameObjects.Rectangle;
  private flashR!: Phaser.GameObjects.Rectangle;
  private flashLeft = 0; private flashTotal = 1; private flashAlpha = 0;
  private bannerT = 0; private bannerG!: Phaser.GameObjects.Graphics; private bannerText!: Phaser.GameObjects.Text; private bannerStr = '';
  private shakeAmp = 0; private shakeLeft = 0; private shakeTotal = 1;
  private zoomF = 1; private zoomFrom = 1; private zoomTo = 1; private zoomT = 0; private zoomDur = 0;
  private focusPt: Pt = { x: STAGE_W / 2, y: STAGE_H / 2 };
  private focusStrength = 0;
  private clock = 0;
  private tutorialText?: Phaser.GameObjects.Text;

  constructor() { super('battle'); }

  init(data: { controller: BattleController }) { this.ctl = data.controller; this.views.clear(); this.floaters = []; this.cueLabels.clear(); }

  create() {
    const k = GAME_SCALE.k;
    this.cameras.main.setBackgroundColor(0x000000);
    this.bg = buildStage(this, this.ctl.opts.stageKind);
    this.vfx = new Vfx(this);
    this.cueG = this.add.graphics().setDepth(3300);
    this.markG = this.add.graphics().setDepth(3200);
    this.dark = this.add.rectangle(0, 0, STAGE_W, STAGE_H, 0x000000, 0).setOrigin(0).setDepth(100);
    this.flashR = this.add.rectangle(0, 0, STAGE_W, STAGE_H, 0xffffff, 0).setOrigin(0).setDepth(3600);
    this.bannerG = this.add.graphics().setDepth(3700);
    this.bannerText = this.add.text(STAGE_W / 2, 72, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#101a40', strokeThickness: 6 }).setOrigin(0.5).setDepth(3701).setVisible(false);

    const engine = this.ctl.engine;
    const allies = engine.fighters.filter((f) => f.side === 'ally');
    const enemies = engine.fighters.filter((f) => f.side === 'enemy');
    allies.forEach((f) => this.addView(f, ALLY_SLOTS[f.slot] ?? ALLY_SLOTS[0], false, k));
    const slots = ENEMY_SLOTS[Math.min(4, Math.max(1, enemies.length))];
    enemies.forEach((f, i) => this.addView(f, slots[i] ?? slots[0], true, k));
    this.applyCamera(0);
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.onResize, this); this.bg.destroy(); this.vfx.clear(); });
    this.ctl.attachStage(this);
    (window as unknown as { __battle?: BattleScene }).__battle = this;
    this.bindPointer();
    if (this.ctl.opts.tutorial) this.tutorialText = this.add.text(STAGE_W / 2, 150, '', { fontFamily: FONT, fontSize: '12px', color: '#fff7c0', stroke: '#101a40', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(3800);
  }

  /** Fighter under the pointer: body box only (never the transparent sprite canvas), nearest centre wins when bodies overlap. */
  private pickActor(p: Phaser.Input.Pointer): string | null {
    let best: string | null = null, bd = Infinity;
    for (const v of this.views.values()) {
      if (v.downed && v.f.side === 'enemy') continue;
      const f = v.feet, dx = Math.abs(p.worldX - f.x);
      if (dx <= v.width * 0.42 && p.worldY <= f.y + 6 && p.worldY >= f.y - v.height && dx < bd) { bd = dx; best = v.f.uid; }
    }
    return best;
  }
  private bindPointer() {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { const u = this.pickActor(p); this.input.setDefaultCursor(u ? 'pointer' : 'default'); if (u) this.ctl.hoverTarget(u); });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { const u = this.pickActor(p); if (u) this.ctl.onActorClick(u); });
  }

  private onResize() { this.applyCamera(0); }

  private addView(f: Fighter, home: Pt, bar: boolean, k: number) {
    const v = new ActorView(this, f, home, this.vfx, bar, k);
    this.views.set(f.uid, v);
    return v;
  }

  // ---------- camera ----------
  private applyCamera(dt: number) {
    const cam = this.cameras.main;
    const k = GAME_SCALE.k;
    if (this.zoomDur > 0) { this.zoomT += dt; const u = Math.min(1, this.zoomT / this.zoomDur); const e = u * u * (3 - 2 * u); this.zoomF = this.zoomFrom + (this.zoomTo - this.zoomFrom) * e; if (u >= 1) this.zoomDur = 0; }
    let sx = 0, sy = 0;
    if (this.shakeLeft > 0 && getSettings().screenShake) { this.shakeLeft -= dt; const a = this.shakeAmp * Math.max(0, this.shakeLeft / this.shakeTotal); sx = (Math.random() - 0.5) * 2 * a; sy = (Math.random() - 0.5) * 2 * a; }
    const fs = Math.min(1, (this.zoomF - 1) * 6);
    this.focusStrength += (fs - this.focusStrength) * Math.min(1, dt / 120 + 0.001);
    const cx = STAGE_W / 2 + (this.focusPt.x - STAGE_W / 2) * 0.5 * this.focusStrength + sx;
    const cy = STAGE_H / 2 + (this.focusPt.y - STAGE_H / 2) * 0.35 * this.focusStrength + sy;
    cam.setZoom(k * this.zoomF);
    cam.centerOn(cx, cy);
  }

  // ---------- Stage implementation ----------
  private v(uid: string): ActorView | undefined { return this.views.get(uid); }
  setPose(uid: string, pose: Pose) { this.v(uid)?.setPose(pose); }
  move(uid: string, to: MoveTo, targetUid: string | undefined, dur: number) {
    const v = this.v(uid); if (!v) return;
    const t = targetUid ? this.v(targetUid) : undefined;
    let dest: Pt = v.home; let e: 'out' | 'in' | 'inout' = 'out';
    if (to === 'strike' && t) {
      const gap = t.width * 0.42 + v.width * 0.3 + 16;
      dest = { x: t.pos.x - v.facing * gap, y: t.pos.y + 3 };
    } else if (to === 'lunge') { dest = { x: v.pos.x + v.facing * 16, y: v.pos.y }; e = 'out'; }
    else if (to === 'back') { dest = { x: v.pos.x - v.facing * 60, y: v.pos.y }; e = 'inout'; }
    else if (to === 'mid') { dest = { x: STAGE_W / 2 + 10, y: v.home.y - 6 }; }
    else if (to === 'home') { dest = v.home; e = 'inout'; }
    v.moveTo(dest, dur, e);
  }
  private origin(v: ActorView, from?: 'hand' | 'sky' | 'body'): Pt { return from === 'sky' ? v.sky : from === 'body' ? v.chest : v.hand; }
  projectile(uid: string, vfx: string, targetUid: string, dur: number, opts: { from?: 'hand' | 'sky' | 'body'; scale?: number; arc?: boolean }) {
    const v = this.v(uid), t = this.v(targetUid); if (!v || !t) return;
    const a = this.origin(v, opts.from); const b = { x: t.chest.x - t.facing * 6, y: t.chest.y };
    this.vfx.projectile(vfx, a, b, dur, opts.scale ?? 1, !!opts.arc);
  }
  chargeVfx(uid: string, vfx: string, dur: number, opts: { from?: 'hand' | 'sky' | 'body'; scale?: number }) {
    const v = this.v(uid); if (!v) return;
    this.vfx.charge(vfx, () => this.origin(v, opts.from), dur, opts.scale ?? 1);
  }
  contact(targetUid: string, vfx: string, last: boolean) {
    const t = this.v(targetUid); if (!t) return;
    const big = last || vfx.includes('big');
    this.vfx.impact(vfx === 'impact' || vfx.startsWith('impact') || ['heal', 'buff', 'freeze', 'flare'].includes(vfx) ? vfx : 'impact', { x: t.chest.x - t.facing * 8, y: t.chest.y }, big && !['heal', 'buff', 'freeze'].includes(vfx));
    if (!['heal', 'buff', 'freeze', 'flare'].includes(vfx)) audio.sfx(big ? 'impact_big' : 'hit');
  }
  react(targetUid: string, r: HitResult) {
    const t = this.v(targetUid); if (!t) return;
    const f = t.f;
    t.setHp(f.hp / f.stats.hp);
    const pos = t.head;
    if (r.missed) { this.floatText(targetUid, 'MISS', 'info'); return; }
    if (r.heal > 0) { this.floatText(targetUid, '+' + r.heal, 'good'); audio.sfx('heal'); return; }
    if (r.statusApplied && r.damage === 0) { this.floatText(targetUid, r.statusApplied.toUpperCase(), r.statusApplied === 'frozen' || r.statusApplied === 'possessed' ? 'bad' : 'good'); return; }
    if (r.damage <= 0) return;
    const ally = f.side === 'ally';
    if (r.guard === 'perfect') { t.setPose('guard', 380); t.flash(60); t.knockBack(-t.facing * 3); audio.sfx('perfect'); this.floatText(targetUid, 'PERFECT!', 'good'); this.vfx.impact('impact_gold', { x: t.chest.x + t.facing * 18, y: t.chest.y }, false); if (getSettings().vfxStyle === 'sprites') this.vfx.sprite('guard_ring', { x: t.chest.x + t.facing * 10, y: t.feet.y - 6 }, 3.2); }
    else if (r.guard === 'good') { t.setPose('guard', 300); t.knockBack(-t.facing * 7); audio.sfx('guard'); this.floatText(targetUid, 'GUARD', 'info'); if (getSettings().vfxStyle === 'sprites') this.vfx.sprite('guard_ring', { x: t.chest.x + t.facing * 10, y: t.feet.y - 6 }, 2.4, 0.9); }
    else {
      t.flash(r.step.last ? 75 : 45);
      const lying = isLyingHurt(t.sprite);
      if (!(lying && !r.killed)) t.setPose('hurt', r.step.last ? 420 : 200);
      t.knockBack(-t.facing * (r.step.last ? 20 : 9), 0);
    }
    this.spawnNumber(pos, String(r.damage), ally ? 'enemyHit' : r.crit ? 'crit' : 'dmg', r.crit);
    if (r.countered) this.floatText(r.step.actorId, 'COUNTER!', 'warn');
    this.hitFreeze(r.step.last ? 60 : 30);
  }
  private hitFreezeLeft = 0;
  private hitFreeze(ms: number) { if (!getSettings().reducedFlash) this.hitFreezeLeft = Math.max(this.hitFreezeLeft, ms); }
  ko(uid: string) {
    const v = this.v(uid); if (!v) return;
    audio.sfx('ko');
    if (v.f.side === 'enemy') { v.setPose('ko'); v.fadeOut(600); this.vfx.impact('impact_big', v.chest, true); this.shake(7, 280); }
    else { v.setPose('ko'); v.setDowned(); }
  }
  aura(uid: string, on: boolean, color: string) { this.v(uid)?.setAura(on, color); }
  sfx(id: string) { audio.sfx(id); }
  shake(amp: number, dur: number) { if (!getSettings().screenShake) return; this.shakeAmp = Math.max(this.shakeAmp * (this.shakeLeft > 0 ? 1 : 0), amp * 0.8); this.shakeLeft = dur; this.shakeTotal = dur; }
  flash(color: number, dur: number, alpha: number) {
    if (getSettings().reducedFlash) alpha = Math.min(alpha, 0.18);
    this.flashR.setFillStyle(color, 1); this.flashLeft = dur; this.flashTotal = dur; this.flashAlpha = alpha;
  }
  zoom(to: number, dur: number) { this.zoomFrom = this.zoomF; this.zoomTo = to; this.zoomT = 0; this.zoomDur = Math.max(1, dur); if (dur === 0) { this.zoomF = to; this.zoomDur = 0; } }
  darken(on: boolean) { this.tweens.add({ targets: this.dark, fillAlpha: on ? 0.45 : 0, duration: 260 }); }
  banner(text: string) { this.bannerStr = text; this.bannerT = 1400; audio.sfx('banner'); }
  floatText(uid: string, text: string, tone: 'good' | 'bad' | 'warn' | 'info' | 'rage') {
    const v = this.v(uid); if (!v) return;
    const col = { good: '#8dffa8', bad: '#ff8a8a', warn: '#ffe27a', info: '#ffffff', rage: '#ffc23a' }[tone];
    this.spawnText({ x: v.head.x, y: v.head.y - 6 }, text, col, 12, 900);
  }
  private spawnNumber(at: Pt, text: string, kind: 'dmg' | 'enemyHit' | 'crit', crit: boolean) {
    const col = kind === 'enemyHit' ? '#ff6a5a' : crit ? '#fff06a' : '#ffffff';
    this.spawnText({ x: at.x + (Math.random() - 0.5) * 26, y: at.y + 14 }, text, col, crit ? 24 : 18, 800, crit);
  }
  private spawnText(at: Pt, text: string, color: string, size: number, life: number, pop = false) {
    const t = this.add.text(at.x, at.y, text, { fontFamily: FONT, fontSize: size + 'px', color, stroke: '#0c1230', strokeThickness: Math.max(4, size / 4) }).setOrigin(0.5).setDepth(3500);
    this.floaters.push({ t, vx: 0, vy: -38, life, max: life, g: pop ? 60 : 0 });
  }
  transform(uid: string, toSprite: string, name: string) {
    const v = this.v(uid); if (!v) return;
    const def = v.f; v.transform(toSprite, def.heightPx);
    this.floatText(uid, name.toUpperCase(), 'warn'); audio.sfx('transform');
  }
  resetPositions() { this.views.forEach((v) => { v.moveTo(v.home, 160, 'inout'); }); this.zoom(1, 300); }
  victory(uid: string) { const v = this.v(uid); if (v) v.setPose('victory'); }
  guardCue(uid: string, on: boolean) { if (!on) { this.cueLabels.get(uid)?.setVisible(false); } }
  focus(uids: string[]) {
    const pts = uids.map((u) => this.v(u)?.chest).filter((p): p is Pt => !!p);
    if (!pts.length) return;
    this.focusPt = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  }

  // ---------- per-frame ----------
  manual = false;
  /** Test hook: what a fighter is showing right now. */
  debugActor(uid: string) { const v = this.views.get(uid); return v ? { form: v.formSet, texture: v.img.texture.key, flipX: v.img.flipX, pose: v.pose, side: v.f.side, scale: v.img.scaleX } : null; }
  /** Dev/test hook: advance the whole battle (director, vfx, actors) by a fixed amount, independent of frame rate. */
  debugStep(ms: number) { for (let t = 0; t < ms; t += 16) this.frame(Math.min(16, ms - t)); }
  update(_t: number, deltaMs: number) { if (!this.manual) this.frame(Math.min(deltaMs, 50)); }

  private frame(real: number) {
    const ctl = this.ctl;
    const paused = ctl.paused;
    let dt = paused ? 0 : real;
    if (this.hitFreezeLeft > 0 && !paused) { this.hitFreezeLeft -= real; dt = 0; }
    const plan = ctl.director?.currentPlan;
    const fast = plan && !ctl.engine.isHostileToParty(ctl.engine.get(plan.actorId)) ? getSettings().battleSpeed : 1;
    ctl.tick(dt);
    const scaled = dt * fast;
    this.clock += dt;
    this.bg.update(dt);
    this.vfx.update(scaled);
    this.views.forEach((v) => {
      const f = v.f; v.setHp(f.hp / f.stats.hp);
      if (f.side === 'ally') this.trackRage(f.uid, f.rage, f.alive);
      v.setSparkFlame(f.alive && f.statuses.some((s) => s.kind === 'sparking'));
      const curPlan = ctl.director?.currentPlan;
      { const gf = f.defId === 'goku' ? gokuForm(f, curPlan && curPlan.actorId === f.uid ? curPlan.skillId : undefined) : 'base'; if (f.defId === 'trunks') v.setStillSprite(f.statuses.some((s) => s.kind === 'ssjform') ? 'trunks_ssj' : 'trunks'); else if (gf === 'ssj') v.setSsjForm(); else if (gf === 'kaioken') v.setForm(formSet(gf)); else if (f.defId === 'goku') v.setStillSprite('goku'); else v.setForm(null); }   // base Goku = stills; Kaioken / SSJ = their own frame sets (formSet), never each other's
      v.update(scaled);
      // the red Kaioken aura already says it for base Goku; a Super Saiyan shows a gold aura, so the status gets a pip there (honest UI)
      v.drawPips(f.statuses.map((s) => s.kind).filter((k) => !['sparking', 'kaioken'].includes(k) || f.side === 'enemy' || (k === 'kaioken' && v.formSet === 'goku_ssj')));
      const passive = f.statuses.some((s) => s.kind === 'kaioken') ? 'red' : f.statuses.some((s) => s.kind === 'sparking') ? 'gold' : f.statuses.some((s) => s.kind === 'charging') ? 'red' : f.statuses.some((s) => s.kind === 'possessed') ? 'purple' : f.statuses.some((s) => s.kind === 'atkUp') ? 'orange' : null;
      v.setPassiveAura(f.alive ? (hasBakedAura(v.formSet) ? (f.statuses.some((s) => s.kind === 'possessed') ? 'purple' : null) : passive) : null); // baked-aura forms never get a second procedural aura
    });
    this.applyCamera(dt);
    this.updateFloaters(dt);
    this.drawOverlays(dt);
    this.drawIndicators();
  }

  // ---- Rage feedback: one "+N RAGE" per action (gains within 350 ms are summed) and a "RAGE MAX" callout ----
  private rageLast = new Map<string, number>();
  private ragePend = new Map<string, { amt: number; at: number }>();
  private trackRage(uid: string, rage: number, alive: boolean) {
    const last = this.rageLast.get(uid) ?? rage; this.rageLast.set(uid, rage);
    if (!alive || rage < last) { this.ragePend.delete(uid); return; }          // spent (Rage Art, Sparking, combo) or downed: nothing to announce
    if (rage - last >= 0.4) { const p = this.ragePend.get(uid) ?? { amt: 0, at: this.clock }; p.amt += rage - last; p.at = this.clock; this.ragePend.set(uid, p); }
    const p = this.ragePend.get(uid);
    if (p && (this.clock - p.at > 350 || rage >= 100)) {
      this.ragePend.delete(uid);
      const n = Math.max(1, Math.round(p.amt));
      if (last < 100 && rage >= 100) { this.floatText(uid, 'RAGE MAX!', 'rage'); audio.sfx('rageready'); } else this.floatText(uid, `+${n} RAGE`, 'rage');
    }
  }

  private updateFloaters(dt: number) {
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt; f.vy += f.g * dt / 1000 * -1; f.t.y += f.vy * dt / 1000; f.vy *= 0.985;
      const u = f.life / f.max; f.t.setAlpha(Math.min(1, u * 3)); f.t.setScale(1 + (u > 0.85 ? (u - 0.85) * 3 : 0));
      if (f.life <= 0) { f.t.destroy(); return false; }
      return true;
    });
  }

  private drawOverlays(dt: number) {
    if (this.flashLeft > 0) { this.flashLeft -= dt; this.flashR.setAlpha(this.flashAlpha * Math.max(0, this.flashLeft / this.flashTotal)); } else this.flashR.setAlpha(0);
    const g = this.bannerG; g.clear();
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      const total = 1400, u = 1 - this.bannerT / total;
      const slide = u < 0.12 ? 1 - u / 0.12 : u > 0.85 ? (u - 0.85) / 0.15 : 0;
      const w = Math.max(360, this.bannerStr.length * 21 + 90);
      const x0 = STAGE_W / 2 - w / 2 + slide * 400 * (u > 0.5 ? 1 : -1);
      g.fillStyle(0x0a1236, 0.88).fillRect(x0, 50, w, 44); g.fillStyle(0xffd34a, 1).fillRect(x0, 50, w, 3).fillRect(x0, 91, w, 3);
      g.fillStyle(0x4aa0ff, 0.9).fillRect(x0, 50, 8, 44);
      this.bannerText.setText(this.bannerStr).setPosition(x0 + w / 2, 72).setVisible(true).setAlpha(1 - slide);
    } else this.bannerText.setVisible(false);
  }

  private drawIndicators() {
    const g = this.markG; g.clear();
    const ctl = this.ctl; const t = this.clock / 1000;
    const actor = ctl.actor;
    if (actor && ctl.menu.kind !== 'none') {
      const v = this.v(actor.uid);
      if (v) { const p = v.head; const y = p.y - 16 + Math.sin(t * 6) * 3; g.fillStyle(0x000000, 0.6).fillTriangle(p.x - 10, y - 12, p.x + 10, y - 12, p.x, y + 4); g.fillStyle(0xffe14a, 1).fillTriangle(p.x - 8, y - 10, p.x + 8, y - 10, p.x, y); }
    }
    for (const uid of ctl.targetUids) {
      const v = this.v(uid); if (!v) continue;
      const p = v.chest, w = v.width * 0.62, h = v.height * 0.62, s = 10 + Math.sin(t * 9) * 2;
      g.lineStyle(3, 0xff5a3c, 1);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const cx = p.x + sx * w, cy = p.y + sy * h; g.lineBetween(cx, cy, cx - sx * s, cy); g.lineBetween(cx, cy, cx, cy - sy * s); });
      const y = v.head.y - 22 + Math.sin(t * 8) * 4; g.fillStyle(0xff5a3c, 1).fillTriangle(p.x - 9, y - 12, p.x + 9, y - 12, p.x, y);
    }
    // Active Guard cues: the ring belongs to the defender being hit and converges on the contact frame
    const cg = this.cueG; cg.clear();
    const dir = ctl.director;
    if (dir) {
      const now = dir.time;
      for (const c of dir.activeCues) {
        const v = this.v(c.uid); if (!v || now < c.startAt) continue;
        const u = Math.min(1.25, (now - c.startAt) / (c.impactAt - c.startAt));
        const p = v.chest, r = 74 - 52 * Math.min(1, u), near = u > 0.78 && u < 1.15;
        cg.lineStyle(4, near ? 0xfff06a : 0xffffff, 0.95).strokeCircle(p.x, p.y, Math.max(20, r));
        cg.lineStyle(2, 0x6aff9a, 0.9).strokeCircle(p.x, p.y, 22);
        if (near) { cg.fillStyle(0xfff06a, 0.28).fillCircle(p.x, p.y, 26); }
        let lab = this.cueLabels.get(c.uid);
        if (!lab) { lab = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: '#fff7a0', stroke: '#101a40', strokeThickness: 5 }).setOrigin(0.5).setDepth(3400); this.cueLabels.set(c.uid, lab); }
        const assist = getSettings().guardPreset === 'assist';
        lab.setText(assist ? 'SPACE' : `[${v.f.slot + 1}]`).setPosition(p.x, v.head.y - 30).setVisible(true);
      }
      for (const [uid, lab] of this.cueLabels) if (!dir.activeCues.some((c) => c.uid === uid)) lab.setVisible(false);
    }
    if (this.tutorialText) this.tutorialText.setText(ctl.opts.tutorial ? this.tutorialHint() : '');
  }
  private tutorialHint() {
    const ctl = this.ctl;
    if (ctl.director?.activeCues.length) return 'ACTIVE GUARD!\nPress the number shown above the targeted fighter\nas the ring closes on them';
    return '';
  }
}
