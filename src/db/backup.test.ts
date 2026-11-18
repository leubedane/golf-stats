import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { GolfstatDb, ensureSeeded, getSettings } from './db';
import { exportBackup, importBackup, parseBackup } from './backup';
import { emptyCourse } from '../domain/course';

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
    await source.courses.put({ ...emptyCourse('male'), clubName: 'GC Backup' });
    const json = JSON.stringify(await exportBackup(source));

    const target = new GolfstatDb('backup-target');
    await ensureSeeded(target);
    await target.clubs.clear();
    await importBackup(target, parseBackup(json));
    expect(await target.clubs.count()).toBe(13);
    expect((await target.courses.toArray()).map((c) => c.clubName)).toEqual(['GC Backup']);
  });

  it('rejects foreign files', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow('Not a Golfstat backup file');
  });
});
