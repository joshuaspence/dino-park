/**
 * Washing a dinosaur in a close-up (docs/design.md §3): the mud comes off in splats, each rubbed or dabbed away.
 */

/** Rubbing back and forth over a splat this far in all, in CSS pixels, washes it off. */
export const SCRUB_PX = 400;

/** A tap on a splat washes off this much of it, for children who can't rub yet: two taps and it's gone. */
export const DAB = 0.5;

/** How much of a splat's mud is left, from 1 to 0, after rubbing `rubbedPx` over it, or a tap on it. */
export function scrub(mud: number, rubbedPx: number, tapped = false): number {
  return Math.max(0, mud - rubbedPx / SCRUB_PX - (tapped ? DAB : 0));
}
