// Launches installed Chrome/Edge like START_GAME.bat does (--app --start-fullscreen) and reports canvas/camera/scale state.
// node tools/probe_app_window.mjs [chrome|msedge] [url]
import { chromium } from '@playwright/test';
const [channel = 'chrome', url = 'http://127.0.0.1:5173'] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(process.env.TEMP + '/aots-probe-' + Date.now(), { channel, headless: false, viewport: null, args: [`--app=${url}`, '--start-fullscreen', '--use-gl=swiftshader', ...(process.env.DSF ? ['--force-device-scale-factor=' + process.env.DSF] : [])] });
const page = ctx.pages()[0] ?? await ctx.waitForEvent('page');
await page.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => { const g = window.__game; const c = g.canvas; const cam = g.scene.getScene('title').cameras.main; return { win: [innerWidth, innerHeight, devicePixelRatio], screen: [screen.width, screen.height], fs: !!document.fullscreenElement, canvas: [c.width, c.height, c.style.width, c.style.height], cam: [cam.width, cam.height, cam.zoom], gameSize: [g.scale.width, g.scale.height] }; });
console.log(JSON.stringify(info));
await page.screenshot({ path: process.env.OUT ?? 'evidence/layout_after/app_window.png' });
await ctx.close();
