import { type JeepAt, visitedPlace } from './needs';
import type { Park } from './park';
import type { Point } from './roads';
import { type SpeciesId, speciesInPark } from './species';

/**
 * Patting a dinosaur (docs/design.md §3): with the jeep stopped at a pen's gate, a tap on the dinosaur inside makes it
 * giggle and hop, with hearts. It's just for fun: it meets no need and fills no meter, so there's nothing to get
 * wrong, and a child who taps a dinosaur to deliver to it still delivers.
 */

/** A dinosaur can be patted again this soon, in seconds, so a flurry of taps is a run of hops rather than a blur. */
export const PAT_SECONDS = 0.8;

/** Rosie says something about a pat at most this often, in seconds, so tickling doesn't drown out the needs. */
export const PAT_TALK_SECONDS = 20;

/**
 * The dinosaur a tap at `point` on the ground pats, if any: one whose pen the tap is in, with the jeep stopped at that
 * pen's gate, once it has hatched.
 */
export function patAt(park: Park, point: Point, jeep: JeepAt, eggsHatched: number): SpeciesId | null {
  if (!jeep.parked) {
    return null;
  }
  const visit = visitedPlace(park, jeep.position);
  if (!visit || !('pen' in visit)) {
    return null;
  }
  const { pen } = visit;
  const inPen =
    Math.abs(point.x - pen.position.x) <= pen.halfSize.x && Math.abs(point.z - pen.position.z) <= pen.halfSize.z;
  return inPen && speciesInPark(eggsHatched).includes(pen.species) ? pen.species : null;
}
