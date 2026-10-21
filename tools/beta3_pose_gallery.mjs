// Dev gallery: shows every battle pose of an enemy sprite at the real in-battle size and writes one contact sheet per foe.
// node tools/beta3_pose_gallery.mjs <outDir> <foeId> [foeId...]   (BASE env = dev server, default http://127.0.0.1:5293)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [outDir, ...foes] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const POSES = ['idle', 'attack', 'guard', 'hurt', 'charge', 'special', 'victory', 'ko'];
for (const foe of foes) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5293'}/?dev=battle&party=gohan&foes=${foe}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__battle && window.__ctl, null, { timeout: 60000 });
  await page.evaluate(() => { window.__battle.manual = true; window.__battle.debugStep(60); });
  for (const p of POSES) {
    const info = await page.evaluate((pose) => {
      const b = window.__battle; const v = [...b.views.values()].find((x) => x.f.side === 'enemy');
      v.setPose(pose, 1e9); b.debugStep(50);
      return { resolved: v.img.texture.key, x: v.feet.x, y: v.feet.y, h: v.heightPx };
    }, p);
    const clip = { x: Math.max(0, info.x - 260), y: Math.max(0, info.y - info.h - 70), width: 520, height: Math.min(540, info.h + 100) };
    clip.height = Math.min(clip.height, 540 - clip.y);
    await page.screenshot({ path: `${outDir}/${foe}_${p}.png`, clip });
    console.log(foe, p, '->', info.resolved);
  }
  console.log(foe, errors.length ? errors.join('|') : 'no errors');
  await page.close();
}
await browser.close();
