/** Points on the ground plane, in metres. `z` grows towards the camera, matching three.js's x/z plane. */
export interface Point {
  readonly x: number;
  readonly z: number;
}

/** The park's roads: junctions joined by straight, two-way segments. */
export interface RoadGraph {
  readonly nodes: ReadonlyMap<string, Point>;
  /** Each road segment once, as a pair of node IDs. */
  readonly edges: readonly (readonly [string, string])[];
}

/** A spot on a road: a fraction `t` (0–1) of the way along `edges[edge]`. */
export interface RoadPosition {
  readonly edge: number;
  readonly t: number;
  readonly point: Point;
  /** How far the original point was from the road. */
  readonly distance: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

function endpoints(graph: RoadGraph, edge: number): [string, string, Point, Point] {
  const pair = graph.edges[edge];
  const from = pair && graph.nodes.get(pair[0]);
  const to = pair && graph.nodes.get(pair[1]);
  if (!pair || !from || !to) {
    throw new Error(`Road edge ${edge} is missing or names an unknown node`);
  }
  return [pair[0], pair[1], from, to];
}

/** The closest point on any road to `point`. Throws if the graph has no roads. */
export function nearestRoadPosition(graph: RoadGraph, point: Point): RoadPosition {
  let best: RoadPosition | null = null;
  graph.edges.forEach((_, edge) => {
    const [, , a, b] = endpoints(graph, edge);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const t =
      lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
    const onRoad = lerp(a, b, t);
    const away = distance(point, onRoad);
    if (!best || away < best.distance) {
      best = { edge, t, point: onRoad, distance: away };
    }
  });
  if (!best) {
    throw new Error('The road graph has no roads');
  }
  return best;
}

/**
 * The shortest drive along the roads between two road positions, as a polyline starting at `from.point`
 * and ending at `to.point`. Uses A* over the junctions, entering and leaving through either end of the
 * start and end segments.
 */
export function findRoute(graph: RoadGraph, from: RoadPosition, to: RoadPosition): Point[] {
  if (from.edge === to.edge) {
    return [from.point, to.point];
  }

  const neighbours = new Map<string, { node: string; cost: number }[]>();
  const link = (a: string, b: string, cost: number) => {
    const list = neighbours.get(a) ?? [];
    list.push({ node: b, cost });
    neighbours.set(a, list);
  };
  graph.edges.forEach((_, edge) => {
    const [a, b, pa, pb] = endpoints(graph, edge);
    link(a, b, distance(pa, pb));
    link(b, a, distance(pa, pb));
  });

  // Virtual start and goal nodes sit at the two positions, joined to the ends of their segments.
  const START = '\0start';
  const GOAL = '\0goal';
  const points = new Map<string, Point>(graph.nodes);
  points.set(START, from.point);
  points.set(GOAL, to.point);
  const [fa, fb, pfa, pfb] = endpoints(graph, from.edge);
  link(START, fa, distance(from.point, pfa));
  link(START, fb, distance(from.point, pfb));
  const [ta, tb, pta, ptb] = endpoints(graph, to.edge);
  link(ta, GOAL, distance(pta, to.point));
  link(tb, GOAL, distance(ptb, to.point));

  const goalPoint = to.point;
  const cost = new Map<string, number>([[START, 0]]);
  const cameFrom = new Map<string, string>();
  const open = new Set([START]);
  while (open.size > 0) {
    let current = START;
    let bestScore = Infinity;
    for (const node of open) {
      const score = (cost.get(node) ?? Infinity) + distance(points.get(node) ?? goalPoint, goalPoint);
      if (score < bestScore) {
        bestScore = score;
        current = node;
      }
    }
    if (current === GOAL) {
      const route: Point[] = [];
      for (let node: string | undefined = GOAL; node !== undefined; node = cameFrom.get(node)) {
        const point = points.get(node);
        if (point) {
          route.unshift(point);
        }
      }
      return route;
    }
    open.delete(current);
    for (const { node, cost: step } of neighbours.get(current) ?? []) {
      const tentative = (cost.get(current) ?? Infinity) + step;
      if (tentative < (cost.get(node) ?? Infinity)) {
        cost.set(node, tentative);
        cameFrom.set(node, current);
        open.add(node);
      }
    }
  }
  // The roads don't connect the two positions: stay put rather than drive off-road.
  return [from.point];
}

/** Total length of a polyline. */
export function routeLength(route: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += distance(route[i - 1] as Point, route[i] as Point);
  }
  return total;
}
