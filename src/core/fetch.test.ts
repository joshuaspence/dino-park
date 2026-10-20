import { describe, expect, it } from 'vitest';

import { FENCE_MARGIN, THROW_SECONDS, ballHeight, dropPoint, startFetch, stepFetch, throwBall } from './fetch';
import { PARK, penGate } from './park';
import { distance } from './roads';

const rex = (() => {
  const found = PARK.pens.find((pen) => pen.species === 'trex');
  if (!found) {
    throw new Error('No Rex pen');
  }
  return found;
})();

/** Steps `fetch` a frame at a time until it's ready again or `seconds` run out. */
function play(fetch: ReturnType<typeof startFetch>, seconds: number) {
  let fetched = 0;
  for (let t = 0; t < seconds; t += 0.05) {
    const step = stepFetch(fetch, rex, 0.05);
    fetch = step.fetch;
    fetched += step.fetched ? 1 : 0;
  }
  return { fetch, fetched };
}

describe('playing fetch', () => {
  it('waits with the ball just inside the gate', () => {
    const fetch = startFetch(rex, rex.position);
    expect(fetch.phase).toBe('ready');
    const drop = dropPoint(rex);
    expect(distance(drop, penGate(rex))).toBeCloseTo(3);
    // Inside the pen, towards its middle.
    expect(Math.abs(drop.z - rex.position.z)).toBeLessThan(rex.halfSize.z);
    expect(stepFetch(fetch, rex, 1)).toEqual({ fetch, fetched: false });
  });

  it('throws the ball where the child taps, but never over the fence', () => {
    const fetch = startFetch(rex, rex.position);
    const inside = { x: rex.position.x + 2, z: rex.position.z - 1 };
    expect(throwBall(fetch, rex, inside)).toMatchObject({ phase: 'thrown', ball: inside, from: fetch.ball });
    const outside = { x: rex.position.x + 100, z: rex.position.z - 100 };
    expect(throwBall(fetch, rex, outside).ball).toEqual({
      x: rex.position.x + rex.halfSize.x - FENCE_MARGIN,
      z: rex.position.z - rex.halfSize.z + FENCE_MARGIN,
    });
  });

  it('arcs the ball through the air, then the dinosaur runs after it and brings it back', () => {
    const thrown = throwBall(startFetch(rex, rex.position), rex, { x: rex.position.x + 4, z: rex.position.z });
    expect(ballHeight(thrown)).toBe(0);
    const midway = stepFetch(thrown, rex, THROW_SECONDS / 2).fetch;
    expect(ballHeight(midway)).toBeGreaterThan(3);
    // A second throw while the first is still going does nothing.
    expect(throwBall(midway, rex, rex.position)).toBe(midway);

    const chasing = stepFetch(midway, rex, THROW_SECONDS / 2).fetch;
    expect(chasing.phase).toBe('chasing');
    expect(ballHeight(chasing)).toBe(0);

    const { fetch, fetched } = play(chasing, 10);
    expect(fetched).toBe(1);
    expect(fetch.phase).toBe('ready');
    expect(fetch.ball).toEqual(dropPoint(rex));
  });

  it('carries the ball in its mouth on the way back', () => {
    const thrown = throwBall(startFetch(rex, rex.position), rex, { x: rex.position.x + 4, z: rex.position.z });
    let fetch = stepFetch(thrown, rex, THROW_SECONDS).fetch;
    while (fetch.phase === 'chasing') {
      fetch = stepFetch(fetch, rex, 0.05).fetch;
    }
    fetch = stepFetch(fetch, rex, 0.05).fetch;
    expect(fetch.phase).toBe('returning');
    expect(fetch.ball).toEqual(fetch.dino);
  });
});
