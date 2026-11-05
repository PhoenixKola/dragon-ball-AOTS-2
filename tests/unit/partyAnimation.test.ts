import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ANIMATION_PROFILE, ATTACK_FRAMES, HURT_FRAMES, IDLE_FRAMES, POSE_FRAMES } from '../../src/data/battleAnimationFrames';
import { getClip } from '../../src/engine/animation/clips';

describe('authored melee strikes', () => {
  it('ships four distinct drawings on each reviewed actor’s existing canvas', () => {
    const sets: Array<[string, string, readonly string[]]> = [
      ...Object.entries(ATTACK_FRAMES).map(([actor, frames]) => [actor, 'attack', frames] as [string, string, readonly string[]]),
      ...Object.entries(IDLE_FRAMES).map(([actor, frames]) => [actor, 'idle', frames] as [string, string, readonly string[]]),
      ...Object.entries(POSE_FRAMES).flatMap(([actor, poses]) => Object.entries(poses).map(([pose, frames]) => [actor, pose, frames!] as [string, string, readonly string[]])),
      ...Object.entries(HURT_FRAMES).map(([actor, frames]) => [actor, 'hurt', frames] as [string, string, readonly string[]]),
    ];
    for (const [actor, pose, frames] of sets) {
      const stillPose = pose === 'attack' || pose === 'idle' ? 'idle' : pose;
      const still = readFileSync(join(process.cwd(), 'public/assets/reviewed/actors', `${actor}_${stillPose}.png`));
      const hashes = frames.map((name) => {
        const png = readFileSync(join(process.cwd(), 'public/assets/reviewed/actors', `${name}.png`));
        expect(png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))).toBe(true);
        expect(png.readUInt32BE(16)).toBe(still.readUInt32BE(16));
        expect(png.readUInt32BE(20)).toBe(still.readUInt32BE(20));
        return createHash('sha256').update(png).digest('hex');
      });
      expect(new Set(hashes).size).toBe(4);
    }
  });

  it('keeps the base Goku idle loop genuinely changing and explicitly looped', () => {
    const frames = IDLE_FRAMES.goku;
    expect(frames).toHaveLength(4);
    expect(new Set(frames).size).toBe(4);
    expect(ANIMATION_PROFILE).toEqual({ attack: { fps: 40, loop: false }, idle: { fps: 5, loop: true }, charge: { fps: 8, loop: true }, special: { fps: 30, loop: false }, hurt: { fps: 16, loop: false } });
  });

  it('gives every core hero distinct charge and signature-release drawings', () => {
    for (const actor of ['goku', 'gohan', 'krillin', 'vegeta', 'piccolo']) {
      for (const pose of ['charge', 'special'] as const) {
        const frames = POSE_FRAMES[actor][pose]!;
        expect(frames).toHaveLength(4);
        const hashes = frames.map((name) => createHash('sha256').update(readFileSync(join(process.cwd(), 'public/assets/reviewed/actors', `${name}.png`))).digest('hex'));
        expect(new Set(hashes).size, `${actor} ${pose}`).toBe(4);
      }
    }
  });

  it('starts a new punch before each authoritative hit marker', () => {
    for (const id of ['gohan_combo', 'gohan_barrage', 'krillin_combo', 'vegeta_combo', 'goku_combo', 'goku_assault', 'piccolo_combo']) {
      const clip = getClip(id);
      const strikes = clip.ops.filter((o) => o.op === 'pose' && o.pose === 'attack').map((o) => o.t);
      expect(strikes).toHaveLength(clip.hitCount);
      clip.hitTimes.forEach((hit, i) => expect(hit - strikes[i]).toBeGreaterThanOrEqual(60));
    }
  });

  it('restarts multi-hit enemy strikes before contact instead of after it', () => {
    for (const id of ['e_melee1', 'e_melee2', 'e_melee3', 'e_melee4', 'e_melee5', 'e_rush_all', 'e_pincer']) {
      const clip = getClip(id);
      const strikes = clip.ops.filter((o) => o.op === 'pose' && o.pose === 'attack').map((o) => o.t);
      expect(strikes).toHaveLength(clip.hitCount);
      clip.hitTimes.forEach((hit, i) => {
        expect(hit - strikes[i]).toBeGreaterThanOrEqual(60);
        expect(hit - strikes[i]).toBeLessThanOrEqual(70);
      });
    }
  });
});
