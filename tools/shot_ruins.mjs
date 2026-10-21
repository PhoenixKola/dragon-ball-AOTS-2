// Frozen Ruins QA shots: node tools/shot_ruins.mjs <baseUrl> <outDir> <WxH> [flags: after]
// Saves the whole map (camera zoomed out) and the route points (entrance, save, patrols, chests, arena, rematch).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, outDir, size = '1280x720', mode = ''] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errs = []; page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 });
await page.getByRole('button', { name: 'New Game' }).click();
await page.waitForSelector('text=Skip intro'); await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__session.mode === 'world' && !window.__session.overlay, null, { timeout: 60000 });
const flags = { dende_met: true, guru_done: true, cui_done: true, dodoria_done: true, scouts1: true, postgame_unlocked: true, cooler_clue: true, cooler_trail_open: true, ...(mode === 'after' ? { cooler_defeated: true } : {}) };
const go = async (x, y) => {
  await page.evaluate(([x, y, flags]) => { const s = window.__session; Object.assign(s.state.flags, flags); s.state.mapId = 'cooler_ruins'; s.state.x = x; s.state.y = y; s.state.facing = 'right'; s.loadState(s.state); }, [x, y, flags]);
  await page.waitForFunction(() => window.__world && window.__game.scene.isActive('world') && window.__session.state.mapId === 'cooler_ruins', null, { timeout: 60000 });
  await page.evaluate(() => window.__world.debugNoEncounters());
  await page.waitForTimeout(1500);
};
await go(3, 14);
const pts = [['entrance', 3, 14], ['save', 8, 14.4], ['chest1', 15, 8.4], ['chest2', 27, 20.4], ['bridge', 31, 14]];
for (const [n, x, y] of pts) { await page.evaluate(([x, y]) => window.__world.debugTeleport(x, y), [x, y]); await page.waitForTimeout(700); await page.screenshot({ path: `${outDir}/ruins_${mode || 'before'}_${n}_${size}.png` }); }
await page.evaluate(() => { const s = window.__session; for (const f of ['cr_foe1', 'cr_foe2', 'cr_foe3']) s.state.flags['foe:' + f] = true; s.loadState(s.state); }); await page.waitForTimeout(1500);
await page.evaluate(() => window.__world.debugTeleport(33, 14.5)); await page.waitForTimeout(700); await page.screenshot({ path: `${outDir}/ruins_${mode || 'before'}_arena_${size}.png` });
await page.evaluate(() => window.__world.debugTeleport(41.5, 14.5)); await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/ruins_${mode || 'before'}_rematch_${size}.png` });
// whole map
await page.evaluate(() => { const w = window.__world, c = w.cameras.main; const mw = w.map.w * 32, mh = w.map.h * 32; const z = Math.min(c.width / mw, c.height / mh); c.setBounds(-5000, -5000, 10000, 10000); c.setZoom(z); c.centerOn(mw / 2, mh / 2); c.setZoom = () => c; c.centerOn = () => c; c.setScroll = () => c; c.scrollX = c.scrollX; });
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/ruins_${mode || 'before'}_fullmap_${size}.png` });
console.log(errs.join('\n') || 'no errors');
await browser.close();
