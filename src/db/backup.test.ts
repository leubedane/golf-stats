import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { GolfstatDb, ensureSeeded, getSettings } from './db';
import { exportBackup, importBackup, parseBackup } from './backup';
import { emptyCourse } from '../domain/course';
import { startRound } from '../domain/round';

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
    const json = JSON.stringify(await exportBackup(source));

    const target = new GolfstatDb('backup-target');
    await ensureSeeded(target);
    await target.clubs.clear();
    await importBackup(target, parseBackup(json));
    expect(await target.clubs.count()).toBe(13);
    expect((await target.courses.toArray()).map((c) => c.clubName).sort()).toEqual(['GC Backup', 'Golfclub Tuniberg']);
    expect((await target.rounds.toArray()).map((r) => r.courseName)).toEqual(['GC Backup']);
  });

  it('reads version 1 backups without rounds', () => {
    const v1 = { format: 'golfstat-backup', version: 1, exportedAt: '', settings: [], clubs: [], courses: [] };
    expect(parseBackup(JSON.stringify(v1)).rounds).toEqual([]);
  });

  it('rejects foreign files', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow('Not a Golfstat backup file');
  });
});
