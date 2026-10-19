import { get, set } from 'idb-keyval';

import { type SavedPark, readSave } from '../core/save';

const KEY = 'park';

/** Reads the saved park from IndexedDB, asking the browser to keep it (docs/design.md §2). */
export async function loadPark(): Promise<SavedPark | 'newer' | null> {
  // Without persistence the browser may clear the park under storage pressure; refusal changes nothing else.
  void navigator.storage?.persist?.().catch(() => false);
  try {
    return readSave(await get(KEY));
  } catch (error) {
    // Private browsing and some locked-down devices have no IndexedDB: play on with a fresh park.
    console.warn('Could not load the saved park', error);
    return null;
  }
}

export async function storePark(saved: SavedPark): Promise<void> {
  try {
    await set(KEY, saved);
  } catch (error) {
    console.warn('Could not save the park', error);
  }
}
