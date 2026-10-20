import { useSyncExternalStore } from 'react';

import { strings } from './strings';

/** Chrome's `beforeinstallprompt` event, which isn't in the DOM types. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/**
 * Whether the game can be installed here: `ready` once the browser has offered it, `installed` once it's on this
 * device (the browser won't offer it again then). Browsers that don't say (Safari, Firefox) stay `unknown`.
 */
type InstallState = 'unknown' | 'ready' | 'installed';

let offer: InstallPromptEvent | null = null;
let state: InstallState = 'unknown';
const listeners = new Set<() => void>();

function setState(next: InstallState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

// Listened for as soon as the game loads, since the browser offers to install it only once a load.
window.addEventListener('beforeinstallprompt', (event) => {
  // Our own button, in the parent area, stands in for Chrome's banner, which shows only now and then.
  event.preventDefault();
  offer = event as InstallPromptEvent;
  setState('ready');
});
window.addEventListener('appinstalled', () => {
  offer = null;
  setState('installed');
});
// The manifest lists the game as its own related app, so Chrome on Android can say whether it's installed: Chrome's
// menu then offers to open the app, which is easy to miss (docs/design.md §11).
(navigator as Navigator & { getInstalledRelatedApps?: () => Promise<readonly unknown[]> })
  .getInstalledRelatedApps?.()
  .then((apps) => {
    if (apps.length > 0 && state === 'unknown') {
      setState('installed');
    }
  })
  .catch(() => undefined);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Offers a grown-up to install the game when the browser allows it, or says where to find it once it's installed.
 * Nothing shows in the installed app itself, which runs full screen, or in a browser that doesn't say.
 */
export function InstallPrompt() {
  const current = useSyncExternalStore(subscribe, () => state);

  if (current === 'unknown' || window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) {
    return null;
  }
  if (current === 'installed') {
    return (
      <p className="parent-install" role="status">
        {strings.installed}
      </p>
    );
  }
  return (
    <p className="parent-install">
      {strings.installOffer}{' '}
      <button
        type="button"
        onClick={() => {
          void offer?.prompt();
          // The browser's offer can be used only once; it fires another if it's turned down.
          offer = null;
          setState('unknown');
        }}
      >
        {strings.install}
      </button>
    </p>
  );
}
