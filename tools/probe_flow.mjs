import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://127.0.0.1:5199/'); await page.waitForFunction(() => window.__session?.mode === 'title');
await page.getByRole('button', { name: 'New Game' }).click();
await page.waitForSelector('text=Skip intro'); await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__session.mode === 'world' && !window.__session.overlay, null, { timeout: 30000 });
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 60; i++) { const r = await page.evaluate(() => ({ k: window.__session.overlay?.kind, x: window.__session.state.x, y: window.__session.state.y, mode: window.__session.mode, busy: window.__session.busy })); if (i % 5 === 0) console.log(JSON.stringify(r)); if (r.k === 'dialogue') break; await page.waitForTimeout(2000); }
await page.keyboard.up('ArrowRight');
for (let i = 0; i < 12; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); if (await page.evaluate(() => window.__session.mode === 'battle')) break; }
for (let i = 0; i < 40; i++) { const r = await page.evaluate(() => { const s = window.__session, c = s.battle; return { mode: s.mode, overlay: s.overlay?.kind, busy: s.busy, hasBattle: !!c, dstate: c?.director?.state, t: Math.round(c?.director?.time ?? -1), actor: c?.actor?.uid, menu: c?.menu?.kind, fade: s.fade }; }); console.log('S', JSON.stringify(r)); if (r.actor) break; await page.waitForTimeout(5000); }
const info = () => page.evaluate(() => ({ active: document.activeElement?.tagName + '.' + document.activeElement?.className, hasFocus: document.hasFocus(), menu: window.__session.battle.menu.kind, cur: window.__session.battle.menu.cursor, hud: !!document.querySelector('.cmd-root'), held: 0 }));
page.on('console', (m) => { if (m.text().startsWith('TRACE')) console.log(m.text()); });
await page.evaluate(() => { const c = window.__session.battle; for (const n of ['nav', 'activate', 'chooseTarget', 'submit', 'back', 'openRoot']) { const o = c[n].bind(c); c[n] = (...a) => { console.log('TRACE ' + n + ' ' + JSON.stringify(a.map((x) => (typeof x === 'object' ? x?.kind ?? '' : x))) + ' menu=' + c.menu.kind + ':' + c.menu.cursor); return o(...a); }; } });
console.log('before', JSON.stringify(await info()));
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
console.log('after Enter', JSON.stringify(await info()));
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))); await page.waitForTimeout(500);
console.log('after synthetic Enter', JSON.stringify(await info()));
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
console.log('after ArrowDown', JSON.stringify(await info()));
console.log(errs.join('\n') || 'no errors'); await browser.close();
