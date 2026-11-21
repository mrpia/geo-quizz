import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the app is one screen state machine served at `/`,
  // with no nested routes, so `./assets/...` always resolves.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    // Pinned to `src/` so Vitest never sweeps up the Playwright specs that
    // will live in `e2e/` (same reason as in math-quizz).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
