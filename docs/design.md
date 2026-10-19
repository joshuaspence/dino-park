# Dino Park: design

A 3D browser game for 3–6 year olds. The child drives a jeep around a dinosaur park (like a zoo),
notices what each dinosaur needs — food, water, a bath, play, the vet — fetches it from the right
station and delivers it. Helping dinosaurs earns eggs, and eggs hatch new dinosaurs that open new
parts of the park.

This document records the decisions made during the initial design interview. Each section gives
the decision and the main reason for it. When the design changes, update this file in the same PR.

---

## 1. Platform

| Decision           | Detail                                                                                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form               | A **TypeScript web app** rendering **3D with three.js**, installable as a **PWA** and playable offline once loaded.                                                                                                                                                                                                           |
| Hosting            | **GitHub Pages** at `https://joshuaspence.github.io/dino-park/` (Vite `base: '/dino-park/'`, PWA scope to match).                                                                                                                                                                                                             |
| Why not native iOS | It can't be built or tested without Xcode on a Mac, needs a paid Apple developer account, App Store and Kids Category review, and leaves out Android tablets and laptops. A PWA added to the home screen runs full screen and offline. If an App Store listing is wanted later, the same build can be wrapped with Capacitor. |
| Why not Unity      | Heavy WebGL builds load slowly on cheap tablets, and Unity code can't be compiled outside CI.                                                                                                                                                                                                                                 |
| Custom domain      | Not now. Progress lives in browser storage tied to the origin, so **moving the domain after launch loses every child's park**. Decide before real children use it.                                                                                                                                                            |

## 2. Players, accounts and data

- **Single-player. No accounts, no backend, no analytics, no ads, no purchases, no external links,
  no third-party scripts.** For under-13s (COPPA, GDPR-K) the simplest compliance is collecting
  nothing.
- Progress **autosaves constantly** to **IndexedDB**; the app calls `navigator.storage.persist()`.
- Saved data carries a **schema version**; migrations live in `core/` and are unit-tested so an
  update never wipes a park. A save from a newer version is left untouched rather than
  overwritten, and anything unreadable starts a fresh park instead of an error.
- **Only progress is saved**: needs met and eggs hatched, written after every delivery and hatch.
  Waiting needs and the jeep's load start afresh, since needs only advance while the game is open.
  The parent area's volumes are saved separately, so resetting the park keeps them.
- **M1:** one implicit profile. **M3:** sibling profiles chosen by picture (no names to type).

## 3. Core loop

**Notice a need → fetch the right thing → deliver it → a happy dinosaur. No failure, no timer, no
score.**

- The child drives freely around one park. Each pen holds a dinosaur.
- Every so often a dinosaur shows a **need bubble** with a single picture:

  | Need                 | Bubble     | Station                 |
  | -------------------- | ---------- | ----------------------- |
  | Hungry (plant-eater) | leaf       | haystack / leaf bundles |
  | Hungry (meat-eater)  | meat       | butcher hut             |
  | Hungry (Pterodactyl) | fish       | fish pond               |
  | Thirsty              | water drop | water tower             |
  | Dirty                | mud splat  | bath (hose truck)       |
  | Bored                | ball       | toy shed                |
  | Poorly               | bandage    | vet tent                |

- Driving to a station **loads the item automatically** and it shows on the back of the jeep.
  Driving back to the pen **delivers it automatically**, and the dinosaur plays a joyful animation
  and sound (munching, splashing, a happy roar, a dance).
- **A dinosaur has one need at a time, and at most two dinosaurs want something at once**, so a small
  child never faces a screen of bubbles. The first need comes a few seconds into play; after that a
  new one appears about every 25 seconds, never to a dinosaur that is still celebrating. While two
  are waiting the count pauses, so meeting a need brings 25 calm seconds rather than a new demand.
- **The jeep carries one thing at a time**: stopping at another station swaps it. It loads only when
  it **stops** at a station, so the drive back can pass another station without swapping the load.
  It delivers whenever it reaches the right pen, stopped or not, and a wrong item stays on the
  jeep without fuss. Each station and pen gate has a road stop of its own: the nearest place to the
  jeep is the one it's visiting.
- Needs grow slowly and **never hurt the dinosaur**: an unmet need is a sad face and a bigger
  bubble. Nothing dies, gets ill from neglect or leaves.
- Needs only advance **while the game is open**. There is no real-time clock: dinosaurs never go
  hungry while the app is closed, and nothing nags the child to come back.
- Each need met earns progress towards an **egg**.
- Out of scope for M1: hand-feeding or brushing mini-games (see M3).

## 4. Driving, controls and camera

Most under-5s can't steer with a virtual joystick, so the jeep drives itself.

- **Tap to go:** tap a pen, a station or any point on a road; the jeep pathfinds along the **road
  graph** and drives there, showing a dotted trail. Tapping elsewhere changes the destination.
- **Hold to drive:** keep a finger down and the jeep follows it along the nearest road, for older
  children who want to feel they are driving.
- **The jeep can't crash, fall off or get stuck.** Roads have soft edges and anything in the way
  moves aside.
- **Honk button:** big and always available; the nearest dinosaur turns to look.
- **Keyboard and gamepad** as an extra, never required. Arrows/WASD or the left stick/d-pad steer by
  compass direction on screen, which the fixed camera keeps steady: the jeep drives along the roads
  towards a point a little ahead that way, like a held finger. Space/H or the A button honks.
- **Automatic follow camera:** third-person, above and behind the jeep, pulling back slightly while
  driving and zooming in on the dinosaur during a delivery, and on the nest when an egg hatches,
  for a couple of seconds. The child never controls the camera. It keeps **one compass direction**
  rather than swinging round behind the jeep at every turn, so a spot the child is about to tap
  never slides away under their finger.

## 5. The park and its dinosaurs

- **One hand-built park**, not procedural: a loop road with branches, about 2 minutes end to end,
  so any pen-to-station trip is 10–20 seconds.
- **Launch roster (four):** Triceratops, Brontosaurus (eats from trees: a tall leaf bundle),
  Stegosaurus, and a friendly T. rex (meat). The long-neck was originally a Brachiosaurus; it became a
  Brontosaurus because the CC0 pack's sauropod is an Apatosaurus/Brontosaurus shape, and it's the
  name children know.
- Dinosaurs have short, easy names that are only ever spoken: **Trixie** the Triceratops, **Bruno**
  the Brontosaurus, **Steggy** the Stegosaurus, **Rex** the T. rex.
- **Unlocks, in order, by hatching eggs:**
  1. **Velociraptor** — a small pack of three in one pen that hop and chirp in a circle; eats meat.
  2. **Pterodactyl** — an aviary (tall net dome) and a new fish-pond station. (A flying reptile,
     not strictly a dinosaur; the game uses the name children know.)
  3. Ankylosaurus, then further dinosaurs (an underwater swimmer in a lagoon, and others).
  4. Once everything is unlocked, eggs hatch **baby dinosaurs** that toddle after their parent.
- Each unlock opens a **gate** to a new area of the map with its pen. The road beyond the gate and
  the empty pen are in view from the start, so there is something to look forward to; the jeep
  can't drive past a closed gate, and a dinosaur that hasn't hatched never wants anything. When the
  egg hatches, the gate swings open and the hatchlings celebrate by the nest, then run along the
  roads and through the gate into their pen, showing the child where the new area is. The
  Velociraptors' area is east of the loop, beyond the bath.
- **No currency and no shop.** The only progress is eggs → dinosaurs → new areas.
- **Pacing:** about one egg per five needs met (roughly 5 minutes of play). The egg sits in a nest
  by the visitor centre, wobbles, and hatches with a big celebration. All launch-era unlocks take
  about an hour of play spread over days. There is **no end state**.
- **The egg shows its progress.** It sits in the nest from the start and grows with each need met;
  once full it wobbles, and **driving to the nest hatches it**, so the child makes the big moment
  happen rather than it happening somewhere off-screen. Needs met while a full egg waits count
  towards the next one. The nest is a place like a station, with its own road stop beside the
  junction at the middle of the park.
- Later, purely cosmetic: day/night and weather.

## 6. Ranger Rosie, voice and sound

**No reading is ever required.**

- Gameplay has **no text**: needs, stations and buttons are pictures. The little text that exists
  (parent area, settings) lives in string files, in **Australian English**.
- **Ranger Rosie** is the mascot: a cheerful **Parasaurolophus** in a ranger hat who rides in the
  passenger seat. Her crest makes her silhouette unmistakable, and she honks through it. She speaks
  short lines ("Trixie is hungry! Let's get some hay!"), runs the guided tour ("Tap the toy
  shed!"), points at needs and cheers deliveries. She never takes control or blocks a tap.
  (Because Rosie is a Parasaurolophus, it is not in the unlock list.)
- The **child is the driver**: a small helmeted figure in the jeep. Choosing the jeep colour is the
  only customisation (M3).
- **Voice lines** are keyed by ID (`rosie.need.triceratops.hungry` → audio file). M1 uses
  **text-to-speech clips generated once at build time and committed**, so every device sounds the
  same; recorded voices can replace them later through the same mapping. The lines are built in
  `core/rosie.ts` from the dinosaurs' names, so a new species gets its lines without new text, and
  `scripts/generate-rosie.ts` records them with **Piper**, in **Cori**, a British English voice
  (`en_GB-cori-high`, trained on public-domain LibriVox recordings): Piper has no Australian voice,
  and of the public-domain and CC0 ones, a British woman sounds closest. The game finds the
  recordings at build time and stays silent for any line without one.
- **The guided tour** walks a new player through one full round, and lasts until the first need is
  met. Rosie says what to do one step at a time, a bobbing arrow points at what to tap, and the
  camera shows each place while she names it:
  1. "This is our jeep. Tap the road by the arrow, and we'll drive there!" The arrow is up the
     middle road, and nobody wants anything until the child has driven.
  2. Only **Steggy** wants anything, and she's bored. The camera shows her bubble ("Look! See the
     bubble over Steggy? Steggy is bored!"), then the toy shed, with the arrow over it ("Let's get
     a toy from the toy shed. Tap the toy shed!"). The wrong station gets "Oops, not that one!"
     and the toy shed again.
  3. "Got a toy! See it on the jeep? Now tap Steggy's pen!", showing her pen, with the arrow over
     her gate.
  4. "Hooray! You helped Steggy!", then, showing the nest, what the egg is for.

  Tapping the arrow itself counts as tapping what it points at: it floats well above the ground,
  so the ground under it is somewhere else, and that is where children tap. Her pen and the toy
  shed are both near the start, so nothing the tour asks for is far away.

- **Each dinosaur has its own voice** (roar, chirp, honk) for wanting something, being helped and
  sleeping, so children can hear who needs help.
- **Gentle looping background music**, plus sound effects. Most effects (honk, engine, chimes,
  splashes) are synthesised with the Web Audio API; roars are recorded audio files. The music is
  "Once Upon a Time (loop)" by TAD (CC0, OpenGameArt), streamed rather than decoded whole, since a
  decoded two-minute track would hold about 40 MB on a budget tablet.
- Three audio buses — **music, effects, voice** — each with its own volume. Silent until the first
  tap (browser autoplay rules).

## 7. Parent area

Behind a **grown-up gate** (hold for 3 seconds, then tap a named number):

- volume sliders for music, effects and voice;
- an optional **bedtime timer**, off by default or 10, 20 or 30 minutes. It counts only time the
  game is on screen and starts again each time the game opens. When it runs out, Rosie yawns and
  says goodnight, the park fades to dusk, the music fades out, the dinosaurs settle, and taps, the
  horn and new needs all stop. **Only a grown-up can wake the park**, here: being asleep is kept
  with the settings, so neither a reload nor a park reset wakes it. Waking it brightens the park,
  brings the music back, has Rosie say good morning and starts the timer again;
- reset the park, after a second named number;
- version (`package.json`) and short git SHA.

The gate is a small, faded lock in the top-left corner, out of a child's way, with a ring that fills
during the hold. The number is named in words ("tap the number seven") over a shuffled grid of
digits, so passing it takes reading; each opening asks afresh. A wrong tap closes it and makes
the lock ignore holds for 30 seconds, so guessing takes minutes rather than seconds, and resetting
the park, the one thing here that can't be undone, asks a named number of its own.

## 8. Art and assets

- **Low-poly, flat-coloured, toy-like 3D**, bright and high-contrast.
- **CC0 asset packs first:** Quaternius (rigged, animated low-poly dinosaurs) and Kenney (vehicles,
  nature, buildings, fences). Materials are recoloured to the game's palette in code and attack
  animations are never used — the T. rex stomps happily, it never bites.
- **Simple props are built procedurally** from three.js primitives: pens, haystacks, the water
  tower, need bubbles, terrain. Anything that can be code, is.
- Any dinosaur missing from the packs: another CC0 model if one exists, otherwise a stylised
  procedural model (capsules for body, neck and legs, with simple bone animation).
- **glTF/GLB**, compressed with Draco or Meshopt, KTX2 textures where they help. Files live in
  `public/models/`, and `CREDITS.md` records each file's source and licence.
- Models are loaded behind a **`DinoSkin`** interface so commissioned or Blender-made models can
  replace the packs without code changes.
- **Asset audit (M1).** Quaternius's
  [Animated Dinosaur Pack](https://quaternius.com/packs/animateddinosaurs.html) covers Triceratops,
  Apatosaurus (used for the Brontosaurus), Stegosaurus, T. rex, Velociraptor and Parasaurolophus
  (Rosie), each with Idle, Walk, Run, Jump, Attack and Death clips. `scripts/import-dinos.mjs`
  converts it, keeps only idle/walk/run/jump — **jump is the happy hop** — and Meshopt-compresses it
  (about 1.2 MB for all six). The models share one unit, so one scale keeps their relative sizes;
  Rosie is scaled up because the pack's Parasaurolophus is small. Dinosaurs are **larger than
  life** next to the jeep (a T. rex is about 7.7 m long) because big, readable animals matter more
  to small children than true scale. Recolours are keyed by the pack's
  material names. **Pterodactyl and Ankylosaurus have no model yet**: find one before M2, otherwise
  build them procedurally. Until then their eggs, like any egg after everything has hatched, bring
  out a half-size baby of a launch dinosaur, so an egg is never empty.

## 9. Tech stack

| Layer              | Choice                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language           | TypeScript, `strict`                                                                                                                                                                                                                                                            |
| Build              | Vite, `build.target: 'es2022'`; `vite-plugin-pwa` for the service worker                                                                                                                                                                                                        |
| 3D                 | **Plain three.js, used imperatively.** A per-frame render loop reads `core/` state and updates the scene. Not react-three-fiber: driving dozens of animated objects through React re-renders costs frame time on cheap tablets, and the simulation already lives outside React. |
| UI overlays        | **React 19** for the HUD, menus, parent area and loading screen, layered over the canvas                                                                                                                                                                                        |
| Game logic         | `src/core/`: plain TS — needs simulation, eggs and unlocks, road graph and pathfinding, jeep kinematics, save schema and migrations                                                                                                                                             |
| Physics            | **None.** The jeep follows the road graph kinematically; dinosaurs wander within pen bounds.                                                                                                                                                                                    |
| Animation          | three.js `AnimationMixer` for glTF clips, plus procedural tweens (bounce, wobble, squash)                                                                                                                                                                                       |
| Audio              | Web Audio API with music/effects/voice buses; clips in MP3, which every target browser decodes, including iPadOS Safari that can't decode Ogg                                                                                                                                   |
| Unit tests         | Vitest                                                                                                                                                                                                                                                                          |
| End-to-end tests   | Playwright, Chromium and WebKit, at a landscape tablet viewport                                                                                                                                                                                                                 |
| Lint/format        | ESLint (typescript-eslint) + Prettier; a lint rule bans `core/` from importing `three`, React, `render/`, `ui/` or `audio/`                                                                                                                                                     |
| Package manager    | pnpm, Node version pinned in `.nvmrc`                                                                                                                                                                                                                                           |
| Deploy             | `actions/deploy-pages` on push to `master`                                                                                                                                                                                                                                      |
| PR previews        | The built site uploaded as a workflow artifact                                                                                                                                                                                                                                  |
| Dependency updates | Dependabot (npm and GitHub Actions, weekly, minor/patch grouped)                                                                                                                                                                                                                |

Layout:

```
src/core/     plain TS: needs, eggs, roads, pathfinding, jeep, save (no DOM, no three.js, no React)
src/render/   three.js: scene, camera, models, effects
src/audio/    mixer, voice lines
src/storage/  the saved park in IndexedDB
src/ui/       React overlays
public/       models, audio, icons
tests/e2e/    Playwright
```

## 10. Devices, browsers and performance

- **Primary:** tablets in **landscape** (iPad and Android). **Secondary:** phones in landscape,
  and laptops/desktops with mouse or keyboard. Portrait shows Rosie tilting her head: "turn me
  sideways".
- **Browsers:** the last two versions of Chrome, Edge, Firefox and Safari, and **iPadOS Safari
  16.4+**. **WebGL2 is required**; without it, a friendly "this device can't run Dino Park" picture.
- **Not supported:** Amazon Fire tablets (Silk).
- **Low-end baseline:** an **iPad 9th gen** and a budget Android tablet (e.g. **Galaxy Tab A7
  Lite**): a steady **30 fps** minimum there, aiming for 60 on mid-range devices. Automatic quality
  steps adjust render resolution, shadows and scenery draw distance.
- **Budgets:** under **2 MB gzipped JS** before "play" is tappable; under **~15 MB total** first
  download including models and audio, cached offline afterwards. A loading screen shows Rosie
  driving across a progress bar.
- **Enforced in CI** by bundle and asset size budgets and a headless frame-time smoke test, plus a
  manual check on a real budget tablet before each milestone.

## 11. Releases

- **Every merge to `master` deploys** to GitHub Pages. No tagged releases.
- A new service worker waits and applies on the **next launch**; the game never reloads in the
  middle of play.

## 12. Milestones

Each milestone is a stack of small PRs (under ~1,500 changed lines each).

- **M0: Plumbing.** This design doc and `CLAUDE.md`; the Vite/TS/three.js/React scaffold rendering
  a placeholder dinosaur; lint, Vitest, Playwright; CI (lint, typecheck, unit, e2e, build, preview
  artifact, budgets), Pages deploy and Dependabot.
- **M1: One playable park loop.** Asset audit and import (Quaternius/Kenney, `CREDITS.md`); `core/`
  needs simulation, road graph and pathfinding, jeep kinematics, save and migrations; the park map
  with a loop road, four pens and the hay, meat, water, bath, toy and vet stations; tap-to-go,
  hold-to-drive, keyboard and honk; follow camera; the four launch dinosaurs with need bubbles,
  deliveries and happy animations; egg nest and hatching; the Velociraptor unlock and its gated
  area; Ranger Rosie with TTS voice lines and the first-play tutorial; music and effects; parent
  gate with volumes and reset; portrait prompt; installable and offline.
- **M2: More park.** Pterodactyl aviary and fish pond; Ankylosaurus and further unlocks; baby
  dinosaurs; the bedtime timer; automatic quality steps verified on real budget tablets.
- **M3: Polish and family.** Sibling profiles; day/night and weather; jeep colour choice;
  close-up mini-games (brush or wash a dinosaur).
- **Later:** recorded voices replacing TTS, translations, a Capacitor App Store wrapper.
