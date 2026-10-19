import { describe, expect, it } from 'vitest';

import { nextHint } from './help';
import { type Care, NEEDS_PER_EGG, NEED_KINDS, type NeedKind, startCare } from './needs';
import { PARK, penGate } from './park';
import { rosieLines } from './rosie';
import type { SpeciesId } from './species';
import { FIRST_DRIVE } from './tour';

const fresh = startCare(PARK);
/** A park past the guided tour. */
const played: Care = { ...fresh, needsMet: 2 };

/** `care` with each of `needs` waiting, for as long as given. */
function wanting(care: Care, needs: readonly [SpeciesId, NeedKind, number][]): Care {
  return {
    ...care,
    residents: care.residents.map((resident) => {
      const need = needs.find(([species]) => species === resident.species);
      return need ? { ...resident, need: { kind: need[1], age: need[2] } } : resident;
    }),
  };
}

const station = (kind: string) => PARK.stations.find((candidate) => candidate.kind === kind)?.position;
const gate = (species: SpeciesId) => {
  const pen = PARK.pens.find((candidate) => candidate.species === species);
  return pen && penGate(pen);
};
const lines = (care: Care, driven = true) => nextHint(care, PARK, driven).beats.map((beat) => beat.line);

describe("Rosie's help", () => {
  it('repeats the guided tour step a new player is on', () => {
    expect(nextHint(fresh, PARK, false)).toMatchObject({ target: FIRST_DRIVE, kind: 'drive' });
    expect(lines(fresh, false)).toEqual(['rosie.tutorial.drive']);
    const bored = wanting(fresh, [['stegosaurus', 'bored', 5]]);
    expect(nextHint(bored, PARK, true)).toMatchObject({ target: station('toys'), kind: 'station' });
    expect(lines(bored)).toEqual(['rosie.tutorial.need', 'rosie.tutorial.station']);
    expect(nextHint({ ...bored, cargo: 'toys' }, PARK, true)).toMatchObject({
      target: gate('stegosaurus'),
      kind: 'pen',
    });
  });

  it('shows who wants something, then where to fetch it, for whoever has waited longest', () => {
    const care = wanting(played, [
      ['triceratops', 'thirsty', 5],
      ['trex', 'hungry', 30],
    ]);
    expect(nextHint(care, PARK, true)).toEqual({
      beats: [
        { line: 'rosie.need.trex.hungry', focus: { pen: 'trex' } },
        { line: 'rosie.help.fetch.meat', focus: { station: 'meat' } },
      ],
      target: station('meat'),
      kind: 'station',
    });
  });

  it("takes what's on the jeep to whoever wants it, even if someone else has waited longer", () => {
    const care = {
      ...wanting(played, [
        ['triceratops', 'thirsty', 5],
        ['trex', 'hungry', 30],
      ]),
      cargo: 'water' as const,
    };
    expect(nextHint(care, PARK, true)).toEqual({
      beats: [{ line: 'rosie.help.take.triceratops', focus: { pen: 'triceratops' } }],
      target: gate('triceratops'),
      kind: 'pen',
    });
    // The wrong thing on the jeep is no help: fetch the right one.
    expect(nextHint({ ...care, cargo: 'toys' }, PARK, true).kind).toBe('station');
  });

  it('hatches a ready egg before anything else', () => {
    const care = wanting({ ...played, needsMet: NEEDS_PER_EGG }, [['trex', 'hungry', 30]]);
    expect(nextHint(care, PARK, true)).toEqual({
      beats: [{ line: 'rosie.egg.ready', focus: { nest: true } }],
      target: PARK.nest,
      kind: 'nest',
    });
  });

  it('says everyone is happy when nobody wants anything', () => {
    expect(nextHint(played, PARK, true)).toEqual({ beats: [{ line: 'rosie.help.wait' }], target: null, kind: null });
  });

  it('only says lines in the script', () => {
    const script = rosieLines();
    expect(script.get('rosie.help.take.velociraptor')).toBe("Let's take it to the Raptors. Tap the Raptors' pen!");
    expect(script.get('rosie.help.fetch.meat')).toBe('Tap the butcher!');
    const parks = [fresh, played, { ...played, needsMet: NEEDS_PER_EGG }];
    for (const care of parks) {
      for (const { species } of PARK.pens) {
        for (const kind of NEED_KINDS) {
          for (const cargo of [null, ...PARK.stations.map((candidate) => candidate.kind)]) {
            for (const driven of [false, true]) {
              for (const line of lines({ ...wanting(care, [[species, kind, 1]]), cargo }, driven)) {
                expect(script.get(line), line).toBeTruthy();
              }
            }
          }
        }
      }
    }
  });
});
