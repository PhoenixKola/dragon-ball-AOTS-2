// Slows actor loads a little and captures the loading screen, then the title: node tools/shot_loading.mjs <baseUrl> <outPrefix> <WxH> <dpr>
import { chromium } from '@playwright/test';
const [base, prefix, size = '1470x720', dpr = '1.25'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: Number(dpr) });
let open = false, n = 0; const waiters = [];
await p.route('**/assets/reviewed/actors/**', async (r) => { if (!open && ++n > 120) await new Promise((x) => waiters.push(x)); r.continue(); });   // let ~120 files through, hold the rest
await p.goto(base, { waitUntil: 'commit' });
await p.waitForSelector('.loading', { timeout: 20000 }); await p.waitForTimeout(2500);
await p.screenshot({ path: `${prefix}_loading.png` });
open = true; waiters.forEach((x) => x());
await p.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 120000 });
await p.screenshot({ path: `${prefix}_title.png` });
await b.close();
