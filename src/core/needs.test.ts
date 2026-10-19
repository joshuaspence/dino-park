import { describe, expect, it } from 'vitest';

import {
  type Care,
  FIRST_NEED_SECONDS,
  HAPPY_SECONDS,
  type JeepAt,
  MAX_NEEDS,
  NEED_INTERVAL_SECONDS,
  SAD_SECONDS,
  isSad,
  startCare,
  stepNeeds,
  supplyFor,
} from './needs';
import { PARK, type StationKind, penGate } from './park';
import { nearestRoadPosition } from './roads';
import type { SpeciesId } from './species';

/** Always picks the first choice: the first calm dinosaur, and the first kind of need (hungry). */
const first = () => 0;
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

/** Steps `care` for `seconds` in one-second ticks with the jeep away from everything. */
function wait(care: Care, seconds: number): Care {
  for (let t = 0; t < seconds; t++) {
    care = stepNeeds(care, PARK, away, 1, first).care;
  }
  return care;
}

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
    const care = startCare(PARK);
    expect(care.residents.every((resident) => resident.need === null)).toBe(true);
    expect(stepNeeds(care, PARK, away, FIRST_NEED_SECONDS - 1, first).events).toEqual([]);
    const { care: next, events } = stepNeeds(care, PARK, away, FIRST_NEED_SECONDS, first);
    expect(events).toEqual([{ type: 'need', species: PARK.pens[0]?.species, kind: 'hungry' }]);
    expect(next.residents[0]?.need).toEqual({ kind: 'hungry', age: 0 });
  });

  it('adds needs one interval apart, never more than a few at once', () => {
    let care = wait(startCare(PARK), FIRST_NEED_SECONDS);
    const waiting = () => care.residents.filter((resident) => resident.need).length;
    expect(waiting()).toBe(1);
    care = wait(care, NEED_INTERVAL_SECONDS - 1);
    expect(waiting()).toBe(1);
    care = wait(care, 1);
    expect(waiting()).toBe(2);
    care = wait(care, 10 * NEED_INTERVAL_SECONDS);
    expect(waiting()).toBe(MAX_NEEDS);
  });

  it('lets a need grow sad but never go away on its own', () => {
    let care = wait(startCare(PARK), FIRST_NEED_SECONDS);
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
    const passing = stepNeeds(care, PARK, { ...parkedAt('hay'), parked: false }, 0.1, first);
    expect(passing.care.cargo).toBeNull();
    const stopped = stepNeeds(care, PARK, parkedAt('hay'), 0.1, first);
    expect(stopped.care.cargo).toBe('hay');
    expect(stopped.events).toEqual([{ type: 'load', cargo: 'hay' }]);
    expect(stepNeeds(stopped.care, PARK, parkedAt('hay'), 0.1, first).events).toEqual([]);
  });

  it('swaps the cargo at a different station', () => {
    const loaded = stepNeeds(startCare(PARK), PARK, parkedAt('hay'), 0.1, first).care;
    expect(stepNeeds(loaded, PARK, parkedAt('water'), 0.1, first).care.cargo).toBe('water');
  });

  it('delivers what a dinosaur needs on the way past, and it celebrates', () => {
    const loaded = { ...hungry('triceratops'), cargo: 'hay' as const };
    const { care, events } = stepNeeds(loaded, PARK, atPen('triceratops', false), 0.1, first);
    expect(events).toEqual([{ type: 'deliver', species: 'triceratops', kind: 'hungry' }]);
    expect(care.cargo).toBeNull();
    expect(care.needsMet).toBe(1);
    const trixie = care.residents.find((resident) => resident.species === 'triceratops');
    expect(trixie).toEqual({ species: 'triceratops', need: null, happyFor: HAPPY_SECONDS });
  });

  it('keeps the cargo when it is not what the dinosaur needs', () => {
    const loaded = { ...hungry('trex'), cargo: 'hay' as const };
    const { care, events } = stepNeeds(loaded, PARK, atPen('trex'), 0.1, first);
    expect(events).toEqual([]);
    expect(care.cargo).toBe('hay');
    expect(care.residents.find((resident) => resident.species === 'trex')?.need?.kind).toBe('hungry');
  });

  it("doesn't give a celebrating dinosaur a new need", () => {
    const start = startCare(PARK);
    const care: Care = {
      ...start,
      residents: start.residents.map((resident, i) => (i === 0 ? { ...resident, happyFor: HAPPY_SECONDS } : resident)),
      untilNextNeed: 0.1,
    };
    const { events } = stepNeeds(care, PARK, away, 0.1, first);
    expect(events).toEqual([{ type: 'need', species: PARK.pens[1]?.species, kind: 'hungry' }]);
  });
});
