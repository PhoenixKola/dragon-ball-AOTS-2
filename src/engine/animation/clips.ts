// Declarative per-action animation timelines. Times are in ms from clip start.
// Damage is NEVER applied by the renderer: every `hit` / `proj(hit)` op is a marker at which the
// director asks the combat engine to commit that hit.

export type Pose = 'idle' | 'attack' | 'charge' | 'hurt' | 'guard' | 'special' | 'victory' | 'ko';
import { LIBRARY_CLIP_FAMILY } from '../../data/skillsLibrary';
export type MoveTo = 'strike' | 'home' | 'lunge' | 'mid' | 'back';

interface Base { t: number; by?: number } // `by`: participant index (0 = initiator) for combos
export type ClipOp = Base & (
  | { op: 'pose'; pose: Pose }
  | { op: 'move'; to: MoveTo; dur: number }
  | { op: 'proj'; vfx: string; dur: number; hit?: number; from?: 'hand' | 'sky' | 'body'; scale?: number; arc?: boolean }
  | { op: 'hit'; hit: number; vfx?: string; quiet?: boolean }
  | { op: 'aura'; on: boolean; color?: string }
  | { op: 'sfx'; id: string }
  | { op: 'shake'; amp: number; dur: number }
  | { op: 'flash'; color: number; dur: number; alpha?: number }
  | { op: 'zoom'; to: number; dur: number }
  | { op: 'darken'; on: boolean }
  | { op: 'banner'; text?: string }
  | { op: 'charge'; vfx: string; dur: number; from?: 'hand' | 'sky' | 'body'; scale?: number }
);

export interface ClipDef { id: string; ops: ClipOp[]; duration: number; hitCount: number; hitTimes: number[] }

export function buildClip(id: string, ops: ClipOp[], tail = 0): ClipDef {
  const sorted = [...ops].sort((a, b) => a.t - b.t);
  const hitTimes: number[] = [];
  let end = 0;
  for (const o of sorted) {
    let e = o.t;
    if (o.op === 'move') e = o.t + o.dur;
    if (o.op === 'proj') { e = o.t + o.dur; if (o.hit !== undefined) hitTimes[o.hit] = o.t + o.dur; }
    if (o.op === 'hit') hitTimes[o.hit] = o.t;
    if (o.op === 'charge' || o.op === 'shake' || o.op === 'flash' || o.op === 'zoom') e = o.t + o.dur;
    end = Math.max(end, e);
  }
  return { id, ops: sorted, duration: end + tail, hitCount: hitTimes.filter((x) => x !== undefined).length, hitTimes };
}

type O = ClipOp;
const pose = (t: number, p: Pose, by?: number): O => ({ t, op: 'pose', pose: p, by });
const move = (t: number, to: MoveTo, dur: number, by?: number): O => ({ t, op: 'move', to, dur, by });
const hit = (t: number, h: number, vfx = 'impact', by?: number): O => ({ t, op: 'hit', hit: h, vfx, by });
const sfx = (t: number, id: string, by?: number): O => ({ t, op: 'sfx', id, by });
const aura = (t: number, on: boolean, color = 'gold', by?: number): O => ({ t, op: 'aura', on, color, by });
const shake = (t: number, amp: number, dur = 120): O => ({ t, op: 'shake', amp, dur });
const proj = (t: number, vfx: string, dur: number, h?: number, extra: Partial<Extract<ClipOp, { op: 'proj' }>> = {}, by?: number): O => ({ t, op: 'proj', vfx, dur, hit: h, by, ...extra });

/** Melee flurry: dash in, alternate attack/idle poses with a lunge on each blow, dash home. */
function melee(id: string, gaps: number[], opt: { dash?: number; wind?: number; vfx?: string; sfxId?: string; heavy?: boolean } = {}): ClipDef {
  const dash = opt.dash ?? 170, wind = opt.wind ?? 120;
  const ops: O[] = [pose(0, 'charge'), sfx(0, 'dash'), move(wind, 'strike', dash), pose(wind + dash - 20, 'attack')];
  let t = wind + dash + 40;
  gaps.forEach((g, i) => {
    t += i === 0 ? 0 : g;
    ops.push(hit(t, i, opt.vfx ?? 'impact'), sfx(t - 10, opt.sfxId ?? 'hit'), move(t - 70, 'lunge', 70));
    ops.push(pose(t, i % 2 === 0 ? 'attack' : 'idle'));
    if (i === gaps.length - 1) ops.push(shake(t, opt.heavy ? 5 : 3, opt.heavy ? 200 : 110));
  });
  ops.push(pose(t + 160, 'idle'), move(t + 220, 'home', 240));
  return buildClip(id, ops, 120);
}

/** Single beam: charge with aura, fire pose, projectile travels from the hand. */
function beam(id: string, o: { charge: number; travel: number; vfx: string; scale?: number; firePose?: Pose; zoom?: boolean; sfxCharge?: string; flash?: number; auraColor?: string; shakeAmp?: number }): ClipDef {
  const f = o.charge;
  const ops: O[] = [
    pose(0, 'charge'), aura(0, true, o.auraColor ?? 'gold'), sfx(0, o.sfxCharge ?? 'charge'),
    pose(f, o.firePose ?? 'special'), aura(f, false), sfx(f, 'beam'), shake(f, 2, 90),
    proj(f + 40, o.vfx, o.travel, 0, { scale: o.scale ?? 1 }),
    shake(f + 40 + o.travel, o.shakeAmp ?? 4, 200),
    pose(f + o.travel + 360, 'idle'),
  ];
  if (o.zoom) ops.push({ t: f - 200, op: 'zoom', to: 1.12, dur: 300 }, { t: f + o.travel + 200, op: 'zoom', to: 1, dur: 400 });
  if (o.flash) ops.push({ t: f + 40 + o.travel, op: 'flash', color: 0xffffff, dur: 160, alpha: o.flash });
  return buildClip(id, ops, 100);
}

function volley(id: string, n: number, interval: number, o: { vfx: string; travel: number; wind?: number; poses?: Pose[]; scale?: number }): ClipDef {
  const w = o.wind ?? 320;
  const ops: O[] = [pose(0, 'charge'), aura(0, true, 'gold'), sfx(0, 'charge'), aura(w, false)];
  for (let i = 0; i < n; i++) {
    const t = w + i * interval;
    ops.push(pose(t, (o.poses ?? ['attack', 'special'])[i % (o.poses ?? ['attack', 'special']).length]), sfx(t, 'blast'), proj(t, o.vfx, o.travel, i, { scale: o.scale ?? 0.7 }));
  }
  ops.push(shake(w + (n - 1) * interval + o.travel, 3, 160), pose(w + n * interval + o.travel + 280, 'idle'));
  return buildClip(id, ops, 100);
}

const C: Record<string, ClipDef> = {};
const reg = (...clips: ClipDef[]) => clips.forEach((c) => { C[c.id] = c; });

// ---------- Hero basic attacks: each fighter has their own rhythm ----------
reg(
  melee('gohan_combo', [0, 170, 200], { dash: 190, wind: 150 }),
  melee('krillin_combo', [0, 150], { dash: 140, wind: 90 }),
  melee('vegeta_combo', [0, 190, 230], { dash: 160, wind: 130, heavy: true }),
  melee('goku_combo', [0, 120, 120, 200], { dash: 130, wind: 90, heavy: true }),
  melee('piccolo_combo', [0, 260], { dash: 200, wind: 170, heavy: true }),
);

// ---------- Gohan ----------
reg(
  beam('masenko', { charge: 520, travel: 280, vfx: 'masenko', zoom: false, flash: 0.25 }),
  melee('gohan_barrage', [0, 110, 110, 110, 160], { dash: 170, wind: 120 }),
  buildClip('gohan_rage', [
    { t: 0, op: 'darken', on: true }, pose(0, 'charge'), aura(0, true, 'gold'), sfx(0, 'charge'), { t: 100, op: 'zoom', to: 1.15, dur: 500 },
    shake(300, 3, 600), { t: 800, op: 'flash', color: 0xffee88, dur: 220, alpha: 0.6 }, aura(800, true, 'white'),
    move(900, 'strike', 120), pose(1000, 'attack'), hit(1060, 0, 'impact_big'), sfx(1050, 'hit'), shake(1060, 6, 220),
    pose(1260, 'special'), proj(1300, 'masenko', 220, 1, { scale: 1.5, from: 'hand' }), shake(1520, 8, 280),
    { t: 1500, op: 'flash', color: 0xffffff, dur: 220, alpha: 0.7 },
    aura(1700, false), pose(1900, 'idle'), move(1900, 'home', 260), { t: 1900, op: 'darken', on: false }, { t: 1900, op: 'zoom', to: 1, dur: 400 },
  ], 200),
);

// ---------- Krillin ----------
reg(
  buildClip('destructo', [
    pose(0, 'charge'), aura(0, true, 'gold'), sfx(0, 'charge'),
    { t: 200, op: 'charge', vfx: 'disc', dur: 360, from: 'hand', scale: 0.9 },
    pose(560, 'special'), aura(560, false), sfx(560, 'disc'),
    proj(580, 'disc', 560, 0, { arc: true, scale: 1.1 }), shake(1140, 4, 160), pose(1380, 'idle'),
  ], 100),
  buildClip('solarflare', [
    pose(0, 'special'), sfx(0, 'charge'), { t: 250, op: 'flash', color: 0xffffcc, dur: 500, alpha: 0.95 },
    hit(300, 0, 'flare', 0), sfx(260, 'flare'), pose(900, 'idle'),
  ], 100),
  volley('krillin_scatter', 6, 110, { vfx: 'bullet', travel: 200, wind: 260, scale: 0.55 }),
  buildClip('krillin_discstorm', [
    { t: 0, op: 'darken', on: true }, pose(0, 'charge'), aura(0, true, 'gold'), sfx(0, 'charge'),
    { t: 200, op: 'charge', vfx: 'disc', dur: 400, from: 'hand', scale: 1.1 }, { t: 450, op: 'charge', vfx: 'disc', dur: 350, from: 'hand', scale: 1.1 },
    pose(800, 'special'), aura(800, false),
    proj(820, 'disc', 460, 0, { arc: true, scale: 1.1 }), proj(980, 'disc', 460, 1, { arc: true, scale: 1.1 }), proj(1140, 'disc', 460, 2, { arc: true, scale: 1.3 }),
    shake(1600, 5, 240), pose(1900, 'idle'), { t: 1900, op: 'darken', on: false },
  ], 150),
);

// ---------- Vegeta ----------
reg(
  beam('galick', { charge: 700, travel: 300, vfx: 'galick', scale: 1.2, auraColor: 'purple', zoom: true, flash: 0.3, shakeAmp: 6 }),
  volley('vegeta_barrage', 8, 85, { vfx: 'bullet_v', travel: 170, wind: 240, scale: 0.6, poses: ['attack', 'special', 'attack', 'idle'] }),
  buildClip('powerup', [
    pose(0, 'charge'), aura(0, true, 'gold'), sfx(0, 'charge'), shake(100, 2, 500),
    { t: 600, op: 'flash', color: 0xffe8a0, dur: 160, alpha: 0.4 }, hit(650, 0, 'buff', 0), pose(1100, 'idle'), aura(1100, false),
  ], 100),
  buildClip('vegeta_bigbang', [
    { t: 0, op: 'darken', on: true }, pose(0, 'charge'), aura(0, true, 'purple'), sfx(0, 'charge'),
    { t: 150, op: 'charge', vfx: 'bigbang', dur: 900, from: 'hand', scale: 1.4 }, { t: 200, op: 'zoom', to: 1.18, dur: 700 },
    pose(1100, 'special'), aura(1100, false), sfx(1100, 'beam'),
    proj(1120, 'bigbang', 520, 0, { scale: 1.6 }), shake(1640, 6, 240), { t: 1640, op: 'flash', color: 0xffffff, dur: 200, alpha: 0.6 },
    hit(1900, 1, 'impact_big'), shake(1900, 10, 380), { t: 1900, op: 'flash', color: 0xcfa0ff, dur: 300, alpha: 0.8 },
    pose(2300, 'idle'), { t: 2300, op: 'darken', on: false }, { t: 2300, op: 'zoom', to: 1, dur: 400 },
  ], 150),
);

// ---------- Goku ----------
reg(
  buildClip('kamehameha', [
    pose(0, 'charge'), aura(0, true, 'blue'), sfx(0, 'charge'), { t: 80, op: 'zoom', to: 1.1, dur: 500 },
    { t: 250, op: 'charge', vfx: 'kame', dur: 550, from: 'hand', scale: 0.8 },
    pose(820, 'special'), aura(820, false), sfx(820, 'kame'),
    proj(840, 'kame', 340, 0, { scale: 1.3 }), shake(1180, 6, 260), { t: 1180, op: 'flash', color: 0xbfe8ff, dur: 200, alpha: 0.5 },
    pose(1560, 'idle'), { t: 1500, op: 'zoom', to: 1, dur: 400 },
  ], 100),
  buildClip('kaioken', [
    pose(0, 'charge'), aura(0, true, 'red'), sfx(0, 'kaioken'), shake(80, 2, 500),
    { t: 560, op: 'flash', color: 0xff3a2a, dur: 220, alpha: 0.55 }, hit(620, 0, 'buff', 0), pose(1100, 'idle'), aura(1100, false),
  ], 100),
  melee('goku_assault', [0, 90, 90, 100, 130], { dash: 110, wind: 90, vfx: 'impact_red', heavy: true }),
  buildClip('spiritbomb', [
    { t: 0, op: 'darken', on: true }, pose(0, 'victory'), sfx(0, 'charge'), { t: 100, op: 'zoom', to: 1.08, dur: 800 },
    { t: 200, op: 'charge', vfx: 'spiritbomb', dur: 1700, from: 'sky', scale: 2.4 }, shake(400, 2, 1400),
    pose(1900, 'attack'), sfx(1900, 'beam'),
    proj(1920, 'spiritbomb', 650, 0, { from: 'sky', scale: 2.6 }), shake(2570, 10, 420), { t: 2570, op: 'flash', color: 0xffffff, dur: 340, alpha: 0.9 },
    pose(3100, 'idle'), { t: 3100, op: 'darken', on: false }, { t: 3100, op: 'zoom', to: 1, dur: 450 },
  ], 150),
  buildClip('ssj_kamehameha', [
    pose(0, 'charge'), aura(0, true, 'gold'), sfx(0, 'charge'), { t: 80, op: 'zoom', to: 1.12, dur: 450 },
    { t: 250, op: 'charge', vfx: 'kame_ssj', dur: 500, from: 'hand', scale: 1 },
    pose(780, 'special'), aura(780, false), sfx(780, 'kame'),
    proj(800, 'kame_ssj', 300, 0, { scale: 1.7 }), shake(1100, 9, 320), { t: 1100, op: 'flash', color: 0xffffff, dur: 260, alpha: 0.75 },
    pose(1500, 'idle'), { t: 1450, op: 'zoom', to: 1, dur: 400 },
  ], 100),
  melee('ssj_assault', [0, 70, 70, 80, 80, 90, 100, 130], { dash: 100, wind: 80, vfx: 'impact_gold', heavy: true }),
  buildClip('ssj_fury', [
    { t: 0, op: 'darken', on: true }, pose(0, 'charge'), aura(0, true, 'gold'), sfx(0, 'charge'), { t: 80, op: 'zoom', to: 1.15, dur: 500 }, shake(100, 4, 500),
    move(600, 'strike', 90), pose(700, 'attack'), hit(760, 0, 'impact_gold'), shake(760, 5, 120),
    hit(900, 1, 'impact_gold'), pose(900, 'idle'), shake(900, 5, 120), hit(1040, 2, 'impact_gold'), pose(1040, 'attack'), shake(1040, 5, 120),
    move(1180, 'back', 120), pose(1250, 'special'), proj(1290, 'kame_ssj', 260, 3, { scale: 2, from: 'hand' }),
    shake(1550, 12, 400), { t: 1550, op: 'flash', color: 0xffffff, dur: 360, alpha: 0.9 },
    pose(2100, 'idle'), move(2100, 'home', 240), { t: 2100, op: 'darken', on: false }, { t: 2100, op: 'zoom', to: 1, dur: 450 },
  ], 200),
);

// ---------- Piccolo ----------
reg(
  buildClip('sbc', [
    pose(0, 'charge'), aura(0, true, 'green'), sfx(0, 'charge'),
    { t: 250, op: 'charge', vfx: 'sbc', dur: 650, from: 'hand', scale: 0.6 },
    pose(950, 'special'), aura(950, false), sfx(950, 'beam'),
    proj(980, 'sbc', 380, 0, { scale: 1.2 }), shake(1360, 5, 220), pose(1700, 'idle'),
  ], 100),
  buildClip('heal', [
    pose(0, 'special'), aura(0, true, 'green'), sfx(0, 'heal'), hit(520, 0, 'heal'), aura(1000, false), pose(1000, 'idle'),
  ], 150),
  volley('hellzone', 4, 150, { vfx: 'hellzone', travel: 380, wind: 450, scale: 0.7, poses: ['special'] }),
  buildClip('piccolo_demonwave', [
    { t: 0, op: 'darken', on: true }, pose(0, 'charge'), aura(0, true, 'green'), sfx(0, 'charge'), { t: 100, op: 'zoom', to: 1.12, dur: 600 }, shake(200, 3, 700),
    pose(950, 'special'), aura(950, false), sfx(950, 'beam'), proj(970, 'demon', 360, 0, { scale: 2 }), shake(1330, 9, 360), { t: 1330, op: 'flash', color: 0xaaffbb, dur: 280, alpha: 0.7 },
    pose(1800, 'idle'), { t: 1800, op: 'darken', on: false }, { t: 1800, op: 'zoom', to: 1, dur: 400 },
  ], 150),
);


// ---------- Generated hero clip families (learnable-skill library) ----------
// hmelee_N: dash + N strikes · hbeam_<vfx>: quick beam · hbeamH_<vfx>: charged beam · hwave_<vfx>: one blast that hits every foe · hvol_N_<vfx>: N-shot volley
// hbrace: guard stance with aura (counter / defence) · hshock: shockwave from the body (debuffs on all foes)
const HERO_VFX = ['masenko', 'galick', 'sbc', 'kame', 'disc', 'bullet'] as const;
const AURA_OF: Record<string, string> = { masenko: 'gold', galick: 'purple', sbc: 'green', kame: 'blue', disc: 'gold', bullet: 'gold' };
for (let n = 1; n <= 8; n++) reg(melee(`hmelee_${n}`, [0, ...Array<number>(n - 1).fill(n > 4 ? 90 : 120)], { dash: 130, wind: 100, heavy: n <= 2 }));
for (const v of HERO_VFX) {
  reg(
    beam(`hbeam_${v}`, { charge: 320, travel: 240, vfx: v, scale: 0.9, auraColor: AURA_OF[v] }),
    beam(`hbeamH_${v}`, { charge: 760, travel: 320, vfx: v, scale: 1.4, auraColor: AURA_OF[v], zoom: true, flash: 0.3, shakeAmp: 7 }),
    beam(`hwave_${v}`, { charge: 520, travel: 300, vfx: v, scale: 1.3, auraColor: AURA_OF[v], zoom: true, flash: 0.25, shakeAmp: 6 }),
  );
  for (let n = 2; n <= 6; n++) reg(volley(`hvol_${n}_${v}`, n, n > 4 ? 100 : 140, { vfx: v, travel: 220, wind: 300, scale: 0.8, poses: ['special', 'attack'] }));
}
reg(
  buildClip('hbrace', [pose(0, 'guard'), aura(0, true, 'blue'), sfx(0, 'charge'), { t: 500, op: 'flash', color: 0xbfd8ff, dur: 200, alpha: 0.35 }, hit(520, 0, 'buff', 0), pose(1000, 'idle'), aura(1000, false)], 100),
  buildClip('hshock', [pose(0, 'charge'), aura(0, true, 'white'), sfx(0, 'charge'), shake(150, 3, 400), { t: 450, op: 'flash', color: 0xffffff, dur: 260, alpha: 0.55 }, pose(470, 'special'), aura(470, false), sfx(470, 'beam'), hit(500, 0, 'impact_big'), shake(500, 6, 240), pose(1000, 'idle')], 100),
);

reg(buildClip('ssjtrunks_fx', [
  { t: 0, op: 'darken', on: true }, pose(0, 'charge'), aura(0, true, 'purple'), sfx(0, 'sparking'), shake(60, 3, 700), { t: 100, op: 'zoom', to: 1.1, dur: 500 },
  { t: 500, op: 'flash', color: 0xfff0a0, dur: 260, alpha: 0.55 }, aura(700, true, 'gold'), hit(720, 0, 'buff', 0), { t: 720, op: 'banner', text: 'SUPER SAIYAN!' },
  pose(1300, 'idle'), aura(1300, false), { t: 1300, op: 'darken', on: false }, { t: 1300, op: 'zoom', to: 1, dur: 400 },
], 100));

// one clip per library skill: a registered copy of its family (same timeline, own id)
for (const [skillId, fam] of Object.entries(LIBRARY_CLIP_FAMILY)) { const src = C[fam]; if (!src) throw new Error('Unknown clip family ' + fam + ' for ' + skillId); reg({ ...src, id: skillId }); }

// ---------- Team Sparking combos (multiple actors; `by` indexes the participants) ----------
reg(
  buildClip('combo_gohan_krillin', [
    { t: 0, op: 'darken', on: true }, { t: 0, op: 'banner', text: 'SPARKING COMBO!' },
    pose(0, 'charge', 1), aura(0, true, 'gold', 1), { t: 100, op: 'charge', vfx: 'disc', dur: 500, from: 'hand', scale: 1, by: 1 },
    pose(650, 'special', 1), aura(650, false, 'gold', 1), proj(670, 'disc', 420, 0, { arc: true, scale: 1.1 }, 1), shake(1090, 4, 140),
    pose(900, 'charge', 0), aura(900, true, 'gold', 0), proj(1050, 'disc', 420, 1, { arc: true, scale: 1.1 }, 1),
    pose(1350, 'special', 0), aura(1350, false, 'gold', 0), proj(1380, 'masenko', 300, 2, { scale: 1.8 }, 0),
    shake(1680, 9, 340), { t: 1680, op: 'flash', color: 0xffffff, dur: 260, alpha: 0.8 },
    pose(2100, 'idle', 0), pose(2100, 'idle', 1), { t: 2100, op: 'darken', on: false },
  ], 150),
  buildClip('combo_goku_vegeta', [
    { t: 0, op: 'darken', on: true }, { t: 0, op: 'banner', text: 'SPARKING COMBO!' },
    pose(0, 'charge', 0), pose(0, 'charge', 1), move(150, 'strike', 140, 0), move(260, 'strike', 140, 1), pose(280, 'attack', 0), pose(380, 'attack', 1),
    hit(420, 0, 'impact', 0), shake(420, 4, 100), hit(560, 1, 'impact', 1), shake(560, 4, 100), hit(700, 2, 'impact_big', 0), shake(700, 6, 180),
    move(850, 'back', 100, 0), move(850, 'back', 100, 1),
    pose(950, 'charge', 0), aura(950, true, 'blue', 0), pose(950, 'charge', 1), aura(950, true, 'purple', 1),
    pose(1350, 'special', 0), aura(1350, false, 'blue', 0), pose(1350, 'special', 1), aura(1350, false, 'purple', 1),
    proj(1380, 'kame', 340, undefined, { scale: 1.4 }, 0), proj(1380, 'galick', 340, 3, { scale: 1.4 }, 1),
    shake(1720, 11, 400), { t: 1720, op: 'flash', color: 0xffffff, dur: 300, alpha: 0.9 },
    pose(2200, 'idle', 0), pose(2200, 'idle', 1), move(2200, 'home', 240, 0), move(2200, 'home', 240, 1), { t: 2200, op: 'darken', on: false },
  ], 150),
  buildClip('combo_piccolo_gohan', [
    { t: 0, op: 'darken', on: true }, { t: 0, op: 'banner', text: 'SPARKING COMBO!' },
    pose(0, 'charge', 0), aura(0, true, 'green', 0), { t: 100, op: 'charge', vfx: 'sbc', dur: 650, from: 'hand', scale: 0.7, by: 0 },
    pose(500, 'charge', 1), aura(500, true, 'gold', 1),
    pose(800, 'special', 0), aura(800, false, 'green', 0), proj(830, 'sbc', 360, 0, { scale: 1.3 }, 0), shake(1190, 5, 200),
    pose(1000, 'special', 1), aura(1000, false, 'gold', 1), proj(1030, 'masenko', 320, 1, { scale: 1.8 }, 1), shake(1350, 9, 340), { t: 1350, op: 'flash', color: 0xffffff, dur: 260, alpha: 0.8 },
    pose(1800, 'idle', 0), pose(1800, 'idle', 1), { t: 1800, op: 'darken', on: false },
  ], 150),
  buildClip('combo_vegeta_krillin', [
    { t: 0, op: 'darken', on: true }, { t: 0, op: 'banner', text: 'SPARKING COMBO!' },
    pose(0, 'charge', 1), { t: 100, op: 'charge', vfx: 'disc', dur: 400, from: 'hand', scale: 1, by: 1 }, pose(520, 'special', 1), proj(540, 'disc', 400, 0, { arc: true, scale: 1.1 }, 1), shake(940, 4, 140),
    pose(700, 'charge', 0), aura(700, true, 'purple', 0), proj(940, 'disc', 400, 1, { arc: true, scale: 1.1 }, 1),
    pose(1350, 'special', 0), aura(1350, false, 'purple', 0), proj(1380, 'galick', 320, 2, { scale: 1.6 }, 0), shake(1700, 9, 340), { t: 1700, op: 'flash', color: 0xffffff, dur: 260, alpha: 0.8 },
    pose(2100, 'idle', 0), pose(2100, 'idle', 1), { t: 2100, op: 'darken', on: false },
  ], 150),
  buildClip('combo_trio', [
    { t: 0, op: 'darken', on: true }, { t: 0, op: 'banner', text: 'Z-FIGHTERS TRIPLE STRIKE!' },
    pose(0, 'charge', 0), aura(0, true, 'blue', 0), pose(0, 'charge', 1), aura(0, true, 'gold', 1), pose(0, 'charge', 2), aura(0, true, 'green', 2),
    { t: 100, op: 'zoom', to: 1.1, dur: 700 }, shake(150, 3, 700),
    pose(900, 'special', 2), aura(900, false, 'green', 2), proj(930, 'sbc', 360, 0, { scale: 1.3 }, 2), shake(1290, 5, 200),
    pose(1150, 'special', 1), aura(1150, false, 'gold', 1), proj(1180, 'masenko', 320, 1, { scale: 1.6 }, 1), shake(1500, 7, 260),
    pose(1500, 'special', 0), aura(1500, false, 'blue', 0), proj(1530, 'kame_ssj', 320, 2, { scale: 2 }, 0), shake(1850, 12, 440), { t: 1850, op: 'flash', color: 0xffffff, dur: 340, alpha: 0.95 },
    pose(2400, 'idle', 0), pose(2400, 'idle', 1), pose(2400, 'idle', 2), { t: 2400, op: 'darken', on: false }, { t: 2400, op: 'zoom', to: 1, dur: 400 },
  ], 150),
);

// ---------- Enemies ----------
reg(
  buildClip('e_shot', [pose(0, 'charge'), sfx(0, 'charge'), pose(330, 'attack'), sfx(330, 'blast'), proj(340, 'bullet_e', 300, 0, { scale: 0.8 }), pose(900, 'idle')], 80),
  buildClip('e_barrage3', [
    pose(0, 'charge'), sfx(0, 'charge'),
    pose(300, 'attack'), proj(310, 'bullet_e', 260, 0, { scale: 0.7 }), sfx(310, 'blast'),
    pose(480, 'idle'), proj(480, 'bullet_e', 260, 1, { scale: 0.7 }), sfx(480, 'blast'),
    pose(650, 'attack'), proj(650, 'bullet_e', 260, 2, { scale: 0.7 }), sfx(650, 'blast'), pose(1100, 'idle'),
  ], 80),
  buildClip('e_brace', [pose(0, 'charge'), aura(0, true, 'orange'), sfx(0, 'charge'), hit(600, 0, 'buff', 0), pose(1000, 'idle'), aura(1000, false)], 100),
  buildClip('e_heavy', [
    pose(0, 'charge'), aura(0, true, 'red'), sfx(0, 'charge'), shake(100, 2, 360),
    aura(520, false), move(540, 'strike', 140), pose(640, 'attack'), hit(700, 0, 'impact_big'), sfx(690, 'hit'), shake(700, 8, 260),
    pose(960, 'idle'), move(980, 'home', 260),
  ], 100),
  buildClip('e_beam', [pose(0, 'charge'), aura(0, true, 'purple'), sfx(0, 'charge'), aura(480, false), pose(500, 'attack'), sfx(500, 'beam'), proj(520, 'bullet_p', 340, 0, { scale: 1.2 }), shake(860, 4, 180), pose(1200, 'idle')], 100),
  buildClip('e_beam_big', [pose(0, 'charge'), aura(0, true, 'red'), sfx(0, 'charge'), { t: 100, op: 'charge', vfx: 'eraser', dur: 500, from: 'hand', scale: 1 }, aura(650, false), pose(650, 'attack'), sfx(650, 'beam'), proj(680, 'eraser', 420, 0, { scale: 1.8 }), shake(1100, 8, 320), pose(1500, 'idle')], 100),
  buildClip('e_beam_all', [pose(0, 'charge'), aura(0, true, 'purple'), sfx(0, 'charge'), { t: 100, op: 'zoom', to: 1.06, dur: 400 }, aura(600, false), pose(620, 'attack'), sfx(620, 'beam'), proj(640, 'deathbeam', 380, 0, { scale: 1.8 }), shake(1020, 8, 300), pose(1400, 'idle'), { t: 1300, op: 'zoom', to: 1, dur: 300 }], 100),
  melee('e_melee1', [0], { dash: 170, wind: 200 }),
  melee('e_melee2', [0, 220], { dash: 170, wind: 220 }),
  melee('e_melee3', [0, 170, 220], { dash: 180, wind: 240, heavy: true }),
  melee('e_melee4', [0, 120, 120, 200], { dash: 160, wind: 240, heavy: true }),
  melee('e_melee5', [0, 100, 100, 100, 160], { dash: 90, wind: 160 }),
  buildClip('e_freeze', [pose(0, 'charge'), aura(0, true, 'green'), sfx(0, 'charge'), { t: 400, op: 'flash', color: 0x9dffb4, dur: 400, alpha: 0.4 }, hit(450, 0, 'freeze'), pose(1000, 'idle'), aura(1000, false)], 100),
  buildClip('e_rush_all', [pose(0, 'charge'), sfx(0, 'dash'), move(200, 'mid', 120), pose(300, 'attack'), hit(360, 0, 'impact'), hit(500, 1, 'impact'), hit(660, 2, 'impact_big'), shake(660, 6, 220), pose(880, 'idle'), move(900, 'home', 260)], 100),
  buildClip('e_pincer', [pose(0, 'charge'), sfx(0, 'dash'), move(160, 'mid', 120), pose(280, 'attack'), hit(340, 0, 'impact'), shake(340, 4, 120), hit(560, 1, 'impact_big'), shake(560, 8, 260), pose(820, 'idle'), move(840, 'home', 260)], 100),
  buildClip('e_bodychange', [pose(0, 'charge'), aura(0, true, 'purple'), sfx(0, 'charge'), { t: 300, op: 'flash', color: 0xaa66ff, dur: 400, alpha: 0.5 }, proj(500, 'bodychange', 420, 0, { scale: 1.2 }), pose(1100, 'idle'), aura(1100, false)], 100),
  buildClip('e_deathbeam', [pose(0, 'charge'), sfx(0, 'charge'), pose(260, 'attack'), sfx(260, 'beam'), proj(270, 'deathbeam', 150, 0, { scale: 0.9 }), shake(420, 4, 140), pose(800, 'idle')], 80),
  buildClip('e_storm', [
    pose(0, 'charge'), aura(0, true, 'purple'), sfx(0, 'charge'), aura(420, false),
    ...[0, 1, 2, 3, 4, 5].flatMap((i) => [pose(450 + i * 110, i % 2 ? 'idle' : 'attack'), sfx(450 + i * 110, 'blast'), proj(450 + i * 110, 'deathbeam', 200, i, { scale: 0.7 })]),
    shake(1300, 5, 200), pose(1700, 'idle'),
  ], 100),
  buildClip('e_volley', [
    pose(0, 'charge'), aura(0, true, 'purple'), sfx(0, 'charge'), aura(380, false),
    ...[0, 1, 2, 3, 4, 5, 6].flatMap((i) => [pose(400 + i * 95, i % 2 ? 'idle' : 'attack'), sfx(400 + i * 95, 'blast'), proj(400 + i * 95, 'deathbeam', 180, i, { scale: 0.6 })]),
    shake(1250, 4, 180), pose(1600, 'idle'),
  ], 100),
  buildClip('e_deathball', [
    pose(0, 'charge'), aura(0, true, 'purple'), sfx(0, 'charge'), { t: 50, op: 'darken', on: true },
    { t: 100, op: 'charge', vfx: 'deathball', dur: 900, from: 'sky', scale: 2.2 }, shake(300, 3, 700), { t: 100, op: 'zoom', to: 1.08, dur: 700 },
    pose(1050, 'attack'), aura(1050, false), sfx(1050, 'beam'), proj(1080, 'deathball', 600, 0, { from: 'sky', scale: 2.4 }),
    shake(1680, 12, 420), { t: 1680, op: 'flash', color: 0xffffff, dur: 300, alpha: 0.85 }, pose(2100, 'idle'), { t: 2100, op: 'darken', on: false }, { t: 2100, op: 'zoom', to: 1, dur: 400 },
  ], 100),
  // Telegraph-only turn for charged moves (no hit markers)
  buildClip('e_charge', [pose(0, 'charge'), aura(0, true, 'red'), sfx(0, 'charge'), shake(150, 2, 400), pose(900, 'charge')], 100),
  // Utility
  buildClip('defend', [pose(0, 'guard'), sfx(0, 'guard'), pose(560, 'idle')], 60),
  buildClip('sparking', [{ t: 0, op: 'darken', on: true }, pose(0, 'charge'), aura(0, true, 'gold'), sfx(0, 'sparking'), { t: 300, op: 'flash', color: 0xffe066, dur: 380, alpha: 0.7 }, shake(300, 5, 400), pose(1000, 'idle'), { t: 1000, op: 'darken', on: false }], 100),
  buildClip('item', [pose(0, 'special'), hit(380, 0, 'heal'), sfx(380, 'heal'), pose(760, 'idle')], 80),
  buildClip('flee', [pose(0, 'charge'), move(100, 'back', 400), pose(700, 'idle'), move(750, 'home', 250)], 80),
);

export const CLIPS = C;
export function getClip(id: string): ClipDef {
  const c = C[id];
  if (!c) throw new Error('Missing animation clip: ' + id);
  return c;
}
