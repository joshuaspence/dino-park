import type { Mixer } from './mixer';

/** Quiet under everything else: the music is a backdrop, not a feature. */
const VOLUME = 0.35;
const FADE_IN_SECONDS = 2;
/** Bedtime fades the music out slowly, like a lullaby ending. */
const FADE_OUT_SECONDS = 4;

/**
 * Gentle looping background music on the music bus (docs/design.md §6). It streams through an `<audio>` element
 * rather than a decoded buffer, which would hold about 40 MB of samples for a two-minute track on a budget tablet.
 * It starts once sound is first allowed, and the mixer's suspend while hidden quietens it like everything else.
 * Whenever sound starts again it plays the element if it's paused, since the system can pause it from outside: iPadOS
 * when Safari goes to the background, Android from its media notification.
 */
export function startMusic(mixer: Mixer): { setPlaying(playing: boolean): void; stop(): void } {
  const { context } = mixer;
  const element = new Audio(`${import.meta.env.BASE_URL}audio/music/park.mp3`);
  element.loop = true;
  const level = context.createGain();
  level.gain.value = 0;
  /** False while the park is asleep: the music fades out, and stays out until the park wakes. */
  let playing = true;
  context.createMediaElementSource(element).connect(level).connect(mixer.buses.music);

  const start = () => {
    if (context.state !== 'running' || !element.paused) {
      return;
    }
    // Refused, most likely for want of a gesture yet: the next time sound starts tries again, and fades in then.
    element
      .play()
      .then(() => level.gain.setTargetAtTime(playing ? VOLUME : 0, context.currentTime, FADE_IN_SECONDS / 3))
      .catch((error: unknown) => console.warn('Could not start the music', error));
  };
  context.addEventListener('statechange', start);
  start();

  return {
    setPlaying(next) {
      playing = next;
      const seconds = next ? FADE_IN_SECONDS : FADE_OUT_SECONDS;
      level.gain.setTargetAtTime(next ? VOLUME : 0, context.currentTime, seconds / 3);
    },
    stop() {
      context.removeEventListener('statechange', start);
      element.pause();
    },
  };
}
