import type { Park } from './park';
import type { Point } from './roads';
import { type SpeciesId, speciesInPark } from './species';

/**
 * Something a double tap can open an info card about (docs/design.md §6). A single tap still drives, so a child who
 * taps a dinosaur to deliver to it isn't interrupted.
 */
export type Subject = { readonly dinosaur: SpeciesId };

/** What's at `point` on the ground, worth a card: the dinosaur whose pen it's in, once that dinosaur has hatched. */
export function subjectAt(park: Park, point: Point, eggsHatched: number): Subject | null {
  const inPark = speciesInPark(eggsHatched);
  const pen = park.pens.find(
    (candidate) =>
      Math.abs(point.x - candidate.position.x) <= candidate.halfSize.x &&
      Math.abs(point.z - candidate.position.z) <= candidate.halfSize.z,
  );
  return pen && inPark.includes(pen.species) ? { dinosaur: pen.species } : null;
}
