import type { Point } from '../core/roads';

/**
 * Keyboard and gamepad steering, an extra on top of tapping (docs/design.md §4). A held direction is a compass
 * direction on screen, since the camera keeps one: up is north (−z), right is east (+x).
 */
export interface Steering {
  /** The held direction, or null when nothing is held. Not normalised: diagonals are allowed. */
  direction(): Point | null;
  /** True once per press of a honk key or button. */
  takeHonk(): boolean;
  dispose(): void;
}

const KEYS: Readonly<Record<string, Point>> = {
  ArrowUp: { x: 0, z: -1 },
  KeyW: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
  KeyS: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 },
  KeyA: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
  KeyD: { x: 1, z: 0 },
};
const HONK_KEYS = new Set(['Space', 'KeyH']);
/** The standard gamepad mapping's A button and d-pad buttons. */
const PAD_HONK = 0;
const PAD_DIRECTIONS: readonly [number, Point][] = [
  [12, { x: 0, z: -1 }],
  [13, { x: 0, z: 1 }],
  [14, { x: -1, z: 0 }],
  [15, { x: 1, z: 0 }],
];
/** Stick travel ignored around the centre, where worn sticks rest. */
const DEAD_ZONE = 0.3;

/** Listens on `target` for keys, polling gamepads on demand. `onGesture` runs on any key, which may unlock sound. */
export function startSteering(target: Window, onGesture: () => void): Steering {
  const held = new Set<string>();
  let honks = 0;
  let padHonkHeld = false;

  function onKeyDown(event: KeyboardEvent): void {
    onGesture();
    // A focused button already acts on Space and Enter, so leave those to it rather than honking twice.
    if (event.target instanceof HTMLButtonElement && (event.code === 'Space' || event.code === 'Enter')) {
      return;
    }
    if (event.code in KEYS) {
      held.add(event.code);
      event.preventDefault();
    } else if (HONK_KEYS.has(event.code) && !event.repeat) {
      honks += 1;
      event.preventDefault();
    }
  }
  function onKeyUp(event: KeyboardEvent): void {
    held.delete(event.code);
  }
  // Keys released while the window was in the background never send `keyup`.
  function onBlur(): void {
    held.clear();
  }
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  function pad(): Gamepad | null {
    return target.navigator.getGamepads?.().find((candidate) => candidate?.connected) ?? null;
  }

  return {
    direction() {
      let x = 0;
      let z = 0;
      for (const code of held) {
        x += KEYS[code]?.x ?? 0;
        z += KEYS[code]?.z ?? 0;
      }
      const gamepad = pad();
      if (gamepad) {
        const [stickX = 0, stickZ = 0] = gamepad.axes;
        if (Math.hypot(stickX, stickZ) > DEAD_ZONE) {
          x += stickX;
          z += stickZ;
        }
        for (const [button, way] of PAD_DIRECTIONS) {
          if (gamepad.buttons[button]?.pressed) {
            x += way.x;
            z += way.z;
          }
        }
      }
      return x === 0 && z === 0 ? null : { x, z };
    },
    takeHonk() {
      const padHonk = pad()?.buttons[PAD_HONK]?.pressed ?? false;
      if (padHonk && !padHonkHeld) {
        honks += 1;
      }
      padHonkHeld = padHonk;
      if (honks === 0) {
        return false;
      }
      honks -= 1;
      return true;
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
