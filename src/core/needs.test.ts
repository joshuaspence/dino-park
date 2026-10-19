import { describe, expect, it } from 'vitest';

import {
  type Care,
  DRAIN_SECONDS,
  NEED_BELOW,
  NEED_KINDS,
  type NeedKind,
  type Resident,
  lowestKind,
  moodOf,
  FIRST_NEED_SECONDS,
  HAPPY_SECONDS,
  type JeepAt,
  MAX_NEEDS,
  NEEDS_PER_EGG,
  NEED_INTERVAL_SECONDS,
  SAD_SECONDS,
  TUTORIAL_NEED,
  eggProgress,
  eggReady,
  inTutorial,
  isSad,
  startCare,
  stepNeeds,
  supplyFor,
} from './needs';
import { PARK, type StationKind, penGate } from './park';
import { nearestRoadPosition } from './roads';
import { type SpeciesId, UNLOCK_ORDER } from './species';

/** Somewhere far from every station and pen. */
const away: JeepAt = { position: { x: 0, z: 0 }, parked: true };

function parkedAt(kind: StationKind): JeepAt {
  const station = PARK.stations.find((candidate) => candidate.kind === kind);
  if (!station) {
    throw new Error(`No ${kind} station`);
  }
  return { position: nearestRoadPosition(PARK.roads, station.position).point, parked: true };
}

function atPen(species: SpeciesId, parked = true): JeepAt {
  const pen = PARK.pens.find((candidate) => candidate.species === species);
  if (!pen) {
    throw new Error(`No ${species} pen`);
  }
  return { position: nearestRoadPosition(PARK.roads, penGate(pen)).point, parked };
}

/** A fresh park past the first-play tutorial, where the general rules for needs apply. */
const played = (): Care => ({ ...startCare(PARK), needsMet: 1 });

/** Steps `care` for `seconds` in one-second ticks with the jeep away from everything. */
function wait(care: Care, seconds: number): Care {
  for (let t = 0; t < seconds; t++) {
    care = stepNeeds(care, PARK, away, 1).care;
  }
  return care;
}

/** Every meter full, except `species`'s `kind` meter at `level`. */
function lowOn(care: Care, species: SpeciesId, kind: NeedKind, level: number): Care {
  return {
    ...care,
    residents: care.residents.map((resident) => ({
      ...resident,
      levels: { ...FULL, ...(resident.species === species ? { [kind]: level } : {}) },
    })),
  };
}

const FULL = { hungry: 1, thirsty: 1, dirty: 1, bored: 1, poorly: 1 } as const;

/** A park where only `species` wants anything: it's hungry. */
function hungry(species: SpeciesId): Care {
  const care = startCare(PARK);
  return {
    ...care,
    residents: care.residents.map((resident) =>
      resident.species === species ? { ...resident, need: { kind: 'hungry' as const, age: 0 } } : resident,
    ),
    untilNextNeed: Infinity,
  };
}

describe('supplyFor', () => {
  it('feeds each dinosaur what it eats', () => {
    expect(supplyFor('hungry', 'triceratops')).toBe('hay');
    expect(supplyFor('hungry', 'trex')).toBe('meat');
    expect(supplyFor('hungry', 'pterodactyl')).toBe('fish');
    expect(supplyFor('dirty', 'trex')).toBe('bath');
  });
});

describe('stepNeeds', () => {
  it('starts calm and gives a dinosaur its first need soon after', () => {
    const care = played();
    expect(care.residents.every((resident) => resident.need === null)).toBe(true);
    expect(stepNeeds(care, PARK, away, FIRST_NEED_SECONDS - 1).events).toEqual([]);
    const { care: next, events } = stepNeeds(care, PARK, away, FIRST_NEED_SECONDS);
    // Every pen opens with one meter a little under half; water drains quickest, so Bruno is thirsty first.
    expect(events).toEqual([{ type: 'need', species: 'brontosaurus', kind: 'thirsty' }]);
    expect(next.residents[1]?.need).toEqual({ kind: 'thirsty', age: 0 });
  });

  it('adds needs one interval apart, never more than a few at once', () => {
    let care = wait(played(), FIRST_NEED_SECONDS);
    const waiting = () => care.residents.filter((resident) => resident.need).length;
    expect(waiting()).toBe(1);
    care = wait(care, NEED_INTERVAL_SECONDS - 1);
    expect(waiting()).toBe(1);
    care = wait(care, 1);
    expect(waiting()).toBe(2);
    care = wait(care, 10 * NEED_INTERVAL_SECONDS);
    expect(waiting()).toBe(MAX_NEEDS);
  });

  it('waits a full interval after a need is met in a full park', () => {
    let care = wait(played(), 100);
    expect(care.residents.filter((resident) => resident.need).length).toBe(MAX_NEEDS);
    const helped = care.residents.findIndex((resident) => resident.need);
    const resident = care.residents[helped];
    const need = resident?.need;
    if (!resident || !need) {
      throw new Error('Nobody is waiting');
    }
    const cargo = supplyFor(need.kind, resident.species);
    const metBefore = care.needsMet;
    care = stepNeeds({ ...care, cargo }, PARK, atPen(resident.species), 0.1).care;
    expect(care.needsMet).toBe(metBefore + 1);
    care = wait(care, NEED_INTERVAL_SECONDS - 1);
    expect(care.residents.filter((other) => other.need).length).toBe(MAX_NEEDS - 1);
    care = wait(care, 1);
    expect(care.residents.filter((other) => other.need).length).toBe(MAX_NEEDS);
  });

  it('lets a need grow sad but never go away on its own', () => {
    let care = wait(played(), FIRST_NEED_SECONDS);
    const sad = () => {
      const need = care.residents[0]?.need;
      return need ? isSad(need) : undefined;
    };
    care = wait(care, SAD_SECONDS - 1);
    expect(sad()).toBe(false);
    care = wait(care, 1000);
    expect(sad()).toBe(true);
  });

  it('loads from a station only once the jeep stops there', () => {
    const care = startCare(PARK);
    const passing = stepNeeds(care, PARK, { ...parkedAt('hay'), parked: false }, 0.1);
    expect(passing.care.cargo).toBeNull();
    const stopped = stepNeeds(care, PARK, parkedAt('hay'), 0.1);
    expect(stopped.care.cargo).toBe('hay');
    expect(stopped.events).toEqual([{ type: 'load', cargo: 'hay' }]);
    expect(stepNeeds(stopped.care, PARK, parkedAt('hay'), 0.1).events).toEqual([]);
  });

  it('swaps the cargo at a different station', () => {
    const loaded = stepNeeds(startCare(PARK), PARK, parkedAt('hay'), 0.1).care;
    expect(stepNeeds(loaded, PARK, parkedAt('water'), 0.1).care.cargo).toBe('water');
  });

  it('delivers what a dinosaur needs on the way past, and it celebrates', () => {
    const loaded = { ...hungry('triceratops'), cargo: 'hay' as const };
    const { care, events } = stepNeeds(loaded, PARK, atPen('triceratops', false), 0.1);
    expect(events).toEqual([{ type: 'deliver', species: 'triceratops', kind: 'hungry' }]);
    expect(care.cargo).toBeNull();
    expect(care.needsMet).toBe(1);
    const trixie = care.residents.find((resident) => resident.species === 'triceratops');
    expect(trixie).toMatchObject({ species: 'triceratops', need: null, happyFor: HAPPY_SECONDS });
  });

  it('keeps the cargo when it is not what the dinosaur needs', () => {
    const loaded = { ...hungry('trex'), cargo: 'hay' as const };
    const { care, events } = stepNeeds(loaded, PARK, atPen('trex'), 0.1);
    expect(events).toEqual([]);
    expect(care.cargo).toBe('hay');
    expect(care.residents.find((resident) => resident.species === 'trex')?.need?.kind).toBe('hungry');
  });

  it('gives no needs to a dinosaur that has not hatched yet', () => {
    const locked = PARK.areas[0]?.species;
    expect(PARK.pens.at(-1)?.species).toBe(locked);
    if (!locked) {
      throw new Error('No locked area');
    }
    const lockedNeed = (care: Care) => care.residents.at(-1)?.need ?? null;

    // Its meter is the emptiest in the park, but it can't ask until it hatches.
    let care = lowOn(played(), locked, 'hungry', 0);
    for (let t = 0; t < 10 * NEED_INTERVAL_SECONDS; t++) {
      care = stepNeeds(care, PARK, away, 1).care;
    }
    expect(lockedNeed(care)).toBeNull();

    const hatched = stepNeeds(
      { ...lowOn(played(), locked, 'hungry', 0), eggsHatched: 1 },
      PARK,
      away,
      FIRST_NEED_SECONDS,
    );
    expect(lockedNeed(hatched.care)).not.toBeNull();
  });

  it('starts with the tutorial: only one dinosaur wants anything, and always the same thing, until a need is met', () => {
    // Whatever the meters say, the first need is the tutorial's.
    let care = stepNeeds(startCare(PARK), PARK, away, FIRST_NEED_SECONDS).care;
    const tutee = () => care.residents.find((resident) => resident.species === TUTORIAL_NEED.species);
    expect(inTutorial(care)).toBe(true);
    expect(tutee()?.need?.kind).toBe(TUTORIAL_NEED.kind);
    // However long she waits, nobody else asks for anything.
    for (let t = 0; t < 10 * NEED_INTERVAL_SECONDS; t++) {
      care = stepNeeds(care, PARK, away, 1).care;
    }
    expect(care.residents.filter((resident) => resident.need)).toHaveLength(1);

    // Once it's helped, the tutorial is over and the usual rules apply.
    const cargo = supplyFor(TUTORIAL_NEED.kind, TUTORIAL_NEED.species);
    care = stepNeeds({ ...care, cargo }, PARK, atPen(TUTORIAL_NEED.species), 0.1).care;
    expect(inTutorial(care)).toBe(false);
    care = wait(care, NEED_INTERVAL_SECONDS * 3);
    expect(care.residents.filter((resident) => resident.need)).toHaveLength(MAX_NEEDS);
  });

  it("doesn't give a celebrating dinosaur a new need", () => {
    const start = played();
    const care: Care = {
      ...start,
      residents: start.residents.map((resident, i) => (i === 0 ? { ...resident, happyFor: HAPPY_SECONDS } : resident)),
      untilNextNeed: 0.1,
    };
    const { events } = stepNeeds(care, PARK, away, 0.1);
    expect(events).toHaveLength(1);
    expect(events[0]).not.toMatchObject({ species: PARK.pens[0]?.species });
  });

  it('asks for whatever meter is lowest, once it drains below half', () => {
    const care = { ...lowOn(played(), 'trex', 'thirsty', NEED_BELOW + 0.01), untilNextNeed: 0 };
    // Not quite low enough yet: nobody asks.
    expect(stepNeeds(care, PARK, away, 0.1).events).toEqual([]);
    const { care: next, events } = stepNeeds(care, PARK, away, 0.02 * DRAIN_SECONDS.thirsty);
    expect(events).toEqual([{ type: 'need', species: 'trex', kind: 'thirsty' }]);
    expect(lowestKind(next.residents.find((resident) => resident.species === 'trex')?.levels ?? FULL)).toBe('thirsty');
  });

  it('drains every meter while the park is calm, and holds them while it is full', () => {
    const care = played();
    const drained = stepNeeds({ ...care, untilNextNeed: Infinity }, PARK, away, 60).care;
    for (const [i, resident] of drained.residents.entries()) {
      const before = care.residents[i]?.levels;
      // Not yet hatched, the locked pen's meters don't move.
      const open = resident.species !== PARK.areas[0]?.species;
      for (const kind of NEED_KINDS) {
        expect(resident.levels[kind]).toBeCloseTo(
          Math.max(0, (before?.[kind] ?? 0) - (open ? 60 / DRAIN_SECONDS[kind] : 0)),
        );
      }
    }
    const full = wait(played(), 100);
    expect(full.residents.filter((resident) => resident.need)).toHaveLength(MAX_NEEDS);
    expect(stepNeeds(full, PARK, away, 60).care.residents.map((resident) => resident.levels)).toEqual(
      full.residents.map((resident) => resident.levels),
    );
  });

  it('fills the meter a delivery meets, and says how each dinosaur feels', () => {
    const loaded = { ...hungry('triceratops'), cargo: 'hay' as const };
    const trixie = (care: Care) => care.residents.find((resident) => resident.species === 'triceratops');
    expect(moodOf(trixie(loaded) as Resident)).toBe('wants');
    expect(moodOf({ ...(trixie(loaded) as Resident), need: { kind: 'hungry', age: SAD_SECONDS } })).toBe('sad');
    const fed = stepNeeds(loaded, PARK, atPen('triceratops'), 0.1).care;
    expect(trixie(fed)?.levels.hungry).toBe(1);
    expect(moodOf(trixie(fed) as Resident)).toBe('happy');
    expect(moodOf({ species: 'trex', levels: FULL, need: null, happyFor: 0 })).toBe('happy');
    expect(moodOf({ species: 'trex', levels: { ...FULL, dirty: 0.55 }, need: null, happyFor: 0 })).toBe('fine');
  });
});

describe('eggs', () => {
  const atNest: JeepAt = { position: nearestRoadPosition(PARK.roads, PARK.nest).point, parked: true };

  it('fills an egg one need at a time', () => {
    const care = startCare(PARK);
    expect(eggProgress(care)).toBe(0);
    expect(eggProgress({ ...care, needsMet: NEEDS_PER_EGG - 1 })).toBe(NEEDS_PER_EGG - 1);
    expect(eggReady({ ...care, needsMet: NEEDS_PER_EGG - 1 })).toBe(false);
    expect(eggReady({ ...care, needsMet: NEEDS_PER_EGG })).toBe(true);
  });

  it('hatches a ready egg into the next dinosaur when the jeep reaches the nest', () => {
    const ready = { ...startCare(PARK), untilNextNeed: Infinity, needsMet: NEEDS_PER_EGG };
    const { care, events } = stepNeeds(ready, PARK, atNest, 0.1);
    expect(events).toEqual([{ type: 'hatch', species: UNLOCK_ORDER[0] }]);
    expect(care.eggsHatched).toBe(1);
    expect(eggProgress(care)).toBe(0);
  });

  it("doesn't hatch when the jeep drives past the nest without stopping", () => {
    const ready = { ...startCare(PARK), untilNextNeed: Infinity, needsMet: NEEDS_PER_EGG };
    expect(stepNeeds(ready, PARK, { ...atNest, parked: false }, 0.1).events).toEqual([]);
  });

  it("doesn't hatch an egg that isn't ready", () => {
    const filling = { ...startCare(PARK), untilNextNeed: Infinity, needsMet: NEEDS_PER_EGG - 1 };
    expect(stepNeeds(filling, PARK, atNest, 0.1).events).toEqual([]);
  });

  it('counts needs met while an egg waits towards the next one', () => {
    const waiting = { ...startCare(PARK), untilNextNeed: Infinity, needsMet: NEEDS_PER_EGG + 2 };
    expect(eggProgress(stepNeeds(waiting, PARK, atNest, 0.1).care)).toBe(2);
  });

  it('hatches with no new species once every species has hatched', () => {
    const hatched = UNLOCK_ORDER.length;
    const ready = {
      ...startCare(PARK),
      untilNextNeed: Infinity,
      eggsHatched: hatched,
      needsMet: (hatched + 1) * NEEDS_PER_EGG,
    };
    expect(stepNeeds(ready, PARK, atNest, 0.1).events).toEqual([{ type: 'hatch', species: null }]);
  });
});
