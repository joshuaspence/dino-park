// Renders public/icon.svg into the PNG icons that home screens need, with Playwright's Chromium.
//
// Usage: pnpm exec tsx scripts/render-icons.ts
//
// iOS ignores SVG home-screen icons, and Android launchers crop a "maskable" icon to their own shape, so the SVG
// alone isn't enough to install well. Re-run this after changing the SVG.
import { readFileSync } from 'node:fs';

import { chromium } from '@playwright/test';

const svg = readFileSync('public/icon.svg', 'utf8');
const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
// The icon's own sky blue, for the maskable icon's full-bleed background.
const BACKGROUND = '#9fd8f5';

const icons = [
  { file: 'public/apple-touch-icon.png', size: 180, maskable: false },
  { file: 'public/icon-192.png', size: 192, maskable: false },
  { file: 'public/icon-512.png', size: 512, maskable: false },
  // A launcher may crop anything outside the central 80% circle, so the artwork shrinks into it.
  { file: 'public/icon-maskable-512.png', size: 512, maskable: true },
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
try {
  for (const { file, size, maskable } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const scale = maskable ? 0.8 : 1;
    await page.setContent(`
      <body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;
                   background:${maskable ? BACKGROUND : 'transparent'}">
        <img src="${source}" width="${size * scale}" height="${size * scale}">
      </body>`);
    await page.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    await page.screenshot({ path: file, omitBackground: !maskable });
    await page.close();
    console.log(`${file} (${size}×${size}${maskable ? ', maskable' : ''})`);
  }
} finally {
  await browser.close();
}
