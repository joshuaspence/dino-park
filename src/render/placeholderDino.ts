import * as THREE from 'three';

/**
 * A stand-in Triceratops built from primitives, used until the CC0 models are imported (M1).
 * The returned group's origin sits on the ground under the body's centre.
 */
export function createPlaceholderDino(): THREE.Group {
  const skin = new THREE.MeshStandardMaterial({ color: 0x6cc24a, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: 0xf2e6a7, flatShading: true });
  const frill = new THREE.MeshStandardMaterial({ color: 0xf28c38, flatShading: true });
  const horn = new THREE.MeshStandardMaterial({ color: 0xfff8e7, flatShading: true });
  const eye = new THREE.MeshStandardMaterial({ color: 0x222222 });

  const dino = new THREE.Group();
  dino.name = 'placeholder-dino';

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.2, 4, 12), skin);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.2;
  dino.add(body);

  const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), belly);
  tummy.scale.set(1.5, 0.8, 0.9);
  tummy.position.set(0, 0.95, 0);
  dino.add(tummy);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), skin);
  head.position.set(1.45, 1.45, 0);
  dino.add(head);

  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 16), frill);
  shield.rotation.z = Math.PI / 2 - 0.35;
  shield.position.set(1.15, 1.75, 0);
  dino.add(shield);

  const hornGeometry = new THREE.ConeGeometry(0.09, 0.5, 8);
  for (const z of [-0.22, 0.22]) {
    const brow = new THREE.Mesh(hornGeometry, horn);
    brow.rotation.z = -Math.PI / 2.6;
    brow.position.set(1.75, 1.85, z);
    dino.add(brow);

    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), eye);
    eyeball.position.set(1.8, 1.6, z * 1.4);
    dino.add(eyeball);
  }
  const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), horn);
  noseHorn.rotation.z = -Math.PI / 2.4;
  noseHorn.position.set(1.95, 1.45, 0);
  dino.add(noseHorn);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 10), skin);
  tail.rotation.z = Math.PI / 2 + 0.25;
  tail.position.set(-1.65, 1.0, 0);
  dino.add(tail);

  const legGeometry = new THREE.CylinderGeometry(0.22, 0.25, 0.8, 10);
  for (const x of [-0.6, 0.6]) {
    for (const z of [-0.4, 0.4]) {
      const leg = new THREE.Mesh(legGeometry, skin);
      leg.position.set(x, 0.4, z);
      dino.add(leg);
    }
  }

  dino.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
    }
  });
  return dino;
}
