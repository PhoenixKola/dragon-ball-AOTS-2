import Phaser from 'phaser';
import { getSettings } from '../../systems/settings';
import { BEAM_FAMILY, IMPACT_FAMILY, SpriteAnimFx, SpriteBeamFx } from './vfxSprites';

// Procedural, palette-banded VFX. Everything updates from the battle clock (dt), so pausing freezes it.
// Each technique has its own silhouette; nothing here decides damage.

type Pal = { core: number; mid: number; outer: number; accent?: number };
export const PAL: Record<string, Pal> = {
  kame: { core: 0xffffff, mid: 0xa8e6ff, outer: 0x2d8cff },
  red: { core: 0xffffff, mid: 0xff9a8a, outer: 0xd41f1f },
  kame_ssj: { core: 0xffffff, mid: 0xfff2a0, outer: 0xffc23a, accent: 0x7fd3ff },
  galick: { core: 0xffffff, mid: 0xe3b3ff, outer: 0x8b3dff },
  masenko: { core: 0xffffff, mid: 0xfff09a, outer: 0xff9a1f },
  sbc: { core: 0xffffff, mid: 0xc88cff, outer: 0x38d65a, accent: 0x9b4dff },
  deathbeam: { core: 0xffffff, mid: 0xff9bf2, outer: 0xd4189c },
  eraser: { core: 0xfff5d6, mid: 0xffb347, outer: 0xe3411e },
  demon: { core: 0xf3ffd6, mid: 0xa9ff6a, outer: 0x2fae3f },
  bodychange: { core: 0xffffff, mid: 0xd9a8ff, outer: 0x7a2cc8 },
  bullet: { core: 0xffffff, mid: 0xffe680, outer: 0xffa11f },
  bullet_e: { core: 0xffffff, mid: 0xffc27a, outer: 0xe8541c },
  bullet_p: { core: 0xffffff, mid: 0xe0a8ff, outer: 0x8a2be2 },
  bullet_g: { core: 0xffffff, mid: 0xa8ffc2, outer: 0x1fb85a },
  bullet_r: { core: 0xffffff, mid: 0xff9a9a, outer: 0xd41f1f },
  bullet_v: { core: 0xffffff, mid: 0xd0b0ff, outer: 0x6a2cff },
  bigbang: { core: 0xffffff, mid: 0xe6d0ff, outer: 0x9b4dff },
  spiritbomb: { core: 0xffffff, mid: 0xbfe6ff, outer: 0x3d8bff, accent: 0xa8ffee },
  deathball: { core: 0xffe6ff, mid: 0xff7be8, outer: 0x9b1fb0 },
  crusher: { core: 0xffffff, mid: 0xffa860, outer: 0xd42a0a },
  hellzone: { core: 0xffffff, mid: 0xb9ffb0, outer: 0x2cc23c },
  disc: { core: 0xfffbe0, mid: 0xffe36b, outer: 0xd9a21a },
  freeze: { core: 0xffffff, mid: 0xa0ffc0, outer: 0x22c46a },
  flare: { core: 0xffffff, mid: 0xffffe0, outer: 0xfff29a },
  impact: { core: 0xffffff, mid: 0xffe9a0, outer: 0xffb340 },
  impact_big: { core: 0xffffff, mid: 0xffd08a, outer: 0xff7a1f },
  impact_red: { core: 0xffffff, mid: 0xff9a8a, outer: 0xff3a2a },
  impact_gold: { core: 0xffffff, mid: 0xfff09a, outer: 0xffc23a },
  heal: { core: 0xffffff, mid: 0xb9ffc9, outer: 0x2fd66a },
  buff: { core: 0xffffff, mid: 0xffe8a0, outer: 0xffb62a },
};
const AURA: Record<string, Pal> = {
  gold: { core: 0xffffff, mid: 0xfff09a, outer: 0xffc400 },
  blue: { core: 0xffffff, mid: 0xbfe6ff, outer: 0x3d8bff },
  red: { core: 0xffd0c0, mid: 0xff6a4a, outer: 0xd41f1f },
  purple: { core: 0xffe6ff, mid: 0xd08aff, outer: 0x7a1fd0 },
  green: { core: 0xe6ffe0, mid: 0x8aff9a, outer: 0x1fb54a },
  white: { core: 0xffffff, mid: 0xf0f6ff, outer: 0xbcd4ff },
  orange: { core: 0xfff0c0, mid: 0xffb24a, outer: 0xe86a10 },
};
const pal = (k: string): Pal => PAL[k] ?? PAL.bullet;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export interface Pt { x: number; y: number }
export interface Fx { update(dt: number): boolean; destroy(): void }

abstract class GfxFx implements Fx {
  g: Phaser.GameObjects.Graphics;
  t = 0;
  constructor(protected scene: Phaser.Scene, depth = 900) { this.g = scene.add.graphics().setDepth(depth); }
  abstract draw(): boolean;
  update(dt: number) { this.t += dt; this.g.clear(); return this.draw(); }
  destroy() { this.g.destroy(); }
}

/** Banded circle: outer glow, mid, bright core. */
function orb(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, p: Pal, a = 1) {
  g.fillStyle(p.outer, 0.28 * a).fillCircle(x, y, r * 1.5);
  g.fillStyle(p.outer, 0.9 * a).fillCircle(x, y, r);
  g.fillStyle(p.mid, 0.95 * a).fillCircle(x, y, r * 0.72);
  g.fillStyle(p.core, a).fillCircle(x, y, r * 0.42);
}

class OrbProjectile extends GfxFx {
  constructor(s: Phaser.Scene, private p: Pal, private a: Pt, private b: Pt, private dur: number, private r: number, private arc: number, private trail: boolean, private pulse = 0) { super(s); }
  draw() {
    const u = clamp01(this.t / this.dur);
    if (this.t > this.dur + 60) return false;
    const x = this.a.x + (this.b.x - this.a.x) * u;
    const y = this.a.y + (this.b.y - this.a.y) * u - Math.sin(u * Math.PI) * this.arc;
    if (this.trail) for (let i = 5; i >= 1; i--) { const uu = Math.max(0, u - i * 0.045); const tx = this.a.x + (this.b.x - this.a.x) * uu; const ty = this.a.y + (this.b.y - this.a.y) * uu - Math.sin(uu * Math.PI) * this.arc; this.g.fillStyle(this.p.outer, 0.35 - i * 0.05).fillCircle(tx, ty, this.r * (1 - i * 0.12)); }
    if (u < 1) orb(this.g, x, y, this.r * (1 + this.pulse * Math.sin(this.t / 55)), this.p);
    return true;
  }
}

class DiscProjectile extends GfxFx {
  constructor(s: Phaser.Scene, private a: Pt, private b: Pt, private dur: number, private r: number) { super(s); }
  draw() {
    const u = clamp01(this.t / this.dur);
    if (this.t > this.dur + 50) return false;
    const x = this.a.x + (this.b.x - this.a.x) * easeOut(u * 0.9 + 0.1 * u);
    const y = this.a.y + (this.b.y - this.a.y) * u - Math.sin(u * Math.PI) * 40;
    const rot = this.t / 35, p = PAL.disc;
    for (let i = 4; i >= 1; i--) { const uu = Math.max(0, u - i * 0.05); this.g.fillStyle(p.mid, 0.16).fillEllipse(this.a.x + (this.b.x - this.a.x) * uu, this.a.y + (this.b.y - this.a.y) * uu - Math.sin(uu * Math.PI) * 40, this.r * 2, this.r * 0.7); }
    if (u >= 1) return true;
    // spinning toothed disc seen at a tilt
    this.g.fillStyle(p.outer, 1);
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 24; i++) { const ang = (i / 24) * Math.PI * 2 + rot; const rr = this.r * (i % 2 ? 0.86 : 1.12); pts.push(new Phaser.Math.Vector2(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.55)); }
    this.g.fillPoints(pts, true);
    this.g.fillStyle(p.mid, 1).fillEllipse(x, y, this.r * 1.7, this.r * 0.8);
    this.g.fillStyle(p.core, 0.95).fillEllipse(x, y - 1, this.r * 1.2, this.r * 0.5);
    return true;
  }
}

class BeamFx extends GfxFx {
  constructor(s: Phaser.Scene, private kind: string, private a: Pt, private b: Pt, private dur: number, private w: number, private hold = 320) { super(s); }
  draw() {
    const total = this.dur + this.hold;
    if (this.t > total) return false;
    const grow = clamp01(this.t / this.dur);
    const fade = this.t > this.dur ? 1 - (this.t - this.dur) / this.hold : 1;
    const head = { x: this.a.x + (this.b.x - this.a.x) * easeOut(grow), y: this.a.y + (this.b.y - this.a.y) * easeOut(grow) };
    const dx = head.x - this.a.x, dy = head.y - this.a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, p = pal(this.kind);
    const pulse = 1 + Math.sin(this.t / 45) * 0.1;
    const w = this.w * pulse * (this.t > this.dur ? Math.max(0.25, fade) : 1);
    const seg = (width: number, color: number, alpha: number, wob = 0, taper = 0) => {
      this.g.fillStyle(color, alpha * fade);
      const n = 18; const top: Pt[] = [], bot: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n; const cx = this.a.x + dx * u, cy = this.a.y + dy * u;
        const tw = width * (1 - taper * (1 - u)) * (u < 0.04 ? 0.5 + u * 12 : 1) * (this.kind === 'galick' ? 0.55 + 0.7 * u : 1);
        const off = wob * Math.sin(u * 14 - this.t / 60);
        top.push({ x: cx + nx * (tw / 2 + off), y: cy + ny * (tw / 2 + off) }); bot.push({ x: cx - nx * (tw / 2 - off), y: cy - ny * (tw / 2 - off) });
      }
      this.g.fillPoints([...top, ...bot.reverse()].map((q) => new Phaser.Math.Vector2(q.x, q.y)), true);
    };
    if (this.kind === 'sbc') {
      // Special Beam Cannon: thin bright core wrapped by a counter-rotating two-colour helix
      seg(w * 1.0, p.outer, 0.28);
      seg(w * 0.62, p.outer, 0.45);
      seg(w * 0.26, p.mid, 0.9);
      seg(w * 0.12, p.core, 1);
      for (let strand = 0; strand < 2; strand++) {
        const col = strand ? (p.accent ?? p.mid) : p.outer;
        for (let i = 0; i < 26; i++) {
          const u = i / 26; if (u > grow + 0.02) break;
          const ph = u * 22 - this.t / 40 + strand * Math.PI;
          const off = Math.sin(ph) * w * 0.5, depth = Math.cos(ph);
          const cx = this.a.x + dx * u + nx * off, cy = this.a.y + dy * u + ny * off;
          this.g.fillStyle(col, (depth > 0 ? 0.95 : 0.55) * fade).fillCircle(cx, cy, 5 + depth * 2);
        }
      }
    } else if (this.kind === 'deathbeam') {
      seg(w * 0.5, p.outer, 0.5); seg(w * 0.22, p.mid, 1); seg(w * 0.08, p.core, 1);
    } else if (this.kind === 'bodychange') {
      seg(w * 0.7, p.outer, 0.5, 5); seg(w * 0.34, p.mid, 0.9, 3); seg(w * 0.12, p.core, 1, 2);
    } else if (this.kind === 'demon') {
      seg(w * 1.2, p.outer, 0.5, 2, 0.4); seg(w * 0.8, p.mid, 0.85, 1, 0.3); seg(w * 0.4, p.core, 1);
    } else {
      seg(w * 1.0, p.outer, 0.5, 1.5); seg(w * 0.68, p.outer, 0.95); seg(w * 0.46, p.mid, 1); seg(w * 0.22, p.core, 1);
    }
    // origin flare + head orb
    orb(this.g, this.a.x, this.a.y, w * 0.55, p, 0.9 * fade);
    if (this.kind !== 'sbc' && this.kind !== 'deathbeam') orb(this.g, head.x, head.y, w * 0.72 * (1 + Math.sin(this.t / 30) * 0.08), p, fade);
    else orb(this.g, head.x, head.y, w * 0.4, p, fade);
    return true;
  }
}

class ChargeFx extends GfxFx {
  constructor(s: Phaser.Scene, private kind: string, private at: () => Pt, private dur: number, private r: number) { super(s); }
  draw() {
    if (this.t > this.dur + 220) return false;
    const u = clamp01(this.t / this.dur), p = pal(this.kind), c = this.at();
    const fade = this.t > this.dur ? 1 - (this.t - this.dur) / 220 : 1;
    if (this.kind === 'disc') {
      const rr = this.r * (0.4 + u * 0.6);
      this.g.fillStyle(p.mid, 0.9 * fade).fillEllipse(c.x, c.y, rr * 2, rr * 0.7);
      this.g.fillStyle(p.core, fade).fillEllipse(c.x, c.y, rr * 1.2, rr * 0.4);
      return true;
    }
    // converging sparks toward the growing orb
    for (let i = 0; i < 14; i++) {
      const ang = i * 2.399 + this.t / 400, dist = (1 - ((u * 2 + i / 14) % 1)) * this.r * 3.2;
      this.g.fillStyle(p.mid, 0.85 * fade).fillRect(c.x + Math.cos(ang) * dist - 1.5, c.y + Math.sin(ang) * dist - 1.5, 3, 3);
    }
    orb(this.g, c.x, c.y, this.r * (0.15 + 0.85 * easeOut(u)) * (1 + Math.sin(this.t / 70) * 0.05), p, fade);
    if (this.kind === 'spiritbomb' || this.kind === 'deathball' || this.kind === 'bigbang') {
      this.g.lineStyle(2, p.core, 0.5 * fade).strokeCircle(c.x, c.y, this.r * (0.9 + 0.25 * Math.sin(this.t / 90)) * easeOut(u));
    }
    return true;
  }
}

class ImpactFx extends GfxFx {
  private bits: { a: number; v: number; l: number }[] = [];
  constructor(s: Phaser.Scene, private kind: string, private at: Pt, private size: number, private life: number) {
    super(s, 950);
    for (let i = 0; i < 10; i++) this.bits.push({ a: (i / 10) * Math.PI * 2 + Math.random() * 0.4, v: 60 + Math.random() * 120, l: 0.6 + Math.random() * 0.4 });
  }
  draw() {
    if (this.t > this.life) return false;
    const u = this.t / this.life, p = pal(this.kind), k = this.kind;
    if (k === 'buff') {
      for (let i = 0; i < 6; i++) { const x = this.at.x + (i - 2.5) * 12, y = this.at.y - ((u * 90 + i * 14) % 90); this.g.fillStyle(p.mid, 1 - u).fillTriangle(x, y - 8, x - 6, y, x + 6, y); this.g.fillStyle(p.outer, 0.8 * (1 - u)).fillTriangle(x, y - 3, x - 4, y + 3, x + 4, y + 3); }
      return true;
    }
    if (k === 'heal') {
      for (let i = 0; i < 7; i++) { const x = this.at.x + Math.sin(i * 1.9 + this.t / 200) * 28, y = this.at.y - ((u * 100 + i * 17) % 100); this.g.fillStyle(p.mid, 1 - u); this.g.fillRect(x - 1.5, y - 6, 3, 12); this.g.fillRect(x - 6, y - 1.5, 12, 3); }
      this.g.fillStyle(p.outer, 0.25 * (1 - u)).fillCircle(this.at.x, this.at.y + 20, 44 * (0.6 + u * 0.4));
      return true;
    }
    if (k === 'freeze') {
      for (let i = 0; i < 3; i++) { this.g.lineStyle(3, i % 2 ? p.mid : p.outer, 1 - u).strokeEllipse(this.at.x, this.at.y + 10, (50 + i * 24) * (0.6 + u * 0.5), (18 + i * 8) * (0.6 + u * 0.5)); }
      return true;
    }
    if (k === 'flare') {
      const r = this.size * 2.2 * easeOut(u);
      this.g.fillStyle(p.core, 1 - u).fillCircle(this.at.x, this.at.y, r);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.g.lineStyle(3, p.mid, 1 - u).lineBetween(this.at.x, this.at.y, this.at.x + Math.cos(a) * r * 1.8, this.at.y + Math.sin(a) * r * 1.8); }
      return true;
    }
    // hit-spark burst
    const r = this.size * (0.6 + u * 1.6);
    this.g.fillStyle(p.core, (1 - u) * 0.95).fillCircle(this.at.x, this.at.y, this.size * 0.55 * (1 - u * 0.6));
    this.g.lineStyle(this.size > 40 ? 4 : 3, p.mid, 1 - u).strokeCircle(this.at.x, this.at.y, r);
    for (const b of this.bits) {
      const d = (b.v * this.size / 40) * easeOut(u) * b.l;
      const x0 = this.at.x + Math.cos(b.a) * d * 0.5, y0 = this.at.y + Math.sin(b.a) * d * 0.5;
      this.g.lineStyle(3, u < 0.5 ? p.core : p.outer, 1 - u).lineBetween(x0, y0, this.at.x + Math.cos(b.a) * d, this.at.y + Math.sin(b.a) * d);
    }
    return true;
  }
}

/** Persistent flame aura around an actor's feet-centre. */
export class AuraFx extends GfxFx {
  constructor(s: Phaser.Scene, private color: string, private anchor: () => { x: number; y: number; h: number; w: number }, private depthOffset = -1) { super(s, 5); }
  private dead = false;
  setColor(c: string) { this.color = c; }
  kill() { this.dead = true; }
  draw() {
    if (this.dead) return false;
    const a = this.anchor(), p = AURA[this.color] ?? AURA.gold;
    this.g.setDepth(a.y + this.depthOffset);
    const n = 9, baseW = a.w * 0.62;
    for (let layer = 0; layer < 3; layer++) {
      const col = layer === 0 ? p.outer : layer === 1 ? p.mid : p.core;
      const alpha = layer === 0 ? 0.42 : layer === 1 ? 0.55 : 0.5;
      const sc = 1 - layer * 0.25;
      this.g.fillStyle(col, alpha);
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), x = a.x + (u - 0.5) * baseW * 2 * sc;
        const flick = 0.75 + 0.25 * Math.sin(this.t / 70 + i * 1.7) + 0.12 * Math.sin(this.t / 31 + i * 3.1);
        const hgt = a.h * (0.55 + 0.6 * (1 - Math.abs(u - 0.5) * 1.5)) * flick * sc;
        this.g.fillTriangle(x - baseW / n * sc, a.y, x + baseW / n * sc, a.y, x + Math.sin(this.t / 90 + i) * 5, a.y - hgt);
      }
    }
    this.g.fillStyle(p.mid, 0.2).fillEllipse(a.x, a.y - a.h * 0.45, baseW * 2.2, a.h * 1.1);
    return true;
  }
}

/** Ambient floating motes / ash for stage atmosphere. */
export class Motes extends GfxFx {
  private pts: { x: number; y: number; s: number; p: number }[] = [];
  constructor(s: Phaser.Scene, w: number, private h: number, private color: number, n = 26, private rise = 8) {
    super(s, 3);
    for (let i = 0; i < n; i++) this.pts.push({ x: Math.random() * w, y: Math.random() * h, s: 0.5 + Math.random(), p: Math.random() * 6 });
  }
  draw() {
    for (const m of this.pts) {
      const y = (m.y - this.t * 0.001 * this.rise * m.s + this.h * 10) % this.h;
      const x = m.x + Math.sin(this.t / 1200 + m.p) * 14;
      this.g.fillStyle(this.color, 0.25 + 0.2 * Math.sin(this.t / 500 + m.p)).fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    return true;
  }
}

export class Vfx {
  private list: Fx[] = [];
  constructor(private scene: Phaser.Scene) {}
  add<T extends Fx>(fx: T): T { this.list.push(fx); return fx; }
  update(dt: number) { this.list = this.list.filter((f) => { const alive = f.update(dt); if (!alive) f.destroy(); return alive; }); }
  clear() { this.list.forEach((f) => f.destroy()); this.list = []; }

  projectile(kind: string, a: Pt, b: Pt, dur: number, scale = 1, arc = false) {
    if (getSettings().vfxStyle === 'sprites' && BEAM_FAMILY[kind]) return this.add(new SpriteBeamFx(this.scene, BEAM_FAMILY[kind], a, b, dur, 320, Math.max(1.5, Math.round(2 * scale * 2) / 2)));
    const p = pal(kind);
    switch (kind) {
      case 'kame': case 'kame_ssj': case 'galick': case 'masenko': case 'sbc': case 'deathbeam': case 'eraser': case 'demon': case 'bodychange':
        return this.add(new BeamFx(this.scene, kind, a, b, dur, ({ deathbeam: 12, sbc: 40, demon: 70, eraser: 64, bodychange: 36, kame_ssj: 62, kame: 52, galick: 54, masenko: 50 } as Record<string, number>)[kind] * scale, kind === 'deathbeam' ? 140 : 300));
      case 'disc': return this.add(new DiscProjectile(this.scene, a, b, dur, 34 * scale));
      case 'bigbang': case 'spiritbomb': case 'deathball': case 'crusher':
        return this.add(new OrbProjectile(this.scene, p, a, b, dur, 34 * scale, 0, true, 0.06));
      case 'hellzone': {
        // orbs close in around the target
        for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2; this.add(new OrbProjectile(this.scene, p, { x: b.x + Math.cos(ang) * 90, y: b.y + Math.sin(ang) * 60 - 20 }, b, dur, 11 * scale, 0, false)); }
        return;
      }
      default:
        return this.add(new OrbProjectile(this.scene, p, a, b, dur, 12 * scale, arc ? 26 : 0, true));
    }
  }
  charge(kind: string, at: () => Pt, dur: number, scale = 1) { return this.add(new ChargeFx(this.scene, kind, at, dur, (kind === 'disc' ? 22 : 30) * scale)); }
  impact(kind: string, at: Pt, big: boolean) {
    const m = IMPACT_FAMILY[kind];
    if (getSettings().vfxStyle === 'sprites' && m) return this.add(new SpriteAnimFx(this.scene, m.fam, at, big && kind === 'impact' ? m.scale * 1.4 : m.scale));
    return this.add(new ImpactFx(this.scene, kind, at, big ? 56 : 32, big ? 440 : 260));
  }
  /** Validated hard-pixel ring/flash sprite at a point (guard ring, shockwave). */
  sprite(fam: string, at: Pt, scale: number, alpha = 1) { return this.add(new SpriteAnimFx(this.scene, fam, at, scale, 960, alpha)); }
}
