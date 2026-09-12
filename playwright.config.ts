import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests.
 *
 * The game is a single canvas, so unit tests cannot see any of it: a scene that
 * throws on spawn, a sprite that never gets destroyed, an animation that keeps
 * running while the game is paused — all of that is invisible to vitest. These
 * run the built game in a real browser to catch that class of regression.
 *
 * Kept deliberately small: this is a smoke check, not a visual-regression
 * suite. It runs against `vite preview` so it exercises the production bundle.
 */

const PORT = 4173;
const BASE_PATH = '/tower-defense-xdark/';

export default defineConfig({
  testDir: './e2e',
  // One browser, run serially: the assertions are timing-sensitive and there is
  // nothing here that parallelism would meaningfully speed up.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    // Environments that ship their own Chromium (some sandboxes, and this
    // project's cloud dev containers) set CHROMIUM_PATH rather than letting
    // Playwright download one.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
