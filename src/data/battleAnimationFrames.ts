/** Reviewed authored battle frames. Each name resolves inside reviewed/actors. */
import type { PowerupSetId } from './powerupSprites.generated';

const frameSet = (actor: string, count: number, pose = 'attack') =>
  Array.from({ length: count }, (_, index) => `${actor}_${pose}_frame_${String(index + 1).padStart(2, '0')}`);

export const ATTACK_FRAMES: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(['goku', 'gohan', 'krillin', 'vegeta', 'piccolo'].map((actor) => [actor, frameSet(actor, 4)])),
  cui: frameSet('cui', 4),
  dodoria: frameSet('dodoria', 4),
  zarbon: frameSet('zarbon', 4),
  zarbon2: frameSet('zarbon2', 4),
  guldo: frameSet('guldo', 4),
  recoome: frameSet('recoome', 4),
  burter: frameSet('burter', 4),
  jeice: frameSet('jeice', 4),
  ginyu: frameSet('ginyu', 4),
  nail: frameSet('nail', 4),
  soldier: frameSet('soldier', 4),
  trunks: frameSet('trunks', 4),
  trunks_ssj: frameSet('trunks_ssj', 4),
  frieza1: frameSet('frieza1', 4),
  frieza2: frameSet('frieza2', 4),
  frieza3: frameSet('frieza3', 4),
  frieza4: frameSet('frieza4', 4),
  frieza5: frameSet('frieza5', 4),
  cooler: frameSet('cooler', 4),
};

/** Native-drawn loop used only while the fighter is in a true idle state. */
export const IDLE_FRAMES: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(['goku', 'gohan', 'krillin', 'vegeta', 'piccolo', 'trunks', 'trunks_ssj', 'frieza5', 'cooler', 'ginyu', 'frieza4', 'zarbon2', 'cui', 'dodoria', 'zarbon', 'guldo', 'recoome', 'burter', 'jeice', 'nail', 'soldier', 'frieza1', 'frieza2', 'frieza3'].map((actor) => [actor, frameSet(actor, 4, 'idle')])),
};

/** Authored core-party charge loops and special-release sequences; skill clips still own VFX and damage. */
const CORE_PARTY = ['goku', 'gohan', 'krillin', 'vegeta', 'piccolo'];
export const POSE_FRAMES: Readonly<Record<string, Readonly<Partial<Record<'charge' | 'special', readonly string[]>>>>> =
  Object.fromEntries(CORE_PARTY.map((actor) => [actor, {
    charge: frameSet(actor, 4, 'charge'),
    special: frameSet(actor, 4, 'special'),
  }]));

/** Authored recoil and recovery. Additional roster reactions can join this map as they pass review. */
export const HURT_FRAMES: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(CORE_PARTY.map((actor) => [actor, frameSet(actor, 4, 'hurt')])),
};

/** Goku's form-specific authored reactions. Kaioken uses the approved base body at a matched anchor. */
export const GUARD_FRAMES: Readonly<Record<string, readonly string[]>> = {
  goku: frameSet('goku', 4, 'guard'),
};
export const FORM_GUARD_FRAMES: Readonly<Partial<Record<PowerupSetId, readonly string[]>>> = {
  goku_ssj: frameSet('goku_ssj', 4, 'guard'),
};
export const FORM_HURT_FRAMES: Readonly<Partial<Record<PowerupSetId, readonly string[]>>> = {
  goku_ssj: frameSet('goku_ssj', 4, 'hurt'),
};
export const KAIOKEN_FORM_FRAMES: Readonly<Record<'idle' | 'attack' | 'charge' | 'special' | 'guard' | 'hurt' | 'ko' | 'victory', readonly string[]>> = {
  idle: frameSet('goku_kaioken', 4, 'idle'),
  attack: frameSet('goku_kaioken', 4, 'attack'),
  charge: frameSet('goku_kaioken', 4, 'charge'),
  special: frameSet('goku_kaioken', 4, 'special'),
  guard: frameSet('goku_kaioken', 4, 'guard'),
  hurt: frameSet('goku_kaioken', 4, 'hurt'),
  ko: frameSet('goku_kaioken', 1, 'ko'),
  victory: frameSet('goku_kaioken', 1, 'victory'),
};
export const KAIOKEN_AURA_FRAMES = Array.from({ length: 4 }, (_, i) => `goku_kaioken_aura_frame_${String(i + 1).padStart(2, '0')}`);

export const ANIMATION_PROFILE = {
  attack: { fps: 40, loop: false },
  idle: { fps: 5, loop: true },
  charge: { fps: 8, loop: true },
  special: { fps: 30, loop: false },
  hurt: { fps: 16, loop: false },
  guard: { fps: 18, loop: false },
} as const;

export const battleAnimationFrameNames = (): string[] => [
  ...Object.values(ATTACK_FRAMES),
  ...Object.values(IDLE_FRAMES),
  ...Object.values(POSE_FRAMES).flatMap((poses) => Object.values(poses)),
  ...Object.values(HURT_FRAMES),
  ...Object.values(GUARD_FRAMES),
  ...Object.values(FORM_GUARD_FRAMES),
  ...Object.values(FORM_HURT_FRAMES),
  ...Object.values(KAIOKEN_FORM_FRAMES),
  KAIOKEN_AURA_FRAMES,
].flat();




