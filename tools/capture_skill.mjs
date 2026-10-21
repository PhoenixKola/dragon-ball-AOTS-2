// Captures a frame strip of one battle action using the deterministic stepper.
// node tools/capture_skill.mjs <name> "<query>" '<command-json>' [frames=10] [interval=120] [startDelay=0]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [name, query, cmdJson, frames = '10', interval = '120', startDelay = '0'] = process.argv.slice(2);
fs.mkdirSync('evidence/skills', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5199'}/?dev=battle&${query}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__battle && window.__ctl, null, { timeout: 30000 });
await page.evaluate(() => { window.__battle.manual = true; });
await page.evaluate(() => window.__battle.debugStep(1700));
const ok = await page.evaluate((cmd) => {
  const c = window.__ctl;
  const parsed = JSON.parse(cmd);
  if (parsed.target === 'first') parsed.target = c.engine.enemies()[0].uid;
  if (parsed.target === 'second') parsed.target = c.engine.enemies()[1]?.uid;
  if (parsed.target === 'ally1') parsed.target = c.engine.allies()[1]?.uid;
  if (parsed.target === 'ally0') parsed.target = c.engine.allies()[0]?.uid;
  const r = c.director.submit(parsed);
  return JSON.stringify({ ok: r.ok, err: r.error, actor: c.director.currentActor?.name, state: c.director.state });
}, cmdJson);
console.log(name, ok);
if (Number(startDelay) > 0) await page.evaluate((d) => window.__battle.debugStep(d), Number(startDelay));
for (let i = 0; i < Number(frames); i++) {
  await page.evaluate((d) => window.__battle.debugStep(d), Number(interval));
  await page.waitForTimeout(120);
  await page.screenshot({ path: `evidence/skills/${name}_${String(i).padStart(2, '0')}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
