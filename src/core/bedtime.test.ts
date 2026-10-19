import { describe, expect, it } from 'vitest';

import { AWAKE, BEDTIME_CHOICES, isBedtimeMinutes, stepBedtime, wake } from './bedtime';

/** Plays `seconds` in 0.1 s frames, counting how many times the park fell asleep. */
function play(minutes: (typeof BEDTIME_CHOICES)[number], seconds: number, from = AWAKE) {
  let bedtime = from;
  let goodnights = 0;
  for (let t = 0; t < seconds; t += 0.1) {
    const step = stepBedtime(bedtime, minutes, 0.1);
    bedtime = step.bedtime;
    goodnights += step.fellAsleep ? 1 : 0;
  }
  return { bedtime, goodnights };
}

describe('bedtime', () => {
  it('offers off, 10, 20 and 30 minutes', () => {
    expect(BEDTIME_CHOICES).toEqual([0, 10, 20, 30]);
    expect(isBedtimeMinutes(20)).toBe(true);
    expect(isBedtimeMinutes(15)).toBe(false);
    expect(isBedtimeMinutes('10')).toBe(false);
  });

  it('never falls asleep when off', () => {
    expect(play(0, 3 * 60 * 60).bedtime).toEqual(AWAKE);
  });

  it('stays awake until the time is up', () => {
    const { bedtime, goodnights } = play(10, 10 * 60 - 1);
    expect(bedtime.asleep).toBe(false);
    expect(goodnights).toBe(0);
  });

  it('falls asleep once when the time runs out, and stays asleep', () => {
    const { bedtime, goodnights } = play(10, 15 * 60);
    expect(bedtime.asleep).toBe(true);
    expect(goodnights).toBe(1);
  });

  it('counts each length in minutes', () => {
    expect(play(20, 19.5 * 60).bedtime.asleep).toBe(false);
    expect(play(20, 20.1 * 60).bedtime.asleep).toBe(true);
    expect(play(30, 30.1 * 60).bedtime.asleep).toBe(true);
  });

  it('stays asleep when the timer is turned off or lengthened', () => {
    const asleep = play(10, 11 * 60).bedtime;
    expect(stepBedtime(asleep, 0, 1).bedtime.asleep).toBe(true);
    expect(stepBedtime(asleep, 30, 1).bedtime.asleep).toBe(true);
  });

  it('ignores negative time', () => {
    expect(stepBedtime(AWAKE, 10, -5).bedtime.played).toBe(0);
  });

  it('starts the count again when a grown-up wakes the park', () => {
    expect(wake()).toEqual({ played: 0, asleep: false });
    expect(play(10, 9 * 60, wake()).bedtime.asleep).toBe(false);
  });
});
