import { MAX_REACH, type Park, type Pen, type Station, type StationKind, penGate } from './park';
import { type Point, distance } from './roads';
import { type Diet, SPECIES, type SpeciesId, UNLOCK_ORDER } from './species';

/** What a dinosaur can want, each shown as a single picture in its bubble (docs/design.md §3). */
export type NeedKind = 'hungry' | 'thirsty' | 'dirty' | 'bored' | 'poorly';

export const NEED_KINDS: readonly NeedKind[] = ['hungry', 'thirsty', 'dirty', 'bored', 'poorly'];

/** The first need comes quickly, so a new player has something to do straight away. */
export const FIRST_NEED_SECONDS = 3;
/** How long the park stays calm between one need appearing and the next. */
export const NEED_INTERVAL_SECONDS = 25;
/** More bubbles than this at once would overwhelm a small child. */
export const MAX_NEEDS = 2;
/** After this long a need shows a sad face and a bigger bubble. It never gets worse than that. */
export const SAD_SECONDS = 40;
/** How long a dinosaur celebrates after being helped, during which it won't want anything. */
export const HAPPY_SECONDS = 3;
/** Needs met per egg: about five minutes of play (docs/design.md §5). */
export const NEEDS_PER_EGG = 5;

export interface Need {
  readonly kind: NeedKind;
  /** Seconds the dinosaur has been waiting. */
  readonly age: number;
}

export interface Resident {
  readonly species: SpeciesId;
  readonly need: Need | null;
  /** Seconds of celebration left; 0 when calm. */
  readonly happyFor: number;
}

export interface Care {
  /** One per pen, in the park's pen order. */
  readonly residents: readonly Resident[];
  readonly untilNextNeed: number;
  /** What's on the back of the jeep. */
  readonly cargo: StationKind | null;
  /** Needs met so far, towards eggs. */
  readonly needsMet: number;
  readonly eggsHatched: number;
}

export type CareEvent =
  | { readonly type: 'need'; readonly species: SpeciesId; readonly kind: NeedKind }
  | { readonly type: 'load'; readonly cargo: StationKind }
  | { readonly type: 'deliver'; readonly species: SpeciesId; readonly kind: NeedKind }
  /** `species` is null once everything has hatched; later eggs will hatch babies (docs/design.md §5). */
  | { readonly type: 'hatch'; readonly species: SpeciesId | null };

/** Somewhere the jeep can be visiting: a station, a pen's gate, or the egg nest. */
export type Visit = { readonly station: Station } | { readonly pen: Pen } | { readonly nest: true };

const FOOD: Readonly<Record<Diet, StationKind>> = { plants: 'hay', meat: 'meat', fish: 'fish' };

/** The station that has what `species` needs. */
export function supplyFor(kind: NeedKind, species: SpeciesId): StationKind {
  switch (kind) {
    case 'hungry':
      return FOOD[SPECIES[species].diet];
    case 'thirsty':
      return 'water';
    case 'dirty':
      return 'bath';
    case 'bored':
      return 'toys';
    case 'poorly':
      return 'vet';
  }
}

export function startCare(park: Park): Care {
  return {
    residents: park.pens.map((pen) => ({ species: pen.species, need: null, happyFor: 0 })),
    untilNextNeed: FIRST_NEED_SECONDS,
    cargo: null,
    needsMet: 0,
    eggsHatched: 0,
  };
}

/** How far the next egg has come, from 0 to NEEDS_PER_EGG. Needs met while an egg waits count towards the next. */
export function eggProgress(care: Care): number {
  return Math.min(NEEDS_PER_EGG, care.needsMet - care.eggsHatched * NEEDS_PER_EGG);
}

export function eggReady(care: Care): boolean {
  return eggProgress(care) >= NEEDS_PER_EGG;
}

/** Where the jeep is, and whether it has stopped there. */
export interface JeepAt {
  readonly position: Point;
  readonly parked: boolean;
}

/**
 * Advances needs by `seconds` and handles the jeep's visits. A parked jeep loads from the nearest station in
 * reach; driving past one doesn't, so a trip back from the haystack can't swap its hay for water on the way. A
 * jeep near a pen delivers whenever its cargo is what that dinosaur needs, parked or not. A ready egg hatches
 * only when the jeep stops at the nest, since the cross road runs past it and a hatch is the moment the child came
 * for.
 */
export function stepNeeds(
  care: Care,
  park: Park,
  jeep: JeepAt,
  seconds: number,
  random: () => number = Math.random,
): { care: Care; events: CareEvent[] } {
  const events: CareEvent[] = [];
  let residents = care.residents.map((resident) => ({
    ...resident,
    need: resident.need && { ...resident.need, age: resident.need.age + seconds },
    happyFor: Math.max(0, resident.happyFor - seconds),
  }));
  let { cargo, needsMet, eggsHatched } = care;

  // While the park is full the countdown waits, so meeting a need brings a calm gap rather than a new demand.
  const full = residents.filter((resident) => resident.need).length >= MAX_NEEDS;
  let untilNextNeed = full ? NEED_INTERVAL_SECONDS : care.untilNextNeed - seconds;
  if (untilNextNeed <= 0) {
    const calm = residents.filter((resident) => !resident.need && resident.happyFor === 0);
    if (calm.length > 0) {
      const chosen = pick(calm, random);
      const kind = pick(NEED_KINDS, random);
      residents = residents.map((resident) =>
        resident === chosen ? { ...resident, need: { kind, age: 0 } } : resident,
      );
      events.push({ type: 'need', species: chosen.species, kind });
      untilNextNeed = NEED_INTERVAL_SECONDS;
    } else {
      // Try again as soon as a dinosaur is free.
      untilNextNeed = 0;
    }
  }

  const visiting = visitedPlace(park, jeep.position);
  if (visiting && 'station' in visiting && jeep.parked && visiting.station.kind !== cargo) {
    cargo = visiting.station.kind;
    events.push({ type: 'load', cargo });
  }
  const helped = visiting && 'pen' in visiting ? residents[park.pens.indexOf(visiting.pen)] : undefined;
  const need = helped?.need;
  if (helped && need && cargo === supplyFor(need.kind, helped.species)) {
    events.push({ type: 'deliver', species: helped.species, kind: need.kind });
    residents = residents.map((other) =>
      other === helped ? { ...other, need: null, happyFor: HAPPY_SECONDS } : other,
    );
    cargo = null;
    needsMet += 1;
  }
  if (visiting && 'nest' in visiting && jeep.parked && eggReady({ ...care, needsMet, eggsHatched })) {
    events.push({ type: 'hatch', species: UNLOCK_ORDER[eggsHatched] ?? null });
    eggsHatched += 1;
  }

  return { care: { residents, untilNextNeed, cargo, needsMet, eggsHatched }, events };
}

/**
 * The station, pen gate or nest nearest `position`, if one is within reach. They compete, so a jeep stopped at a
 * pen next to a station delivers there rather than loading from the station.
 */
export function visitedPlace(park: Park, position: Point): Visit | undefined {
  let best: Visit | undefined;
  let bestDistance = MAX_REACH;
  const consider = (place: Point, visit: Visit) => {
    const gap = distance(place, position);
    if (gap <= bestDistance) {
      best = visit;
      bestDistance = gap;
    }
  };
  for (const station of park.stations) {
    consider(station.position, { station });
  }
  for (const pen of park.pens) {
    consider(penGate(pen), { pen });
  }
  consider(park.nest, { nest: true });
  return best;
}

/** True once a need has waited long enough to show a sad face. */
export function isSad(need: Need): boolean {
  return need.age >= SAD_SECONDS;
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))] as T;
}
