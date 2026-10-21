import { chromium } from '@playwright/test';
import fs from 'node:fs';
const heroes = ['gohan', 'krillin', 'vegeta', 'goku', 'piccolo'];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://127.0.0.1:5199/'); await page.waitForFunction(() => window.__session?.mode === 'title');
for (const h of heroes) {
  await page.evaluate((h) => {
    const s = window.__session; for (const id of ['gohan', 'krillin', 'vegeta', 'goku', 'piccolo']) if (!s.state.roster.find((m) => m.id === id)) { const m = JSON.parse(JSON.stringify(s.state.roster[0])); m.id = id; s.state.roster.push(m); }
    s.state.party = [h]; s.state.mapId = 'shore'; s.state.x = 20; s.state.y = 14; s.state.facing = 'down'; s.loadState(s.state);
  }, h);
  await page.waitForFunction(() => window.__world && window.__game.scene.isActive('world'), null, { timeout: 60000 });
  await page.evaluate(() => { const w = window.__world; w.manual = true; w.debugTeleport(20, 14); });
  const dirs = { right: [1, 0], up: [0, -1], left: [-1, 0], down: [0, 1] };
  for (const [d, v] of Object.entries(dirs)) {
    await page.evaluate(([v]) => { const w = window.__world; w.debugTeleport(20, 14); w.debugWalk(v[0], v[1], 130); }, [v]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `evidence/overworld/${h}_${d}_walk.png`, clip: { x: 400, y: 160, width: 160, height: 160 } });
    await page.evaluate(() => window.__world.debugWalk(0, 0, 50));
    await page.waitForTimeout(100);
    await page.screenshot({ path: `evidence/overworld/${h}_${d}_idle.png`, clip: { x: 400, y: 160, width: 160, height: 160 } });
  }
}
console.log(errs.join('\n') || 'no errors'); await browser.close();
