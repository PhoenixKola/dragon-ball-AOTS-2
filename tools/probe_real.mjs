import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(() => localStorage.setItem('aots2.settings.v1', JSON.stringify({ battleSpeed: 1.6, guardPreset: 'relaxed' }))); await page.goto('http://127.0.0.1:5199/'); await page.waitForFunction(() => window.__session?.mode === 'title');
await page.evaluate(() => { const s = window.__session; s.mode = 'world'; void s.battleFlow({ foes: ['scout', 'scout'], title: 'probe', party: ['gohan', 'krillin'] }, false); });
await page.waitForFunction(() => window.__session.battle?.director, null, { timeout: 30000 });
const t0 = Date.now();
while (Date.now() - t0 < 120000) {
  const st = await page.evaluate(() => { const s = window.__session, c = s.battle; if (s.overlay?.kind) return { overlay: s.overlay.kind }; if (!c) return { none: true }; const d = c.director; return { state: d.state, t: Math.round(d.time), actor: d.currentActor?.name, input: d.isPlayerInput, menu: c.menu.kind, paused: c.paused, cues: d.activeCues.length, round: c.engine.round }; });
  console.log(JSON.stringify(st));
  if (st.overlay === 'results' || st.overlay === 'defeat') break;
  if (st.input && st.menu === 'root') await page.keyboard.press('Enter');
  else if (st.menu === 'target') await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
}
console.log(errs.join('\n') || 'no errors'); await browser.close();
