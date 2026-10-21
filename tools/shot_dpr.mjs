// Screenshot helper with device scale factor + optional session setup: node tools/shot_dpr.mjs <url> <out.png> <WxH> <dpr> [evalJs] [wait-ms]
import { chromium } from '@playwright/test';
const [url, out, size = '1280x720', dpr = '1', js, wait = '4000'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr) });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
if (js) { await page.evaluate(js); await page.waitForTimeout(3000); }
await page.screenshot({ path: out });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
