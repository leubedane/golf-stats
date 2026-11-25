import type { GolfstatDb } from './db';
import type { Club, Course, CourseMap, HoleStrategy, Round, Settings } from '../domain/types';

export const BACKUP_FORMAT = 'golfstat-backup';
/**
 * 4: Round holes may carry an entered Hole Score (`score`); older backups have none and import unchanged.
 * 5: Course Maps (`courseMaps`); older backups import with none.
 * 6: Shots and pick-ups may carry a Ball Position (`position`), Round holes a Pin Position (`pin`); older backups have none (ADR 0005).
 */
export const BACKUP_VERSION = 6;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings[];
  clubs: Club[];
  courses: Course[];
  rounds: Round[];
  holeStrategies: HoleStrategy[];
  courseMaps: CourseMap[];
}

export async function exportBackup(database: GolfstatDb): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: await database.settings.toArray(),
    clubs: await database.clubs.toArray(),
    courses: await database.courses.toArray(),
    rounds: await database.rounds.toArray(),
    holeStrategies: await database.holeStrategies.toArray(),
    courseMaps: await database.courseMaps.toArray(),
  };
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text) as Partial<Backup>;
  if (data.format !== BACKUP_FORMAT) throw new Error('Not a Golfstat backup file');
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION)
    throw new Error(`Unsupported backup version: ${data.version}`);
  if (!Array.isArray(data.settings) || !Array.isArray(data.clubs) || !Array.isArray(data.courses))
    throw new Error('Backup file is incomplete');
  // Version 1 backups predate rounds, versions 1 and 2 predate Hole Strategies, versions 1 to 4 predate Course Maps.
  return {
    ...(data as Backup),
    rounds: Array.isArray(data.rounds) ? data.rounds : [],
    holeStrategies: Array.isArray(data.holeStrategies) ? data.holeStrategies : [],
    courseMaps: Array.isArray(data.courseMaps) ? data.courseMaps : [],
  };
}

/** Replaces all local data with the backup's contents. */
export async function importBackup(database: GolfstatDb, backup: Backup): Promise<void> {
  const tables = [database.settings, database.clubs, database.courses, database.rounds, database.holeStrategies, database.courseMaps];
  await database.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await database.settings.bulkPut(backup.settings);
    await database.clubs.bulkPut(backup.clubs);
    await database.courses.bulkPut(backup.courses);
    await database.rounds.bulkPut(backup.rounds);
    await database.holeStrategies.bulkPut(backup.holeStrategies);
    await database.courseMaps.bulkPut(backup.courseMaps);
  });
}
