import { describe, expect, it } from 'vitest';

import { type Care, type CareEvent, NEEDS_PER_EGG, NEED_KINDS, startCare } from './needs';
import { PARK, type StationKind } from './park';
import { rosieLines, rosieSays, welcomeLine } from './rosie';
import { LAUNCH_SPECIES, type SpeciesId, UNLOCK_ORDER } from './species';

const fresh = startCare(PARK);
const played: Care = { ...fresh, needsMet: 2 };
/** The tutorial under way: Steggy is bored. */
const bored: Care = {
  ...fresh,
  residents: fresh.residents.map((resident) =>
    resident.species === 'stegosaurus' ? { ...resident, need: { kind: 'bored', age: 0 } } : resident,
  ),
};
const STATIONS: readonly StationKind[] = ['hay', 'meat', 'fish', 'water', 'bath', 'toys', 'vet'];

describe('Ranger Rosie', () => {
  it('has a recording to say for every line she can choose', () => {
    const lines = rosieLines();
    const species: (SpeciesId | null)[] = [...LAUNCH_SPECIES, ...UNLOCK_ORDER, null];
    const events: CareEvent[] = [
      ...species.flatMap((id) =>
        id ? NEED_KINDS.flatMap((kind) => [{ type: 'need' as const, species: id, kind }]) : [],
      ),
      ...STATIONS.map((cargo) => ({ type: 'load' as const, cargo })),
      ...species.map((id) => ({ type: 'hatch' as const, species: id })),
      { type: 'deliver', species: 'trex', kind: 'hungry' },
    ];
    for (const after of [fresh, { ...fresh, needsMet: 1 }, played, { ...played, needsMet: NEEDS_PER_EGG }]) {
      for (const event of events) {
        const line = rosieSays(event, after);
        expect(line && lines.get(line), `${JSON.stringify(event)} after ${after.needsMet} met`).toBeTruthy();
      }
    }
    expect(lines.get(welcomeLine(fresh))).toBeTruthy();
    expect(lines.get(welcomeLine(played))).toBeTruthy();
  });

  it('walks a new player through their first delivery', () => {
    expect(welcomeLine(fresh)).toBe('rosie.welcome');
    expect(rosieSays({ type: 'need', species: 'stegosaurus', kind: 'bored' }, bored)).toBe('rosie.tutorial.need');
    expect(rosieSays({ type: 'load', cargo: 'toys' }, { ...bored, cargo: 'toys' })).toBe('rosie.tutorial.load');
    // Loading the wrong thing gets the ordinary line, not "now tap Steggy".
    expect(rosieSays({ type: 'load', cargo: 'water' }, { ...bored, cargo: 'water' })).toBe('rosie.load.water');
    expect(rosieSays({ type: 'deliver', species: 'stegosaurus', kind: 'bored' }, { ...fresh, needsMet: 1 })).toBe(
      'rosie.tutorial.done',
    );
    expect(rosieLines().get('rosie.tutorial.need')).toBe('Steggy is bored! Tap the toy shed!');
    expect(rosieLines().get('rosie.tutorial.load')).toBe('Now tap Steggy!');
  });

  it("follows the tutorial's arrow when the toy is loaded before Steggy is bored", () => {
    // Nobody wants a toy yet, so there's no one to tap.
    expect(rosieSays({ type: 'load', cargo: 'toys' }, { ...fresh, cargo: 'toys' })).toBe('rosie.load.toys');
    // The toy is already on the jeep, so what's left is Steggy.
    expect(rosieSays({ type: 'need', species: 'stegosaurus', kind: 'bored' }, { ...bored, cargo: 'toys' })).toBe(
      'rosie.tutorial.load',
    );
  });

  it('names each dinosaur and what to fetch for it', () => {
    const lines = rosieLines();
    expect(lines.get('rosie.need.trex.hungry')).toBe("Rex is hungry! Let's get some meat!");
    expect(lines.get('rosie.need.brontosaurus.dirty')).toBe("Bruno is all muddy! Let's get the bubble bath!");
    // A pack is plural.
    expect(lines.get('rosie.need.velociraptor.bored')).toBe("The Raptors are bored! Let's get a toy!");
    expect(rosieSays({ type: 'need', species: 'trex', kind: 'hungry' }, played)).toBe('rosie.need.trex.hungry');
  });

  it('cheers deliveries, and points out a full egg instead', () => {
    expect(rosieSays({ type: 'deliver', species: 'trex', kind: 'hungry' }, played)).toMatch(/^rosie\.cheer\./);
    expect(
      rosieSays({ type: 'deliver', species: 'trex', kind: 'hungry' }, { ...played, needsMet: NEEDS_PER_EGG }),
    ).toBe('rosie.egg.ready');
  });

  it('welcomes the new dinosaur on a hatch, or a baby when there is no model yet', () => {
    expect(rosieSays({ type: 'hatch', species: 'velociraptor' }, played)).toBe('rosie.hatch.velociraptor');
    expect(rosieSays({ type: 'hatch', species: 'pterodactyl' }, played)).toBe('rosie.hatch.baby');
    expect(rosieSays({ type: 'hatch', species: null }, played)).toBe('rosie.hatch.baby');
    expect(welcomeLine(played)).toBe('rosie.welcome-back');
  });
});
