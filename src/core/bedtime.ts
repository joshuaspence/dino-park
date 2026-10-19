/**
 * The parent area's bedtime timer (docs/design.md §7). It counts only time the game is on screen, starts again each
 * time the game opens, and when it runs out the park goes to sleep until a grown-up wakes it.
 */

/** The lengths a grown-up can choose, in minutes; 0 is off. */
export const BEDTIME_CHOICES = [0, 10, 20, 30] as const;
export type BedtimeMinutes = (typeof BEDTIME_CHOICES)[number];

export interface Bedtime {
  /** Seconds played since the game opened or the park last woke. */
  readonly played: number;
  readonly asleep: boolean;
}

export const AWAKE: Bedtime = { played: 0, asleep: false };

/** True when `value` is one of the lengths on offer. */
export function isBedtimeMinutes(value: unknown): value is BedtimeMinutes {
  return BEDTIME_CHOICES.some((choice) => choice === value);
}

/**
 * Counts `seconds` of play towards `minutes`. `fellAsleep` is true only on the step that runs the timer out, so the
 * goodnight happens once. Turning the timer off, or choosing a longer one, never wakes a sleeping park: only `wake`
 * does that.
 */
export function stepBedtime(
  bedtime: Bedtime,
  minutes: BedtimeMinutes,
  seconds: number,
): { bedtime: Bedtime; fellAsleep: boolean } {
  if (bedtime.asleep || minutes === 0) {
    return { bedtime, fellAsleep: false };
  }
  const played = bedtime.played + Math.max(0, seconds);
  if (played >= minutes * 60) {
    return { bedtime: { played, asleep: true }, fellAsleep: true };
  }
  return { bedtime: { played, asleep: false }, fellAsleep: false };
}

/** A grown-up wakes the park, and the timer starts again from nothing. */
export function wake(): Bedtime {
  return AWAKE;
}
