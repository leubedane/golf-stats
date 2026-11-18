import { describe, expect, it, vi } from 'vitest';
import { GolfCourseApiError, fetchCourse, searchCourses, toCourse } from './golfCourseApi';
import type { ApiCourseDetail } from './golfCourseApi';

const detail: ApiCourseDetail = {
  id: '7k2m9qb4',
  club_name: 'Golfclub Beispiel',
  course_name: 'Championship',
  location: { city: 'München', country: 'Germany' },
  tees: {
    male: [
      {
        tee_name: 'Yellow',
        course_rating: 71.2,
        slope_rating: 128,
        holes: [
          { par: 4, yardage: 400, meters: 366, handicap: 5 },
          { par: 3, yardage: 165, handicap: 17 },
        ],
      },
    ],
    female: [{ tee_name: 'Red', course_rating: 72.9, slope_rating: 126, holes: [] }],
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('toCourse', () => {
  it('maps tees, prefers meters and converts yards otherwise', () => {
    const c = toCourse(detail);
    expect(c.clubName).toBe('Golfclub Beispiel');
    expect(c.city).toBe('München');
    expect(c.source).toBe('api');
    expect(c.externalId).toBe('7k2m9qb4');
    expect(c.tees).toHaveLength(1); // female tee without holes dropped
    const tee = c.tees[0];
    expect(tee).toMatchObject({ name: 'Yellow', gender: 'male', courseRating: 71.2, slope: 128 });
    expect(tee.holes).toEqual([
      { number: 1, par: 4, lengthM: 366, strokeIndex: 5 },
      { number: 2, par: 3, lengthM: 151, strokeIndex: 17 },
    ]);
  });

  it('keeps the local id when refreshing an existing course', () => {
    const first = toCourse(detail);
    expect(toCourse(detail, first).id).toBe(first.id);
  });
});

describe('API requests', () => {
  it('sends the key as a bearer token and returns search results', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ courses: [{ id: 'abc', club_name: 'X', course_name: 'Y' }] }));
    const result = await searchCourses('beispiel golf', 'secret', fetchFn as unknown as typeof fetch);
    expect(result).toHaveLength(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.golfcourseapi.com/v1/search?search_query=beispiel%20golf');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
  });

  it('accepts a bare or wrapped course detail', async () => {
    const bare = vi.fn(async () => jsonResponse(detail)) as unknown as typeof fetch;
    const wrapped = vi.fn(async () => jsonResponse({ course: detail })) as unknown as typeof fetch;
    expect((await fetchCourse('7k2m9qb4', 'k', bare)).club_name).toBe('Golfclub Beispiel');
    expect((await fetchCourse('7k2m9qb4', 'k', wrapped)).club_name).toBe('Golfclub Beispiel');
  });

  it('reports a missing key without calling the API', async () => {
    const fetchFn = vi.fn();
    await expect(searchCourses('x', ' ', fetchFn as unknown as typeof fetch)).rejects.toMatchObject({ kind: 'noKey' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('maps HTTP errors to error kinds', async () => {
    for (const [status, kind] of [[401, 'unauthorized'], [429, 'rateLimited'], [500, 'server']] as const) {
      const fetchFn = vi.fn(async () => jsonResponse({ error: 'x' }, status)) as unknown as typeof fetch;
      const err = await searchCourses('x', 'k', fetchFn).catch((e) => e);
      expect(err).toBeInstanceOf(GolfCourseApiError);
      expect(err.kind).toBe(kind);
    }
  });
});
