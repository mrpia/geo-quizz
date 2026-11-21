import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, run against the **built bundle in a real browser**.
 * Copied from math-quizz (plan, Phase 2 item 9).
 *
 * The rule that keeps this suite small: if a test can be written in Vitest,
 * it stays in Vitest. What lives here is what jsdom cannot run: WebGL, real
 * taps on the canvas through globe.gl's raycaster, and layout. Specs select
 * by `data-testid`, never by visible text, because the language is a setting.
 *
 * `vite preview` serves the production build, the bundle that ships.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,

  forbidOnly: !!process.env.CI,
  // Above the 30 s default: the globe is drawn in software (see below), and
  // its first frame alone can take seconds on a CI runner.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // WebGL without a GPU: Chromium draws it with SwiftShader, on the
          // CPU, only with this switch. Playwright 1.65.1 already passes it
          // among its default Chromium switches (playwright-core,
          // `chromiumSwitches`, which cites
          // https://issues.chromium.org/issues/40277080); it is repeated here
          // so a Playwright that drops it does not silently lose WebGL. With
          // it, headless Chromium 159 reported "ANGLE (Google, Vulkan 1.3.0
          // (SwiftShader Device (Subzero)…), SwiftShader driver)" on WSL2
          // (2026-11-21). The first spec fails if there is no WebGL at all.
          args: ['--enable-unsafe-swiftshader'],
        },
      },
    },
  ],

  webServer: {
    // `--strictPort` so a port already in use fails here, loudly, instead of
    // moving to 4174 and leaving Playwright to time out against nothing.
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Locally a preview server you already have open is reused. On CI there
    // is never one, so the build always runs.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
