import { type Care, FIRST_NEED_SECONDS, inTutorial, tutorialStep } from './needs';
import type { Point } from './roads';

/**
 * The guided tour (docs/design.md §6): Ranger Rosie walks a new player through one full round, from driving the jeep
 * to delivering a toy and what the egg is for. It runs until the first need is met, as the tutorial does.
 */

/**
 * The tour's first ask: drive up the middle road to here. It's in view from where the jeep starts, and further than a
 * visit's reach from every station, gate and the nest, so the first drive is only about driving.
 */
export const FIRST_DRIVE: Point = { x: 0, z: 12 };

/** What the tour has the child tap next: the road, the station with the supply, or the dinosaur's pen. */
export type TourStep = 'drive' | 'station' | 'pen';

/**
 * The tour's step, given whether the child has driven yet this time the game is open. Null outside the tour, and
 * between driving and the first need.
 */
export function tourStep(care: Care, driven: boolean): TourStep | null {
  if (!inTutorial(care)) {
    return null;
  }
  return driven ? tutorialStep(care) : 'drive';
}

/** Holds the first need back until the child has driven, so the tour teaches one thing at a time. */
export function holdUntilDriven(care: Care, driven: boolean): Care {
  if (driven || !inTutorial(care) || care.untilNextNeed >= FIRST_NEED_SECONDS) {
    return care;
  }
  return { ...care, untilNextNeed: FIRST_NEED_SECONDS };
}
