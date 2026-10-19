import { describe, expect, it } from 'vitest';

import { subjectAt } from './inspect';
import { PARK } from './park';

const pen = (species: string) => {
  const found = PARK.pens.find((candidate) => candidate.species === species);
  if (!found) {
    throw new Error(`No ${species} pen`);
  }
  return found;
};

describe('what a double tap opens', () => {
  it('opens the card of the dinosaur whose pen it lands in', () => {
    const rex = pen('trex');
    expect(subjectAt(PARK, rex.position, 0)).toEqual({ dinosaur: 'trex' });
    // Anywhere in the pen, right up to the fence.
    const corner = { x: rex.position.x + rex.halfSize.x, z: rex.position.z - rex.halfSize.z };
    expect(subjectAt(PARK, corner, 0)).toEqual({ dinosaur: 'trex' });
    expect(subjectAt(PARK, { x: corner.x + 0.5, z: corner.z }, 0)).toBeNull();
  });

  it('opens nothing on the road, or in a pen whose dinosaur has not hatched', () => {
    expect(subjectAt(PARK, PARK.start, 0)).toBeNull();
    const raptors = pen('velociraptor');
    expect(subjectAt(PARK, raptors.position, 0)).toBeNull();
    expect(subjectAt(PARK, raptors.position, 1)).toEqual({ dinosaur: 'velociraptor' });
  });
});
