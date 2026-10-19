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
  /** The heading the body is turning towards: the road ahead, or the last road driven once parked. */
  readonly facing: number;
  readonly speed: number;
  /** Points still to drive through; empty when parked. */
  readonly route: readonly Point[];
}

export function parkedJeep(position: Point, heading = 0): Jeep {
  return { position, heading, facing: heading, speed: 0, route: [] };
}

/**
 * Starts driving along `route`. It keeps the current speed so a new tap doesn't jolt the jeep, unless the route
 * doubles back: the body turns more slowly than the jeep moves, so it would slide backwards at full speed.
 */
export function driveAlong(jeep: Jeep, route: readonly Point[]): Jeep {
  const ahead = route.length > 0 && distance(route[0] as Point, jeep.position) < 1e-6 ? route.slice(1) : route;
  const next = ahead[0];
  const doublesBack =
    next !== undefined && Math.abs(angleBetween(jeep.heading, headingTowards(jeep.position, next))) > Math.PI / 2;
  return { ...jeep, speed: doublesBack ? 0 : jeep.speed, route: ahead };
}

/**
 * Cuts the jeep's route short at its usual braking distance, v²/2a, so it eases to a stop just ahead instead of either
 * finishing its trip or halting dead. A parked jeep stays parked.
 */
export function pullOver(jeep: Jeep): Jeep {
  let left = jeep.speed ** 2 / (2 * ACCELERATION);
  let from = jeep.position;
  const route: Point[] = [];
  for (const point of jeep.route) {
    const gap = distance(from, point);
    if (gap >= left) {
      if (left > 0) {
        route.push(lerp(from, point, left / gap));
      }
      break;
    }
    route.push(point);
    left -= gap;
    from = point;
  }
  return { ...jeep, route };
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
  if (seconds <= 0) {
    return jeep;
  }
  if (jeep.route.length === 0) {
    // Parked, but still finishing a turn that a short last stretch didn't leave time for.
    return { ...jeep, heading: turnTowards(jeep.heading, jeep.facing, seconds), speed: 0 };
  }

  const remaining = routeLength([jeep.position, ...jeep.route]);
  // Fast as allowed, but never faster than lets us stop gently at the end: v² = 2·a·d.
  const target = Math.min(CRUISE_SPEED, Math.sqrt(2 * ACCELERATION * remaining));
  // A new route can end closer than the jeep can stop at the usual rate, so brake as hard as the distance needs.
  const braking = remaining > 0 ? Math.max(ACCELERATION, jeep.speed ** 2 / (2 * remaining)) : ACCELERATION;
  const speed =
    jeep.speed < target
      ? Math.min(target, jeep.speed + ACCELERATION * seconds)
      : Math.max(target, jeep.speed - braking * seconds);
  // Always creep forward a little so the jeep can't stall just short of the end.
  let travel = Math.max(speed, 0.5) * seconds;

  let position = jeep.position;
  let route = jeep.route;
  let facing = jeep.facing;
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

  return {
    position,
    heading: turnTowards(jeep.heading, facing, seconds),
    facing,
    speed: route.length === 0 ? 0 : speed,
    route,
  };
}

/** Turns from `heading` towards `target` by at most TURN_RATE for `seconds`. */
function turnTowards(heading: number, target: number, seconds: number): number {
  const maxTurn = TURN_RATE * seconds;
  return heading + Math.max(-maxTurn, Math.min(maxTurn, angleBetween(heading, target)));
}
