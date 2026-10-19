import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, readSettings } from './settings';

describe('readSettings', () => {
  it('reads stored volumes', () => {
    expect(readSettings({ volumes: { music: 0.2, effects: 0.5, voice: 0 } })).toEqual({
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
});
