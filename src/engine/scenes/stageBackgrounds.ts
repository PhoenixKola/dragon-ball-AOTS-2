import Phaser from 'phaser';

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

export function buildStage(scene: Phaser.Scene, kind: StageKind): BuiltStage {
  const image = scene.add.image(0, 0, stageTextureKey(kind)).setOrigin(0, 0).setDepth(-100);
  return { objects: [image], update: () => {}, destroy: () => image.destroy() };
}
