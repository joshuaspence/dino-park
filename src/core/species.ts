/** The dinosaurs in the park, what they eat, and the order eggs unlock them in (docs/design.md §5). */
export type Diet = 'plants' | 'meat' | 'fish';

export type SpeciesId =
  'triceratops' | 'brontosaurus' | 'stegosaurus' | 'trex' | 'velociraptor' | 'pterodactyl' | 'ankylosaurus';

export interface Species {
  readonly id: SpeciesId;
  /** The resident's name, which is only ever spoken. */
  readonly residentName: string;
  readonly diet: Diet;
  /** How many live in one pen (raptors come as a pack). */
  readonly herdSize: number;
  /** Model file in public/models/dinos, or null while the species has no model yet. */
  readonly model: string | null;
}

export const SPECIES: Readonly<Record<SpeciesId, Species>> = {
  triceratops: { id: 'triceratops', residentName: 'Trixie', diet: 'plants', herdSize: 1, model: 'triceratops' },
  brontosaurus: { id: 'brontosaurus', residentName: 'Bruno', diet: 'plants', herdSize: 1, model: 'apatosaurus' },
  stegosaurus: { id: 'stegosaurus', residentName: 'Steggy', diet: 'plants', herdSize: 1, model: 'stegosaurus' },
  trex: { id: 'trex', residentName: 'Rex', diet: 'meat', herdSize: 1, model: 'trex' },
  velociraptor: { id: 'velociraptor', residentName: 'the Raptors', diet: 'meat', herdSize: 3, model: 'velociraptor' },
  pterodactyl: { id: 'pterodactyl', residentName: 'Pip', diet: 'fish', herdSize: 1, model: null },
  ankylosaurus: { id: 'ankylosaurus', residentName: 'Annie', diet: 'plants', herdSize: 1, model: null },
};

/** In the park from the very first play. */
export const LAUNCH_SPECIES: readonly SpeciesId[] = ['triceratops', 'brontosaurus', 'stegosaurus', 'trex'];

/** Hatched from eggs, in this order. */
export const UNLOCK_ORDER: readonly SpeciesId[] = ['velociraptor', 'pterodactyl', 'ankylosaurus'];

/** The species living in the park once `eggsHatched` eggs have hatched. */
export function speciesInPark(eggsHatched: number): SpeciesId[] {
  const count = Number.isFinite(eggsHatched) ? Math.max(0, Math.floor(eggsHatched)) : 0;
  return [...LAUNCH_SPECIES, ...UNLOCK_ORDER.slice(0, count)];
}
