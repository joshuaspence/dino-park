import { type Page, expect, test } from '@playwright/test';

import { strings } from '../../src/ui/strings';

/**
 * Plays `ms` of game time on a fake clock in 100 ms frames, the most the game steps in one frame. `runFor` would
 * render a frame every 16 ms, which CI's software rendering is far too slow for over several seconds. With `until`, it
 * stops as soon as that holds, so `ms` is the most game time to allow rather than all of it.
 */
async function playFor(page: Page, ms: number, until?: () => Promise<boolean>): Promise<void> {
  for (let played = 0; played < ms && !(await until?.()); played += 100) {
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
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-needs', '');
  await playFor(page, 4000);
  await expect(canvas).toHaveAttribute('data-needs', /^\w+:\w+$/);
});

test('loads the toy shed when the jeep stops there', async ({ page }) => {
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
  await playFor(page, 8000, async () => (await canvas.getAttribute('data-eggs-hatched')) === '1');
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '1');
  await expect.poll(() => savedPark(page)).toEqual({ version: 1, needsMet: 5, eggsHatched: 1 });

  await page.reload();
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '1');
});

test('honks, and the nearest dinosaur turns to look', async ({ page }) => {
  // The look lasts seconds of game time, which CI's software rendering can stretch past any real-time wait.
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-looking', 'false');
  await page.getByRole('button', { name: 'Honk' }).click();
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-looking', 'true');
  // It looks for a few seconds, then goes back to what it was doing.
  await playFor(page, 4000);
  await expect(canvas).toHaveAttribute('data-looking', 'false');
});

test('honks from the keyboard too, as switch access and screen readers do', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Honk' }).focus();
  await page.keyboard.press('Enter');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-looking', 'true');
});

test('drives with the arrow keys and honks with Space', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-moving', 'false');

  // The jeep starts on the south road, which runs east–west, so holding right drives it along that road.
  await page.keyboard.down('ArrowRight');
  await playFor(page, 1000);
  await expect(canvas).toHaveAttribute('data-moving', 'true');
  await page.keyboard.up('ArrowRight');
  // Letting go finishes the last short stretch and stops.
  await playFor(page, 6000);
  await expect(canvas).toHaveAttribute('data-moving', 'false');

  await page.keyboard.press('Space');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-looking', 'true');
});

test('draws the camera in on a hatch, then back to the jeep', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await savedPark(page, { version: 1, needsMet: 5, eggsHatched: 0 });
  await page.reload();
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-spotlight', 'false');

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas has no size');
  }
  // The nest is up the cross road from where the jeep starts, just to its right.
  await canvas.click({ position: { x: box.width * 0.57, y: box.height * 0.2 } });
  // Drive there in short steps and stop the moment it hatches, since the spotlight only lasts a couple of seconds.
  for (let played = 0; played < 10_000 && (await canvas.getAttribute('data-eggs-hatched')) !== '1'; played += 200) {
    await playFor(page, 200);
  }
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '1');
  await expect(canvas).toHaveAttribute('data-spotlight', 'true');
  await playFor(page, 3000);
  await expect(canvas).toHaveAttribute('data-spotlight', 'false');
});

test('chimes when something is loaded onto the jeep', async ({ page }) => {
  // Record every oscillator the game makes, so the test can tell which sounds it played without hearing them.
  await page.addInitScript(() => {
    const oscillators: OscillatorNode[] = [];
    Object.assign(window, { oscillators });
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      const oscillator = create.call(this);
      oscillators.push(oscillator);
      return oscillator;
    };
  });
  const frequencies = () =>
    page.evaluate(() =>
      (window as unknown as { oscillators: OscillatorNode[] }).oscillators.map((node) => node.frequency.value),
    );

  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  expect(await frequencies()).not.toContain(1568);

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas has no size');
  }
  // The toy shed is just up and to the left of where the jeep starts.
  await canvas.click({ position: { x: box.width * 0.36, y: box.height * 0.42 } });
  await playFor(page, 6000);
  await expect(canvas).toHaveAttribute('data-cargo', 'toys');
  // The load chime's two bell notes.
  expect(await frequencies()).toEqual(expect.arrayContaining([1047, 1568]));
});

test('goes quiet while the page is hidden, and comes back with it', async ({ page }) => {
  // Keep hold of the game's audio context, and let the test say whether the page is hidden.
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [];
    Object.assign(window, { contexts });
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.push(this);
      }
    };
  });
  const state = () => page.evaluate(() => (window as unknown as { contexts: AudioContext[] }).contexts.at(-1)?.state);
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { value, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

  await page.goto('./');
  await expect(page.locator('canvas.world')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Honk' }).click();
  await expect.poll(state).toBe('running');

  await setHidden(true);
  await expect.poll(state).toBe('suspended');
  await setHidden(false);
  await expect.poll(state).toBe('running');

  // Hidden and back before the suspend settles: `state` still reads `running` at the show.
  const settled = await page.evaluate(async () => {
    const [context] = (window as unknown as { contexts: AudioContext[] }).contexts;
    if (!context) throw new Error('The game made no audio context');
    const pending: Promise<void>[] = [];
    for (const method of ['suspend', 'resume'] as const) {
      const original = context[method].bind(context);
      context[method] = () => {
        const promise = original();
        pending.push(promise);
        return promise;
      };
    }
    for (const value of [true, false]) {
      Object.defineProperty(document, 'hidden', { value, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }
    await Promise.all(pending);
    return context.state;
  });
  expect(settled).toBe('running');
});

test('a dinosaur calls out when it wants something', async ({ page }) => {
  // Record each recorded sound the game starts, so the test can tell a call played without hearing it.
  await page.addInitScript(() => {
    const started: number[] = [];
    Object.assign(window, { started });
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function (this: AudioContext) {
      const source = create.call(this);
      const start = source.start.bind(source);
      source.start = (...args: Parameters<AudioBufferSourceNode['start']>) => {
        started.push(source.buffer?.duration ?? 0);
        start(...args);
      };
      return source;
    };
  });
  const calls: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/audio/dinos/') && response.ok()) {
      calls.push(response.url());
    }
  });

  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => calls.length).toBe(5);
  await playFor(page, 4000);
  await expect(canvas).toHaveAttribute('data-needs', /^\w+:\w+$/);
  // The call is a decoded recording, which the synthesised need pop isn't.
  const started = await page.evaluate(() => (window as unknown as { started: number[] }).started);
  expect(started.some((seconds) => seconds > 0.3)).toBe(true);
});

/** Holds the grown-up gate's lock for its full 3 s. */
async function holdGate(page: Page): Promise<void> {
  const box = await page.getByRole('button', { name: strings.gate }).boundingBox();
  if (!box) {
    throw new Error('The grown-up gate has no size');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.fastForward(3100);
  await page.mouse.up();
}

/** The number a question names in words, as its digit. */
async function namedNumber(page: Page, question: string): Promise<number> {
  const text = (await page.locator(question).textContent()) ?? '';
  const word = strings.numberWords.find((candidate) => text.includes(` ${candidate}.`));
  if (!word) {
    throw new Error(`No number named in "${text}"`);
  }
  return strings.numberWords.indexOf(word) + 1;
}

/** Taps `number` among the shuffled digits on screen. */
const tapNumber = (page: Page, number: number) =>
  page.getByRole('button', { name: String(number), exact: true }).click();

/** Opens the parent area as a grown-up would: holds the lock for 3 s, then taps the number named in words. */
async function openParentArea(page: Page): Promise<void> {
  await holdGate(page);
  await tapNumber(page, await namedNumber(page, '#parent-ask'));
  await expect(page.getByRole('heading', { name: strings.parentTitle })).toBeVisible();
}

test('keeps the parent area behind a hold and a number named in words', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('canvas.world')).toHaveAttribute('data-ready', 'true');

  // A tap, or a hold that isn't long enough, asks nothing.
  await page.getByRole('button', { name: strings.gate }).click();
  await page.clock.fastForward(3100);
  await expect(page.locator('#parent-ask')).toHaveCount(0);

  // A wrong number closes the gate again.
  await holdGate(page);
  await tapNumber(page, ((await namedNumber(page, '#parent-ask')) % 9) + 1);
  await expect(page.locator('#parent-ask')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: strings.parentTitle })).toHaveCount(0);

  // ...and the lock then ignores holds for a while, so guessing is slow.
  await holdGate(page);
  await expect(page.locator('#parent-ask')).toHaveCount(0);
  await page.clock.fastForward(30_000);
  await openParentArea(page);
  await expect(page.getByText(`${strings.version} `)).toContainText('0.0.0');
});

test('sets and remembers the volumes in the parent area', async ({ page }) => {
  // The mixer's buses are the first three gains it makes, in the order music, effects, voice.
  await page.addInitScript(() => {
    const gains: GainNode[] = [];
    Object.assign(window, { gains });
    const create = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function (this: AudioContext) {
      const gain = create.call(this);
      gains.push(gain);
      return gain;
    };
  });
  const effectsGain = () => page.evaluate(() => (window as unknown as { gains: GainNode[] }).gains[1]?.gain.value);
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('canvas.world')).toHaveAttribute('data-ready', 'true');
  await openParentArea(page);
  const effects = page.getByRole('slider', { name: strings.volumes.effects });
  await expect(effects).toHaveValue('1');
  await effects.focus();
  await page.keyboard.press('Home');
  await expect(effects).toHaveValue('0');
  expect(await effectsGain()).toBe(0);

  await page.reload();
  await expect(page.locator('canvas.world')).toHaveAttribute('data-ready', 'true');
  await openParentArea(page);
  await expect(page.getByRole('slider', { name: strings.volumes.effects })).toHaveValue('0');
  await expect(page.getByRole('slider', { name: strings.volumes.music })).toHaveValue('1');
  expect(await effectsGain()).toBe(0);
});

test('resets the park from the parent area, after asking', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await savedPark(page, { version: 1, needsMet: 7, eggsHatched: 1 });
  await page.reload();
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '1');

  await openParentArea(page);
  // Changing your mind keeps the park.
  await page.getByRole('button', { name: strings.reset }).click();
  await page.getByRole('button', { name: strings.resetNo }).click();
  // So does a wrong number, which shuts the parent area too.
  await page.getByRole('button', { name: strings.reset }).click();
  await tapNumber(page, ((await namedNumber(page, '#parent-reset-ask')) % 9) + 1);
  await expect(page.getByRole('heading', { name: strings.parentTitle })).toHaveCount(0);
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '1');
  // ...and starts the cooldown, as a wrong number at the gate does.
  await holdGate(page);
  await expect(page.locator('#parent-ask')).toHaveCount(0);

  // Resetting takes its own named number.
  await page.clock.fastForward(30_000);
  await openParentArea(page);
  await page.getByRole('button', { name: strings.reset }).click();
  await tapNumber(page, await namedNumber(page, '#parent-reset-ask'));

  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-eggs-hatched', '0');
  expect(await savedPark(page)).toEqual({ version: 1, needsMet: 0, eggsHatched: 0 });
});

test('plays the background music once sound starts, and again after the system pauses it', async ({ page }) => {
  // Record what the game asks to play, so the test can tell the music started without hearing it.
  await page.addInitScript(() => {
    const played: HTMLMediaElement[] = [];
    Object.assign(window, { played });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      played.push(this);
      return play.call(this);
    };
  });
  const played = () =>
    page.evaluate(() =>
      (window as unknown as { played: HTMLMediaElement[] }).played.map((element) => ({
        src: element.currentSrc || element.src,
        paused: element.paused,
      })),
    );
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { value, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

  await page.goto('./');
  await expect(page.locator('canvas.world')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Honk' }).click();
  await expect.poll(played).toEqual([{ src: expect.stringContaining('/audio/music/park.mp3'), paused: false }]);

  // iPadOS or Android's media notification can pause it from outside; coming back to the game starts it again.
  await page.evaluate(() => (window as unknown as { played: HTMLMediaElement[] }).played[0]?.pause());
  await setHidden(true);
  await setHidden(false);
  await expect.poll(async () => (await played()).map((element) => element.paused)).toEqual([false, false]);
});

test('fades the music in even when its first play is refused', async ({ page }) => {
  // Refuse the first play, as a browser does before a gesture, and keep the music's own gain: the one its
  // media-element source connects to.
  await page.addInitScript(() => {
    const music: { level?: GainNode } = {};
    Object.assign(window, { music });
    const play = HTMLMediaElement.prototype.play;
    let refused = false;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!refused) {
        refused = true;
        return Promise.reject(new DOMException('Refused by the test', 'NotAllowedError'));
      }
      return play.call(this);
    };
    const createSource = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (this: AudioContext, element: HTMLMediaElement) {
      const source = createSource.call(this, element);
      const connect = source.connect.bind(source) as (destination: AudioNode) => AudioNode;
      source.connect = ((destination: AudioNode) => {
        music.level = destination as GainNode;
        return connect(destination);
      }) as typeof source.connect;
      return source;
    };
  });

  // The music's level after a fifth of a second of audio time, long enough for a started fade to be heard.
  const levelSoon = () =>
    page.evaluate(async () => {
      const { level } = (window as unknown as { music: { level?: GainNode } }).music;
      if (!level) {
        throw new Error('The music has no gain');
      }
      const until = level.context.currentTime + 0.2;
      while (level.context.currentTime < until) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return level.gain.value;
    });
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { value, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

  await page.goto('./');
  await expect(page.locator('canvas.world')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Honk' }).click();
  expect(await levelSoon()).toBe(0);

  // The retry when sound next starts plays it, and only then does it fade in.
  await setHidden(true);
  await setHidden(false);
  await expect.poll(levelSoon).toBeGreaterThan(0);
  expect(await levelSoon()).toBeLessThan(0.35);
});

test('Rosie walks a new player through their first delivery', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas has no size');
  }
  const tap = (x: number, y: number) => canvas.click({ position: { x: box.width * x, y: box.height * y } });

  // The first tap lets sound start, and Rosie says hello; then Steggy gets bored, and an arrow shows the toy shed.
  await page.getByRole('button', { name: 'Honk' }).click();
  await playFor(page, 4000);
  await expect(canvas).toHaveAttribute('data-needs', 'stegosaurus:bored');
  await expect(canvas).toHaveAttribute('data-rosie', 'rosie.tutorial.need');
  await expect(canvas).toHaveAttribute('data-pointer', 'station');

  // The toy shed is just up and to the left of where the jeep starts.
  await tap(0.36, 0.42);
  await playFor(page, 6000);
  await expect(canvas).toHaveAttribute('data-cargo', 'toys');
  await expect(canvas).toHaveAttribute('data-rosie', 'rosie.tutorial.load');
  await expect(canvas).toHaveAttribute('data-pointer', 'pen');

  // Steggy's gate is along the road to the jeep's left.
  await tap(0.31, 0.53);
  await playFor(page, 5000);
  await expect(canvas).toHaveAttribute('data-rosie', 'rosie.tutorial.done');
  await expect(canvas).toHaveAttribute('data-pointer', '');
});

test('Rosie holds what she has to say until sound starts', async ({ page }) => {
  // A tablet keeps sound silent until the first tap, which headless browsers don't. Report it suspended until the
  // game resumes it, rather than suspending it for real: WebKit never finishes that, and goes to "interrupted".
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    const resumed = new WeakSet<AudioContext>();
    window.AudioContext = class extends Original {
      override get state(): AudioContextState {
        return resumed.has(this) ? super.state : 'suspended';
      }
      override resume(): Promise<void> {
        resumed.add(this);
        return super.resume();
      }
    };
  });
  await page.clock.install();
  await page.goto('./');
  const canvas = page.locator('canvas.world');
  await expect(canvas).toHaveAttribute('data-ready', 'true');

  // Steggy gets bored before the child's first tap, while the browser still keeps sound silent.
  await playFor(page, 4000);
  await expect(canvas).toHaveAttribute('data-needs', 'stegosaurus:bored');
  await expect(canvas).not.toHaveAttribute('data-rosie');

  // Once it starts, Rosie says hello, and then what she held back.
  await page.getByRole('button', { name: 'Honk' }).click();
  await playFor(page, 200);
  await expect(canvas).toHaveAttribute('data-rosie', 'rosie.tutorial.need');
});
