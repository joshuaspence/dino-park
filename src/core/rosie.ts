import {
  type Care,
  type CareEvent,
  NEED_KINDS,
  type NeedKind,
  TUTORIAL_NEED,
  eggReady,
  inTutorial,
  supplyFor,
} from './needs';
import type { StationKind } from './park';
import { LAUNCH_SPECIES, SPECIES, type SpeciesId, UNLOCK_ORDER } from './species';

/**
 * What Ranger Rosie says, and when (docs/design.md §6). Every line has an ID, which names its recording; the text is
 * what the recording says, in Australian English, built from the dinosaurs' names so a new species gets its lines for
 * free. Rosie only ever talks: she never takes control or blocks a tap.
 */
export type LineId = string;

const NEED_PHRASES: Readonly<Record<NeedKind, (subject: string, verb: string) => string>> = {
  hungry: (subject, verb) => `${subject} ${verb} hungry!`,
  thirsty: (subject, verb) => `${subject} ${verb} thirsty!`,
  dirty: (subject, verb) => `${subject} ${verb} all muddy!`,
  bored: (subject, verb) => `${subject} ${verb} bored!`,
  poorly: (subject, verb) => `${subject} ${verb} feeling poorly!`,
};

/** What fetching each station's supply sounds like, for "Let's get…" and "Got…". */
const SUPPLIES: Readonly<Record<StationKind, string>> = {
  hay: 'some hay',
  meat: 'some meat',
  fish: 'some fish',
  water: 'some water',
  bath: 'the bubble bath',
  toys: 'a toy',
  vet: 'the vet kit',
};

/** What each station is called, for the tutorial's "Tap the…". */
const STATION_NAMES: Readonly<Record<StationKind, string>> = {
  hay: 'haystack',
  meat: 'butcher',
  fish: 'fish pond',
  water: 'water tower',
  bath: 'bath',
  toys: 'toy shed',
  vet: 'vet tent',
};

const CHEERS = ['Hooray!', 'Yay, well done!', 'They love it!'];

/** The species Rosie can talk about: everyone who lives in the park now or will hatch into it. */
const SPECIES_SPOKEN_OF: readonly SpeciesId[] = [...LAUNCH_SPECIES, ...UNLOCK_ORDER];

function subject(species: SpeciesId): { name: string; verb: string } {
  const name = SPECIES[species].residentName;
  return { name: name.charAt(0).toUpperCase() + name.slice(1), verb: SPECIES[species].herdSize > 1 ? 'are' : 'is' };
}

/** Every line Rosie can say, by ID: the script that `scripts/generate-rosie.ts` records. */
export function rosieLines(): ReadonlyMap<LineId, string> {
  const tutee = subject(TUTORIAL_NEED.species);
  const tutorialStation = STATION_NAMES[supplyFor(TUTORIAL_NEED.kind, TUTORIAL_NEED.species)];
  const lines = new Map<LineId, string>([
    ['rosie.welcome', "Hi! I'm Ranger Rosie. Let's look after the dinosaurs!"],
    ['rosie.welcome-back', 'Welcome back! The dinosaurs missed you!'],
    ['rosie.tutorial.need', `${NEED_PHRASES[TUTORIAL_NEED.kind](tutee.name, tutee.verb)} Tap the ${tutorialStation}!`],
    ['rosie.tutorial.load', `Now tap ${tutee.name}!`],
    ['rosie.tutorial.done', `Hooray! You helped ${tutee.name}!`],
    ['rosie.egg.ready', "The egg's wobbling! Let's go to the nest!"],
    ['rosie.hatch.baby', 'Look, a baby dinosaur!'],
  ]);
  for (const species of SPECIES_SPOKEN_OF) {
    const { name, verb } = subject(species);
    for (const kind of NEED_KINDS) {
      const supply = SUPPLIES[supplyFor(kind, species)];
      lines.set(`rosie.need.${species}.${kind}`, `${NEED_PHRASES[kind](name, verb)} Let's get ${supply}!`);
    }
    lines.set(`rosie.hatch.${species}`, `Look, it's ${SPECIES[species].residentName}! Welcome to the park!`);
  }
  for (const [kind, supply] of Object.entries(SUPPLIES)) {
    lines.set(`rosie.load.${kind}`, `Got ${supply}!`);
  }
  CHEERS.forEach((cheer, i) => lines.set(`rosie.cheer.${i}`, cheer));
  return lines;
}

/** What Rosie says when the game starts: a hello for a new park, a welcome back for one with progress. */
export function welcomeLine(care: Care): LineId {
  return care.needsMet === 0 && care.eggsHatched === 0 ? 'rosie.welcome' : 'rosie.welcome-back';
}

/**
 * What Rosie says about `event`, given the park `after` it, or null to stay quiet. During the tutorial she tells the
 * child exactly what to tap; after it she names needs and supplies, cheers deliveries and points out a full egg.
 */
export function rosieSays(event: CareEvent, after: Care): LineId | null {
  switch (event.type) {
    case 'need':
      return inTutorial(after) ? 'rosie.tutorial.need' : `rosie.need.${event.species}.${event.kind}`;
    case 'load':
      return inTutorial(after) && event.cargo === supplyFor(TUTORIAL_NEED.kind, TUTORIAL_NEED.species)
        ? 'rosie.tutorial.load'
        : `rosie.load.${event.cargo}`;
    case 'deliver':
      if (after.needsMet === 1) {
        return 'rosie.tutorial.done';
      }
      return eggReady(after) ? 'rosie.egg.ready' : `rosie.cheer.${after.needsMet % CHEERS.length}`;
    case 'hatch':
      return event.species && SPECIES[event.species].model ? `rosie.hatch.${event.species}` : 'rosie.hatch.baby';
  }
}
