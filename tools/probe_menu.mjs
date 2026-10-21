// Checks that every battle command is fully inside both its panel and the viewport: node tools/probe_menu.mjs <baseUrl> <outDir> <dpr> <WxH>...
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, outDir, dpr, ...sizes] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
let bad = 0;
for (const s of sizes) {
  const [w, h] = s.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr) });
  await page.goto(`${base}/?dev=battle&party=goku,gohan,krillin&foes=cui,dodoria&lv=12&stage=namek`, { waitUntil: 'load' });
  await page.waitForSelector('.cmd-root .cmd', { timeout: 90000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const root = document.querySelector('.cmd-root').getBoundingClientRect();
    const cmds = [...document.querySelectorAll('.cmd-root .cmd')].map((e) => { const b = e.getBoundingClientRect(); return { t: e.textContent, top: b.top, bottom: b.bottom, left: b.left, right: b.right, sw: e.scrollWidth, cw: e.clientWidth }; });
    return { root: { top: root.top, bottom: root.bottom, left: root.left, right: root.right }, vw: innerWidth, vh: innerHeight, cmds };
  });
  const issues = [];
  for (const c of r.cmds) {
    if (c.top < r.root.top || c.bottom > r.root.bottom || c.left < r.root.left || c.right > r.root.right) issues.push('outside panel: ' + c.t);
    if (c.top < 0 || c.bottom > r.vh || c.left < 0 || c.right > r.vw) issues.push('outside viewport: ' + c.t);
    if (c.sw > c.cw + 1) issues.push('text clipped: ' + c.t);
  }
  console.log(s, r.cmds.length + ' commands', issues.length ? issues.join('; ') : 'ALL VISIBLE', 'panelBottom=' + Math.round(r.root.bottom) + '/' + r.vh);
  bad += issues.length;
  await page.screenshot({ path: `${outDir}/menu_${s}.png` });
  await page.close();
}
await browser.close(); console.log(bad ? 'FAIL' : 'PASS');
