# Credits

Every third-party asset in Dino Park, where it came from and its licence.

## Models

| Files                       | Source                                                                                                                                                             | Author                               | Licence                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------- |
| `public/models/dinos/*.glb` | [Animated Dinosaur Pack](https://quaternius.com/packs/animateddinosaurs.html) (Dec 2018), also on [itch.io](https://quaternius.itch.io/animated-lowpoly-dinosaurs) | [Quaternius](https://quaternius.com) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

The pack's FBX files were converted with `scripts/import-dinos.mjs`, which drops the Attack and Death
animations and compresses the meshes. The game recolours the models at load time.

| File                  | Used as                |
| --------------------- | ---------------------- |
| `triceratops.glb`     | Trixie the Triceratops |
| `apatosaurus.glb`     | Bruno the Brontosaurus |
| `stegosaurus.glb`     | Steggy the Stegosaurus |
| `trex.glb`            | Rex the T. rex         |
| `velociraptor.glb`    | the Raptors            |
| `parasaurolophus.glb` | Ranger Rosie           |

## Sounds

Every other sound in the game is synthesised in code (`src/audio/effects.ts`). The recorded ones are fetched by
`scripts/import-sounds.mjs`; the dinosaurs' calls are [Freesound](https://freesound.org)'s public HQ MP3 previews.

| File                                  | Used as              | Source                                                                            | Author                                                 | Licence                                                       |
| ------------------------------------- | -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `public/audio/dinos/trex.mp3`         | Rex's call           | [Dinosaur 2.wav](https://freesound.org/people/JarredGibb/sounds/233277/)          | [JarredGibb](https://freesound.org/people/JarredGibb/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `public/audio/dinos/stegosaurus.mp3`  | Steggy's call        | [Dinosaur 4.wav](https://freesound.org/people/JarredGibb/sounds/233279/)          | [JarredGibb](https://freesound.org/people/JarredGibb/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `public/audio/dinos/brontosaurus.mp3` | Bruno's call         | [Elephant Trumpets Growls](https://freesound.org/people/D.jones/sounds/527845/)   | [D.jones](https://freesound.org/people/D.jones/)       | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `public/audio/dinos/triceratops.mp3`  | Trixie's call        | [Pig - Multiple Snorts 2](https://freesound.org/people/JarredGibb/sounds/233183/) | [JarredGibb](https://freesound.org/people/JarredGibb/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `public/audio/dinos/velociraptor.mp3` | the Raptors' call    | [Penguin Squeak](https://freesound.org/people/Breviceps/sounds/705839/)           | [Breviceps](https://freesound.org/people/Breviceps/)   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `public/audio/music/park.mp3`         | the background music | [Once Upon a Time (loop)](https://opengameart.org/content/once-upon-a-time-loop)  | [TAD](https://opengameart.org/users/tad)               | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
