import { type Care, NEEDS_PER_EGG, startCare } from './needs';
import type { Park } from './park';

/**
 * The saved park (docs/design.md §2): progress only. Waiting needs and the jeep's cargo are moment-to-moment and
 * start afresh, since needs only advance while the game is open. Bump the version, and add a migration from the old
 * shape to `readSave`, whenever this changes.
 */
export interface SavedPark {
  readonly version: typeof SAVE_VERSION;
  readonly needsMet: number;
  readonly eggsHatched: number;
}

export const SAVE_VERSION = 1;

export function savePark(care: Care): SavedPark {
  return { version: SAVE_VERSION, needsMet: care.needsMet, eggsHatched: care.eggsHatched };
}

/**
 * Reads whatever was stored, never throwing: nothing or anything malformed is `null`, a fresh park. A save from a
 * newer version of the game is `'newer'`, which this version can't read and mustn't overwrite.
 */
export function readSave(stored: unknown): SavedPark | 'newer' | null {
  if (typeof stored !== 'object' || stored === null) {
    return null;
  }
  const { version, needsMet, eggsHatched } = stored as Record<string, unknown>;
  if (typeof version === 'number' && version > SAVE_VERSION) {
    return 'newer';
  }
  if (version !== SAVE_VERSION || !isCount(needsMet) || !isCount(eggsHatched)) {
    return null;
  }
  // Every hatched egg took a full egg's needs, which keeps the next egg's progress from going negative.
  return { version, needsMet, eggsHatched: Math.min(eggsHatched, Math.floor(needsMet / NEEDS_PER_EGG)) };
}

export function resumeCare(park: Park, saved: SavedPark | null): Care {
  const care = startCare(park);
  return saved ? { ...care, needsMet: saved.needsMet, eggsHatched: saved.eggsHatched } : care;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
