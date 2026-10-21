// Starts a new game and screenshots the overworld: node tools/shot_world.mjs <baseUrl> <out.png> <WxH> <dpr> [resizeToWxH]
import { chromium } from '@playwright/test';
const [base, out, size = '1280x720', dpr = '1', resize] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr) });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 });
const resizeAfter = process.env.RESIZE_AFTER === '1';
if (resize && !resizeAfter) { const [rw, rh] = resize.split('x').map(Number); await page.setViewportSize({ width: rw, height: rh }); await page.waitForTimeout(800); }
await page.screenshot({ path: out.replace('.png', '_title.png') });
await page.getByRole('button', { name: 'New Game' }).click();
await page.waitForSelector('text=Skip intro'); await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__session.mode === 'world' && !window.__session.overlay, null, { timeout: 60000 });
await page.waitForTimeout(2500);
if (resize && resizeAfter) { const [rw, rh] = resize.split('x').map(Number); await page.setViewportSize({ width: rw, height: rh }); await page.waitForTimeout(1500); }
await page.screenshot({ path: out });
console.log(JSON.stringify(await page.evaluate(() => { const c = document.querySelector('canvas'); return { canvas: [c.width, c.height], css: [c.style.width, c.style.height], k: window.__game.scale.width }; })), errors.join('\n') || 'no errors');
await browser.close();
