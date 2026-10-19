# CLAUDE.md

A 3D browser game (TypeScript + three.js PWA on GitHub Pages) for 3–6 year olds: drive a jeep around
a dinosaur park and look after the dinosaurs. Read [`docs/design.md`](docs/design.md) before changing
behaviour: it records the decisions already made (no backend, no text in gameplay, tap-to-go driving,
needs and eggs, Ranger Rosie, CC0 assets, plain three.js…) and the milestone plan. Update it in the
same PR when a decision changes.

## Pull requests

- **`master` is the default branch.** Branch from `origin/master` and open a PR; don't push to
  `master`.
- **Open PRs ready for review, not as drafts.** `claude.yaml` reviews every non-draft PR on each
  push; a draft gets no review.
- **Keep PRs small enough to review in full** — roughly under 1,500 changed lines (excluding
  `pnpm-lock.yaml`) and one concern each. Split big work into a stack of PRs, each based on the one
  before; when a lower one is squash-merged, rebase the rest onto `master`.
- **Show UI and UX changes in the PR description.** Anything that changes what a player or parent
  sees or hears needs a capture: a screenshot for a static change, an animated GIF for motion
  (`ffmpeg -i in.webm out.gif`, with the `.webm` linked), a link to the sound for audio, and before
  and after when it changes existing UI. Capture from `pnpm build && pnpm preview` with a throwaway
  Playwright script (`page.screenshot()`, `recordVideo`) at 1180×820, adding a phone viewport when
  the layout differs. Push the files to `<pr-number>/` on the orphan `pr-media` branch
  (`git switch --orphan pr-media` if it doesn't exist) and embed them by `raw.githubusercontent.com`
  URL. If no capture would show the change, say why instead.
- **A PR is not done when it is opened.** Watch it: fix failing checks, and address each review
  finding or reply with why not, then resolve the thread.
- **Enable squash auto-merge on every PR** right after opening it (`gh pr merge --auto --squash`).

## Code layout

- **`src/core`** — plain TypeScript game logic: needs, eggs and unlocks, road graph and
  pathfinding, jeep movement, saved-park schema and migrations. No DOM, three.js or React (enforced
  by ESLint). It must have Vitest coverage.
- **`src/render`** — three.js: scene, camera, models, effects. Reads `core` state each frame.
- **`src/audio`** — Web Audio mixer and voice lines.
- **`src/storage`** — the saved park in IndexedDB. What's saved, and how old saves migrate, is
  `core/save.ts`.
- **`src/ui`** — React overlays (HUD, menus, parent area). Keep it thin and out of the render loop.
- Gameplay has **no text**; the little text there is lives in string files, in **Australian
  English**.
- No analytics, ads, purchases, external links or third-party scripts, and no network calls other
  than to the game's own site: the game collects nothing.
- Every third-party asset is CC0 or similarly licensed and recorded in `CREDITS.md`.

## Before pushing

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm build && pnpm budget
pnpm test:e2e     # Chromium + WebKit; set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium,
                  # and PLAYWRIGHT_PORT if another checkout's preview already holds port 4173
```
