import * as THREE from 'three';

import type { DinoClip, DinoInstance } from './dinoSkin';

/** How long Rosie's happy hop lasts, in seconds, and how high it lifts her. */
const HOP_SECONDS = 0.7;
const HOP_HEIGHT = 0.45;

/**
 * Ranger Rosie, a toy-like park ranger in a wide-brimmed hat, built from primitives like the jeep, facing +z with her
 * feet at the origin. She stands still on `idle` and hops, arms up, on `jump`; she never walks, so the other clips
 * leave her standing.
 */
export function buildRosie(): DinoInstance {
  const flat = (hex: number) => new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.8 });
  const skin = flat(0xe8b48a);
  const hair = flat(0x5a3825);
  const shirt = flat(0xd8b26a);
  const shorts = flat(0x5f7d3b);
  const boots = flat(0x4a3220);
  const hat = flat(0xc9924d);
  const hatBand = flat(0x7a4f22);
  const add = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = true;
    parent.add(part);
    return part;
  };

  const object = new THREE.Group();
  object.name = 'rosie';
  // `object` stays on the jeep, and everything on `body` lifts off it together when she hops.
  const body = new THREE.Group();
  object.add(body);

  for (const x of [-0.13, 0.13]) {
    add(body, new THREE.BoxGeometry(0.17, 0.14, 0.26), boots, x, 0.07, 0.03);
    add(body, new THREE.CylinderGeometry(0.085, 0.085, 0.42, 8), skin, x, 0.35, 0);
  }
  add(body, new THREE.CylinderGeometry(0.22, 0.24, 0.22, 10), shorts, 0, 0.6, 0);
  add(body, new THREE.CylinderGeometry(0.2, 0.23, 0.48, 10), shirt, 0, 0.94, 0);
  // A gold badge on her shirt, and a pocket opposite it.
  add(body, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 6).rotateX(Math.PI / 2), flat(0xf7c843), 0.09, 1.03, 0.205);
  add(body, new THREE.BoxGeometry(0.1, 0.08, 0.02), flat(0xc49a50), -0.09, 1.01, 0.205);

  // Arms hang from the shoulders, so turning a shoulder swings the whole arm.
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.26, 1.13, 0);
    body.add(shoulder);
    add(shoulder, new THREE.SphereGeometry(0.08, 8, 6), shirt, 0, 0, 0);
    add(shoulder, new THREE.CylinderGeometry(0.065, 0.06, 0.4, 8), skin, 0, -0.22, 0);
    add(shoulder, new THREE.SphereGeometry(0.075, 8, 6), skin, 0, -0.44, 0);
    return { shoulder, side };
  });

  // A big head, like a toy's, so her face reads from the camera behind the jeep.
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0);
  body.add(head);
  add(head, new THREE.SphereGeometry(0.26, 14, 10), skin, 0, 0, 0);
  add(head, new THREE.SphereGeometry(0.275, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.02, -0.03);
  // A ponytail out the back, under the hat.
  add(head, new THREE.SphereGeometry(0.11, 8, 6), hair, 0, -0.06, -0.3).scale.set(1, 1.5, 1);
  for (const x of [-0.09, 0.09]) {
    add(head, new THREE.SphereGeometry(0.035, 8, 6), flat(0x222222), x, 0.02, 0.235);
    add(head, new THREE.SphereGeometry(0.04, 8, 6), flat(0xf0907a), x * 1.6, -0.07, 0.2).scale.set(1, 0.6, 0.5);
  }
  add(head, new THREE.TorusGeometry(0.06, 0.014, 4, 10, Math.PI), flat(0x8a3b2b), 0, -0.08, 0.245).rotation.z = Math.PI;
  // Her ranger hat: a wide brim, a crown and a band.
  add(head, new THREE.CylinderGeometry(0.44, 0.44, 0.04, 16), hat, 0, 0.2, 0);
  add(head, new THREE.CylinderGeometry(0.19, 0.24, 0.22, 12), hat, 0, 0.32, 0);
  add(head, new THREE.CylinderGeometry(0.245, 0.245, 0.06, 12), hatBand, 0, 0.25, 0);

  let time = 0;
  /** Seconds into the current hop, or null while she stands. */
  let hop: number | null = null;

  return {
    object,
    play(clip: DinoClip) {
      if (clip === 'jump') {
        hop = 0;
      }
    },
    update(deltaSeconds) {
      time += deltaSeconds;
      if (hop !== null) {
        hop += deltaSeconds;
        if (hop >= HOP_SECONDS) {
          hop = null;
        }
      }
      const progress = hop === null ? 0 : hop / HOP_SECONDS;
      // Up and down in one arc, with her arms thrown up for the length of it.
      body.position.y = 4 * progress * (1 - progress) * HOP_HEIGHT;
      const cheer = Math.sin(progress * Math.PI);
      // Standing, she breathes and sways a little, so she never looks frozen.
      body.rotation.z = hop === null ? Math.sin(time * 1.3) * 0.03 : 0;
      head.rotation.y = hop === null ? Math.sin(time * 0.7) * 0.15 : 0;
      for (const { shoulder, side } of arms) {
        shoulder.rotation.z = side * (0.12 + Math.sin(time * 1.3) * 0.03 + cheer * 2.4);
      }
    },
  };
}
