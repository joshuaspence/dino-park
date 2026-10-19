import type { Mixer } from './mixer';

/** Quiet under everything else: the music is a backdrop, not a feature. */
const VOLUME = 0.35;
const FADE_IN_SECONDS = 2;

/**
 * Gentle looping background music on the music bus (docs/design.md §6). It streams through an `<audio>` element
 * rather than a decoded buffer, which would hold about 40 MB of samples for a two-minute track on a budget tablet.
 * It starts once sound is first allowed, and the mixer's suspend while hidden quietens it like everything else.
 */
export function startMusic(mixer: Mixer): { stop(): void } {
  const { context } = mixer;
  const element = new Audio(`${import.meta.env.BASE_URL}audio/music/park.mp3`);
  element.loop = true;
  const level = context.createGain();
  level.gain.value = 0;
  context.createMediaElementSource(element).connect(level).connect(mixer.buses.music);

  let started = false;
  const start = () => {
    if (started || context.state !== 'running') {
      return;
    }
    started = true;
    level.gain.setTargetAtTime(VOLUME, context.currentTime, FADE_IN_SECONDS / 3);
    element.play().catch((error: unknown) => {
      // Refused, most likely for want of a gesture yet: try again the next time sound starts.
      started = false;
      console.warn('Could not start the music', error);
    });
  };
  context.addEventListener('statechange', start);
  start();

  return {
    stop() {
      context.removeEventListener('statechange', start);
      element.pause();
    },
  };
}
