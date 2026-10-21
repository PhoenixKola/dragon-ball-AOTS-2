import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', timeout: 240000, retries: 0, workers: 1, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5199', viewport: { width: 960, height: 540 }, launchOptions: { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] } },
  webServer: { command: 'node tools/serve-dist.mjs', url: 'http://127.0.0.1:5199', env: { PORT: '5199' }, reuseExistingServer: true, timeout: 30000 },
});
