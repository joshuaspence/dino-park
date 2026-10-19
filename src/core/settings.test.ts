import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, readSettings } from './settings';

describe('readSettings', () => {
  it('reads stored volumes', () => {
    expect(readSettings({ volumes: { music: 0.2, effects: 0.5, voice: 0 } })).toEqual({
      ...DEFAULT_SETTINGS,
      volumes: { music: 0.2, effects: 0.5, voice: 0 },
    });
  });

  it('falls back to full volume for anything missing or malformed', () => {
    for (const stored of [undefined, null, 'loud', {}, { volumes: null }, { volumes: { music: 'half' } }]) {
      expect(readSettings(stored)).toEqual(DEFAULT_SETTINGS);
    }
    expect(readSettings({ volumes: { music: Number.NaN, effects: 0.5 } }).volumes).toEqual({
      music: 1,
      effects: 0.5,
      voice: 1,
    });
  });

  it('keeps volumes between silent and full', () => {
    expect(readSettings({ volumes: { music: -1, effects: 7, voice: 0.5 } }).volumes).toEqual({
      music: 0,
      effects: 1,
      voice: 0.5,
    });
  });

  it('reads the bedtime timer and whether the park is asleep', () => {
    expect(readSettings({ bedtime: 20, asleep: true })).toEqual({ ...DEFAULT_SETTINGS, bedtime: 20, asleep: true });
  });

  it('turns an unknown bedtime off, and treats anything but true as awake', () => {
    for (const stored of [{ bedtime: 15 }, { bedtime: '10' }, { bedtime: -1 }, { asleep: 'yes' }, { asleep: 1 }]) {
      expect(readSettings(stored)).toEqual(DEFAULT_SETTINGS);
    }
  });
});
