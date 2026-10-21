// Measures animation frames per second of the title screen under different Chromium GL flags: node tools/probe_fps.mjs <baseUrl>
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
for (const [name, args] of [['swiftshader', ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']], ['angle-d3d11', ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist']], ['default-gpu', ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']]]) {
  try {
    const b = await chromium.launch({ args }); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
    await p.goto(base); await p.waitForFunction(() => window.__session?.mode === 'title', null, { timeout: 90000 }); await p.waitForTimeout(1500);
    const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
    const gl = await p.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
    console.log(name, Math.round(fps) + ' fps', gl); await b.close();
  } catch (e) { console.log(name, 'failed', String(e).slice(0, 80)); }
}
