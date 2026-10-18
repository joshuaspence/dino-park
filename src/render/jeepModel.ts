import * as THREE from 'three';

/** A chunky toy safari jeep built from primitives, facing +z. Wheels are named `wheel` so they can spin. */
export function buildJeep(color = 0xffb020): THREE.Group {
  const jeep = new THREE.Group();
  jeep.name = 'jeep';
  const flat = (hex: number) => new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.7 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = true;
    jeep.add(part);
    return part;
  };

  const body = flat(color);
  const trim = flat(0x3b3b3b);
  add(new THREE.BoxGeometry(2.2, 0.8, 3.8), body, 0, 0.9, 0);
  add(new THREE.BoxGeometry(2.2, 0.5, 1.4), body, 0, 1.5, 1.1); // bonnet
  add(new THREE.BoxGeometry(2.0, 0.6, 0.08), flat(0xbfe8ff), 0, 2.05, 0.45); // windscreen
  // Roll bar over the seats.
  for (const x of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6), trim, x, 1.95, -0.4);
  }
  add(new THREE.CylinderGeometry(0.07, 0.07, 2.0, 6), trim, 0, 2.6, -0.4).rotation.z = Math.PI / 2;

  const tyre = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 14);
  tyre.rotateZ(Math.PI / 2);
  for (const [x, z] of [
    [-1.15, 1.25],
    [1.15, 1.25],
    [-1.15, -1.25],
    [1.15, -1.25],
  ] as const) {
    add(tyre, trim, x, 0.55, z).name = 'wheel';
  }
  // Headlights so the front is obvious.
  for (const x of [-0.65, 0.65]) {
    add(new THREE.SphereGeometry(0.18, 8, 6), flat(0xfff6c8), x, 1.0, 1.92);
  }
  return jeep;
}
