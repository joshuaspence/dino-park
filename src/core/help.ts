import { type Care, TUTORIAL_NEED, eggReady, supplyFor } from './needs';
import { type Park, penGate } from './park';
import type { Point } from './roads';
import type { Beat } from './rosie';
import { FIRST_DRIVE, tourStep } from './tour';

/**
 * Ranger Rosie's help (docs/design.md §6): what to do next, for a child who's stuck. She says it, the camera shows
 * the places she names, and the arrow points at where to drive. The guided tour's own steps come from here too, so
 * help during the tour repeats what the tour asked.
 */
export interface Hint {
  readonly beats: readonly Beat[];
  /** Where the arrow points: the place to drive to next, or null when there's nowhere in particular to go. */
  readonly target: Point | null;
  /** What the arrow is pointing at. */
  readonly kind: 'drive' | 'station' | 'pen' | 'nest' | null;
}

/**
 * What to do next. During the tour, its current step. After it: hatch a ready egg first, since that's what the
 * child has been working towards; then take what's on the jeep to whoever wants it; then fetch for whoever has
 * waited longest. With nobody wanting anything, she says so.
 */
export function nextHint(care: Care, park: Park, driven: boolean): Hint {
  const step = tourStep(care, driven);
  const tuteePen = park.pens.find((pen) => pen.species === TUTORIAL_NEED.species);
  const tutorialStation = park.stations.find(
    (station) => station.kind === supplyFor(TUTORIAL_NEED.kind, TUTORIAL_NEED.species),
  );
  switch (step) {
    case 'drive':
      return { beats: [{ line: 'rosie.tutorial.drive' }], target: FIRST_DRIVE, kind: 'drive' };
    case 'station':
      return {
        beats: [
          { line: 'rosie.tutorial.need', focus: { pen: TUTORIAL_NEED.species } },
          { line: 'rosie.tutorial.station', focus: { station: supplyFor(TUTORIAL_NEED.kind, TUTORIAL_NEED.species) } },
        ],
        target: tutorialStation?.position ?? null,
        kind: 'station',
      };
    case 'pen':
      return {
        beats: [{ line: 'rosie.tutorial.load', focus: { pen: TUTORIAL_NEED.species } }],
        target: tuteePen ? penGate(tuteePen) : null,
        kind: 'pen',
      };
    case null:
      break;
  }

  if (eggReady(care)) {
    return { beats: [{ line: 'rosie.egg.ready', focus: { nest: true } }], target: park.nest, kind: 'nest' };
  }
  // Longest waiting first, which is also the saddest.
  const waiting = care.residents
    .filter((resident) => resident.need)
    .sort((a, b) => (b.need?.age ?? 0) - (a.need?.age ?? 0));
  const taker = waiting.find(
    (resident) => resident.need && care.cargo === supplyFor(resident.need.kind, resident.species),
  );
  const takerPen = taker && park.pens.find((pen) => pen.species === taker.species);
  if (taker && takerPen) {
    return {
      beats: [{ line: `rosie.help.take.${taker.species}`, focus: { pen: taker.species } }],
      target: penGate(takerPen),
      kind: 'pen',
    };
  }
  for (const resident of waiting) {
    const need = resident.need;
    const station =
      need && park.stations.find((candidate) => candidate.kind === supplyFor(need.kind, resident.species));
    if (need && station) {
      return {
        beats: [
          { line: `rosie.need.${resident.species}.${need.kind}`, focus: { pen: resident.species } },
          { line: `rosie.help.fetch.${station.kind}`, focus: { station: station.kind } },
        ],
        target: station.position,
        kind: 'station',
      };
    }
  }
  return { beats: [{ line: 'rosie.help.wait' }], target: null, kind: null };
}
