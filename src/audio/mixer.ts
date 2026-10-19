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

/** A toy car's "beep-beep": two short, bright notes, synthesised rather than recorded. */
export function playHonk(mixer: Mixer): void {
  const { context } = mixer;
  const start = context.currentTime;
  const tone = context.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2200;
  tone.connect(mixer.buses.effects);
  for (const beep of [0, 0.22]) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start + beep);
    envelope.gain.linearRampToValueAtTime(0.25, start + beep + 0.02);
    envelope.gain.setValueAtTime(0.25, start + beep + 0.14);
    envelope.gain.linearRampToValueAtTime(0, start + beep + 0.18);
    envelope.connect(tone);
    // A major third apart, slightly detuned, for a friendly two-tone horn.
    for (const frequency of [392, 494]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = frequency === 392 ? -6 : 6;
      oscillator.connect(envelope);
      oscillator.start(start + beep);
      oscillator.stop(start + beep + 0.2);
    }
  }
}
