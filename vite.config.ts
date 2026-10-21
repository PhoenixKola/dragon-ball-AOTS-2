import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000, sourcemap: false },
  server: { port: 5173, host: '127.0.0.1' },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 60000 },
});
