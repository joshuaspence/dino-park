import * as THREE from 'three';

import { type Jeep, driveAlong, parkedJeep, stepJeep } from '../core/jeep';
import { NEEDS_PER_EGG, eggProgress, eggReady, isSad, startCare, stepNeeds } from '../core/needs';
import { PARK, type Pen, openRoads, penGate } from '../core/park';
import { type Point, distance, findRoute, nearestRoadPosition, pointAlong, routeLength } from '../core/roads';
import { LAUNCH_SPECIES, ROSIE_MODEL, SPECIES, type SpeciesId, speciesInPark } from '../core/species';
import { type DinoInstance, loadDinoSkin } from './dinoSkin';
import { cargoIcon, iconMaterial, needIcon } from './icons';
import { buildJeep } from './jeepModel';
import { buildPark } from './parkScene';

export interface GameHandle {
  dispose(): void;
}

/** Where the camera sits relative to the jeep. It keeps one compass direction, so tapped spots don't move. */
const CAMERA_OFFSET = new THREE.Vector3(0, 24, 30);
/** How quickly the camera catches up with the jeep (per second; higher is snappier). */
const CAMERA_FOLLOW = 3;
/** A press shorter than this, that barely moves, is a tap; longer is hold-to-drive. */
const TAP_MS = 300;
const TAP_SLOP_PX = 12;
/** While holding, how often the route is re-planned towards the finger. */
const HOLD_REPLAN_SECONDS = 0.25;
/** Taps this close to a pen gate or station go to it rather than to the nearest road. */
const SNAP_DISTANCE = 7;
const TRAIL_SPACING = 1.6;
const TRAIL_MAX_DOTS = 120;
/** Need bubbles float above the tallest dinosaur's head. */
const BUBBLE_HEIGHT = 8;
const BUBBLE_SIZE = 3.5;
/** A sad bubble grows by this much, so a long wait is easy to spot. */
const SAD_GROWTH = 1.4;
/** An egg starts small and grows with each need met, to a full size big enough to be the moment it is. */
const EGG_START_SIZE = 0.6;
const EGG_FULL_SIZE = 1.5;
const SHELL_SECONDS = 1.2;
/** Hatchlings stand in an arc on the nest's far side from the cross road, wrapping round once it's full. */
const HATCHLING_SPOTS = 7;
const HATCHLING_RING = 4.5;
const HATCHLING_ARC = (2 * Math.PI) / 5;
/** How long hatchlings with a pen of their own celebrate by the nest before running off to it. */
const HATCH_CELEBRATION_SECONDS = 4;
/** Hatchlings run to their pen along the roads in single file, this fast and this far apart. */
const HATCHLING_SPEED = 8;
const HATCHLING_SPACING = 2.5;
/** How quickly an opening gate swings (per second; higher is snappier). */
const GATE_SWING = 2;

function hatchlingSpot(index: number): Point {
  const angle = ((index % HATCHLING_SPOTS) / (HATCHLING_SPOTS - 1) - 0.5) * 2 * HATCHLING_ARC;
  return { x: PARK.nest.x + HATCHLING_RING * Math.cos(angle), z: PARK.nest.z + HATCHLING_RING * Math.sin(angle) };
}

/** The spots worth driving to: pen gates, stations and the nest. */
const DESTINATIONS: Point[] = [
  ...PARK.pens.map(penGate),
  ...PARK.stations.map((station) => station.position),
  PARK.nest,
];

function snapToDestination(point: Point): Point {
  let best = point;
  let bestDistance = SNAP_DISTANCE;
  for (const destination of DESTINATIONS) {
    const away = distance(point, destination);
    if (away < bestDistance) {
      best = destination;
      bestDistance = away;
    }
  }
  return best;
}

/** Starts the park: the jeep, its route trail, the dinosaurs in their pens, and touch/mouse input. */
export function startGame(canvas: HTMLCanvasElement): GameHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8f5);
  scene.fog = new THREE.Fog(0x9fd8f5, 60, 120);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a8f3c, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
  scene.add(sun, sun.target);

  const park = buildPark(PARK);
  scene.add(park);
  const ground = park.getObjectByName('ground');

  let jeep: Jeep = parkedJeep(PARK.start, Math.PI / 2);
  const jeepModel = buildJeep();
  scene.add(jeepModel);
  const wheels = jeepModel.children.filter((child) => child.name === 'wheel');

  const trail = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.35, 10).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    TRAIL_MAX_DOTS,
  );
  trail.frustumCulled = false;
  scene.add(trail);

  const dinos: DinoInstance[] = [];
  const herds = new Map<SpeciesId, DinoInstance[]>();

  let care = startCare(PARK);
  const bubbles = PARK.pens.map((pen) => {
    const bubble = new THREE.Sprite();
    bubble.position.set(pen.position.x, BUBBLE_HEIGHT, pen.position.z);
    bubble.visible = false;
    scene.add(bubble);
    return bubble;
  });
  // Floating over the jeep, clear of Rosie and the roll bar, so the child can see what they're carrying.
  const cargo = new THREE.Sprite();
  cargo.position.set(0, 4, -0.6);
  cargo.scale.setScalar(2.6);
  cargo.visible = false;
  jeepModel.add(cargo);

  const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xfff6e0, flatShading: true, roughness: 0.6 });
  const egg = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10).scale(0.8, 1, 0.8), shellMaterial);
  egg.castShadow = true;
  egg.position.set(PARK.nest.x, 0, PARK.nest.z);
  egg.scale.setScalar(EGG_START_SIZE);
  for (const [x, y, z] of [
    [0.6, 0.3, 0.4],
    [-0.5, 0.5, 0.5],
    [0.1, -0.2, 0.78],
    [-0.3, 0.1, -0.75],
  ] as const) {
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x7fc97f, flatShading: true }),
    );
    spot.position.set(x, y, z);
    egg.add(spot);
  }
  scene.add(egg);

  /** Half-shells flying apart after a hatch, removed once they land. */
  const shells: { mesh: THREE.Mesh; velocity: THREE.Vector3; age: number }[] = [];

  async function hatch(species: SpeciesId | null): Promise<void> {
    for (const side of [-1, 1]) {
      const half = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 6, 0, 2 * Math.PI, 0, Math.PI / 2), shellMaterial);
      half.position.copy(egg.position);
      half.scale.copy(egg.scale);
      half.rotation.z = side === 1 ? 0 : Math.PI;
      shells.push({ mesh: half, velocity: new THREE.Vector3(side * 3, 6, 1.5), age: 0 });
      scene.add(half);
    }
    // An egg always brings out a dinosaur. One whose species has no model yet, or that comes after everything has
    // hatched, is a half-size baby of a launch dinosaur instead (docs/design.md §5).
    const model = species && SPECIES[species].model;
    const babyModels = LAUNCH_SPECIES.flatMap((id) => SPECIES[id].model ?? []);
    const standIn = model ? null : (babyModels[Math.floor(Math.random() * babyModels.length)] ?? null);
    const hatchling = model ?? standIn;
    if (!hatchling) {
      return;
    }
    const skin = await loadDinoSkin(hatchling);
    if (disposed) {
      return;
    }
    const herdSize = species && model ? SPECIES[species].herdSize : 1;
    const herd: DinoInstance[] = [];
    for (let i = 0; i < herdSize; i++) {
      const dino = skin.create();
      if (standIn) {
        dino.object.scale.multiplyScalar(0.5);
      }
      const spot = hatchlingSpot(hatchlings++);
      dino.object.position.set(spot.x, 0, spot.z);
      dino.object.rotation.y = Math.atan2(spot.x - PARK.nest.x, spot.z - PARK.nest.z);
      scene.add(dino.object);
      dino.play('jump');
      dinos.push(dino);
      herd.push(dino);
    }
    // A species with a pen runs there once it has celebrated, along the road the child will drive, so they see
    // where it went; a stand-in baby stays by the nest.
    const pen = species && model ? PARK.pens.find((candidate) => candidate.species === species) : undefined;
    if (pen) {
      const roads = openRoads(PARK, care.eggsHatched);
      const road = findRoute(roads, nearestRoadPosition(roads, PARK.nest), nearestRoadPosition(roads, penGate(pen)));
      const route = [...road, penGate(pen), pen.position];
      const paths = herd.map((dino) => [{ x: dino.object.position.x, z: dino.object.position.z }, ...route]);
      walks.push({ pen, herd, paths, wait: HATCH_CELEBRATION_SECONDS, travelled: 0 });
    }
  }
  let hatchlings = 0;
  const walks: { pen: Pen; herd: DinoInstance[]; paths: Point[][]; wait: number; travelled: number }[] = [];

  function stepWalks(delta: number): void {
    for (const walk of walks) {
      if (walk.wait > 0) {
        walk.wait -= delta;
        if (walk.wait <= 0) {
          walk.herd.forEach((dino) => dino.play('run'));
        }
        continue;
      }
      walk.travelled += HATCHLING_SPEED * delta;
      walk.herd.forEach((dino, i) => {
        const along = walk.travelled - i * HATCHLING_SPACING;
        const { point, heading } = pointAlong(walk.paths[i] ?? [], along);
        dino.object.position.set(point.x, 0, point.z);
        if (along > 0) {
          dino.object.rotation.y = heading;
        }
      });
    }
    for (const walk of walks.filter((candidate) =>
      candidate.paths.every((path, i) => candidate.travelled - i * HATCHLING_SPACING >= routeLength(path)),
    )) {
      moveIntoPen(walk.pen, walk.herd);
      walk.herd.forEach((dino) => dino.play('idle'));
      walks.splice(walks.indexOf(walk), 1);
    }
  }

  function moveIntoPen(pen: Pen, herd: DinoInstance[]): void {
    herd.forEach((dino, i) => {
      dino.object.position.set(pen.position.x + (i - (herd.length - 1) / 2) * 2.5, 0, pen.position.z);
      // Three-quarter view towards the camera, so each silhouette is easy to recognise.
      dino.object.rotation.y = pen.position.x < 0 ? 0.7 : -0.7;
    });
    herds.set(pen.species, herd);
  }
  let disposed = false;

  async function populate(): Promise<void> {
    const rosie = (await loadDinoSkin(ROSIE_MODEL)).create();
    const inPark = speciesInPark(care.eggsHatched);
    const residents = await Promise.all(
      PARK.pens
        .filter((pen) => inPark.includes(pen.species))
        .map(async (pen) => {
          const model = SPECIES[pen.species].model;
          return { pen, skin: model ? await loadDinoSkin(model) : null };
        }),
    );
    if (disposed) {
      return;
    }
    // Rosie rides standing in the back of the jeep.
    rosie.object.scale.multiplyScalar(0.6);
    rosie.object.position.set(0, 1.3, -0.9);
    jeepModel.add(rosie.object);
    dinos.push(rosie);

    for (const { pen, skin } of residents) {
      if (!skin) {
        continue;
      }
      const herd = Array.from({ length: SPECIES[pen.species].herdSize }, () => skin.create());
      for (const dino of herd) {
        scene.add(dino.object);
        dinos.push(dino);
      }
      moveIntoPen(pen, herd);
    }
    canvas.dataset.ready = 'true';
  }
  void populate();

  // --- Input: tap to go, hold to drive. ---------------------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function groundPointAt(clientX: number, clientY: number): Point | null {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = ground ? raycaster.intersectObject(ground, false)[0] : undefined;
    return hit ? { x: hit.point.x, z: hit.point.z } : null;
  }

  function driveTowards(target: Point): void {
    // Plan on one graph throughout: road positions name edges by index.
    const roads = openRoads(PARK, care.eggsHatched);
    const from = nearestRoadPosition(roads, jeep.position);
    const to = nearestRoadPosition(roads, target);
    jeep = driveAlong(jeep, findRoute(roads, from, to));
  }

  let press: { id: number; x: number; y: number; at: number; holding: boolean } | null = null;
  let sinceReplan = 0;

  function onPointerDown(event: PointerEvent): void {
    if (press) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), holding: false };
    // Plan on the first hold frame, so a press released just after it stops being a tap still drives the jeep.
    sinceReplan = HOLD_REPLAN_SECONDS;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!press || event.pointerId !== press.id) {
      return;
    }
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP_PX) {
      press.holding = true;
    }
    press.x = event.clientX;
    press.y = event.clientY;
  }

  function onPointerUp(event: PointerEvent): void {
    if (!press || event.pointerId !== press.id) {
      return;
    }
    if (!press.holding) {
      const target = groundPointAt(event.clientX, event.clientY);
      if (target) {
        driveTowards(snapToDestination(target));
      }
    }
    press = null;
  }

  /** A press the browser took over (an edge swipe, palm rejection) goes nowhere. */
  function onPointerCancel(event: PointerEvent): void {
    if (press && event.pointerId === press.id) {
      press = null;
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  // --- Frame loop. ------------------------------------------------------------------------------------

  function resize(): void {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const lookAt = new THREE.Vector3();
  function placeCamera(blend: number): void {
    lookAt.set(jeep.position.x, 0, jeep.position.z);
    camera.position.lerp(lookAt.clone().add(CAMERA_OFFSET), blend);
    camera.lookAt(camera.position.x - CAMERA_OFFSET.x, 0, camera.position.z - CAMERA_OFFSET.z);
  }
  placeCamera(1);

  const dot = new THREE.Matrix4();
  function updateTrail(): void {
    const points = [jeep.position, ...jeep.route];
    let count = 0;
    let carry = TRAIL_SPACING;
    for (let i = 1; i < points.length && count < TRAIL_MAX_DOTS; i++) {
      const a = points[i - 1] as Point;
      const b = points[i] as Point;
      const length = distance(a, b);
      let along = carry;
      while (along <= length && count < TRAIL_MAX_DOTS) {
        const t = along / length;
        dot.makeTranslation(a.x + (b.x - a.x) * t, 0.06, a.z + (b.z - a.z) * t);
        trail.setMatrixAt(count++, dot);
        along += TRAIL_SPACING;
      }
      carry = along - length;
    }
    trail.count = count;
    trail.instanceMatrix.needsUpdate = true;
  }

  function updateCare(delta: number): void {
    const step = stepNeeds(care, PARK, { position: jeep.position, parked: jeep.route.length === 0 }, delta);
    care = step.care;
    for (const event of step.events) {
      if (event.type === 'deliver') {
        for (const dino of herds.get(event.species) ?? []) {
          dino.play('jump');
        }
      } else if (event.type === 'hatch') {
        // The shells take the full egg's size, so burst it before the next egg starts small.
        void hatch(event.species);
        egg.scale.setScalar(EGG_START_SIZE);
      }
    }

    const bob = Math.sin(timer.getElapsed() * 2.5) * 0.25;
    care.residents.forEach((resident, i) => {
      const bubble = bubbles[i];
      if (!bubble) {
        return;
      }
      bubble.visible = resident.need !== null;
      if (resident.need) {
        const sad = isSad(resident.need);
        bubble.material = iconMaterial(needIcon(resident.need.kind, resident.species), { bubble: true, sad });
        bubble.scale.setScalar(BUBBLE_SIZE * (sad ? SAD_GROWTH : 1));
        bubble.position.y = BUBBLE_HEIGHT + bob;
      }
    });
    const eggSize = THREE.MathUtils.lerp(EGG_START_SIZE, EGG_FULL_SIZE, eggProgress(care) / NEEDS_PER_EGG);
    egg.scale.setScalar(THREE.MathUtils.damp(egg.scale.x, eggSize, 4, delta));
    egg.position.y = 0.3 + egg.scale.y;
    // A ready egg wobbles in bursts, so it catches the eye without buzzing constantly.
    const elapsed = timer.getElapsed();
    egg.rotation.z = eggReady(care) ? Math.sin(elapsed * 14) * 0.2 * Math.max(0, Math.sin(elapsed * 2)) : 0;
    for (const shell of shells) {
      shell.age += delta;
      shell.velocity.y -= 15 * delta;
      shell.mesh.position.addScaledVector(shell.velocity, delta);
      shell.mesh.rotation.x += delta * 6;
    }
    for (const shell of shells.filter((candidate) => candidate.age > SHELL_SECONDS)) {
      scene.remove(shell.mesh);
      shell.mesh.geometry.dispose();
      shells.splice(shells.indexOf(shell), 1);
    }

    stepWalks(delta);

    const inPark = speciesInPark(care.eggsHatched);
    for (const area of PARK.areas) {
      const open = inPark.includes(area.species);
      park.getObjectByName(`gate-${area.species}`)?.traverse((part) => {
        if (part.name === 'gate-leaf') {
          const target = open ? (part.userData.side as number) * (Math.PI / 2) : 0;
          part.rotation.y = THREE.MathUtils.damp(part.rotation.y, target, GATE_SWING, delta);
        }
      });
    }

    cargo.visible = care.cargo !== null;
    if (care.cargo) {
      cargo.material = iconMaterial(cargoIcon(care.cargo));
    }

    canvas.dataset.needs = care.residents
      .flatMap((resident) => (resident.need ? [`${resident.species}:${resident.need.kind}`] : []))
      .join(' ');
    canvas.dataset.cargo = care.cargo ?? '';
  }

  const timer = new THREE.Timer();
  timer.connect(document);
  renderer.setAnimationLoop(() => {
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.1);

    if (press && (press.holding || performance.now() - press.at > TAP_MS)) {
      press.holding = true;
      sinceReplan += delta;
      if (sinceReplan >= HOLD_REPLAN_SECONDS) {
        sinceReplan = 0;
        const target = groundPointAt(press.x, press.y);
        if (target) {
          driveTowards(target);
        }
      }
    }

    jeep = stepJeep(jeep, delta);
    jeepModel.position.set(jeep.position.x, 0, jeep.position.z);
    jeepModel.rotation.y = jeep.heading;
    for (const wheel of wheels) {
      wheel.rotation.x += (jeep.speed * delta) / 0.55;
    }
    canvas.dataset.moving = String(jeep.route.length > 0);
    updateTrail();
    updateCare(delta);

    sun.position.set(jeep.position.x + 15, 30, jeep.position.z + 10);
    sun.target.position.set(jeep.position.x, 0, jeep.position.z);
    placeCamera(1 - Math.exp(-CAMERA_FOLLOW * delta));

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
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            material.dispose();
          }
        }
      });
      trail.dispose();
      renderer.dispose();
    },
  };
}
