import { describe, expect, it } from 'vitest';

import { LAUNCH_SPECIES, SPECIES, UNLOCK_ORDER, speciesInPark } from './species';

describe('species', () => {
  it('keys every species by its own ID', () => {
    for (const [id, species] of Object.entries(SPECIES)) {
      expect(species.id).toBe(id);
    }
  });

  it('lists every species exactly once across launch and unlocks', () => {
    const all = [...LAUNCH_SPECIES, ...UNLOCK_ORDER];
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(Object.keys(SPECIES)));
  });

  it('gives every launch species a model', () => {
    for (const id of LAUNCH_SPECIES) {
      expect(SPECIES[id].model).not.toBeNull();
    }
  });

  it('starts with the four launch dinosaurs', () => {
    expect(speciesInPark(0)).toEqual(['triceratops', 'brontosaurus', 'stegosaurus', 'trex']);
  });

  it('adds the Velociraptors first, then the Pterodactyl', () => {
    expect(speciesInPark(1).at(-1)).toBe('velociraptor');
    expect(speciesInPark(2).at(-1)).toBe('pterodactyl');
  });

  it('stops growing once everything has hatched', () => {
    expect(speciesInPark(99)).toEqual(speciesInPark(UNLOCK_ORDER.length));
  });

  it('treats nonsense counts as zero', () => {
    expect(speciesInPark(-1)).toEqual(speciesInPark(0));
    expect(speciesInPark(Number.NaN)).toEqual(speciesInPark(0));
  });
});
