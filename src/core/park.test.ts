import { describe, expect, it } from 'vitest';

import { NEED_KINDS, supplyFor, visitedPlace } from './needs';
import { MAX_REACH, PARK, type Pen, ROAD_WIDTH, penGate } from './park';
import { type Point, findRoute, nearestRoadPosition } from './roads';
import { LAUNCH_SPECIES } from './species';

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

  it('is visiting each station and pen when parked at the road nearest it', () => {
    for (const station of PARK.stations) {
      const stop = nearestRoadPosition(PARK.roads, station.position).point;
      expect(visitedPlace(PARK, stop)?.station).toBe(station);
    }
    for (const pen of PARK.pens) {
      const stop = nearestRoadPosition(PARK.roads, penGate(pen)).point;
      expect(visitedPlace(PARK, stop)?.pen).toBe(pen);
    }
  });

  it('puts every pen gate and station within reach of a road', () => {
    for (const pen of PARK.pens) {
      expect(nearestRoadPosition(PARK.roads, penGate(pen)).distance).toBeLessThanOrEqual(MAX_REACH);
    }
    for (const station of PARK.stations) {
      expect(nearestRoadPosition(PARK.roads, station.position).distance).toBeLessThanOrEqual(MAX_REACH);
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
