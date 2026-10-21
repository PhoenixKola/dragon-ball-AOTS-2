// Lists the /assets files the game actually requests (boot, title, new game, world, a dev battle) and the public files it never touches.
// node tools/audit_runtime_requests.mjs <baseUrl>   (needs a dev or preview server)
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const seen = new Set();
const track = (page) => page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/assets/')) seen.add(decodeURIComponent(u.pathname.slice(1))); });
let page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); track(page);
await page.goto(base); await page.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 });
await page.getByRole('button', { name: 'New Game' }).click(); await page.waitForSelector('text=Skip intro'); await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__session.mode === 'world' && !window.__session.overlay, null, { timeout: 60000 });
await page.keyboard.press('Escape'); await page.waitForTimeout(800);
for (const t of ['Party', 'Items', 'Skills', 'Status', 'Combos', 'Settings']) { await page.getByText(t, { exact: true }).first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); }
await page.close();
page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); track(page);
await page.goto(`${base}/?dev=battle&party=goku,gohan,krillin,vegeta,piccolo&foes=scout,cui&lv=20`); await page.waitForSelector('.cmd-root .cmd', { timeout: 90000 });
for (const k of ['Enter', 'ArrowRight', 'Enter']) { await page.keyboard.press(k); await page.waitForTimeout(300); }
await browser.close();
const all = []; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : all.push(path.relative('public', p).split(path.sep).join('/')); } }; walk('public/assets');
const unused = all.filter((f) => !seen.has(f));
fs.writeFileSync(process.env.OUT ?? 'unrequested.txt', unused.join('\n'));
console.log(`public files: ${all.length}  requested: ${all.length - unused.length}  never requested: ${unused.length}`);
const by = {}; for (const f of unused) { const k = path.dirname(f); by[k] = (by[k] ?? 0) + 1; } console.log(by);
