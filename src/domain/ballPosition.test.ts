import { describe, expect, it } from 'vitest';
import { defaultPinPosition, lieAt, mapDistanceM, setPinPosition, shotTraces, teePosition } from './ballPosition';
import { distanceBetweenM, holeMap, newCourseMap, parseOverpass, type OverpassElement } from './courseMap';
import { newShot, startRound, saveShot, finishHole } from './round';
import { emptyCourse } from './course';
import type { CourseMap, LatLon, Lie, Round, Shot } from './types';

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

// Hole 1 runs 300 m due east to a green with a pin 4 m short of its middle.
// Hole 2 runs north and has a green but no pin; hole 3 has no green at all.
const elements: OverpassElement[] = [
  way(1, { golf: 'hole', ref: '1' }, [at(0, 0), at(300, 0)]),
  way(2, { golf: 'hole', ref: '2' }, [at(0, 200), at(0, 400)]),
  way(3, { golf: 'hole', ref: '3' }, [at(500, 0), at(500, 150)]),
  way(10, { golf: 'green' }, square(305, 0, 12)),
  way(11, { golf: 'green' }, square(0, 405, 10)),
  way(12, { golf: 'fairway' }, square(200, 0, 25)),
  way(13, { golf: 'bunker' }, square(200, 20, 4)),
  { type: 'node', id: 20, lat: at(301, 0).lat, lon: at(301, 0).lon, tags: { golf: 'pin' } },
  { type: 'node', id: 21, lat: at(0, 405).lat + 1, lon: at(0, 405).lon, tags: { golf: 'pin' } }, // far away
];
const map: CourseMap = newCourseMap('c1', { type: 'way', id: 99 }, 'GC Test', parseOverpass(elements));
const near = (a: LatLon | null, b: LatLon, toleranceM = 0.5) => a !== null && distanceBetweenM(a, b) < toleranceM;

describe('the hole frame', () => {
  it('turns drawing coordinates back into the same positions', () => {
    const { frame } = holeMap(map, 1)!;
    const p = at(123, -45);
    expect(near(frame.toLatLon(frame.toScreen(p)), p, 0.01)).toBe(true);
  });

  it('keeps every feature when asked, for panning beyond the Hole', () => {
    expect(holeMap(map, 1)!.shapes.some((s) => s.osmId === 11)).toBe(false);
    expect(holeMap(map, 1, { allFeatures: true })!.shapes.some((s) => s.osmId === 11)).toBe(true);
  });
});

describe('Pin Position', () => {
  it("defaults to the Course Map's pin on the Hole's green", () => {
    expect(near(defaultPinPosition(map, 1), at(301, 0))).toBe(true);
  });

  it('falls back to the middle of the green, then to the end of the Hole Line', () => {
    expect(near(defaultPinPosition(map, 2), at(0, 405))).toBe(true);
    expect(near(defaultPinPosition(map, 3), at(500, 150))).toBe(true);
  });

  it('is null for a hole without a Hole Line', () => {
    expect(defaultPinPosition(map, 7)).toBeNull();
  });
});

describe('Ball Position', () => {
  it('starts the first Shot at the start of the Hole Line', () => {
    expect(near(teePosition(map, 1), at(0, 0))).toBe(true);
  });

  it('suggests the Lie from what lies under the ball', () => {
    expect(lieAt(map, at(305, 3))).toBe('green');
    expect(lieAt(map, at(200, 20))).toBe('bunker'); // a bunker inside the fairway wins
    expect(lieAt(map, at(190, 0))).toBe('fairway');
    expect(lieAt(map, at(100, 60))).toBe('rough');
  });

  it('measures Distance to Pin in whole meters', () => {
    expect(mapDistanceM(at(0, 0), at(301, 0))).toBe(301);
  });
});

function playedHole(): Round {
  const c = emptyCourse('male');
  let r = startRound({ course: c, tee: c.tees[0], startHole: 1, holeCount: 18, handicap: 10 });
  const placed = (lie: Lie, distanceM: number, position?: LatLon): Shot => ({ ...newShot({ lie, distanceM }), clubName: '7i', ...(position ? { position } : {}) });
  r = saveShot(r, 0, placed('tee', 301, at(0, 0)));
  r = saveShot(r, 0, placed('fairway', 111, at(190, 0)));
  r = saveShot(r, 0, placed('rough', 20)); // typed, no Ball Position
  r = saveShot(r, 0, placed('green', 6, at(305, 3)));
  return finishHole(r, 0, { kind: 'holed' });
}

describe('moving the pin', () => {
  it('recomputes Distance to Pin of Ball Positions off the Green and leaves typed distances alone', () => {
    const r = setPinPosition(playedHole(), 0, at(310, 0));
    expect(r.holes[0].shots.map((s) => s.distanceM)).toEqual([310, 120, 20, 6]);
    expect(near(r.holes[0].pin ?? null, at(310, 0))).toBe(true);
  });

  it('recomputes a pick-up position too', () => {
    let r = playedHole();
    r = { ...r, holes: r.holes.map((h, i) => (i === 0 ? { ...h, outcome: { kind: 'pickedUp', lie: 'fairway', distanceM: 1, position: at(250, 0) } } : h)) };
    const outcome = setPinPosition(r, 0, at(300, 0)).holes[0].outcome;
    expect(outcome).toMatchObject({ kind: 'pickedUp', distanceM: 50 });
  });
});

describe('shot traces', () => {
  it('draws Shots between known Ball Positions, the last one into the hole', () => {
    const traces = shotTraces(playedHole().holes[0], at(301, 0));
    // Shot 2 ends at a typed Shot without a Ball Position and shot 3 starts there, so neither is drawn.
    expect(traces.map((t) => t.n)).toEqual([1, 4]);
    expect(near(traces[1].to, at(301, 0))).toBe(true);
  });
});
