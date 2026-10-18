import * as THREE from 'three';

import { type Park, type Pen, type StationKind, penGate } from '../core/park';
import { distance } from '../core/roads';

const ROAD_WIDTH = 5;

/** Cached flat-shaded materials by colour, so the park shares a handful of materials. */
const materials = new Map<number, THREE.MeshStandardMaterial>();
function paint(color: number): THREE.MeshStandardMaterial {
  let material = materials.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
    materials.set(color, material);
  }
  return material;
}

function mesh(geometry: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const result = new THREE.Mesh(geometry, paint(color));
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function buildRoads(park: Park): THREE.Group {
  const group = new THREE.Group();
  group.name = 'roads';
  const tarmac = 0xe8d5a3;
  for (const [a, b] of park.roads.edges) {
    const from = park.roads.nodes.get(a);
    const to = park.roads.nodes.get(b);
    if (!from || !to) {
      continue;
    }
    const length = distance(from, to);
    const road = mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, length),
      tarmac,
      (from.x + to.x) / 2,
      0.02,
      (from.z + to.z) / 2,
    );
    // Lay the plane flat, then turn its length (local y) along the road.
    road.rotation.set(-Math.PI / 2, 0, Math.atan2(to.x - from.x, to.z - from.z));
    road.castShadow = false;
    group.add(road);
  }
  // Round off every junction so corners look smooth.
  for (const node of park.roads.nodes.values()) {
    const junction = mesh(new THREE.CircleGeometry(ROAD_WIDTH / 2, 20), tarmac, node.x, 0.021, node.z);
    junction.rotation.x = -Math.PI / 2;
    junction.castShadow = false;
    group.add(junction);
  }
  return group;
}

function buildPen(pen: Pen): THREE.Group {
  const group = new THREE.Group();
  group.name = `pen-${pen.species}`;
  const { x: hx, z: hz } = pen.halfSize;

  const floor = mesh(new THREE.PlaneGeometry(hx * 2, hz * 2), 0x7cc25a, pen.position.x, 0.01, pen.position.z);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const wood = 0xa0703c;
  const gate = penGate(pen);
  const post = new THREE.CylinderGeometry(0.15, 0.15, 1.4, 6);
  const GATE_HALF_WIDTH = 2.5;
  // Walk the rectangle's four sides, placing posts every ~2 m and leaving a gap at the gate.
  const corners = [
    { x: pen.position.x - hx, z: pen.position.z - hz },
    { x: pen.position.x + hx, z: pen.position.z - hz },
    { x: pen.position.x + hx, z: pen.position.z + hz },
    { x: pen.position.x - hx, z: pen.position.z + hz },
  ];
  corners.forEach((start, side) => {
    const end = corners[(side + 1) % corners.length] ?? start;
    const length = distance(start, end);
    const steps = Math.max(1, Math.round(length / 2));
    for (let i = 0; i < steps; i++) {
      const a = { x: start.x + ((end.x - start.x) * i) / steps, z: start.z + ((end.z - start.z) * i) / steps };
      const b = {
        x: start.x + ((end.x - start.x) * (i + 1)) / steps,
        z: start.z + ((end.z - start.z) * (i + 1)) / steps,
      };
      const middle = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      if (distance(middle, gate) < GATE_HALF_WIDTH) {
        continue;
      }
      group.add(mesh(post, wood, a.x, 0.7, a.z));
      for (const height of [0.5, 1.1]) {
        const rail = mesh(new THREE.BoxGeometry(distance(a, b), 0.12, 0.08), wood, middle.x, height, middle.z);
        rail.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        group.add(rail);
      }
    }
  });
  return group;
}

/** Simple, chunky stand-ins for each station, recognisable by shape and colour. */
function buildStation(kind: StationKind): THREE.Group {
  const group = new THREE.Group();
  group.name = `station-${kind}`;
  switch (kind) {
    case 'hay':
      for (const [x, y, z] of [
        [-0.8, 0.5, 0],
        [0.8, 0.5, 0],
        [0, 1.5, 0],
      ] as const) {
        group.add(mesh(new THREE.BoxGeometry(1.5, 1, 1.1), 0xf2cf5b, x, y, z));
      }
      break;
    case 'meat': {
      group.add(mesh(new THREE.BoxGeometry(3, 2, 2.5), 0xfff1e0, 0, 1, 0));
      const roof = mesh(new THREE.ConeGeometry(2.4, 1.4, 4), 0xe0483e, 0, 2.7, 0);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
      break;
    }
    case 'water':
      for (const [x, z] of [
        [-0.8, -0.8],
        [0.8, -0.8],
        [-0.8, 0.8],
        [0.8, 0.8],
      ] as const) {
        group.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.5, 6), 0x8a8f98, x, 1.25, z));
      }
      group.add(mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.8, 12), 0x4aa8e8, 0, 3.3, 0));
      group.add(mesh(new THREE.ConeGeometry(1.5, 0.7, 12), 0x2f7fc0, 0, 4.55, 0));
      break;
    case 'bath':
      group.add(mesh(new THREE.CylinderGeometry(1.8, 1.6, 0.8, 16), 0xffffff, 0, 0.4, 0));
      group.add(mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.1, 16), 0x7fd3f7, 0, 0.78, 0));
      break;
    case 'toys': {
      group.add(mesh(new THREE.BoxGeometry(2.6, 2, 2.2), 0x9b6bd6, 0, 1, 0));
      const ball = mesh(new THREE.SphereGeometry(0.8, 12, 10), 0xff5e7e, 0, 2.8, 0);
      group.add(ball);
      break;
    }
    case 'vet':
      group.add(mesh(new THREE.ConeGeometry(2, 2.6, 6), 0xffffff, 0, 1.3, 0));
      group.add(mesh(new THREE.BoxGeometry(0.9, 0.25, 0.1), 0xe0483e, 0, 1.4, 1.35));
      group.add(mesh(new THREE.BoxGeometry(0.25, 0.9, 0.1), 0xe0483e, 0, 1.4, 1.35));
      break;
  }
  return group;
}

/** Builds the static park: ground, roads, pens and stations. */
export function buildPark(park: Park): THREE.Group {
  const group = new THREE.Group();
  group.name = 'park';

  const ground = mesh(new THREE.PlaneGeometry(200, 200), 0x8fd16a);
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  group.add(ground);

  group.add(buildRoads(park));
  for (const pen of park.pens) {
    group.add(buildPen(pen));
  }
  for (const station of park.stations) {
    const model = buildStation(station.kind);
    model.position.set(station.position.x, 0, station.position.z);
    group.add(model);
  }
  return group;
}
