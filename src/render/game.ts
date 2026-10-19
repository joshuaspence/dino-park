import * as THREE from 'three';

import { type Jeep, driveAlong, parkedJeep, stepJeep } from '../core/jeep';
import { isSad, startCare, stepNeeds } from '../core/needs';
import { PARK, penGate } from '../core/park';
import { type Point, distance, findRoute, nearestRoadPosition } from '../core/roads';
import { ROSIE_MODEL, SPECIES, type SpeciesId } from '../core/species';
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

/** The spots worth driving to: pen gates and stations. */
const DESTINATIONS: Point[] = [...PARK.pens.map(penGate), ...PARK.stations.map((station) => station.position)];

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
  let disposed = false;

  async function populate(): Promise<void> {
    const rosie = (await loadDinoSkin(ROSIE_MODEL)).create();
    const residents = await Promise.all(
      PARK.pens.map(async (pen) => {
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
      const herdSize = SPECIES[pen.species].herdSize;
      const herd: DinoInstance[] = [];
      herds.set(pen.species, herd);
      for (let i = 0; i < herdSize; i++) {
        const dino = skin.create();
        dino.object.position.set(pen.position.x + (i - (herdSize - 1) / 2) * 2.5, 0, pen.position.z);
        // Three-quarter view towards the camera, so each silhouette is easy to recognise.
        dino.object.rotation.y = pen.position.x < 0 ? 0.7 : -0.7;
        scene.add(dino.object);
        dinos.push(dino);
        herd.push(dino);
      }
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
    const from = nearestRoadPosition(PARK.roads, jeep.position);
    const to = nearestRoadPosition(PARK.roads, target);
    jeep = driveAlong(jeep, findRoute(PARK.roads, from, to));
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
