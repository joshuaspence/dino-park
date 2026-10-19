import type { LineId } from '../core/rosie';
import type { Mixer } from './mixer';

/**
 * Ranger Rosie's recorded lines, from `scripts/generate-rosie.ts`, found at build time. A line with no recording
 * yet is simply silent, and nothing is fetched for it.
 */
const CLIPS = import.meta.glob<string>('../assets/voice/*.mp3', { query: '?url', import: 'default', eager: true });

/** A line for Rosie to say. `onStart` hears how long it lasts when she starts it, or 0 when it has no recording. */
export interface Spoken {
  readonly line: LineId;
  readonly onStart?: (seconds: number) => void;
}

export interface RosieVoice {
  /**
   * Says `lines` in turn on the voice bus: now, or straight after the line she's saying. Lines given later replace
   * any still waiting, so she never falls behind the game.
   */
  say(lines: readonly Spoken[]): void;
  /** True while she has a line to say or is saying one. */
  readonly speaking: boolean;
}

export function createRosieVoice(mixer: Mixer): RosieVoice {
  const decoded = new Map<string, Promise<AudioBuffer | null>>();
  let speaking = false;
  let waiting: Spoken[] = [];

  function load(url: string): Promise<AudioBuffer | null> {
    let buffer = decoded.get(url);
    if (!buffer) {
      buffer = fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => mixer.context.decodeAudioData(data))
        .catch((error: unknown) => {
          console.warn(`Could not load Rosie's line ${url}`, error);
          return null;
        });
      decoded.set(url, buffer);
    }
    return buffer;
  }

  function next(): void {
    const spoken = waiting.shift();
    if (!spoken) {
      return;
    }
    const url = CLIPS[`../assets/voice/${spoken.line}.mp3`];
    if (!url) {
      spoken.onStart?.(0);
      next();
      return;
    }
    speaking = true;
    void load(url).then((buffer) => {
      if (!buffer) {
        speaking = false;
        spoken.onStart?.(0);
        next();
        return;
      }
      const source = mixer.context.createBufferSource();
      source.buffer = buffer;
      source.connect(mixer.buses.voice);
      source.onended = () => {
        speaking = false;
        next();
      };
      source.start();
      spoken.onStart?.(buffer.duration);
    });
  }

  return {
    say(lines) {
      waiting = [...lines];
      if (!speaking) {
        next();
      }
    },
    get speaking() {
      return speaking || waiting.length > 0;
    },
  };
}
