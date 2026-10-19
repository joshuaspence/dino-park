import { describe, expect, it } from 'vitest';

import { FIRST_NEED_SECONDS, startCare, stepNeeds, visitedPlace } from './needs';
import { PARK } from './park';
import { nearestRoadPosition } from './roads';
import { FIRST_DRIVE, holdUntilDriven, tourStep } from './tour';

const away = { position: { x: 0, z: 0 }, parked: false };

describe('the guided tour', () => {
  it('first asks for a drive to a spot on the road that visits nothing', () => {
    expect(nearestRoadPosition(PARK.roads, FIRST_DRIVE).distance).toBeLessThan(1e-6);
    expect(visitedPlace(PARK, FIRST_DRIVE)).toBeUndefined();
  });

  it('holds the first need back until the child has driven', () => {
    let care = startCare(PARK);
    for (let t = 0; t < 30; t++) {
      care = stepNeeds(holdUntilDriven(care, false), PARK, away, 1).care;
    }
    expect(care.residents.some((resident) => resident.need)).toBe(false);
    expect(tourStep(care, false)).toBe('drive');

    // Once they have, the first need comes as quickly as ever.
    const { events } = stepNeeds(holdUntilDriven(care, true), PARK, away, FIRST_NEED_SECONDS);
    expect(events).toEqual([{ type: 'need', species: 'stegosaurus', kind: 'bored' }]);
  });

  it('steps from the road to the toy shed to Steggy, and ends with the first delivery', () => {
    const fresh = startCare(PARK);
    expect(tourStep(fresh, true)).toBeNull();
    const bored = stepNeeds(fresh, PARK, away, FIRST_NEED_SECONDS).care;
    expect(tourStep(bored, true)).toBe('station');
    expect(tourStep({ ...bored, cargo: 'toys' }, true)).toBe('pen');
    expect(tourStep({ ...bored, needsMet: 1 }, true)).toBeNull();
    // A park with progress has nothing to tour, driven or not.
    expect(tourStep({ ...fresh, needsMet: 3 }, false)).toBeNull();
    expect(holdUntilDriven({ ...fresh, needsMet: 3, untilNextNeed: 1 }, false).untilNextNeed).toBe(1);
  });
});
