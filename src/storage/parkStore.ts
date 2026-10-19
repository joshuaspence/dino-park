import { get, set } from 'idb-keyval';

import { type SavedPark, readSave } from '../core/save';
import { type Settings, readSettings } from '../core/settings';

const KEY = 'park';
const SETTINGS_KEY = 'settings';

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

/** The parent area's settings, stored apart from the park so resetting the park keeps them. */
export async function loadSettings(): Promise<Settings> {
  try {
    return readSettings(await get(SETTINGS_KEY));
  } catch (error) {
    console.warn('Could not load the settings', error);
    return readSettings(undefined);
  }
}

export async function storeSettings(settings: Settings): Promise<void> {
  try {
    await set(SETTINGS_KEY, settings);
  } catch (error) {
    console.warn('Could not save the settings', error);
  }
}
