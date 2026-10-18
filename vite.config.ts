import { execSync } from 'node:child_process';

import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import pkg from './package.json' with { type: 'json' };

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base: '/dino-park/',
  // three.js alone is ~500 kB minified; scripts/check-budget.mjs enforces the real budgets.
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha()),
  },
  plugins: [
    react(),
    VitePWA({
      // A new service worker waits and applies on the next launch, never mid-play.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Dino Park',
        short_name: 'Dino Park',
        description: 'Drive around a dinosaur park and look after the dinosaurs.',
        lang: 'en-AU',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#bfe9a8',
        theme_color: '#3f9b4f',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,glb,ogg,m4a}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
