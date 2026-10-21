// Starts a game, then resizes the window through several sizes, reporting canvas vs camera size (they must match).
// node tools/probe_resize.mjs <baseUrl> <dpr> <WxH> [<WxH> ...]
import { chromium } from '@playwright/test';
const [base, dpr, ...sizes] = process.argv.slice(2);
const [w, h] = sizes[0].split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr) });
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 });
await page.getByRole('button', { name: 'New Game' }).click();
await page.waitForSelector('text=Skip intro'); await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__session.mode === 'world' && !window.__session.overlay, null, { timeout: 60000 });
let bad = 0;
// stopped-scene scenario: stop the world scene, resize while it is stopped, restart it
if (process.env.STOPPED === '1') await page.evaluate(() => window.__game.scene.stop('world'));
for (const s of sizes) {
  const [rw, rh] = s.split('x').map(Number);
  await page.setViewportSize({ width: rw, height: rh }); await page.waitForTimeout(900);
  if (process.env.STOPPED === '1') await page.evaluate(() => { const s = window.__session; s.loadState(s.state); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = window.__game; const c = g.scene.getScene('world').cameras.main; return { canvas: [g.canvas.width, g.canvas.height], cam: [c.width, c.height], zoom: c.zoom }; });
  const ok = r.canvas[0] === r.cam[0] && r.canvas[1] === r.cam[1];
  if (!ok) bad++;
  console.log(s, JSON.stringify(r), ok ? 'OK' : 'MISMATCH');
}
console.log(bad ? `FAIL ${bad}` : 'ALL OK');
await browser.close();
