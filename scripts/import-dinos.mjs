// Converts Quaternius's CC0 "Animated Dinosaur Pack" (Dec 2018) into the GLBs in public/models/dinos.
//
// Usage: FBX2GLTF=<path to FBX2glTF binary> node scripts/import-dinos.mjs "<path to 'Dinosaur Animated Pack - Dec 2018'>"
//
// Get the pack from https://quaternius.itch.io/animated-lowpoly-dinosaurs (or the Google Drive link on
// https://quaternius.com/packs/animateddinosaurs.html). FBX2glTF ships in the `fbx2gltf` npm package
// (`npm install fbx2gltf@0.9.7-p1` somewhere temporary, then use node_modules/fbx2gltf/bin/<OS>/FBX2glTF).
// Attack and Death clips are dropped (nothing bites or dies in Dino Park) and the rest are renamed to
// idle/walk/run/jump. Colours are left as they are: src/render/dinoSkin.ts recolours materials by name.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

// Pack file name → model ID used by the game.
const MODELS = {
  Apatosaurus: 'apatosaurus',
  Parasaurolophus: 'parasaurolophus',
  Stegosaurus: 'stegosaurus',
  Trex: 'trex',
  Triceratops: 'triceratops',
  Velociraptor: 'velociraptor',
};
const KEPT_CLIPS = ['idle', 'walk', 'run', 'jump'];

const pack = process.argv[2];
const fbx2gltf = process.env.FBX2GLTF;
if (!pack || !fbx2gltf) {
  console.error('Usage: FBX2GLTF=<binary> node scripts/import-dinos.mjs <pack directory>');
  process.exit(1);
}

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});
const work = mkdtempSync(join(tmpdir(), 'dinos-'));

try {
  for (const [source, id] of Object.entries(MODELS)) {
    const converted = join(work, id);
    execFileSync(fbx2gltf, ['--binary', '--input', join(pack, 'FBX', `${source}.fbx`), '--output', converted]);

    const document = await io.read(`${converted}.glb`);
    for (const animation of document.getRoot().listAnimations()) {
      // "Armature|TRex_Walk" → "walk"
      const clip = animation.getName().split('_').pop().toLowerCase();
      if (KEPT_CLIPS.includes(clip)) {
        animation.setName(clip);
      } else {
        animation.dispose();
      }
    }
    await document.transform(resample(), dedup(), prune());
    document
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

    const output = join('public', 'models', 'dinos', `${id}.glb`);
    await io.write(output, document);
    console.log(`Wrote ${output}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
