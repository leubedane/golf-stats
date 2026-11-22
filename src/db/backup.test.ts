import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { GolfstatDb, deleteCourse, ensureSeeded, getSettings, saveStrategy } from './db';
import { exportBackup, importBackup, parseBackup } from './backup';
import { emptyCourse } from '../domain/course';
import { startRound } from '../domain/round';
import { emptyStrategy } from '../domain/holeStrategy';
import type { CourseMap } from '../domain/types';

const courseMap = (courseId: string): CourseMap => ({
  courseId,
  osm: { type: 'way', id: 1 },
  osmName: 'GC Backup',
  holeLines: [{ osmId: 2, ref: 1, points: [{ lat: 48, lon: 7.9 }, { lat: 48.003, lon: 7.9 }] }],
  features: [],
  assignments: [],
  fetchedAt: 0,
});

describe('database and backup', () => {
  it('seeds default settings and bag once', async () => {
    const database = new GolfstatDb('seed-test');
    await ensureSeeded(database);
    await ensureSeeded(database);
    expect((await getSettings(database)).handicap).toBe(6.8);
    expect(await database.clubs.count()).toBe(13);
  });

  it('round-trips all data through a JSON backup', async () => {
    const source = new GolfstatDb('backup-source');
    await ensureSeeded(source);
    const course = { ...emptyCourse('male'), clubName: 'GC Backup' };
    await source.courses.put(course);
    await source.rounds.put(startRound({ course, tee: course.tees[0], startHole: 1, holeCount: 18, handicap: 6.8 }));
    await saveStrategy({ ...emptyStrategy(course.id, 3), teeTarget: 'left bunker' }, source);
    await source.courseMaps.put(courseMap(course.id));
    const json = JSON.stringify(await exportBackup(source));

    const target = new GolfstatDb('backup-target');
    await ensureSeeded(target);
    await target.clubs.clear();
    await importBackup(target, parseBackup(json));
    expect(await target.clubs.count()).toBe(13);
    expect((await target.courses.toArray()).map((c) => c.clubName).sort()).toEqual(['GC Backup', 'Golfclub Tuniberg']);
    expect((await target.rounds.toArray()).map((r) => r.courseName)).toEqual(['GC Backup']);
    expect((await target.holeStrategies.toArray()).map((s) => s.teeTarget)).toEqual(['left bunker']);
    expect((await target.courseMaps.toArray()).map((m) => m.osmName)).toEqual(['GC Backup']);
  });

  it('reads version 4 backups without Course Maps', () => {
    const v4 = { format: 'golfstat-backup', version: 4, exportedAt: '', settings: [], clubs: [], courses: [], rounds: [], holeStrategies: [] };
    expect(parseBackup(JSON.stringify(v4)).courseMaps).toEqual([]);
  });

  it('reads version 2 backups without Hole Strategies', () => {
    const v2 = { format: 'golfstat-backup', version: 2, exportedAt: '', settings: [], clubs: [], courses: [], rounds: [] };
    expect(parseBackup(JSON.stringify(v2)).holeStrategies).toEqual([]);
  });

  it('stores a Hole Strategy, and deletes it once emptied', async () => {
    const database = new GolfstatDb('strategy-save');
    const s = { ...emptyStrategy('c', 1), notes: 'aim at the church' };
    await saveStrategy(s, database);
    expect((await database.holeStrategies.get(s.id))?.updatedAt).toBeGreaterThan(0);
    await saveStrategy({ ...s, notes: '' }, database);
    expect(await database.holeStrategies.count()).toBe(0);
  });

  it('deletes a Course together with its Course Strategy and Course Map', async () => {
    const database = new GolfstatDb('strategy-cascade');
    const course = emptyCourse('male');
    await database.courses.put(course);
    await saveStrategy({ ...emptyStrategy(course.id, 1), notes: 'a' }, database);
    await saveStrategy({ ...emptyStrategy('other', 1), notes: 'b' }, database);
    await database.courseMaps.bulkPut([courseMap(course.id), courseMap('other')]);
    await deleteCourse(course.id, database);
    expect((await database.courseMaps.toArray()).map((m) => m.courseId)).toEqual(['other']);
    expect(await database.courses.get(course.id)).toBeUndefined();
    expect((await database.holeStrategies.toArray()).map((s) => s.courseId)).toEqual(['other']);
  });

  it('reads version 1 backups without rounds', () => {
    const v1 = { format: 'golfstat-backup', version: 1, exportedAt: '', settings: [], clubs: [], courses: [] };
    expect(parseBackup(JSON.stringify(v1)).rounds).toEqual([]);
  });

  it('rejects foreign files', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow('Not a Golfstat backup file');
  });
});
