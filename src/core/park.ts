import type { Point, RoadGraph } from './roads';
import type { SpeciesId } from './species';

/** Where the jeep picks up each kind of supply (docs/design.md §3). */
export type StationKind = 'hay' | 'meat' | 'water' | 'bath' | 'toys' | 'vet';

export interface Station {
  readonly kind: StationKind;
  readonly position: Point;
}

export interface Pen {
  readonly species: SpeciesId;
  /** Centre of the pen. */
  readonly position: Point;
  /** Half the pen's width and depth, in metres. */
  readonly halfSize: Point;
}

export interface Park {
  readonly roads: RoadGraph;
  readonly pens: readonly Pen[];
  readonly stations: readonly Station[];
  /** Where the jeep starts, on a road. */
  readonly start: Point;
}

/** The farthest a pen or station's gate may be from the road it's reached by. */
export const MAX_REACH = 12;

/**
 * The launch park: a rounded loop with a road across the middle. Pens sit outside the loop and stations
 * inside it, so every trip is a short drive. Coordinates are metres; −z is "north", away from the camera.
 */
export const PARK: Park = {
  roads: {
    nodes: new Map<string, Point>([
      ['nw', { x: -36, z: -18 }],
      ['nnw', { x: -30, z: -24 }],
      ['n', { x: 0, z: -24 }],
      ['nne', { x: 30, z: -24 }],
      ['ne', { x: 36, z: -18 }],
      ['e', { x: 36, z: 0 }],
      ['se', { x: 36, z: 18 }],
      ['sse', { x: 30, z: 24 }],
      ['s', { x: 0, z: 24 }],
      ['ssw', { x: -30, z: 24 }],
      ['sw', { x: -36, z: 18 }],
      ['w', { x: -36, z: 0 }],
      ['centre', { x: 0, z: 0 }],
    ]),
    edges: [
      ['nw', 'nnw'],
      ['nnw', 'n'],
      ['n', 'nne'],
      ['nne', 'ne'],
      ['ne', 'e'],
      ['e', 'se'],
      ['se', 'sse'],
      ['sse', 's'],
      ['s', 'ssw'],
      ['ssw', 'sw'],
      ['sw', 'w'],
      ['w', 'nw'],
      ['n', 'centre'],
      ['centre', 's'],
    ],
  },
  pens: [
    { species: 'triceratops', position: { x: -18, z: -34 }, halfSize: { x: 8, z: 6 } },
    { species: 'brontosaurus', position: { x: 18, z: -36 }, halfSize: { x: 9, z: 8 } },
    { species: 'stegosaurus', position: { x: -18, z: 34 }, halfSize: { x: 8, z: 6 } },
    { species: 'trex', position: { x: 18, z: 35 }, halfSize: { x: 9, z: 7 } },
  ],
  stations: [
    { kind: 'hay', position: { x: -14, z: -16 } },
    { kind: 'meat', position: { x: 14, z: -16 } },
    { kind: 'water', position: { x: -27, z: 0 } },
    { kind: 'bath', position: { x: 27, z: 0 } },
    { kind: 'toys', position: { x: -14, z: 16 } },
    { kind: 'vet', position: { x: 14, z: 16 } },
  ],
  start: { x: 0, z: 24 },
};

/** The point of a pen's fence that faces the park's centre, where food and toys are handed over. */
export function penGate(pen: Pen): Point {
  const towardsCentre = pen.position.z < 0 ? 1 : -1;
  return { x: pen.position.x, z: pen.position.z + towardsCentre * pen.halfSize.z };
}
