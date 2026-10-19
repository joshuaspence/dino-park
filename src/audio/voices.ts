import type { SpeciesId } from '../core/species';
import type { Mixer } from './mixer';

/**
 * Each dinosaur's own call (docs/design.md §6), so a child can hear who needs help. One recording per species
 * (scripts/import-sounds.mjs) serves every moment, played faster and higher when the dinosaur is pleased.
 */
export type Moment = 'need' | 'helped';

/** How each recording is pitched to suit its dinosaur: the snorts go deeper, the raptors' squeak goes higher. */
const RATES: Partial<Readonly<Record<SpeciesId, number>>> = {
  trex: 1,
  stegosaurus: 1.1,
  brontosaurus: 0.85,
  triceratops: 0.8,
  velociraptor: 1.3,
};
const MOMENT_RATES: Readonly<Record<Moment, number>> = { need: 1, helped: 1.25 };
const VOLUME = 0.5;

export interface Voices {
  /** Plays `species`'s call for `moment`, or nothing if it has no recording or hasn't loaded yet. */
  play(species: SpeciesId, moment: Moment): void;
}

export function loadVoices(mixer: Mixer): Voices {
  const calls = new Map<SpeciesId, AudioBuffer>();
  for (const species of Object.keys(RATES) as SpeciesId[]) {
    void fetch(`${import.meta.env.BASE_URL}audio/dinos/${species}.mp3`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((data) => mixer.context.decodeAudioData(data))
      .then((buffer) => calls.set(species, buffer))
      .catch((error: unknown) => console.warn(`Could not load the ${species}'s call`, error));
  }
  return {
    play(species, moment) {
      const buffer = calls.get(species);
      if (!buffer) {
        return;
      }
      const { context } = mixer;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = (RATES[species] ?? 1) * MOMENT_RATES[moment];
      const level = context.createGain();
      level.gain.value = VOLUME;
      source.connect(level).connect(mixer.buses.effects);
      source.start();
    },
  };
}
