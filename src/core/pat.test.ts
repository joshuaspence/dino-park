import { describe, expect, it } from 'vitest';

import { PARK, penGate } from './park';
import { patAt } from './pat';

const pen = (species: string) => {
  const found = PARK.pens.find((candidate) => candidate.species === species);
  if (!found) {
    throw new Error(`No ${species} pen`);
  }
  return found;
};

describe('patting a dinosaur', () => {
  const rex = pen('trex');
  const atGate = { position: penGate(rex), parked: true };

  it('pats the dinosaur whose pen the tap lands in, with the jeep stopped at its gate', () => {
    expect(patAt(PARK, rex.position, atGate, 0)).toBe('trex');
    const corner = { x: rex.position.x + rex.halfSize.x, z: rex.position.z - rex.halfSize.z };
    expect(patAt(PARK, corner, atGate, 0)).toBe('trex');
  });

  it('pats nobody while the jeep is moving, or from somewhere else', () => {
    expect(patAt(PARK, rex.position, { ...atGate, parked: false }, 0)).toBeNull();
    expect(patAt(PARK, rex.position, { position: PARK.start, parked: true }, 0)).toBeNull();
    // At Rex's gate, a tap in another pen or on the road pats nobody.
    expect(patAt(PARK, pen('triceratops').position, atGate, 0)).toBeNull();
    const road = { x: penGate(rex).x, z: penGate(rex).z - 3 };
    expect(patAt(PARK, road, atGate, 0)).toBeNull();
  });

  it("pats nobody in a pen whose dinosaur hasn't hatched", () => {
    const raptors = pen('velociraptor');
    const atRaptors = { position: penGate(raptors), parked: true };
    expect(patAt(PARK, raptors.position, atRaptors, 0)).toBeNull();
    expect(patAt(PARK, raptors.position, atRaptors, 1)).toBe('velociraptor');
  });
});
