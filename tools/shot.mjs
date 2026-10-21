// Dev screenshot helper: node tools/shot.mjs <url> <out.png> [wait-ms] [WxH] [script-file]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [url, out, wait = '2500', size = '1280x720', script] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
if (script) {
  const steps = JSON.parse(fs.readFileSync(script, 'utf8'));
  for (const s of steps) {
    if (s.key) await page.keyboard.press(s.key);
    if (s.eval) await page.evaluate(s.eval);
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.shot) await page.screenshot({ path: s.shot });
  }
}
await page.screenshot({ path: out });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
