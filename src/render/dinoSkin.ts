import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** The animation clips every dinosaur model provides (scripts/import-dinos.mjs keeps only these). */
export type DinoClip = 'idle' | 'walk' | 'run' | 'jump';

/** One dinosaur in the scene. */
export interface DinoInstance {
  readonly object: THREE.Object3D;
  /** Cross-fades to `clip`. A clip that plays once (jump) returns to idle when it ends. */
  play(clip: DinoClip): void;
  update(deltaSeconds: number): void;
}

/**
 * Makes dinosaur instances for a model. This is the seam where commissioned or Blender-made models can
 * replace the CC0 pack without the rest of the game changing (docs/design.md §8).
 */
export interface DinoSkin {
  create(): DinoInstance;
}

/**
 * Bright, toy-like recolours for the pack's muted materials, keyed by model then by the pack's material
 * name. A material missing here keeps its original colour.
 */
const PALETTES: Record<string, Record<string, number>> = {
  triceratops: { Purple: 0x4fb3e8, LightBrown: 0xffb347, Brown: 0xfff3d6 },
  apatosaurus: { Brown: 0x7ccf5a, Material: 0xfbe6a2 },
  stegosaurus: { DarkBrown: 0xf7c843, Brown: 0xe8604c, LightBrown: 0xfdf0c2 },
  trex: { Green: 0x3fae5a, LightGreen: 0x8fdc7a, LightYellow: 0xfbe6a2, Red: 0xff8fa3, Black: 0x222222 },
  velociraptor: { Brown: 0xa77de8, LightBrown: 0xe6d6ff, Black: 0x222222 },
  parasaurolophus: { Green: 0x48c0a8, LightGreen: 0xa6ecd9, LightYellow: 0xfbe6a2, Red: 0xff7a59 },
};

/** How long, in seconds, clips take to blend into each other. */
const FADE_SECONDS = 0.25;

/**
 * The pack's models share one unit (roughly decimetres), so a single scale keeps the artist's relative
 * sizes: a T. rex comes out about 3.7 m long and a Triceratops about 2.6 m.
 */
const MODEL_SCALE = 0.12;

/** Per-model adjustments on top of MODEL_SCALE: the pack's Parasaurolophus is too small to be Rosie. */
const SCALE_ADJUSTMENTS: Record<string, number> = { parasaurolophus: 1.8 };

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** Loads a model from public/models/dinos and returns a skin that makes recoloured, animated copies. */
export async function loadDinoSkin(model: string): Promise<DinoSkin> {
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/dinos/${model}.glb`);
  const palette = PALETTES[model] ?? {};

  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    object.castShadow = true;
    const recolour = (original: THREE.Material): THREE.Material => {
      const material = new THREE.MeshStandardMaterial({
        name: original.name,
        color: palette[original.name] ?? (original as THREE.MeshStandardMaterial).color ?? 0xffffff,
        flatShading: true,
        roughness: 0.8,
      });
      original.dispose();
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(recolour) : recolour(object.material);
  });

  const clips = new Map(gltf.animations.map((clip) => [clip.name as DinoClip, clip]));

  return {
    create() {
      const object = cloneSkinned(gltf.scene);
      object.scale.setScalar(MODEL_SCALE * (SCALE_ADJUSTMENTS[model] ?? 1));
      const mixer = new THREE.AnimationMixer(object);
      let current: THREE.AnimationAction | null = null;

      function play(name: DinoClip): void {
        const clip = clips.get(name);
        if (!clip) {
          return;
        }
        const next = mixer.clipAction(clip);
        if (next === current) {
          return;
        }
        const once = name === 'jump';
        next.reset();
        next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = once;
        next.play();
        if (current) {
          next.crossFadeFrom(current, FADE_SECONDS, false);
        }
        current = next;
      }

      mixer.addEventListener('finished', () => play('idle'));
      play('idle');

      return {
        object,
        play,
        update(deltaSeconds) {
          mixer.update(deltaSeconds);
        },
      };
    },
  };
}
