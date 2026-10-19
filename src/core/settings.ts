/** The parent area's settings (docs/design.md §7), kept apart from the park so a reset leaves them alone. */
export type Bus = 'music' | 'effects' | 'voice';

export const BUSES: readonly Bus[] = ['music', 'effects', 'voice'];

export interface Settings {
  /** Each bus's volume, from 0 (silent) to 1 (full). */
  readonly volumes: Readonly<Record<Bus, number>>;
}

export const DEFAULT_SETTINGS: Settings = { volumes: { music: 1, effects: 1, voice: 1 } };

/** Reads stored settings, never throwing: anything missing or malformed falls back to its default. */
export function readSettings(stored: unknown): Settings {
  const volumes = (typeof stored === 'object' && stored !== null && (stored as Record<string, unknown>).volumes) || {};
  const volume = (bus: Bus) => {
    const value = (volumes as Record<string, unknown>)[bus];
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(1, Math.max(0, value))
      : DEFAULT_SETTINGS.volumes[bus];
  };
  return { volumes: { music: volume('music'), effects: volume('effects'), voice: volume('voice') } };
}
