import { defineConfig } from '@playwright/test';
const port = Number(process.env.E2E_PORT || 5199);
export default defineConfig({
  testDir: 'tests/e2e', timeout: 240000, retries: 0, workers: 1, reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 960, height: 540 }, launchOptions: { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] } },
  webServer: { command: 'node tools/serve-dist.mjs', url: `http://127.0.0.1:${port}`, env: { PORT: String(port) }, reuseExistingServer: true, timeout: 30000 },
});
