import { type Point, distance, lerp, routeLength } from './roads';

/** Top speed in metres per second, gentle enough to follow with a small child's eyes. */
export const CRUISE_SPEED = 6;
/** Speeding up and slowing down, in metres per second squared. */
export const ACCELERATION = 5;
/** How fast the jeep's body turns towards where it's going, in radians per second. */
export const TURN_RATE = 4;

export interface Jeep {
  readonly position: Point;
  /** Heading in radians: 0 faces +z, π/2 faces +x (three.js's rotation.y convention). */
  readonly heading: number;
  readonly speed: number;
  /** Points still to drive through; empty when parked. */
  readonly route: readonly Point[];
}

export function parkedJeep(position: Point, heading = 0): Jeep {
  return { position, heading, speed: 0, route: [] };
}

/** Starts driving along `route`, keeping the current speed so a new tap doesn't jolt the jeep. */
export function driveAlong(jeep: Jeep, route: readonly Point[]): Jeep {
  return {
    ...jeep,
    route: route.length > 0 && distance(route[0] as Point, jeep.position) < 1e-6 ? route.slice(1) : route,
  };
}

export function headingTowards(from: Point, to: Point): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** The signed smallest turn from heading `a` to heading `b`, in (-π, π]. */
export function angleBetween(a: number, b: number): number {
  const turn = ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return turn === -Math.PI ? Math.PI : turn;
}

/** Advances the jeep by `seconds`: accelerating, easing to a stop at the end of its route, and turning. */
export function stepJeep(jeep: Jeep, seconds: number): Jeep {
  if (jeep.route.length === 0 || seconds <= 0) {
    return jeep.route.length === 0 ? { ...jeep, speed: 0 } : jeep;
  }

  const remaining = routeLength([jeep.position, ...jeep.route]);
  // Fast as allowed, but never faster than lets us stop gently at the end: v² = 2·a·d.
  const target = Math.min(CRUISE_SPEED, Math.sqrt(2 * ACCELERATION * remaining));
  const speed =
    jeep.speed < target
      ? Math.min(target, jeep.speed + ACCELERATION * seconds)
      : Math.max(target, jeep.speed - ACCELERATION * seconds);
  // Always creep forward a little so the jeep can't stall just short of the end.
  let travel = Math.max(speed, 0.5) * seconds;

  let position = jeep.position;
  let route = jeep.route;
  let facing = jeep.heading;
  while (travel > 0 && route.length > 0) {
    const next = route[0] as Point;
    const gap = distance(position, next);
    if (gap > 1e-9) {
      facing = headingTowards(position, next);
    }
    if (gap <= travel) {
      position = next;
      route = route.slice(1);
      travel -= gap;
    } else {
      position = lerp(position, next, travel / gap);
      travel = 0;
    }
  }

  const maxTurn = TURN_RATE * seconds;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, angleBetween(jeep.heading, facing)));
  return { position, heading: jeep.heading + turn, speed: route.length === 0 ? 0 : speed, route };
}
