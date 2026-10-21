// Walks the lead hero in all four directions with real keys and saves a close-up strip: node tools/probe_walk.mjs <baseUrl> <out.png> <WxH>
import { chromium } from '@playwright/test';
const [base, out, size = '1280x720'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 });
await page.getByRole('button', { name: 'New Game' }).click();
await page.waitForSelector('text=Skip intro'); await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__session.mode === 'world' && !window.__session.overlay, null, { timeout: 60000 });
await page.evaluate(() => window.__world.debugNoEncounters());
const rows = [];
for (const [key, dir] of [['ArrowRight', 'right'], ['ArrowLeft', 'left'], ['ArrowDown', 'down'], ['ArrowUp', 'up']]) {
  await page.keyboard.down(key); await page.waitForTimeout(450);
  const a = await page.evaluate(() => window.__world.debugAvatar());
  const p = await page.evaluate(() => { const w = window.__world; const c = w.cameras.main; const r = document.querySelector('canvas').getBoundingClientRect(); const sx = (w.player.x - c.worldView.x) / c.worldView.width, sy = (w.player.y - c.worldView.y) / c.worldView.height; return { x: r.left + sx * r.width, y: r.top + sy * r.height, s: r.width / 960 }; });
  const half = Math.round(40 * p.s);
  await page.screenshot({ path: out.replace('.png', `_${dir}.png`), clip: { x: Math.max(0, p.x - half), y: Math.max(0, p.y - half * 1.6), width: half * 2, height: half * 2 } });
  await page.keyboard.up(key); await page.waitForTimeout(150);
  rows.push(`${dir}: facing=${a.facing} texture=${a.texture} flipX=${a.flipX}`);
}
console.log(rows.join('\n'));
await browser.close();
