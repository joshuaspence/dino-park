import { describe, expect, it } from 'vitest';

import { type RoadGraph, findRoute, nearestRoadPosition, pointAlong, routeLength } from './roads';

// A square loop with a spur:
//
//   a(0,0) ── b(10,0) ── e(20,0)
//     │          │
//   d(0,10) ── c(10,10)
const park: RoadGraph = {
  nodes: new Map([
    ['a', { x: 0, z: 0 }],
    ['b', { x: 10, z: 0 }],
    ['c', { x: 10, z: 10 }],
    ['d', { x: 0, z: 10 }],
    ['e', { x: 20, z: 0 }],
  ]),
  edges: [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'd'],
    ['d', 'a'],
    ['b', 'e'],
  ],
};

describe('nearestRoadPosition', () => {
  it('projects onto the closest segment', () => {
    const position = nearestRoadPosition(park, { x: 4, z: -3 });
    expect(position.edge).toBe(0);
    expect(position.t).toBeCloseTo(0.4);
    expect(position.point).toEqual({ x: 4, z: 0 });
    expect(position.distance).toBeCloseTo(3);
  });

  it('clamps to the end of a segment', () => {
    const position = nearestRoadPosition(park, { x: 25, z: 1 });
    expect(position.edge).toBe(4);
    expect(position.point).toEqual({ x: 20, z: 0 });
  });

  it('refuses an empty graph', () => {
    expect(() => nearestRoadPosition({ nodes: new Map(), edges: [] }, { x: 0, z: 0 })).toThrow();
  });
});

describe('findRoute', () => {
  const at = (x: number, z: number) => nearestRoadPosition(park, { x, z });

  it('drives straight along one segment', () => {
    expect(findRoute(park, at(2, 0), at(8, 0))).toEqual([
      { x: 2, z: 0 },
      { x: 8, z: 0 },
    ]);
  });

  it('turns through junctions the short way round the loop', () => {
    const route = findRoute(park, at(2, 0), at(10, 8));
    expect(route).toEqual([
      { x: 2, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 8 },
    ]);
    expect(routeLength(route)).toBeCloseTo(16);
  });

  it('goes the other way round when that is shorter', () => {
    const route = findRoute(park, at(2, 0), at(0, 8));
    expect(route).toEqual([
      { x: 2, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: 8 },
    ]);
  });

  it('reaches the end of a spur', () => {
    const route = findRoute(park, at(0, 5), at(20, 0));
    expect(route.at(-1)).toEqual({ x: 20, z: 0 });
    expect(routeLength(route)).toBeCloseTo(25);
  });

  it('stays put when the roads do not connect', () => {
    const islands: RoadGraph = {
      nodes: new Map([
        ['a', { x: 0, z: 0 }],
        ['b', { x: 1, z: 0 }],
        ['c', { x: 5, z: 5 }],
        ['d', { x: 6, z: 5 }],
      ]),
      edges: [
        ['a', 'b'],
        ['c', 'd'],
      ],
    };
    const from = nearestRoadPosition(islands, { x: 0.5, z: 0 });
    const to = nearestRoadPosition(islands, { x: 5.5, z: 5 });
    expect(findRoute(islands, from, to)).toEqual([{ x: 0.5, z: 0 }]);
  });
});

describe('pointAlong', () => {
  const route = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
  ];

  it('walks along each leg, facing the way it goes', () => {
    expect(pointAlong(route, 4)).toEqual({ point: { x: 4, z: 0 }, heading: Math.PI / 2 });
    expect(pointAlong(route, 15)).toEqual({ point: { x: 10, z: 5 }, heading: 0 });
  });

  it('stays at the ends before the start and past the finish', () => {
    expect(pointAlong(route, -3).point).toEqual({ x: 0, z: 0 });
    expect(pointAlong(route, 100)).toEqual({ point: { x: 10, z: 10 }, heading: 0 });
  });
});
