# Dino Park

A 3D browser game for 3–6 year olds: drive a jeep around a dinosaur park, notice what each dinosaur
needs and help look after it. It is a TypeScript web app (an installable PWA) hosted on GitHub Pages,
with no accounts, no backend and no analytics.

Work in progress: see [`docs/design.md`](docs/design.md) for the design and milestone plan.

## Development

Needs Node 22 and pnpm.

```sh
pnpm install
pnpm dev          # http://localhost:5173/dino-park/
pnpm test         # unit tests
pnpm test:e2e     # Playwright
```

## Licence

[MIT](LICENSE)
