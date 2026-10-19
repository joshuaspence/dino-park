import { describe, expect, it } from 'vitest';

import { NEEDS_PER_EGG, eggProgress, startCare } from './needs';
import { PARK } from './park';
import { SAVE_VERSION, readSave, resumeCare, savePark } from './save';

describe('saving the park', () => {
  it('round-trips progress through the stored form', () => {
    const care = { ...startCare(PARK), needsMet: 12, eggsHatched: 2 };
    const stored: unknown = JSON.parse(JSON.stringify(savePark(care)));
    const saved = readSave(stored);
    expect(saved).toEqual(savePark(care));
    expect(resumeCare(PARK, saved === 'newer' ? null : saved)).toMatchObject({ needsMet: 12, eggsHatched: 2 });
  });

  it('starts a fresh park from nothing or anything malformed', () => {
    for (const stored of [
      undefined,
      null,
      'park',
      42,
      {},
      { version: SAVE_VERSION },
      { version: SAVE_VERSION, needsMet: -1, eggsHatched: 0 },
      { version: SAVE_VERSION, needsMet: 1.5, eggsHatched: 0 },
      { version: SAVE_VERSION, needsMet: '5', eggsHatched: 0 },
      { version: SAVE_VERSION, needsMet: Infinity, eggsHatched: 0 },
      { version: 0, needsMet: 5, eggsHatched: 1 },
    ]) {
      expect(readSave(stored)).toBeNull();
    }
    expect(resumeCare(PARK, null)).toEqual(startCare(PARK));
  });

  it('recognises a save from a newer version, so it can be left alone', () => {
    expect(readSave({ version: SAVE_VERSION + 1, anything: 'else' })).toBe('newer');
  });

  it('never resumes with more eggs hatched than needs met allow', () => {
    const saved = readSave({ version: SAVE_VERSION, needsMet: NEEDS_PER_EGG + 1, eggsHatched: 3 });
    expect(saved).toEqual({ version: SAVE_VERSION, needsMet: NEEDS_PER_EGG + 1, eggsHatched: 1 });
    expect(eggProgress(resumeCare(PARK, saved === 'newer' ? null : saved))).toBe(1);
  });
});
