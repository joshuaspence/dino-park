import { describe, expect, it } from 'vitest';

import { CRUISE_SPEED, angleBetween, driveAlong, headingTowards, parkedJeep, stepJeep } from './jeep';
import type { Point } from './roads';

const STEP = 1 / 60;

function drive(route: Point[], seconds: number) {
  let jeep = driveAlong(parkedJeep({ x: 0, z: 0 }), route);
  let topSpeed = 0;
  for (let t = 0; t < seconds; t += STEP) {
    jeep = stepJeep(jeep, STEP);
    topSpeed = Math.max(topSpeed, jeep.speed);
  }
  return { jeep, topSpeed };
}

describe('headings', () => {
  it('faces +z at 0 and +x at π/2', () => {
    expect(headingTowards({ x: 0, z: 0 }, { x: 0, z: 1 })).toBeCloseTo(0);
    expect(headingTowards({ x: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(Math.PI / 2);
  });

  it('turns the short way', () => {
    expect(angleBetween(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(angleBetween(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleBetween(0, Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe('stepJeep', () => {
  it('stays parked without a route', () => {
    const jeep = parkedJeep({ x: 1, z: 2 }, 0.5);
    expect(stepJeep(jeep, 1)).toEqual(jeep);
  });

  it('drives to the end of its route and stops there', () => {
    const { jeep, topSpeed } = drive(
      [
        { x: 0, z: 0 },
        { x: 0, z: 20 },
        { x: 10, z: 20 },
      ],
      10,
    );
    expect(jeep.position.x).toBeCloseTo(10);
    expect(jeep.position.z).toBeCloseTo(20);
    expect(jeep.route).toEqual([]);
    expect(jeep.speed).toBe(0);
    expect(topSpeed).toBeLessThanOrEqual(CRUISE_SPEED);
    expect(topSpeed).toBeGreaterThan(CRUISE_SPEED * 0.9);
  });

  it('takes a believable time to get there', () => {
    // 30 m at up to 6 m/s, easing in and out: more than 5 s, less than 8 s.
    const route = [
      { x: 0, z: 0 },
      { x: 0, z: 30 },
    ];
    expect(drive(route, 5).jeep.route).not.toEqual([]);
    expect(drive(route, 8).jeep.route).toEqual([]);
  });

  it('slows down before arriving', () => {
    let jeep = driveAlong(parkedJeep({ x: 0, z: 0 }), [{ x: 0, z: 30 }]);
    const speeds: number[] = [];
    while (jeep.route.length > 0) {
      jeep = stepJeep(jeep, STEP);
      speeds.push(jeep.speed);
    }
    const nearlyThere = speeds.at(-3) ?? 0;
    expect(nearlyThere).toBeLessThan(2);
  });

  it('turns its body gradually towards the road ahead', () => {
    let jeep = driveAlong(parkedJeep({ x: 0, z: 0 }, 0), [{ x: 30, z: 0 }]);
    jeep = stepJeep(jeep, 0.1);
    expect(jeep.heading).toBeGreaterThan(0);
    expect(jeep.heading).toBeLessThan(Math.PI / 2);
    for (let i = 0; i < 60; i++) {
      jeep = stepJeep(jeep, STEP);
    }
    expect(jeep.heading).toBeCloseTo(Math.PI / 2);
  });

  it('finishes turning after a short trip that ends straight after a sharp turn', () => {
    // Facing east, sent 0.5 m west: a half turn takes longer than the trip, so it must carry on once parked.
    let jeep = driveAlong(parkedJeep({ x: 0, z: 24 }, Math.PI / 2), [{ x: -0.5, z: 24 }]);
    while (jeep.route.length > 0) {
      jeep = stepJeep(jeep, STEP);
    }
    expect(Math.abs(angleBetween(jeep.heading, -Math.PI / 2))).toBeGreaterThan(0.1);
    for (let i = 0; i < 60; i++) {
      jeep = stepJeep(jeep, STEP);
    }
    expect(angleBetween(jeep.heading, -Math.PI / 2)).toBeCloseTo(0);
    expect(jeep.position).toEqual({ x: -0.5, z: 24 });
  });

  it('keeps its speed when given a new route ahead mid-drive', () => {
    let jeep = drive([{ x: 0, z: 30 }], 2).jeep;
    const speed = jeep.speed;
    jeep = driveAlong(jeep, [jeep.position, { x: 5, z: 40 }]);
    expect(jeep.speed).toBe(speed);
    expect(jeep.route).toEqual([{ x: 5, z: 40 }]);
  });

  it('stops before turning round when a new route doubles back', () => {
    let jeep = drive([{ x: 0, z: 30 }], 2).jeep;
    jeep = driveAlong(jeep, [jeep.position, { x: 0, z: 0 }]);
    expect(jeep.speed).toBe(0);
    expect(jeep.route).toEqual([{ x: 0, z: 0 }]);
  });

  it('brakes smoothly when a new route ends closer than its usual stopping distance', () => {
    let jeep = drive([{ x: 0, z: 100 }], 3).jeep;
    expect(jeep.speed).toBe(CRUISE_SPEED);
    jeep = driveAlong(jeep, [{ x: 0, z: jeep.position.z + 1 }]);
    let lastSpeed = jeep.speed;
    while (jeep.route.length > 0) {
      jeep = stepJeep(jeep, STEP);
      lastSpeed = jeep.route.length > 0 ? jeep.speed : lastSpeed;
    }
    expect(lastSpeed).toBeLessThan(1);
  });
});
