/** The three audio buses from docs/design.md §6, each with its own volume for the parent area to set. */
export type Bus = 'music' | 'effects' | 'voice';

export interface Mixer {
  readonly context: AudioContext;
  readonly buses: Readonly<Record<Bus, GainNode>>;
  /** False until the browser lets sound play. */
  readonly running: boolean;
  /**
   * Starts sound. Browsers keep audio silent until a user gesture, so call this from one. For touch, only the release
   * counts (`pointerup`, not `pointerdown`), so unlock on both.
   */
  unlock(): void;
  dispose(): void;
}

export function createMixer(): Mixer {
  const context = new AudioContext();
  const bus = () => {
    const gain = context.createGain();
    gain.connect(context.destination);
    return gain;
  };
  const buses = { music: bus(), effects: bus(), voice: bus() };
  return {
    context,
    buses,
    get running() {
      return context.state === 'running';
    },
    unlock() {
      if (context.state === 'suspended') {
        void context.resume();
      }
    },
    dispose() {
      void context.close();
    },
  };
}
