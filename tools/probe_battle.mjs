import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://127.0.0.1:5199/'); await page.waitForFunction(() => window.__session?.mode === 'title');
await page.evaluate(() => { const s = window.__session; s.mode = 'world'; s.state.mapId = 'shore'; void s.battleFlow({ foes: ['scout', 'scout'], title: 'probe', party: ['gohan', 'krillin'] }, false); });
await page.waitForFunction(() => window.__battle, null, { timeout: 30000 });
await page.evaluate(() => { window.__battle.manual = true; });
let last = '';
for (let i = 0; i < 400; i++) {
  const st = await page.evaluate(() => {
    const s = window.__session, c = s.battle, b = window.__battle;
    if (s.overlay?.kind === 'results') return { done: true };
    if (!c) return { nobattle: true, overlay: s.overlay?.kind };
    const d = c.director;
    if (c.actor && c.menu.kind === 'root') c.nav('ok');
    else if (c.menu.kind === 'target') c.nav('ok');
    if (d.activeCues.length) d.pressGuardAll();
    b.debugStep(200);
    return { state: d.state, t: Math.round(d.time), actor: d.currentActor?.name, menu: c.menu.kind, round: c.engine.round, foes: c.engine.enemies().map((e) => e.hp + '/' + e.stats.hp).join(' '), allies: c.engine.allies(false).map((a) => a.hp + '/' + a.stats.hp).join(' '), outcome: d.outcome };
  });
  const line = JSON.stringify(st);
  if (st.done || st.nobattle) { console.log('FINISHED', i, line); break; }
  if (i % 20 === 0 || line === last) console.log(i, line); last = line;
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
