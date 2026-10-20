import { type Care, type CareEvent, inTutorial, supplyFor } from './needs';
import type { StationKind } from './park';
import type { SpeciesId } from './species';

/**
 * Close-ups (docs/design.md §3): after some deliveries the camera moves in on the dinosaur for a little game with it.
 * The delivery has already met the need, so a close-up is all reward: it can't be got wrong, it ends by itself once
 * done or left alone, and a grown-up or child can leave it at any time.
 */
export type CloseUpKind = 'feed' | 'wash';

export interface CloseUp {
  readonly kind: CloseUpKind;
  readonly species: SpeciesId;
  /** What the child gives it: the supply just delivered. */
  readonly item: StationKind;
  /** Bites taken, or mud splats washed off, so far. */
  readonly done: number;
  /** Seconds since the child last did anything in it. */
  readonly idle: number;
}

/** How many times the child does the close-up's one thing before it's finished. */
export const CLOSE_UP_GOALS: Readonly<Record<CloseUpKind, number>> = { feed: 3, wash: 5 };

/** A close-up left alone this long, in seconds, ends by itself, so a child who wanders off finds the park. */
export const CLOSE_UP_IDLE_SECONDS = 15;

/**
 * The close-up a care event opens, if any: feeding by hand after food or a drink is delivered, and washing off the
 * mud after the bubble bath. Not for the tour's delivery, which goes on to explain the egg.
 */
export function closeUpAfter(event: CareEvent, after: Care): CloseUp | null {
  if (event.type !== 'deliver' || inTutorial({ ...after, needsMet: after.needsMet - 1 })) {
    return null;
  }
  const kind = event.kind === 'hungry' || event.kind === 'thirsty' ? 'feed' : event.kind === 'dirty' ? 'wash' : null;
  return kind && { kind, species: event.species, item: supplyFor(event.kind, event.species), done: 0, idle: 0 };
}

/** `closeUp` after `seconds` more, or null once it has been left alone too long. */
export function stepCloseUp(closeUp: CloseUp, seconds: number): CloseUp | null {
  const idle = closeUp.idle + seconds;
  return idle >= CLOSE_UP_IDLE_SECONDS ? null : { ...closeUp, idle };
}

/** `closeUp` after the child does anything in it, so a child still trying isn't sent back to the park. */
export function touchCloseUp(closeUp: CloseUp): CloseUp {
  return { ...closeUp, idle: 0 };
}

/** `closeUp` after the child does its thing once more. */
export function progressCloseUp(closeUp: CloseUp): CloseUp {
  return { ...closeUp, done: Math.min(closeUp.done + 1, CLOSE_UP_GOALS[closeUp.kind]), idle: 0 };
}

export function closeUpFinished(closeUp: CloseUp): boolean {
  return closeUp.done >= CLOSE_UP_GOALS[closeUp.kind];
}
