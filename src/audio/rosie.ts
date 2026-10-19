import type { LineId } from '../core/rosie';
import type { Mixer } from './mixer';

/**
 * Ranger Rosie's recorded lines, from `scripts/generate-rosie.ts`, found at build time. A line with no recording
 * yet is simply silent, and nothing is fetched for it.
 */
const CLIPS = import.meta.glob<string>('../assets/voice/*.mp3', { query: '?url', import: 'default', eager: true });

export interface RosieVoice {
  /** Says `line` on the voice bus: now, or straight after what she's saying. Only the latest waiting line is kept. */
  say(line: LineId): void;
}

export function createRosieVoice(mixer: Mixer): RosieVoice {
  const decoded = new Map<string, Promise<AudioBuffer | null>>();
  let speaking = false;
  let waiting: LineId | null = null;

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
    const line = waiting;
    waiting = null;
    if (line) {
      speak(line);
    }
  }

  function speak(line: LineId): void {
    const url = CLIPS[`../assets/voice/${line}.mp3`];
    if (!url) {
      return;
    }
    speaking = true;
    void load(url).then((buffer) => {
      if (!buffer) {
        speaking = false;
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
    });
  }

  return {
    say(line) {
      if (speaking) {
        waiting = line;
      } else {
        speak(line);
      }
    },
  };
}
