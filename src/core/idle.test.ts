import { describe, expect, it } from 'vitest';

import { idlePose } from './idle';

describe('idlePose', () => {
  it('starts on the ground, facing forward, slightly squashed', () => {
    const pose = idlePose(0);
    expect(pose.lift).toBeCloseTo(0);
    expect(pose.heading).toBeCloseTo(0);
    expect(pose.squash).toBeCloseTo(0.92);
  });

  it('peaks halfway through a bounce, unsquashed', () => {
    const pose = idlePose(0.45);
    expect(pose.lift).toBeCloseTo(0.25);
    expect(pose.squash).toBeCloseTo(1);
  });

  it('stays within bounds for any time, including negative', () => {
    for (let t = -30; t <= 30; t += 0.37) {
      const pose = idlePose(t);
      expect(pose.lift).toBeGreaterThanOrEqual(0);
      expect(pose.lift).toBeLessThanOrEqual(0.25);
      expect(pose.heading).toBeGreaterThanOrEqual(0);
      expect(pose.heading).toBeLessThan(2 * Math.PI);
      expect(pose.squash).toBeGreaterThanOrEqual(0.92);
      expect(pose.squash).toBeLessThanOrEqual(1);
    }
  });

  it('repeats a full turn every 12 seconds', () => {
    expect(idlePose(12).heading).toBeCloseTo(idlePose(0).heading);
    expect(idlePose(3).heading).toBeCloseTo(Math.PI / 2);
  });
});
