import { expect, test } from '@playwright/test';

test('loads the dinosaurs and animates them without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('build')).toContainText('v0.0.0');

  // The render loop must be running: animated dinosaurs change the picture between frames. A blank or
  // frozen canvas would give identical screenshots.
  const first = await canvas.screenshot();
  // Idle animations are small at the park camera's distance and CI renders in software, slowly, so allow
  // plenty of time for a frame that differs.
  await expect.poll(async () => (await canvas.screenshot()).equals(first), { timeout: 30_000 }).toBe(false);

  expect(errors).toEqual([]);
});

test('asks to be turned sideways in portrait', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('./');
  await expect(page.getByText('Turn me sideways!')).toBeVisible();
});

test('drives the jeep to where the player taps', async ({ page }) => {
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-moving', 'false');

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas has no size');
  }
  // Up and to the left of the jeep, which starts in the middle of the screen.
  await canvas.click({ position: { x: box.width * 0.25, y: box.height * 0.3 } });
  await expect(canvas).toHaveAttribute('data-moving', 'true');
  await expect(canvas).toHaveAttribute('data-moving', 'false', { timeout: 20_000 });
});
