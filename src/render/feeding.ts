import * as THREE from 'three';

import type { StationKind } from '../core/park';
import type { DinoInstance } from './dinoSkin';
import { cargoIcon, iconMaterial } from './icons';

/** How big the food is, and how close on screen, in CSS pixels, a press must be to pick it up. */
const FOOD_SIZE = 1.6;
const GRAB_PX = 90;
/** Letting go of the food this close to the mouth on screen feeds it. */
const MOUTH_PX = 140;
/** How long the food takes to fly into the mouth, or float back when dropped elsewhere, in seconds. */
const FLY_SECONDS = 0.35;
/** How far from the mouth towards the jeep the food waits, as a fraction of the way. */
const REST_FRACTION = 0.45;

/** The front of a model's head, as it stands now: the middle of its foremost vertices along the way it faces (+z). */
function headOf(object: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 {
  object.updateWorldMatrix(true, true);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
  const points: THREE.Vector3[] = [];
  object.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      const mesh = part as THREE.Mesh;
      const count = mesh.geometry.getAttribute('position').count;
      for (let i = 0; i < count; i++) {
        points.push(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      }
    }
  });
  const reach = points.map((point) => point.dot(forward));
  const front = Math.max(...reach);
  const back = Math.min(...reach);
  // The snout is the front tenth of the dinosaur, nose to tail.
  const snout = points.filter((_, i) => (reach[i] ?? back) >= front - 0.1 * (front - back));
  target.set(0, 0, 0);
  for (const point of snout) {
    target.add(point);
  }
  return snout.length > 0 ? target.divideScalar(snout.length) : object.getWorldPosition(target);
}

/** Feeding a dinosaur by hand (docs/design.md §3): the food waits by the jeep for the child to drag to its mouth. */
export interface Feeding {
  /** Holds out `item` for `herd`, whose pen gate is at `gate`. */
  start(herd: readonly DinoInstance[], item: StationKind, gate: THREE.Vector3): void;
  stop(): void;
  /** A press at `clientX`, `clientY`: whether it picked up the food. */
  press(clientX: number, clientY: number): boolean;
  drag(clientX: number, clientY: number): void;
  /**
   * Lets go of the food. Near the mouth it flies in; a tap on the food without dragging sends it there too, for
   * children who can't drag yet. Anywhere else it floats back.
   */
  release(clientX: number, clientY: number, tapped: boolean): void;
  /** The browser took the press over (an edge swipe, palm rejection): the food floats back. */
  cancel(): void;
  /** Moves the food on. True on the frame a bite lands. */
  update(delta: number): boolean;
  /** Where the food and the mouth are on the canvas, in CSS pixels. */
  onScreen(): { food: { x: number; y: number }; mouth: { x: number; y: number } };
}

export function createFeeding(scene: THREE.Scene, camera: THREE.Camera, canvas: HTMLCanvasElement): Feeding {
  const food = new THREE.Sprite();
  food.scale.setScalar(FOOD_SIZE);
  food.visible = false;
  scene.add(food);

  const mouth = new THREE.Vector3();
  const rest = new THREE.Vector3();
  const from = new THREE.Vector3();
  const plane = new THREE.Plane();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const hit = new THREE.Vector3();
  let state: 'resting' | 'held' | 'flying' | 'returning' = 'resting';
  let flight = 0;

  function toScreen(point: THREE.Vector3): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    projected.copy(point).project(camera);
    return { x: ((projected.x + 1) / 2) * rect.width, y: ((1 - projected.y) / 2) * rect.height };
  }

  function screenGap(point: THREE.Vector3, clientX: number, clientY: number): number {
    const rect = canvas.getBoundingClientRect();
    const { x, y } = toScreen(point);
    return Math.hypot(clientX - rect.left - x, clientY - rect.top - y);
  }

  function flyFrom(next: 'flying' | 'returning'): void {
    from.copy(food.position);
    flight = 0;
    state = next;
  }

  return {
    start(herd, item, gate) {
      const first = herd[0];
      if (!first) {
        return;
      }
      headOf(first.object, mouth);
      rest.copy(mouth).lerp(gate, REST_FRACTION);
      rest.y = Math.max(rest.y, 2);
      food.material = iconMaterial(cargoIcon(item));
      food.position.copy(rest);
      food.scale.setScalar(FOOD_SIZE);
      food.visible = true;
      state = 'resting';
    },
    stop() {
      food.visible = false;
      state = 'resting';
    },
    press(clientX, clientY) {
      if (!food.visible || state !== 'resting' || screenGap(food.position, clientX, clientY) > GRAB_PX) {
        return false;
      }
      state = 'held';
      return true;
    },
    drag(clientX, clientY) {
      if (state !== 'held') {
        return;
      }
      // The food moves across the screen with the finger, at the depth where it waits.
      const rect = canvas.getBoundingClientRect();
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(projected), rest);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        food.position.copy(hit);
      }
    },
    cancel() {
      if (state === 'held') {
        flyFrom('returning');
      }
    },
    release(clientX, clientY, tapped) {
      if (state !== 'held') {
        return;
      }
      flyFrom(tapped || screenGap(mouth, clientX, clientY) <= MOUTH_PX ? 'flying' : 'returning');
    },
    update(delta) {
      if (state !== 'flying' && state !== 'returning') {
        return false;
      }
      flight = Math.min(1, flight + delta / FLY_SECONDS);
      const eased = 1 - (1 - flight) ** 3;
      food.position.lerpVectors(from, state === 'flying' ? mouth : rest, eased);
      if (state === 'flying') {
        food.scale.setScalar(FOOD_SIZE * (1 - 0.7 * eased));
      }
      if (flight < 1) {
        return false;
      }
      const bite = state === 'flying';
      // Another helping is ready straight away.
      food.position.copy(rest);
      food.scale.setScalar(FOOD_SIZE);
      state = 'resting';
      return bite;
    },
    onScreen() {
      return { food: toScreen(food.position), mouth: toScreen(mouth) };
    },
  };
}
