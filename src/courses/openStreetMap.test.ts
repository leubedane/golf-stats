import { describe, expect, it, vi } from 'vitest';
import { OsmError, courseMapQuery, fetchCourseMap, findGolfCourses, parseOsmReference } from './openStreetMap';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('parseOsmReference', () => {
  it('reads OSM links, short forms and bare way ids', () => {
    expect(parseOsmReference('https://www.openstreetmap.org/way/143875366')).toEqual({ type: 'way', id: 143875366 });
    expect(parseOsmReference('https://www.openstreetmap.org/relation/9351595#map=16/48.2/7.8')).toEqual({ type: 'relation', id: 9351595 });
    expect(parseOsmReference('r9351595')).toEqual({ type: 'relation', id: 9351595 });
    expect(parseOsmReference(' 143875366 ')).toEqual({ type: 'way', id: 143875366 });
    expect(parseOsmReference('Freiburger Golfclub')).toBeNull();
  });
});

describe('findGolfCourses', () => {
  const freiburg = {
    osm_type: 'way',
    osm_id: 143875366,
    category: 'leisure',
    type: 'golf_course',
    name: 'Freiburger Golfclub',
    display_name: 'Freiburger Golfclub, 1, Krüttweg, Zarten, Kirchzarten, Baden-Württemberg',
  };
  const restaurant = { ...freiburg, osm_type: 'node', osm_id: 1, category: 'amenity', type: 'restaurant' };

  it('keeps only golf course ways and relations', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse([freiburg, restaurant]));
    const found = await findGolfCourses('Freiburger Golfclub', 'Kirchzarten', fetchFn);
    expect(found).toEqual([
      { osm: { type: 'way', id: 143875366 }, name: 'Freiburger Golfclub', place: '1, Krüttweg, Zarten' },
    ]);
    expect(String(fetchFn.mock.calls[0][0])).toContain('q=Freiburger+Golfclub+Kirchzarten');
  });

  it('retries without the city when nothing matches', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse([freiburg]));
    expect(await findGolfCourses('Freiburger Golfclub', 'Freiburg', fetchFn)).toHaveLength(1);
    expect(String(fetchFn.mock.calls[1][0])).toContain('q=Freiburger+Golfclub&');
  });
});

describe('fetchCourseMap', () => {
  const ref = { type: 'way' as const, id: 99 };
  const overpass = {
    elements: [
      { type: 'way', id: 99, tags: { leisure: 'golf_course', name: 'GC Test' } },
      { type: 'way', id: 1, tags: { golf: 'hole', ref: '1' }, geometry: [{ lat: 48, lon: 7.9 }, { lat: 48.003, lon: 7.9 }] },
      { type: 'way', id: 2, tags: { golf: 'green' }, geometry: [{ lat: 48.003, lon: 7.9 }, { lat: 48.0031, lon: 7.9001 }, { lat: 48.003, lon: 7.9002 }] },
    ],
  };

  it('queries the golf features inside the course area', () => {
    const q = courseMapQuery(ref);
    expect(q).toContain('way(99)->.course;');
    expect(q).toContain('map_to_area');
    expect(q).toContain('out geom;');
  });

  it('falls back to the next Overpass server when one is busy', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response('busy', { status: 504 })).mockResolvedValueOnce(jsonResponse(overpass));
    const result = await fetchCourseMap(ref, fetchFn, ['https://a.example/api', 'https://b.example/api']);
    expect(result.osmName).toBe('GC Test');
    expect(result.holeLines.map((l) => l.osmId)).toEqual([1]);
    expect(result.features.map((f) => f.kind)).toEqual(['green']);
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['https://a.example/api', 'https://b.example/api']);
  });

  it('reports notFound when the OSM course does not exist', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ elements: [] }));
    await expect(fetchCourseMap(ref, fetchFn, ['https://a.example/api'])).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('reports the last error when every server fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('offline'));
    const err = await fetchCourseMap(ref, fetchFn, ['https://a.example/api']).catch((e) => e);
    expect(err).toBeInstanceOf(OsmError);
    expect(err.kind).toBe('network');
  });
});
