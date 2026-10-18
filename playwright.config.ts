import { defineConfig, devices } from '@playwright/test';

// Landscape tablet viewport: the primary target (docs/design.md §10).
const tablet = { viewport: { width: 1180, height: 820 }, hasTouch: true };

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/dino-park/',
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
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173/dino-park/',
    reuseExistingServer: !process.env.CI,
  },
});
