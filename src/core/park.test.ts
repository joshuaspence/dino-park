import { describe, expect, it } from 'vitest';

import { MAX_REACH, PARK, penGate } from './park';
import { findRoute, nearestRoadPosition } from './roads';
import { LAUNCH_SPECIES } from './species';

describe('PARK', () => {
  it('only joins nodes that exist', () => {
    for (const [a, b] of PARK.roads.edges) {
      expect(PARK.roads.nodes.has(a)).toBe(true);
      expect(PARK.roads.nodes.has(b)).toBe(true);
    }
  });

  it('has a pen for every launch dinosaur and every kind of station', () => {
    expect(PARK.pens.map((pen) => pen.species).sort()).toEqual([...LAUNCH_SPECIES].sort());
    expect(new Set(PARK.stations.map((station) => station.kind)).size).toBe(6);
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

  it('keeps pens off the roads', () => {
    for (const pen of PARK.pens) {
      expect(nearestRoadPosition(PARK.roads, pen.position).distance).toBeGreaterThan(
        Math.min(pen.halfSize.x, pen.halfSize.z),
      );
    }
  });
});
