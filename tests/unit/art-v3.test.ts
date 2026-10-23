import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { SPRITE_BOXES } from '../../src/data/spriteManifest.generated';
import { BLOCKED_POSES, HIRES_SPRITES, resolvePose, spriteBox, idleSize, texKey, allSprites } from '../../src/engine/assets';
import { HEROES } from '../../src/data/heroes';
import { gokuForm, formSet, hasBakedAura, powerupFrameNames } from '../../src/engine/animation/gokuForms';
import { POWERUP_SETS, POWERUP_CANVAS } from '../../src/data/powerupSprites.generated';
import { newMember, buildAlly } from '../../src/systems/party';

const ACT = join(__dirname, '..', '..', 'public', 'assets', 'reviewed', 'actors');

/** Minimal 8-bit RGBA, non-interlaced PNG decoder (enough to inspect alpha bounds and colours). */
function decode(file: string) {
  const b = readFileSync(file); let p = 8; let w = 0, h = 0, ct = 0, bd = 0; const idat: Buffer[] = [];
  while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8); const d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; } if (type === 'IDAT') idat.push(d); p += 12 + len; }
  expect([bd, ct], file + ' must be 8-bit RGBA').toEqual([8, 6]);
  const raw = inflateSync(Buffer.concat(idat)); const stride = w * 4; const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)]; const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) { const a = x >= 4 ? out[y * stride + x - 4] : 0, up = y ? out[(y - 1) * stride + x] : 0, ul = x >= 4 && y ? out[(y - 1) * stride + x - 4] : 0;
      const pr = f === 0 ? 0 : f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : (() => { const pp = a + up - ul, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - ul); return pa <= pb && pa <= pc ? a : pb <= pc ? up : ul; })();
      out[y * stride + x] = (row[x] + pr) & 255; } }
  return { w, h, px: out };
}
function alphaBox(img: { w: number; h: number; px: Buffer }) {
  let x0 = img.w, y0 = img.h, x1 = 0, y1 = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  return [x0, y0, x1, y1];
}

describe('Alpha 3e actor art contract', () => {
  it('every manifest pose has a file, a finite in-canvas box and a feet baseline near y=172', () => {
    for (const s of allSprites()) for (const [pose, b] of Object.entries(SPRITE_BOXES[s])) {
      expect(existsSync(join(ACT, `${s}_${pose}.png`)), `${s}_${pose}`).toBe(true);
      expect(b.every((n) => Number.isFinite(n) && n >= 0 && n <= (HIRES_SPRITES.has(s) ? 448 : 176)), `${s}_${pose} box`).toBe(true);
      expect(b[2] > b[0] && b[3] > b[1], `${s}_${pose} non-empty`).toBe(true);
      expect(b[3], `${s}_${pose} feet`).toBeGreaterThanOrEqual(150);
    }
  });
  it('every sprite resolves every pose to something that exists (missing art falls back, never throws or yields undefined)', () => {
    const poses = ['idle', 'attack', 'charge', 'hurt', 'guard', 'special', 'victory', 'ko'] as const;
    for (const s of allSprites()) for (const p of poses) {
      const r = resolvePose(s, p); expect(SPRITE_BOXES[s][r], `${s}:${p}->${r}`).toBeDefined();
      const bx = spriteBox(s, r); expect(bx.every(Number.isFinite)).toBe(true); expect(texKey(s, r)).toBe(`a_${s}_${r}`);
      const z = idleSize(s); expect(z.w > 0 && z.h > 0 && Number.isFinite(z.w / z.h)).toBe(true);
    }
    expect(() => resolvePose('does-not-exist', 'idle')).toThrow(/Unknown sprite/);
  });
});

describe('base Goku stills (title/world fallbacks)', () => {
  it('base Goku has exactly idle/attack/hurt; unsupplied poses fall back to idle and are not faked', () => {
    expect(Object.keys(SPRITE_BOXES.goku).sort()).toEqual(['attack', 'charge', 'guard', 'hurt', 'idle', 'ko', 'special', 'victory']);
    for (const p of ['idle', 'guard', 'charge', 'victory', 'ko', 'special', 'attack', 'hurt'] as const) expect(resolvePose('goku', p), p).toBe(p);
    expect(BLOCKED_POSES['goku:hurt']).toBeUndefined();
  });
  it('the three files are 176x176 RGBA, bottom-centre anchored, match the manifest and have no Super-Saiyan yellow hair', () => {
    for (const pose of ['idle', 'attack', 'hurt']) {
      const img = decode(join(ACT, `goku_${pose}.png`)); expect([img.w, img.h]).toEqual([img.w, img.w]);
      const box = alphaBox(img); expect(box, pose).toEqual(SPRITE_BOXES.goku[pose]);
      expect(Math.abs(box[3] - Math.round(img.h * 438 / 448)), `${pose} feet baseline`).toBeLessThanOrEqual(2);
      expect(box[0] > 1 && box[1] > 1 && box[2] < img.w - 1, `${pose} not cut by the canvas`).toBe(true);
      let yellow = 0, opaque = 0;
      for (let i = 0; i < img.px.length; i += 4) if (img.px[i + 3] > 200) { opaque++; if (img.px[i] > 225 && img.px[i + 1] > 190 && img.px[i + 2] < 110) yellow++; }
      expect(opaque, pose).toBeGreaterThan(1500); expect(yellow / opaque, `${pose} yellow fraction`).toBeLessThan(0.01);
    }
  });
  it('scale stays sane: rendered height is the hero height for every base pose (no frame jumps by >35%)', () => {
    const k = HEROES.goku.heightPx / idleSize('goku').h;
    for (const p of ['idle', 'attack', 'hurt']) { const b = SPRITE_BOXES.goku[p]; const h = (b[3] - b[1]) * k; expect(h).toBeLessThan(HEROES.goku.heightPx * 1.35); expect(h).toBeGreaterThan(HEROES.goku.heightPx * 0.65); }
  });
  it('form selection is unchanged: base before unlock, Kaioken only when active, SSJ only after the unlock', () => {
    const g = (o: { ssj?: boolean; kaioken?: boolean } = {}) => { const m = newMember('goku', 12); if (o.ssj) m.ssj = true; const a = buildAlly(m, 0); if (o.kaioken) a.statuses.push({ kind: 'kaioken', turns: 3 }); return a; };
    expect(gokuForm(g())).toBe('base'); expect(gokuForm(g({ kaioken: true }))).toBe('kaioken'); expect(gokuForm(g(), 'kaioken')).toBe('kaioken'); expect(gokuForm(g({ ssj: true, kaioken: true }))).toBe('ssj'); expect(gokuForm(g({ ssj: true }))).toBe('ssj');
    expect(formSet('kaioken')).toBe('goku_kaioken'); expect(formSet('ssj')).toBe('goku_ssj'); expect(formSet('base')).toBeNull();
    expect(SPRITE_BOXES.ssj_goku).toBeDefined();   // still used as the SSJ fighter's size reference / world fallback, never drawn in battle
  });
});

describe('overworld left/right frames keep their own art (never mirrored at runtime)', () => {
  const OW = join(__dirname, '..', '..', 'public', 'assets', 'reviewed', 'overworld');
  // v4 art: Piccolo's cape trails BEHIND him, so in a left-facing frame the white cape mass sits to the right of the green skin (and the reverse facing right)
  const capeSide = (f: string) => { const i = decode(f); let wx = 0, wn = 0, gx = 0, gn = 0; for (let y = 0; y < i.h; y++) for (let x = 0; x < i.w; x++) { const k = (y * i.w + x) * 4; if (i.px[k + 3] < 200) continue; const r = i.px[k], g = i.px[k + 1], b = i.px[k + 2]; if (r > 225 && g > 225 && b > 225) { wx += x; wn++; } else if (g > 150 && r < 150 && b < 90) { gx += x; gn++; } } return wx / wn - gx / gn; };
  it('Piccolo trails his cape behind him: the folders are not swapped (left frames face left, right frames face right)', () => {
    for (const f of ['idle_000.png', 'walk_000.png', 'walk_001.png', 'walk_002.png']) {
      expect(capeSide(join(OW, 'piccolo', 'left', f)), 'left ' + f).toBeGreaterThan(0);
      expect(capeSide(join(OW, 'piccolo', 'right', f)), 'right ' + f).toBeLessThan(0);
    }
  });
  it('left and right folders hold different pixels for every entity (dedicated art, not a flipped copy sharing a file)', () => {
    for (const e of ['bulma', 'dende', 'nail', 'soldier', 'gohan_namek', 'goku_base', 'goku_ssj_test', 'krillin', 'piccolo', 'vegeta']) {
      const l = readFileSync(join(OW, e, 'left', 'idle_000.png')), r = readFileSync(join(OW, e, 'right', 'idle_000.png'));
      expect(l.equals(r), e).toBe(false);
    }
  });
});

describe('base Goku is the goku_<pose>.png stills only (no frame set)', () => {
  it('there is no base frame set, and the base form resolves to no set / no baked aura', () => {
    expect(Object.keys(POWERUP_SETS).sort()).toEqual(['goku_kaioken', 'goku_ssj']);
    expect(formSet('base')).toBeNull(); expect(formSet('kaioken')).toBe('goku_kaioken'); expect(formSet('ssj')).toBe('goku_ssj');
    expect(hasBakedAura(null)).toBe(false); expect(hasBakedAura('goku_kaioken')).toBe(true); expect(hasBakedAura('goku_ssj')).toBe(true);
    expect(powerupFrameNames().some((n) => n.startsWith('goku_base_'))).toBe(false);
    expect(readdirSync(ACT).filter((f) => f.startsWith('goku_base_'))).toEqual([]);
  });
});

describe('Goku Kaioken / SSJ sheets (art-sources/goku-forms)', () => {
  // wrong-costume source cell scores ~2000 on this measure; every real frame scores < 60
  const hasPurpleTrousers = (name: string) => {
    const img = decode(join(ACT, name + '.png')); let purple = 0;
    for (let i = 0; i < img.px.length; i += 4) { if (img.px[i + 3] < 200) continue; const r = img.px[i], g = img.px[i + 1], b = img.px[i + 2]; if (b > 90 && r > 80 && g < 0.7 * r && b > g * 1.5 && Math.abs(r - b) < 70 && r + g + b > 200) purple++; }
    return purple;
  };
  it('no exported Kaioken frame contains the purple trousers of the wrong-costume source frame', () => {
    for (const names of Object.values(POWERUP_SETS.goku_kaioken.anims)) for (const n of names) expect(hasPurpleTrousers(n), n).toBeLessThan(300);
  });
  it('every Kaioken / SSJ frame is a real body at the shared canvas size and the pose tables are explicit', () => {
    for (const sid of ['goku_kaioken', 'goku_ssj'] as const) {
      const a = POWERUP_SETS[sid].anims;
      expect(Object.keys(a).sort(), sid).toEqual(['attack', 'beam', 'guard', 'hurt', 'idle', 'ko', 'powerup', 'victory']);
      for (const n of new Set(Object.values(a).flat())) { const img = decode(join(ACT, n + '.png')); expect([img.w, img.h], n).toEqual([POWERUP_CANVAS.w, POWERUP_CANVAS.h]); let o = 0; for (let i = 3; i < img.px.length; i += 4) if (img.px[i] > 200) o++; expect(o, n).toBeGreaterThan(1500); }
    }
  });
});
