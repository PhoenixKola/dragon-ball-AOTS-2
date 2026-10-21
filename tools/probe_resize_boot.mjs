// Resizes the window while the game is still loading (like a browser going full screen at start-up) and reports the title scene state.
// node tools/probe_resize_boot.mjs <baseUrl> <WxH-start> <WxH-final> <dpr> <delayMs> <out.png>
import { chromium } from '@playwright/test';
const [base, start, fin, dpr = '1', delay = '300', out = 'evidence/layout_before/resize_boot.png'] = process.argv.slice(2);
const [w, h] = start.split('x').map(Number), [fw, fh] = fin.split('x').map(Number);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr) });
await p.goto(base, { waitUntil: 'commit' });
await p.waitForTimeout(Number(delay));
await p.setViewportSize({ width: fw, height: fh });
await p.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => { const g = window.__game; const c = g.canvas; const cam = g.scene.getScene('title').cameras.main; return { win: [innerWidth, innerHeight], canvas: [c.width, c.height, c.style.width], cam: [cam.width, cam.height, cam.zoom], game: [g.scale.width, g.scale.height] }; });
console.log(JSON.stringify(r)); await p.screenshot({ path: out }); await b.close();
