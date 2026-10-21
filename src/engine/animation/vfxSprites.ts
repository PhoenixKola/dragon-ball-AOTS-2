import Phaser from 'phaser';
import { BEAM_PARTS, VFX_FAMILIES } from '../../data/artManifest.generated';
import { AURA_RISE } from '../../data/auraRise.generated';
import type { Fx, Pt } from './vfx';

// Validated pixel-art VFX (96x64, 8 frames @65 ms) from aots2-master-art-pack-v2. Hard pixels: nearest filtering, integer scale.
export const vfxKey = (fam: string, i: number) => `vfx_${fam}_${i}`;
export function vfxTextures(): [string, string][] {
  const out: [string, string][] = [];
  for (const [fam, v] of Object.entries(VFX_FAMILIES)) for (let i = 0; i < v.frames; i++) out.push([vfxKey(fam, i), `assets/reviewed/vfx/${fam}/${String(i).padStart(3, '0')}.png`]);
  return out;
}
const partName = (fam: string, f: number, part: 'tail' | 'body' | 'head') => `${fam}_${f}_${part}`;
/** Adds named sub-frames (cap / tileable body / head) to each beam texture. Call once after loading. */
export function registerBeamFrames(textures: Phaser.Textures.TextureManager) {
  for (const [fam, frames] of Object.entries(BEAM_PARTS)) for (const [fs, p] of Object.entries(frames)) {
    const f = Number(fs); const tex = textures.get(vfxKey(fam, f)); const h = p.y[1] - p.y[0];
    for (const part of ['tail', 'body', 'head'] as const) { const n = partName(fam, f, part); if (!tex.has(n)) tex.add(n, 0, p[part][0], p.y[0], p[part][1] - p[part][0], h); }
  }
}

/** Which validated family a procedural effect id maps to. Techniques without an entry keep their procedural effect. */
export const BEAM_FAMILY: Record<string, string> = { kame: 'blue_beam', kame_ssj: 'yellow_beam', masenko: 'yellow_beam', galick: 'purple_beam', deathbeam: 'death_beam', eraser: 'red_beam', red: 'red_beam' };
export const IMPACT_FAMILY: Record<string, { fam: string; scale: number }> = {
  impact: { fam: 'punch_impact', scale: 2 }, impact_big: { fam: 'explosion', scale: 3 }, impact_red: { fam: 'energy_burst', scale: 2.4 },
  impact_gold: { fam: 'transformation_flash', scale: 2.4 }, heal: { fam: 'healing_spark', scale: 2.5 }, flare: { fam: 'solar_flare', scale: 3.4 },
};

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** One-shot frame animation (impact, burst, ring...). */
export class SpriteAnimFx implements Fx {
  private img: Phaser.GameObjects.Image; private t = 0; private n: number; private ms: number;
  constructor(scene: Phaser.Scene, private fam: string, at: Pt, scale: number, depth = 950, alpha = 1) {
    const v = VFX_FAMILIES[fam]; this.n = v.frames; this.ms = v.ms;
    this.img = scene.add.image(at.x, at.y, vfxKey(fam, 0)).setScale(scale).setDepth(depth).setAlpha(alpha);
  }
  update(dt: number) { this.t += dt; const i = Math.floor(this.t / this.ms); if (i >= this.n) return false; this.img.setTexture(vfxKey(this.fam, i)); return true; }
  destroy() { this.img.destroy(); }
}

/** Beam from hard-pixel parts: cap + tiled body + head, grown toward the target and held briefly. Rotates with the aim. */
export class SpriteBeamFx implements Fx {
  private con: Phaser.GameObjects.Container; private tail: Phaser.GameObjects.Image; private head: Phaser.GameObjects.Image; private body: Phaser.GameObjects.Image[] = [];
  private t = 0; private dist: number; private frame = 4; private parts: typeof BEAM_PARTS[string][number];
  constructor(scene: Phaser.Scene, private fam: string, a: Pt, b: Pt, private dur: number, private hold = 320, private scale = 2) {
    this.parts = BEAM_PARTS[fam][4];
    this.dist = Math.hypot(b.x - a.x, b.y - a.y);
    this.con = scene.add.container(a.x, a.y).setDepth(900).setRotation(Math.atan2(b.y - a.y, b.x - a.x));
    const mk = (part: 'tail' | 'body' | 'head') => scene.add.image(0, 0, vfxKey(fam, 4), partName(fam, 4, part)).setOrigin(0, 0.5).setScale(scale);
    this.tail = mk('tail'); this.head = mk('head');
    const bw = (this.parts.body[1] - this.parts.body[0]) * scale;
    const n = Math.ceil(this.dist / bw) + 1;
    for (let i = 0; i < n; i++) this.body.push(mk('body'));
    this.con.add([this.tail, ...this.body, this.head]);
  }
  update(dt: number) {
    this.t += dt;
    if (this.t > this.dur + this.hold) return false;
    const s = this.scale, p = this.parts;
    this.frame = [3, 4, 5, 4][Math.floor(this.t / 65) % 4];
    const grow = easeOut(Math.min(1, this.t / this.dur)); const len = Math.max(this.dist * grow, 8 * s);
    const fade = this.t > this.dur ? 1 - (this.t - this.dur) / this.hold : 1;
    const tw = (p.tail[1] - p.tail[0]) * s, hw = (p.head[1] - p.head[0]) * s, bw = (p.body[1] - p.body[0]) * s;
    const set = (img: Phaser.GameObjects.Image, part: 'tail' | 'body' | 'head') => img.setTexture(vfxKey(this.fam, this.frame), partName(this.fam, this.frame, part));
    set(this.tail, 'tail'); set(this.head, 'head');
    this.tail.setPosition(0, 0).setAlpha(fade);
    const avail = Math.max(0, len - tw - hw);
    let x = tw;
    this.body.forEach((img) => {
      const left = avail - (x - tw);
      if (left <= 0.5) { img.setVisible(false); return; }
      set(img, 'body'); img.setVisible(true).setPosition(x, 0).setAlpha(fade);
      const w = Math.min(bw, left); img.setCrop(0, 0, w / s, img.frame.height); x += bw;
    });
    this.head.setPosition(tw + avail, 0).setAlpha(fade);
    return true;
  }
  destroy() { this.con.destroy(); }
}

// ---- v4 ground-burst aura sequences (gold / purple): soft glow art, so these textures keep LINEAR filtering ----
export const riseKey = (fam: string, i: number) => `rise_${fam}_${i}`;
export function auraRiseTextures(): [string, string][] {
  const out: [string, string][] = [];
  for (const [fam, v] of Object.entries(AURA_RISE)) for (let i = 0; i < v.frames; i++) out.push([riseKey(fam, i), `assets/reviewed/vfx/aura_rise/${fam}_${i}.png`]);
  return out;
}
/** Which rise family an aura colour uses (colours without a family keep the procedural aura only). */
export const riseFamilyFor = (color: string): string | null => (color === 'gold' ? 'gold' : color === 'purple' ? 'purple' : null);

/** One-shot ground burst that plays when an aura ignites: anchored at the feet, scaled to the fighter, drawn behind the body. */
export class AuraRiseFx implements Fx {
  private img: Phaser.GameObjects.Image; private t = 0; private n: number; private ms: number;
  constructor(scene: Phaser.Scene, private fam: string, private feet: () => Pt, width: number, depth: () => number) {
    const v = AURA_RISE[fam]; this.n = v.frames; this.ms = v.ms; this.depth = depth;
    this.img = scene.add.image(0, 0, riseKey(fam, 0)).setOrigin(v.anchor[0] / v.canvas[0], v.anchor[1] / v.canvas[1]).setScale(Math.max(0.6, Math.min(2.6, (width * 1.5) / 120)));
  }
  private depth: () => number;
  update(dt: number) {
    this.t += dt; const i = Math.floor(this.t / this.ms);
    if (i >= this.n) return false;
    const f = this.feet(); const last = this.t - (this.n - 1) * this.ms;
    this.img.setTexture(riseKey(this.fam, i)).setPosition(f.x, f.y).setDepth(this.depth()).setAlpha(last > 0 ? Math.max(0, 1 - last / this.ms) : 1);
    return true;
  }
  destroy() { this.img.destroy(); }
}
