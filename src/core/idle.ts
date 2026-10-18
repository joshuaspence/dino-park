/** A gentle idle motion: a slow turn plus a happy bounce, as a pure function of time. */
export interface IdlePose {
  /** Height above the ground, in metres. */
  readonly lift: number;
  /** Heading around the vertical axis, in radians, in [0, 2π). */
  readonly heading: number;
  /** Vertical squash factor (1 = none), so landings look soft. */
  readonly squash: number;
}

const TURN_SECONDS = 12;
const BOUNCE_SECONDS = 0.9;
const BOUNCE_HEIGHT = 0.25;
const SQUASH_AMOUNT = 0.08;

export function idlePose(seconds: number): IdlePose {
  const turn = (((seconds / TURN_SECONDS) % 1) + 1) % 1;
  const phase = (((seconds / BOUNCE_SECONDS) % 1) + 1) % 1;
  // |sin| gives a hop that touches the ground once per cycle.
  const hop = Math.abs(Math.sin(phase * Math.PI));
  return {
    lift: hop * BOUNCE_HEIGHT,
    heading: turn * 2 * Math.PI,
    squash: 1 - (1 - hop) * SQUASH_AMOUNT,
  };
}
