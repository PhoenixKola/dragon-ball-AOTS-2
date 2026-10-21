// Evidence captures for the visual passes.  node tools/v4_shots.mjs <baseUrl> <outDir> <WxH> [all]
// Battle shots use the dev-battle URL; world / menu shots load state straight into the session (flags set so the NPCs are present).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:5173/', outDir = 'evidence/v4', size = '1280x720'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errs = [];
const mk = async () => { const p = await browser.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); }); return p; };

const battles = [
  ['b_five_heroes', 'party=goku,gohan,piccolo&foes=ginyu&lv=20'],
  ['b_party_vs_soldiers', 'party=gohan,krillin,vegeta&foes=scout,guard,scout&lv=8'],
  ['b_dende_nail_vs_zarbon2', 'party=dende,nail,gohan&foes=zarbon2&lv=12'],
  ['b_ssj_vs_ginyu', 'party=goku,vegeta,gohan&foes=ginyu&lv=20&ssj=1'],
  ['b_kaioken', 'party=goku,vegeta,gohan&foes=recoome&lv=16&kaioken=1'],
  ['b_vs_frieza2', 'party=krillin,piccolo,vegeta&foes=frieza2&lv=20&stage=frieza'],
  ['b_rage_full', 'party=goku,vegeta,gohan&foes=dodoria&lv=14&rage=100'],
  ['b_cooler', 'party=goku,gohan,piccolo&foes=cooler&lv=28&stage=frozen&ssj=1'],
];
for (const [name, q] of battles) {
  const page = await mk();
  await page.goto(`${base}?dev=battle&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ctl && window.__game?.scene.isActive('battle'), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${outDir}/${name}_${size}.png` });
  await page.close();
}

const page = await mk();
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 });
await page.screenshot({ path: `${outDir}/title_${size}.png` });
const flags = { dende_met: true, guru_done: true, cui_done: true, dodoria_done: true, scouts1: true, postgame_unlocked: true, cooler_clue: true, cooler_trail_open: true };
const worlds = [['shore', 20, 15], ['village', 21.5, 15], ['landing', 18, 20], ['guru', 22, 17], ['ridge', 18, 12], ['hold', 18, 15], ['cave', 6, 12], ['cooler_ruins', 8, 14], ['cooler_ruins', 34, 14]];
for (const [map, x, y] of worlds) {
  await page.evaluate(([map, x, y, flags]) => {
    const s = window.__session; Object.assign(s.state.flags, flags);
    s.state.mapId = map; s.state.x = x; s.state.y = y; s.state.facing = 'down'; s.loadState(s.state);
  }, [map, x, y, flags]);
  await page.waitForFunction(() => window.__world && window.__game.scene.isActive('world'), null, { timeout: 60000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${outDir}/w_${map}${x > 30 ? '_arena' : ''}_${size}.png` });
}
// menus: Loadout and the Postgame journal
await page.evaluate((flags) => { const s = window.__session; Object.assign(s.state.flags, flags); s.state.mapId = 'village'; s.state.x = 21.5; s.state.y = 15; s.loadState(s.state); }, flags);
await page.waitForFunction(() => window.__world && window.__game.scene.isActive('world'), null, { timeout: 60000 });
await page.waitForTimeout(1200);
await page.keyboard.press('Escape'); await page.waitForSelector('.menu-win');
await page.getByRole('tab', { name: 'Loadout' }).click(); await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}/menu_loadout_${size}.png` });
await page.getByRole('tab', { name: 'Journal' }).click(); await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}/menu_postgame_journal_${size}.png` });
await page.getByRole('tab', { name: 'Help' }).click(); await page.waitForTimeout(250);
await page.screenshot({ path: `${outDir}/menu_help_${size}.png` });
console.log(errs.join('\n') || 'no errors');
await browser.close();
