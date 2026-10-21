import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', timeout: 600000, retries: 0, workers: 1, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5295', viewport: { width: 1280, height: 720 }, launchOptions: { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npx vite --port 5295 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:5295', reuseExistingServer: true, timeout: 60000 },
});
