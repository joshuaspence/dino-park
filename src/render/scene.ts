import * as THREE from 'three';

import { LAUNCH_SPECIES, ROSIE_MODEL, SPECIES } from '../core/species';
import { type DinoInstance, loadDinoSkin } from './dinoSkin';

export interface SceneHandle {
  dispose(): void;
}

/** True when this browser can create a WebGL2 context, which Dino Park requires. */
export function supportsWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/** Seconds between one dinosaur's happy hop and the next one's. */
const HOP_INTERVAL = 1.5;

/**
 * Starts the showcase scene: the launch dinosaurs in an arc taking turns to hop, with Ranger Rosie in
 * front. Temporary until the park map lands later in M1.
 */
export function startScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8f5);
  scene.fog = new THREE.Fog(0x9fd8f5, 25, 50);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 4, 10);
  camera.lookAt(0, 1.5, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a8f3c, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(20, 48),
    new THREE.MeshStandardMaterial({ color: 0x8fd16a, flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const dinos: DinoInstance[] = [];
  let disposed = false;

  async function populate(): Promise<void> {
    const residents = LAUNCH_SPECIES.map((id) => SPECIES[id].model).filter((model) => model !== null);
    const skins = await Promise.all(
      [...residents, ROSIE_MODEL].map(async (model) => ({ model, skin: await loadDinoSkin(model) })),
    );
    if (disposed) {
      return;
    }
    skins.forEach(({ model, skin }, index) => {
      const dino = skin.create();
      if (model === ROSIE_MODEL) {
        dino.object.position.set(0, 0, 3);
      } else {
        // Spread the residents along an arc behind Rosie, facing the camera.
        const angle = ((index - (residents.length - 1) / 2) / residents.length) * Math.PI * 0.9;
        dino.object.position.set(Math.sin(angle) * 5.5, 0, -Math.cos(angle) * 2.5);
      }
      // Face the camera, then turn a little so each silhouette shows side-on enough to recognise.
      dino.object.lookAt(camera.position.x, 0, camera.position.z);
      dino.object.rotateY(dino.object.position.x <= 0 ? 0.7 : -0.7);
      scene.add(dino.object);
      dinos.push(dino);
    });
    canvas.dataset.ready = 'true';
  }
  void populate();

  function resize(): void {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const timer = new THREE.Timer();
  timer.connect(document);
  let sinceHop = 0;
  let nextHopper = 0;
  renderer.setAnimationLoop(() => {
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.1);
    sinceHop += delta;
    if (dinos.length > 0 && sinceHop >= HOP_INTERVAL) {
      sinceHop = 0;
      dinos[nextHopper % dinos.length]?.play('jump');
      nextHopper++;
    }
    for (const dino of dinos) {
      dino.update(delta);
    }
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      timer.dispose();
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            material.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}
