import { defineConfig, devices } from '@playwright/test';

// Overridable so two checkouts can each test their own build at once; unset or empty means the default.
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const url = `http://localhost:${port}/dino-park/`;

// Landscape tablet viewport: the primary target (docs/design.md §10).
const tablet = { viewport: { width: 1180, height: 820 }, hasTouch: true };

export default defineConfig({
  testDir: 'tests/e2e',
  // CI renders in software, where loading the park and playing seconds of game time each take tens of seconds.
  // The tests that play longest call `test.slow()`, tripling this, since they run close to it.
  timeout: 90_000,
  // Every test first waits for the models to load (`data-ready`), which on CI's software WebKit can pass the default
  // 5 s. A longer limit only waits longer when something is slow; it never lets a wrong value through.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: url,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...tablet,
        // Lets a local run use a preinstalled Chromium instead of downloading one.
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'], ...tablet } },
  ],
  webServer: {
    command: `pnpm preview --port ${port} --strictPort`,
    url,
    // Never reuse a server already on the port: it may be another checkout's preview, silently serving its build
    // instead of this one. A busy port fails the run instead; set PLAYWRIGHT_PORT to pick another.
    reuseExistingServer: false,
  },
});
