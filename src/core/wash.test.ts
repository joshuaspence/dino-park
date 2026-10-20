import { describe, expect, it } from 'vitest';

import { DAB, SCRUB_PX, scrub } from './wash';

describe('washing off the mud', () => {
  it('comes off as it is rubbed, and no further than clean', () => {
    expect(scrub(1, SCRUB_PX / 4)).toBeCloseTo(0.75);
    expect(scrub(0.1, SCRUB_PX)).toBe(0);
    expect(scrub(1, 0)).toBe(1);
  });

  it('comes off in two taps', () => {
    expect(scrub(1, 0, true)).toBe(1 - DAB);
    expect(scrub(scrub(1, 0, true), 0, true)).toBe(0);
  });
});
