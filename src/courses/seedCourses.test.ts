import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { GolfstatDb } from '../db/db';
import { coursePar, validateCourse } from '../domain/course';
import { seedCourses } from './seedCourses';

describe('seed courses', () => {
  it('are valid Courses', () => {
    for (const course of seedCourses()) expect(validateCourse(course)).toEqual([]);
  });

  it('carry the Tuniberg scorecard', () => {
    const [tuniberg] = seedCourses();
    expect(tuniberg.tees).toHaveLength(10);
    const white = tuniberg.tees.find((t) => t.id === 'tuniberg-weiss-male')!;
    expect([white.courseRating, white.slope, coursePar(white)]).toEqual([72.7, 128, 72]);
    expect(white.holes[15]).toEqual({ number: 16, par: 4, strokeIndex: 1, lengthM: 384 });
  });

  it('are added to a new database', async () => {
    const database = new GolfstatDb('seed-new');
    expect((await database.courses.toArray()).map((c) => c.id)).toEqual(['seed-gc-tuniberg']);
  });

  it('are added to an existing version 2 database, keeping its courses', async () => {
    const v2 = new Dexie('seed-upgrade');
    v2.version(1).stores({ settings: 'id', clubs: 'id, order', courses: 'id, externalId, clubName' });
    v2.version(2).stores({ rounds: 'id, startedAt, courseId' });
    await v2.table('courses').put({ id: 'mine', clubName: 'GC Mine', tees: [] });
    v2.close();

    const database = new GolfstatDb('seed-upgrade');
    expect((await database.courses.toArray()).map((c) => c.id).sort()).toEqual(['mine', 'seed-gc-tuniberg']);
  });
});
