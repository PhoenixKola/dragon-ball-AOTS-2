import { expect, test } from '@playwright/test';
import { boot, type W } from './support';

test('runtime music/SFX balance buses and transient safety', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.getByRole('button', { name: 'Settings' }).click(); // unlocks WebAudio with a real gesture
  await page.evaluate(() => {
    const w = window as W & { __audio: any };
    w.__audio.sfx('impact_big');
  });

  const mix = await page.evaluate(async () => {
    const w = window as W & { __audio: any; __music: any };
    // The one-shot victory cue is the short authored score. Measuring it exercises the same
    // OfflineAudioContext renderer without forcing several 32-bar tracks to render in CI.
    const buffer: AudioBuffer = await w.__music.get('victory');
    let peak = 0, sum = 0, count = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; sum += data[i] * data[i]; count++; }
    }
    await w.__music.play('victory', 80);
    const victoryId = w.__music.currentId;
    const a = w.__audio;
    const masterGain = a.master?.gain.value;
    return { peak, peakAtDefaultOutput: peak * a.volumes.music * masterGain, rms: Math.sqrt(sum / count), seconds: buffer.duration, victoryId, running: a.ready, musicVolume: a.volumes.music, sfxVolume: a.volumes.sfx, masterGain, limiter: { threshold: a.safety?.threshold.value, ratio: a.safety?.ratio.value } };
  });
  console.log('audio mix render measurement', mix);
  expect(mix.seconds).toBeGreaterThan(1);
  expect(mix.peakAtDefaultOutput, 'music bus and master headroom keep the measured peak below full scale').toBeLessThan(0.95);
  expect(mix.rms).toBeGreaterThan(0.001);
  expect(mix.running).toBe(true);
  expect(mix.victoryId).toBe('victory');
  expect(mix.musicVolume).toBe(0.55);
  expect(mix.sfxVolume).toBe(0.8);
  expect(mix.masterGain).toBeCloseTo(0.82, 5);
  expect(mix.limiter.threshold).toBe(-3);
  expect(mix.limiter.ratio).toBe(10);
  expect(errors).toEqual([]);
});
