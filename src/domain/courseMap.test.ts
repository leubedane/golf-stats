import { describe, expect, it } from 'vitest';
import {
  assignHoleLine,
  assignedHoleLines,
  courseOverview,
  featureDistance,
  holeMap,
  holeRef,
  holeLineLengthM,
  isHoleArea,
  newCourseMap,
  parseOverpass,
  unassignedHoleLines,
  type OverpassElement,
} from './courseMap';
import type { CourseMap, LatLon } from './types';

// Synthetic positions given in meters east/north of a point near Kirchzarten.
const ORIGIN = { lat: 47.977, lon: 7.92 };
const M_PER_DEG_LAT = 111_195;
const at = (east: number, north: number): LatLon => ({
  lat: ORIGIN.lat + north / M_PER_DEG_LAT,
  lon: ORIGIN.lon + east / (M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180)),
});
const square = (east: number, north: number, half: number): LatLon[] => [
  at(east - half, north - half),
  at(east + half, north - half),
  at(east + half, north + half),
  at(east - half, north + half),
  at(east - half, north - half),
];

const way = (id: number, tags: Record<string, string>, geometry: LatLon[]): OverpassElement => ({ type: 'way', id, tags, geometry });

// Hole 1 runs 300 m due east; hole 2 runs north, 200 m away.
const elements: OverpassElement[] = [
  way(1, { golf: 'hole', ref: '1', par: '4' }, [at(0, 0), at(300, 0)]),
  way(2, { golf: 'hole', name: 'Loch 2' }, [at(0, 200), at(0, 400)]),
  way(3, { golf: 'hole' }, [at(500, 0), at(500, 150)]),
  way(10, { golf: 'green' }, square(305, 0, 12)),
  way(11, { golf: 'tee' }, square(-5, 0, 4)),
  way(12, { golf: 'bunker' }, square(250, 30, 5)),
  way(13, { golf: 'bunker' }, square(150, 120, 5)),
  way(14, { natural: 'water' }, square(150, -70, 20)),
  way(15, { golf: 'driving_range' }, square(0, -300, 50)),
  { type: 'node', id: 20, lat: at(305, 0).lat, lon: at(305, 0).lon, tags: { golf: 'pin' } },
  { type: 'relation', id: 30, tags: { golf: 'bunker' } },
];

const fetched = parseOverpass(elements);
const map: CourseMap = newCourseMap('c1', { type: 'way', id: 99 }, 'GC Test', fetched);

describe('parseOverpass', () => {
  it('reads Hole Lines and golf features, ignoring relations and practice areas', () => {
    expect(fetched.holeLines.map((l) => [l.osmId, l.ref])).toEqual([
      [1, 1],
      [2, 2],
      [3, undefined],
    ]);
    expect(fetched.features.map((f) => `${f.osmId}:${f.kind}`)).toEqual([
      '10:green',
      '11:tee',
      '12:bunker',
      '13:bunker',
      '14:water',
      '20:pin',
    ]);
  });

  it('takes the hole number from ref, else from a name like "Loch 3" or "Hole 12"', () => {
    expect(holeRef({ ref: '7' })).toBe(7);
    expect(holeRef({ name: 'Loch 3' })).toBe(3);
    expect(holeRef({ name: 'Hole 12' })).toBe(12);
    expect(holeRef({ name: 'Bahn 4' })).toBe(4);
    expect(holeRef({ name: 'Signature Hole' })).toBeUndefined();
    expect(holeRef({ ref: 'A1' })).toBeUndefined();
  });
});

describe('Hole Line assignment', () => {
  it('matches unique refs and leaves lines without a number unassigned', () => {
    expect([...assignedHoleLines(map)].map(([n, l]) => [n, l.osmId])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(unassignedHoleLines(map).map((l) => l.osmId)).toEqual([3]);
  });

  it('leaves both lines unassigned when two share a ref, until one is assigned', () => {
    const twoCourses = { ...map, holeLines: [...map.holeLines, { osmId: 4, ref: 1, points: [at(0, -50), at(200, -50)] }] };
    expect(assignedHoleLines(twoCourses).has(1)).toBe(false);
    const chosen = assignHoleLine(twoCourses, 4, 1);
    expect(assignedHoleLines(chosen).get(1)?.osmId).toBe(4);
    expect(unassignedHoleLines(chosen).map((l) => l.osmId)).toEqual([1, 3]);
  });

  it('lets a manual assignment win over a ref, and moves it when reassigned', () => {
    const manual = assignHoleLine(map, 3, 2);
    expect(assignedHoleLines(manual).get(2)?.osmId).toBe(3);
    expect(unassignedHoleLines(manual).map((l) => l.osmId)).toEqual([2]);
    const moved = assignHoleLine(manual, 3, 5);
    expect(moved.assignments).toEqual([{ holeNumber: 5, osmId: 3 }]);
    expect(assignedHoleLines(moved).get(2)?.osmId).toBe(2);
    expect(assignHoleLine(moved, 3, null).assignments).toEqual([]);
  });

  it('keeps assignments on a refresh of the same OSM course only', () => {
    const assigned = assignHoleLine(map, 3, 3);
    expect(newCourseMap('c1', { type: 'way', id: 99 }, 'GC Test', fetched, assigned).assignments).toEqual([{ holeNumber: 3, osmId: 3 }]);
    expect(newCourseMap('c1', { type: 'way', id: 98 }, 'Other', fetched, assigned).assignments).toEqual([]);
  });
});

describe('holeLineLengthM', () => {
  it('measures a Hole Line along its points', () => {
    expect(holeLineLengthM(map, { osmId: 1, points: [at(0, 0), at(300, 0), at(300, 100)] })).toBeCloseTo(400, 0);
  });
});

describe('hole outlines', () => {
  // Some courses (e.g. Freiburger Golfclub) map golf=hole as a closed outline: here a corridor running north,
  // with the green at its north end and the tee at its south end.
  const outline = [at(-25, -10), at(25, -10), at(25, 260), at(-25, 260), at(-25, -10)];
  const area: CourseMap = newCourseMap('c2', { type: 'way', id: 7 }, 'Outline GC', {
    holeLines: [{ osmId: 1, ref: 1, points: outline }],
    features: [
      { osmId: 10, kind: 'green', points: square(0, 240, 10) },
      { osmId: 11, kind: 'tee', points: square(0, 5, 4) },
      { osmId: 12, kind: 'bunker', points: square(15, 200, 4) },
      { osmId: 13, kind: 'bunker', points: square(60, 200, 4) },
    ],
  });

  it('are recognised by their closed ring', () => {
    expect(isHoleArea(area.holeLines[0])).toBe(true);
    expect(isHoleArea(map.holeLines[0])).toBe(false);
  });

  it('point the Hole Map from the tee inside to the green inside', () => {
    const view = holeMap(area, 1)!;
    const centre = (id: number) => {
      const pts = view.shapes.find((s) => s.osmId === id)!.points.slice(0, -1); // ring without its closing point
      return pts.reduce((c, p) => ({ x: c.x + p.x / pts.length, y: c.y + p.y / pts.length }), { x: 0, y: 0 });
    };
    expect(centre(10).x).toBeCloseTo(centre(11).x, 0);
    expect(centre(10).y).toBeLessThan(centre(11).y - 200);
    expect(view.lines[0].area).toBe(true);
  });

  it('count features inside the outline and fade those outside it', () => {
    const view = holeMap(area, 1)!;
    expect(view.shapes.find((s) => s.osmId === 12)?.faded).toBe(false);
    expect(view.shapes.find((s) => s.osmId === 13)?.faded ?? true).toBe(true);
  });

  it('are measured from tee to green', () => {
    expect(holeLineLengthM(area, area.holeLines[0])).toBeCloseTo(235, 0);
  });
});

describe('featureDistance', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];
  it('measures to the nearest segment', () => {
    expect(featureDistance([{ x: 50, y: 30 }], line)).toBeCloseTo(30);
    expect(featureDistance([{ x: 130, y: 40 }], line)).toBeCloseTo(50);
  });
  it('is 0 when the line runs inside an area', () => {
    const big = [
      { x: -200, y: -200 },
      { x: 200, y: -200 },
      { x: 200, y: 200 },
      { x: -200, y: 200 },
    ];
    expect(featureDistance(big, line)).toBe(0);
  });
});

describe('holeMap', () => {
  const view = holeMap(map, 1)!;
  const shape = (id: number) => view.shapes.find((s) => s.osmId === id);

  it('rotates the hole so the tee is at the bottom and the green at the top', () => {
    const [tee, green] = view.lines[0].points;
    expect(tee.x).toBeCloseTo(0, 0);
    expect(green.x).toBeCloseTo(0, 0);
    expect(green.y).toBeCloseTo(tee.y - 300, 0);
  });

  it('includes features within 40 m of the Hole Line and fades others in view', () => {
    expect(shape(10)?.faded).toBe(false); // green
    expect(shape(11)?.faded).toBe(false); // tee
    expect(shape(12)?.faded).toBe(false); // bunker 25 m off the line
    expect(shape(14)?.faded).toBe(true); // water 50 m off, still in view
    expect(shape(13)).toBeUndefined(); // bunker 115 m off, out of view
  });

  it('draws fairways and water below greens and bunkers', () => {
    const kinds = view.shapes.map((s) => s.kind);
    expect(kinds.indexOf('water')).toBeLessThan(kinds.indexOf('green'));
    expect(kinds.at(-1)).toBe('pin');
  });

  it('is null for a hole without a Hole Line', () => {
    expect(holeMap(map, 3)).toBeNull();
  });
});

describe('courseOverview', () => {
  it('labels assigned Hole Lines and highlights the chosen one', () => {
    const view = courseOverview(map, 3)!;
    expect(view.lines.map((l) => [l.osmId, l.label, l.highlighted])).toEqual([
      [1, '1', false],
      [2, '2', false],
      [3, undefined, true],
    ]);
  });

  it('is null for an empty Course Map', () => {
    expect(courseOverview({ ...map, holeLines: [], features: [] })).toBeNull();
  });
});
