import Phaser from 'phaser';
import { Motes } from '../animation/vfx';

export type StageKind = 'plain' | 'water' | 'village' | 'ship' | 'cave' | 'ruin' | 'final' | 'frozen';
export const STAGE_W = 960;
export const STAGE_H = 540;
export const HORIZON = 238;

export interface BuiltStage { objects: Phaser.GameObjects.GameObject[]; update(dt: number): void; destroy(): void }

// deterministic pseudo-random so a stage always looks the same
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function buildStage(scene: Phaser.Scene, kind: StageKind): BuiltStage {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const updaters: ((dt: number) => void)[] = [];
  const r = rng(kind.length * 977 + kind.charCodeAt(0));
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objs.push(o); return o; };
  const has = (k: string) => scene.textures.exists(k);
  const obj = (name: string, x: number, y: number, scale: number, depth: number, tint?: number, alpha = 1, flip = false) => {
    if (!has('o_' + name)) return null;
    const im = add(scene.add.image(x, y, 'o_' + name).setOrigin(0.5, 1).setScale(scale).setDepth(depth).setAlpha(alpha).setFlipX(flip));
    if (tint !== undefined) im.setTint(tint);
    return im;
  };
  const sky = (top: number, bot: number, h = HORIZON + 10) => { const g = add(scene.add.graphics().setDepth(-100)); g.fillGradientStyle(top, top, bot, bot, 1); g.fillRect(0, 0, STAGE_W, h); return g; };

  if (kind === 'ship') {
    const g = add(scene.add.graphics().setDepth(-100));
    g.fillGradientStyle(0x1b1a3a, 0x1b1a3a, 0x403e78, 0x403e78, 1); g.fillRect(0, 0, STAGE_W, HORIZON + 10);
    // wall panels
    const names = ['panel_a', 'panel_vent', 'panel_tall', 'panel_a', 'panel_door', 'panel_vent'];
    for (let i = 0; i < 12; i++) obj(names[i % names.length], 40 + i * 84, HORIZON + 6, 0.82, -90, 0xb8b6e8, 1);
    // glowing light strips
    const lg = add(scene.add.graphics().setDepth(-85));
    lg.fillStyle(0x7fe8ff, 0.8).fillRect(0, 36, STAGE_W, 4); lg.fillStyle(0x7fe8ff, 0.18).fillRect(0, 30, STAGE_W, 16);
    obj('tank_l', 120, HORIZON + 8, 0.9, -80); obj('tank_l', 850, HORIZON + 8, 0.9, -80, undefined, 1, true); obj('tank_m', 250, HORIZON + 6, 0.8, -80); obj('tank_s', 720, HORIZON + 6, 0.8, -80);
    // metal floor in perspective
    const f = add(scene.add.graphics().setDepth(-70));
    f.fillGradientStyle(0x34325e, 0x34325e, 0x1c1b36, 0x1c1b36, 1); f.fillRect(0, HORIZON + 10, STAGE_W, STAGE_H - HORIZON);
    f.lineStyle(2, 0x5a589a, 0.55);
    for (let i = -8; i <= 8; i++) f.lineBetween(STAGE_W / 2 + i * 60, HORIZON + 10, STAGE_W / 2 + i * 190, STAGE_H);
    for (let i = 0; i < 7; i++) { const y = HORIZON + 10 + Math.pow(i / 6, 1.7) * (STAGE_H - HORIZON - 10); f.lineBetween(0, y, STAGE_W, y); }
    return { objects: objs, update: () => {}, destroy: () => objs.forEach((o) => o.destroy()) };
  }

  if (kind === 'cave') {
    const g = add(scene.add.graphics().setDepth(-100));
    g.fillGradientStyle(0x050912, 0x050912, 0x102a36, 0x102a36, 1); g.fillRect(0, 0, STAGE_W, HORIZON + 10);
    // stalactites
    g.fillStyle(0x03060c, 1);
    for (let i = 0; i < 16; i++) { const x = i * 64 + r() * 30, w = 30 + r() * 40, h = 40 + r() * 120; g.fillTriangle(x, 0, x + w, 0, x + w / 2, h); }
    const glow = add(scene.add.graphics().setDepth(-85));
    [[170, 0.9], [790, 1.05], [470, 0.7]].forEach(([x, s]) => { glow.fillStyle(0x5ad2ff, 0.12).fillCircle(x, HORIZON - 40, 120 * s); obj('crystals', x, HORIZON + 4, 0.8 * s, -80); });
    const floor = add(scene.add.graphics().setDepth(-70));
    floor.fillGradientStyle(0x2a2118, 0x2a2118, 0x120d09, 0x120d09, 1); floor.fillRect(0, HORIZON + 10, STAGE_W, STAGE_H);
    if (has('t_dirt')) { const t = add(scene.add.tileSprite(0, HORIZON + 10, STAGE_W, STAGE_H - HORIZON, 't_dirt').setOrigin(0, 0).setDepth(-69).setTint(0x6a5a50).setAlpha(0.75)); t.setTileScale(0.9); }
    obj('rock_big', 70, 530, 0.55, 5000, 0x6a6a74); obj('rock_med', 900, 536, 0.6, 5000, 0x6a6a74);
    const m = new Motes(scene, STAGE_W, STAGE_H, 0x8be8ff, 30, 6); objs.push(m.g); updaters.push((dt) => m.update(dt));
    return { objects: objs, update: (dt) => updaters.forEach((u) => u(dt)), destroy: () => { objs.forEach((o) => o.destroy()); } };
  }

  if (kind === 'frozen') {
    // Cooler's ruins: violet night sky with aurora ribbons, crystal skyline, frosted ground and drifting sparkles
    const g = add(scene.add.graphics().setDepth(-100));
    g.fillGradientStyle(0x0c0a2e, 0x0c0a2e, 0x3a3f9a, 0x3a3f9a, 1); g.fillRect(0, 0, STAGE_W, HORIZON + 10);
    const au = add(scene.add.graphics().setDepth(-99));
    [[0x59ffe0, 0.10, 70], [0x9a6bff, 0.12, 120], [0x59c8ff, 0.08, 40]].forEach(([c, a, y], i) => { au.fillStyle(c as number, a as number); for (let x = 0; x < STAGE_W; x += 12) au.fillRect(x, (y as number) + Math.sin(x / 90 + i * 2) * 26, 14, 44 + Math.sin(x / 40 + i) * 14); });
    const moon = add(scene.add.graphics().setDepth(-98)); moon.fillStyle(0xdfe8ff, 0.75).fillCircle(760, 92, 40); moon.fillStyle(0x9aa8e8, 0.25).fillCircle(748, 84, 9).fillCircle(772, 104, 6);
    const stars = add(scene.add.graphics().setDepth(-97)); stars.fillStyle(0xffffff, 0.7); for (let i = 0; i < 60; i++) stars.fillRect(r() * STAGE_W, r() * (HORIZON - 20), 2, 2);
    [['v4_ice_crystal_big', 70, 0.8], ['v4_ice_crystal_big', 300, 0.55], ['v4_ice_crystal_big', 560, 0.7], ['v4_ice_crystal_big', 800, 0.6], ['v4_ice_crystal_big', 930, 0.85]].forEach(([n, x, sc], i) => obj(n as string, x as number, HORIZON + 14, (sc as number) * 0.75, -92 + i * 0.1, 0x9aa4e6, 0.85));
    [[170, 0.85], [420, 0.7], [690, 0.8], [880, 0.65]].forEach(([x, sc]) => obj('v4_ice_tree', x as number, HORIZON + 12, (sc as number) * 0.9, -90, 0xb4bcf0, 0.9));
    const ground = add(scene.add.tileSprite(0, HORIZON, STAGE_W, STAGE_H - HORIZON, 't_ice').setOrigin(0).setDepth(-70)); ground.setTileScale(0.95);
    const hz = add(scene.add.graphics().setDepth(-60)); hz.fillGradientStyle(0x8fa4ff, 0x8fa4ff, 0x8fa4ff, 0x8fa4ff, 0.55, 0.55, 0, 0); hz.fillRect(0, HORIZON, STAGE_W, 64);
    const vg = add(scene.add.graphics().setDepth(-59)); vg.fillGradientStyle(0x000020, 0x000020, 0x000020, 0x000020, 0, 0, 0.42, 0.42); vg.fillRect(0, HORIZON + 90, STAGE_W, STAGE_H - HORIZON - 90);
    obj('v4_ice_pillar_crystal', 36, 548, 0.75, 4000, 0xbfc8ff); obj('v4_ice_crystal_big', 930, 552, 0.55, 4000, 0xbfc8ff);
    const m = new Motes(scene, STAGE_W, STAGE_H, 0xdff0ff, 40, 9); objs.push(m.g); updaters.push((dt) => m.update(dt));
    return { objects: objs, update: (dt) => updaters.forEach((u) => u(dt)), destroy: () => objs.forEach((o) => o.destroy()) };
  }

  const destroyed = kind === 'final' || kind === 'ruin';
  if (kind === 'final') sky(0x2a0a18, 0xff7a2a); else if (kind === 'ruin') sky(0x5a7a8a, 0xe8c8a0); else { sky(0x3fae9a, 0xbfeccd); const hb = add(scene.add.graphics().setDepth(-98)); hb.fillGradientStyle(0xf4ffd8, 0xf4ffd8, 0xf4ffd8, 0xf4ffd8, 0, 0, 0.55, 0.55); hb.fillRect(0, HORIZON - 90, STAGE_W, 100); }
  const sg = add(scene.add.graphics().setDepth(-99));
  // moons (or the dying core glow on the last stage)
  if (kind === 'final') {
    sg.fillStyle(0xff8a3a, 0.35).fillEllipse(480, HORIZON + 10, 900, 220); sg.fillStyle(0xffd27a, 0.5).fillEllipse(480, HORIZON + 10, 500, 100);
  } else {
    sg.fillStyle(0xe9fbd6, 0.7).fillCircle(700, 96, 46); sg.fillStyle(0x9ccf9a, 0.16).fillCircle(684, 84, 11).fillCircle(716, 108, 8).fillCircle(698, 70, 6);
        sg.fillStyle(0xffffff, 0.55);
    [[120, 70, 90, 18], [520, 54, 130, 20], [860, 150, 100, 16], [420, 150, 80, 14]].forEach(([x, y, w, h]) => { sg.fillEllipse(x, y, w, h); sg.fillEllipse(x + w * 0.3, y - h * 0.4, w * 0.6, h); });
  }
  // distant mesas, hazed toward the sky colour
  const mesaTint = kind === 'final' ? 0x6a2a2a : destroyed ? 0xa88a74 : 0x9ccdb4;
  const mesas: [string, number, number][] = [['cliff_tall', 40, 0.78], ['cliff_wide', 210, 0.7], ['cliff_low', 400, 0.62], ['cliff_m2', 575, 0.7], ['cliff_wide', 770, 0.66], ['cliff_tall', 930, 0.82], ['cliff_m1', 330, 0.45]];
  mesas.forEach(([n, x, s], i) => obj(n, x, HORIZON + 8, s * 0.9, -95 + i * 0.1, mesaTint, 0.72));
  if (kind === 'village') { obj('dome_cluster', 170, HORIZON + 14, 0.62, -88); obj('dome_big', 760, HORIZON + 14, 0.7, -88); obj('spire1', 600, HORIZON + 12, 0.7, -88); obj('temple', 470, HORIZON + 10, 0.52, -89, 0xcfe0d0, 0.95); }
  if (kind === 'ruin') { obj('dome_cluster', 150, HORIZON + 14, 0.6, -88, 0x9a8a80); obj('dome_big', 780, HORIZON + 14, 0.65, -88, 0x9a8a80); }
  if (!destroyed) [['tree_med', 120, 0.34], ['tree_s2', 300, 0.3], ['tree_big', 520, 0.3], ['tree_s1', 660, 0.32], ['tree_med', 880, 0.36], ['tree_tiny', 40, 0.4], ['tree_s2', 440, 0.26]].forEach(([n, x, s]) => obj(n as string, x as number, HORIZON + 26 + r() * 10, s as number, -80, 0xd8ffe8));
  else [['dead1', 130, 0.7], ['dead2', 600, 0.8], ['dead3', 850, 0.7]].forEach(([n, x, s]) => obj(n as string, x as number, HORIZON + 30, s as number, -80, kind === 'final' ? 0x3a1c18 : undefined));

  // v4 mid layer: blue Namek trees and horned domes, hazed so the fighters stay the focus
  if (!destroyed) {
    [[45, 0.4], [160, 0.34], [395, 0.3], [575, 0.3], [915, 0.4]].forEach(([x, sc], i) => obj('v4_tree_blue_big', x, HORIZON + 8 + (i % 2) * 3, sc, -84, 0xcfe8e0, 0.9));
    if (kind === 'village') { obj('v4_dome_horn_big', 150, HORIZON + 12, 0.36, -83, 0xdff0e4, 0.92); obj('v4_dome_horn_big', 820, HORIZON + 10, 0.32, -83, 0xdff0e4, 0.92); }
  }
  // ground
  const groundKey = destroyed ? 't_dirt' : 't_grass';
  if (has(groundKey)) {
    const gr = add(scene.add.tileSprite(0, HORIZON, STAGE_W, STAGE_H - HORIZON, groundKey).setOrigin(0, 0).setDepth(-70));
    gr.setTileScale(0.95);
    if (kind === 'final') gr.setTint(0x6a3a2a); else if (kind === 'ruin') gr.setTint(0xb89a80);
  }
  if (!destroyed) {
    const gp = add(scene.add.graphics().setDepth(-69));
    for (let i = 0; i < 34; i++) { const x = r() * STAGE_W, y = HORIZON + 30 + r() * (STAGE_H - HORIZON - 40), w = 60 + r() * 140; gp.fillStyle(r() > 0.5 ? 0x2f8f4a : 0x8ed46a, 0.16).fillEllipse(x, y, w, w * 0.18); }
  }
  if (kind === 'water' && has('t_water')) {
    const w = add(scene.add.tileSprite(0, HORIZON, STAGE_W, 70, 't_water').setOrigin(0, 0).setDepth(-69));
    w.setTileScale(1.0);
    updaters.push((dt) => { w.tilePositionX += dt * 0.012; w.tilePositionY += dt * 0.004; });
    const foam = add(scene.add.graphics().setDepth(-68));
    updaters.push((dt) => {
      void dt; foam.clear(); const t = performance.now() / 700;
      foam.lineStyle(4, 0xffffff, 0.65); foam.beginPath(); foam.moveTo(0, HORIZON + 70);
      for (let x = 0; x <= STAGE_W; x += 16) foam.lineTo(x, HORIZON + 70 + Math.sin(x / 38 + t) * 3); foam.strokePath();
      foam.lineStyle(2, 0xffffff, 0.35); foam.beginPath(); foam.moveTo(0, HORIZON + 58);
      for (let x = 0; x <= STAGE_W; x += 16) foam.lineTo(x, HORIZON + 58 + Math.sin(x / 30 - t * 1.2) * 4); foam.strokePath();
    });
  }
  // horizon haze + ground shading
  const hz = add(scene.add.graphics().setDepth(-60));
  const hazeCol = kind === 'final' ? 0xff9a4a : destroyed ? 0xe8c8a0 : 0xd4f6c6;
  hz.fillGradientStyle(hazeCol, hazeCol, hazeCol, hazeCol, 0.5, 0.5, 0, 0); hz.fillRect(0, HORIZON, STAGE_W, 70);
  const vg = add(scene.add.graphics().setDepth(-59));
  vg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.38, 0.38); vg.fillRect(0, HORIZON + 90, STAGE_W, STAGE_H - HORIZON - 90);

  // combat lane: tiled dirt in an organic blob, masked
  if (has('t_dirt') && kind !== 'final' && kind !== 'ruin') {
    const poly = scene.add.graphics().setVisible(false);
    const pts: Phaser.Math.Vector2[] = [];
    for (let x = 30; x <= 930; x += 30) pts.push(new Phaser.Math.Vector2(x, 318 + Math.sin(x / 70) * 7 + r() * 5));
    for (let x = 930; x >= 30; x -= 30) pts.push(new Phaser.Math.Vector2(x, 426 + Math.cos(x / 55) * 8 + r() * 5));
    poly.fillStyle(0xffffff).fillPoints(pts, true);
    objs.push(poly);
    const dirt = add(scene.add.tileSprite(0, 300, STAGE_W, 140, 't_dirt').setOrigin(0, 0).setDepth(-66));
    dirt.setTileScale(1.0); dirt.setMask(poly.createGeometryMask());
    const edge = add(scene.add.graphics().setDepth(-65));
    edge.lineStyle(3, 0x6a4a1a, 0.45); edge.strokePoints(pts, true);
    edge.fillStyle(0x4aa84a, 1);
    for (let i = 0; i < 36; i++) { const x = 30 + i * 25 + r() * 10; const y = 318 + Math.sin(x / 70) * 7 - 2; edge.fillTriangle(x - 4, y, x + 4, y, x, y - 8 - r() * 4); }
  }
  if (kind === 'final') {
    const cr = add(scene.add.graphics().setDepth(-64));
    cr.lineStyle(3, 0xff7a2a, 0.9);
    for (let i = 0; i < 9; i++) { let x = r() * STAGE_W, y = 270 + r() * 150; cr.beginPath(); cr.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.4) * 60; y += (r() - 0.3) * 24; cr.lineTo(x, y); } cr.strokePath(); }
    [[110, 90, 0.4], [340, 60, 0.3], [820, 110, 0.45], [640, 40, 0.28]].forEach(([x, y, s]) => obj('rock_big', x, y + 60, s, -92, 0x3a1c18));
    const m = new Motes(scene, STAGE_W, STAGE_H, 0xffb24a, 46, 30); objs.push(m.g); updaters.push((dt) => m.update(dt));
  } else {
    const m = new Motes(scene, STAGE_W, STAGE_H, destroyed ? 0xe8c8a0 : 0xe8ffd0, 22, 5); objs.push(m.g); updaters.push((dt) => m.update(dt));
  }
  // foreground framing (above actors, outside the action lane)
  obj('rock_big', 38, 548, 0.5, 4000, destroyed ? 0x8a6a5a : undefined); obj('rock_s1', 928, 546, 0.65, 4000, destroyed ? 0x8a6a5a : undefined); obj('rock_s2', 330, 552, 0.5, 4000);
  return { objects: objs, update: (dt) => updaters.forEach((u) => u(dt)), destroy: () => objs.forEach((o) => o.destroy()) };
}
