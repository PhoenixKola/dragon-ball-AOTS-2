import Phaser from 'phaser';
import { getSettings } from '../../systems/settings';

/** One reviewed, local Namek landscape per story battle location. */
export const STAGE_KINDS = ['plain', 'water', 'village', 'ship', 'cave', 'ruin', 'final', 'frozen'] as const;
export type StageKind = typeof STAGE_KINDS[number];
export const STAGE_W = 960;
export const STAGE_H = 540;
export const HORIZON = 238;

export interface BuiltStage {
  objects: Phaser.GameObjects.GameObject[];
  update(dt: number): void;
  destroy(): void;
}

export const stageTextureKey = (kind: StageKind) => `bg_${kind}_namek`;

export function buildStage(scene: Phaser.Scene, kind: StageKind, imageKey = stageTextureKey(kind)): BuiltStage {
  const image = scene.add.image(0, 0, imageKey).setOrigin(0, 0).setDepth(-100);
  const ambience = scene.add.graphics().setDepth(-90);
  let t = 0;
  let seed = kind.length * 881 + kind.charCodeAt(0) * 173;
  const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const particles = Array.from({ length: kind === 'frozen' ? 32 : 22 }, () => ({ x: rand() * STAGE_W, y: rand() * STAGE_H, phase: rand() * Math.PI * 2, speed: 8 + rand() * 20, size: 0.7 + rand() * 1.4 }));
  const snow = kind === 'frozen', embers = kind === 'final' || kind === 'ruin', water = kind === 'water' || kind === 'plain' || kind === 'village';
  const update = (dt: number) => {
    const calm = getSettings().reducedFlash;
    if (!calm) t += dt;
    ambience.clear();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!calm) {
        if (snow) { p.y = (p.y + p.speed * dt / 1000) % 380; p.x = (p.x + Math.sin(t / 900 + p.phase) * 8 * dt / 1000 + STAGE_W) % STAGE_W; }
        else if (embers) { p.y -= p.speed * dt / 1000; if (p.y < 130) p.y = 420 + rand() * 80; p.x += Math.sin(t / 700 + p.phase) * dt * 0.008; }
        else if (water) { p.x = (p.x + p.speed * dt / 1000) % STAGE_W; p.y = 205 + (i % 7) * 7 + Math.sin(t / 650 + p.phase) * 2; }
        else { p.y = 62 + (i * 47 + Math.sin(t / 1200 + p.phase) * 10) % 300; }
      }
      const alpha = calm ? 0.16 : 0.1 + (Math.sin(t / (embers ? 180 : 480) + p.phase) + 1) * (embers ? 0.1 : 0.07);
      const color = snow ? (i % 3 ? 0xeafaff : 0x9fe6ff) : embers ? (i % 3 ? 0xff8b45 : 0xffd078) : kind === 'cave' ? 0x73eaff : kind === 'ship' ? 0x82dfff : (i % 3 ? 0xa6fff4 : 0xffefae);
      ambience.fillStyle(color, alpha).fillCircle(p.x, p.y, p.size);
      if (water && i % 3 === 0) ambience.fillStyle(0xc8fff5, alpha * 0.55).fillEllipse(p.x, p.y, 8 + p.size * 5, 1.2);
    }
  };
  return { objects: [image, ambience], update, destroy: () => { image.destroy(); ambience.destroy(); } };
}
