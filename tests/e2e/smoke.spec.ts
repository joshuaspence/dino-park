import { type Page, expect, test } from '@playwright/test';

/**
 * Plays `ms` of game time on a fake clock in 100 ms frames, the most the game steps in one frame. `runFor` would
 * render a frame every 16 ms, which CI's software rendering is far too slow for over several seconds.
 */
async function playFor(page: Page, ms: number): Promise<void> {
  for (let played = 0; played < ms; played += 100) {
    await page.clock.fastForward(100);
  }
}

/**
 * Reads or writes the saved park in idb-keyval's default database and store, which is where `storage/parkStore`
 * keeps it under the key `park`.
 */
function savedPark(page: Page, write?: unknown): Promise<unknown> {
  return page.evaluate(
    (value) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction('keyval', value === undefined ? 'readonly' : 'readwrite');
          const request =
            value === undefined
              ? store.objectStore('keyval').get('park')
              : store.objectStore('keyval').put(value, 'park');
          request.onsuccess = () => resolve(value === undefined ? request.result : value);
          request.onerror = () => reject(request.error);
        };
      }),
    write,
  );
}

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

test('drives the jeep when a press is held just past a tap', async ({ page }) => {
  // A fake clock steps the frame loop in even 16 ms frames, so how long the press lasts in game time doesn't
  // depend on how fast the browser renders.
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas has no size');
  }
  // Longer than a tap but shorter than the hold replan interval: young children often press this long.
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.clock.runFor(450);
  await page.mouse.up();
  await page.clock.runFor(100);
  await expect(canvas).toHaveAttribute('data-moving', 'true');
});

test('a dinosaur asks for something soon after the park opens', async ({ page }) => {
  // Loading plus seconds of frames takes over 25 s in CI's software rendering.
  test.slow();
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-needs', '');
  await playFor(page, 4000);
  await expect(canvas).toHaveAttribute('data-needs', /^\w+:\w+$/);
});

test('loads the toy shed when the jeep stops there', async ({ page }) => {
  // Loading plus seconds of frames takes over 25 s in CI's software rendering.
  test.slow();
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-cargo', '');

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas has no size');
  }
  // The toy shed is just up and to the left of where the jeep starts.
  await canvas.click({ position: { x: box.width * 0.36, y: box.height * 0.42 } });
  await playFor(page, 6000);
  await expect(canvas).toHaveAttribute('data-moving', 'false');
  await expect(canvas).toHaveAttribute('data-cargo', 'toys');
});

test('saves a hatched egg and remembers it after a reload', async ({ page }) => {
  // Loading three times plus driving to the nest takes a while in CI's software rendering.
  test.slow();
  await page.clock.install();
  await page.goto('./');
  // A park whose first egg is full, as if five needs had been met.
  await savedPark(page, { version: 1, needsMet: 5, eggsHatched: 0 });
  await page.reload();
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '0');

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas has no size');
  }
  // The nest is up the cross road from where the jeep starts, just to its right.
  await canvas.click({ position: { x: box.width * 0.57, y: box.height * 0.2 } });
  await playFor(page, 8000);
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '1');
  await expect.poll(() => savedPark(page)).toEqual({ version: 1, needsMet: 5, eggsHatched: 1 });

  await page.reload();
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '1');
});
