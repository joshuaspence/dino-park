import { describe, expect, it } from 'vitest';

import { NEED_KINDS, supplyFor, visitedPlace } from './needs';
import { PARK, type Pen, ROAD_WIDTH, penGate } from './park';
import { type Point, findRoute, nearestRoadPosition } from './roads';
import { LAUNCH_SPECIES } from './species';

/** The road stop nearest `place`, and points on the road up to 2 m either side of it. */
function stopsNear(place: Point): Point[] {
  const stop = nearestRoadPosition(PARK.roads, place).point;
  const nudges = [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
    { x: -2, z: 0 },
    { x: 0, z: 2 },
    { x: 0, z: -2 },
  ];
  return nudges.map((nudge) => nearestRoadPosition(PARK.roads, { x: stop.x + nudge.x, z: stop.z + nudge.z }).point);
}

/** Points every half metre or so around a pen's fence line. */
function fencePosts({ position, halfSize }: Pen): Point[] {
  const posts: Point[] = [];
  const steps = Math.ceil(4 * Math.max(halfSize.x, halfSize.z));
  for (let i = 0; i <= steps; i++) {
    const t = (2 * i) / steps - 1;
    posts.push(
      { x: position.x + t * halfSize.x, z: position.z - halfSize.z },
      { x: position.x + t * halfSize.x, z: position.z + halfSize.z },
      { x: position.x - halfSize.x, z: position.z + t * halfSize.z },
      { x: position.x + halfSize.x, z: position.z + t * halfSize.z },
    );
  }
  return posts;
}

describe('PARK', () => {
  it('only joins nodes that exist', () => {
    for (const [a, b] of PARK.roads.edges) {
      expect(PARK.roads.nodes.has(a)).toBe(true);
      expect(PARK.roads.nodes.has(b)).toBe(true);
    }
  });

  it('has a pen for every launch dinosaur and a station for everything they need', () => {
    expect(PARK.pens.map((pen) => pen.species).sort()).toEqual([...LAUNCH_SPECIES].sort());
    const kinds = new Set(PARK.stations.map((station) => station.kind));
    for (const pen of PARK.pens) {
      for (const need of NEED_KINDS) {
        expect(kinds).toContain(supplyFor(need, pen.species));
      }
    }
  });

  it('visits each station, pen and the nest from its road stop, even stopping a little short or long of it', () => {
    const places = [
      ...PARK.stations.map((station) => ({ place: station.position, visit: { station } })),
      ...PARK.pens.map((pen) => ({ place: penGate(pen), visit: { pen } })),
      { place: PARK.nest, visit: { nest: true } },
    ];
    for (const { place, visit } of places) {
      for (const stop of stopsNear(place)) {
        expect(visitedPlace(PARK, stop)).toEqual(visit);
      }
    }
  });

  it('visits nothing from the ends of the cross road, where the jeep starts', () => {
    expect(PARK.start).toEqual(PARK.roads.nodes.get('s'));
    for (const end of ['n', 's']) {
      const node = PARK.roads.nodes.get(end);
      expect(node && visitedPlace(PARK, node)).toBeUndefined();
    }
  });

  it('starts the jeep on a road', () => {
    expect(nearestRoadPosition(PARK.roads, PARK.start).distance).toBeCloseTo(0);
  });

  it('connects everything to the start', () => {
    const start = nearestRoadPosition(PARK.roads, PARK.start);
    const targets = [...PARK.pens.map(penGate), ...PARK.stations.map((station) => station.position)];
    for (const target of targets) {
      const goal = nearestRoadPosition(PARK.roads, target);
      expect(findRoute(PARK.roads, start, goal).at(-1)).toEqual(goal.point);
    }
  });

  it('keeps pen fences off the roads', () => {
    for (const pen of PARK.pens) {
      for (const post of fencePosts(pen)) {
        expect(nearestRoadPosition(PARK.roads, post).distance).toBeGreaterThan(ROAD_WIDTH / 2);
      }
    }
  });
});
