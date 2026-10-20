import { type Pen, penGate } from './park';
import { type Point, distance } from './roads';

/**
 * Playing fetch in a close-up (docs/design.md §3): the ball waits by the gate, the child taps where in the pen to
 * throw it, and the dinosaur runs after it and carries it back.
 */

/** How long the ball is in the air, in seconds, and how high it goes, in metres. */
export const THROW_SECONDS = 0.8;
export const THROW_HEIGHT = 4;
/** How fast the dinosaur runs after the ball and back, in metres a second. */
export const FETCH_SPEED = 7;
/** The ball lands at least this far inside the fence, so the dinosaur can always reach it. */
export const FENCE_MARGIN = 2;
/** The ball waits, and is brought back to, this far into the pen from its gate. */
export const DROP_DEPTH = 3;
/** Within this, in metres, the dinosaur has reached the ball, or brought it back. */
const REACH = 0.5;

export interface Fetch {
  /** Waiting to be thrown, in the air, being chased, or being carried back. */
  readonly phase: 'ready' | 'thrown' | 'chasing' | 'returning';
  /** Where the ball is on the ground, or will land when thrown. */
  readonly ball: Point;
  /** Where it was thrown from. */
  readonly from: Point;
  /** Seconds since it was thrown. */
  readonly flight: number;
  /** Where the dinosaur fetching it is. */
  readonly dino: Point;
}

/** Where the ball waits in `pen`: just inside its gate. */
export function dropPoint(pen: Pen): Point {
  const gate = penGate(pen);
  const inwards = Math.sign(pen.position.z - gate.z);
  return { x: gate.x, z: gate.z + inwards * DROP_DEPTH };
}

/** A game of fetch in `pen`, with the dinosaur at `dino` and the ball waiting by the gate. */
export function startFetch(pen: Pen, dino: Point): Fetch {
  const drop = dropPoint(pen);
  return { phase: 'ready', ball: drop, from: drop, flight: 0, dino };
}

/** Throws the ball towards `target`, landing inside the fence, if it's ready to throw. */
export function throwBall(fetch: Fetch, pen: Pen, target: Point): Fetch {
  if (fetch.phase !== 'ready') {
    return fetch;
  }
  const clamp = (value: number, centre: number, half: number) =>
    Math.min(centre + half - FENCE_MARGIN, Math.max(centre - half + FENCE_MARGIN, value));
  const ball = {
    x: clamp(target.x, pen.position.x, pen.halfSize.x),
    z: clamp(target.z, pen.position.z, pen.halfSize.z),
  };
  return { ...fetch, phase: 'thrown', from: fetch.ball, ball, flight: 0 };
}

/** `from` moved up to `step` towards `to`. */
function towards(from: Point, to: Point, step: number): Point {
  const gap = distance(from, to);
  if (gap <= step) {
    return to;
  }
  return { x: from.x + ((to.x - from.x) * step) / gap, z: from.z + ((to.z - from.z) * step) / gap };
}

/** `fetch` after `seconds` more in `pen`, and whether the ball was brought back in that time. */
export function stepFetch(fetch: Fetch, pen: Pen, seconds: number): { fetch: Fetch; fetched: boolean } {
  switch (fetch.phase) {
    case 'ready':
      return { fetch, fetched: false };
    case 'thrown': {
      const flight = fetch.flight + seconds;
      return { fetch: { ...fetch, flight, phase: flight >= THROW_SECONDS ? 'chasing' : 'thrown' }, fetched: false };
    }
    case 'chasing': {
      const dino = towards(fetch.dino, fetch.ball, FETCH_SPEED * seconds);
      return {
        fetch: { ...fetch, dino, phase: distance(dino, fetch.ball) <= REACH ? 'returning' : 'chasing' },
        fetched: false,
      };
    }
    case 'returning': {
      const drop = dropPoint(pen);
      const dino = towards(fetch.dino, drop, FETCH_SPEED * seconds);
      if (distance(dino, drop) > REACH) {
        return { fetch: { ...fetch, dino, ball: dino }, fetched: false };
      }
      return { fetch: { ...fetch, dino, ball: drop, from: drop, flight: 0, phase: 'ready' }, fetched: true };
    }
  }
}

/** How high the ball is: in an arc while thrown, on the ground otherwise. */
export function ballHeight(fetch: Fetch): number {
  if (fetch.phase !== 'thrown') {
    return 0;
  }
  const t = Math.min(1, fetch.flight / THROW_SECONDS);
  return 4 * THROW_HEIGHT * t * (1 - t);
}
