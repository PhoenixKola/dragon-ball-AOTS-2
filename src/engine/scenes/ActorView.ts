import Phaser from 'phaser';
import type { Fighter } from '../../types';
import type { Pose } from '../animation/clips';
import { ANCHOR_X, ANCHOR_Y, idleSize, resolvePose, scaleHeight, texKey } from '../assets';
import { AuraFx } from '../animation/vfx';
import { AuraRiseFx, riseFamilyFor, riseKey } from '../animation/vfxSprites';
import { getSettings } from '../../systems/settings';
import { POWERUP_CANVAS, POWERUP_SETS, type PowerupSetId } from '../../data/powerupSprites.generated';
import { formAnim, frameTexKey, hasBakedAura } from '../animation/gokuForms';
import { nativeFacing, shouldFlip, POWERUP_FACING } from '../../data/poseFacing';
import type { Vfx } from '../animation/vfx';

export interface Pt { x: number; y: number }
const ease = {
  out: (t: number) => 1 - (1 - t) * (1 - t),
  in: (t: number) => t * t,
  inout: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

export class ActorView {
  readonly facing: 1 | -1;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  hpBg?: Phaser.GameObjects.Rectangle;
  hpFill?: Phaser.GameObjects.Rectangle;
  hpTrail?: Phaser.GameObjects.Rectangle;
  pips: Phaser.GameObjects.Graphics;
  pos: Pt;
  home: Pt;
  pose: Pose = 'idle';
  sprite: string;
  heightPx: number;
  scaleK: number;
  private motion: { from: Pt; to: Pt; t: number; dur: number; ease: keyof typeof ease } | null = null;
  private flashLeft = 0;
  private poseHold = 0;
  private knock: Pt = { x: 0, y: 0 };
  alpha = 1;
  fading = 0;
  downed = false;
  aura: AuraFx | null = null;
  auraColor = 'gold';
  private persistentAura: AuraFx | null = null;
  private lastHpFrac = 1;
  private hpShown = 1;
  showBar: boolean;
  /** Active Goku power-up sprite set (Kaioken / Super Saiyan). null = the regular still-pose sprites. */
  formSet: PowerupSetId | null = null;
  /** Persistent golden flame behind Super Saiyan Goku (the SSJ frame set's own aura is too faint at rest). */
  private ssjFlame: Phaser.GameObjects.Image | null = null;
  private sparkOn = false;
  private flameT = 0;
  private animFrames: string[] = [];
  private animFps = 0;
  private animT = 0;
  private attackCount = 0;
  private lastAttackAt = -9999;
  private clock = 0;
  private pendingIdleAt = -1;
  private holdMs = 0;

  constructor(private scene: Phaser.Scene, readonly f: Fighter, home: Pt, private vfx: Vfx, showBar: boolean, private k = 1) {
    this.facing = f.side === 'ally' ? 1 : -1;
    this.home = { ...home };
    this.pos = { ...home };
    this.sprite = f.sprite;
    this.heightPx = f.heightPx;
    this.showBar = showBar;
    this.scaleK = this.computeScale();
    const sz = idleSize(f.sprite);
    this.shadow = scene.add.ellipse(0, 0, sz.w * this.scaleK * 0.85, 16, 0x06140f, 0.42).setDepth(1);
    this.img = scene.add.image(0, 0, texKey(f.sprite, 'idle')).setOrigin(ANCHOR_X, ANCHOR_Y).setScale(this.scaleK);
    this.img.setFlipX(shouldFlip(nativeFacing(f.sprite, 'idle'), f.side));
    this.pips = scene.add.graphics();
    if (showBar) {
      this.hpBg = scene.add.rectangle(0, 0, 62, 11, 0x0b1022, 0.95).setStrokeStyle(2, 0xcfe3ff, 1).setOrigin(0.5);
      this.hpTrail = scene.add.rectangle(0, 0, 56, 6, 0xffd34a).setOrigin(0, 0.5);
      this.hpFill = scene.add.rectangle(0, 0, 56, 6, 0x4be070).setOrigin(0, 0.5);
    }
    this.layout();
  }

  private computeScale() { return this.formSet ? this.heightPx / POWERUP_SETS[this.formSet].refH : this.heightPx / scaleHeight(this.sprite); }

  /** Body width on screen, independent of the active form so spacing and strike gaps never jump. */
  get width() { const b = idleSize(this.sprite); return (b.w * this.heightPx) / b.h; }

  /** Swap the still-pose sprite (base Goku and the non-Goku roster) without touching the multi-frame sets. */
  setStillSprite(name: string) {
    if (this.sprite === name && !this.formSet) { this.syncFlame(name); return; }
    this.setForm(null);
    this.sprite = name; this.scaleK = this.computeScale(); this.img.setScale(this.scaleK);
    this.shadow.setSize(idleSize(name).w * this.scaleK * 0.85, 16);
    this.setPose(this.pose, this.holdMs);
    this.syncFlame(name);
  }
  /** Super Saiyan Goku: the SSJ frame set (art-sources/goku-forms) over the persistent gold flame. Idempotent, called every frame. */
  setSsjForm() {
    if (this.sprite === 'ssj_goku' && this.formSet === 'goku_ssj') return;
    this.sprite = 'ssj_goku';
    this.setForm('goku_ssj');
    this.shadow.setSize(idleSize('ssj_goku').w * this.scaleK * 0.85, 16);
    this.syncFlame('ssj_goku');
  }
  /** Sparking: a calmer golden flame behind the fighter for as long as the status lasts (Super Saiyan Goku already has his own, stronger one). */
  setSparkFlame(on: boolean) { this.sparkOn = on; this.syncFlame(this.sprite); }
  private syncFlame(name: string) {
    const want = name === 'ssj_goku' || name === 'trunks_ssj' || this.sparkOn;
    if (want && !this.ssjFlame && this.scene.textures.exists(riseKey('gold', 1))) this.ssjFlame = this.scene.add.image(0, 0, riseKey('gold', 1)).setOrigin(72 / 144, 140 / 144);
    else if (!want && this.ssjFlame) { this.ssjFlame.destroy(); this.ssjFlame = null; }
  }
  /** Switch Goku's visual form (null = base stills). Re-applies the current pose in the new set. */
  setForm(set: PowerupSetId | null) {
    if (set === this.formSet) return;
    this.formSet = set; this.scaleK = this.computeScale(); this.img.setScale(this.scaleK);
    if (set) this.img.setOrigin(POWERUP_CANVAS.ax / POWERUP_CANVAS.w, POWERUP_CANVAS.ay / POWERUP_CANVAS.h); else this.img.setOrigin(ANCHOR_X, ANCHOR_Y);
    this.attackCount = 0; this.pendingIdleAt = -1;
    this.setPose(this.pose, this.holdMs);
  }

  private applyFormPose(p: Pose, holdMs: number) {
    const set = this.formSet!;
    if (p === 'attack') { this.attackCount++; this.lastAttackAt = this.clock; }
    const a = formAnim(set, p, { attackIdx: Math.max(0, this.attackCount - 1), holdMs });
    this.animFrames = a.frames; this.animFps = a.fps; this.animT = 0;
    if (a.frames.length) this.img.setTexture(frameTexKey(a.frames[0]));
  }
  get height() { return this.heightPx; }
  get feet(): Pt { return { x: this.pos.x + this.knock.x, y: this.pos.y + this.knock.y }; }
  get hand(): Pt { return { x: this.feet.x + this.facing * this.width * 0.34, y: this.feet.y - this.heightPx * 0.58 }; }
  get chest(): Pt { return { x: this.feet.x, y: this.feet.y - this.heightPx * 0.55 }; }
  get head(): Pt { return { x: this.feet.x, y: this.feet.y - this.heightPx - 8 }; }
  get sky(): Pt { return { x: this.feet.x + this.facing * 20, y: this.feet.y - this.heightPx - 130 }; }

  setPose(p: Pose, holdMs = 0) {
    if (this.formSet && p === 'idle' && this.pose === 'attack' && this.clock - this.lastAttackAt < 240) { this.pendingIdleAt = this.lastAttackAt + 240; return; } // keep the strike frame through a flurry
    this.pendingIdleAt = -1;
    this.pose = p;
    this.poseHold = holdMs; this.holdMs = holdMs;
    if (this.formSet) { this.applyFormPose(p, holdMs); this.img.setFlipX(shouldFlip(POWERUP_FACING, this.f.side)); return; }
    const r = resolvePose(this.sprite, p);
    this.img.setTexture(texKey(this.sprite, r));
    this.img.setFlipX(shouldFlip(nativeFacing(this.sprite, r), this.f.side));
  }
  /** Brief reaction pose that automatically returns to idle (or whatever the clip sets next). */
  react(p: Pose, ms: number) { this.setPose(p, ms); }

  moveTo(to: Pt, dur: number, e: keyof typeof ease = 'out') {
    if (dur <= 0) { this.pos = { ...to }; this.motion = null; return; }
    this.motion = { from: { ...this.pos }, to: { ...to }, t: 0, dur, ease: e };
  }
  flash(ms: number) { this.flashLeft = ms; }
  knockBack(dx: number, dy = 0) { this.knock = { x: this.knock.x + dx, y: this.knock.y + dy }; }
  setAura(on: boolean, color: string) {
    if (!on || hasBakedAura(this.formSet)) { this.aura?.kill(); this.aura = null; return; }   // baked-aura forms: never stack a procedural aura
    if (this.aura) { this.aura.setColor(color); return; }
    this.aura = new AuraFx(this.scene, color, () => ({ x: this.feet.x, y: this.feet.y, h: this.heightPx * 0.95, w: this.width }));
    this.vfx.add(this.aura);
    this.igniteRise(color);
  }
  /** Status-driven passive aura (Kaioken / Sparking / ATK up). Kept separate from clip auras. */
  setPassiveAura(color: string | null) {
    if (!color) { this.persistentAura?.kill(); this.persistentAura = null; return; }
    if (this.persistentAura) { this.persistentAura.setColor(color); return; }
    this.persistentAura = new AuraFx(this.scene, color, () => ({ x: this.feet.x, y: this.feet.y, h: this.heightPx * 0.8, w: this.width }));
    this.vfx.add(this.persistentAura);
    this.igniteRise(color);
  }
  /** v4 ground-burst sprite when an aura ignites (skipped for reduced-flash and the procedural VFX style). */
  private igniteRise(color: string) {
    const fam = riseFamilyFor(color); const st = getSettings();
    if (!fam || st.reducedFlash || st.vfxStyle !== 'sprites') return;
    this.vfx.add(new AuraRiseFx(this.scene, fam, () => this.feet, this.width, () => this.feet.y - 0.8));
  }
  clearAuras() { this.setAura(false, ''); this.setPassiveAura(null); }

  transform(sprite: string, heightPx: number) {
    this.sprite = sprite; this.heightPx = heightPx; this.scaleK = this.computeScale();
    this.img.setScale(this.scaleK);
    this.shadow.setSize(idleSize(sprite).w * this.scaleK * 0.85, 16);
    this.setPose('idle');
  }
  setHp(frac: number) { this.lastHpFrac = frac; }
  fadeOut(ms: number) { this.fading = ms; this.downed = true; }
  setDowned() { this.downed = true; this.setPose('ko'); this.img.setTint(0x777788); }
  revive() { this.downed = false; this.alpha = 1; this.fading = 0; this.img.clearTint(); this.setPose('idle'); }

  update(dt: number) {
    this.clock += dt;
    if (this.ssjFlame) {
      this.flameT += dt; const i = 1 + (Math.floor(this.flameT / 90) % 4), f = this.feet;
      const strong = this.sprite === 'ssj_goku' || this.sprite === 'trunks_ssj', calm = getSettings().reducedFlash ? 0.35 : 0.62;
      this.ssjFlame.setTexture(riseKey('gold', i)).setPosition(f.x, f.y + 2).setScale((this.heightPx * (strong ? 1.45 : 1.15)) / 105).setDepth(f.y - 0.6).setVisible(!this.downed).setAlpha(this.alpha * (strong ? 1 : calm));
    }
    if (this.pendingIdleAt >= 0 && this.clock >= this.pendingIdleAt) { this.pendingIdleAt = -1; this.setPose('idle'); }
    if (this.formSet && this.animFrames.length > 1 && this.animFps > 0) { this.animT += dt; this.img.setTexture(frameTexKey(this.animFrames[Math.floor((this.animT / 1000) * this.animFps) % this.animFrames.length])); }
    if (this.motion) {
      const m = this.motion; m.t += dt;
      const u = Math.min(1, m.t / m.dur), e = ease[m.ease](u);
      this.pos = { x: m.from.x + (m.to.x - m.from.x) * e, y: m.from.y + (m.to.y - m.from.y) * e };
      if (u >= 1) this.motion = null;
    }
    if (this.poseHold > 0) { this.poseHold -= dt; if (this.poseHold <= 0) this.setPose(this.downed ? 'ko' : 'idle'); }
    const decay = Math.pow(0.992, dt);
    this.knock = { x: this.knock.x * decay, y: this.knock.y * decay };
    if (Math.abs(this.knock.x) < 0.2) this.knock.x = 0;
    if (this.flashLeft > 0) { this.flashLeft -= dt; this.img.setTintFill(0xffffff); } else if (!this.downed) this.img.clearTint();
    else this.img.setTint(0x777788);
    if (this.fading > 0) { this.alpha = Math.max(0, this.alpha - dt / 600); }
    this.hpShown += (this.lastHpFrac - this.hpShown) * Math.min(1, dt / 220);
    this.layout();
  }

  private layout() {
    const p = this.feet;
    this.img.setPosition(Math.round(p.x * this.k) / this.k, Math.round(p.y * this.k) / this.k).setDepth(p.y).setAlpha(this.alpha);
    const lift = Math.max(0, this.pos.y - this.home.y);
    void lift;
    this.shadow.setPosition(this.pos.x, this.pos.y - 2).setDepth(p.y - 0.5).setAlpha(this.alpha * 0.42);
    if (this.hpBg && this.hpFill && this.hpTrail) {
      const y = p.y - this.heightPx - 20, vis = this.showBar && !this.downed && this.alpha > 0.5;
      this.hpBg.setPosition(p.x, y).setVisible(vis).setDepth(2000);
      this.hpTrail.setPosition(p.x - 28, y).setSize(56 * Math.max(0, this.hpShown), 6).setVisible(vis).setDepth(2001);
      this.hpFill.setPosition(p.x - 28, y).setSize(56 * Math.max(0, this.lastHpFrac), 6).setVisible(vis).setDepth(2002);
    }
    this.pips.setDepth(2003);
  }

  drawPips(kinds: string[]) {
    const g = this.pips; g.clear();
    if (this.downed || !kinds.length) return;
    const p = this.feet, y0 = p.y - this.heightPx - 32;
    const col: Record<string, number> = { stun: 0xffe14a, frozen: 0x7cf0ff, blind: 0xc8c8c8, seal: 0xb06bff, charging: 0xff4a3a, counter: 0xff9a2a, possessed: 0xc03cff, atkUp: 0xff7a3a, defUp: 0x4aa0ff, kaioken: 0xff3a3a, sparking: 0xffd84a, atkDown: 0x7a5a3a, defDown: 0x3a5a7a, regen: 0x4aff8a, spdUp: 0x9aff4a };
    kinds.slice(0, 6).forEach((k, i) => { const x = p.x - (kinds.length - 1) * 6 + i * 12; g.fillStyle(0x000000, 0.7).fillRect(x - 5, y0 - 5, 10, 10); g.fillStyle(col[k] ?? 0xffffff, 1).fillRect(x - 4, y0 - 4, 8, 8); });
  }

  destroy() {
    this.clearAuras();
    this.ssjFlame?.destroy(); this.ssjFlame = null;
    [this.img, this.shadow, this.hpBg, this.hpFill, this.hpTrail, this.pips].forEach((o) => o?.destroy());
  }
}
